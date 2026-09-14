const motorGliderTypes = new Set(['vehiclesGroupG', 'vehiclesGroupO']);
const miramarRandomBoatTypes = new Set(['vehiclesGroupE', 'vehiclesGroupF']);

export function isMotorGliderType(typeKey) {
  return motorGliderTypes.has(typeKey);
}

export function displayCategoryId(mapName, typeKey) {
  if (mapName === 'Miramar' && miramarRandomBoatTypes.has(typeKey)) return 'miramar-random-boats';
  return typeKey;
}
