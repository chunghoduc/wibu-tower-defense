// src/scenes/skillSignaturesB.ts
//
// Additional bespoke cast set-pieces for the new spectacular spells (meteor
// storm, glacial nova, infernal wave, prismatic beam, storm call) and the three
// summon "conjuring circle" effects. Split out of skillSignatures.ts to keep
// each file focused and under the 500-line limit. Merged into the SIGNATURES
// registry there. All drawing goes through the VfxDraw kit — no art assets.
import type { SkillVfxSpec, SkillSignature } from "../data/skillVfxMeta.ts";
import type { VfxDraw, V } from "./vfxDraw.ts";
import { scaleCount, type VfxPower } from "../data/skillVfxPower.ts";

type SigFn = (d: VfxDraw, at: V, s: SkillVfxSpec, radius: number, w: VfxPower) => void;

// Rain of meteors — a scattered cluster of sky-falling fireballs around the point.
const meteorStorm: SigFn = (d, at, s, radius, w) => {
  const { core, hot, deep } = s.palette;
  const n = scaleCount(5, w);
  for (let i = 0; i < n; i++) {
    const ox = (Math.random() - 0.5) * radius * 2.4;
    const oy = (Math.random() - 0.5) * radius * 1.2;
    const hit = { x: at.x + ox, y: at.y + oy };
    d.after(i * 70, () => {
      d.fallStreak(hit, 240, core, hot, 6, 200, () => {
        d.disc(hit, 16, hot, 0.9, 2.2, 240);
        d.ring(hit, radius * 0.7, deep, 520, 4);
        d.spark(hit, hot, scaleCount(7, w), 20);
        d.motes(hit, radius * 0.7, scaleCount(6, w), () => (Math.random() < 0.5 ? core : hot), -1);
        d.shake(120, 0.004 * w.shake);
      });
    });
  }
};

// Expanding double frost ring + radiating crystal shards + cold flash.
const frostNova: SigFn = (d, at, s, radius, w) => {
  const { core, hot, deep } = s.palette;
  d.flash(120, 180, 220, 255);
  d.disc(at, 20, hot, 0.6, 2.2, 260);
  d.ring(at, radius * 0.6, core, 420, 4);
  d.after(110, () => d.ring(at, radius * 1.05, deep, 560, 5));
  d.shards(at, scaleCount(12, w), radius, core);
  d.motes(at, radius, scaleCount(14, w), () => (Math.random() < 0.5 ? hot : core), -1);
};

// A rolling flame wall sweeping out from the caster + rising plumes + scorch line.
const infernalWave: SigFn = (d, at, s, radius, w) => {
  const { core, hot, deep } = s.palette;
  d.disc(at, 22, hot, 0.85, 2.0, 240);
  // the wall: stacked horizontal gleams sweeping outward both directions
  d.gleam(at, 0, radius * 2.2, core, 8);
  d.gleam(at, 0, radius * 1.8, hot, 4);
  d.ring(at, radius * 1.05, deep, 640, 5); // lingering scorch
  const plumes = scaleCount(7, w);
  for (let i = 0; i < plumes; i++) {
    const px = at.x + (i / (plumes - 1) - 0.5) * radius * 2;
    d.after(i * 30, () => d.beam({ x: px, y: at.y }, -90, radius * 0.9, hot, 5, 320));
  }
  d.motes(at, radius * 1.2, scaleCount(12, w), () => (Math.random() < 0.5 ? core : hot), -1);
};

// A thick prismatic lance — layered colour bands fired straight, sonic rings, sparks.
const prismBeam: SigFn = (d, at, s, radius, w) => {
  const { core, hot, deep } = s.palette;
  const len = radius * 2.4;
  d.gleam(at, 0, len, deep, 10);
  d.gleam(at, 0, len, core, 6);
  d.gleam(at, 0, len, hot, 2);
  d.disc(at, 18, hot, 0.95, 2.4, 240);
  for (let i = 0; i < 3; i++)
    d.after(i * 80, () => d.ring(at, radius * (0.5 + i * 0.3), core, 420, 3));
  d.spark(at, hot, scaleCount(10, w), 24);
  // spark filaments along the beam
  const fil = scaleCount(6, w);
  for (let i = 0; i < fil; i++) {
    const fx = at.x + (i / fil) * len;
    d.after(i * 18, () => d.spark({ x: fx, y: at.y }, core, 3, 10));
  }
};

// A lightning volley crashing down across the zone with radial ground arcs.
const stormCall: SigFn = (d, at, s, radius, w) => {
  const { core, hot, deep } = s.palette;
  d.flash(140, 170, 205, 255);
  const n = scaleCount(5, w);
  for (let i = 0; i < n; i++) {
    const ox = (Math.random() - 0.5) * radius * 2.2;
    const oy = (Math.random() - 0.5) * radius * 1.0;
    const hit = { x: at.x + ox, y: at.y + oy };
    d.after(i * 55, () => {
      d.fallStreak(hit, 260, core, hot, 4, 170, () => {
        d.disc(hit, 12, hot, 0.95, 2.4, 200);
        d.spark(hit, hot, scaleCount(7, w), 18);
      });
    });
  }
  const arcs = scaleCount(7, w);
  for (let i = 0; i < arcs; i++) d.crack(at, (Math.PI * 2 * i) / arcs, radius, deep, 320);
};

// ── summon conjuring circles ─────────────────────────────────────────────────
function conjure(
  d: VfxDraw,
  at: V,
  s: SkillVfxSpec,
  radius: number,
  w: VfxPower,
  orbs: number,
): void {
  const { core, hot, deep } = s.palette;
  d.sigil(at, radius * 0.8, core, 1);
  d.ring(at, radius * 0.85, deep, 560, 4);
  d.glyphs(at, radius * 0.6, scaleCount(6, w), hot);
  d.disc(at, 16, hot, 0.7, 1.8, 320);
  // orb-pops where each minion materialises
  for (let i = 0; i < orbs; i++) {
    const a = (i / orbs) * Math.PI * 2;
    const p = { x: at.x + Math.cos(a) * radius * 0.55, y: at.y + Math.sin(a) * radius * 0.55 };
    d.after(120 + i * 60, () => {
      d.disc(p, 10, core, 0.9, 1.8, 260);
      d.spark(p, hot, scaleCount(6, w), 14);
    });
  }
  d.motes(at, radius, scaleCount(10, w), () => (Math.random() < 0.5 ? core : hot), -1);
}

const conjureFire: SigFn = (d, at, s, radius, w) => conjure(d, at, s, radius, w, 3);
const conjureIce: SigFn = (d, at, s, radius, w) => conjure(d, at, s, radius, w, 1);
const conjureStorm: SigFn = (d, at, s, radius, w) => conjure(d, at, s, radius, w, 2);

/** The signature keys defined in this module (a concrete subset of SkillSignature). */
type NewSig = Extract<
  SkillSignature,
  | "meteor-storm"
  | "frost-nova"
  | "infernal-wave"
  | "prism-beam"
  | "storm-call"
  | "conjure-fire"
  | "conjure-ice"
  | "conjure-storm"
>;

/** New signatures, merged into the registry in skillSignatures.ts. */
export const SIGNATURES_B: Record<NewSig, SigFn> = {
  "meteor-storm": meteorStorm,
  "frost-nova": frostNova,
  "infernal-wave": infernalWave,
  "prism-beam": prismBeam,
  "storm-call": stormCall,
  "conjure-fire": conjureFire,
  "conjure-ice": conjureIce,
  "conjure-storm": conjureStorm,
};
