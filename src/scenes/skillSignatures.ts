// src/scenes/skillSignatures.ts
//
// Bespoke per-skill cast set-pieces. Each hero active skill renders ONE unique
// signature here (selected by SkillVfxSpec.signature), built from Phaser shapes +
// tweens — no art assets required. The goal is maximum legibility: every skill
// reads distinctly at a glance, even mid-swarm, by its shape, motion and colour.
//
// All drawing goes through the small `VfxDraw` kit (vfxDraw.ts) so signatures stay short.
import Phaser from "phaser";
import type { SkillVfxSpec, SkillSignature } from "../data/skillVfxMeta.ts";
import { VfxDraw, type V } from "./vfxDraw.ts";

type Fac = Phaser.GameObjects.GameObjectFactory;

// ── signatures ──────────────────────────────────────────────────────────────
// Each takes the draw kit, the cast point, the skill's spec, and the splash
// radius. Keep them short and READABLE — the metadata's `appearance` is the spec.

type SigFn = (d: VfxDraw, at: V, s: SkillVfxSpec, radius: number) => void;

const valiantSweep: SigFn = (d, at, s, radius) => {
  const { core, hot, deep } = s.palette;
  d.crescent(at, core, -200, 200, radius * 0.9, 6, 360, 40);
  d.crescent(at, hot, -190, 180, radius * 0.6, 3, 320, 40);
  d.ring(at, radius, deep, 480, 3);
  d.gleam(at, 25, radius * 1.4, hot, 4);   // central cross-gleam
  d.gleam(at, 115, radius * 1.4, hot, 4);
  d.spark(at, hot, 8, 20);
  d.motes(at, radius, 10, () => (Math.random() < 0.5 ? core : hot), -1);
};

const spiritComet: SigFn = (d, at, s, radius) => {
  const { core, hot, deep } = s.palette;
  // implode → erupt
  d.disc(at, radius * 0.55, core, 0.4, 0.06, 280);
  d.after(260, () => {
    d.disc(at, 16, hot, 0.9, 2.4, 240);
    d.ring(at, radius, core, 460, 3);
    d.spark(at, hot, 10, 22);
    // curling wisp trails
    for (let i = 0; i < 7; i++) {
      const a = (Math.PI * 2 * i) / 7;
      d.crack(at, a, radius * 0.8, deep, 360);
    }
  });
  d.motes(at, radius, 12, () => (Math.random() < 0.5 ? core : hot), -1);
};

const steelCross: SigFn = (d, at, s, radius) => {
  const { core, hot, deep } = s.palette;
  d.crescent(at, core, -130, 110, radius * 0.85, 5, 220, 30);
  d.after(60, () => d.crescent(at, hot, 50, 110, radius * 0.85, 5, 220, -30));
  d.beam(at, 0, radius * 1.2, hot, 4, 240);
  d.beam({ x: at.x - radius * 0.6, y: at.y }, 0, radius * 1.2, deep, 3, 260);
  d.spark(at, hot, 10, 22);
};

const earthshatter: SigFn = (d, at, s, radius) => {
  const { core, hot, deep } = s.palette;
  d.disc(at, 22, hot, 0.7, 2.0, 240);
  d.ring(at, radius * 1.05, deep, 560, 5);
  d.shards(at, 9, radius, core);
  for (let i = 0; i < 5; i++) d.smoke({ x: at.x + Phaser.Math.Between(-radius * 0.5, radius * 0.5), y: at.y }, deep, 12);
  d.spark(at, core, 8, 16);
  d.shake(160, 0.006);
};

const guillotine: SigFn = (d, at, s, radius) => {
  const { core, hot, deep } = s.palette;
  d.flash(90, 120, 0, 0);
  // a vertical drop slash
  const top = { x: at.x, y: at.y - radius };
  d.beam(top, Math.PI / 2, radius * 2, core, 7, 200);
  d.after(80, () => {
    d.disc(at, 18, hot, 0.9, 2.2, 220);
    // lingering blood-red X afterimage
    d.crescent(at, deep, -135, 90, radius * 0.7, 4, 320, 0);
    d.crescent(at, deep, 45, 90, radius * 0.7, 4, 320, 0);
    d.spark(at, core, 9, 24);
  });
  d.shake(120, 0.005);
};

const tripleVolley: SigFn = (d, at, s, radius) => {
  const { core, hot, deep } = s.palette;
  [-32, 0, 32].forEach((deg, i) => d.after(i * 45, () => {
    const a = Phaser.Math.DegToRad(deg);
    d.beam(at, a, radius * 1.1, core, 3, 240);
    const tip = { x: at.x + Math.cos(a) * radius, y: at.y + Math.sin(a) * radius };
    d.spark(tip, hot, 5, 12);
  }));
  d.ring(at, radius * 0.7, deep, 360, 2);
  d.after(180, () => d.motes(at, radius, 8, () => (Math.random() < 0.5 ? core : hot), -1)); // verdant drift settles
};

const piercingLance: SigFn = (d, at, s, radius) => {
  const { core, hot, deep } = s.palette;
  d.ring(at, 30, hot, 220, 4);             // sonic muzzle ring
  d.beam(at, 0, radius * 2.2, core, 6, 260);
  d.beam(at, 0, radius * 2.2, hot, 2, 220);
  d.after(40, () => d.beam(at, Math.PI, radius * 0.4, deep, 3, 200)); // recoil flick
  d.spark(at, hot, 7, 16);
  d.after(200, () => { d.ring(at, radius * 1.1, core, 320, 2); d.smoke(at, deep, 8); }); // pierce-wake
};

const manaDetonation: SigFn = (d, at, s, radius) => {
  const { core, hot, deep } = s.palette;
  [0, 90, 180].forEach((ms, i) => d.after(ms, () => d.ring(at, radius * (0.6 + i * 0.2), core, 460, 3)));
  d.glyphs(at, radius * 0.7, 6, hot);
  d.disc(at, radius * 0.5, core, 0.3, 0.05, 300);
  d.after(280, () => { d.disc(at, 16, hot, 0.9, 2.2, 220); d.spark(at, deep, 9, 20); });
};

const arcaneSupernova: SigFn = (d, at, s, radius) => {
  const { core, hot, deep } = s.palette;
  d.flash(100, 150, 90, 200);
  d.ring(at, radius * 1.3, core, 560, 5);
  d.after(90, () => d.ring(at, radius, hot, 460, 3));
  d.sigil(at, radius * 0.95, core, 1);
  d.sigil(at, radius * 0.62, hot, -1);
  d.glyphs(at, radius * 0.8, 8, hot);
  d.disc(at, radius * 0.7, core, 0.3, 0.05, 320);
  d.after(300, () => { d.disc(at, 20, deep, 0.9, 2.6, 260); d.spark(at, hot, 12, 28); });
  d.motes(at, radius, 14, () => (Math.random() < 0.5 ? core : hot), -1);
  d.shake(180, 0.007);
};

const muzzleBarrage: SigFn = (d, at, s, radius) => {
  const { core, hot, deep } = s.palette;
  for (let i = 0; i < 5; i++) d.after(i * 55, () => {
    const off = { x: at.x + (i - 2) * 8, y: at.y };
    d.disc(off, 9, hot, 0.9, 1.6, 160);                  // muzzle flash
    d.beam(off, Phaser.Math.FloatBetween(-0.15, 0.15), radius, core, 3, 200); // tracer
    d.smoke({ x: off.x, y: off.y }, deep, 6);
  });
  d.after(320, () => { d.spark(at, hot, 8, 20); d.smoke(at, deep, 12); }); // gunsmoke settles
};

const concussionBlast: SigFn = (d, at, s, radius) => {
  const { core, hot, deep } = s.palette;
  d.disc(at, 24, hot, 0.85, 2.0, 220);
  d.ring(at, radius * 1.1, core, 520, 6);
  for (let i = 0; i < 4; i++) d.smoke({ x: at.x + Phaser.Math.Between(-radius * 0.4, radius * 0.4), y: at.y }, deep, 12);
  d.glyphs({ x: at.x, y: at.y - 14 }, radius * 0.45, 6, hot); // ring of spinning stun-stars overhead
  d.spark(at, core, 8, 18);
  d.shake(150, 0.0055);
};

const hexSigil: SigFn = (d, at, s, radius) => {
  const { core, hot, deep } = s.palette;
  d.sigil(at, radius * 0.9, core, -1);
  d.glyphs(at, radius * 0.7, 5, hot);
  // creeping shadow tendrils
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI * 2 * i) / 8 + Math.random() * 0.2;
    d.crack(at, a, radius * 0.9, deep, 420);
  }
  d.disc(at, radius * 0.6, deep, 0.4, 0.1, 360);
  d.motes(at, radius, 8, () => core, 1);
};

const pureTechnique: SigFn = (d, at, s, radius) => {
  const { core, hot, deep } = s.palette;
  d.flash(120, 255, 255, 255);
  d.disc(at, 20, hot, 1, 2.4, 260);
  d.ring(at, radius, core, 460, 3);
  // golden filament lines converging to a point
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI * 2 * i) / 10;
    const from = { x: at.x + Math.cos(a) * radius, y: at.y + Math.sin(a) * radius };
    d.beam(from, a + Math.PI, radius, deep, 1.5, 220);
  }
  d.spark(at, deep, 10, 22);
};

const voidRift: SigFn = (d, at, s, radius) => {
  const { core, hot, deep } = s.palette;
  // a dark rift opens with a glowing rim, cracks space, then snaps shut
  d.disc(at, radius * 0.6, deep, 0.85, 1.0, 320);   // black core swell
  d.ring(at, radius * 0.65, hot, 360, 5);            // violet rim
  for (let i = 0; i < 10; i++) {                      // cracks in space
    const a = (Math.PI * 2 * i) / 10;
    d.crack(at, a, radius, hot, 420);
  }
  d.after(300, () => {                                // collapse → snap shut
    d.disc(at, radius * 0.5, core, 0.5, 0.04, 220);
    d.after(180, () => { d.flash(90, 255, 255, 255); d.disc(at, 22, hot, 1, 2.6, 220); d.spark(at, hot, 12, 28); });
  });
  d.shake(200, 0.007);
};

const SIGNATURES: Record<SkillSignature, SigFn> = {
  "valiant-sweep": valiantSweep,
  "spirit-comet": spiritComet,
  "steel-cross": steelCross,
  "earthshatter": earthshatter,
  "guillotine": guillotine,
  "triple-volley": tripleVolley,
  "piercing-lance": piercingLance,
  "mana-detonation": manaDetonation,
  "arcane-supernova": arcaneSupernova,
  "muzzle-barrage": muzzleBarrage,
  "concussion-blast": concussionBlast,
  "hex-sigil": hexSigil,
  "pure-technique": pureTechnique,
  "void-rift": voidRift,
};

/** Whether a given signature key has a renderer (always true for valid specs). */
export function hasSignature(sig: SkillSignature): boolean {
  return sig in SIGNATURES;
}

/** Render a skill's bespoke signature set-piece at `at`. */
export function renderSignature(
  scene: Phaser.Scene, fac: Fac, depth: number, at: V, spec: SkillVfxSpec, radius: number,
): void {
  const d = new VfxDraw(scene, fac, depth);
  SIGNATURES[spec.signature](d, at, spec, radius);
}
