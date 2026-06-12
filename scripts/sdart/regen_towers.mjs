// Regenerate clean 8-frame sheets for an explicit tower id list. For each id, try a
// sequence of seeds and KEEP the first sheet that slices to exactly 8 opaque frames
// (sliceanim --min-frames 8 + ghost-guard). Records winning seeds to
// scripts/sdart/regen_seeds.json for reproducibility. Existing 46 good towers are
// never touched — only the ids you pass are regenerated.
// Usage: vite-node scripts/sdart/regen_towers.mjs --ids=a,b,c [--tries=12]
import { mkdirSync, existsSync, writeFileSync, readFileSync, copyFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { TOWER_VISUAL, charSheetPrompt, SHEET_NEGATIVE } from "./animprompts.mjs";

const SD = "http://127.0.0.1:8765/generate";
const SLICE = "scripts/sdart/sliceanim.py";
const RAW = "/tmp/sdraw";
const GAME = "public/assets/sprites/tower";
const SEEDFILE = "scripts/sdart/regen_seeds.json";
mkdirSync(RAW, { recursive: true });

const arg = (n) => { const h = process.argv.find((a) => a.startsWith(`--${n}=`)); return h ? h.split("=").slice(1).join("=") : undefined; };
const ids = (arg("ids") || "").split(",").map((s) => s.trim()).filter(Boolean);
const tries = parseInt(arg("tries") || "12", 10);
if (!ids.length) { console.error("need --ids=a,b,c"); process.exit(1); }

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

function sliceFrames(raw, out) {
  // --min-frames 8: a short slice prints "TOO FEW FRAMES" and writes nothing, so a
  // bad roll never overwrites a good prior result. Returns the produced frame count.
  try {
    const o = execFileSync("python3", [SLICE, raw, out, "--cell", "128", "--max-frames", "8", "--min-frames", "8"], { encoding: "utf8" });
    const m = o.match(/sliced (\d+) frames/);
    return m ? parseInt(m[1], 10) : 0;
  } catch { return 0; }
}

const seeds = existsSync(SEEDFILE) ? JSON.parse(readFileSync(SEEDFILE, "utf8")) : {};

for (const id of ids) {
  const v = TOWER_VISUAL[id];
  if (!v) { console.log(`SKIP ${id}: no TOWER_VISUAL`); continue; }
  const prompt = charSheetPrompt(v);
  const out = `${GAME}/${id}.png`;
  const tmpOut = `${RAW}/slice__${id}.png`;
  let won = null;
  for (let t = 0; t < tries; t++) {
    const seed = (seedOf("a" + id) + t * 97 + 1) % 1000000;
    console.log(`[${id}] try ${t + 1}/${tries} seed ${seed}`);
    const buf = await sd(prompt, SHEET_NEGATIVE, seed, 1536, 640);
    if (!buf) continue;
    const raw = `${RAW}/regen__${id}.png`;
    writeFileSync(raw, buf);
    const n = sliceFrames(raw, tmpOut);
    console.log(`   -> ${n} frames`);
    if (n === 8) { won = { seed, tmpOut }; break; }
  }
  if (!won) { console.log(`[${id}] FAILED to reach 8 frames in ${tries} tries — leaving existing art`); continue; }
  copyFileSync(won.tmpOut, out);
  copyFileSync(won.tmpOut.replace(/\.png$/, ".json"), out.replace(/\.png$/, ".json"));
  seeds[id] = won.seed;
  writeFileSync(SEEDFILE, JSON.stringify(seeds, null, 2));
  console.log(`[${id}] DONE seed ${won.seed}`);
}
console.log("regen complete");
