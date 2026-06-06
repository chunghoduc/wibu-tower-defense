// Pixel-art articulated character. Same pose/rig logic as rig.mjs but drawn on a
// hard-pixel canvas (no anti-aliasing) -> true 8-bit look. One frame -> small
// pixel canvas; the orchestrator packs frames into a sprite-sheet strip.
const rad = (d) => (d * Math.PI) / 180;
const tip = (p, deg, len) => ({ x: p.x + Math.sin(rad(deg)) * len, y: p.y + Math.cos(rad(deg)) * len });
export const OUT = "#16131f";

export function canvas(w, h) { return { w, h, d: new Array(w * h).fill(null) }; }
const inb = (cv, x, y) => x >= 0 && y >= 0 && x < cv.w && y < cv.h;
export const set = (cv, x, y, c) => { x = Math.round(x); y = Math.round(y); if (inb(cv, x, y) && c) cv.d[y * cv.w + x] = c; };
export const get = (cv, x, y) => (inb(cv, x, y) ? cv.d[y * cv.w + x] : null);
export function disc(cv, cx, cy, r, c) {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const dx = x - cx, dy = y - cy; if (dx * dx + dy * dy <= r * r + 0.2) set(cv, x, y, c);
    }
}
export function rect(cv, x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(cv, x + i, y + j, c); }
// thick limb: stamp discs of radius r along a->b
export function capsule(cv, a, b, r, c) {
  const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y)));
  for (let i = 0; i <= steps; i++) { const t = i / steps; disc(cv, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, r, c); }
}
export function lineP(cv, a, b, c) {
  let x0 = Math.round(a.x), y0 = Math.round(a.y), x1 = Math.round(b.x), y1 = Math.round(b.y);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx + dy;
  for (;;) { set(cv, x0, y0, c); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
}
export function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16); let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const a = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
  return "#" + ((1 << 24) | (a(r) << 16) | (a(g) << 8) | a(b)).toString(16).slice(1);
}
export function outline(cv, col = OUT) {
  const add = [];
  for (let y = 0; y < cv.h; y++) for (let x = 0; x < cv.w; x++) {
    if (get(cv, x, y) !== null) continue;
    const nb = [get(cv, x - 1, y), get(cv, x + 1, y), get(cv, x, y - 1), get(cv, x, y + 1)];
    if (nb.some((v) => v !== null && v !== col)) add.push([x, y]);
  }
  for (const [x, y] of add) set(cv, x, y, col);
}

function hair(cv, h, hr, style, col) {
  const lo = shade(col, 0.8);
  const cap = () => { disc(cv, h.x, h.y - 1, hr, col); rect(cv, h.x - hr, h.y - hr, hr * 2, hr, col); };
  const spikes = (n, up) => { for (let i = 0; i <= n; i++) { const x = h.x - hr + (i / n) * hr * 2; lineP(cv, { x, y: h.y - hr + 1 }, { x: x + (i < n / 2 ? -1 : 1), y: h.y - hr - up - (i % 2) }, i % 2 ? col : lo); } };
  switch (style) {
    case "spiky": cap(); spikes(5, 3); break;
    case "spikyTall": cap(); spikes(6, 6); break;
    case "widowsPeak": cap(); spikes(6, 5); set(cv, h.x, h.y - hr - 1, col); break;
    case "short": cap(); spikes(6, 1); break;
    case "bald": break;
    case "pompadour": disc(cv, h.x, h.y - hr - 1, hr - 1, col); rect(cv, h.x - hr, h.y - hr, hr * 2, hr, col); break;
    case "long": cap(); rect(cv, h.x - hr - 1, h.y - 1, 2, hr * 2 + 2, col); rect(cv, h.x + hr - 1, h.y - 1, 2, hr * 2 + 2, col); break;
    case "ponytail": cap(); rect(cv, h.x + hr - 1, h.y - hr, 2, hr * 2, col); break;
    case "twin": cap(); rect(cv, h.x - hr - 1, h.y, 2, hr * 2, col); rect(cv, h.x + hr - 1, h.y, 2, hr * 2, col); break;
    case "bowl": disc(cv, h.x, h.y, hr, col); rect(cv, h.x - hr, h.y - hr, hr * 2, hr, col); break;
    case "flame": cap(); spikes(6, 5); break;
    case "mohawk": rect(cv, h.x - 1, h.y - hr - 4, 2, hr + 4, col); break;
    default: cap(); spikes(5, 2);
  }
}
function headgear(cv, h, hr, spec) {
  const g = spec.headgear; if (!g) return;
  if (g === "bandana") { rect(cv, h.x - hr, h.y - 2, hr * 2, 2, spec.bandanaColor || "#2f7a3a"); }
  else if (g === "headband") { rect(cv, h.x - hr, h.y - 2, hr * 2, 2, spec.bandColor || "#3a4a8a"); set(cv, h.x, h.y - 1, "#c0cbd8"); }
  else if (g === "witchHat") { for (let i = 0; i < hr * 2; i++) rect(cv, h.x - 1, h.y - hr - hr * 2 + i, Math.max(1, Math.round(i / 2)), 1, spec.hatColor || "#2a2030"); rect(cv, h.x - hr - 2, h.y - hr, hr * 2 + 4, 1, spec.hatColor || "#2a2030"); }
  else if (g === "hood") { disc(cv, h.x, h.y - 1, hr + 1, spec.hoodColor || "#3c2f52"); disc(cv, h.x, h.y + 1, hr - 1, spec.skin || "#caa"); }
  else if (g === "helm") { disc(cv, h.x, h.y - 1, hr, spec.helmColor || "#b6c0cf"); rect(cv, h.x - hr, h.y - hr, hr * 2, hr, spec.helmColor || "#b6c0cf"); if (spec.plume) rect(cv, h.x - 1, h.y - hr - 4, 2, 4, spec.plume); }
  else if (g === "horns") { lineP(cv, { x: h.x - hr + 1, y: h.y - hr + 1 }, { x: h.x - hr - 1, y: h.y - hr - 3 }, spec.hornColor || "#e8e2d0"); lineP(cv, { x: h.x + hr - 1, y: h.y - hr + 1 }, { x: h.x + hr + 1, y: h.y - hr - 3 }, spec.hornColor || "#e8e2d0"); }
  else if (g === "halo") { disc(cv, h.x, h.y - hr - 3, 2, "#ffe98a"); set(cv, h.x, h.y - hr - 3, null); }
}
function weapon(cv, hand, ang, spec) {
  const w = spec.weapon; if (!w) return;
  const t = (d, l) => tip(hand, ang + d, l);
  if (w === "katana" || w === "broadsword") { capsule(cv, hand, t(0, 13), 1, "#cfd6e2"); }
  else if (w === "katana3") { capsule(cv, hand, t(0, 12), 1, "#cfd6e2"); capsule(cv, hand, t(15, 11), 1, "#cfd6e2"); }
  else if (w === "staff") { const e = t(0, -15); capsule(cv, hand, e, 1, "#8a6a3a"); disc(cv, e.x, e.y, 2, spec.orbColor || "#7ad1ff"); }
  else if (w === "bow") { capsule(cv, t(0, -11), t(0, 11), 1, "#8a5a2a"); }
  else if (w === "cannon" || w === "gun") { capsule(cv, hand, t(90, 7), 2, "#5a6275"); }
  else if (w === "spear") { const e = t(0, -15); capsule(cv, hand, e, 1, "#8a6a3a"); disc(cv, e.x, e.y - 1, 1, "#cfd6e2"); }
  else if (w === "fan") { for (let i = -2; i <= 2; i++) lineP(cv, hand, tip(hand, ang + i * 16, 6), spec.fanColor || "#d23b3b"); }
  else if (w === "fists" && spec.fistGlow) { disc(cv, hand.x, hand.y, 2, spec.fistGlow); }
}

/** Draw one frame to a `cell`x`cell` pixel canvas. */
export function pixFrame(spec, pose, cell = 48) {
  const cv = canvas(cell, cell);
  const cx = cell / 2, bob = pose.bob ? pose.bob * (cell / 128) : 0;
  const hip = { x: cx, y: cell * 0.64 + bob };
  const neck = { x: cx + (pose.lean || 0) * 0.4, y: cell * 0.40 + bob };
  const hr = Math.round(cell * 0.13);
  const head = { x: neck.x + (pose.headX || 0) * 0.4, y: cell * 0.26 + bob };
  const skin = spec.skin || "#f0c49a", out = spec.outfit || "#5a6fb0", sleeve = spec.sleeve || out, pants = spec.pants || "#33405a";
  const sL = { x: neck.x - 3, y: neck.y + 1 }, sR = { x: neck.x + 3, y: neck.y + 1 };
  const hL = { x: hip.x - 2, y: hip.y }, hR = { x: hip.x + 2, y: hip.y };
  const a1 = cell * 0.13, a2 = cell * 0.12, l1 = cell * 0.15, l2 = cell * 0.15;
  const elbL = tip(sL, pose.armL[0], a1), handL = tip(elbL, pose.armL[1], a2);
  const elbR = tip(sR, pose.armR[0], a1), handR = tip(elbR, pose.armR[1], a2);
  const knL = tip(hL, pose.legL[0], l1), ftL = tip(knL, pose.legL[1], l2);
  const knR = tip(hR, pose.legR[0], l1), ftR = tip(knR, pose.legR[1], l2);
  const aw = Math.max(1.4, cell * 0.04), lw = Math.max(1.6, cell * 0.05);

  // back items
  if (spec.back === "cape") rect(cv, Math.round(neck.x - 4), Math.round(neck.y), 8, Math.round(cell * 0.32), spec.capeColor || "#c0392b");
  if (spec.back === "gourd") disc(cv, neck.x + 4, hip.y - 3, 3, "#c8a06a");
  if (spec.back === "tails") for (const dx of [-4, 4, -2, 2]) capsule(cv, { x: hip.x + dx, y: hip.y - 2 }, { x: hip.x + dx, y: hip.y + 8 }, 1.4, spec.tailColor || "#e8902a");
  if (spec.back === "wings") for (const sgn of [-1, 1]) for (let i = 0; i < 3; i++) disc(cv, neck.x + sgn * (3 + i * 2), neck.y + 2 + i * 2, 2, shade(spec.wingColor || "#e8eef7", 1 - i * 0.08));
  if (spec.back === "banner") { capsule(cv, { x: neck.x + 5, y: hip.y + 2 }, { x: neck.x + 5, y: neck.y - 9 }, 1, "#7a5a32"); rect(cv, Math.round(neck.x + 6), Math.round(neck.y - 9), 6, 5, spec.bannerColor || "#e8b04a"); }
  // back arm + back leg
  capsule(cv, sL, elbL, aw, sleeve); capsule(cv, elbL, handL, aw, skin); disc(cv, handL.x, handL.y, aw * 0.8, skin);
  capsule(cv, hL, knL, lw, pants); capsule(cv, knL, ftL, lw, pants); disc(cv, ftL.x, ftL.y + 1, 1.6, spec.boots || "#2a2030");
  // torso
  capsule(cv, { x: neck.x, y: neck.y + 1 }, { x: hip.x, y: hip.y - 1 }, cell * 0.085, out);
  if (spec.sash) rect(cv, Math.round(hip.x - 4), Math.round(hip.y - 4), 8, 2, spec.sash);
  if (spec.outfitStyle === "gi") { lineP(cv, { x: neck.x - 2, y: neck.y + 1 }, { x: hip.x, y: hip.y - 4 }, "#fff"); lineP(cv, { x: neck.x + 2, y: neck.y + 1 }, { x: hip.x, y: hip.y - 4 }, "#fff"); }
  // front leg + front arm base
  capsule(cv, hR, knR, lw, pants); capsule(cv, knR, ftR, lw, pants); disc(cv, ftR.x, ftR.y + 1, 1.6, spec.boots || "#2a2030");
  // head
  disc(cv, head.x, head.y, hr, skin);
  hair(cv, head, hr, spec.hair, spec.hairColor || "#2a1d14");
  headgear(cv, head, hr, spec);
  if (spec.blindfold) rect(cv, Math.round(head.x - hr + 1), Math.round(head.y - 1), hr * 2 - 2, 2, "#e8eef0");
  else { set(cv, Math.round(head.x - 2), Math.round(head.y), spec.eye || "#1b1b26"); set(cv, Math.round(head.x + 2), Math.round(head.y), spec.eye || "#1b1b26");
    if (spec.faceMark) { set(cv, Math.round(head.x - hr + 1), Math.round(head.y + 1), spec.faceMark); set(cv, Math.round(head.x + hr - 1), Math.round(head.y + 1), spec.faceMark); } }
  // front arm + weapon
  capsule(cv, sR, elbR, aw, sleeve); capsule(cv, elbR, handR, aw, skin); disc(cv, handR.x, handR.y, aw * 0.8, skin);
  weapon(cv, handR, pose.armR[1], spec);

  outline(cv);
  // aura sparkles (after outline)
  if (spec.rarity === "Unique" || spec.rarity === "Legendary") { const c = spec.rarity === "Unique" ? "#ff6b5a" : "#ffc24d"; for (const [dx, dy] of [[-cell * 0.42, -cell * 0.28], [cell * 0.42, -cell * 0.26], [cell * 0.44, cell * 0.28]]) set(cv, cx + dx, cell * 0.5 + dy, c); }
  return cv;
}
