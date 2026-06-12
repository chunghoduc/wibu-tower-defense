// src/scenes/skillDelivery.ts
//
// Source-delivery choreographies: the "fly from the source" beats that play BEFORE
// a skill's impact signature. Each kind animates the cast travelling from its origin
// (caster, sky, or ground) to the impact point, then calls onArrive() to fire the
// per-skill impact set-piece. Pure presentation, built on the shared VfxDraw kit.
import { VfxDraw, type V } from "./vfxDraw.ts";
import type { DeliveryKind } from "../data/skillVfxMeta.ts";

type Palette = { core: number; hot: number; deep: number };
type DeliveryFn = (
  d: VfxDraw,
  from: V,
  at: V,
  p: Palette,
  radius: number,
  onArrive: () => void,
) => void;

function dist(a: V, b: V): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

// Travel from caster: charge, then an orb streaks to the target.
const bolt: DeliveryFn = (d, from, at, p, _radius, onArrive) => {
  d.chargeGlow(from, p.core, 10, 180);
  d.after(120, () =>
    d.orbTravel(from, at, p.core, p.hot, 6, Math.min(220, 80 + dist(from, at) * 0.5), onArrive),
  );
};

// Instant lance/beam from caster straight to target.
const beam: DeliveryFn = (d, from, at, p, _radius, onArrive) => {
  d.chargeGlow(from, p.hot, 8, 130);
  const ang = Math.atan2(at.y - from.y, at.x - from.x);
  d.beam(from, ang, dist(from, at), p.core, 6, 200);
  d.beam(from, ang, dist(from, at), p.hot, 2, 170);
  d.after(110, onArrive);
};

// Falls from the sky onto the target; a ground reticle telegraphs the landing.
const skyfall: DeliveryFn = (d, _from, at, p, radius, onArrive) => {
  d.marker(at, radius * 0.7, p.hot, 150);
  d.fallStreak(at, 230, p.core, p.hot, 9, 200, onArrive);
};

// Erupts upward out of the ground at the target.
const ground: DeliveryFn = (d, _from, at, p, radius, onArrive) => {
  d.marker(at, radius * 0.6, p.deep, 130);
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI * 2 * i) / 6;
    d.crack(at, a, radius * 0.7, p.deep, 220);
  }
  d.riser(at, p.core, p.hot, 40, 240, onArrive);
};

// Melee draw: wind-up at the caster, a quick streak to the target.
const cast: DeliveryFn = (d, from, at, p, _radius, onArrive) => {
  d.chargeGlow(from, p.core, 9, 150);
  const ang = Math.atan2(at.y - from.y, at.x - from.x);
  d.gleam(from, (ang * 180) / Math.PI, dist(from, at), p.hot, 5);
  d.after(110, onArrive);
};

const DELIVERIES: Record<DeliveryKind, DeliveryFn> = { bolt, beam, skyfall, ground, cast };

/** Play the delivery for `kind`, firing `onArrive` when the cast reaches the target. */
export function renderDelivery(
  d: VfxDraw,
  kind: DeliveryKind,
  from: V,
  at: V,
  palette: Palette,
  radius: number,
  onArrive: () => void,
): void {
  DELIVERIES[kind](d, from, at, palette, radius, onArrive);
}
