import { closestPointOnSegment, dist2, angleDeg } from './utils.js'

export function snapItemToWalls({ x, y }, walls, threshold = 40) {
  if (!walls?.length) return null;
  const P = { x, y };
  let best = null;

  for (const w of walls) {
    const cp = closestPointOnSegment(w.a, w.b, P);
    const d2 = dist2(P, cp);
    if (!best || d2 < best.d2) {
      best = {
        wallId: w.id,
        point: { x: cp.x, y: cp.y },
        d2,
        rotation: angleDeg(w.a, w.b)
      };
    }
  }

  if (!best) return null;
  if (best.d2 > threshold * threshold) return null;

  return {
    snap: { to: 'wall', targetId: best.wallId, at: best.point },
    point: best.point,
    rotation: best.rotation
  };
}
