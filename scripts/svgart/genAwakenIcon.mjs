// One-off: render a 96×96 Awakening Crystal icon (a faceted gem) to match the
// other crafting-material icons. Pure pixel math + the project PNG encoder — no
// GPU. Output: public/assets/sprites/material/awakening-crystal.png (+ .json).
import { writeFileSync } from "node:fs";
import { encodePng } from "../../src/art/pngEncoder.ts";

const W = 96, H = 96;
const rgba = new Uint8Array(W * H * 4);

const cx = 48, top = 14, bot = 84, midY = 40, halfTop = 10, halfMid = 26;

// Facet palette (a radiant violet-cyan gem).
const CORE = [0xc9, 0x7d, 0xff], LIGHT = [0xe8, 0xd6, 0xff], DEEP = [0x6a, 0x3a, 0xb0], EDGE = [0xff, 0xff, 0xff];

function put(x, y, c, a = 255) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const o = (y * W + x) * 4;
  rgba[o] = c[0]; rgba[o + 1] = c[1]; rgba[o + 2] = c[2]; rgba[o + 3] = a;
}

// Half-width of the gem silhouette at row y (kite shape: widens to midY, tapers to bot).
function halfAt(y) {
  if (y < top || y > bot) return -1;
  if (y <= midY) return halfTop + (halfMid - halfTop) * ((y - top) / (midY - top));
  return halfMid * (1 - (y - midY) / (bot - midY));
}

for (let y = 0; y < H; y++) {
  const hw = halfAt(y);
  if (hw < 0) continue;
  for (let x = 0; x < W; x++) {
    const dx = x - cx;
    if (Math.abs(dx) > hw) continue;
    const edge = Math.abs(dx) > hw - 2 || y < top + 2 || y > bot - 2;
    // Facet shading: left bright, right deep, with a central highlight band.
    let c = CORE;
    if (edge) c = EDGE;
    else if (dx < -hw * 0.35) c = LIGHT;
    else if (dx > hw * 0.35) c = DEEP;
    else if (y < midY) c = LIGHT;
    put(x, y, c);
  }
}
// Sparkle accents.
for (const [sx, sy, r] of [[34, 26, 3], [60, 58, 2], [50, 72, 2]]) {
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.abs(dx) + Math.abs(dy) <= r) put(sx + dx, sy + dy, EDGE);
  }
}

const png = encodePng(rgba, W, H);
const dir = "public/assets/sprites/material";
writeFileSync(`${dir}/awakening-crystal.png`, png);
writeFileSync(`${dir}/awakening-crystal.json`, JSON.stringify({ frameWidth: 96, frameHeight: 96, frames: 1, names: ["idle"] }));
console.log("wrote awakening-crystal.png (96x96)");
