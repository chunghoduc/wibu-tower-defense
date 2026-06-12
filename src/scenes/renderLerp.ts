/**
 * Render-side position interpolation for the fixed-timestep sim (Phaser-free).
 * The sim advances in whole 0.05s steps; the renderer draws every display frame
 * at prev + (curr - prev) * alpha so motion stays smooth at any frame rate.
 */
export type V2 = { x: number; y: number };

/** Interpolate prev→curr by alpha; a missing prev (fresh spawn) renders at curr. */
export function lerpV(prev: V2 | undefined, curr: V2, alpha: number): V2 {
  if (!prev) return { x: curr.x, y: curr.y };
  return { x: prev.x + (curr.x - prev.x) * alpha, y: prev.y + (curr.y - prev.y) * alpha };
}

/** Snapshot entity positions BY VALUE into `out` (the sim mutates pos in place). */
export function snapshotPositions(
  entities: Iterable<{ uid: number; pos: V2 }>,
  out: Map<number, V2>,
): void {
  out.clear();
  for (const e of entities) out.set(e.uid, { x: e.pos.x, y: e.pos.y });
}
