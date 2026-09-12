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
// Only Erangel needs a raster-to-marker calibration. The other source maps
// already share their marker coordinate system, so a global correction would
// shift every one of their markers away from its object.
export const markerNorthingCorrection = 0.544;
export const markerEastingCorrection = -0.416;

export function markerCalibration(mapId) {
  return mapId === 'erangel'
    ? { northing: markerNorthingCorrection, easting: markerEastingCorrection }
    : { northing: 0, easting: 0 };
}

export function markerPoint([northing, easting], mapId = 'erangel') {
  const calibration = markerCalibration(mapId);
  return {
    x: Math.min(1, Math.max(0, (easting + calibration.easting) / 256)),
    y: Math.min(1, Math.max(0, (-northing - calibration.northing) / 256)),
  };
}
