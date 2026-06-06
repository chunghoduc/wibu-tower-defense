// Render PIXEL-ART animated sprite sheets for every entity. Towers + hero get
// the articulated pixel rig (7 pose frames in one strip, sliceable by position).
// Enemies/bosses use distinct static creature pixel art; items/VFX are icons.
// Output: <id>.png strip + <id>.json {frameWidth,frameHeight,frames,names}.
import { mkdirSync, writeFileSync } from "node:fs";
import { pixFrame } from "./pixrig.mjs";
import { poseSetFor } from "./poses.mjs";
import { CHARACTERS, HERO } from "../pixelart/specs.mjs";
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

function saveAnim(kind, id, spec, role) {
  const poses = poseSetFor(role || "damage");
  const N = poses.length;
  const stripCells = new Array(CELL * N * CELL).fill(null);
  poses.forEach((pose, fi) => {
    const cv = pixFrame(spec, pose, CELL);
    for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) {
      const v = cv.d[y * CELL + x]; if (v) stripCells[y * (CELL * N) + (fi * CELL + x)] = v;
    }
  });
  const { rgba, W, H } = hexRGBA(stripCells, CELL * N, CELL, SCALE);
  const dir = `${GAME}/${kind}`; mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/${id}.png`, encodePng(rgba, W, H));
  writeFileSync(`${dir}/${id}.json`, JSON.stringify({ frameWidth: CELL * SCALE, frameHeight: CELL * SCALE, frames: N, names: poses.map((p) => p.name) }));
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

const BOSS_IDS = new Set(["champion", "warden", "overlord"]);

if (!only || only === "tower") for (const [id, spec] of Object.entries(CHARACTERS)) saveAnim("tower", id, spec, roleOf.get(id));
if (!only || only === "hero") saveAnim("hero", "hero", HERO, "damage");
if (!only || only === "enemy" || only === "boss")
  for (const [id, s] of Object.entries(ENEMY_SPECS)) saveStatic(BOSS_IDS.has(id) ? "boss" : "enemy", id, composeEnemy(s));
if (!only || only === "item") for (const [id, spec] of Object.entries(ITEM_SPECS)) saveStatic("item", id, composeItem(spec));
if (!only || only === "vfx") for (const [id, spec] of Object.entries(VFX_SPECS)) saveStatic("vfx", id, composeVfx(spec));

console.log("done", built.length);
