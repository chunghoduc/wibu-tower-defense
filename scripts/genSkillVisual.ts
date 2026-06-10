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

const OUT = "scripts/sdart/skillVisual.json";

const rows = ACTIVE_SKILLS.filter((s) => SKILL_VFX[s.id]).map((s) => ({
  id: s.id,
  name: s.name,
  rarity: s.rarity,
  look: SKILL_VFX[s.id].appearance,
}));

writeFileSync(OUT, JSON.stringify(rows, null, 2) + "\n");
// eslint-disable-next-line no-console
console.log(`wrote ${rows.length} skill visuals → ${OUT} (of ${ACTIVE_SKILLS.length} active skills)`);
