/**
 * Pure, seeded backdrop geometry for the passive-tree "cosmos": deep-space
 * gradient bands, a twinkling star field, and one region-tinted nebula cloud per
 * lobe. Plain data only — no Phaser, no Date.now — so the look is deterministic
 * and unit-testable. passiveTreeFx.ts is the presenter. Built over the tree's
 * WORLD bounds (it scrolls with the tree, not the screen). See
 * docs/superpowers/specs/2026-06-20-passive-tree-beautify-design.md.
 */
import { Rng } from "../core/rng.ts";
import type { Bounds } from "./passiveTreeCamera.ts";

/** Centroid of a region's nodes in pixel space + that region's color. */
export interface RegionCenter {
  region: string;
  x: number;
  y: number;
  color: number;
}

/** A horizontal deep-space gradient band (top→bottom darkening). */
export interface Band {
  y: number;
  h: number;
  color: number;
  alpha: number;
}
/** A scattered star: slow twinkle around baseAlpha. */
export interface Star {
  x: number;
  y: number;
  r: number;
  baseAlpha: number;
  phase: number;
}
/** A region-tinted nebula cloud centered on a lobe. */
export interface Nebula {
  region: string;
  x: number;
  y: number;
  r: number;
  color: number;
  baseAlpha: number;
  phase: number;
}

export interface PassiveTreeAtmosphere {
  bands: Band[];
  stars: Star[];
  nebulae: Nebula[];
  bounds: Bounds;
}

const BAND_COUNT = 7;
const STAR_COUNT = 150;
// Deep-space ramp: indigo void at the top fading to near-black at the bottom.
const BAND_TOP = 0x0d1426;
const BAND_BOT = 0x05060c;

function lerpChannel(a: number, b: number, t: number, shift: number): number {
  const ca = (a >> shift) & 0xff;
  const cb = (b >> shift) & 0xff;
  return Math.round(ca + (cb - ca) * t);
}
function lerpColor(a: number, b: number, t: number): number {
  return (lerpChannel(a, b, t, 16) << 16) | (lerpChannel(a, b, t, 8) << 8) | lerpChannel(a, b, t, 0);
}

export function buildPassiveTreeAtmosphere(
  bounds: Bounds,
  regionCenters: RegionCenter[],
  seed: number,
): PassiveTreeAtmosphere {
  const rng = new Rng(seed * 2654435761 + 17);
  const W = bounds.maxX - bounds.minX;
  const H = bounds.maxY - bounds.minY;

  // Gradient bands: stack from the top edge to the bottom edge, darkening.
  const bands: Band[] = [];
  const bandH = H / BAND_COUNT;
  for (let i = 0; i < BAND_COUNT; i++) {
    const t = i / (BAND_COUNT - 1);
    bands.push({
      y: bounds.minY + i * bandH,
      h: bandH + 1, // +1 to avoid seams between bands
      color: lerpColor(BAND_TOP, BAND_BOT, t),
      alpha: 1,
    });
  }

  // Star field scattered across the whole world rect.
  const stars: Star[] = [];
  for (let i = 0; i < STAR_COUNT; i++) {
    stars.push({
      x: bounds.minX + rng.next() * W,
      y: bounds.minY + rng.next() * H,
      r: 0.5 + rng.next() * 1.7,
      baseAlpha: 0.2 + rng.next() * 0.55,
      phase: rng.next() * Math.PI * 2,
    });
  }

  // One tinted nebula per region, centered on that lobe's node centroid.
  const nebulae: Nebula[] = regionCenters.map((c) => ({
    region: c.region,
    x: c.x + (rng.next() - 0.5) * 40,
    y: c.y + (rng.next() - 0.5) * 40,
    r: 190 + rng.next() * 130,
    color: c.color,
    baseAlpha: 0.18 + rng.next() * 0.08,
    phase: rng.next() * Math.PI * 2,
  }));

  return { bands, stars, nebulae, bounds };
}

/** Live star alpha in [0,1]: baseAlpha modulated by a layered twinkle. Pure. */
export function starTwinkle(s: Star, tSec: number): number {
  const tw = 0.65 + 0.35 * Math.sin(tSec * 2.3 + s.phase);
  return Math.max(0, Math.min(1, s.baseAlpha * tw));
}

/** Gentle nebula breathing multiplier in [0,1]. Pure. */
export function nebulaPulse(n: Nebula, tSec: number): number {
  const p = 0.8 + 0.2 * Math.sin(tSec * 0.5 + n.phase);
  return Math.max(0, Math.min(1, p));
}
