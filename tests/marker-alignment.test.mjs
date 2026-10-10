import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { markerPoint } from '../lib/map-geometry.mjs';
const references = JSON.parse(await readFile(new URL('../data/map-reference-points.json', import.meta.url)));
const markers = JSON.parse(await readFile(new URL('../data/markers.json', import.meta.url)));
for (const map of references.maps) {
  test(`${map.mapId}: aligns independent game-file anchors within 2 native pixels`, () => {
    const sourceMap = markers.maps.find(m => m.name.toLowerCase() === map.mapId);
    assert.ok(map.points.length >= 12);
    const errors = map.points.map(reference => {
      const group = sourceMap.groups.find(g => g.typeKey === reference.typeKey);
      assert.deepEqual(group.points[reference.pointIndex], reference.sourceCoordinate, `${reference.id}: source changed; revalidate anchor`);
      const actual = markerPoint(reference.sourceCoordinate, map.mapId);
      const error = Math.hypot(actual.x * map.rasterPixels - reference.referencePixel[0], actual.y * map.rasterPixels - reference.referencePixel[1]);
      assert.ok(error <= references.tolerancePixels, `${reference.id}: ${error.toFixed(3)} px > ${references.tolerancePixels} px`);
      return error;
    }).sort((a, b) => a - b);
    const median = (errors[(errors.length - 1) >> 1] + errors[errors.length >> 1]) / 2;
    assert.ok(median <= references.tolerancePixels);
    assert.ok(errors.at(-1) <= references.tolerancePixels);
  });
}
test('requires revalidation when the raster tiles used as evidence change', async () => {
  for (const map of references.maps) for (const point of map.points) {
    const tile = await readFile(new URL(`../${point.rasterProbe.localTile}`, import.meta.url));
    assert.equal(createHash('sha256').update(tile).digest('hex'), point.rasterProbe.localSha256, `${point.id}: raster changed`);
  }
});
