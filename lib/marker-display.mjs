/*
 * Display rules shared by the marker list and the on-map tooltips.
 * Keeping every label here — not scattered through page.tsx — lets the data
 * update without drifting from the UI.
 */

const motorGliderTypes = new Set(['vehiclesGroupG', 'vehiclesGroupO']);
const miramarRandomBoatTypes = new Set(['vehiclesGroupE', 'vehiclesGroupF']);
const gasKeys = new Set(['gasCylinderLong', 'gasCylinderShort']);

// Fixed labels for known group keys. The data file also carries its own `ru`
// strings; this table overrides the auto-generated ones where the source
// wording is generic ("Транспорт 1", "Случайные лодки 2") or wrong.
const baseLabels = {
  _secretRooms: 'Тайные комнаты',
  _jujutsuKaisenVendingMachines: 'Торговые автоматы Jujutsu Kaisen',
  blueChipTower: 'Вышки синего чипа',
  blueChipTwoer: 'Вышки синего чипа',
  bearCaves: 'Медвежьи пещеры',
  crowbarRooms: 'Комнаты с ломом',
  goldVault: 'Золотое хранилище',
  brokenPotSpawner: 'Разрушаемые горшки',
  cVendingMachine: 'Торговые автоматы',
  dupTslSupplyBoxSpot: 'Ящики снабжения',
  gasPump: 'Заправки',
  vehiclesGroupA: 'Случайный транспорт',
  vehiclesGroupB: 'Особый транспорт',
  vehiclesGroupC: 'Гаражи с транспортом',
  'vehiclesGroupC-Deston': 'Машины охраны',
  vehiclesGroupD: 'Случайный транспорт (высокий шанс)',
  vehiclesGroupE: 'Случайная точка спавна лодок',
  'vehiclesGroupE-Rondo': 'Электробусы',
  vehiclesGroupF: 'Случайные лодки',
  vehiclesGroupG: 'Случайный транспорт',
  'vehiclesGroupG-SanhokDeston': 'Аэроглиссеры',
  vehiclesGroupH: 'Случайные лодки',
  vehiclesGroupI: 'Фудтраки',
  vehiclesGroupJ: 'Транспорт у особняков',
  vehiclesGroupK: 'Случайный транспорт',
  vehiclesGroupL: 'Лодки',
  'vehiclesGroupL-Paramo': 'Лодки',
  vehiclesGroupM: 'Транспорт',
  'vehiclesGroupM-Taego': 'Лодки',
  vehiclesGroupN: 'Транспорт',
  vehiclesGroupO: 'Моторные планеры',
  vehiclesGroupP: 'Транспорт',
  vehiclesGroupQ: 'Транспорт',
  vehiclesGroupR: 'Лодки',
};

// Map-specific wording that is clearer than the generic base label.
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

export function isGasCylinderType(typeKey) {
  return gasKeys.has(typeKey);
}

export function displayCategoryId(mapName, typeKey) {
  if (mapName === 'Miramar' && miramarRandomBoatTypes.has(typeKey)) return 'miramar-random-boats';
  return typeKey;
}

export function specificVehicleLabel(mapName, typeKey) {
  return mapVehicleLabels[`${mapName}:${typeKey}`] ?? null;
}

// Guaranteed-spawn phrasing derived from the group's tag (e.g. "!100% Uaz").
function guaranteedLabel(group, base) {
  const tag = group.tag ?? '';
  if (tag.includes('GoldMirado')) return 'Гарантированный золотой Мирадо в гараже';
  if (tag.includes('Zima') && tag.includes('Dacia')) return 'Гарантированные Zima или Dacia';
  if (tag.includes('Uaz')) return 'Гарантированный УАЗ';
  if (tag.includes('Dacia') && tag.includes('Blanc')) return 'Гарантированные Бланк или Дача';
  if (tag.includes('Dacia')) return 'Гарантированная Дача';
  if (tag.includes('Mirado')) return 'Гарантированный Мирадо';
  if (tag.includes('Pickup')) return 'Гарантированный пикап';
  if (tag.includes('PonyCoupe')) return 'Гарантированный Pony Coupe';
  if (tag.includes('Bike') || tag.includes('ATV')) return 'Гарантированные мотоциклы и квадроциклы';
  if (tag === '!100%' && ['vehiclesGroupL', 'vehiclesGroupM-Taego', 'vehiclesGroupR'].includes(group.typeKey)) return 'Гарантированные лодки';
  if (tag === '!100%' && group.typeKey === 'vehiclesGroupC') return 'Гарантированный транспорт в гараже';
  return base;
}

export function markerLabel(mapName, group, fallback) {
  if (gasKeys.has(group.typeKey)) return 'Газовые баллоны';
  if (isMotorGliderType(group.typeKey)) return 'Моторные планеры';
  if (group.typeKey === 'cVendingMachine' && group.tag) return `${fallback} (${group.tag})`;

  const specific = mapName ? specificVehicleLabel(mapName, group.typeKey) : null;
  if (specific) return specific;

  const base = baseLabels[group.typeKey] ?? fallback;
  const guaranteed = (group.tag ?? '').startsWith('!100%');
  return guaranteed ? guaranteedLabel(group, base) : base;
}