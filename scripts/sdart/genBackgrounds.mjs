// One-off scene-background generator for the main menu (and re-runnable for any
// full-scene bg). Hits the local Z-Image API directly and writes a 960x540 PNG
// straight into public/assets/bg/ — NO transparent cutout (scene art fills the
// frame, unlike the isolated-on-white sprites in sdgen.mjs). Usage:
//   vite-node scripts/sdart/genBackgrounds.mjs [--n 4]
import { writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const SD = "http://127.0.0.1:8765/generate";
// The API only accepts dimensions that are multiples of 32, so render at exact
// 16:9 (1024x576) and downscale to the 960x540 canvas size with PIL.
const GW = 1024,
  GH = 576,
  W = 960,
  H = 540;
const OUT = "public/assets/bg";

const PROMPT =
  "epic grand cathedral throne room interior, deep symmetrical one-point " +
  "perspective, a single ornate golden royal throne on a wide raised stone dais " +
  "with broad steps at the centre, the throne empty, seat around mid height, " +
  "towering stained-glass windows casting dramatic volumetric god-ray light " +
  "shafts, rows of lit golden braziers along both walls, tall stone pillars, " +
  "long red royal banners, marble floor with subtle reflections, warm amber " +
  "key light and deep cool shadows, cinematic, atmospheric, fantasy anime game " +
  "background art, highly detailed, painterly";
const NEG =
  "two thrones, multiple thrones, king on throne, character sitting, person, " +
  "people, hero, knight, anime girl, anime boy, face, crowd, user interface, " +
  "UI, hud, text, words, watermark, logo, signature, frame, border, blurry, " +
  "lowres, jpeg artifacts, deformed, tiling seams";

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
      prompt: PROMPT,
      negative_prompt: NEG,
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

const seeds = Array.from({ length: N }, (_, i) => 71000 + i * 137);
for (const s of seeds) {
  try {
    const raw = `${OUT}/menu-hall-cand-${s}.raw.png`;
    const out = `${OUT}/menu-hall-cand-${s}.png`;
    writeFileSync(raw, await gen(s));
    // Downscale 1024x576 -> 960x540 (exact canvas size).
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
console.log("Review candidates, then copy the best over menu-hall.png");
