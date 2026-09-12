import test from 'node:test';
import assert from 'node:assert/strict';
import { distanceMeters, gridStepMeters } from '../lib/map-geometry.mjs';

test('measures horizontal, vertical and diagonal 8 km map distances', () => {
  assert.equal(distanceMeters({ x: 0, y: 0 }, { x: 1, y: 0 }), 8000);
  assert.equal(distanceMeters({ x: .25, y: .25 }, { x: .25, y: .5 }), 2000);
  assert.equal(Math.round(distanceMeters({ x: 0, y: 0 }, { x: .5, y: .5 })), 5657);
});

test('switches from kilometer to hundred-meter grid at the close-zoom threshold', () => {
  assert.equal(gridStepMeters(2.19), 1000);
  assert.equal(gridStepMeters(2.2), 100);
});
