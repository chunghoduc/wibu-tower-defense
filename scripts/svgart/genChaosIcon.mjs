// One-off: render a 96×96 Jewel of Chaos icon to match the other crafting-material
// icons. Where the Awakening Crystal is a clean violet kite, the Chaos jewel is a
// JAGGED, SHATTERED crimson-magenta gem — a mosaic of mismatched facets with a
// fracture running through it, so it reads as unstable/random at a glance. Pure
// pixel math + the project PNG encoder — no GPU.
// Output: public/assets/sprites/material/chaos-jewel.png (+ .json).
import { writeFileSync } from "node:fs";
import { encodePng } from "../../src/art/pngEncoder.ts";

const W = 96, H = 96;
const rgba = new Uint8Array(W * H * 4);

const cx = 48, top = 12, bot = 86, midY = 42, halfTop = 9, halfMid = 28;

// Crimson-magenta palette (distinct from soul's blue and awaken's violet-cyan).
const CORE = [0xe0, 0x45, 0x7a];   // crimson-magenta body
const LIGHT = [0xff, 0x9e, 0xc4];  // pink highlight facet
const DEEP = [0x7a, 0x18, 0x4a];   // dark wine shadow facet
const VIOLET = [0xb0, 0x3a, 0xd0]; // chaotic violet shimmer facet
const EDGE = [0xff, 0xff, 0xff];   // bright edge / sparkle
const FACETS = [CORE, LIGHT, DEEP, VIOLET];

function put(x, y, c, a = 255) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const o = (y * W + x) * 4;
  rgba[o] = c[0]; rgba[o + 1] = c[1]; rgba[o + 2] = c[2]; rgba[o + 3] = a;
}

// Jagged silhouette: a kite that widens to midY then tapers, with a deterministic
// sawtooth/jitter on the edge so the gem looks chipped and unstable.
function halfAt(y) {
  if (y < top || y > bot) return -1;
  const base = y <= midY
    ? halfTop + (halfMid - halfTop) * ((y - top) / (midY - top))
    : halfMid * (1 - (y - midY) / (bot - midY));
  const jitter = Math.sin(y * 0.8) * 2.2 + ((y * 7) % 5) - 2; // chipped edge
  return Math.max(2, base + jitter);
}

for (let y = 0; y < H; y++) {
  const hw = halfAt(y);
  if (hw < 0) continue;
  for (let x = 0; x < W; x++) {
    const dx = x - cx;
    if (Math.abs(dx) > hw) continue;
    const edge = Math.abs(dx) > hw - 2 || y < top + 2 || y > bot - 2;
    // Shattered mosaic: a hash of the facet cell picks a mismatched palette entry,
    // so adjacent shards clash — the visual signature of "chaos".
    const cell = (Math.floor((dx + 48) / 7) * 3 + Math.floor((y - top) / 6) * 5) & 0xffff;
    let c = FACETS[cell % FACETS.length];
    if (edge) c = EDGE;
    put(x, y, c);
  }
}

// A jagged fracture line splitting the gem (top-left to lower-right).
for (let t = 0; t <= 1; t += 0.01) {
  const y = Math.round(top + 6 + t * (bot - top - 14));
  const x = Math.round(cx - 10 + t * 24 + Math.sin(t * 22) * 4);
  put(x, y, EDGE); put(x + 1, y, LIGHT);
}

// Sparkle accents on the brighter shards.
for (const [sx, sy, r] of [[36, 24, 3], [62, 50, 2], [44, 70, 2]]) {
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.abs(dx) + Math.abs(dy) <= r) put(sx + dx, sy + dy, EDGE);
  }
}

const png = encodePng(rgba, W, H);
const dir = "public/assets/sprites/material";
writeFileSync(`${dir}/chaos-jewel.png`, png);
writeFileSync(`${dir}/chaos-jewel.json`, JSON.stringify({ frameWidth: 96, frameHeight: 96, frames: 1, names: ["idle"] }));
console.log("wrote chaos-jewel.png (96x96)");
