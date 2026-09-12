export function distanceMeters(first, second, sizeKm = 8) {
  return Math.hypot(first.x - second.x, first.y - second.y) * sizeKm * 1000;
}

export function gridStepMeters(zoom) {
  return zoom >= 2.2 ? 100 : 1000;
}

export function tileLevelForZoom(zoom) {
  if (zoom < 2) return null;
  return zoom < 4 ? 3 : 4;
}

// Source marker coordinates use 256 units across an 8 km playable grid.
// Calibration against the measured Erangel reference point: 17 m north.
// It is applied in map coordinates before the map is rendered at any zoom.
export const markerNorthingCorrection = 0.544;
export const markerEastingCorrection = 0;

export function markerPoint([northing, easting]) {
  return {
    x: Math.min(1, Math.max(0, (easting + markerEastingCorrection) / 256)),
    y: Math.min(1, Math.max(0, (-northing - markerNorthingCorrection) / 256)),
  };
}
