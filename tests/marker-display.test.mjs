import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { displayCategoryId, isMotorGliderType, markerLabel, specificVehicleLabel } from '../lib/marker-display.mjs';

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

test('describes map-specific vehicle groups without losing their source tags', () => {
  assert.equal(specificVehicleLabel('Vikendi', 'vehiclesGroupB'), 'Снегоходы');
  assert.equal(specificVehicleLabel('Deston', 'vehiclesGroupK'), 'Случайный транспорт: пикап / Dacia / мотоцикл');
  assert.equal(specificVehicleLabel('Deston', 'vehiclesGroupN'), 'Транспорт: мотоцикл / машина охраны / Dacia / Coupe RB');
  assert.equal(specificVehicleLabel('Rondo', 'vehiclesGroupD'), 'Случайный транспорт (высокий шанс): Blanc / Dacia');
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

test('labels every supported-map group with a real string, not a bare key', () => {
  const supported = new Set(['Erangel', 'Miramar', 'Vikendi', 'Taego', 'Deston', 'Rondo']);
  const ruByKey = new Map(markerData.types.map(type => [type.key, type.ru ?? '']));
  for (const map of markerData.maps) {
    if (!supported.has(map.name)) continue;
    for (const group of map.groups) {
      const fallback = ruByKey.get(group.typeKey) ?? group.typeKey;
      const label = markerLabel(map.name, group, fallback);
      assert.notEqual(label, group.typeKey, `${map.name}:${group.typeKey} fell back to its bare key`);
      assert.ok(label.length > 0, `${map.name}:${group.typeKey} produced an empty label`);
    }
  }
});

test('keeps explicit labels distinct from bare keys for every declared type', () => {
  const ruByKey = new Map(markerData.types.map(type => [type.key, type.ru ?? '']));
  for (const type of markerData.types) {
    const emptyGroup = { typeKey: type.key, tag: null, points: [] };
    const label = markerLabel(undefined, emptyGroup, ruByKey.get(type.key) ?? type.key);
    assert.notEqual(label, type.key, `${type.key} resolved to its bare key`);
  }
});
