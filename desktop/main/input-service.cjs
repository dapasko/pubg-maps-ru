'use strict';
const WM_INPUT = 0x00ff;
const modifiers = new Set([0x10, 0x11, 0x12, 0xa0, 0xa1, 0xa2, 0xa3, 0xa4, 0xa5, 0x5b, 0x5c]);
const reserved = new Set([0x4d, 0x1b, 0x25, 0x26, 0x27, 0x28, ...modifiers]);
function validateBindings(bindings = {}) {
  if (!bindings || typeof bindings !== 'object' || Array.isArray(bindings)) throw Error('Invalid bindings');
  const entries = Object.entries(bindings);
  const keys = new Set();
  for (const [action, key] of entries) {
    if (!['toggleOverlay', 'toggleInteraction'].includes(action)) throw Error('Unknown hotkey action');
    if (!Number.isInteger(key) || key < 0x20 || key > 0xfe) throw Error('Invalid virtual key');
    if (reserved.has(key)) throw Error('Reserved key');
    if (keys.has(key)) throw Error('Duplicate binding');
    keys.add(key);
  }
  return { ...bindings };
}
function createHotkeyMatcher(bindings, onAction) {
  const assignments = validateBindings(bindings);
  const pressed = new Set();
  let suspended = false;
  return {
    receive(event) {
      if (!event || !Number.isInteger(event.virtualKey) || typeof event.isDown !== 'boolean') return;
      const key = event.virtualKey;
      if (!event.isDown) { pressed.delete(key); return; }
      if (pressed.has(key)) return;
      pressed.add(key);
      if (suspended || [...pressed].some(k => modifiers.has(k))) return;
      if (key === 0x4d) { onAction('toggleOverlay'); return; }
      for (const [action, code] of Object.entries(assignments)) if (code === key) { onAction(action); return; }
    },
    seed(keys) { pressed.clear(); for (const key of keys) if (Number.isInteger(key)) pressed.add(key); },
    setSuspended(value) { suspended = Boolean(value); },
    reset() { pressed.clear(); },
  };
}
function createInputService({ window, native, bindings, onAction, onError = () => {} }) {
  const matcher = createHotkeyMatcher(bindings, onAction);
  let started = false;
  return {
    start() {
      if (started) return;
      native.registerKeyboard(window.getNativeWindowHandle());
      try {
        const keys = [...modifiers].filter(k => ![0x10,0x11,0x12].includes(k));
        matcher.seed(native.getPressedKeys?.([...keys,0x4d,...Object.values(bindings ?? {})]) ?? []);
        window.hookWindowMessage(WM_INPUT, (_wParam, lParam) => {
          try { matcher.receive(native.readKeyboard(lParam)); } catch (error) { onError(error); }
        });
        started = true;
      } catch (error) { native.unregisterKeyboard(); throw error; }
    },
    stop() {
      if (!started) return;
      started = false;
      try { window.unhookWindowMessage(WM_INPUT); } finally { native.unregisterKeyboard(); matcher.reset(); }
    },
    setSuspended: matcher.setSuspended,
  };
}
module.exports = { createHotkeyMatcher, createInputService, validateBindings };
