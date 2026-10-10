import test from 'node:test';
import assert from 'node:assert/strict';
import { matchPointSets, summarizeErrors } from '../lib/marker-audit.mjs';

test('matches coordinates one-to-one even when local categories contain duplicate positions', () => {
  const result = matchPointSets([[10, 10], [10, 10]], [[10.1, 10]], 2);
  assert.equal(result.matched.length, 1);
  assert.equal(result.localOnly.length, 1);
  assert.equal(result.referenceOnly.length, 0);
  assert.ok(Math.abs(result.matched[0].errorPixels - .1) < 1e-10);
});

test('keeps displaced objects unresolved instead of treating nearby positions as verified', () => {
  const result = matchPointSets([[0, 0], [100, 100]], [[.2, .1], [107, 100]], 2);
  assert.deepEqual(result.matched.map(pair => [pair.localIndex, pair.referenceIndex]), [[0, 0]]);
  assert.deepEqual(result.localOnly, [1]);
  assert.deepEqual(result.referenceOnly, [1]);
});

test('compares the nearest pair first, independent of input ordering', () => {
  const result = matchPointSets([[1, 0], [0, 0]], [[0, 0], [2, 0]], 1.1);
  assert.deepEqual(result.matched.map(pair => [pair.localIndex, pair.referenceIndex]), [[1, 0], [0, 1]]);
});

test('returns all unmatched coordinates when the counterpart category is absent', () => {
  assert.deepEqual(matchPointSets([[1, 2]], [], 2), { matched: [], localOnly: [0], referenceOnly: [] });
});

test('rejects nonfinite evidence and invalid tolerances rather than hiding them', () => {
  for (const bad of [NaN, Infinity, undefined]) assert.throws(() => matchPointSets([[bad, 1]], [[0, 0]], 2), TypeError);
  for (const bad of [-1, NaN, Infinity]) assert.throws(() => matchPointSets([], [], bad), RangeError);
});

test('reports median and maximum errors without treating an empty sample as verified', () => {
  assert.deepEqual(summarizeErrors([4, 1, 3, 2]), { medianPixels: 2.5, maxPixels: 4 });
  assert.deepEqual(summarizeErrors([]), { medianPixels: null, maxPixels: null });
});

test('CLI creates a missing report directory and accounts for every local point without merging modes', async () => {
  const { mkdtemp, readFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { execFileSync } = await import('node:child_process');
  const directory = await mkdtemp(join(tmpdir(), 'pubg-marker-audit-'));
  try {
    const output = join(directory, 'nested', 'report.json');
    execFileSync(process.execPath, [new URL('../tools/audit-marker-alignment.mjs', import.meta.url).pathname, '--output', output]);
    const report = JSON.parse(await readFile(output));
    assert.equal(report.maps.length, 6);
    assert.equal(report.maps.reduce((sum, map) => sum + map.localCount, 0), 6550);
    for (const map of report.maps) {
      const unverified = map.groups.filter(group => group.status === 'unverified-category').reduce((sum, group) => sum + group.localCount, 0);
      const unmatched = map.groups.reduce((sum, group) => sum + (group.localUnmatched?.length ?? 0), 0);
      assert.equal(map.coordinateMatchedCount + unmatched + unverified, map.localCount);
      for (const group of map.groups.filter(group => group.status === 'compared-coordinates')) {
        assert.equal(group.localMode, null);
        assert.equal(group.matchedCount + group.localUnmatched.length, group.localCount);
        assert.equal(group.matchedCount + group.referenceUnmatched.length, group.baseReferenceCount);
      }
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});
