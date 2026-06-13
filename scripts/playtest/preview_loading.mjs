// Dependency-free preview of the loading-screen backdrop. Renders the SAME pure
// geometry (loadingHills/loadingTowers/loadingEmbers/emberAt) into an RGBA buffer
// and writes a PNG via Node's built-in zlib — no browser, no canvas lib. This is
// a faithful preview of the composition the Phaser presenter paints.
//   node scripts/playtest/preview_loading.mjs --out=/tmp/loading-preview.png [--t=2.2]
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import {
  loadingHills,
  loadingTowers,
  loadingEmbers,
  emberAt,
} from "../../src/core/loadingBackdrop.ts";

const arg = (n, d) => {
  const h = process.argv.find((a) => a.startsWith(`--${n}=`));
  return h ? h.split("=").slice(1).join("=") : d;
};
const OUT = arg("out", "/tmp/loading-preview.png");
const T = Number(arg("t", "2.2"));
const W = 960;
const H = 540;

const buf = new Uint8Array(W * H * 4);
const idx = (x, y) => (y * W + x) * 4;

function setPx(x, y, r, g, b, a = 1) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = idx(x | 0, y | 0);
  buf[i] = r * a + buf[i] * (1 - a);
  buf[i + 1] = g * a + buf[i + 1] * (1 - a);
  buf[i + 2] = b * a + buf[i + 2] * (1 - a);
  buf[i + 3] = 255;
}
function addPx(x, y, r, g, b, a = 1) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = idx(x | 0, y | 0);
  buf[i] = Math.min(255, buf[i] + r * a);
  buf[i + 1] = Math.min(255, buf[i + 1] + g * a);
  buf[i + 2] = Math.min(255, buf[i + 2] + b * a);
  buf[i + 3] = 255;
}
const C = (hex) => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
const mix = (a, b, t) => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
];

function fillRect(x0, y0, w, h, col, a = 1) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) setPx(x, y, col[0], col[1], col[2], a);
}
function fillPoly(pts, col, a = 1) {
  let minY = H, maxY = 0;
  for (const p of pts) { minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
  minY = Math.max(0, Math.floor(minY)); maxY = Math.min(H - 1, Math.ceil(maxY));
  for (let y = minY; y <= maxY; y++) {
    const xs = [];
    for (let i = 0; i < pts.length; i++) {
      const a1 = pts[i], b1 = pts[(i + 1) % pts.length];
      if ((a1.y <= y && b1.y > y) || (b1.y <= y && a1.y > y)) {
        xs.push(a1.x + ((y - a1.y) / (b1.y - a1.y)) * (b1.x - a1.x));
      }
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let x = Math.floor(xs[k]); x <= Math.ceil(xs[k + 1]); x++) setPx(x, y, col[0], col[1], col[2], a);
    }
  }
}
function addCircle(cx, cy, r, col, a) {
  for (let y = cy - r; y <= cy + r; y++)
    for (let x = cx - r; x <= cx + r; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d <= r) addPx(x, y, col[0], col[1], col[2], a * (1 - d / r));
    }
}

// --- sky gradient ---
const top = C(0x0b0d16), horizon = C(0x3a2740);
const skyH = H * 0.85;
for (let y = 0; y < H; y++) {
  const col = y < skyH ? mix(top, horizon, y / skyH) : C(0x0b0d16);
  for (let x = 0; x < W; x++) setPx(x, y, col[0], col[1], col[2], 1);
}
// --- hills ---
for (const b of loadingHills(W, H)) fillPoly(b.points, C(b.color), 1);
// --- towers ---
for (const tw of loadingTowers(W, H)) {
  const left = tw.x - tw.width / 2;
  const topY = tw.baseY - tw.height;
  const shoulder = topY + tw.width * 0.5;
  const body = C(tw.body), glow = C(tw.glow);
  addCircle(Math.round(tw.x), Math.round(topY - tw.width * 0.1), Math.round(tw.width * 0.7), glow, 0.16);
  fillRect(Math.round(left), Math.round(shoulder), Math.round(tw.width), Math.round(tw.baseY - shoulder), body, 1);
  fillPoly([
    { x: left - 3, y: shoulder },
    { x: tw.x, y: topY - tw.width * 0.35 },
    { x: left + tw.width + 3, y: shoulder },
  ], body, 1);
  fillRect(
    Math.round(tw.x - tw.width * 0.14), Math.round(topY + tw.height * 0.45),
    Math.round(tw.width * 0.28), Math.round(tw.height * 0.22), glow, 0.9,
  );
}
// --- embers ---
const ember = C(0xffcf8a);
for (const e of loadingEmbers(W, H, 28)) {
  const p = emberAt(e, T, H);
  const a = 0.2 + 0.3 * (0.5 + 0.5 * Math.sin(T * 2 + e.phase));
  addCircle(Math.round(p.x), Math.round(p.y), Math.max(1, Math.round(e.r) + 1), ember, a);
}

// --- encode PNG ---
function png(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.subarray(y * width * 4, (y + 1) * width * 4).forEach((v, i) => {
      raw[y * (width * 4 + 1) + 1 + i] = v;
    });
  }
  const crcTab = [...Array(256)].map((_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc32 = (b) => {
    let c = 0xffffffff;
    for (const v of b) c = crcTab[(c ^ v) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
writeFileSync(OUT, png(W, H, Buffer.from(buf)));
console.log("wrote", OUT);
