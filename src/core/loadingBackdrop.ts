/**
 * Pure geometry for the loading-screen backdrop (PreloadScene). No Phaser, no
 * textures — at preload start nothing is loaded yet, so the backdrop is drawn
 * from primitives computed here. Deterministic (index-seeded, no RNG) so the
 * scene is reproducible and testable.
 */

export interface Vec2 {
  x: number;
  y: number;
}

export interface HillBand {
  points: Vec2[];
  color: number;
  depth: number; // 0 = farthest, 1 = nearest
}

export interface TowerSil {
  x: number;
  baseY: number;
  width: number;
  height: number;
  body: number;
  glow: number;
  depth: number;
}

export interface Ember {
  x: number;
  y: number;
  r: number;
  speed: number;
  drift: number;
  phase: number;
}

/** Deterministic hash -> [0,1). Reproducible scene without Math.random. */
function frac(n: number): number {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}

const BACK_HILL = 0x242a44;
const FRONT_HILL = 0x10131f;

function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

/** Parallax hill bands, back (lightest/highest) -> front (darkest/lowest). */
export function loadingHills(width: number, height: number): HillBand[] {
  const BANDS = 3;
  const bands: HillBand[] = [];
  for (let b = 0; b < BANDS; b++) {
    const depth = b / (BANDS - 1); // 0..1
    const baseY = height * (0.62 + depth * 0.16); // nearer bands sit lower
    const amp = 18 + depth * 26;
    const pts: Vec2[] = [];
    const SEG = 8;
    for (let i = 0; i <= SEG; i++) {
      const x = (width * i) / SEG;
      const y = baseY - Math.sin(i * 1.1 + b * 2.3) * amp - frac(b * 31 + i) * 10;
      pts.push({ x, y });
    }
    // close the polygon down the right edge, across the bottom, up the left edge
    pts.push({ x: width, y: height });
    pts.push({ x: 0, y: height });
    bands.push({ points: pts, color: lerpColor(BACK_HILL, FRONT_HILL, depth), depth });
  }
  return bands;
}

/** Stylized tower silhouettes standing on the front ridge. */
export function loadingTowers(width: number, height: number): TowerSil[] {
  const COUNT = 6;
  const ridgeY = height * 0.78;
  const margin = width * 0.06;
  const span = width - margin * 2;
  const gap = span / COUNT;
  const palette = [0x1a1f33, 0x171b2c, 0x202744];
  const glows = [0x66ffcc, 0xf0c060, 0x7fd0ff, 0xff7fa8];
  const towers: TowerSil[] = [];
  for (let i = 0; i < COUNT; i++) {
    const seed = frac(i * 17.3);
    const x = margin + gap * (i + 0.5);
    const w = 34 + seed * 26;
    const h = 88 + frac(i * 7.1) * 96;
    towers.push({
      x,
      baseY: ridgeY + (frac(i * 3.7) - 0.5) * 12,
      width: w,
      height: h,
      body: palette[i % palette.length],
      glow: glows[i % glows.length],
      depth: 1,
    });
  }
  return towers;
}

/** Rising ember/mote specs. Spawn x is inset by the max sway so it never crosses an edge. */
export function loadingEmbers(width: number, height: number, count: number): Ember[] {
  const embers: Ember[] = [];
  for (let i = 0; i < count; i++) {
    embers.push({
      x: 16 + frac(i * 1.7) * (width - 32),
      y: frac(i * 5.3) * height,
      r: 0.8 + frac(i * 9.1) * 1.8,
      speed: 8 + frac(i * 2.9) * 22,
      drift: 6 + frac(i * 4.4) * 14,
      phase: frac(i * 6.6) * Math.PI * 2,
    });
  }
  return embers;
}

/** Pure per-frame ember position; wraps back to the bottom once it rises off-top. */
export function emberAt(e: Ember, t: number, height: number): Vec2 {
  const up = (e.y + e.speed * t) % height; // 0..height, rises with t and wraps
  const y = height - up; // larger t -> smaller y; always within (0, height]
  const x = e.x + Math.sin(t * 0.8 + e.phase) * e.drift;
  return { x, y };
}
