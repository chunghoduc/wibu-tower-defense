// One-shot: append single-frame SpriteEntry records for the orphaned pose PNGs
// (52 tower __attack + 4 hero weapon poses) to src/data/spriteManifest.ts.
// Idempotent: skips any key already present. Inserts before the closing "];".
import { readFileSync, writeFileSync, readdirSync } from "node:fs";

const MAN = "src/data/spriteManifest.ts";
const SPR = "public/assets/sprites";

const pngSize = (path) => {
  const d = readFileSync(path);
  return { w: d.readUInt32BE(16), h: d.readUInt32BE(20) };
};

const entries = [];
// Tower attack poses.
for (const f of readdirSync(`${SPR}/tower`)
  .filter((f) => f.endsWith("__attack.png"))
  .sort()) {
  const id = f.replace(/\.png$/, ""); // "<char>__attack"
  const { w, h } = pngSize(`${SPR}/tower/${f}`);
  entries.push({
    key: `tower__${id}`,
    kind: "tower",
    id,
    path: `assets/sprites/tower/${f}`,
    frameWidth: w,
    frameHeight: h,
    frames: 1,
    names: ["pose"],
  });
}
// Hero weapon poses.
for (const fam of ["bow", "fist", "gun", "staff"]) {
  const { w, h } = pngSize(`${SPR}/hero/hero__${fam}.png`);
  entries.push({
    key: `hero__${fam}`,
    kind: "hero",
    id: fam,
    path: `assets/sprites/hero/hero__${fam}.png`,
    frameWidth: w,
    frameHeight: h,
    frames: 1,
    names: ["pose"],
  });
}

let text = readFileSync(MAN, "utf8");
const fresh = entries.filter((e) => !text.includes(`"${e.key}"`));
if (fresh.length === 0) {
  console.log("manifest already has all pose entries — no change");
  process.exit(0);
}
const json = fresh.map((e) => JSON.stringify(e)).join(",");
const close = text.lastIndexOf("];");
if (close < 0) throw new Error("could not find closing `];` of SPRITE_MANIFEST");
text = text.slice(0, close) + "," + json + text.slice(close);
writeFileSync(MAN, text);
console.log(`appended ${fresh.length} pose entries to ${MAN}`);
