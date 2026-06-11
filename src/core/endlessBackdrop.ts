/**
 * Pure, seeded geometry for the endless-mode "siege atmosphere" backdrop layer
 * (the painted SDXL base is a separate texture). Produces plain data — no Phaser
 * types — so the layout is deterministic and unit-testable; EndlessBackdropFx is
 * the presenter that draws and animates it. See
 * docs/superpowers/specs/2026-06-12-endless-siege-backdrop-design.md.
 */
import type { ArenaDef, Vec2 } from "../data/schema.ts";
import { Rng } from "./rng.ts";

export interface Dims { width: number; height: number; }

/** Radial focus pull: dark at the rim (edgeAlpha), clear toward the castle. */
export interface Vignette { cx: number; cy: number; innerR: number; outerR: number; edgeAlpha: number; }
/** A glowing ley-line battle-scar: jittered polyline castle→gate, color `glow`. */
export interface Scar { points: Vec2[]; width: number; glow: number; }
export interface CastleRing { cx: number; cy: number; baseR: number; color: number; }
export interface Ember { x: number; y: number; r: number; speed: number; drift: number; alpha: number; phase: number; }

export interface EndlessBackdropSpec {
  vignette: Vignette;
  scars: Scar[];
  castleRing: CastleRing;
  embers: Ember[];
  dims: Dims;
}

const EMBER_COUNT = 60;
const SCAR_SEGS = 5;

export function buildEndlessBackdrop(arena: ArenaDef, dims: Dims, seed: number): EndlessBackdropSpec {
  const rng = new Rng(seed * 2246822519 + 7);
  const cx = arena.center.x, cy = arena.center.y;
  const outerR = Math.hypot(dims.width, dims.height) / 2;

  const vignette: Vignette = { cx, cy, innerR: Math.round(outerR * 0.34), outerR: Math.round(outerR), edgeAlpha: 0.7 };

  // One battle-scar per gate: a perpendicular-jittered polyline from the castle
  // out to the (on-screen-clamped) gate mouth, so the war-roads visibly converge.
  const scars: Scar[] = arena.gates.map((g) => {
    const gx = Math.max(8, Math.min(dims.width - 8, g.x));
    const gy = Math.max(8, Math.min(dims.height - 8, g.y));
    const dx = gx - cx, dy = gy - cy;
    const len = Math.hypot(dx, dy) || 1;
    const points: Vec2[] = [];
    for (let i = 0; i <= SCAR_SEGS; i++) {
      const t = i / SCAR_SEGS;
      const jitter = i === 0 || i === SCAR_SEGS ? 0 : (rng.next() - 0.5) * 26;
      points.push({
        x: Math.round(cx + dx * t + (-dy / len) * jitter),
        y: Math.round(cy + dy * t + (dx / len) * jitter),
      });
    }
    return { points, width: 6, glow: 0xff5a2a };
  });

  const castleRing: CastleRing = { cx, cy, baseR: 54, color: 0xffb060 };

  const embers: Ember[] = [];
  for (let i = 0; i < EMBER_COUNT; i++) {
    embers.push({
      x: rng.next() * dims.width,
      y: rng.next() * dims.height,
      r: 1 + rng.next() * 2.5,
      speed: 8 + rng.next() * 22,
      drift: 6 + rng.next() * 14,
      alpha: 0.25 + rng.next() * 0.5,
      phase: rng.next() * Math.PI * 2,
    });
  }

  return { vignette, scars, castleRing, embers, dims };
}

/** Position of an ember at time `tSec`: steady rise (wraps) + sine sway. Pure. */
export function emberPos(e: Ember, tSec: number, dims: Dims): { x: number; y: number } {
  let y = (e.y - e.speed * tSec) % dims.height;
  if (y < 0) y += dims.height;
  const x = e.x + Math.sin(tSec * 0.8 + e.phase) * e.drift;
  return { x, y };
}
