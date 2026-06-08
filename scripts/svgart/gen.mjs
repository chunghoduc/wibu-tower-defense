// Render PIXEL-ART animated sprite sheets for every entity. Towers + hero get
// the articulated pixel rig (7 pose frames in one strip, sliceable by position).
// Enemies/bosses use distinct static creature pixel art; items/VFX are icons.
// Output: <id>.png strip + <id>.json {frameWidth,frameHeight,frames,names}.
import { mkdirSync, writeFileSync } from "node:fs";
import { pixFrame } from "./pixrig.mjs";
import { poseSetFor } from "./poses.mjs";
import { CHARACTERS, HERO, BOSSES } from "../pixelart/specs.mjs";
import { composeEnemy, ENEMY_SPECS } from "../pixelart/creatures.mjs";
import { ITEM_SPECS, composeItem, VFX_SPECS, composeVfx } from "../pixelart/items.mjs";
import { TOWERS } from "../../src/data/towers.ts";
import { encodePng } from "../../src/art/pngEncoder.ts";

const CELL = 48, SCALE = 4;
const GAME = "public/assets/sprites";
const arg = (n) => { const h = process.argv.find((a) => a.startsWith(`--${n}=`)); return h ? h.split("=").slice(1).join("=") : undefined; };
const only = arg("only");
const roleOf = new Map(TOWERS.map((t) => [t.id, t.role]));
const built = [];

function hexRGBA(cells, w, h, scale) {
  const W = w * scale, H = h * scale, rgba = new Uint8Array(W * H * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = cells[y * w + x]; if (!c) continue;
    const n = parseInt(c.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
      const o = ((y * scale + dy) * W + (x * scale + dx)) * 4; rgba[o] = r; rgba[o + 1] = g; rgba[o + 2] = b; rgba[o + 3] = 255;
    }
  }
  return { rgba, W, H };
}

function saveAnim(kind, id, spec, role, cell = CELL) {
  const poses = poseSetFor(role || "damage");
  const N = poses.length;
  const stripCells = new Array(cell * N * cell).fill(null);
  poses.forEach((pose, fi) => {
    const cv = pixFrame(spec, pose, cell);
    for (let y = 0; y < cell; y++) for (let x = 0; x < cell; x++) {
      const v = cv.d[y * cell + x]; if (v) stripCells[y * (cell * N) + (fi * cell + x)] = v;
    }
  });
  const { rgba, W, H } = hexRGBA(stripCells, cell * N, cell, SCALE);
  const dir = `${GAME}/${kind}`; mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/${id}.png`, encodePng(rgba, W, H));
  writeFileSync(`${dir}/${id}.json`, JSON.stringify({ frameWidth: cell * SCALE, frameHeight: cell * SCALE, frames: N, names: poses.map((p) => p.name) }));
  built.push({ kind, id });
  console.log(kind, id, N, "frames");
}

function saveStatic(kind, id, cv) {
  const { rgba, W, H } = hexRGBA(cv.d, cv.w, cv.h, SCALE);
  const dir = `${GAME}/${kind}`; mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/${id}.png`, encodePng(rgba, W, H));
  writeFileSync(`${dir}/${id}.json`, JSON.stringify({ frameWidth: cv.w * SCALE, frameHeight: cv.h * SCALE, frames: 1, names: ["idle"] }));
  built.push({ kind, id });
  console.log(kind, id, "static");
}

const BOSS_IDS = new Set(["champion", "warden", "overlord", "zabro", "ryomen", "kura", "akai", "mukade", "madarok", "meruon"]);

const BOSS_CELL = 64; // bosses render larger + animated via the rig

if (!only || only === "tower") for (const [id, spec] of Object.entries(CHARACTERS)) saveAnim("tower", id, spec, roleOf.get(id));
if (!only || only === "hero") saveAnim("hero", "hero", HERO, "damage");
// Non-boss enemies: distinct static creature art. Bosses: animated rig sheets.
// `--ids=a,b` restricts generation to those ids (used to add NEW enemies without
// clobbering design-team multi-frame sheets already on disk).
const idsArg = arg("ids");
const idFilter = idsArg ? new Set(idsArg.split(",")) : null;
if (!only || only === "enemy")
  for (const [id, s] of Object.entries(ENEMY_SPECS))
    if (!BOSS_IDS.has(id) && (!idFilter || idFilter.has(id))) saveStatic("enemy", id, composeEnemy(s));
if (!only || only === "boss")
  for (const [id, spec] of Object.entries(BOSSES)) saveAnim("boss", id, spec, "damage", BOSS_CELL);
if (!only || only === "item") for (const [id, spec] of Object.entries(ITEM_SPECS)) saveStatic("item", id, composeItem(spec));
if (!only || only === "vfx") for (const [id, spec] of Object.entries(VFX_SPECS)) saveStatic("vfx", id, composeVfx(spec));

// Emit a TS manifest the game imports: key "<kind>__<id>" -> frame config.
// `--only=manifest` rebuilds ONLY this manifest by scanning the sprite dirs —
// it does NOT regenerate art, so SDXL-painted sprites (tower/item/skill) survive.
import { readFileSync, readdirSync, existsSync } from "node:fs";
if (!only || only === "manifest") {
  const entries = [];
  for (const kind of ["tower", "hero", "enemy", "boss", "item", "skill", "vfx", "box"]) {
    const dir = `${GAME}/${kind}`;
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
      const id = f.slice(0, -5);
      const meta = JSON.parse(readFileSync(`${dir}/${f}`, "utf8"));
      entries.push({ key: `${kind}__${id}`, kind, id, path: `assets/sprites/${kind}/${id}.png`, ...meta });
    }
  }
  const ts = `// AUTO-GENERATED by scripts/svgart/gen.mjs — do not edit by hand.\n`
    + `export interface SpriteEntry { key: string; kind: string; id: string; path: string; frameWidth: number; frameHeight: number; frames: number; names: string[]; }\n`
    + `export const SPRITE_MANIFEST: SpriteEntry[] = ${JSON.stringify(entries, null, 0)};\n`
    + `export const SPRITE_BY_KEY = new Map(SPRITE_MANIFEST.map((e) => [e.key, e]));\n`;
  writeFileSync("src/data/spriteManifest.ts", ts);
  console.log("manifest:", entries.length, "entries");
}

console.log("done", built.length);
