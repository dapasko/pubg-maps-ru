import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { markerPoint } from '../lib/map-geometry.mjs';
import { matchPointSets, summarizeErrors } from '../lib/marker-audit.mjs';

const readJson = async path => JSON.parse(await readFile(path));
const root = new URL('../', import.meta.url);
const markers = await readJson(new URL('data/markers.json', root));
const snapshot = await readJson(new URL('data/marker-source-snapshot.json', root));
const references = await readJson(new URL('data/map-reference-points.json', root));
const pixels = 8192;
const tolerancePixels = references.tolerancePixels;
const position = point => Array.isArray(point) ? point : [point.x, point.y];
const report = {
  schemaVersion: 1, sourceCheckedAt: snapshot.checkedAt, referenceBuild: snapshot.build,
  localSource: markers.source, localDeclaredUpdated: markers.updated,
  tolerancePixels,
  interpretation: 'Coordinate comparison with an archived external snapshot. Local gameplay modes are unspecified. Base (mode-less) and IBR evidence remain separate. Unmatched positions do not prove added, removed, or moved objects. Unrepresented categories remain unverified.',
  maps: [],
};

for (const external of snapshot.maps) {
  const mapId = external.mapId;
  const local = markers.maps.find(map => map.name.toLowerCase() === mapId);
  const toPixel = point => position(point).map(value => value / external.extentCm * pixels);
  const localPixel = coordinate => {
    const point = markerPoint(coordinate, mapId);
    return [point.x * pixels, point.y * pixels];
  };
  const anchors = references.maps.find(map => map.mapId === mapId);
  const anchorErrors = anchors.points.map(point => {
    const [x, y] = localPixel(point.sourceCoordinate);
    return Math.hypot(x - point.referencePixel[0], y - point.referencePixel[1]);
  });
  const row = { mapId, referenceUrl: external.url, referenceSha256: external.sha256,
    extentCm: external.extentCm, localCount: local.groups.reduce((sum, group) => sum + group.points.length, 0),
    anchors: { count: anchorErrors.length, ...summarizeErrors(anchorErrors) },
    groups: [], externalOnlyVehicleGroups: [] };

  for (const group of local.groups) {
    const typeKey = group.typeKey;
    let layer, vehicleGroup;
    if (typeKey === 'blueChipTower') layer = 'towers';
    if (typeKey === 'brokenPotSpawner') layer = 'itemBoxes';
    if (typeKey === 'bearCaves') layer = 'other';
    if (typeKey.startsWith('vehiclesGroup')) {
      layer = 'vehicles';
      vehicleGroup = typeKey.split('-')[0].slice('vehiclesGroup'.length);
      if (vehicleGroup === 'A') vehicleGroup = 'Default';
    }
    let points = layer ? external.layers[layer] ?? [] : [];
    if (layer === 'vehicles') points = points.filter(point => point.group === vehicleGroup);
    if (layer === 'other') points = points.filter(point => point.cls === 'BP_BearSpawnStart_C');
    const basePoints = points.filter(point => !point.mode);
    const otherModePoints = points.filter(point => point.mode);
    if (!layer || !points.length) {
      row.groups.push({ typeKey, localCount: group.points.length, status: 'unverified-category',
        reason: !layer ? 'No established equivalent category in pubg.gs; do not infer by name.' : 'Equivalent external category is absent from this snapshot.' });
      continue;
    }
    const projected = group.points.map(localPixel);
    const basePixels = basePoints.map(toPixel);
    const comparison = matchPointSets(projected, basePixels, tolerancePixels);
    const unmatched = comparison.localOnly.map(index => {
      const p = projected[index];
      const nearest = basePixels.map((pixel, referenceIndex) => ({ referenceIndex, errorPixels: Math.hypot(pixel[0] - p[0], pixel[1] - p[1]) }))
        .sort((a, b) => a.errorPixels - b.errorPixels)[0] ?? null;
      return { pointIndex: index, sourceCoordinate: group.points[index], nearestBaseReference: nearest };
    });
    // Separately record possible matches against each named mode. Never pool
    // different modes or interpret the local source's missing mode as Normal.
    const modeEvidence = [...new Set(otherModePoints.map(point => point.mode))].map(mode => {
      const subset = otherModePoints.filter(point => point.mode === mode);
      const compared = matchPointSets(comparison.localOnly.map(index => projected[index]), subset.map(toPixel), tolerancePixels);
      return { mode, referenceCount: subset.length, matchesAmongBaseUnmatched: compared.matched.length,
        localPointIndices: compared.matched.map(pair => comparison.localOnly[pair.localIndex]) };
    });
    row.groups.push({ typeKey, status: 'compared-coordinates', referenceLayer: layer, referenceGroup: vehicleGroup ?? null,
      localMode: null, referenceMode: 'unspecified/base', localCount: projected.length, baseReferenceCount: basePoints.length,
      matchedCount: comparison.matched.length, ...summarizeErrors(comparison.matched.map(pair => pair.errorPixels)),
      localUnmatched: unmatched,
      referenceUnmatched: comparison.referenceOnly.map(index => ({ referenceIndex: index, worldCoordinateCm: position(basePoints[index]), level: basePoints[index].level ?? null })),
      otherModeEvidence: modeEvidence });
  }
  const localVehicleKeys = new Set(local.groups.filter(group => group.typeKey.startsWith('vehiclesGroup')).map(group => {
    const key = group.typeKey.split('-')[0].slice('vehiclesGroup'.length); return key === 'A' ? 'Default' : key;
  }));
  for (const group of new Set(external.layers.vehicles.map(point => point.group).filter(Boolean))) {
    if (!localVehicleKeys.has(group)) row.externalOnlyVehicleGroups.push({ group, count: external.layers.vehicles.filter(point => point.group === group && !point.mode).length });
  }
  row.externalUngroupedVehiclesByMode = Object.fromEntries([...new Set(external.layers.vehicles.filter(point => !point.group).map(point => point.mode ?? 'unspecified/base'))]
    .map(mode => [mode, external.layers.vehicles.filter(point => !point.group && (point.mode ?? 'unspecified/base') === mode).length]));
  const remainingVehicles = row.groups.filter(group => group.referenceLayer === 'vehicles').flatMap(group => {
    const modeMatched = new Set(group.otherModeEvidence.flatMap(mode => mode.localPointIndices));
    return group.localUnmatched.filter(point => !modeMatched.has(point.pointIndex)).map(point => ({ typeKey: group.typeKey, ...point }));
  });
  row.ungroupedModeCoordinateEvidence = Object.keys(row.externalUngroupedVehiclesByMode).map(mode => {
    const points = external.layers.vehicles.filter(point => !point.group && (point.mode ?? 'unspecified/base') === mode);
    const compared = matchPointSets(remainingVehicles.map(point => localPixel(point.sourceCoordinate)), points.map(toPixel), tolerancePixels);
    return { mode, referenceCount: points.length, coordinateMatchCount: compared.matched.length,
      interpretation: 'Position-only evidence: external vehicle group is unknown; local mode is unknown. Not a verified category match.',
      matches: compared.matched.map(pair => ({ typeKey: remainingVehicles[pair.localIndex].typeKey,
        pointIndex: remainingVehicles[pair.localIndex].pointIndex, worldCoordinateCm: position(points[pair.referenceIndex]), errorPixels: pair.errorPixels })) };
  });
  row.coordinateMatchedCount = row.groups.reduce((sum, group) => sum + (group.matchedCount ?? 0), 0);
  report.maps.push(row);
}
const json = `${JSON.stringify(report, null, 2)}\n`;
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--output')) throw new Error('Usage: node tools/audit-marker-alignment.mjs [--output report.json]');
if (args.length) {
  await mkdir(dirname(args[1]), { recursive: true });
  await writeFile(args[1], json);
  for (const row of report.maps) console.log(`${row.mapId}: ${row.anchors.count} anchors, max ${row.anchors.maxPixels.toFixed(3)} px; ${row.coordinateMatchedCount}/${row.localCount} coordinate matches against base-mode categories`);
} else process.stdout.write(json);
// This gate certifies only the independent anchors. Full category reconciliation
// is deliberately reported separately rather than turned into a false green gate.
if (report.maps.some(row => !row.anchors.count || row.anchors.maxPixels > tolerancePixels)) process.exitCode = 1;
