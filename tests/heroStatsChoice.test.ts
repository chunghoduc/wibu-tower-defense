import { describe, it, expect } from "vitest";
import { createFreshSave } from "../src/core/save.ts";
import { resolveHeroBattleStats } from "../src/core/heroStats.ts";
import { defaultStats } from "../src/data/schemaStats.ts";

describe("nodeChoices reach hero stats", () => {
  it("option B (armorPen) differs from the default option A (critDamage)", () => {
    const base = { ...defaultStats(), atk: 100, maxHp: 1000 };

    const a = createFreshSave();
    a.hero.unlockedNodes = ["brawler-mastery-1"];
    a.hero.nodeChoices = {}; // default → first option (critDamage)

    const b = createFreshSave();
    b.hero.unlockedNodes = ["brawler-mastery-1"];
    b.hero.nodeChoices = { "brawler-mastery-1": "penetration" }; // armorPen

    const statsA = resolveHeroBattleStats(a, { ...base }).stats;
    const statsB = resolveHeroBattleStats(b, { ...base }).stats;

    expect(statsA.critDamage).toBeGreaterThan(statsB.critDamage);
    expect(statsB.armorPen).toBeGreaterThan(statsA.armorPen);
  });
});
