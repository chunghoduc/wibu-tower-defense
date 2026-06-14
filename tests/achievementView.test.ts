import { describe, expect, it } from "vitest";
import { buildAchievementView } from "../src/core/achievementView.ts";
import { ACHIEVEMENTS, CATEGORY_ORDER } from "../src/data/achievements.ts";
import { createFreshSave } from "../src/core/save.ts";

describe("buildAchievementView", () => {
  it("covers every achievement exactly once across groups", () => {
    const view = buildAchievementView(createFreshSave());
    const cards = view.groups.flatMap((g) => g.cards);
    expect(cards).toHaveLength(ACHIEVEMENTS.length);
    expect(new Set(cards.map((c) => c.id)).size).toBe(ACHIEVEMENTS.length);
  });

  it("orders groups by CATEGORY_ORDER and omits empty categories", () => {
    const view = buildAchievementView(createFreshSave());
    const order = view.groups.map((g) => g.category);
    const expected = CATEGORY_ORDER.filter((c) => order.includes(c));
    expect(order).toEqual(expected);
  });

  it("derives unlocked + clamps frac to 0..1", () => {
    const save = createFreshSave();
    save.progress.totalTowersPlaced = 75;
    const view = buildAchievementView(save);
    const cards = view.groups.flatMap((g) => g.cards);
    const done = cards.find((c) => c.id === "place-50-towers")!;
    const partial = cards.find((c) => c.id === "place-500-towers")!;
    expect(done.unlocked).toBe(true);
    expect(done.frac).toBe(1);
    expect(partial.unlocked).toBe(false);
    expect(partial.frac).toBeCloseTo(75 / 500, 5);
  });

  it("counts unlocked totals", () => {
    const save = createFreshSave();
    save.hero.level = 10;
    const view = buildAchievementView(save);
    expect(view.total).toBe(ACHIEVEMENTS.length);
    expect(view.unlocked).toBeGreaterThanOrEqual(1);
    expect(view.unlocked).toBeLessThan(view.total);
  });
});
