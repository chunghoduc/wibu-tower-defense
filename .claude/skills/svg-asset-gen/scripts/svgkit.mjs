// svgkit — shared helpers for authoring clean, deterministic SVG game assets.
//
// Everything here is pure and seeded: the same (type, seed) always produces the
// exact same markup, so regenerating art never churns the repo and variants are
// reproducible. Build new asset families on top of these primitives rather than
// hand-writing path strings — the blob/shade/outline helpers are what give the
// assets a consistent "hand-drawn game art" look (soft irregular silhouettes,
// dark unifying outline, a lighter top-left highlight for a top-down light).

/** Small deterministic PRNG (xorshift32). Seed with any integer. */
export class Rng {
  constructor(seed) { this.s = (seed >>> 0) || 0x9e3779b9; }
  /** Next float in [0, 1). */
  next() {
    let x = this.s;
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    this.s = x >>> 0;
    return this.s / 4294967296;
  }
  range(a, b) { return a + (b - a) * this.next(); }
  int(a, b) { return Math.floor(this.range(a, b + 1)); }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  /** Random sign, -1 or +1. */
  sign() { return this.next() < 0.5 ? -1 : 1; }
}

/** Hash a string to a stable 32-bit seed (so callers can seed by name). */
export function seedFrom(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** The shared dark outline colour — using one tone across every asset is what
 *  makes a mixed set read as a coherent "kit" rather than clip-art. */
export const OUTLINE = "#16131f";

const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));

/** Multiply a #rrggbb colour by factor f (>1 lightens, <1 darkens). */
export function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp(((n >> 16) & 255) * f), g = clamp(((n >> 8) & 255) * f), b = clamp((n & 255) * f);
  return "#" + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

const f1 = (v) => v.toFixed(1);

/**
 * Closed smooth path through points via Catmull-Rom → cubic Béziers. This is the
 * workhorse for organic silhouettes: scatter a ring of jittered points, pass
 * them here, and you get a soft blobby outline instead of a polygon.
 */
export function smoothClosed(pts) {
  const n = pts.length;
  if (n < 3) return "";
  let d = `M ${f1(pts[0].x)} ${f1(pts[0].y)} `;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
    d += `C ${f1(c1x)} ${f1(c1y)}, ${f1(c2x)} ${f1(c2y)}, ${f1(p2.x)} ${f1(p2.y)} `;
  }
  return d + "Z";
}

/**
 * An irregular blob path centred at (cx,cy). `r` is the mean radius, `lobes` the
 * number of bumps around the ring, `jitter` (0..1) how rough the edge is.
 * Returns just the `d` attribute string — wrap it in <path> with your own fill.
 */
export function blobPath(cx, cy, r, lobes, jitter, rng) {
  const pts = [];
  for (let i = 0; i < lobes; i++) {
    const a = (i / lobes) * Math.PI * 2;
    const rr = r * (1 - jitter / 2 + rng.next() * jitter);
    pts.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr });
  }
  return smoothClosed(pts);
}

// ---- element helpers (return SVG markup strings) --------------------------

export const path = (d, fill, opts = {}) =>
  `<path d="${d}" fill="${fill}"` +
  (opts.stroke ? ` stroke="${opts.stroke}" stroke-width="${opts.sw ?? 2}"` : "") +
  (opts.opacity != null ? ` opacity="${opts.opacity}"` : "") +
  (opts.join ? ` stroke-linejoin="round"` : "") + "/>";

export const circle = (cx, cy, r, fill, opts = {}) =>
  `<circle cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(r)}" fill="${fill}"` +
  (opts.stroke ? ` stroke="${opts.stroke}" stroke-width="${opts.sw ?? 2}"` : "") +
  (opts.opacity != null ? ` opacity="${opts.opacity}"` : "") + "/>";

export const ellipse = (cx, cy, rx, ry, fill, opts = {}) =>
  `<ellipse cx="${f1(cx)}" cy="${f1(cy)}" rx="${f1(rx)}" ry="${f1(ry)}" fill="${fill}"` +
  (opts.stroke ? ` stroke="${opts.stroke}" stroke-width="${opts.sw ?? 2}"` : "") +
  (opts.opacity != null ? ` opacity="${opts.opacity}"` : "") + "/>";

export const line = (x1, y1, x2, y2, stroke, sw = 2, cap = "round") =>
  `<line x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="${cap}"/>`;

/** A soft contact shadow ellipse to ground an object on the map. */
export const contactShadow = (cx, cy, rx, ry = rx * 0.4) =>
  ellipse(cx, cy, rx, ry, "#000000", { opacity: 0.22 });

/**
 * Wrap a body of markup in a square <svg> with a viewBox. Default 128×128 with
 * the art expected to live around the centre — callers should leave a little
 * padding (we centre blobs near r≈52 in a 128 box) so highlights/overhang and
 * the contact shadow aren't clipped.
 */
export function svgDoc(body, size = 128) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${body}</svg>`;
}
