// src/scenes/towerSkillFx.ts
//
// Structural "motion flourishes" for tower active skills — the mechanical-shape
// half of the element×shape system. Each shape draws a small, element-tinted
// set-piece (rings / links / strikes / shards / pillars / orb) that reads as the
// skill's MECHANIC, layered UNDER the elemental substance particles in
// SkillVfx.cast. Built on the shared VfxDraw kit; pure presentation, no assets.
import { VfxDraw, type V } from "./vfxDraw.ts";
import type { SkillShape } from "../data/attackStyle.ts";

type Palette = { core: number; hot: number; deep: number };
type ShapeFn = (d: VfxDraw, at: V, p: Palette, radius: number) => void;

// splash — three staged concentric shock-rings punch outward from a hot core.
const nova: ShapeFn = (d, at, p, radius) => {
  d.disc(at, 20, p.hot, 0.85, 2.0, 220);
  [0, 90, 180].forEach((ms, i) =>
    d.after(ms, () => d.ring(at, radius * (0.5 + i * 0.28), i ? p.hot : p.core, 460, 4 - i)),
  );
};

// chain — jagged links leap out in sequence to orbit points, each sparking.
const chain: ShapeFn = (d, at, p, radius) => {
  for (let i = 0; i < 4; i++) {
    const a = (Math.PI * 2 * i) / 4 + 0.4;
    const to = { x: at.x + Math.cos(a) * radius * 0.95, y: at.y + Math.sin(a) * radius * 0.95 };
    d.after(i * 55, () => {
      d.crack(at, a, radius * 0.95, p.hot, 200);
      d.spark(to, p.core, 5, 12);
    });
  }
  d.ring(at, radius * 0.6, p.core, 320, 2);
};

// barrage — four stutter muzzle-strikes in a row, each spitting a tracer.
const barrage: ShapeFn = (d, at, p, radius) => {
  for (let i = 0; i < 4; i++)
    d.after(i * 55, () => {
      const off = { x: at.x + (i - 1.5) * 9, y: at.y };
      d.disc(off, 8, p.hot, 0.9, 1.6, 150);
      d.beam(off, 0, radius, p.core, 3, 180);
    });
};

// beam — a bright focused pop + a cross-gleam: a converged single strike.
const beam: ShapeFn = (d, at, p, radius) => {
  d.disc(at, 16, p.hot, 0.9, 2.4, 240);
  d.ring(at, radius, p.core, 420, 3);
  d.gleam(at, 0, radius * 1.4, p.hot, 4);
};

// cloud — a slow swelling haze ring + drifting motes that linger over the field.
const cloud: ShapeFn = (d, at, p, radius) => {
  d.disc(at, radius * 0.55, p.deep, 0.4, 1.6, 620);
  d.ring(at, radius * 0.9, p.deep, 700, 3);
  d.motes(at, radius, 10, () => (Math.random() < 0.5 ? p.core : p.deep), -1);
};

// slam — a ring of erupting shards + a heavy ground ring + a smoke billow.
// (The camera shake is applied once by SkillVfx.cast's shape-weighted shake.)
const slam: ShapeFn = (d, at, p, radius) => {
  d.shards(at, 8, radius, p.core);
  d.ring(at, radius * 1.05, p.deep, 520, 5);
  d.smoke(at, p.deep, 10);
};

// aura — staggered radiant rings + rising light motes: a supportive bloom.
const aura: ShapeFn = (d, at, p, radius) => {
  d.ring(at, radius, p.core, 560, 3);
  for (let i = 0; i < 3; i++)
    d.after(i * 80, () => d.ring(at, radius * (0.45 + i * 0.25), p.hot, 460, 2));
  d.motes(at, radius, 8, () => p.hot, -1);
};

// bolt — the default: a single charged orb-pop, a ring, and a spark spray.
const bolt: ShapeFn = (d, at, p, radius) => {
  d.disc(at, 14, p.hot, 0.9, 2.0, 220);
  d.ring(at, radius * 0.9, p.core, 420, 3);
  d.spark(at, p.hot, 8, 18);
};

const SHAPES: Record<SkillShape, ShapeFn> = { nova, chain, barrage, beam, cloud, slam, aura, bolt };

/** Render the structural motion flourish for a tower-skill `shape` at `at`. */
export function renderTowerShape(
  d: VfxDraw,
  shape: SkillShape,
  at: V,
  palette: Palette,
  radius: number,
): void {
  SHAPES[shape](d, at, palette, radius);
}
