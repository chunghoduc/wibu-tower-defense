import { describe, it, expect } from "vitest";
import { ITEM_CATALOG, rollAffixes } from "./items.ts";
import { BASE_ITEM_LINES } from "./itemLines.ts";
import { EXPANSION_LINES } from "./itemsExpansion.ts";
import { JEWEL_CATALOG } from "./jewels.ts";
import { Rng } from "../core/rng.ts";
import type { ItemDef } from "./schema.ts";

// The nerfed source ceilings — see docs/superpowers/specs/2026-06-20-attack-speed-rebalance-design.md.
// Attack speed is hard-capped at 5 atk/sec; these keep the AUTHORED (un-scaled)
// item attack-speed magnitudes modest so reaching the cap requires saturating
// many sources at once. NOTE: line items legitimately scale every stat by rarity
// tier (×1.5–3.7), so we validate the SOURCE line definitions, not the derived
// tier-scaled catalog entries.
const MAX_LINE_PRIMARY_BASE = 0.06; // attackSpeed primaryBase on an item line
const MAX_LINE_BASE_STAT = 0.12; // attackSpeed base stat on an item line
const MAX_AUTHORED_PRIMARY = 0.06; // attackSpeed primary affix on a hand-authored item
const MAX_AUTHORED_BASE_STAT = 0.12; // attackSpeed base stat on a hand-authored item
const MAX_JEWEL_INCREASED = 0.04; // jewel increased.attackSpeed
const MAX_AFFIX_ROLL = 0.06; // rolled attackSpeed random affix (AFFIX_RANGE band)

const ALL_LINES = [...BASE_ITEM_LINES, ...EXPANSION_LINES];
const TIER_PREFIXES = ["fine-", "masterwork-", "heroic-", "mythic-"];
const isGenerated = (d: ItemDef) => TIER_PREFIXES.some((p) => d.id.startsWith(p));

describe("attack-speed item nerf", () => {
  it("no item LINE's attackSpeed primaryBase exceeds the nerfed ceiling", () => {
    const offenders = ALL_LINES.filter(
      (l) => l.primary === "attackSpeed" && l.primaryBase > MAX_LINE_PRIMARY_BASE,
    ).map((l) => `${l.id}:${l.primaryBase}`);
    expect(offenders).toEqual([]);
  });

  it("no item LINE's base attackSpeed stat exceeds the nerfed ceiling", () => {
    const offenders = ALL_LINES.filter(
      (l) => (l.stats.attackSpeed ?? 0) > MAX_LINE_BASE_STAT,
    ).map((l) => `${l.id}:${l.stats.attackSpeed}`);
    expect(offenders).toEqual([]);
  });

  it("no hand-authored item exceeds the nerfed attackSpeed ceilings", () => {
    const authored = ITEM_CATALOG.filter((d) => !isGenerated(d));
    const primaryOffenders = authored
      .filter(
        (d) =>
          d.primaryAffix.type === "attackSpeed" &&
          d.primaryAffix.baseValue > MAX_AUTHORED_PRIMARY,
      )
      .map((d) => `primary ${d.id}:${d.primaryAffix.baseValue}`);
    const baseOffenders = authored
      .filter((d) => (d.baseStats.attackSpeed ?? 0) > MAX_AUTHORED_BASE_STAT)
      .map((d) => `base ${d.id}:${d.baseStats.attackSpeed}`);
    expect([...primaryOffenders, ...baseOffenders]).toEqual([]);
  });

  it("no jewel grants more than the nerfed increased attackSpeed", () => {
    const offenders = JEWEL_CATALOG.filter(
      (j) => (j.increased?.attackSpeed ?? 0) > MAX_JEWEL_INCREASED,
    ).map((j) => `${j.id}:${j.increased?.attackSpeed}`);
    expect(offenders).toEqual([]);
  });

  it("rolled attackSpeed random affixes stay within the nerfed band", () => {
    // rollAffixes only reads def.rarity + def.affixPool. A Legendary draws 3
    // affixes; a pool of just attackSpeed guarantees every roll is attackSpeed.
    const def = { rarity: "Legendary", affixPool: ["attackSpeed"] } as unknown as ItemDef;
    let max = 0;
    for (let seed = 0; seed < 500; seed++) {
      for (const a of rollAffixes(def, new Rng(seed))) {
        if (a.type === "attackSpeed") max = Math.max(max, a.value);
      }
    }
    expect(max).toBeLessThanOrEqual(MAX_AFFIX_ROLL);
    expect(max).toBeGreaterThan(0); // sanity: it actually rolled some
  });
});
