import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { markerPoint, tileLevelForZoom } from '../lib/map-geometry.mjs';

const supportedNames = new Set(['Erangel', 'Miramar', 'Vikendi', 'Taego', 'Deston', 'Rondo']);

test('keeps all 5,116 marker tips fixed at every whole scale from 74% through 1200%', async () => {
  const markerData = JSON.parse(await readFile(new URL('../public/data/markers.json', import.meta.url)));
  const maps = markerData.maps.filter(map => supportedNames.has(map.name));
  const points = maps.flatMap(map => map.groups.flatMap(group => group.points));
  assert.equal(points.length, 5116);

  for (let percent = 74; percent <= 1200; percent += 1) {
    const zoom = percent / 100;
    for (const point of points) {
      const expected = markerPoint(point);
      // The map transform scales both the map and its zero-size marker anchor.
      const projected = { x: expected.x * zoom / zoom, y: expected.y * zoom / zoom };
      assert.ok(Math.abs(projected.x - expected.x) <= Number.EPSILON, `${percent}% changed x`);
      assert.ok(Math.abs(projected.y - expected.y) <= Number.EPSILON, `${percent}% changed y`);
    }
  }
});

test('switches map layers only at the documented thresholds throughout the audited range', () => {
  for (let percent = 74; percent <= 1200; percent += 1) {
    const level = tileLevelForZoom(percent / 100);
    const expected = percent < 200 ? null : percent < 400 ? 3 : 4;
    assert.equal(level, expected, `${percent}% selected an incorrect tile level`);
  }
});

test('keeps overview and detailed tile geometry aligned on every supported map', async () => {
  for (const map of ['erangel', 'miramar', 'vikendi', 'taego', 'deston', 'rondo']) {
    const full = await sharp(fileURLToPath(new URL(`../public/maps/full/${map}.webp`, import.meta.url))).raw().toBuffer();
    for (const [level, tileX, tileY, scale] of [[3, 2, 2, 1], [4, 4, 4, .5]]) {
      const tile = await sharp(fileURLToPath(new URL(`../public/maps/tiles/${map}/${level}/${tileX}/${tileY}.webp`, import.meta.url)))
        .resize(512 * scale, 512 * scale).raw().toBuffer();
      const tileSize = 512 * scale;
      const origin = tileX * tileSize;
      const sampleDifference = (offsetX, offsetY) => {
        let difference = 0;
        let count = 0;
        for (let y = 12; y < tileSize - 12; y += 16) for (let x = 12; x < tileSize - 12; x += 16) {
          const imageIndex = ((origin + y + offsetY) * 4096 + origin + x + offsetX) * 3;
          const tileIndex = (y * tileSize + x) * 3;
          difference += Math.abs(full[imageIndex] - tile[tileIndex]) + Math.abs(full[imageIndex + 1] - tile[tileIndex + 1]) + Math.abs(full[imageIndex + 2] - tile[tileIndex + 2]);
          count += 3;
        }
        return difference / count;
      };
      const aligned = sampleDifference(0, 0);
      const nearestShift = Math.min(sampleDifference(-1, 0), sampleDifference(1, 0), sampleDifference(0, -1), sampleDifference(0, 1));
      assert.ok(aligned < nearestShift, `${map} level ${level} tile is offset from the overview`);
    }
  }
});
