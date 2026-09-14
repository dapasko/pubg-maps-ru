const motorGliderTypes = new Set(['vehiclesGroupG', 'vehiclesGroupO']);
const miramarRandomBoatTypes = new Set(['vehiclesGroupE', 'vehiclesGroupF']);

const mapVehicleLabels = {
  'Erangel:vehiclesGroupB': 'Багги и мотоциклы',
  'Miramar:vehiclesGroupB': 'Квадроциклы, мотоциклы, багги и пикапы',
  'Vikendi:vehiclesGroupB': 'Снегоходы',
  'Vikendi:vehiclesGroupD': 'Случайный транспорт (высокий шанс): Zima / Dacia',
  'Taego:vehiclesGroupB': 'Багги и мотоциклы',
  'Deston:vehiclesGroupB': 'Пикапы, багги, мотоциклы и квадроциклы',
  'Deston:vehiclesGroupJ': 'Транспорт у особняков: Coupe RB / мотоцикл / квадроцикл',
  'Deston:vehiclesGroupK': 'Случайный транспорт: пикап / Dacia / мотоцикл',
  'Deston:vehiclesGroupN': 'Транспорт: мотоцикл / машина охраны / Dacia / Coupe RB',
  'Rondo:vehiclesGroupB': 'Багги и мотоциклы',
  'Rondo:vehiclesGroupD': 'Случайный транспорт (высокий шанс): Blanc / Dacia',
};

export function isMotorGliderType(typeKey) {
  return motorGliderTypes.has(typeKey);
}

export function displayCategoryId(mapName, typeKey) {
  if (mapName === 'Miramar' && miramarRandomBoatTypes.has(typeKey)) return 'miramar-random-boats';
  return typeKey;
}

export function specificVehicleLabel(mapName, typeKey) {
  return mapVehicleLabels[`${mapName}:${typeKey}`] ?? null;
}
