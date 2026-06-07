import { describe, expect, it } from "vitest";
import { TOWERS } from "../src/data/towers.ts";
import { augmentTowerStats } from "../src/data/towerStats.ts";
import { makeStats } from "../src/data/schema.ts";

describe("tower defensive/survival stats", () => {
  it("every tower has non-zero defensive stats (armor, magic resist, hp regen, tenacity)", () => {
    for (const t of TOWERS) {
      const s = t.baseStats;
      expect(s.armor, `${t.id} armor`).toBeGreaterThan(0);
      expect(s.magicResist, `${t.id} magicResist`).toBeGreaterThan(0);
      expect(s.hpRegen, `${t.id} hpRegen`).toBeGreaterThan(0);
      expect(s.tenacity, `${t.id} tenacity`).toBeGreaterThan(0);
    }
  });

  it("towers have NO move speed or gold find (static, non-looting)", () => {
    for (const t of TOWERS) {
      expect(t.baseStats.moveSpeed, `${t.id} moveSpeed`).toBe(0);
      expect(t.baseStats.goldFind, `${t.id} goldFind`).toBe(0);
    }
  });

  it("higher rarity yields more defense", () => {
    const common = augmentTowerStats("damage", "Common", makeStats({ maxHp: 100 }));
    const unique = augmentTowerStats("damage", "Unique", makeStats({ maxHp: 100 }));
    expect(unique.armor).toBeGreaterThan(common.armor);
    expect(unique.critDefense).toBeGreaterThan(common.critDefense);
  });

  it("does not overwrite a designer-set defensive value", () => {
    const s = augmentTowerStats("damage", "Common", makeStats({ maxHp: 100, armor: 99 }));
    expect(s.armor).toBe(99);
  });
});
