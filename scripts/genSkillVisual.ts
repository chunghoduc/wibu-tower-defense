/**
 * Dump every hero active skill's VFX appearance to JSON for the SDXL runner.
 *
 * Run: `npm run gen:skill-visual`  (writes scripts/sdart/skillVisual.json)
 *
 * TS→JS bridge: skills.ts + skillVfxMeta.ts (the single source of truth) are
 * TypeScript; sdgen.mjs is plain Node and reads the emitted JSON, so each skill
 * icon is painted from the SAME `appearance` text that drives its in-battle VFX.
 */
import { writeFileSync } from "node:fs";
import { ACTIVE_SKILLS } from "../src/data/skills.ts";
import { SKILL_VFX } from "../src/data/skillVfxMeta.ts";
import { TOWER_ACTIVES, PASSIVE_SKILLS } from "../src/data/passiveSkills.ts";

const OUT = "scripts/sdart/skillVisual.json";

interface Row {
  id: string;
  name: string;
  rarity?: string;
  look: string;
}

// Hero active skills paint from their VFX `appearance` (icon ⇆ in-battle effect).
const heroRows: Row[] = ACTIVE_SKILLS.filter((s) => SKILL_VFX[s.id]).map((s) => ({
  id: s.id,
  name: s.name,
  rarity: s.rarity,
  look: SKILL_VFX[s.id].appearance,
}));

// Tower-active + passive skills have no VFX meta, so the icon is painted from
// the skill `description` (its only flavour text). Without these rows the
// generator never emits their PNGs and PreloadScene spams "Failed to process
// file" for every one (Vite serves index.html for the missing asset path).
const flavourRows: Row[] = [
  ...Object.entries(TOWER_ACTIVES),
  ...Object.entries(PASSIVE_SKILLS),
].map(([id, s]) => ({ id, name: s.name, look: s.description }));

// De-dupe by id (a skill could appear in more than one catalog); hero VFX rows win.
const seen = new Set<string>();
const rows: Row[] = [];
for (const r of [...heroRows, ...flavourRows]) {
  if (seen.has(r.id)) continue;
  seen.add(r.id);
  rows.push(r);
}

writeFileSync(OUT, JSON.stringify(rows, null, 2) + "\n");
// eslint-disable-next-line no-console
console.log(
  `wrote ${rows.length} skill visuals → ${OUT} (${heroRows.length} hero VFX + ${rows.length - heroRows.length} flavour-only)`,
);
