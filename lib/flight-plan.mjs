const defaultProfile = { optimalJumpMeters: 850, glideMeters: 1200, longGlideMeters: 2000 };

export const flightProfiles = {
  erangel: defaultProfile,
  miramar: { ...defaultProfile, terrainWarning: 'Высокогорье может сократить реальную дальность.' },
  vikendi: { ...defaultProfile, optimalJumpMeters: 1050 },
  taego: defaultProfile,
  deston: defaultProfile,
  rondo: defaultProfile,
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function extendFlightLine(start, directionPoint) {
  const dx = directionPoint.x - start.x;
  const dy = directionPoint.y - start.y;
  if (Math.hypot(dx, dy) < 0.0001) return null;

  const candidates = [];
  const add = (t, x, y) => {
    if (x >= -0.000001 && x <= 1.000001 && y >= -0.000001 && y <= 1.000001) {
      if (!candidates.some(item => Math.hypot(item.x - x, item.y - y) < 0.000001)) candidates.push({ t, x: clamp(x, 0, 1), y: clamp(y, 0, 1) });
    }
  };
  if (Math.abs(dx) > 0.000001) {
    let t = -start.x / dx;
    add(t, 0, start.y + t * dy);
    t = (1 - start.x) / dx;
    add(t, 1, start.y + t * dy);
  }
  if (Math.abs(dy) > 0.000001) {
    let t = -start.y / dy;
    add(t, start.x + t * dx, 0);
    t = (1 - start.y) / dy;
    add(t, start.x + t * dx, 1);
  }
  candidates.sort((a, b) => a.t - b.t);
  if (candidates.length < 2) return null;
  return {
    start: { x: candidates[0].x, y: candidates[0].y },
    end: { x: candidates.at(-1).x, y: candidates.at(-1).y },
  };
}

export function calculateFlightPlan(start, end, target, mapSizeKm = 8, profile = defaultProfile) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const routeLength = Math.hypot(dx, dy);
  if (routeLength < 0.0001) return null;

  const ux = dx / routeLength;
  const uy = dy / routeLength;
  const targetAlongRoute = (target.x - start.x) * ux + (target.y - start.y) * uy;
  const closestAlongRoute = clamp(targetAlongRoute, 0, routeLength);
  const closest = { x: start.x + ux * closestAlongRoute, y: start.y + uy * closestAlongRoute };
  const metersPerMap = mapSizeKm * 1000;
  const distanceFromRouteMeters = Math.hypot(target.x - closest.x, target.y - closest.y) * metersPerMap;

  const optimalRadius = profile.optimalJumpMeters / metersPerMap;
  const lateralToInfiniteRoute = Math.abs((target.x - start.x) * uy - (target.y - start.y) * ux);
  const lead = lateralToInfiniteRoute < optimalRadius ? Math.sqrt(optimalRadius ** 2 - lateralToInfiniteRoute ** 2) : 0;
  const jumpAlongRoute = clamp(targetAlongRoute - lead, 0, routeLength);
  const jumpPoint = { x: start.x + ux * jumpAlongRoute, y: start.y + uy * jumpAlongRoute };
  const jumpDistanceMeters = Math.hypot(target.x - jumpPoint.x, target.y - jumpPoint.y) * metersPerMap;

  const boundaryTolerance = 0.5;
  const reach = distanceFromRouteMeters <= profile.optimalJumpMeters + boundaryTolerance ? 'fast'
    : distanceFromRouteMeters <= profile.glideMeters + boundaryTolerance ? 'glide'
      : distanceFromRouteMeters <= profile.longGlideMeters + boundaryTolerance ? 'long'
        : 'outside';

  return { closest, distanceFromRouteMeters, jumpPoint, jumpDistanceMeters, reach };
}
