import { describe, expect, it } from "vitest";
import { buildAffixStats } from "../src/core/affixStats.ts";
import { createFreshSave } from "../src/core/save.ts";
import { ITEM_CATALOG } from "../src/data/items.ts";

function equipOne(defId: string, rolledAffixes: { type: string; value: number }[], primary: number) {
  const save = createFreshSave();
  const def = ITEM_CATALOG.find((d) => d.id === defId)!;
  const inst = {
    id: "x1", defId, acquiredLevel: 1, rolledStats: {},
    rolledPrimaryAffix: primary, rolledAffixes, enhanceLevel: 0,
  };
  save.inventory.items.push(inst as any);
  save.inventory.equipped[def.slot] = "x1";
  return save;
}

describe("buildAffixStats", () => {
  it("routes fractional-stat affixes to flat and scalar-stat affixes to increased", () => {
    const save = equipOne("fine-precision-ring", [{ type: "critRate", value: 0.1 }, { type: "atk", value: 0.2 }], 0.05);
    const { flat, increased } = buildAffixStats(save);
    // critRate (a fraction) + primary critRate → flat; atk (scalar) → increased%
    expect(flat.some((s) => s.critRate !== undefined)).toBe(true);
    expect(increased.some((s) => s.atk === 0.2)).toBe(true);
  });

  it("maps physicalDamage/magicDamage primaries to increased attack", () => {
    const save = equipOne("worn-warblade", [], 0.1); // warblade primary = physicalDamage
    const { increased } = buildAffixStats(save);
    expect(increased.some((s) => s.atk === 0.1)).toBe(true);
  });

  it("collects critDefense affixes as flat (crit-defend is buildable)", () => {
    const save = equipOne("fine-aegis-charm", [{ type: "critDefense", value: 0.15 }], 0.08);
    const { flat } = buildAffixStats(save);
    expect(flat.some((s) => s.critDefense === 0.15)).toBe(true);
  });

  it("returns empty contributions when nothing is equipped", () => {
    const save = createFreshSave();
    const { flat, increased } = buildAffixStats(save);
    expect(flat).toHaveLength(0);
    expect(increased).toHaveLength(0);
  });
});
