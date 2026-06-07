import { describe, expect, it } from "vitest";
import { createFreshSave } from "../src/core/save.ts";
import { rollJewelDrop } from "../src/core/jewelDrop.ts";
import { JEWEL_CATALOG_MAP } from "../src/data/jewels.ts";
import { Rng } from "../src/core/rng.ts";

describe("rollJewelDrop", () => {
  it("grants a valid owned jewel and returns the instance", () => {
    const save = createFreshSave();
    const inst = rollJewelDrop(save, new Rng(1));
    expect(inst).not.toBeNull();
    expect(JEWEL_CATALOG_MAP.has(inst!.defId)).toBe(true);
    expect(save.hero.jewels).toContainEqual(inst);
  });

  it("is deterministic for the same seed", () => {
    const a = rollJewelDrop(createFreshSave(), new Rng(777));
    const b = rollJewelDrop(createFreshSave(), new Rng(777));
    expect(a!.defId).toBe(b!.defId);
  });

  it("weights commons above uniques (uniques are the rare prize)", () => {
    const counts: Record<string, number> = {};
    const rng = new Rng(42);
    for (let i = 0; i < 2000; i++) {
      const inst = rollJewelDrop(createFreshSave(), rng);
      const rarity = JEWEL_CATALOG_MAP.get(inst!.defId)!.rarity;
      counts[rarity] = (counts[rarity] ?? 0) + 1;
    }
    expect(counts.Common ?? 0).toBeGreaterThan(counts.Unique ?? 0);
  });
});
