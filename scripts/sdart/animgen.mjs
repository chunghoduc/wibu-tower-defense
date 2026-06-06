// Animated sprite generation: SD animation sheet -> slice -> uniform Phaser
// spritesheet (<id>.png) + manifest (<id>.json {frameWidth,frameHeight,frames}).
// Items stay single static icons. Resumable; --only --sample --force.
import { mkdirSync, existsSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import {
  TOWER_VISUAL, ENEMY_VISUAL, BOSS_VISUAL, ITEM_VISUAL,
  HERO_BASE, HERO_WEAPON, itemStyle, charSheetPrompt, SHEET_NEGATIVE,
} from "./animprompts.mjs";
import { NEGATIVE } from "./prompts.mjs";

const SD = "http://127.0.0.1:8765/generate";
const SLICE = "scripts/sdart/sliceanim.py";
const CUTOUT = "scripts/sdart/cutout.py";
const RAW = "/tmp/sdraw";
const GAME = "public/assets/sprites";
mkdirSync(RAW, { recursive: true });

const arg = (n) => { const h = process.argv.find((a) => a.startsWith(`--${n}=`)); return h ? h.split("=").slice(1).join("=") : undefined; };
const flag = (n) => process.argv.includes(`--${n}`);
const only = arg("only"), sample = flag("sample"), force = flag("force");

function seedOf(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) % 1000000; }

async function sd(prompt, neg, seed, w, h) {
  for (let a = 1; a <= 2; a++) {
    try {
      const r = await fetch(SD, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, negative_prompt: neg, steps: 34, width: w, height: h, seed }) });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const b = Buffer.from(await r.arrayBuffer());
      if (b[0] !== 0x89) throw new Error("not PNG");
      return b;
    } catch (e) { console.log("   gen fail " + a + ": " + e.message); }
  }
  return null;
}

function buildJobs() {
  const jobs = [];
  for (const [id, v] of Object.entries(TOWER_VISUAL))
    jobs.push({ kind: "tower", id, anim: true, prompt: charSheetPrompt(v), seed: seedOf("a" + id) });
  jobs.push({ kind: "hero", id: "hero", anim: true, prompt: charSheetPrompt(`${HERO_BASE} ${HERO_WEAPON.sword}`), seed: seedOf("ahero") });
  for (const [wt, d] of Object.entries(HERO_WEAPON))
    jobs.push({ kind: "hero", id: `hero__${wt}`, anim: true, prompt: charSheetPrompt(`${HERO_BASE} ${d}`), seed: seedOf("ahero") });
  for (const [id, v] of Object.entries(ENEMY_VISUAL))
    jobs.push({ kind: "enemy", id, anim: true, prompt: charSheetPrompt(v, { creature: true }), seed: seedOf("a" + id) });
  for (const [id, v] of Object.entries(BOSS_VISUAL))
    jobs.push({ kind: "boss", id, anim: true, prompt: charSheetPrompt(v, { creature: true }), seed: seedOf("a" + id), boss: true });
  for (const [id, v] of Object.entries(ITEM_VISUAL))
    jobs.push({ kind: "item", id, anim: false, prompt: itemStyle(v), seed: seedOf(id) });
  return jobs;
}

async function main() {
  let jobs = buildJobs();
  if (only) jobs = jobs.filter((j) => j.kind === only);
  if (sample) {
    const pick = ["karu-sunfist", "zoran-thricedraw", "garan-sandshackle"];
    jobs = jobs.filter((j) => (j.kind === "tower" && pick.includes(j.id)) ||
      (j.kind === "hero" && j.id === "hero") || (j.kind === "enemy" && j.id === "gargoyle") ||
      (j.kind === "boss" && j.id === "overlord") || (j.kind === "item" && j.id === "arcane-staff"));
  }
  if (!force) jobs = jobs.filter((j) => !existsSync(`${GAME}/${j.kind}/${j.id}.png`));

  console.log(`generating ${jobs.length}`);
  let n = 0;
  for (const j of jobs) {
    n++; mkdirSync(`${GAME}/${j.kind}`, { recursive: true });
    console.log(`[${n}/${jobs.length}] ${j.kind}/${j.id} ${j.anim ? "(anim)" : "(icon)"}`);
    const raw = `${RAW}/${j.kind}__${j.id}.png`;
    const out = `${GAME}/${j.kind}/${j.id}.png`;
    if (j.anim) {
      const w = j.boss ? 1536 : 1536, h = j.boss ? 768 : 640;
      const buf = await sd(j.prompt, SHEET_NEGATIVE, j.seed, w, h);
      if (!buf) { console.log("   SKIP"); continue; }
      writeFileSync(raw, buf);
      try { execFileSync("python3", [SLICE, raw, out, "--cell", j.boss ? "160" : "128", "--max-frames", "8"], { stdio: "inherit" }); }
      catch (e) { console.log("   slice fail: " + e.message); }
    } else {
      const buf = await sd(j.prompt, NEGATIVE, j.seed, 768, 768);
      if (!buf) { console.log("   SKIP"); continue; }
      writeFileSync(raw, buf);
      try { execFileSync("python3", [CUTOUT, raw, out, "--size", "160", "--tol", "52", "--pad", "6"], { stdio: "ignore" }); }
      catch (e) { console.log("   cut fail: " + e.message); }
    }
  }
  console.log("done");
}
main().catch((e) => { console.error(e); process.exit(1); });
