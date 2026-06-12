import { readdirSync, readFileSync } from "node:fs";
const dir = "public/assets/sprites/item";
const files = readdirSync(dir).filter((f) => f.endsWith(".png"));
const bad = [];
for (const f of files) {
  const b = readFileSync(`${dir}/${f}`);
  const w = b.readUInt32BE(16),
    h = b.readUInt32BE(20);
  if (w !== 96 || h !== 96) bad.push(`${f} ${w}x${h}`);
}
console.log(`checked ${files.length} PNGs; non-96x96: ${bad.length ? bad.join(", ") : "NONE"}`);
