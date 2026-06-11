import { describe, it, expect } from "vitest";
import { bossSkillSignature } from "../src/data/bossSkillVfx.ts";
import { ANTIHERO_BOSSES } from "../src/data/enemiesAntiheroes.ts";

describe("bossSkillSignature", () => {
  it("maps each known skill type to its own named signature", () => {
    expect(bossSkillSignature("quake").signature).toBe("quake");
    expect(bossSkillSignature("rally").signature).toBe("rally");
    expect(bossSkillSignature("barrier").signature).toBe("barrier");
    expect(bossSkillSignature("summon-surge").signature).toBe("summon-surge");
  });

  it("gives each signature a distinct theme color", () => {
    const colors = ["quake", "rally", "barrier", "summon-surge"].map((s) => bossSkillSignature(s).color);
    expect(new Set(colors).size).toBe(4);
  });

  it("falls back to the generic ring for an unknown type", () => {
    expect(bossSkillSignature("nonsense").signature).toBe("ring");
  });

  it("every Antihero boss's skill resolves to a real (non-ring) signature", () => {
    for (const b of ANTIHERO_BOSSES) {
      if (!b.boss?.skill) continue;
      const sig = bossSkillSignature(b.boss.skill.type);
      expect(sig.signature, b.id).not.toBe("ring");
    }
  });
});
