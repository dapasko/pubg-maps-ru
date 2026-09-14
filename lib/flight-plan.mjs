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
