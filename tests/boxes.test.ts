import { describe, expect, it } from "vitest";
import { openBox, tierOfBox, boxOddsText, boxRarityOdds } from "../src/core/boxes.ts";
import {
  boxIdForTier, boxRarityName, MATERIALS_MAP,
  SOUL_JEWEL, SUMMON_SCROLL, OBLIVION_ORB, AWAKENING_CRYSTAL,
} from "../src/data/materials.ts";
import { ITEM_CATALOG_MAP } from "../src/data/items.ts";
import { processStageClear } from "../src/core/drops.ts";
import { boxTierForStage } from "../src/data/stage.ts";
import { createFreshSave } from "../src/core/save.ts";
import { Rng } from "../src/core/rng.ts";

describe("T15 — boss loot boxes", () => {
  it("maps stages to escalating box tiers", () => {
    expect(boxTierForStage("ch1-s1")).toBe(1);
    expect(boxTierForStage("ch1-s2")).toBe(1);
    expect(boxTierForStage("ch1-s3")).toBe(2);
    expect(boxTierForStage("ch1-s10")).toBe(5);
    expect(tierOfBox(boxIdForTier(4))).toBe(4);
  });

  it("a stage clear guarantees a boss chest of the stage's tier", () => {
    const save = createFreshSave();
    const r = processStageClear(save, "ch1-s5", "Normal", new Rng(1));
    const boxId = boxIdForTier(boxTierForStage("ch1-s5"));
    expect(r.materialsDropped[boxId]).toBe(1);
    expect(save.materials[boxId]).toBe(1);
  });

  it("opening a box consumes it and grants crystals + bless jewels", () => {
    const save = createFreshSave();
    const boxId = boxIdForTier(3);
    save.materials[boxId] = 1;
    const crystals0 = save.currency.gold;
    const r = openBox(save, boxId, new Rng(7));
    expect(r.opened).toBe(true);
    expect(save.materials[boxId]).toBe(0);
    expect(r.crystals).toBeGreaterThan(0);
    expect(save.currency.gold).toBe(crystals0 + r.crystals);
    expect((r.materials["bless-jewel"] ?? 0)).toBeGreaterThanOrEqual(1);
  });

  it("opening with no box returns opened:false and changes nothing", () => {
    const save = createFreshSave();
    const r = openBox(save, boxIdForTier(1), new Rng(1));
    expect(r.opened).toBe(false);
    expect(save.currency.gold).toBe(0);
  });

  it("higher tiers grant more crystals on average", () => {
    const avg = (tier: number) => {
      let total = 0;
      for (let s = 1; s <= 40; s++) {
        const save = createFreshSave();
        const id = boxIdForTier(tier);
        save.materials[id] = 1;
        total += openBox(save, id, new Rng(s)).crystals;
      }
      return total / 40;
    };
    expect(avg(5)).toBeGreaterThan(avg(1) * 2);
  });

  it("grants diamonds scaled by tier, added to the wallet", () => {
    const avg = (tier: number) => {
      let total = 0;
      for (let s = 1; s <= 60; s++) {
        const save = createFreshSave();
        const id = boxIdForTier(tier);
        save.materials[id] = 1;
        const d0 = save.currency.diamonds;
        const r = openBox(save, id, new Rng(s * 7 + tier));
        expect(r.diamonds).toBeGreaterThan(0);
        expect(save.currency.diamonds).toBe(d0 + r.diamonds);
        total += r.diamonds;
      }
      return total / 60;
    };
    // Higher rarity (tier) ⇒ strictly more diamonds on average.
    expect(avg(5)).toBeGreaterThan(avg(3));
    expect(avg(3)).toBeGreaterThan(avg(1));
    expect(avg(5)).toBeGreaterThan(avg(1) * 2);
  });

  it("drops bonus crafting materials (soul/scroll/orb) at tier-scaled rates, into the wallet", () => {
    const N = 400;
    // Fraction of opens that yielded ≥1 of `mat`, and asserts the reward report
    // matches exactly what landed in save.materials.
    const rate = (tier: number, mat: string) => {
      let hits = 0;
      for (let s = 1; s <= N; s++) {
        const save = createFreshSave();
        const id = boxIdForTier(tier);
        save.materials[id] = 1;
        const before = save.materials[mat] ?? 0;
        const got = openBox(save, id, new Rng(s * 101 + tier * 7)).materials[mat] ?? 0;
        expect(save.materials[mat] ?? 0).toBe(before + got);
        if (got > 0) hits++;
      }
      return hits / N;
    };

    // Soul & Orb drop at every tier and climb monotonically (stronger boss = better).
    for (const mat of [SOUL_JEWEL, OBLIVION_ORB]) {
      expect(rate(1, mat)).toBeGreaterThan(0);
      expect(rate(3, mat)).toBeGreaterThan(rate(1, mat));
      expect(rate(5, mat)).toBeGreaterThan(rate(3, mat));
    }
    // Summoning Scroll is a high-tier treat: absent on tier 1, present and rising above.
    expect(rate(1, SUMMON_SCROLL)).toBe(0);
    expect(rate(2, SUMMON_SCROLL)).toBeGreaterThan(0);
    expect(rate(5, SUMMON_SCROLL)).toBeGreaterThan(rate(2, SUMMON_SCROLL));

    // Awakening Crystal is deliberately NOT a box drop (aspirational late-game sink).
    for (let tier = 1; tier <= 5; tier++) {
      let total = 0;
      for (let s = 1; s <= N; s++) {
        const save = createFreshSave();
        const id = boxIdForTier(tier);
        save.materials[id] = 1;
        total += openBox(save, id, new Rng(s * 53 + tier)).materials[AWAKENING_CRYSTAL] ?? 0;
      }
      expect(total).toBe(0);
    }
  });

  it("gear level tracks the hero's level, not the box tier", () => {
    // Same hero level, different tiers ⇒ same level band (tier no longer drives level).
    const band = (tier: number) => {
      const levels: number[] = [];
      for (let s = 1; s <= 120; s++) {
        const save = createFreshSave();
        save.hero.level = 60;
        const id = boxIdForTier(tier);
        save.materials[id] = 1;
        for (const item of openBox(save, id, new Rng(s * 31 + 7)).items) levels.push(item.requiredLevel!);
      }
      return levels;
    };
    const lo = Math.round(60 * 0.85), hi = Math.round(60 * 1.15); // ±15% around hero level
    const t1 = band(1), t5 = band(5);
    for (const lvl of [...t1, ...t5]) {
      expect(lvl).toBeGreaterThanOrEqual(lo);
      expect(lvl).toBeLessThanOrEqual(hi);
    }
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(Math.abs(avg(t1) - avg(t5))).toBeLessThan(4); // tier doesn't shift the level band
  });

  it("rolls gear rarity within one step of the box rarity, weighted to the lower side", () => {
    // Hero high enough to equip any rarity, so rarity is the only variable.
    const counts: Record<string, number> = {};
    for (let s = 1; s <= 600; s++) {
      const save = createFreshSave();
      save.hero.level = 90;
      save.materials[boxIdForTier(3)] = 1; // Rare box
      for (const item of openBox(save, boxIdForTier(3), new Rng(s * 13 + 1)).items) {
        const def = ITEM_CATALOG_MAP.get(item.defId)!;
        counts[def.rarity] = (counts[def.rarity] ?? 0) + 1;
      }
    }
    // Rare box ⇒ only Magic / Rare / Legendary, never Common or Unique.
    expect(counts["Common"] ?? 0).toBe(0);
    expect(counts["Unique"] ?? 0).toBe(0);
    // Lower rarity is most common: Magic > Rare > Legendary.
    expect(counts["Magic"]).toBeGreaterThan(counts["Rare"]);
    expect(counts["Rare"]).toBeGreaterThan(counts["Legendary"]);
    expect(counts["Legendary"]).toBeGreaterThan(0);
  });

  it("gives a low-level hero the box's true rarity at their own level (a level-8 Unique)", () => {
    // Rarity and level are orthogonal: a rookie opening a Unique box gets a
    // real Unique, just scaled to level 8 — NOT degraded to a lower rarity.
    const heroLevel = 8;
    const lo = Math.round(heroLevel * 0.85), hi = Math.round(heroLevel * 1.15);
    const counts: Record<string, number> = {};
    let seen = 0;
    for (let s = 1; s <= 300; s++) {
      const save = createFreshSave();
      save.hero.level = heroLevel;
      save.materials[boxIdForTier(5)] = 1; // Unique box
      for (const item of openBox(save, boxIdForTier(5), new Rng(s * 17 + 2)).items) {
        seen++;
        const def = ITEM_CATALOG_MAP.get(item.defId)!;
        expect(item.requiredLevel!).toBeGreaterThanOrEqual(lo); // level tracks the hero...
        expect(item.requiredLevel!).toBeLessThanOrEqual(hi);
        counts[def.rarity] = (counts[def.rarity] ?? 0) + 1;
      }
    }
    expect(seen).toBeGreaterThan(0);
    // ...rarity tracks the box: Unique box ⇒ only its band (Legendary/Unique).
    expect((counts["Legendary"] ?? 0) + (counts["Unique"] ?? 0)).toBe(seen);
    expect(counts["Unique"]).toBeGreaterThan(0); // a level-8 Unique really drops
  });

  it("drops the configured number of independent gear rolls per tier", () => {
    // Each tier rolls a fixed list of independent gear chances (each its own
    // rarity + level roll). tier1: [0.6]; tier2: [0.8,0.4]; tier3: [1,0.5,0.1];
    // tier4: [1,0.6,0.4]; tier5: [1,0.8,0.6].
    const sample = (tier: number) => {
      const lengths: number[] = [];
      for (let s = 1; s <= 600; s++) {
        const save = createFreshSave();
        save.hero.level = 50;
        const id = boxIdForTier(tier);
        save.materials[id] = 1;
        const r = openBox(save, id, new Rng(s * 23 + tier));
        lengths.push(r.items.length);
        // every returned item is also pushed to the inventory
        expect(save.inventory.items.length).toBe(r.items.length);
      }
      const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
      return { avg, max: Math.max(...lengths), min: Math.min(...lengths) };
    };

    const t1 = sample(1);
    expect(t1.max).toBe(1); // at most one roll
    expect(t1.min).toBe(0); // 60% ⇒ sometimes empty
    expect(t1.avg).toBeCloseTo(0.6, 1);

    const t3 = sample(3);
    expect(t3.max).toBe(3);
    expect(t3.min).toBe(1); // first roll is guaranteed (100%)
    expect(t3.avg).toBeCloseTo(1.0 + 0.5 + 0.1, 1);

    const t5 = sample(5);
    expect(t5.max).toBe(3);
    expect(t5.min).toBe(1); // first roll guaranteed
    expect(t5.avg).toBeCloseTo(1.0 + 0.8 + 0.6, 1);
  });

  it("boxRarityOdds gives a ±1 band weighted to the lower rarity, summing to 1", () => {
    const odds = (tier: number) =>
      Object.fromEntries(boxRarityOdds(tier).map((o) => [o.rarity, o.chance]));
    const rare = odds(3); // Rare box
    expect(rare).toEqual({ Magic: 0.6, Rare: 0.35, Legendary: 0.05 });
    expect(odds(1)).toEqual({ Common: 0.95, Magic: 0.05 }); // Common box folds "below" inward
    expect(odds(5)).toEqual({ Legendary: 0.6, Unique: 0.4 }); // Unique box folds "above" inward
    for (let t = 1; t <= 5; t++) {
      const sum = boxRarityOdds(t).reduce((a, o) => a + o.chance, 0);
      expect(sum).toBeCloseTo(1, 6);
    }
  });

  it("boxOddsText lists guaranteed drops, soul rate, and the gear rarity odds", () => {
    const text = boxOddsText(boxIdForTier(3));
    expect(text).toContain("Opening odds:");
    expect(text).toMatch(/Bless Jewel \(guaranteed\)/);
    expect(text).toMatch(/\d+ diamonds?/); // diamonds shown in the guaranteed line
    expect(text).toMatch(/\d+% Jewel of Soul/); // bonus materials listed by name
    expect(text).toMatch(/\d+% Summoning Scroll/);
    expect(text).toMatch(/\d+% Oblivion Orb/);
    expect(text).toMatch(/gear drops \(each scaled to your level\)/);
    expect(text).toMatch(/100% · 50% · 10% gear drops/); // tier-3 rolls 3 independent gears
    // Rarity odds shown so the tooltip matches what actually drops.
    expect(text).toMatch(/60% Magic/);
    expect(text).toMatch(/35% Rare/);
    expect(text).toMatch(/5% Legendary/);
  });

  it("names each box tier by its rarity and tags the def with that rarity", () => {
    expect(boxRarityName(1)).toBe("Common");
    expect(boxRarityName(5)).toBe("Unique");
    for (let t = 1; t <= 5; t++) {
      const def = MATERIALS_MAP.get(boxIdForTier(t))!;
      expect(def.rarity).toBe(t);
      expect(def.name).toContain(boxRarityName(t));
    }
  });
});
