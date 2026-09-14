import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateFlightPlan, extendFlightLine, flightProfiles } from '../lib/flight-plan.mjs';

test('extends two direction points to opposite map edges', () => {
  const forward = extendFlightLine({ x: .3, y: .4 }, { x: .7, y: .6 });
  assert.ok(forward);
  assert.deepEqual([forward.start.x, forward.end.x], [0, 1]);
  assert.ok(Math.abs(forward.start.y - .25) < 1e-12);
  assert.ok(Math.abs(forward.end.y - .75) < 1e-12);

  const reverse = extendFlightLine({ x: .7, y: .6 }, { x: .3, y: .4 });
  assert.ok(reverse);
  assert.deepEqual([reverse.start.x, reverse.end.x], [1, 0]);
  assert.ok(Math.abs(reverse.start.y - .75) < 1e-12);
  assert.ok(Math.abs(reverse.end.y - .25) < 1e-12);
});

test('places the recommended exit before a target on the plane route', () => {
  const result = calculateFlightPlan({ x: 0, y: .5 }, { x: 1, y: .5 }, { x: .5, y: .5 }, 8, flightProfiles.erangel);
  assert.ok(result);
  assert.equal(Math.round(result.jumpDistanceMeters), 850);
  assert.equal(Math.round(result.distanceFromRouteMeters), 0);
  assert.equal(result.reach, 'fast');
  assert.ok(result.jumpPoint.x < .5);
});

test('measures the shortest jump distance perpendicular to the route', () => {
  const result = calculateFlightPlan({ x: 0, y: .5 }, { x: 1, y: .5 }, { x: .5, y: .65 }, 8, flightProfiles.erangel);
  assert.ok(result);
  assert.equal(Math.round(result.distanceFromRouteMeters), 1200);
  assert.equal(result.reach, 'glide');
});

test('marks targets beyond the practical long-glide estimate as outside', () => {
  const result = calculateFlightPlan({ x: 0, y: .1 }, { x: 1, y: .1 }, { x: .5, y: .5 }, 8, flightProfiles.erangel);
  assert.equal(result?.reach, 'outside');
});

test('uses an earlier recommendation for Vikendi', () => {
  assert.equal(flightProfiles.vikendi.optimalJumpMeters, 1050);
  assert.equal(flightProfiles.erangel.optimalJumpMeters, 850);
});
