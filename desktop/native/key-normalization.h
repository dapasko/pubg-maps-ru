#pragma once
#include <cstdint>
inline std::uint16_t normalizeVirtualKey(std::uint16_t key, std::uint16_t scan, std::uint16_t flags) {
  if (key == 0x10) {
    if (scan == 0x2a) return 0xa0;
    if (scan == 0x36) return 0xa1;
  }
  if (key == 0x11) return (flags & 0x02) ? 0xa3 : 0xa2;
  if (key == 0x12) return (flags & 0x02) ? 0xa5 : 0xa4;
  return key;
}
