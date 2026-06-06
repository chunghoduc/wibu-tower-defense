// Item icon composer (24x24) and skill-VFX composer (32x32).
import { canvas, set, rect, disc, ellipse, line, outline, shade } from "./canvas.mjs";

const OUT = "#161320";
const RARITY = { Common: "#9aa6b4", Magic: "#4d9bf0", Rare: "#9c4dd0", Legendary: "#e8902a", Unique: "#d23b3b" };

export const ITEM_SPECS = {
  "iron-sword": { type: "sword", metal: "#c0cbd8", rarity: "Common" },
  "elven-bow": { type: "bow", wood: "#5a8a4a", rarity: "Magic" },
  "arcane-staff": { type: "staff", wood: "#6a4a8a", orb: "#b07ad8", rarity: "Rare" },
  "thunder-cannon": { type: "gun", metal: "#7a6a4a", rarity: "Legendary" },
  "leather-cap": { type: "helmet", metal: "#8a6a3a", rarity: "Common" },
  "iron-helm": { type: "helmet", metal: "#aeb6c2", rarity: "Rare" },
  "cloth-robe": { type: "body", cloth: "#7a8aa0", rarity: "Common" },
  "scale-mail": { type: "body", cloth: "#8a9aa8", scale: true, rarity: "Rare" },
  "worn-gloves": { type: "gloves", cloth: "#8a6a4a", rarity: "Common" },
  "assassin-gloves": { type: "gloves", cloth: "#3a3a4a", rarity: "Legendary" },
  "worn-boots": { type: "boots", cloth: "#8a6a4a", rarity: "Common" },
  "swift-boots": { type: "boots", cloth: "#4a8a6a", rarity: "Rare" },
  "mana-pendant": { type: "amulet", gem: "#4da6f6", rarity: "Magic" },
  "copper-ring": { type: "ring", metal: "#c08a4a", rarity: "Common" },
  "resonance-ring": { type: "ring", metal: "#c0cbd8", gem: "#9c4dd0", rarity: "Rare" },
  "coin-sprite": { type: "coin", rarity: "Common" },
  "fortune-fox": { type: "fox", rarity: "Legendary" },
  "fledgling-wings": { type: "wing", cloth: "#e8eef4", rarity: "Common" },
  "tempest-wings": { type: "wing", cloth: "#7ad1ff", rarity: "Legendary" },
};

export function composeItem(spec) {
  const cv = canvas(24, 24), cx = 12;
  const acc = RARITY[spec.rarity] || "#9aa6b4";
  const t = spec.type;
  if (t === "sword") { const m = spec.metal; rect(cv, cx - 1, 3, 3, 13, m); rect(cv, cx - 1, 3, 1, 13, shade(m, 1.3)); rect(cv, cx - 4, 16, 9, 2, "#7a5a32"); rect(cv, cx, 18, 2, 4, "#7a5a32"); disc(cv, cx + 1, 22, 1, acc); }
  else if (t === "bow") { const w = spec.wood; for (let a = -9; a <= 9; a++) set(cv, cx - 4 + Math.round(Math.abs(a) * 0.45), 12 + a, w); line(cv, cx + 1, 3, cx + 1, 21, "#e8e8ee"); line(cv, cx - 3, 12, cx + 1, 12, "#cfd6e2"); }
  else if (t === "staff") { rect(cv, cx, 6, 2, 16, spec.wood); disc(cv, cx + 1, 5, 3, spec.orb); disc(cv, cx + 1, 5, 1, "#fff"); }
  else if (t === "gun") { const m = spec.metal; rect(cv, 4, 9, 14, 5, m); rect(cv, 4, 9, 14, 1, shade(m, 1.3)); rect(cv, 6, 14, 4, 5, shade(m, 0.7)); disc(cv, 18, 11, 2, acc); }
  else if (t === "helmet") { const m = spec.metal; ellipse(cv, cx, 11, 7, 6, m); rect(cv, cx - 7, 11, 14, 4, m); rect(cv, cx - 1, 8, 2, 8, shade(m, 0.7)); rect(cv, cx - 7, 10, 14, 1, shade(m, 1.3)); }
  else if (t === "body") { const c = spec.cloth; rect(cv, cx - 6, 5, 12, 14, c); ellipse(cv, cx, 18, 6, 3, c); rect(cv, cx - 6, 5, 12, 2, shade(c, 1.2)); line(cv, cx, 5, cx, 19, shade(c, 0.75)); if (spec.scale) for (let y = 8; y < 17; y += 2) for (let x = cx - 5; x < cx + 5; x += 2) set(cv, x, y, shade(c, 0.8)); }
  else if (t === "gloves") { const c = spec.cloth; for (const s of [-1, 1]) { const gx = cx + s * 4; ellipse(cv, gx, 13, 3, 4, c); rect(cv, gx - 1, 8, 3, 4, c); } rect(cv, cx - 6, 16, 12, 2, shade(c, 0.8)); }
  else if (t === "boots") { const c = spec.cloth; for (const s of [-1, 1]) { const bx = cx + s * 4; rect(cv, bx - 1, 6, 3, 9, c); rect(cv, bx - 2, 15, 5, 3, shade(c, 0.8)); } }
  else if (t === "amulet") { for (let a = 200; a <= 340; a += 12) { const r = (a * Math.PI) / 180; set(cv, cx + Math.cos(r) * 6, 9 + Math.sin(r) * 6, "#caa84a"); } disc(cv, cx, 15, 3, spec.gem); disc(cv, cx - 1, 14, 1, "#fff"); }
  else if (t === "ring") { for (let a = 0; a < 360; a += 18) { const r = (a * Math.PI) / 180; set(cv, cx + Math.cos(r) * 5, 14 + Math.sin(r) * 5, spec.metal); } if (spec.gem) disc(cv, cx, 9, 2, spec.gem); }
  else if (t === "coin") { disc(cv, cx, 12, 7, "#e8c84a"); disc(cv, cx, 12, 5, "#f5d870"); set(cv, cx, 12, "#caa84a"); rect(cv, cx - 1, 9, 2, 6, "#caa84a"); }
  else if (t === "fox") { ellipse(cv, cx, 14, 6, 5, "#e8902a"); disc(cv, cx, 9, 4, "#e8902a"); for (const s of [-1, 1]) line(cv, cx + s * 2, 6, cx + s * 4, 2, "#e8902a"); set(cv, cx - 2, 9, "#1b1b26"); set(cv, cx + 2, 9, "#1b1b26"); ellipse(cv, cx + 7, 13, 3, 5, "#f5b060"); rect(cv, cx - 4, 13, 8, 2, "#fff"); }
  else if (t === "wing") { const c = spec.cloth; for (const s of [-1, 1]) for (let i = 0; i < 4; i++) ellipse(cv, cx + s * (3 + i * 2), 9 + i * 2, 2, 5, shade(c, 1 - i * 0.08)); }
  // rarity gem corner
  set(cv, 21, 2, acc); set(cv, 20, 2, shade(acc, 1.3)); set(cv, 22, 2, shade(acc, 1.3)); set(cv, 21, 1, shade(acc, 1.3)); set(cv, 21, 3, shade(acc, 1.3));
  outline(cv, OUT);
  return cv;
}

// ---- skill VFX (32x32 effect sprites) --------------------------------------
const DMG = { Physical: "#cfd6e2", Magic: "#c77dde", True: "#fff3c0" };

export const VFX_SPECS = {
  "iron-cleave": { shape: "arc", dmg: "Physical" },
  "stone-bash": { shape: "impact", dmg: "Physical" },
  "execute-slash": { shape: "slash", dmg: "Physical" },
  "tri-shot": { shape: "arrows", dmg: "Physical" },
  "piercing-arrow": { shape: "arrowline", dmg: "Physical" },
  "mana-burst": { shape: "burst", dmg: "Magic" },
  "arcane-nova": { shape: "ring", dmg: "Magic" },
  "rapid-fire": { shape: "bullets", dmg: "Physical" },
  "concussion-round": { shape: "impact", dmg: "Physical" },
  "shadow-curse": { shape: "cloud", dmg: "Magic" },
  "true-strike": { shape: "slash", dmg: "True" },
  "void-palm": { shape: "burst", dmg: "True" },
};

export function composeVfx(spec) {
  const cv = canvas(32, 32), cx = 16, cy = 16;
  const c = DMG[spec.dmg] || "#fff", lo = shade(c, 0.75), hi = shade(c, 1.25);
  const s = spec.shape;
  if (s === "arc" || s === "slash") {
    for (let a = -14; a <= 14; a++) { const x = cx + a, y = cy - Math.round((a * a) / (s === "slash" ? 22 : 14)); set(cv, x, y, c); set(cv, x, y + 1, hi); set(cv, x, y - 1, lo); }
  } else if (s === "ring") {
    for (let a = 0; a < 360; a += 8) { const r = (a * Math.PI) / 180; set(cv, cx + Math.cos(r) * 13, cy + Math.sin(r) * 13, c); set(cv, cx + Math.cos(r) * 11, cy + Math.sin(r) * 11, hi); }
  } else if (s === "burst") {
    disc(cv, cx, cy, 5, hi); disc(cv, cx, cy, 3, "#fff");
    for (let a = 0; a < 360; a += 30) { const r = (a * Math.PI) / 180; line(cv, cx, cy, cx + Math.cos(r) * 13, cy + Math.sin(r) * 13, c); }
  } else if (s === "impact") {
    disc(cv, cx, cy, 4, "#fff"); for (let a = 0; a < 360; a += 45) { const r = (a * Math.PI) / 180; line(cv, cx + Math.cos(r) * 4, cy + Math.sin(r) * 4, cx + Math.cos(r) * 12, cy + Math.sin(r) * 12, c); }
  } else if (s === "arrows") {
    for (const dy of [-6, 0, 6]) { line(cv, 4, cy + dy, 24, cy + dy, c); line(cv, 24, cy + dy, 20, cy + dy - 3, c); line(cv, 24, cy + dy, 20, cy + dy + 3, c); }
  } else if (s === "arrowline") {
    rect(cv, 3, cy - 1, 24, 2, c); line(cv, 27, cy, 22, cy - 4, hi); line(cv, 27, cy, 22, cy + 4, hi);
  } else if (s === "bullets") {
    for (let i = 0; i < 5; i++) { disc(cv, 6 + i * 5, cy, 2, c); set(cv, 6 + i * 5, cy, "#fff"); }
  } else if (s === "cloud") {
    for (const [dx, dy, r] of [[-5, 2, 5], [4, 0, 5], [0, -3, 4], [-2, 5, 4], [6, 4, 3]]) ellipse(cv, cx + dx, cy + dy, r, r - 1, shade(c, 0.7));
    set(cv, cx - 3, cy, "#ff5a5a"); set(cv, cx + 4, cy + 1, "#ff5a5a");
  }
  outline(cv, OUT);
  return cv;
}
