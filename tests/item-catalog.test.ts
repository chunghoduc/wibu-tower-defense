import { describe, expect, it } from "vitest";
import { ITEM_CATALOG, ITEM_CATALOG_MAP, rollItem } from "../src/data/items.ts";
import { ITEM_SLOTS, WEAPON_TYPES } from "../src/data/schema.ts";

describe("crit stats stay reasonable", () => {
  it("crit base stats do NOT balloon with item level (fractional, level-independent)", () => {
    const ring = ITEM_CATALOG.find((d) => d.id === "mythic-precision-ring")!;
    let max = 0;
    for (let s = 1; s <= 200; s++) max = Math.max(max, rollItem(ring, 60, s).rolledStats.critRate ?? 0);
    expect(max).toBeLessThan(0.12); // base alone never near a level-scaled 0.5+
  });

  it("no single item rolls more than ~30% total crit chance", () => {
    let max = 0;
    for (const d of ITEM_CATALOG) {
      const hasCrit = (d.baseStats.critRate ?? 0) > 0 || d.primaryAffix.type === "critRate" || d.affixPool.includes("critRate");
      if (!hasCrit) continue;
      for (let s = 1; s <= 120; s++) {
        const inst = rollItem(d, 60, s);
        let cr = inst.rolledStats.critRate ?? 0;
        if (d.primaryAffix.type === "critRate") cr += inst.rolledPrimaryAffix;
        for (const a of inst.rolledAffixes) if (a.type === "critRate") cr += a.value;
        max = Math.max(max, cr);
      }
    }
    expect(max).toBeLessThan(0.30);
  });

  it("each critRate affix rolls within its capped range", () => {
    const ring = ITEM_CATALOG.find((d) => d.id === "mythic-precision-ring")!;
    for (let s = 1; s <= 200; s++) {
      for (const a of rollItem(ring, 60, s).rolledAffixes) {
        if (a.type === "critRate") { expect(a.value).toBeGreaterThanOrEqual(0.02); expect(a.value).toBeLessThanOrEqual(0.05); }
      }
    }
  });
});

describe("expanded item catalog (T10)", () => {
  it("has at least 149 items (19 base + 130 generated)", () => {
    expect(ITEM_CATALOG.length).toBeGreaterThanOrEqual(149);
  });

  it("all item ids are unique", () => {
    const ids = ITEM_CATALOG.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("offers many distinct primary affix types", () => {
    const types = new Set(ITEM_CATALOG.map((d) => d.primaryAffix.type));
    expect(types.size).toBeGreaterThanOrEqual(12);
  });

  it("covers every equipment slot", () => {
    const slots = new Set(ITEM_CATALOG.map((d) => d.slot));
    for (const s of ITEM_SLOTS) {
      if (s === "Ring1" || s === "Ring2") continue; // rings split across both
      expect(slots.has(s), s).toBe(true);
    }
  });

  it("every weapon has a valid weaponType and every item a positive primary value", () => {
    for (const d of ITEM_CATALOG) {
      if (d.slot === "Weapon") expect(WEAPON_TYPES.includes(d.weaponType!), d.id).toBe(true);
      expect(d.primaryAffix.baseValue, d.id).toBeGreaterThan(0);
      expect(d.requiredLevel).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("loot expansion batch", () => {
  // Hand-crafted signature pieces + one variant from each new generated line.
  const NEW_IDS = [
    "dawnbreaker", "void-render", "aegis-of-dawn", "seers-eye", "midas-paw",
    "worn-frost-glaive", "mythic-frost-glaive",
    "worn-venom-fang", "mythic-bulwark-plate",
    "worn-oracle-crown", "worn-shadowstep-treads", "worn-duelist-band",
  ];

  it("adds the new signature and generated loot to the catalog", () => {
    for (const id of NEW_IDS) {
      expect(ITEM_CATALOG_MAP.has(id), id).toBe(true);
    }
  });

  it("introduces hand-crafted Unique-rarity loot (not just generated Mythics)", () => {
    const handcraftedUniques = ITEM_CATALOG.filter(
      (d) => d.rarity === "Unique" && !d.id.startsWith("mythic-"),
    );
    expect(handcraftedUniques.length).toBeGreaterThanOrEqual(2);
  });

  it("every new generated line spans all 5 rarities", () => {
    for (const line of ["frost-glaive", "venom-fang", "bulwark-plate", "oracle-crown", "shadowstep-treads", "duelist-band"]) {
      for (const prefix of ["worn", "fine", "masterwork", "heroic", "mythic"]) {
        expect(ITEM_CATALOG_MAP.has(`${prefix}-${line}`), `${prefix}-${line}`).toBe(true);
      }
    }
  });
});
