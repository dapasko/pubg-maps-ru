// Small tolerance and one-to-one matching keep duplicates and nearby spawns
// from inflating the verified count. Unmatched points are evidence to review,
// not an instruction to add, remove or move a gameplay object.
export function matchPointSets(localPixels, referencePixels, tolerancePixels = 2) {
  if (!Number.isFinite(tolerancePixels) || tolerancePixels < 0) throw new RangeError('Invalid pixel tolerance');
  for (const points of [localPixels, referencePixels]) for (const point of points) {
    if (!Array.isArray(point) || point.length !== 2 || !point.every(Number.isFinite)) throw new TypeError('Expected finite [x, y] pixels');
  }
  const candidates = [];
  localPixels.forEach(([x, y], localIndex) => {
    referencePixels.forEach(([rx, ry], referenceIndex) => {
      const errorPixels = Math.hypot(x - rx, y - ry);
      if (errorPixels <= tolerancePixels) candidates.push({ localIndex, referenceIndex, errorPixels });
    });
  });
  candidates.sort((a, b) => a.errorPixels - b.errorPixels || a.localIndex - b.localIndex || a.referenceIndex - b.referenceIndex);
  const usedLocal = new Set(), usedReference = new Set(), matched = [];
  for (const pair of candidates) {
    if (usedLocal.has(pair.localIndex) || usedReference.has(pair.referenceIndex)) continue;
    usedLocal.add(pair.localIndex); usedReference.add(pair.referenceIndex); matched.push(pair);
  }
  return {
    matched,
    localOnly: localPixels.flatMap((_, index) => usedLocal.has(index) ? [] : [index]),
    referenceOnly: referencePixels.flatMap((_, index) => usedReference.has(index) ? [] : [index]),
  };
}

export function summarizeErrors(errors) {
  if (!errors.length) return { medianPixels: null, maxPixels: null };
  const sorted = [...errors].sort((a, b) => a - b);
  return {
    medianPixels: (sorted[(sorted.length - 1) >> 1] + sorted[sorted.length >> 1]) / 2,
    maxPixels: sorted.at(-1),
  };
}
