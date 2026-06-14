// Generate the loading-screen KEY-ART background from the tower + boss visual
// metadata. Full-scene (no white cutout) like genBackgrounds.mjs: render 16:9 at
// 1024x576 (API needs multiples of 32) and downscale to the 960x540 canvas.
// Usage: vite-node scripts/sdart/genLoadingBackground.mjs [--n 4]
//   Review public/assets/bg/loading-cand-<seed>.png, copy the best to loading.png.
import { writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { TOWER_VISUAL, BOSS_VISUAL } from "./prompts.mjs";
import { buildLoadingPrompt } from "./loadingPrompt.mjs";

const SD = "http://127.0.0.1:8765/generate";
const GW = 1024,
  GH = 576,
  W = 960,
  H = 540;
const OUT = "public/assets/bg";

// Curated cast (visually diverse silhouettes/colours/roles) pulled straight from
// the roster metadata so the poster reflects the real characters' looks.
const HERO_IDS = ["karu-sunfist", "megu-explosion-sage", "aya-dawnshot"];
const BOSS_ID = "ashghost";

const heroes = HERO_IDS.map((id) => TOWER_VISUAL[id]);
const boss = BOSS_VISUAL[BOSS_ID];
const { prompt, negative } = buildLoadingPrompt({ heroes, boss });

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : d;
};
const N = Number(arg("n", 4));

async function gen(seed) {
  const res = await fetch(SD, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      negative_prompt: negative,
      steps: 30,
      width: GW,
      height: GH,
      seed,
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf[0] !== 0x89 || buf[1] !== 0x50) throw new Error("not a PNG");
  return buf;
}

console.log("PROMPT:\n" + prompt + "\n");
const seeds = Array.from({ length: N }, (_, i) => 88000 + i * 211);
for (const s of seeds) {
  try {
    const raw = `${OUT}/loading-cand-${s}.raw.png`;
    const out = `${OUT}/loading-cand-${s}.png`;
    writeFileSync(raw, await gen(s));
    execFileSync("python3", [
      "-c",
      `from PIL import Image;import sys;Image.open(sys.argv[1]).convert("RGB").resize((${W},${H}),Image.LANCZOS).save(sys.argv[2])`,
      raw,
      out,
    ]);
    execFileSync("rm", ["-f", raw]);
    console.log(`wrote ${out}`);
  } catch (e) {
    console.log(`seed ${s} failed: ${e.message}`);
  }
}
console.log("Review candidates, then copy the best over loading.png");
