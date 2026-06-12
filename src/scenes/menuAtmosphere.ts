/**
 * Pure, seeded layout + animation maths for the main-menu "living throne hall"
 * atmosphere layer (god-rays, dust motes, brazier embers, vignette, key light,
 * torch flicker). Plain data only — no Phaser, no Date.now — so the look is
 * deterministic and unit-testable. menuBackdropFx.ts is the presenter. See
 * docs/superpowers/specs/2026-06-12-cinematic-menu-backdrop-design.md.
 */
import { Rng } from "../core/rng.ts";

export interface Dims { width: number; height: number; }
export interface Vignette { cx: number; cy: number; innerR: number; outerR: number; edgeAlpha: number; }
export interface KeyLight { x: number; y: number; r: number; color: number; }
/** A volumetric god-ray shaft falling from the top edge. */
export interface Ray { x: number; topW: number; botW: number; len: number; tilt: number; color: number; baseAlpha: number; phase: number; }
/** Slow floating dust speck: gentle drift + bob, wraps in x. */
export interface Mote { x: number; y: number; r: number; drift: number; rise: number; phase: number; alpha: number; }
/** Warm ember rising from a brazier: steady rise (wraps) + sine sway. */
export interface Ember { x: number; y: number; r: number; speed: number; drift: number; phase: number; alpha: number; }
/** A flickering torch/brazier light point. */
export interface Torch { x: number; y: number; r: number; color: number; phase: number; }

export interface MenuAtmosphereSpec {
  vignette: Vignette;
  keyLight: KeyLight;
  rays: Ray[];
  motes: Mote[];
  embers: Ember[];
  torches: Torch[];
  dims: Dims;
}

const RAY_COUNT = 5;
const MOTE_COUNT = 46;
const EMBER_COUNT = 34;
const RAY_COLOR = 0xffe6b0;

export function buildMenuAtmosphere(W: number, H: number, seed: number): MenuAtmosphereSpec {
  const rng = new Rng(seed * 2654435761 + 11);
  const dims: Dims = { width: W, height: H };
  const outerR = Math.hypot(W, H) / 2;

  const vignette: Vignette = {
    cx: W / 2, cy: H * 0.44,
    innerR: Math.round(outerR * 0.30), outerR: Math.round(outerR * 1.02), edgeAlpha: 0.72,
  };
  const keyLight: KeyLight = { x: W / 2, y: H * 0.40, r: Math.round(H * 0.42), color: 0xffd27a };

  // God-rays: a few wide soft shafts slanting down from the top windows.
  const rays: Ray[] = [];
  for (let i = 0; i < RAY_COUNT; i++) {
    const x = W * (0.12 + 0.76 * (i / (RAY_COUNT - 1))) + (rng.next() - 0.5) * 40;
    rays.push({
      x,
      topW: 26 + rng.next() * 34,
      botW: 80 + rng.next() * 90,
      len: H * (0.7 + rng.next() * 0.35),
      tilt: (rng.next() - 0.5) * 90, // px horizontal drift over the shaft length
      color: RAY_COLOR,
      baseAlpha: 0.05 + rng.next() * 0.06,
      phase: rng.next() * Math.PI * 2,
    });
  }

  // Dust motes: scattered everywhere, slow.
  const motes: Mote[] = [];
  for (let i = 0; i < MOTE_COUNT; i++) {
    motes.push({
      x: rng.next() * W, y: rng.next() * H,
      r: 0.6 + rng.next() * 1.6,
      drift: 8 + rng.next() * 20,
      rise: 4 + rng.next() * 10,
      phase: rng.next() * Math.PI * 2,
      alpha: 0.12 + rng.next() * 0.28,
    });
  }

  // Embers rise from the two side braziers (the lit walls of the hall).
  const embers: Ember[] = [];
  for (let i = 0; i < EMBER_COUNT; i++) {
    const left = i % 2 === 0;
    const bx = left ? W * (0.14 + rng.next() * 0.06) : W * (0.80 + rng.next() * 0.06);
    embers.push({
      x: bx, y: H * (0.55 + rng.next() * 0.45),
      r: 1 + rng.next() * 2.2,
      speed: 10 + rng.next() * 26,
      drift: 5 + rng.next() * 12,
      phase: rng.next() * Math.PI * 2,
      alpha: 0.3 + rng.next() * 0.5,
    });
  }

  const torches: Torch[] = [
    { x: W * 0.16, y: H * 0.52, r: 30, color: 0xff9a3c, phase: rng.next() * Math.PI * 2 },
    { x: W * 0.84, y: H * 0.52, r: 30, color: 0xff9a3c, phase: rng.next() * Math.PI * 2 },
  ];

  return { vignette, keyLight, rays, motes, embers, torches, dims };
}

/** Mote position at time `tSec`: slow upward rise (wraps) + horizontal sway. Pure. */
export function motePos(m: Mote, tSec: number, dims: Dims): { x: number; y: number } {
  let y = (m.y - m.rise * tSec) % dims.height;
  if (y < 0) y += dims.height;
  let x = m.x + Math.sin(tSec * 0.5 + m.phase) * m.drift;
  x = ((x % dims.width) + dims.width) % dims.width;
  return { x, y };
}

/** Ember position at time `tSec`: steady rise (wraps within the hall) + sway. Pure. */
export function emberPos(e: Ember, tSec: number, dims: Dims): { x: number; y: number } {
  let y = (e.y - e.speed * tSec) % dims.height;
  if (y < 0) y += dims.height;
  const x = e.x + Math.sin(tSec * 0.9 + e.phase) * e.drift;
  return { x, y };
}

/** God-ray live alpha: base intensity gently breathing in [0,1]. Pure. */
export function rayAlpha(r: Ray, tSec: number): number {
  const a = r.baseAlpha * (0.7 + 0.3 * Math.sin(tSec * 0.6 + r.phase));
  return Math.max(0, Math.min(1, a));
}

/** Torch flicker multiplier in [0,1]: layered sines so it reads as fire. Pure. */
export function flicker(tSec: number, phase: number): number {
  const v = 0.72 + 0.18 * Math.sin(tSec * 11 + phase) + 0.10 * Math.sin(tSec * 23 + phase * 1.7);
  return Math.max(0, Math.min(1, v));
}
