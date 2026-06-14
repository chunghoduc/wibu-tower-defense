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

  it("staggers n stand points clear of the hangers, each other, and the dock", () => {
    const cells = hangerLayout(W, H);
    const leftX = Math.min(...cells.map((c) => c.x));
    const rightX = Math.max(...cells.map((c) => c.x));
    const HALF = 27; // sprite half-width at the rendered 54px height
    const HANGER_HALF = 17; // ~34px gear icon half-width
    for (const n of [1, 2, 4, 7]) {
      const pts = squadStandPoints(n, W, H);
      expect(pts).toHaveLength(n);
      // x order is left → right, members never overlap
      for (let i = 1; i < n; i++) {
        expect(pts[i].x - pts[i - 1].x).toBeGreaterThanOrEqual(54);
      }
      for (const p of pts) {
        // clears both wall hanger columns
        expect(p.x - HALF).toBeGreaterThan(leftX + HANGER_HALF);
        expect(p.x + HALF).toBeLessThan(rightX - HANGER_HALF);
        // mid/lower stage, above the bottom dock band
        expect(p.y).toBeGreaterThan(H * 0.5);
        expect(p.y).toBeLessThan(H * 0.62);
        // perspective scale stays in the staged range
        expect(p.scale).toBeGreaterThanOrEqual(0.85 - 1e-9);
        expect(p.scale).toBeLessThanOrEqual(1 + 1e-9);
      }
    }
    // odd squads: the centre member is the closest (largest) one
    const odd = squadStandPoints(7, W, H);
    expect(odd[3].scale).toBeCloseTo(1, 5);
    expect(odd[3].scale).toBeGreaterThan(odd[0].scale);
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
