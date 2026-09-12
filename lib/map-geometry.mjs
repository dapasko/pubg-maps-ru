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
// Calibration against the source Erangel raster: 74 m north and 10 m west.
// The same map-space correction is applied before CSS scaling, so it remains
// identical at every zoom level.
export const markerNorthingCorrection = 2.368;
export const markerEastingCorrection = -0.32;

export function markerPoint([northing, easting]) {
  return {
    x: Math.min(1, Math.max(0, (easting + markerEastingCorrection) / 256)),
    y: Math.min(1, Math.max(0, (-northing - markerNorthingCorrection) / 256)),
  };
}
