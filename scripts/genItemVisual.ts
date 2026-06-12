/**
 * Dump every catalog item's visual metadata to JSON for the SDXL runner.
 *
 * Run: `npm run gen:item-visual`  (writes scripts/sdart/itemVisual.json)
 *
 * This is the TS→JS bridge: items.ts (the single source of truth) is TypeScript
 * and merges itemLore.ts homage metadata; sdgen.mjs is plain Node and reads the
 * emitted JSON, so SDXL prompts always follow the latest `appearance.look`.
 */
import { writeFileSync } from "node:fs";
import { ITEM_CATALOG } from "../src/data/items.ts";

const OUT = "scripts/sdart/itemVisual.json";

const rows = ITEM_CATALOG.filter((d) => d.appearance).map((d) => ({
  id: d.id,
  name: d.name,
  slot: d.slot,
  weaponType: d.weaponType ?? null,
  rarity: d.rarity,
  family: d.appearance!.family,
  look: d.appearance!.look,
}));

writeFileSync(OUT, JSON.stringify(rows, null, 2) + "\n");

console.log(`wrote ${rows.length} item visuals → ${OUT} (of ${ITEM_CATALOG.length} catalog items)`);
