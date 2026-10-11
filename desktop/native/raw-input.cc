#include <node_api.h>
#include <windows.h>
#include <cstdint>
#include <cstring>
#include <string>
#include <vector>
#include "key-normalization.h"

namespace {
bool registered = false;

napi_value Failure(napi_env env, const char* operation) {
  const std::string message = std::string(operation) + " failed (Windows error " + std::to_string(GetLastError()) + ")";
  napi_throw_error(env, nullptr, message.c_str());
  return nullptr;
}

napi_value Undefined(napi_env env) { napi_value value; napi_get_undefined(env, &value); return value; }

bool HandleArgument(napi_env env, napi_callback_info info, uintptr_t* handle) {
  size_t count = 1;
  napi_value arg;
  if (napi_get_cb_info(env, info, &count, &arg, nullptr, nullptr) != napi_ok || count != 1) {
    napi_throw_type_error(env, nullptr, "Expected one native handle buffer"); return false;
  }
  bool buffer = false;
  napi_is_buffer(env, arg, &buffer);
  void* bytes = nullptr;
  size_t length = 0;
  if (!buffer || napi_get_buffer_info(env, arg, &bytes, &length) != napi_ok || length != sizeof(uintptr_t)) {
    napi_throw_type_error(env, nullptr, "Expected a pointer-sized native handle buffer"); return false;
  }
  std::memcpy(handle, bytes, sizeof(uintptr_t));
  return true;
}

napi_value RegisterKeyboard(napi_env env, napi_callback_info info) {
  uintptr_t address;
  if (!HandleArgument(env, info, &address)) return nullptr;
  HWND window = reinterpret_cast<HWND>(address);
  DWORD pid = 0;
  if (!IsWindow(window) || !GetWindowThreadProcessId(window, &pid) || pid != GetCurrentProcessId()) {
    napi_throw_error(env, nullptr, "Raw Input target must be a window owned by this application"); return nullptr;
  }
  if (registered) { napi_throw_error(env, nullptr, "Keyboard input is already registered"); return nullptr; }
  RAWINPUTDEVICE device = {0x01, 0x06, RIDEV_INPUTSINK, window};
  if (!RegisterRawInputDevices(&device, 1, sizeof(device))) return Failure(env, "RegisterRawInputDevices");
  registered = true;
  return Undefined(env);
}

napi_value UnregisterKeyboard(napi_env env, napi_callback_info) {
  if (!registered) return Undefined(env);
  RAWINPUTDEVICE device = {0x01, 0x06, RIDEV_REMOVE, nullptr};
  if (!RegisterRawInputDevices(&device, 1, sizeof(device))) return Failure(env, "Unregister keyboard");
  registered = false;
  return Undefined(env);
}

napi_value ReadKeyboard(napi_env env, napi_callback_info info) {
  uintptr_t address;
  if (!HandleArgument(env, info, &address)) return nullptr;
  UINT bytes = 0;
  HRAWINPUT input = reinterpret_cast<HRAWINPUT>(address);
  if (GetRawInputData(input, RID_INPUT, nullptr, &bytes, sizeof(RAWINPUTHEADER)) == UINT(-1)) return Failure(env, "Read keyboard size");
  if (bytes < sizeof(RAWINPUTHEADER) || bytes > 65536) { napi_throw_error(env, nullptr, "Invalid Raw Input size"); return nullptr; }
  std::vector<unsigned char> storage(bytes);
  UINT copied = GetRawInputData(input, RID_INPUT, storage.data(), &bytes, sizeof(RAWINPUTHEADER));
  if (copied == UINT(-1)) return Failure(env, "Read keyboard event");
  if (copied != bytes || bytes < sizeof(RAWINPUTHEADER)) { napi_throw_error(env, nullptr, "Incomplete Raw Input event"); return nullptr; }
  const RAWINPUT* data = reinterpret_cast<const RAWINPUT*>(storage.data());
  if (data->header.dwType != RIM_TYPEKEYBOARD || bytes < sizeof(RAWINPUTHEADER) + sizeof(RAWKEYBOARD) || data->data.keyboard.VKey == 255) {
    napi_value value; napi_get_null(env, &value); return value;
  }
  const RAWKEYBOARD& keyboard = data->data.keyboard;
  napi_value result, key, scan, down;
  napi_create_object(env, &result);
  napi_create_uint32(env, normalizeVirtualKey(keyboard.VKey, keyboard.MakeCode, keyboard.Flags), &key);
  napi_create_uint32(env, keyboard.MakeCode, &scan);
  napi_get_boolean(env, !(keyboard.Flags & RI_KEY_BREAK), &down);
  napi_set_named_property(env, result, "virtualKey", key);
  napi_set_named_property(env, result, "scanCode", scan);
  napi_set_named_property(env, result, "isDown", down);
  return result;
}

napi_value PressedKeys(napi_env env, napi_callback_info info) {
  size_t count = 1;
  napi_value arg;
  napi_get_cb_info(env, info, &count, &arg, nullptr, nullptr);
  bool isArray = false;
  if (count != 1 || napi_is_array(env, arg, &isArray) != napi_ok || !isArray) {
    napi_throw_type_error(env, nullptr, "Expected virtual key array"); return nullptr;
  }
  uint32_t length;
  napi_get_array_length(env, arg, &length);
  if (length > 256) { napi_throw_range_error(env, nullptr, "Too many keys"); return nullptr; }
  napi_value result;
  napi_create_array(env, &result);
  uint32_t output = 0;
  for (uint32_t index = 0; index < length; ++index) {
    napi_value element;
    napi_get_element(env, arg, index, &element);
    uint32_t key;
    if (napi_get_value_uint32(env, element, &key) != napi_ok || key > 255) {
      napi_throw_type_error(env, nullptr, "Invalid virtual key"); return nullptr;
    }
    if (GetAsyncKeyState(static_cast<int>(key)) & 0x8000) {
      napi_value value; napi_create_uint32(env, key, &value); napi_set_element(env, result, output++, value);
    }
  }
  return result;
}

napi_value Foreground(napi_env env, napi_callback_info) {
  uintptr_t address = reinterpret_cast<uintptr_t>(GetForegroundWindow());
  napi_value buffer;
  napi_create_buffer_copy(env, sizeof(address), &address, nullptr, &buffer);
  return buffer;
}

napi_value RestoreForeground(napi_env env, napi_callback_info info) {
  uintptr_t address;
  if (!HandleArgument(env, info, &address)) return nullptr;
  HWND window = reinterpret_cast<HWND>(address);
  bool restored = IsWindow(window) && SetForegroundWindow(window);
  napi_value result; napi_get_boolean(env, restored, &result); return result;
}

void Cleanup(void*) {
  if (registered) {
    RAWINPUTDEVICE device = {0x01, 0x06, RIDEV_REMOVE, nullptr};
    RegisterRawInputDevices(&device, 1, sizeof(device));
    registered = false;
  }
}

napi_value Init(napi_env env, napi_value exports) {
  napi_property_descriptor properties[] = {
    {"registerKeyboard", nullptr, RegisterKeyboard, nullptr, nullptr, nullptr, napi_default, nullptr},
    {"unregisterKeyboard", nullptr, UnregisterKeyboard, nullptr, nullptr, nullptr, napi_default, nullptr},
    {"readKeyboard", nullptr, ReadKeyboard, nullptr, nullptr, nullptr, napi_default, nullptr},
    {"getPressedKeys", nullptr, PressedKeys, nullptr, nullptr, nullptr, napi_default, nullptr},
    {"getForegroundWindow", nullptr, Foreground, nullptr, nullptr, nullptr, napi_default, nullptr},
    {"restoreForegroundWindow", nullptr, RestoreForeground, nullptr, nullptr, nullptr, napi_default, nullptr},
  };
  napi_define_properties(env, exports, sizeof(properties) / sizeof(properties[0]), properties);
  napi_add_env_cleanup_hook(env, Cleanup, nullptr);
  return exports;
}
}
NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)
