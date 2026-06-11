/**
 * Pure trajectory math for the "loot flies to the hero" effect. A flown reward
 * travels from the kill spot to the hero along a quadratic bézier whose control
 * point is the horizontal midpoint raised UP by `lift` (screen y grows down),
 * so the loot hops up and homes in rather than sliding in a straight line.
 */
import type { Vec2 } from "../data/schema.ts";

/** Control point: x-midpoint of from→to, raised above the higher of the two ends. */
export function arcControl(from: Vec2, to: Vec2, lift: number): Vec2 {
  return { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - lift };
}

/** Quadratic bézier B(t) for t in [0,1]. t=0 → from, t=1 → to. */
export function bezierPoint(from: Vec2, ctrl: Vec2, to: Vec2, t: number): Vec2 {
  const u = 1 - t;
  const a = u * u, b = 2 * u * t, c = t * t;
  return {
    x: a * from.x + b * ctrl.x + c * to.x,
    y: a * from.y + b * ctrl.y + c * to.y,
  };
}
