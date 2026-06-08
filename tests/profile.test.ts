import { describe, expect, it } from "vitest";
import { createFreshSave } from "../src/core/save.ts";
import { powerRating, collectionPct, setTitle, profileSummary } from "../src/core/profile.ts";
import { claimMilestone } from "../src/core/milestones.ts";
import { MILESTONES_MAP } from "../src/data/milestones.ts";

describe("F16 profile / power / titles", () => {
  it("power rating is monotonic in progress", () => {
    const s = createFreshSave();
    const base = powerRating(s);
    s.hero.level += 10;
    const afterLevel = powerRating(s);
    expect(afterLevel).toBeGreaterThan(base);
    s.collection["yamo"] = { stars: 3, copies: 0 };
    expect(powerRating(s)).toBeGreaterThan(afterLevel);
    s.meta.awakening["yamo"] = 2;
    expect(powerRating(s)).toBeGreaterThan(powerRating({ ...s, meta: { ...s.meta, awakening: {} } } as typeof s));
  });

  it("collection pct is a 0..1 fraction", () => {
    const s = createFreshSave();
    s.collection = { a: { stars: 1, copies: 0 } };
    const pct = collectionPct(s);
    expect(pct).toBeGreaterThan(0);
    expect(pct).toBeLessThanOrEqual(1);
  });

  it("setTitle refuses a locked title, accepts an unlocked one, and clears", () => {
    const s = createFreshSave();
    const def = MILESTONES_MAP.get("conqueror")!;
    const title = def.tiers[1].title!;
    expect(setTitle(s, title)).toBe(false); // not yet unlocked
    s.meta.profile.lifetimeClears = def.tiers[1].target;
    claimMilestone(s, "conqueror");
    claimMilestone(s, "conqueror");
    expect(setTitle(s, title)).toBe(true);
    expect(s.meta.profile.titleId).toBe(title);
    expect(setTitle(s, "")).toBe(true);
    expect(s.meta.profile.titleId).toBe("");
  });

  it("profileSummary reflects current state", () => {
    const s = createFreshSave();
    s.hero.level = 12;
    s.meta.endless.bestWave["stage-1"] = 18;
    const sum = profileSummary(s);
    expect(sum.heroLevel).toBe(12);
    expect(sum.bestEndlessWave).toBe(18);
    expect(sum.power).toBe(powerRating(s));
  });
});
