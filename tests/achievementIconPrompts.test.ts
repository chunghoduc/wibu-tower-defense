import { describe, it, expect } from "vitest";
import { ACHIEVEMENTS } from "../src/data/achievements.ts";
import { achievementTex } from "../src/data/assetKeys.ts";
import { ACHIEVEMENT_VISUAL } from "../scripts/sdart/prompts.mjs";

const ids = ACHIEVEMENTS.map((a) => a.id);

describe("achievement-icon medallion prompts", () => {
  it("defines exactly one emblem per achievement (none missing, none dead)", () => {
    expect(Object.keys(ACHIEVEMENT_VISUAL).sort()).toEqual([...ids].sort());
  });

  it("gives every achievement a non-empty emblem description", () => {
    for (const id of ids) {
      const v = (ACHIEVEMENT_VISUAL as Record<string, string>)[id];
      expect(typeof v).toBe("string");
      expect(v.trim().length).toBeGreaterThan(0);
    }
  });

  it("uses a distinct emblem description for every achievement", () => {
    const values = ids.map((id) => (ACHIEVEMENT_VISUAL as Record<string, string>)[id]);
    expect(new Set(values).size).toBe(ids.length);
  });
});

describe("achievementTex key builder", () => {
  it("namespaces every achievement id under achievement__", () => {
    for (const id of ids) expect(achievementTex(id)).toBe(`achievement__${id}`);
  });
});
