// Chromium DOM check, including the actual touch input path, at exact zooms.
// Run a local server first; override its URL with MAP_AUDIT_URL when needed.
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
const markers = JSON.parse(await readFile(new URL('../data/markers.json', import.meta.url)));
const references = JSON.parse(await readFile(new URL('../data/map-reference-points.json', import.meta.url)));
const browser = await chromium.launch({ headless: true });
const results = [], errors = [];
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, hasTouch: true });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.env.MAP_AUDIT_URL ?? 'http://localhost:5173/');
  await page.locator('.maps button').last().waitFor();
  await page.locator('.marker-toggle').last().waitFor();
  const cdp = await context.newCDPSession(page);
  for (const map of references.maps) {
    const source = markers.maps.find(source => source.name.toLowerCase() === map.mapId);
    const mapButton = page.locator('.maps button').nth(references.maps.indexOf(map));
    await mapButton.click();
    await page.locator('.marker-section .section-title').getByRole('button', { name: 'Все', exact: true }).click();
    const flattened = source.groups.flatMap(group => group.points.map((coordinate, pointIndex) => ({ typeKey: group.typeKey, pointIndex, coordinate })));
    await page.waitForFunction(count => document.querySelectorAll('.marker-anchor').length === count, flattened.length);
    const referenceIndices = map.points.map(reference => flattened.findIndex(point => point.typeKey === reference.typeKey && point.pointIndex === reference.pointIndex));
    for (const zoom of [1, 2, 4, 8, 12]) {
      await page.getByRole('button', { name: 'Сбросить масштаб и положение карты', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('.hud span')?.textContent === '100%');
      if (zoom > 1) {
        const stage = await page.locator('.stage').boundingBox();
        const x = stage.x + stage.width / 2, y = stage.y + stage.height / 2;
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x - 10, y, id: 1 }, { x: x + 10, y, id: 2 }] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - zoom * 10, y, id: 1 }, { x: x + zoom * 10, y, id: 2 }] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await page.waitForFunction(percent => document.querySelector('.hud span')?.textContent === `${percent}%`, zoom * 100);
      }
      const measured = await page.evaluate(indices => {
        const map = document.querySelector('.map').getBoundingClientRect();
        const anchors = [...document.querySelectorAll('.marker-anchor')];
        const positions = anchors.map(anchor => {
          const bounds = anchor.getBoundingClientRect();
          return [(bounds.x - map.x) / map.width, (bounds.y - map.y) / map.height];
        });
        const tips = indices.map(index => {
          const path = anchors[index].querySelector('svg path');
          const svg = anchors[index].querySelector('svg');
          const point = svg.createSVGPoint(); point.x = 11; point.y = 27.2;
          const screen = point.matrixTransform(path.getScreenCTM());
          const bounds = anchors[index].getBoundingClientRect();
          return Math.hypot(screen.x - bounds.x, screen.y - bounds.y);
        });
        return { positions, mapWidth: map.width, mapHeight: map.height,
          tileCount: document.querySelectorAll('.tiles img').length, maxSvgTipGapCssPixels: Math.max(...tips) };
      }, referenceIndices);
      assert.ok(Math.abs(measured.mapWidth - measured.mapHeight) <= 1, `${map.mapId} ${zoom}: map is not square`);
      const drift = Math.max(...flattened.map((point, index) => Math.hypot(measured.positions[index][0] - point.coordinate[1] / 256, measured.positions[index][1] + point.coordinate[0] / 256) * 8192));
      assert.ok(drift < 1, `${map.mapId} ${zoom}: DOM anchor drift ${drift} native pixels`);
      const referenceError = Math.max(...map.points.map((point, index) => Math.hypot(measured.positions[referenceIndices[index]][0] * 8192 - point.referencePixel[0], measured.positions[referenceIndices[index]][1] * 8192 - point.referencePixel[1])));
      assert.ok(referenceError <= references.tolerancePixels, `${map.mapId} ${zoom}: external anchor mismatch`);
      assert.equal(measured.tileCount, zoom < 2 ? 0 : zoom < 4 ? 64 : 256);
      results.push({ mapId: map.mapId, zoomPercent: zoom * 100, markerCount: flattened.length, maxDriftNativePixels: drift, maxReferenceErrorNativePixels: referenceError,
        tileCount: measured.tileCount, maxSvgTipGapCssPixels: measured.maxSvgTipGapCssPixels });
    }
  }
  const layouts = [];
  for (const [width, height] of [[320, 844], [390, 844], [768, 1024], [1024, 1000], [1440, 1000]]) {
    await page.setViewportSize({ width, height });
    await page.getByRole('button', { name: 'Сбросить масштаб и положение карты', exact: true }).click();
    const rect = await page.locator('.map').boundingBox();
    assert.ok(Math.abs(rect.width - rect.height) <= 1, `${width}x${height}: map is not square`);
    layouts.push({ viewport: [width, height], mapDimensions: [rect.width, rect.height] });
  }
  assert.deepEqual(errors, []);
  await mkdir(new URL('../work/', import.meta.url), { recursive: true });
  await writeFile(new URL('../work/browser-alignment.json', import.meta.url), `${JSON.stringify({ results, layouts, errors }, null, 2)}\n`);
  console.log(`Passed ${results.length} map/zoom checks (${results.reduce((sum, row) => sum + row.markerCount, 0)} DOM anchors), ${layouts.length} layouts; no page errors.`);
  console.log(`SVG tip gap is diagnostic only (Stage 2 remains open): maximum ${Math.max(...results.map(row => row.maxSvgTipGapCssPixels)).toFixed(3)} CSS pixels.`);
} finally { await browser.close(); }
