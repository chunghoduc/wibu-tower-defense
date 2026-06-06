// Reusable pixel-art body parts for 48x48 character sprites. Light from top-left.
// Each part takes the canvas + a spec object with colours/flags.
import { set, rect, disc, ellipse, line, lineT, shade } from "./canvas.mjs";

const CX = 24;            // centre column
const HEAD_Y = 15, HEAD_R = 8;
const SKIN_DEFAULT = "#f0c49a";

// ---- AURA (drawn first, behind everything) ---------------------------------
export function aura(cv, spec) {
  const r = spec.rarity;
  if (r === "Legendary" || r === "Unique") {
    const col = r === "Unique" ? "#ff6b5a" : "#ffc24d";
    // sparse glow ring behind the figure
    for (let a = 0; a < 360; a += 12) {
      const rad = (a * Math.PI) / 180;
      const x = CX + Math.cos(rad) * 20, y = 26 + Math.sin(rad) * 21;
      set(cv, x, y, shade(col, 1.0));
    }
    // corner sparkles
    for (const [x, y] of [[6, 8], [42, 10], [8, 40], [40, 38], [44, 24]]) {
      set(cv, x, y, col); set(cv, x - 1, y, shade(col, 1.2)); set(cv, x + 1, y, shade(col, 1.2));
      set(cv, x, y - 1, shade(col, 1.2)); set(cv, x, y + 1, shade(col, 1.2));
    }
  } else if (r === "Rare") {
    const col = "#c77dde";
    for (const [x, y] of [[8, 12], [40, 14], [10, 38], [38, 40]]) { set(cv, x, y, col); set(cv, x + 1, y, shade(col, 1.2)); }
  }
}

// ---- BACK ITEMS (cape, wings, gourd, tails, banner) ------------------------
export function back(cv, spec) {
  const b = spec.back;
  if (!b) return;
  if (b === "cape") {
    const c = spec.capeColor || "#c0392b";
    rect(cv, 15, 22, 18, 18, c); rect(cv, 15, 36, 18, 3, shade(c, 0.8));
    line(cv, 15, 22, 14, 40, shade(c, 0.85)); line(cv, 32, 22, 33, 40, shade(c, 0.85));
  } else if (b === "wings") {
    const c = spec.wingColor || "#e8eef7";
    for (const s of [-1, 1]) {
      const bx = CX + s * 9;
      for (let i = 0; i < 4; i++) ellipse(cv, bx + s * (i * 3), 24 + i * 3, 4, 7, shade(c, 1 - i * 0.07));
    }
  } else if (b === "gourd") {
    ellipse(cv, CX + 8, 30, 5, 7, "#c8a06a"); ellipse(cv, CX + 8, 30, 5, 7, undefined);
    rect(cv, CX + 6, 24, 5, 3, "#8a6a3a");
  } else if (b === "tails") {
    const c = spec.tailColor || "#e8902a";
    for (const dx of [-12, -8, 12, 8]) ellipse(cv, CX + dx, 32, 3, 8, shade(c, 1 - Math.abs(dx) * 0.01));
  } else if (b === "banner") {
    const c = spec.bannerColor || "#e8b04a";
    rect(cv, 33, 8, 2, 34, "#7a5a32");
    rect(cv, 35, 10, 9, 12, c); line(cv, 44, 10, 40, 16, c); line(cv, 44, 22, 40, 16, c);
    rect(cv, 38, 13, 3, 6, shade(c, 0.7));
  }
}

// ---- LEGS ------------------------------------------------------------------
export function legs(cv, spec) {
  const c = spec.pants || "#3b4368", boot = spec.boots || "#2a2030";
  for (const s of [-1, 1]) {
    const x = CX + (s < 0 ? -6 : 2);
    rect(cv, x, 39, 4, 7, c);
    rect(cv, x, 39, 4, 2, shade(c, 1.18));
    rect(cv, x - 1, 45, 5, 2, boot);
  }
}

// ---- BODY / OUTFIT ---------------------------------------------------------
export function body(cv, spec) {
  const c = spec.outfit || "#5a6fb0";
  const w = spec.broad ? 11 : 9;
  // torso block (slightly tapered)
  rect(cv, CX - w, 24, w * 2, 16, c);
  ellipse(cv, CX, 39, w, 4, c);
  // top-left light, bottom-right shade
  rect(cv, CX - w, 24, w * 2, 2, shade(c, 1.16));
  rect(cv, CX - w, 37, w * 2, 3, shade(c, 0.82));
  // outfit detail
  if (spec.outfitStyle === "gi") {
    // crossed lapels + belt
    line(cv, CX - 5, 24, CX, 33, "#ffffff"); line(cv, CX + 5, 24, CX, 33, "#ffffff");
    rect(cv, CX - w, 33, w * 2, 2, spec.belt || "#2a3a8a");
  } else if (spec.outfitStyle === "robe") {
    line(cv, CX, 24, CX, 39, shade(c, 1.3)); // centre seam highlight
    rect(cv, CX - w, 24, w * 2, 2, spec.trim || shade(c, 1.4));
  } else if (spec.outfitStyle === "armor") {
    rect(cv, CX - w, 26, w * 2, 2, shade(c, 1.4));
    ellipse(cv, CX - w + 1, 26, 3, 3, spec.trim || "#c4cdda"); // pauldron L
    ellipse(cv, CX + w - 1, 26, 3, 3, spec.trim || "#c4cdda"); // pauldron R
    rect(cv, CX - 2, 28, 4, 9, shade(c, 1.2)); // chest plate centre
  } else if (spec.outfitStyle === "coat") {
    line(cv, CX, 24, CX, 39, shade(c, 0.7));
    rect(cv, CX - w, 24, 3, 16, shade(c, 1.15));
  }
  // sash
  if (spec.sash) { rect(cv, CX - w, 33, w * 2, 2, spec.sash); rect(cv, CX - w, 33, w * 2, 1, shade(spec.sash, 1.2)); }
  // chest emblem
  if (spec.emblem) disc(cv, CX, 30, 2, spec.emblem);
}

// ---- ARMS ------------------------------------------------------------------
export function arms(cv, spec) {
  const sleeve = spec.sleeve || spec.outfit || "#5a6fb0";
  const skin = spec.skin || SKIN_DEFAULT;
  for (const s of [-1, 1]) {
    const x = CX + (s < 0 ? -spec_w(spec) - 3 : spec_w(spec) + 1);
    rect(cv, x, 25, 3, 10, sleeve);
    rect(cv, x, 25, 3, 2, shade(sleeve, 1.16));
    disc(cv, x + 1, 36, 2, skin); // hand
  }
}
function spec_w(spec) { return spec.broad ? 11 : 9; }

// ---- HEAD ------------------------------------------------------------------
export function head(cv, spec) {
  const skin = spec.skin || SKIN_DEFAULT;
  disc(cv, CX, HEAD_Y, HEAD_R, skin);
  rect(cv, CX - HEAD_R + 1, HEAD_Y + HEAD_R - 2, (HEAD_R - 1) * 2, 2, shade(skin, 0.86)); // jaw shade
  disc(cv, CX - 3, HEAD_Y - 3, 3, shade(skin, 1.1)); // cheek light
  // ears
  set(cv, CX - HEAD_R, HEAD_Y, skin); set(cv, CX + HEAD_R, HEAD_Y, skin);
}

// ---- FACE ------------------------------------------------------------------
export function face(cv, spec) {
  const eye = spec.eye || "#1b1b26";
  if (spec.blindfold) { rect(cv, CX - 7, HEAD_Y - 1, 14, 3, "#e8eef0"); return; }
  if (spec.visor) { rect(cv, CX - 7, HEAD_Y - 1, 14, 3, spec.visor); return; }
  // eyes
  set(cv, CX - 3, HEAD_Y, eye); set(cv, CX - 3, HEAD_Y - 1, shade(eye, 1.8));
  set(cv, CX + 3, HEAD_Y, eye); set(cv, CX + 3, HEAD_Y - 1, shade(eye, 1.8));
  if (spec.eyepatch) { rect(cv, CX + 1, HEAD_Y - 2, 5, 4, "#1b1b26"); line(cv, CX, HEAD_Y - 3, CX + 7, HEAD_Y - 1, "#1b1b26"); }
  if (spec.scar) line(cv, CX - 4, HEAD_Y - 3, CX - 4, HEAD_Y + 2, "#9a5a4a");
  if (spec.faceMark) { for (const s of [-1, 1]) { set(cv, CX + s * 5, HEAD_Y, spec.faceMark); set(cv, CX + s * 5, HEAD_Y + 1, spec.faceMark); } }
  if (spec.mask) rect(cv, CX - 6, HEAD_Y + 1, 12, 4, spec.mask);
  // mouth
  if (!spec.mask) line(cv, CX - 1, HEAD_Y + 4, CX + 1, HEAD_Y + 4, shade(spec.skin || SKIN_DEFAULT, 0.7));
}

// ---- HAIR ------------------------------------------------------------------
export function hair(cv, spec) {
  const h = spec.hair, c = spec.hairColor || "#2a1d14";
  if (!h || h === "bald") {
    if (h === "bald") disc(cv, CX, HEAD_Y - 5, 4, shade(spec.skin || SKIN_DEFAULT, 1.05));
    return;
  }
  const hi = shade(c, 1.22), lo = shade(c, 0.78);
  const cap = () => { ellipse(cv, CX, HEAD_Y - 4, HEAD_R, 5, c); rect(cv, CX - HEAD_R, HEAD_Y - 5, HEAD_R * 2, 4, c); ellipse(cv, CX - 3, HEAD_Y - 6, 3, 2, hi); };
  if (h === "spiky" || h === "spikyTall") {
    cap();
    const tall = h === "spikyTall" ? 8 : 5;
    for (let i = -3; i <= 3; i++) {
      const x = CX + i * 2;
      line(cv, x, HEAD_Y - 6, x + (i < 0 ? -2 : i > 0 ? 2 : 0), HEAD_Y - 6 - tall - Math.abs(i), i % 2 ? c : lo);
    }
    rect(cv, CX - HEAD_R, HEAD_Y - 6, HEAD_R * 2, 2, c);
    // side burns
    line(cv, CX - HEAD_R, HEAD_Y - 4, CX - HEAD_R, HEAD_Y + 3, c);
    line(cv, CX + HEAD_R, HEAD_Y - 4, CX + HEAD_R, HEAD_Y + 3, c);
  } else if (h === "widowsPeak") { // Vegeta-style
    cap();
    for (let i = -3; i <= 3; i++) line(cv, CX + i * 2, HEAD_Y - 6, CX + i * 2.6, HEAD_Y - 14, i % 2 ? c : lo);
    set(cv, CX, HEAD_Y - 8, c); line(cv, CX, HEAD_Y - 7, CX, HEAD_Y - 3, c); // peak
    line(cv, CX - HEAD_R, HEAD_Y - 3, CX - HEAD_R, HEAD_Y + 4, c);
    line(cv, CX + HEAD_R, HEAD_Y - 3, CX + HEAD_R, HEAD_Y + 4, c);
  } else if (h === "short") {
    cap();
    rect(cv, CX - HEAD_R, HEAD_Y - 6, HEAD_R * 2, 3, c);
    for (let i = -3; i <= 3; i++) set(cv, CX + i * 2, HEAD_Y - 7, c);
  } else if (h === "bowl") {
    ellipse(cv, CX, HEAD_Y - 3, HEAD_R + 1, 6, c); rect(cv, CX - HEAD_R - 1, HEAD_Y - 4, (HEAD_R + 1) * 2, 4, c);
    ellipse(cv, CX - 3, HEAD_Y - 6, 3, 2, hi);
  } else if (h === "pompadour") { // Kuwabara
    ellipse(cv, CX, HEAD_Y - 7, HEAD_R, 5, c); rect(cv, CX - HEAD_R, HEAD_Y - 8, HEAD_R * 2, 5, c);
    ellipse(cv, CX, HEAD_Y - 10, 5, 3, c); ellipse(cv, CX - 2, HEAD_Y - 10, 2, 2, hi);
  } else if (h === "long" || h === "longStraight") {
    cap();
    rect(cv, CX - HEAD_R - 1, HEAD_Y - 3, 3, 18, c); rect(cv, CX + HEAD_R - 1, HEAD_Y - 3, 3, 18, c);
    rect(cv, CX - HEAD_R - 1, HEAD_Y - 3, 1, 18, hi);
  } else if (h === "ponytail") {
    cap();
    rect(cv, CX + HEAD_R - 1, HEAD_Y - 5, 3, 16, c); ellipse(cv, CX + HEAD_R, HEAD_Y - 6, 2, 2, "#d44");
  } else if (h === "twin") {
    cap();
    for (const s of [-1, 1]) { rect(cv, CX + s * (HEAD_R) - 1, HEAD_Y - 4, 3, 16, c); ellipse(cv, CX + s * HEAD_R, HEAD_Y - 5, 2, 2, c); }
  } else if (h === "hime") { // long straight + blunt bangs
    cap(); rect(cv, CX - HEAD_R, HEAD_Y - 6, HEAD_R * 2, 4, c);
    rect(cv, CX - HEAD_R - 1, HEAD_Y - 4, 3, 20, c); rect(cv, CX + HEAD_R - 1, HEAD_Y - 4, 3, 20, c);
  } else if (h === "flame") {
    const f1 = c, f2 = shade(c, 1.3), f3 = shade(c, 0.8);
    ellipse(cv, CX, HEAD_Y - 4, HEAD_R, 5, f1); rect(cv, CX - HEAD_R, HEAD_Y - 5, HEAD_R * 2, 4, f1);
    for (let i = -3; i <= 3; i++) line(cv, CX + i * 2, HEAD_Y - 6, CX + i * 2.5, HEAD_Y - 12 - Math.abs(i), i % 2 ? f2 : f3);
  } else if (h === "topknot") {
    cap(); ellipse(cv, CX, HEAD_Y - 9, 3, 3, c);
  } else if (h === "mohawk") {
    rect(cv, CX - 1, HEAD_Y - 12, 3, 8, c); for (let i = 0; i < 5; i++) set(cv, CX, HEAD_Y - 12 - i, i % 2 ? c : lo);
    rect(cv, CX - HEAD_R, HEAD_Y - 2, HEAD_R * 2, 2, c);
  }
}

// ---- HEADGEAR --------------------------------------------------------------
export function headgear(cv, spec) {
  const g = spec.headgear; if (!g) return;
  if (g === "bandana") { const c = spec.bandanaColor || "#2f7a3a"; rect(cv, CX - HEAD_R, HEAD_Y - 6, HEAD_R * 2, 3, c); rect(cv, CX - HEAD_R, HEAD_Y - 6, HEAD_R * 2, 1, shade(c, 1.2)); line(cv, CX - HEAD_R, HEAD_Y - 5, CX - HEAD_R - 3, HEAD_Y + 2, c); }
  else if (g === "headband") { const c = spec.bandColor || "#3a4a8a"; rect(cv, CX - HEAD_R, HEAD_Y - 5, HEAD_R * 2, 2, c); rect(cv, CX - 2, HEAD_Y - 5, 4, 2, "#c0cbd8"); }
  else if (g === "witchHat") { const c = spec.hatColor || "#2a2030"; for (let i = 0; i < 12; i++) rect(cv, CX - 6 + i * 0.5, HEAD_Y - 8 - i, 12 - i, 1, c); rect(cv, CX - 9, HEAD_Y - 7, 18, 2, c); }
  else if (g === "hood") { const c = spec.hoodColor || "#3c2f52"; ellipse(cv, CX, HEAD_Y - 3, HEAD_R + 1, 7, c); rect(cv, CX - HEAD_R - 1, HEAD_Y - 5, (HEAD_R + 1) * 2, 5, c); disc(cv, CX, HEAD_Y + 1, HEAD_R - 1, "#caa"); }
  else if (g === "helm") { const c = spec.helmColor || "#b6c0cf"; ellipse(cv, CX, HEAD_Y - 3, HEAD_R, 6, c); rect(cv, CX - HEAD_R, HEAD_Y - 4, HEAD_R * 2, 4, c); rect(cv, CX - 1, HEAD_Y - 4, 2, 8, shade(c, 0.7)); if (spec.plume) { rect(cv, CX - 1, HEAD_Y - 12, 2, 6, spec.plume); } }
  else if (g === "crown") { const c = "#e8b04a"; for (let i = -2; i <= 2; i++) line(cv, CX + i * 3, HEAD_Y - 6, CX + i * 3, HEAD_Y - 9 - (i % 2 ? 0 : 1), c); rect(cv, CX - 7, HEAD_Y - 6, 14, 2, c); }
  else if (g === "horns") { const c = spec.hornColor || "#e8e2d0"; for (const s of [-1, 1]) line(cv, CX + s * 5, HEAD_Y - 6, CX + s * 8, HEAD_Y - 12, c); }
  else if (g === "halo") { ellipse(cv, CX, HEAD_Y - 11, 5, 2, "#ffe98a"); }
}

// ---- WEAPON (overlay, asymmetric, drawn after mirror) ----------------------
export function weapon(cv, spec) {
  const wp = spec.weapon; if (!wp) return;
  const handX = CX + spec_w(spec) + 2, handY = 34;
  if (wp === "katana") { blade(cv, handX, handY, "#cfd6e2", spec.hiltColor || "#8a2a2a"); }
  else if (wp === "katana3") { blade(cv, handX, handY, "#cfd6e2", "#2a2a2a"); blade(cv, handX - 2, handY + 2, "#cfd6e2", "#2a6a2a"); line(cv, CX - 3, HEAD_Y + 7, CX + 3, HEAD_Y + 7, "#2a2a2a"); rect(cv, CX - 4, HEAD_Y + 6, 8, 2, "#3a3a3a"); /* mouth sword */ }
  else if (wp === "broadsword") { rect(cv, handX, handY - 18, 3, 18, "#c0cbd8"); rect(cv, handX - 2, handY, 7, 2, "#7a5a32"); rect(cv, handX, handY + 2, 3, 4, "#7a5a32"); }
  else if (wp === "bow") { for (let a = -8; a <= 8; a++) set(cv, handX + 6 - Math.round(Math.cos(a / 10) * 0), handY + a, "#8a5a2a"); line(cv, handX + 4, handY - 9, handX + 4, handY + 9, "#8a5a2a"); line(cv, handX + 4, handY - 9, handX + 4, handY + 9, "#ddd"); line(cv, handX + 4, handY, handX - 4, handY, "#bbb"); }
  else if (wp === "staff") { rect(cv, handX + 1, handY - 16, 2, 22, "#8a6a3a"); disc(cv, handX + 2, handY - 18, 3, spec.orbColor || "#7ad1ff"); disc(cv, handX + 2, handY - 18, 1, "#fff"); }
  else if (wp === "cannon") { rect(cv, handX - 2, handY - 4, 12, 8, "#5a6275"); rect(cv, handX + 8, handY - 3, 4, 6, "#3a4150"); disc(cv, handX + 2, handY, 2, spec.orbColor || "#2f6fdb"); }
  else if (wp === "gun") { rect(cv, handX, handY - 1, 9, 3, "#4a5260"); rect(cv, handX + 1, handY + 2, 3, 3, "#3a4150"); }
  else if (wp === "scythe") { rect(cv, handX + 1, handY - 18, 2, 24, "#5a4a3a"); line(cv, handX + 2, handY - 18, handX + 9, handY - 14, "#cfd6e2"); line(cv, handX + 9, handY - 14, handX + 7, handY - 9, "#cfd6e2"); }
  else if (wp === "spear") { rect(cv, handX + 1, handY - 18, 2, 26, "#8a6a3a"); line(cv, handX + 2, handY - 22, handX, handY - 18, "#cfd6e2"); line(cv, handX + 2, handY - 22, handX + 4, handY - 18, "#cfd6e2"); }
  else if (wp === "fan") { for (let i = 0; i < 6; i++) line(cv, handX, handY, handX + 6, handY - 6 + i * 2, spec.fanColor || "#d23b3b"); }
  else if (wp === "fists") { disc(cv, handX, handY, 3, spec.fistColor || shade(spec.skin || "#f0c49a", 0.95)); if (spec.fistGlow) { disc(cv, handX, handY - 6, 4, spec.fistGlow); disc(cv, handX, handY - 6, 2, "#fff3c0"); } }
}
function blade(cv, x, y, steel, hilt) {
  rect(cv, x, y - 18, 3, 18, steel); rect(cv, x, y - 18, 1, 18, "#fff"); rect(cv, x - 1, y, 5, 2, "#3a3a3a"); rect(cv, x, y + 2, 3, 4, hilt);
}
