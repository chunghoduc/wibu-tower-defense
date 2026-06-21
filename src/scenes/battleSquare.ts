/**
 * battleSquare — pure, Phaser-free geometry for the home-screen BATTLE call-to-
 * action, redesigned (2026-06-21) from a wide ember capsule into a big SQUARE
 * corner button: a gold-rimmed crimson tile carrying the SDXL war crest (twin
 * crossed swords over a powerful shield) with a "BATTLE" ribbon along the bottom.
 * Bigger than the surrounding menu icons and anchored in a screen corner so it
 * reads as the one primary action. The presenter (drawBattleSquare in
 * homeBarFx.ts) only paints these rects. Unit-tested in tests/battleSquare.test.ts.
 */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface BattleSquarePlan {
  /** Rounded-corner radius of the tile. */
  radius: number;
  /** Thickness of the gold rim framing the crimson face. */
  rim: number;
  /** The crimson face inset from the rect by `rim`. */
  inner: Rect;
  /** Centred war-crest emblem: centre point + square side. */
  emblem: { x: number; y: number; size: number };
  /** Dark gold-trimmed ribbon along the bottom holding the BATTLE label. */
  ribbon: Rect;
  /** Soft outer halo rect (drawn additively, alpha pulses) for the breathing glow. */
  glow: Rect;
}

const RIM = 3;
const GLOW_SPREAD = 10;

/** Compute the static chrome of the square BATTLE CTA from its outer rect. */
export function battleSquarePlan(r: Rect): BattleSquarePlan {
  const radius = Math.round(r.h * 0.18);
  const rim = RIM;
  const inner: Rect = {
    x: r.x + rim,
    y: r.y + rim,
    w: r.w - rim * 2,
    h: r.h - rim * 2,
  };

  // Ribbon hugs the bottom of the inner face; the emblem fills the space above it.
  const ribbonH = Math.round(inner.h * 0.26);
  const ribbonW = Math.round(inner.w * 0.9);
  const ribbon: Rect = {
    x: Math.round(r.x + r.w / 2 - ribbonW / 2),
    y: Math.round(inner.y + inner.h - ribbonH - inner.h * 0.05),
    w: ribbonW,
    h: ribbonH,
  };

  // Emblem dominates the tile: centred horizontally, lifted slightly above the
  // geometric centre so its lower edge clears the BATTLE ribbon banner, sized to
  // nearly the full inner side.
  const size = Math.round(Math.min(inner.w, inner.h) * 0.92);
  const emblem = {
    x: Math.round(r.x + r.w / 2),
    y: Math.round(inner.y + inner.h * 0.45),
    size,
  };

  const glow: Rect = {
    x: r.x - GLOW_SPREAD,
    y: r.y - GLOW_SPREAD,
    w: r.w + GLOW_SPREAD * 2,
    h: r.h + GLOW_SPREAD * 2,
  };

  return { radius, rim, inner, emblem, ribbon, glow };
}
