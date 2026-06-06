// Pixel-art canvas: hex-per-cell storage, drawing primitives, shading,
// outline, mirror, and export to the pixel-art-gen skill's sparse JSON.
import { writeFileSync } from "node:fs";

export const OUTLINE = "#161320";

export function canvas(w, h) { return { w, h, d: new Array(w * h).fill(null) }; }
const inb = (cv, x, y) => x >= 0 && y >= 0 && x < cv.w && y < cv.h;
export const set = (cv, x, y, c) => { x = Math.round(x); y = Math.round(y); if (inb(cv, x, y) && c) cv.d[y * cv.w + x] = c; };
export const get = (cv, x, y) => (inb(cv, x, y) ? cv.d[y * cv.w + x] : null);
export const rect = (cv, x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(cv, x + i, y + j, c); };

export function ellipse(cv, cx, cy, rx, ry, c) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x - cx) / (rx + 0.0001), dy = (y - cy) / (ry + 0.0001);
      if (dx * dx + dy * dy <= 1.0) set(cv, x, y, c);
    }
}
export const disc = (cv, cx, cy, r, c) => ellipse(cv, cx, cy, r, r, c);

export function line(cv, x0, y0, x1, y1, c) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let e = dx + dy;
  for (;;) { set(cv, x0, y0, c); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
}
export function lineT(cv, x0, y0, x1, y1, c, t = 2) {
  for (let o = 0; o < t; o++) { line(cv, x0 + o, y0, x1 + o, y1, c); line(cv, x0, y0 + o, x1, y1 + o, c); }
}

// mirror left half -> right half
export function mirrorX(cv) {
  const half = Math.ceil(cv.w / 2);
  for (let y = 0; y < cv.h; y++) for (let x = half; x < cv.w; x++) cv.d[y * cv.w + x] = cv.d[y * cv.w + (cv.w - 1 - x)];
}

// wrap a 1px outline around the silhouette
export function outline(cv, col = OUTLINE) {
  const add = [];
  for (let y = 0; y < cv.h; y++) for (let x = 0; x < cv.w; x++) {
    if (get(cv, x, y) !== null) continue;
    const n = [get(cv, x - 1, y), get(cv, x + 1, y), get(cv, x, y - 1), get(cv, x, y + 1),
               get(cv, x - 1, y - 1), get(cv, x + 1, y - 1), get(cv, x - 1, y + 1), get(cv, x + 1, y + 1)];
    if (n.some((v) => v !== null && v !== col)) add.push([x, y]);
  }
  for (const [x, y] of add) set(cv, x, y, col);
}

// darken/lighten a hex by factor (>1 lighten, <1 darken)
export function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const adj = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
  r = adj(r); g = adj(g); b = adj(b);
  return "#" + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

export function toJSON(cv, pixel_size = 1) {
  const pixels = [];
  for (let y = 0; y < cv.h; y++) for (let x = 0; x < cv.w; x++) {
    const c = cv.d[y * cv.w + x];
    if (c) pixels.push({ x, y, color: c });
  }
  return { width: cv.w, height: cv.h, background: "transparent", grid_lines: false, pixel_size, pixels };
}
export function emit(cv, path, pixel_size = 1) { writeFileSync(path, JSON.stringify(toJSON(cv, pixel_size))); }
