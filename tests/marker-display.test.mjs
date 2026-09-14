import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { displayCategoryId, isMotorGliderType } from '../lib/marker-display.mjs';

const markerData = JSON.parse(await readFile(new URL('../data/markers.json', import.meta.url), 'utf8'));

test('combines both Miramar random-boat groups into one display category', () => {
  assert.equal(displayCategoryId('Miramar', 'vehiclesGroupE'), 'miramar-random-boats');
  assert.equal(displayCategoryId('Miramar', 'vehiclesGroupF'), 'miramar-random-boats');
  assert.equal(displayCategoryId('Taego', 'vehiclesGroupE'), 'vehiclesGroupE');
});

test('recognizes Taego and Rondo motor-glider groups regardless of guarantee tag', () => {
  assert.equal(isMotorGliderType('vehiclesGroupO'), true);
  assert.equal(isMotorGliderType('vehiclesGroupG'), true);
  assert.equal(isMotorGliderType('vehiclesGroupL'), false);
});

test('applies the display rules to the current marker dataset', () => {
  const miramar = markerData.maps.find(map => map.name === 'Miramar');
  const combinedBoats = miramar.groups.filter(group => displayCategoryId(miramar.name, group.typeKey) === 'miramar-random-boats');
  assert.deepEqual(combinedBoats.map(group => group.typeKey), ['vehiclesGroupE', 'vehiclesGroupF']);
  assert.equal(combinedBoats.reduce((total, group) => total + group.points.length, 0), 52);

  for (const [mapName, typeKey] of [['Taego', 'vehiclesGroupO'], ['Rondo', 'vehiclesGroupG']]) {
    const map = markerData.maps.find(item => item.name === mapName);
    const gliders = map.groups.find(group => group.typeKey === typeKey);
    assert.equal(gliders.tag, '!100%');
    assert.equal(gliders.points.length, 10);
    assert.equal(isMotorGliderType(gliders.typeKey), true);
  }
});
