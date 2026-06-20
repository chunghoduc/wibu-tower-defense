import { describe, it, expect } from "vitest";
import { ITEM_CATALOG } from "./items.ts";
import { JEWEL_CATALOG } from "./jewels.ts";

// The nerfed ceilings — see docs/superpowers/specs/2026-06-20-attack-speed-rebalance-design.md.
// Attack speed is hard-capped at 5 atk/sec; these keep item sources modest so
// reaching the cap requires saturating many sources at once.
const MAX_PRIMARY_BASEVALUE = 0.06; // attackSpeed primary affix
const MAX_BASE_ATTACKSPEED_STAT = 0.12; // item base attackSpeed stat
const MAX_JEWEL_INCREASED = 0.04; // jewel increased.attackSpeed

describe("attack-speed item nerf", () => {
  it("no item's attackSpeed primary affix exceeds the nerfed base value", () => {
    const offenders = ITEM_CATALOG.filter(
      (d) =>
        d.primaryAffix.type === "attackSpeed" &&
        d.primaryAffix.baseValue > MAX_PRIMARY_BASEVALUE,
    ).map((d) => `${d.id}:${d.primaryAffix.baseValue}`);
    expect(offenders).toEqual([]);
  });

  it("no item's base attackSpeed stat exceeds the nerfed ceiling", () => {
    const offenders = ITEM_CATALOG.filter(
      (d) => (d.baseStats.attackSpeed ?? 0) > MAX_BASE_ATTACKSPEED_STAT,
    ).map((d) => `${d.id}:${d.baseStats.attackSpeed}`);
    expect(offenders).toEqual([]);
  });

  it("no jewel grants more than the nerfed increased attackSpeed", () => {
    const offenders = JEWEL_CATALOG.filter(
      (j) => (j.increased?.attackSpeed ?? 0) > MAX_JEWEL_INCREASED,
    ).map((j) => `${j.id}:${j.increased?.attackSpeed}`);
    expect(offenders).toEqual([]);
  });
});
