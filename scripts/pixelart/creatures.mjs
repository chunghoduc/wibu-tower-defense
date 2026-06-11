// Enemy + boss pixel-art composer. Hostile, darker palette, distinct from the
// player's collectible characters. Archetype-driven body types.
import { canvas, set, rect, disc, ellipse, line, outline, shade } from "./canvas.mjs";

const OUT = "#120e18";

export const ENEMY_SPECS = {
  grunt: { type: "humanoid", size: 32, skin: "#9aa39a", cloth: "#4a4438", weapon: "sword", eye: "#d23b3b" },
  runner: { type: "humanoid", size: 28, skin: "#a7b09a", cloth: "#3a4a3a", hunch: true, claws: true, eye: "#e8d24a" },
  brute: { type: "ogre", size: 40, skin: "#6a7a52", cloth: "#3a2e22", armor: "#5a5040", eye: "#e8d24a" },
  bulwark: { type: "humanoid", size: 34, skin: "#8a8a92", cloth: "#3a3a4a", shield: "#6a7280", eye: "#bfe8ff" },
  mender: { type: "caster", size: 32, skin: "#cfc8c0", cloth: "#5a5a6a", orb: "#7ad17a", eye: "#7ad17a" },
  regenerator: { type: "ogre", size: 38, skin: "#5a7a3a", cloth: "#3a4a2a", moss: true, eye: "#cfe87a" },
  slime: { type: "slime", size: 32, body: "#5aa85a", eye: "#1b1b26" },
  slimelet: { type: "slime", size: 22, body: "#6ab86a", eye: "#1b1b26" },
  gargoyle: { type: "winged", size: 32, skin: "#8a8a96", wing: "#6a6a76", stone: true, eye: "#d23b3b" },
  stormflyer: { type: "winged", size: 36, skin: "#5a6a9a", wing: "#7a90c8", eye: "#bfe8ff" },
  sapper: { type: "humanoid", size: 30, skin: "#8a7a6a", cloth: "#5a3a2a", bomb: true, eye: "#e8902a" },
  phantom: { type: "ghost", size: 32, body: "#9ab6d0", eye: "#1b2a4a" },
  summoner: { type: "skeleton", size: 32, bone: "#d8d2c0", cloth: "#3a2a4a", orb: "#b07ad8", eye: "#b07ad8" },
  imp: { type: "humanoid", size: 24, skin: "#c0392b", cloth: "#5a1a1a", horns: true, eye: "#ffd24a" },
  raider: { type: "ogre", size: 38, skin: "#7a5a4a", cloth: "#3a2a2a", weapon: "axe", eye: "#d23b3b" },
  courier: { type: "humanoid", size: 26, skin: "#9a8a6a", cloth: "#4a4a2a", bag: true, eye: "#e8d24a" },
  // Juggernauts — hulking stone constructs (one iron-plated, one rune-carved).
  golem: { type: "ogre", size: 42, skin: "#7a8290", cloth: "#3a4250", armor: "#9aa6b8", eye: "#bfe8ff" },
  monolith: { type: "ogre", size: 42, skin: "#6a6276", cloth: "#2a2438", armor: "#8a7ab0", eye: "#c77dde" },
  // Support enemies — a banner-bearing herald and a hooded hex-caster.
  herald: { type: "humanoid", size: 32, skin: "#caa1a1", cloth: "#7a2a3a", weapon: "sword", eye: "#ffd24a" },
  hexer: { type: "caster", size: 32, skin: "#9aae9a", cloth: "#3a4a3a", orb: "#c77dde", eye: "#c77dde" },
  champion: { type: "boss", size: 44, skin: "#cfcad0", armor: "#8a8f9c", trim: "#caa84a", weapon: "sword", eye: "#d23b3b" },
  warden: { type: "boss", size: 46, skin: "#b0b4bc", armor: "#5a6070", trim: "#9aa6b8", weapon: "axe", shield: "#6a7280", eye: "#bfe8ff" },
  overlord: { type: "boss", size: 48, skin: "#7a6a8a", armor: "#3a2a4a", trim: "#b07ad8", cape: "#2a1a3a", orb: "#c77dde", eye: "#ff5a5a" },
  // anime-homage bosses
  zabro: { type: "boss", size: 44, skin: "#dfe3ea", armor: "#3a4a66", trim: "#8a98b4", weapon: "sword", eye: "#1b2a4a" },
  ryomen: { type: "boss", size: 45, skin: "#e8c0a0", armor: "#7a2a3a", trim: "#1b1b26", horns: true, eye: "#d23b3b" },
  kura: { type: "boss", size: 46, skin: "#e8902a", armor: "#b85a2a", trim: "#ffd24a", horns: true, eye: "#ffd24a" },
  akai: { type: "boss", size: 46, skin: "#c89a7a", armor: "#7a2424", trim: "#ff7a2a", weapon: "axe", eye: "#ff6a2a" },
  mukade: { type: "boss", size: 46, skin: "#9aae8a", armor: "#4a5a4a", trim: "#7a8a6a", eye: "#cfe87a" },
  madarok: { type: "boss", size: 47, skin: "#d8d0d8", armor: "#6a1f2a", trim: "#3a2a3a", cape: "#3a1f28", horns: true, eye: "#d23b3b" },
  meruon: { type: "boss", size: 48, skin: "#b07ad8", armor: "#4a2a6a", trim: "#ffd24a", cape: "#2a1a3a", horns: true, eye: "#fff3a0" },
};

function eyes(cv, cx, ey, col) { set(cv, cx - 2, ey, col); set(cv, cx + 2, ey, col); set(cv, cx - 2, ey - 1, shade(col, 1.6)); set(cv, cx + 2, ey - 1, shade(col, 1.6)); }

// Blend a hex toward another hex by t (0..1) — used for the hurt red flash.
function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const m = (sh) => Math.round((((pa >> sh) & 255) * (1 - t)) + (((pb >> sh) & 255) * t));
  return "#" + ((1 << 24) | (m(16) << 16) | (m(8) << 8) | m(0)).toString(16).slice(1);
}

// Re-pose a finished creature canvas into one gait frame. Articulates the LEG
// BAND (bottom ~28%) per leg so the forward leg lifts/steps while the other
// plants — real alternating locomotion, not a whole-body nudge. `dx`/`bob`
// translate the whole body; `lean` shears the upper rows (feet planted);
// `legL`/`legR` = {dx,dy} offsets applied only to that half's leg-band pixels;
// `tint` reddens for the hurt flash.
function reposeFrame(base, g = {}) {
  const S = base.w, out = canvas(S, S), hurt = "#ff5a5a";
  const dx = g.dx || 0, bob = g.bob || 0, lean = g.lean || 0, tint = g.tint || 0;
  const legL = g.legL || { dx: 0, dy: 0 }, legR = g.legR || { dx: 0, dy: 0 };
  const legTop = S - Math.max(7, Math.round(S * 0.28));
  for (let y = 0; y < S; y++) {
    const sh = Math.round(lean * (S - 1 - y) / (S - 1)); // more shear up top
    for (let x = 0; x < S; x++) {
      const c = base.d[y * S + x];
      if (!c) continue;
      let nx = x + dx + sh, ny = y + bob;
      if (y >= legTop) {                 // leg band: each leg moves on its own
        const leg = x < S / 2 ? legL : legR;
        nx += leg.dx; ny += leg.dy;
      }
      set(out, nx, ny, tint ? mix(c, hurt, tint) : c);
    }
  }
  return out;
}

// Eight-frame enemy loop: idle, a 4-key WALK cycle with alternating legs
// (contact-left -> passing -> contact-right -> passing), a wind-up + strike,
// and a hurt recoil. `/walk/` (PreloadScene) spans walk1..walk4 at 7fps.
const ENEMY_POSES = [
  { name: "idle",  g: {} },
  { name: "walk1", g: { lean: 1,  legL: { dx: 0, dy: -2 }, legR: { dx: 0, dy: 0 } } },
  { name: "walk2", g: { bob: -1, lean: 1,  legL: { dx: 0, dy: -1 }, legR: { dx: 0, dy: -1 } } },
  { name: "walk3", g: { lean: -1, legL: { dx: 0, dy: 0 }, legR: { dx: 0, dy: -2 } } },
  { name: "walk4", g: { bob: -1, lean: -1, legL: { dx: 0, dy: -1 }, legR: { dx: 0, dy: -1 } } },
  { name: "atk1",  g: { bob: -1, lean: -2 } },
  { name: "atk2",  g: { dx: 2, lean: 3 } },
  { name: "hurt",  g: { dx: -2, bob: 1, tint: 0.5 } },
];

export function composeEnemyFrames(spec) {
  const base = composeEnemy(spec);
  return { names: ENEMY_POSES.map((p) => p.name), frames: ENEMY_POSES.map((p) => reposeFrame(base, p.g)) };
}

export function composeEnemy(spec) {
  const S = spec.size, cv = canvas(S, S), cx = Math.floor(S / 2);
  const t = spec.type;

  if (t === "slime") {
    const b = spec.body, lo = shade(b, 0.8), hi = shade(b, 1.25);
    ellipse(cv, cx, S - 10, S / 2 - 2, S / 2 - 6, b);
    rect(cv, cx - (S / 2 - 2), S - 12, (S - 4), 4, b);
    ellipse(cv, cx - 3, S - 14, 4, 3, hi);
    rect(cv, 4, S - 8, S - 8, 3, lo);
    eyes(cv, cx, S - 12, spec.eye); set(cv, cx - 2, S - 11, "#fff"); set(cv, cx + 2, S - 11, "#fff");
    outline(cv, OUT); return cv;
  }
  if (t === "ghost") {
    const b = spec.body, lo = shade(b, 0.82);
    ellipse(cv, cx, 13, 9, 9, b);
    rect(cv, cx - 9, 13, 18, 12, b);
    for (let i = 0; i < 4; i++) ellipse(cv, cx - 6 + i * 4, 26, 2, 3, i % 2 ? b : lo); // wavy hem
    eyes(cv, cx, 12, spec.eye);
    line(cv, cx - 3, 16, cx + 3, 16, lo);
    outline(cv, OUT); return cv;
  }
  if (t === "winged") {
    const sk = spec.skin, w = spec.wing;
    for (const s of [-1, 1]) { for (let i = 0; i < 4; i++) ellipse(cv, cx + s * (7 + i * 3), 12 + i * 3, 4, 7, shade(w, 1 - i * 0.08)); }
    ellipse(cv, cx, 18, 7, 8, sk); // body
    disc(cv, cx, 11, 5, sk);       // head
    if (spec.stone) { rect(cv, cx - 5, 8, 10, 2, shade(sk, 0.7)); }
    for (const s of [-1, 1]) line(cv, cx + s * 3, 7, cx + s * 5, 3, shade(sk, 0.8)); // horns
    eyes(cv, cx, 11, spec.eye);
    rect(cv, cx - 4, 24, 3, 5, shade(sk, 0.85)); rect(cv, cx + 1, 24, 3, 5, shade(sk, 0.85)); // legs
    outline(cv, OUT); return cv;
  }
  if (t === "skeleton") {
    const bo = spec.bone, cl = spec.cloth;
    rect(cv, cx - 7, 16, 14, 12, cl); // robe
    rect(cv, cx - 7, 25, 14, 3, shade(cl, 0.8));
    disc(cv, cx, 11, 5, bo);          // skull
    set(cv, cx - 2, 11, "#1b1b26"); set(cv, cx + 2, 11, "#1b1b26");
    disc(cv, cx - 2, 11, 1, spec.eye); disc(cv, cx + 2, 11, 1, spec.eye);
    line(cv, cx - 1, 13, cx + 1, 13, "#1b1b26");
    rect(cv, cx + 5, 12, 2, 16, "#8a6a3a"); disc(cv, cx + 6, 11, 3, spec.orb); // staff
    outline(cv, OUT); return cv;
  }
  if (t === "caster") {
    const cl = spec.cloth, sk = spec.skin;
    rect(cv, cx - 7, 15, 14, 14, cl); rect(cv, cx - 7, 26, 14, 3, shade(cl, 0.8));
    line(cv, cx, 15, cx, 29, shade(cl, 1.2));
    ellipse(cv, cx, 11, 6, 6, cl); disc(cv, cx, 13, 4, sk); // hooded head
    eyes(cv, cx, 13, spec.eye);
    rect(cv, cx + 6, 12, 2, 16, "#6a5a4a"); disc(cv, cx + 7, 11, 3, spec.orb); // staff
    outline(cv, OUT); return cv;
  }
  if (t === "ogre" || t === "boss") {
    const big = t === "boss";
    const sk = spec.skin, cl = spec.cloth || spec.armor, armor = spec.armor;
    // legs
    rect(cv, cx - 6, S - 9, 5, 8, shade(cl, 0.8)); rect(cv, cx + 1, S - 9, 5, 8, shade(cl, 0.8));
    // cape (overlord)
    if (spec.cape) { rect(cv, cx - 9, 14, 18, S - 22, spec.cape); }
    // torso (broad)
    ellipse(cv, cx, S / 2 + 2, 11, 12, cl);
    rect(cv, cx - 11, S / 2 - 4, 22, 14, cl);
    if (armor) { rect(cv, cx - 11, S / 2 - 4, 22, 3, shade(armor, 1.3)); ellipse(cv, cx - 9, S / 2 - 3, 3, 3, spec.trim || shade(armor, 1.4)); ellipse(cv, cx + 9, S / 2 - 3, 3, 3, spec.trim || shade(armor, 1.4)); }
    if (spec.moss) { for (let i = 0; i < 8; i++) set(cv, cx - 8 + i * 2, S / 2 + 6, "#cfe87a"); }
    // arms
    rect(cv, cx - 14, S / 2 - 3, 4, 11, sk); rect(cv, cx + 10, S / 2 - 3, 4, 11, sk);
    disc(cv, cx - 12, S / 2 + 8, 3, sk); disc(cv, cx + 12, S / 2 + 8, 3, sk);
    // head
    disc(cv, cx, big ? 12 : 13, big ? 7 : 6, sk);
    if (spec.horns || t === "ogre") { for (const s of [-1, 1]) line(cv, cx + s * 4, big ? 8 : 9, cx + s * 7, big ? 3 : 5, shade(sk, 1.3)); }
    eyes(cv, cx, big ? 12 : 13, spec.eye);
    if (t === "ogre") { set(cv, cx - 2, big ? 15 : 16, "#fff"); set(cv, cx + 2, big ? 15 : 16, "#fff"); } // tusks
    // boss helm/crown
    if (big && spec.trim) rect(cv, cx - 7, 6, 14, 2, spec.trim);
    if (spec.orb) disc(cv, cx + 13, S / 2, 3, spec.orb); // overlord magic
    // weapon
    if (spec.weapon === "sword") { rect(cv, cx + 12, S / 2 - 16, 3, 18, "#c0cbd8"); rect(cv, cx + 10, S / 2 + 1, 7, 2, "#6a5a32"); }
    if (spec.weapon === "axe") { rect(cv, cx + 13, S / 2 - 14, 2, 18, "#6a5a3a"); line(cv, cx + 13, S / 2 - 14, cx + 19, S / 2 - 9, "#c0cbd8"); line(cv, cx + 19, S / 2 - 9, cx + 14, S / 2 - 6, "#c0cbd8"); }
    if (spec.shield) { ellipse(cv, cx - 14, S / 2 + 2, 4, 7, spec.shield); ellipse(cv, cx - 14, S / 2 + 2, 2, 4, shade(spec.shield, 1.3)); }
    outline(cv, OUT); return cv;
  }
  // ---- default: humanoid (hostile, hunched) ----
  const sk = spec.skin, cl = spec.cloth;
  const topY = spec.hunch ? 11 : 9;
  rect(cv, cx - 4, S - 9, 3, 8, shade(cl, 0.8)); rect(cv, cx + 1, S - 9, 3, 8, shade(cl, 0.8)); // legs
  ellipse(cv, cx, S / 2 + 2, 7, 8, cl); rect(cv, cx - 7, S / 2 - 3, 14, 12, cl);
  rect(cv, cx - 7, S / 2 + 6, 14, 3, shade(cl, 0.8));
  rect(cv, cx - 9, S / 2 - 2, 3, 9, sk); rect(cv, cx + 6, S / 2 - 2, 3, 9, sk); // arms
  if (spec.claws) { for (const s of [-1, 1]) for (let i = -1; i <= 1; i++) set(cv, cx + s * 8 + i, S / 2 + 8, "#e8e2d0"); }
  disc(cv, cx, topY + 2, 5, sk); // head
  if (spec.horns) for (const s of [-1, 1]) line(cv, cx + s * 3, topY - 1, cx + s * 5, topY - 5, shade(sk, 0.7));
  eyes(cv, cx, topY + 2, spec.eye);
  if (spec.weapon === "sword") { rect(cv, cx + 8, S / 2 - 12, 2, 14, "#aeb6c2"); rect(cv, cx + 7, S / 2 + 1, 4, 2, "#6a5a32"); }
  if (spec.shield) { ellipse(cv, cx - 9, S / 2 + 2, 4, 6, spec.shield); ellipse(cv, cx - 9, S / 2 + 2, 2, 3, shade(spec.shield, 1.3)); }
  if (spec.bomb) { disc(cv, cx + 9, S / 2 + 4, 3, "#2a2a2a"); set(cv, cx + 9, S / 2, "#ff8a3a"); }
  if (spec.bag) { disc(cv, cx + 8, S / 2 + 5, 3, "#8a6a3a"); set(cv, cx + 8, S / 2 + 5, "#e8d24a"); }
  outline(cv, OUT); return cv;
}
