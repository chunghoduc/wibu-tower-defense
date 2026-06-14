import { describe, it, expect } from "vitest";
import { ACHIEVEMENTS } from "../src/data/achievements.ts";
import { achievementTex } from "../src/data/assetKeys.ts";
import { ACHIEVEMENT_VISUAL, achievementIconStyle } from "../scripts/sdart/prompts.mjs";

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

describe("achievement-icon house style", () => {
  const sample = achievementIconStyle("a gold medal of a star");

  it("uses the house cel-shaded game-asset language", () => {
    expect(sample).toContain("cel-shaded anime game asset");
    expect(sample).toContain("soft rim light");
  });

  it("drops the flat-clipart UI-badge framing", () => {
    expect(sample).not.toContain("flat cel-shaded game UI icon");
    expect(sample).not.toContain("trophy medal badge");
    expect(sample).not.toContain("ribbon tab");
  });
});
