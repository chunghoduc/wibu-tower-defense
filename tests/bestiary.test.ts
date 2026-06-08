import { describe, expect, it } from "vitest";
import { createFreshSave } from "../src/core/save.ts";
import { recordKill, bestiaryKills, bestiaryDamageMul, bestiaryTier, BESTIARY_TIERS } from "../src/core/bestiary.ts";

describe("F9 bestiary", () => {
  it("records kills per archetype and bumps lifetime kills", () => {
    const s = createFreshSave();
    recordKill(s, "Rusher");
    recordKill(s, "Rusher");
    recordKill(s, "Brute");
    expect(bestiaryKills(s, "Rusher")).toBe(2);
    expect(bestiaryKills(s, "Brute")).toBe(1);
    expect(s.meta.profile.lifetimeKills).toBe(3);
  });

  it("no bonus below the first threshold", () => {
    const s = createFreshSave();
    for (let i = 0; i < BESTIARY_TIERS[0].kills - 1; i++) recordKill(s, "Rusher");
    expect(bestiaryDamageMul(s, "Rusher")).toBe(1);
    expect(bestiaryTier(s, "Rusher")).toBe(0);
  });

  it("crossing thresholds grants the cumulative damage bonus", () => {
    const s = createFreshSave();
    s.meta.bestiary["Rusher"] = BESTIARY_TIERS[0].kills;
    expect(bestiaryDamageMul(s, "Rusher")).toBeCloseTo(1 + BESTIARY_TIERS[0].bonus, 5);
    expect(bestiaryTier(s, "Rusher")).toBe(1);
    s.meta.bestiary["Rusher"] = BESTIARY_TIERS[2].kills;
    expect(bestiaryDamageMul(s, "Rusher")).toBeCloseTo(1 + BESTIARY_TIERS[2].bonus, 5);
    expect(bestiaryTier(s, "Rusher")).toBe(3);
  });
});
