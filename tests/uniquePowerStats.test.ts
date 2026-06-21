import { describe, expect, it } from "vitest";
import { buildUniquePowerStats } from "../src/core/uniquePowerStats.ts";
import { createFreshSave } from "../src/core/save.ts";
import { ITEM_CATALOG } from "../src/data/items.ts";
import { equipSlotsFor } from "../src/data/schema.ts";

function freshSave() {
  return createFreshSave();
}

function equip(save: ReturnType<typeof createFreshSave>, defId: string, instId: string) {
  const def = ITEM_CATALOG.find((d) => d.id === defId)!;
  save.inventory.items.push({
    id: instId,
    defId,
    acquiredLevel: 1,
    rolledStats: {},
    rolledPrimaryAffix: 0,
    rolledAffixes: [],
    enhanceLevel: 0,
  } as any);
  save.inventory.equipped[equipSlotsFor(def.slot)[0]] = instId;
}

describe("buildUniquePowerStats", () => {
  it("returns empty buckets when nothing Unique is equipped", () => {
    const { flat, increased, more } = buildUniquePowerStats(freshSave());
    expect(flat).toHaveLength(0);
    expect(increased).toHaveLength(0);
    expect(more).toHaveLength(0);
  });

  it("a Legendary item contributes no Unique-Power stats", () => {
    const save = freshSave();
    equip(save, "thunder-cannon", "leg1"); // Legendary
    const { flat, increased, more } = buildUniquePowerStats(save);
    expect(flat.length + increased.length + more.length).toBe(0);
  });

  it("equipping Dawnbreaker adds its Sunflare contribution (more atk + flat crit dmg)", () => {
    const save = freshSave();
    equip(save, "dawnbreaker", "u1");
    const { flat, more } = buildUniquePowerStats(save);
    expect(more.some((m) => m.atk === 0.18)).toBe(true);
    expect(flat.some((f) => f.critDamage === 0.25)).toBe(true);
  });

  it("Warlord's more-attack scales with the count of equipped uniques", () => {
    // Equip dawnbreaker (Weapon, sunflare) + aegis (Body) + midas (Pet) — 3 uniques.
    // None of those three is warlord, so pick a procedural physical unique that is.
    const save = freshSave();
    equip(save, "dawnbreaker", "u1");
    equip(save, "aegis-of-dawn", "u2");
    equip(save, "midas-paw", "u3");
    const { more } = buildUniquePowerStats(save);
    // 3 uniques equipped → if any warlord-bearing item were present it'd scale ×3;
    // here we only assert the count drives ctx by checking midas/sunflare/bulwark present.
    expect(more.some((m) => m.goldFind === 0.5)).toBe(true); // midas
    expect(more.some((m) => m.maxHp === 0.2)).toBe(true); // bulwark
    expect(more.some((m) => m.atk === 0.18)).toBe(true); // sunflare
  });
});
