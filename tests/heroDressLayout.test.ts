import { describe, it, expect } from "vitest";
import { heroDressLayout } from "../src/data/heroDressLayout.ts";
import { ITEM_CATALOG } from "../src/data/items.ts";
import type { InventorySave } from "../src/core/save.ts";

const BODY = { x: 0, y: 0, w: 300, h: 300 };

// Build an inventory equipping one item per slot, using real catalog defs.
function equip(slots: Record<string, string>): InventorySave {
  const items = Object.entries(slots).map(([slot, defId]) => ({
    id: `inst-${slot}`,
    defId,
    level: 1,
    affixes: [],
  }));
  const equipped: Record<string, string> = {};
  for (const slot of Object.keys(slots)) equipped[slot] = `inst-${slot}`;
  return { items, equipped, materials: {} } as unknown as InventorySave;
}

const bySlot = (s: string, wt?: string) =>
  ITEM_CATALOG.find((d) => d.slot === s && (!wt || d.weaponType === wt))!;

describe("heroDressLayout", () => {
  it("emits a worn layer for each equipped body slot, none for accessories", () => {
    const inv = equip({
      Weapon: bySlot("Weapon").id,
      Helmet: bySlot("Helmet").id,
      BodyArmor: bySlot("BodyArmor").id,
      Gloves: bySlot("Gloves").id,
      Boots: bySlot("Boots").id,
      Ring1: bySlot("Ring").id,
      Amulet: bySlot("Amulet").id,
    });
    const slots = heroDressLayout(inv, BODY)
      .map((l) => l.slot)
      .sort();
    expect(slots).toEqual(["BodyArmor", "Boots", "Gloves", "Helmet", "Weapon"]);
  });

  it("anchors every layer inside the body box", () => {
    const inv = equip({ Helmet: bySlot("Helmet").id, Boots: bySlot("Boots").id });
    for (const l of heroDressLayout(inv, BODY)) {
      expect(l.cx).toBeGreaterThanOrEqual(BODY.x);
      expect(l.cx).toBeLessThanOrEqual(BODY.x + BODY.w);
      expect(l.cy).toBeGreaterThanOrEqual(BODY.y);
      expect(l.cy).toBeLessThanOrEqual(BODY.y + BODY.h);
    }
  });

  it("orders helmet above body armor above feet (head higher = smaller y)", () => {
    const inv = equip({
      Helmet: bySlot("Helmet").id,
      BodyArmor: bySlot("BodyArmor").id,
      Boots: bySlot("Boots").id,
    });
    const m = Object.fromEntries(heroDressLayout(inv, BODY).map((l) => [l.slot, l]));
    expect(m.Helmet.cy).toBeLessThan(m.BodyArmor.cy);
    expect(m.BodyArmor.cy).toBeLessThan(m.Boots.cy);
  });

  it("sizes layers to body parts (helmet smaller than body armor)", () => {
    const inv = equip({ Helmet: bySlot("Helmet").id, BodyArmor: bySlot("BodyArmor").id });
    const m = Object.fromEntries(heroDressLayout(inv, BODY).map((l) => [l.slot, l]));
    expect(m.Helmet.scale).toBeLessThan(m.BodyArmor.scale);
  });

  it("provides a worn key and an icon fallback key per layer", () => {
    const inv = equip({ Helmet: bySlot("Helmet").id });
    const l = heroDressLayout(inv, BODY)[0];
    expect(l.key).toMatch(/^worn__/);
    expect(l.iconKey).toMatch(/^item__/);
  });

  it("marks wings as behind the body", () => {
    const wing = ITEM_CATALOG.find((d) => d.slot === "Wing");
    if (!wing) return; // catalog may omit wings; guard
    const inv = equip({ Wing: wing.id });
    const l = heroDressLayout(inv, BODY).find((x) => x.slot === "Wing")!;
    expect(l.behind).toBe(true);
  });
});
