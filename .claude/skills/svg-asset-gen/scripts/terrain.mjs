// terrain — top-down map element SVGs (water, trees/jungle, rocks, mountains,
// grass, sand). Each generator composes the svgkit primitives into a layered
// blob: contact shadow → base silhouette with the shared dark outline → a
// lighter top-left highlight (a single consistent light direction across the
// whole kit) → type-specific detail. Authored in a 128×128 box with the body
// centred near (64,64) at radius ~52, leaving padding for overhang + shadow.
//
// Add a new terrain type by writing a `gen` function and registering it in
// TERRAIN. Keep the silhouette inside r≈56 of centre so nothing clips and so the
// game can scale the image to a feature's radius predictably.

import {
  Rng, seedFrom, OUTLINE, shade, blobPath, path, circle, ellipse, line, contactShadow, svgDoc,
} from "./svgkit.mjs";

const CX = 64, CY = 64, R = 50; // canonical centre + mean silhouette radius

// Palettes mirror the in-game TERRAIN_COLOR tones so the art stays on-brand.
const PAL = {
  water:    { base: "#2a5f93", deep: "#1b3f63", lite: "#5fa6dc", foam: "#bfe3f5" },
  grass:    { base: "#3c5e34", deep: "#2b4526", lite: "#5c8a44", blade: "#76a64e" },
  sand:     { base: "#c9b06a", deep: "#a98f4e", lite: "#e3d199", ripple: "#b59a55" },
  stone:    { base: "#7a7c86", deep: "#55565e", lite: "#a3a6b0", crack: "#3d3e44" },
  jungle:   { base: "#2f6e38", deep: "#1d4a26", lite: "#4f9a4a", trunk: "#5a3d28", leaf: "#69b85a" },
  mountain: { base: "#6b5f55", deep: "#473f39", lite: "#8d8276", snow: "#eef2f7", rock: "#9a8f82" },
  // biome-specific obstacle types so a stage's terrain matches its backdrop.
  lava:     { base: "#3a2a26", deep: "#241915", glow: "#ff7a1e", hot: "#ffd24a" },
  ice:      { base: "#9fcdec", deep: "#5e9bca", lite: "#d6ecfa", crack: "#eaf6ff", foam: "#ffffff" },
  snow:     { base: "#e7eef7", deep: "#b7c9dd", lite: "#ffffff", spark: "#ffffff" },
  crystal:  { base: "#3a2154", deep: "#6a32b0", lite: "#c79bff", glow: "#e9c6ff" },
};

function water(rng) {
  const p = PAL.water;
  let s = contactShadow(CX, CY + R * 0.55, R * 0.95, R * 0.3);
  // pond body — soft, no hard outline (water has no rim), dark deep edge instead
  s += path(blobPath(CX, CY, R, 10, 0.28, rng), p.deep);
  s += path(blobPath(CX, CY, R * 0.9, 10, 0.26, new Rng(rng.int(1, 1e6))), p.base);
  // lighter inner pool toward the light
  s += path(blobPath(CX - R * 0.12, CY - R * 0.14, R * 0.55, 9, 0.3, new Rng(rng.int(1, 1e6))), p.lite, { opacity: 0.55 });
  // ripples: a few concentric thin arcs
  const n = rng.int(2, 3);
  for (let i = 0; i < n; i++) {
    const rr = R * (0.3 + 0.18 * i), oy = CY + R * 0.05;
    s += `<path d="M ${(CX - rr).toFixed(1)} ${oy.toFixed(1)} q ${rr.toFixed(1)} ${(R * 0.18).toFixed(1)} ${(rr * 2).toFixed(1)} 0" fill="none" stroke="${p.foam}" stroke-width="2" opacity="${(0.5 - i * 0.12).toFixed(2)}"/>`;
  }
  // a couple of glints
  for (let i = 0; i < 2; i++) s += ellipse(CX - R * 0.2 + i * R * 0.3, CY - R * 0.3 + i * R * 0.15, 4 - i, 2, p.foam, { opacity: 0.8 });
  return s;
}

function grass(rng) {
  const p = PAL.grass;
  // low, soft patch — semi-transparent so it reads as decor, not an obstacle
  let s = path(blobPath(CX, CY, R, 11, 0.34, rng), p.base, { opacity: 0.85, stroke: shade(p.deep, 1), sw: 2, join: true });
  s += path(blobPath(CX - R * 0.15, CY - R * 0.15, R * 0.6, 10, 0.34, new Rng(rng.int(1, 1e6))), p.lite, { opacity: 0.4 });
  // grass-blade tufts: little V/Y strokes in two greens
  const n = rng.int(10, 14);
  for (let i = 0; i < n; i++) {
    const a = rng.range(0, Math.PI * 2), rad = rng.range(0, R * 0.78);
    const x = CX + Math.cos(a) * rad, y = CY + Math.sin(a) * rad * 0.8 + 4;
    const h = rng.range(7, 12), col = rng.next() < 0.5 ? p.blade : p.lite;
    s += line(x, y, x - 2.5, y - h, col, 2);
    s += line(x, y, x + 2.5, y - h * 0.9, col, 2);
    s += line(x, y, x, y - h * 1.05, col, 2);
  }
  return s;
}

function sand(rng) {
  const p = PAL.sand;
  let s = path(blobPath(CX, CY, R, 10, 0.3, rng), p.base, { opacity: 0.9, stroke: shade(p.deep, 1), sw: 2, join: true });
  s += path(blobPath(CX - R * 0.12, CY - R * 0.16, R * 0.62, 9, 0.3, new Rng(rng.int(1, 1e6))), p.lite, { opacity: 0.45 });
  // dune ripples — gentle horizontal arcs
  const n = rng.int(3, 5);
  for (let i = 0; i < n; i++) {
    const y = CY - R * 0.4 + (i + 0.5) * (R * 0.9 / n), w = R * rng.range(0.5, 0.85);
    const col = i % 2 ? p.ripple : p.lite;
    s += `<path d="M ${(CX - w / 2).toFixed(1)} ${y.toFixed(1)} q ${(w / 2).toFixed(1)} ${(R * 0.14).toFixed(1)} ${w.toFixed(1)} 0" fill="none" stroke="${col}" stroke-width="2" opacity="0.55"/>`;
  }
  // a few specks
  for (let i = 0; i < 4; i++) s += circle(CX + rng.range(-R * 0.6, R * 0.6), CY + rng.range(-R * 0.5, R * 0.5), 1.2, p.deep, { opacity: 0.5 });
  return s;
}

function stone(rng) {
  const p = PAL.stone;
  let s = contactShadow(CX, CY + R * 0.5, R * 0.95);
  // a cluster of 2–3 overlapping boulders
  const rocks = rng.int(2, 3);
  const placed = [];
  for (let i = 0; i < rocks; i++) {
    const br = R * rng.range(0.42, 0.62);
    const ox = i === 0 ? 0 : rng.range(-R * 0.45, R * 0.45);
    const oy = i === 0 ? 0 : rng.range(-R * 0.3, R * 0.35);
    placed.push({ x: CX + ox, y: CY + oy, r: br });
  }
  // draw back-to-front (higher y last)
  placed.sort((a, b) => a.y - b.y);
  for (const b of placed) {
    const r2 = new Rng(rng.int(1, 1e6));
    s += path(blobPath(b.x, b.y, b.r, 7, 0.22, r2), p.base, { stroke: OUTLINE, sw: 3, join: true });
    // top facet highlight
    s += path(blobPath(b.x - b.r * 0.2, b.y - b.r * 0.28, b.r * 0.5, 6, 0.25, new Rng(rng.int(1, 1e6))), p.lite, { opacity: 0.6 });
    // a short interior crack (kept well inside the silhouette so it doesn't read
    // as a stick poking out of the rock)
    s += line(b.x - b.r * 0.08, b.y - b.r * 0.12, b.x + b.r * 0.12, b.y + b.r * 0.22, p.crack, 1.4);
  }
  return s;
}

function jungle(rng) {
  const p = PAL.jungle;
  let s = contactShadow(CX, CY + R * 0.55, R * 0.95);
  // a clump of foliage: several canopy lumps in varied greens (top-down trees)
  const lumps = rng.int(4, 6);
  const placed = [];
  for (let i = 0; i < lumps; i++) {
    const a = (i / lumps) * Math.PI * 2 + rng.range(-0.4, 0.4);
    const rad = i === 0 ? 0 : R * rng.range(0.3, 0.5);
    placed.push({ x: CX + Math.cos(a) * rad, y: CY + Math.sin(a) * rad * 0.85, r: R * rng.range(0.34, 0.5) });
  }
  placed.sort((a, b) => a.y - b.y);
  for (const c of placed) {
    const tone = rng.pick([p.deep, p.base, p.base, p.lite]);
    s += path(blobPath(c.x, c.y, c.r, 8, 0.26, new Rng(rng.int(1, 1e6))), tone, { stroke: OUTLINE, sw: 2.5, join: true });
    // highlight crown + a couple leaf dots
    s += path(blobPath(c.x - c.r * 0.2, c.y - c.r * 0.25, c.r * 0.45, 7, 0.3, new Rng(rng.int(1, 1e6))), p.leaf, { opacity: 0.55 });
    for (let k = 0; k < 2; k++) s += circle(c.x + rng.range(-c.r * 0.4, c.r * 0.4), c.y + rng.range(-c.r * 0.4, c.r * 0.4), 1.6, p.leaf, { opacity: 0.7 });
  }
  return s;
}

function mountain(rng) {
  const p = PAL.mountain;
  let s = contactShadow(CX, CY + R * 0.55, R * 1.0);
  // rocky mound base
  s += path(blobPath(CX, CY + R * 0.1, R, 8, 0.2, rng), p.deep, { stroke: OUTLINE, sw: 3, join: true });
  // a craggy peak rising from it (top-down-ish 3/4 read): triangle facets
  const px = CX, py = CY - R * 0.45;
  const facetL = `M ${px} ${py} L ${(CX - R * 0.55).toFixed(1)} ${(CY + R * 0.4).toFixed(1)} L ${px} ${(CY + R * 0.3).toFixed(1)} Z`;
  const facetR = `M ${px} ${py} L ${(CX + R * 0.55).toFixed(1)} ${(CY + R * 0.4).toFixed(1)} L ${px} ${(CY + R * 0.3).toFixed(1)} Z`;
  s += path(facetL, p.lite, { stroke: OUTLINE, sw: 2, join: true });
  s += path(facetR, p.base, { stroke: OUTLINE, sw: 2, join: true });
  // snow cap
  const cap = `M ${px} ${py} L ${(px - R * 0.16).toFixed(1)} ${(py + R * 0.22).toFixed(1)} L ${(px - R * 0.05).toFixed(1)} ${(py + R * 0.12).toFixed(1)} L ${(px + R * 0.06).toFixed(1)} ${(py + R * 0.24).toFixed(1)} L ${(px + R * 0.16).toFixed(1)} ${(py + R * 0.14).toFixed(1)} L ${px} ${(py + R * 0.3).toFixed(1)} Z`;
  s += path(cap, p.snow, { opacity: 0.95 });
  // secondary lower crag
  const sx = CX + R * 0.45, sy = CY - R * 0.05;
  s += path(`M ${sx} ${sy} L ${(sx - R * 0.28).toFixed(1)} ${(CY + R * 0.35).toFixed(1)} L ${(sx + R * 0.28).toFixed(1)} ${(CY + R * 0.35).toFixed(1)} Z`, p.rock, { stroke: OUTLINE, sw: 2, join: true });
  return s;
}

function lava(rng) {
  const p = PAL.lava;
  let s = contactShadow(CX, CY + R * 0.5, R * 0.95);
  // cooled basalt crust
  s += path(blobPath(CX, CY, R, 9, 0.24, rng), p.base, { stroke: OUTLINE, sw: 3, join: true });
  s += path(blobPath(CX - R * 0.18, CY - R * 0.1, R * 0.55, 8, 0.3, new Rng(rng.int(1, 1e6))), p.deep, { opacity: 0.85 });
  // glowing cracks — jagged bright veins radiating from the centre
  const veins = rng.int(4, 6);
  for (let i = 0; i < veins; i++) {
    let a = (i / veins) * Math.PI * 2 + rng.range(-0.3, 0.3);
    let x = CX + Math.cos(a) * R * 0.1, y = CY + Math.sin(a) * R * 0.1;
    for (let k = 0; k < 3; k++) {
      const na = a + rng.range(-0.5, 0.5), len = R * rng.range(0.18, 0.3);
      const nx = x + Math.cos(na) * len, ny = y + Math.sin(na) * len;
      s += line(x, y, nx, ny, p.glow, 3.2);
      s += line(x, y, nx, ny, p.hot, 1.3);
      x = nx; y = ny; a = na;
    }
  }
  // molten pools (hot core inside a glowing rim)
  const pools = rng.int(2, 3);
  for (let i = 0; i < pools; i++) {
    const px = CX + rng.range(-R * 0.4, R * 0.4), py = CY + rng.range(-R * 0.35, R * 0.35);
    const pr = R * rng.range(0.12, 0.2);
    s += circle(px, py, pr, p.glow);
    s += circle(px, py, pr * 0.55, p.hot);
  }
  for (let i = 0; i < 4; i++) s += circle(CX + rng.range(-R * 0.5, R * 0.5), CY - R * 0.1 + rng.range(-R * 0.3, R * 0.3), 1.3, p.hot, { opacity: 0.9 });
  return s;
}

function ice(rng) {
  const p = PAL.ice;
  let s = contactShadow(CX, CY + R * 0.55, R * 0.9, R * 0.28);
  // frozen sheet — soft like water but pale blue, no hard rim
  s += path(blobPath(CX, CY, R, 9, 0.22, rng), p.deep);
  s += path(blobPath(CX, CY, R * 0.9, 9, 0.2, new Rng(rng.int(1, 1e6))), p.base);
  s += path(blobPath(CX - R * 0.14, CY - R * 0.16, R * 0.55, 8, 0.26, new Rng(rng.int(1, 1e6))), p.lite, { opacity: 0.7 });
  // pale fracture lines
  const cracks = rng.int(3, 4);
  for (let i = 0; i < cracks; i++) {
    let a = rng.range(0, Math.PI * 2);
    let x = CX + Math.cos(a) * R * 0.15, y = CY + Math.sin(a) * R * 0.15;
    for (let k = 0; k < 3; k++) {
      const na = a + rng.range(-0.6, 0.6), len = R * rng.range(0.18, 0.28);
      const nx = x + Math.cos(na) * len, ny = y + Math.sin(na) * len;
      s += line(x, y, nx, ny, p.crack, 1.4);
      x = nx; y = ny; a = na;
    }
  }
  // sparkle glints (small plus shapes)
  for (let i = 0; i < 3; i++) {
    const gx = CX + rng.range(-R * 0.5, R * 0.5), gy = CY + rng.range(-R * 0.4, R * 0.4);
    s += line(gx - 3, gy, gx + 3, gy, p.foam, 1.5);
    s += line(gx, gy - 3, gx, gy + 3, p.foam, 1.5);
  }
  return s;
}

function snow(rng) {
  const p = PAL.snow;
  // low soft drift — decor, semi-transparent
  let s = path(blobPath(CX, CY, R, 11, 0.3, rng), p.base, { opacity: 0.92, stroke: p.deep, sw: 2, join: true });
  s += path(blobPath(CX - R * 0.15, CY - R * 0.18, R * 0.6, 10, 0.32, new Rng(rng.int(1, 1e6))), p.lite, { opacity: 0.7 });
  // cool shadow pockets
  for (let i = 0; i < 3; i++) {
    const x = CX + rng.range(-R * 0.5, R * 0.5), y = CY + rng.range(-R * 0.1, R * 0.5);
    s += ellipse(x, y, R * 0.18, R * 0.08, p.deep, { opacity: 0.3 });
  }
  for (let i = 0; i < 6; i++) s += circle(CX + rng.range(-R * 0.6, R * 0.6), CY + rng.range(-R * 0.5, R * 0.4), 1.1, p.spark, { opacity: 0.9 });
  return s;
}

function crystal(rng) {
  const p = PAL.crystal;
  let s = contactShadow(CX, CY + R * 0.5, R * 0.9);
  // dark corrupted mound the shards erupt from
  s += path(blobPath(CX, CY + R * 0.15, R, 8, 0.22, rng), p.base, { stroke: OUTLINE, sw: 3, join: true });
  const shards = rng.int(3, 5);
  const placed = [];
  for (let i = 0; i < shards; i++) {
    placed.push({ x: CX + rng.range(-R * 0.5, R * 0.5), y: CY + rng.range(-R * 0.1, R * 0.25), h: R * rng.range(0.6, 1.0), w: R * rng.range(0.16, 0.26) });
  }
  placed.sort((a, b) => a.y - b.y);
  for (const c of placed) {
    const tx = c.x + rng.range(-3, 3), ty = c.y - c.h;
    // full shard outline, then a lit right facet + shaded left facet for volume
    s += path(`M ${(c.x - c.w).toFixed(1)} ${c.y.toFixed(1)} L ${tx.toFixed(1)} ${ty.toFixed(1)} L ${(c.x + c.w).toFixed(1)} ${c.y.toFixed(1)} Z`, p.deep, { stroke: OUTLINE, sw: 2, join: true });
    s += path(`M ${c.x.toFixed(1)} ${c.y.toFixed(1)} L ${tx.toFixed(1)} ${ty.toFixed(1)} L ${(c.x + c.w).toFixed(1)} ${c.y.toFixed(1)} Z`, p.lite, { opacity: 0.85 });
    s += path(`M ${(c.x - c.w).toFixed(1)} ${c.y.toFixed(1)} L ${tx.toFixed(1)} ${ty.toFixed(1)} L ${c.x.toFixed(1)} ${c.y.toFixed(1)} Z`, p.base, { opacity: 0.9 });
  }
  for (let i = 0; i < 4; i++) s += circle(CX + rng.range(-R * 0.4, R * 0.4), CY - R * 0.3 + rng.range(-R * 0.3, R * 0.3), 1.3, p.glow, { opacity: 0.9 });
  return s;
}

export const TERRAIN = { water, grass, sand, stone, jungle, mountain, lava, ice, snow, crystal };
export const TERRAIN_TYPES = Object.keys(TERRAIN);

/** Generate one terrain SVG document string for `type`, varied by `seed`. */
export function terrainSVG(type, { seed = 1, size = 128 } = {}) {
  const gen = TERRAIN[type];
  if (!gen) throw new Error(`unknown terrain type: ${type} (have ${TERRAIN_TYPES.join(", ")})`);
  const rng = new Rng((seedFrom(type) ^ (seed * 2654435761)) >>> 0);
  return svgDoc(gen(rng), size);
}
