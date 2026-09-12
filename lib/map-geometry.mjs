export function distanceMeters(first, second, sizeKm = 8) {
  return Math.hypot(first.x - second.x, first.y - second.y) * sizeKm * 1000;
}

export function gridStepMeters(zoom) {
  return zoom >= 2.2 ? 100 : 1000;
}

// Source marker coordinates use 256 units across an 8 km playable grid.
// The supplied raster maps carry a 160 m frame at their southern edge.
export const markerNorthingCorrection = 5.12;

export function markerPoint([northing, easting]) {
  return {
    x: Math.min(1, Math.max(0, easting / 256)),
    y: Math.min(1, Math.max(0, (-northing - markerNorthingCorrection) / 256)),
  };
}
