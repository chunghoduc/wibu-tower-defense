/**
 * Geometry helpers and lane-path traversal. Pure functions over plain vectors —
 * no Phaser, fully testable.
 */
import type { Vec2 } from "../data/schema.ts";

export function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function lerp(a: Vec2, b: Vec2, t: number): Vec2 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/** Total length of a polyline path. */
export function pathLength(path: Vec2[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) total += dist(path[i - 1], path[i]);
  return total;
}

/**
 * World position at a given distance travelled along the polyline.
 * Distances past the end clamp to the final point (the castle).
 */
export function pointAtDistance(path: Vec2[], distance: number): Vec2 {
  if (path.length === 0) return { x: 0, y: 0 };
  if (distance <= 0) return { ...path[0] };

  let remaining = distance;
  for (let i = 1; i < path.length; i++) {
    const seg = dist(path[i - 1], path[i]);
    if (remaining <= seg) {
      return lerp(path[i - 1], path[i], seg === 0 ? 0 : remaining / seg);
    }
    remaining -= seg;
  }
  return { ...path[path.length - 1] };
}
