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

// Source marker coordinates span 256 units across the full raster.
// Independent pubg.gs world-coordinate anchors and native tile comparisons
// confirm the same origin and axes on all six maps. The September Erangel
// offset introduced a ~13 px diagonal error on its current 8192 px raster.
// See data/map-reference-points.json for the versioned measurement evidence.
export const markerNorthingCorrection = 0;
export const markerEastingCorrection = 0;

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
