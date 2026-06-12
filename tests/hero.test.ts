import { describe, expect, it } from "vitest";
import {
  totalXpForLevel,
  levelFromTotalXp,
  xpToNextLevel,
  skillXpToLevel,
  skillEffectivePower,
  awardHeroXp,
  awardSkillUseXp,
} from "../src/core/hero.ts";
import { createFreshSave } from "../src/core/save.ts";

describe("totalXpForLevel", () => {
  it("level 1 requires 0 XP", () => {
    expect(totalXpForLevel(1)).toBe(0);
  });
  it("level 2 requires more than 0", () => {
    expect(totalXpForLevel(2)).toBeGreaterThan(0);
  });
  it("is monotonically increasing", () => {
    for (let n = 2; n <= 100; n++) {
      expect(totalXpForLevel(n)).toBeGreaterThan(totalXpForLevel(n - 1));
    }
  });
  it("rebalance: early levels (1-20) are cheaper than the base curve", () => {
    // Old curve threshold for L20 was floor(100 * 20^1.8) = 21962; the eased
    // curve must require meaningfully less to reach level 20.
    expect(totalXpForLevel(20)).toBeLessThan(21962);
  });
  it("rebalance: levels 21-39 cost the same per level as the base curve", () => {
    const baseInc = (L: number) =>
      Math.floor(100 * Math.pow(L, 1.8)) - Math.floor(100 * Math.pow(L - 1, 1.8));
    for (const L of [21, 30, 39]) {
      expect(totalXpForLevel(L) - totalXpForLevel(L - 1)).toBe(baseInc(L));
    }
  });
  it("rebalance: levels 40+ cost more per level than the base curve", () => {
    const baseInc = (L: number) =>
      Math.floor(100 * Math.pow(L, 1.8)) - Math.floor(100 * Math.pow(L - 1, 1.8));
    for (const L of [45, 60, 80]) {
      expect(totalXpForLevel(L) - totalXpForLevel(L - 1)).toBeGreaterThan(baseInc(L));
    }
  });
  it("level 91 increment is dramatically larger than level 90 increment", () => {
    const inc90 = totalXpForLevel(90) - totalXpForLevel(89);
    const inc91 = totalXpForLevel(91) - totalXpForLevel(90);
    expect(inc91).toBeGreaterThan(inc90 * 5);
  });
  it("level 100 is astronomically large", () => {
    expect(totalXpForLevel(100)).toBeGreaterThan(1_000_000_000);
  });
});

describe("levelFromTotalXp", () => {
  it("0 XP = level 1", () => {
    expect(levelFromTotalXp(0)).toBe(1);
  });
  it("round-trips with totalXpForLevel", () => {
    for (const lvl of [1, 10, 50, 89, 90, 91]) {
      expect(levelFromTotalXp(totalXpForLevel(lvl))).toBe(lvl);
    }
  });
  it("caps at 100", () => {
    expect(levelFromTotalXp(Number.MAX_SAFE_INTEGER)).toBe(100);
  });
});

describe("xpToNextLevel", () => {
  it("returns correct gap", () => {
    const currentXp = totalXpForLevel(10) + 50;
    const gap = xpToNextLevel(10, currentXp);
    expect(gap).toBe(totalXpForLevel(11) - currentXp);
  });
});

describe("skillXpToLevel", () => {
  it("level 1→2 costs 10 XP", () => {
    expect(skillXpToLevel(1)).toBe(10);
  });
  it("increases with skill level", () => {
    expect(skillXpToLevel(10)).toBeGreaterThan(skillXpToLevel(1));
  });
});

describe("skillEffectivePower", () => {
  it("level 1 = basePower × 1.05", () => {
    expect(skillEffectivePower(100, 1)).toBeCloseTo(105, 3);
  });
  it("increases with level", () => {
    expect(skillEffectivePower(100, 50)).toBeGreaterThan(skillEffectivePower(100, 10));
  });
});

describe("awardHeroXp", () => {
  it("adds XP and levels up hero", () => {
    const save = createFreshSave();
    awardHeroXp(save, totalXpForLevel(5));
    expect(save.hero.level).toBe(5);
    expect(save.hero.totalXp).toBe(totalXpForLevel(5));
  });
  it("awards skill points equal to levels gained", () => {
    const save = createFreshSave();
    awardHeroXp(save, totalXpForLevel(5));
    expect(save.hero.skillPoints).toBe(4); // levels 2,3,4,5 = 4 points
  });
  it("does not exceed level 100", () => {
    const save = createFreshSave();
    awardHeroXp(save, Number.MAX_SAFE_INTEGER);
    expect(save.hero.level).toBe(100);
  });
});

describe("awardSkillUseXp", () => {
  it("increments useXp and levels up skill when threshold reached", () => {
    const save = createFreshSave();
    save.hero.obtainedSkills.push({ skillId: "flame-wave", level: 1, useXp: 0 });
    save.hero.level = 10;
    for (let i = 0; i < 10; i++) awardSkillUseXp(save, "flame-wave");
    const entry = save.hero.obtainedSkills[0];
    expect(entry.level).toBe(2);
    expect(entry.useXp).toBe(0);
  });
  it("does not level skill beyond hero level", () => {
    const save = createFreshSave();
    save.hero.level = 1;
    save.hero.obtainedSkills.push({ skillId: "s", level: 1, useXp: 0 });
    for (let i = 0; i < 100; i++) awardSkillUseXp(save, "s");
    expect(save.hero.obtainedSkills[0].level).toBe(1);
  });
});
