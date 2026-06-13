import { describe, it, expect } from "vitest";
import {
  HANGER_SLOTS,
  hangerLayout,
  equippedHangers,
  squadStand,
  squadStandPoints,
  petWander,
} from "../src/scenes/homeRoom.ts";
import { createFreshSave, type HeroSave } from "../src/core/save.ts";
import { ITEM_CATALOG } from "../src/data/items.ts";

const W = 960,
  H = 540;

function equip(save: HeroSave, slot: string, defId: string, instId: string): void {
  save.inventory.items.push({ id: instId, defId } as never);
  (save.inventory.equipped as Record<string, string>)[slot] = instId;
}

describe("homeRoom hangers", () => {
  it("exposes the 9 non-pet slots, pet excluded", () => {
    expect(HANGER_SLOTS).toHaveLength(9);
    expect(HANGER_SLOTS).not.toContain("Pet");
    expect(HANGER_SLOTS).toContain("Weapon");
    expect(HANGER_SLOTS).toContain("Wing");
  });

  it("lays out one cell per slot, split across two side walls inside the menu columns", () => {
    const cells = hangerLayout(W, H);
    expect(cells).toHaveLength(HANGER_SLOTS.length);
    const xs = new Set(cells.map((c) => c.x));
    expect(xs.size).toBe(2); // exactly two wall columns
    for (const c of cells) {
      expect(c.x).toBeGreaterThan(60); // clear of the left edge buttons (x≈46)
      expect(c.x).toBeLessThan(W - 60); // clear of the right edge buttons (x≈914)
      expect(c.y).toBeGreaterThan(0);
      expect(c.y).toBeLessThan(H);
    }
  });

  it("pairs equipped items to hangers and leaves empty pegs as null", () => {
    const save = createFreshSave();
    const some = ITEM_CATALOG.find((d) => d.slot === "Weapon")!;
    equip(save, "Weapon", some.id, "inst-w");
    const hangers = equippedHangers(save.inventory);
    expect(hangers).toHaveLength(HANGER_SLOTS.length);
    const w = hangers[HANGER_SLOTS.indexOf("Weapon")];
    expect(w).not.toBeNull();
    expect(w!.iconKey).toBe(`item__${some.id}`);
    // an unequipped slot is a null (empty peg)
    expect(hangers[HANGER_SLOTS.indexOf("Boots")]).toBeNull();
  });
});

describe("homeRoom squad", () => {
  it("uses save.squad with NO owned fallback and flags Set Squad when empty", () => {
    const save = createFreshSave();
    save.squad = [];
    save.collection = { "some-tower": { level: 1 } } as never; // owned but not in squad
    const empty = squadStand(save);
    expect(empty.members).toEqual([]);
    expect(empty.showSetSquad).toBe(true);

    save.squad = ["a", "b", "c"];
    const filled = squadStand(save);
    expect(filled.members).toEqual(["a", "b", "c"]);
    expect(filled.showSetSquad).toBe(false);
  });

  it("places n stand points on the stage within screen bounds", () => {
    for (const n of [1, 4, 7]) {
      const pts = squadStandPoints(n, W, H);
      expect(pts).toHaveLength(n);
      for (const p of pts) {
        expect(p.x).toBeGreaterThan(0);
        expect(p.x).toBeLessThan(W);
        expect(p.y).toBeGreaterThan(H * 0.5); // mid/lower stage, above the bottom dock
        expect(p.y).toBeLessThan(H);
      }
    }
  });
});

describe("homeRoom pet wander", () => {
  it("stays inside the box above the throne for a full period and flips facing", () => {
    let sawLeft = false,
      sawRight = false;
    for (let ms = 0; ms <= 20000; ms += 50) {
      const p = petWander(ms, W, H);
      expect(p.x).toBeGreaterThanOrEqual(W * 0.4 - 0.001);
      expect(p.x).toBeLessThanOrEqual(W * 0.6 + 0.001);
      expect(p.y).toBeGreaterThanOrEqual(H * 0.18 - 0.001);
      expect(p.y).toBeLessThanOrEqual(H * 0.34 + 0.001);
      if (p.faceLeft) sawLeft = true;
      else sawRight = true;
    }
    expect(sawLeft && sawRight).toBe(true);
  });
});
