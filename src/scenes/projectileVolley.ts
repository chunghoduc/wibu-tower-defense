// src/scenes/projectileVolley.ts
//
// Pure geometry for the "fired-from-the-caster" beat: turn a skill's literal
// SkillMotif (what flies, how many, in what spread) into per-projectile travel
// frames — each a launch point, a landing point, a heading and a stagger delay.
// The renderer (projectileVolleyFx.ts) draws a glyph along each frame.
//
// Phaser-free and deterministic (no RNG) so it is fully unit-testable.
import type { SkillMotif } from "../data/skillVfxMeta.ts";

export type Vec2 = { x: number; y: number };

/** One projectile's travel: from→to along `angle` (radians), launched at `delay` ms. */
export interface VolleyShot {
  from: Vec2;
  to: Vec2;
  angle: number;
  delay: number;
}

const STREAM_STAGGER_MS = 70; // gap between rapid stream shots
const FAN_TOTAL_RAD = 0.5; // total angular spread across a fan
const PIERCE_OVERSHOOT = 1.6; // how far a pierce shot travels past the target

function heading(from: Vec2, to: Vec2): number {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

function rotateAround(origin: Vec2, len: number, ang: number): Vec2 {
  return { x: origin.x + Math.cos(ang) * len, y: origin.y + Math.sin(ang) * len };
}

/**
 * Plan the projectile frames for a cast. Returns one VolleyShot per projectile,
 * or `[]` when nothing is fired (`kind: "none"` or `count <= 0`).
 */
export function planVolley(from: Vec2, at: Vec2, motif: SkillMotif): VolleyShot[] {
  if (motif.kind === "none" || motif.count <= 0) return [];
  const base = heading(from, at);
  const reach = Math.hypot(at.x - from.x, at.y - from.y);
  const n = motif.count;

  if (motif.spread === "pierce") {
    return [{ from, to: rotateAround(from, reach * PIERCE_OVERSHOOT, base), angle: base, delay: 0 }];
  }

  if (motif.spread === "fan") {
    // Symmetric angular fan centred on the target heading; middle shot hits `at`.
    const step = n > 1 ? FAN_TOTAL_RAD / (n - 1) : 0;
    const start = -FAN_TOTAL_RAD / 2;
    return Array.from({ length: n }, (_, i) => {
      const ang = base + start + step * i;
      return { from, to: rotateAround(from, reach, ang), angle: ang, delay: 0 };
    });
  }

  if (motif.spread === "stream") {
    // Same line, ramped stagger so they read as a rapid burst.
    return Array.from({ length: n }, (_, i) => ({
      from,
      to: { x: at.x, y: at.y },
      angle: base,
      delay: i * STREAM_STAGGER_MS,
    }));
  }

  // single
  return [{ from, to: { x: at.x, y: at.y }, angle: base, delay: 0 }];
}
