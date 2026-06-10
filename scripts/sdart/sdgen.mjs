// SDXL art generation pipeline: prompt -> /generate -> transparent cutout ->
// game asset. Towers get idle + attack frames; hero gets per-weapon variants.
// Resumable (skips existing). Node 18+ (global fetch), python3 + numpy + PIL.
import { mkdirSync, existsSync, writeFileSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import {
  style, itemStyleFor, NEGATIVE, POSE,
  TOWER_VISUAL, ENEMY_VISUAL, BOSS_VISUAL,
  HERO_BASE, HERO_WEAPON,
} from "./prompts.mjs";

// Item icons are catalog-driven: `npm run gen:item-visual` dumps every item's
// homage `appearance.look` + rarity here, so SDXL follows the item metadata.
const ITEM_VISUAL_PATH = "scripts/sdart/itemVisual.json";

const SD = "http://127.0.0.1:8765/generate";
const CUTOUT = "scripts/sdart/cutout.py";
const RAW = "/tmp/sdraw";
const GAME = "public/assets/sprites";
const PREVIEW = "/tmp/artreview";
mkdirSync(RAW, { recursive: true });
mkdirSync(PREVIEW, { recursive: true });

const arg = (n) => { const h = process.argv.find((a) => a.startsWith(`--${n}=`)); return h ? h.split("=").slice(1).join("=") : undefined; };
const flag = (n) => process.argv.includes(`--${n}`);
const only = arg("only");          // tower|enemy|boss|item|hero
const sample = flag("sample");
const force = flag("force");

function seedOf(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) % 1000000; }

async function sdGenerate(prompt, seed, w, h) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(SD, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, negative_prompt: NEGATIVE, steps: 30, width: w, height: h, seed }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf[0] !== 0x89 || buf[1] !== 0x50) throw new Error("not a PNG");
      return buf;
    } catch (e) { console.log(`    gen attempt ${attempt} failed: ${e.message}`); }
  }
  return null;
}

function cut(rawPath, outPath, size) {
  execFileSync("python3", [CUTOUT, rawPath, outPath, "--size", String(size), "--tol", "52", "--pad", "6"], { stdio: "ignore" });
}

// job: {kind, id, file, prompt, seed, w, h, size}
function buildJobs() {
  const jobs = [];
  const towerIds = Object.keys(TOWER_VISUAL);
  for (const id of towerIds) {
    const v = TOWER_VISUAL[id], sd = seedOf(id);
    jobs.push({ kind: "tower", id, file: `${id}.png`, prompt: style(`${v}, ${POSE.idle}`), seed: sd, w: 768, h: 1024, size: 320 });
    jobs.push({ kind: "tower", id, file: `${id}__attack.png`, prompt: style(`${v}, ${POSE.attack}`), seed: sd, w: 768, h: 1024, size: 320 });
  }
  // hero base + weapon variants
  jobs.push({ kind: "hero", id: "hero", file: `hero.png`, prompt: style(`${HERO_BASE} ${HERO_WEAPON.sword}, ${POSE.idle}`), seed: seedOf("hero"), w: 768, h: 1024, size: 320 });
  for (const [wt, desc] of Object.entries(HERO_WEAPON)) {
    jobs.push({ kind: "hero", id: "hero", file: `hero__${wt}.png`, prompt: style(`${HERO_BASE} ${desc}, ${POSE.idle}`), seed: seedOf("hero"), w: 768, h: 1024, size: 320 });
  }
  for (const [id, v] of Object.entries(ENEMY_VISUAL))
    jobs.push({ kind: "enemy", id, file: `${id}.png`, prompt: style(`${v}, ${POSE.idle}`), seed: seedOf(id), w: 768, h: 1024, size: 300 });
  for (const [id, v] of Object.entries(BOSS_VISUAL))
    jobs.push({ kind: "boss", id, file: `${id}.png`, prompt: style(`${v}, ${POSE.idle}`), seed: seedOf(id), w: 832, h: 1024, size: 384 });
  const items = existsSync(ITEM_VISUAL_PATH) ? JSON.parse(readFileSync(ITEM_VISUAL_PATH, "utf8")) : [];
  if (!items.length) console.log(`  WARN: ${ITEM_VISUAL_PATH} missing/empty — run \`npm run gen:item-visual\` first`);
  // size 96 — the loader (PreloadScene) and the in-battle scaler treat item
  // icons as a fixed 96×96 native asset; other sizes render cropped/oversized.
  for (const it of items)
    jobs.push({ kind: "item", id: it.id, file: `${it.id}.png`, prompt: itemStyleFor(it.look, it.rarity), seed: seedOf(it.id), w: 768, h: 768, size: 96 });
  return jobs;
}

async function main() {
  let jobs = buildJobs();
  if (only) jobs = jobs.filter((j) => j.kind === only);
  if (sample) {
    const pick = ["karu-sunfist", "zoran-thricedraw", "garan-sandshackle", "yuki-frostward-maiden"];
    jobs = jobs.filter((j) =>
      (j.kind === "tower" && pick.includes(j.id)) ||
      (j.kind === "hero" && (j.file === "hero.png" || j.file === "hero__staff.png")) ||
      (j.kind === "enemy" && ["grunt", "gargoyle"].includes(j.id)) ||
      (j.kind === "boss" && j.id === "overlord") ||
      (j.kind === "item" && ["iron-sword", "arcane-staff"].includes(j.id)));
  }
  if (!force) jobs = jobs.filter((j) => !existsSync(`${GAME}/${j.kind}/${j.file}`));

  console.log(`SD generating ${jobs.length} sprites`);
  let n = 0;
  for (const j of jobs) {
    n++;
    mkdirSync(`${GAME}/${j.kind}`, { recursive: true });
    const rawPath = `${RAW}/${j.kind}__${j.file}`;
    console.log(`[${n}/${jobs.length}] ${j.kind}/${j.file}`);
    const buf = await sdGenerate(j.prompt, j.seed, j.w, j.h);
    if (!buf) { console.log("    SKIP (gen failed)"); continue; }
    writeFileSync(rawPath, buf);
    try { cut(rawPath, `${GAME}/${j.kind}/${j.file}`, j.size); }
    catch (e) { console.log(`    cutout failed: ${e.message}`); }
  }
  console.log("done");
}
main().catch((e) => { console.error(e); process.exit(1); });
