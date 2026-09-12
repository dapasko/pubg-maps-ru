import test from 'node:test';
import assert from 'node:assert/strict';
import { distanceMeters, gridStepMeters, markerEastingCorrection, markerNorthingCorrection, markerPoint } from '../lib/map-geometry.mjs';
import { readFile } from 'node:fs/promises';

test('measures horizontal, vertical and diagonal 8 km map distances', () => {
  assert.equal(distanceMeters({ x: 0, y: 0 }, { x: 1, y: 0 }), 8000);
  assert.equal(distanceMeters({ x: .25, y: .25 }, { x: .25, y: .5 }), 2000);
  assert.equal(Math.round(distanceMeters({ x: 0, y: 0 }, { x: .5, y: .5 })), 5657);
});

test('switches from kilometer to hundred-meter grid at the close-zoom threshold', () => {
  assert.equal(gridStepMeters(2.19), 1000);
  assert.equal(gridStepMeters(2.2), 100);
});

test('keeps every supported map marker inside the source playable grid', async () => {
  const markerData = JSON.parse(await readFile(new URL('../public/data/markers.json', import.meta.url)));
  const names = new Set(['Erangel', 'Miramar', 'Vikendi', 'Taego', 'Deston', 'Rondo']);
  const maps = markerData.maps.filter(map => names.has(map.name));
  const points = maps.flatMap(map => map.groups.flatMap(group => group.points));

  assert.equal(markerNorthingCorrection, .288);
  assert.equal(markerEastingCorrection, -.288);
  assert.equal(points.length, 5116);
  for (const map of maps) for (const group of map.groups) for (const point of group.points) {
    const normalized = markerPoint(point, map.name.toLowerCase());
    assert.ok(normalized.x >= 0 && normalized.x <= 1);
    assert.ok(normalized.y >= 0 && normalized.y <= 1);
  }
});
