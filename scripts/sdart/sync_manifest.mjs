// Sync spriteManifest.ts entries for an explicit id list from the regenerated
// per-sprite <id>.json files. Only the passed ids are touched; every other entry
// is byte-preserved. Patches frameWidth/frameHeight/frames/names from the json.
// Usage: vite-node scripts/sdart/sync_manifest.mjs --ids=a,b,c
import { readFileSync, writeFileSync } from "node:fs";

const MANIFEST = "src/data/spriteManifest.ts";
const GAME = "public/assets/sprites/tower";
const arg = (n) => { const h = process.argv.find((a) => a.startsWith(`--${n}=`)); return h ? h.split("=").slice(1).join("=") : undefined; };
const ids = (arg("ids") || "").split(",").map((s) => s.trim()).filter(Boolean);
if (!ids.length) { console.error("need --ids=a,b,c"); process.exit(1); }

const src = readFileSync(MANIFEST, "utf8");
const m = src.match(/(export const SPRITE_MANIFEST: SpriteEntry\[\] = )(\[.*\])(;)/s);
if (!m) { console.error("could not locate SPRITE_MANIFEST array"); process.exit(1); }
const arr = JSON.parse(m[2]);

for (const id of ids) {
  const meta = JSON.parse(readFileSync(`${GAME}/${id}.json`, "utf8"));
  const e = arr.find((x) => x.kind === "tower" && x.id === id);
  if (!e) { console.error(`no manifest entry for ${id}`); process.exit(1); }
  e.frameWidth = meta.frameWidth;
  e.frameHeight = meta.frameHeight;
  e.frames = meta.frames;
  e.names = meta.names;
  console.log(`[${id}] -> frames=${meta.frames} names=${meta.names.join(",")}`);
}

const out = m[1] + JSON.stringify(arr) + m[3];
writeFileSync(MANIFEST, src.replace(m[0], out));
console.log("manifest synced");
