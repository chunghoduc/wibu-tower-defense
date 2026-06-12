import { describe, it, expect } from "vitest";
import { bossSkillSignature, bossSkillTheme } from "../src/data/bossSkillVfx.ts";
import { ANTIHERO_BOSSES } from "../src/data/enemiesAntiheroes.ts";

describe("bossSkillSignature", () => {
  it("maps each known skill type to its own named signature", () => {
    expect(bossSkillSignature("quake").signature).toBe("quake");
    expect(bossSkillSignature("rally").signature).toBe("rally");
    expect(bossSkillSignature("barrier").signature).toBe("barrier");
    expect(bossSkillSignature("summon-surge").signature).toBe("summon-surge");
  });

  it("gives each signature a distinct theme color", () => {
    const colors = ["quake", "rally", "barrier", "summon-surge"].map(
      (s) => bossSkillSignature(s).color,
    );
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

describe("bossSkillTheme", () => {
  it("keeps the signature's base hue as the primary anchor for every element", () => {
    for (const el of ["Physical", "Magic", "True"] as const) {
      expect(bossSkillTheme("quake", el).primary).toBe(bossSkillSignature("quake").color);
    }
  });

  it("gives the same signature a distinct accent per element", () => {
    const accents = (["Physical", "Magic", "True"] as const).map(
      (el) => bossSkillTheme("quake", el).accent,
    );
    expect(new Set(accents).size).toBe(3);
  });

  it("assigns every known signature AND the fallback a defined camera weight", () => {
    for (const s of ["quake", "rally", "barrier", "summon-surge", "nonsense"]) {
      const w = bossSkillTheme(s, "Physical").weight;
      expect(w).toBeGreaterThan(0);
      expect(w).toBeLessThanOrEqual(1);
    }
  });

  it("makes the quake heavier than the barrier (weight ordering)", () => {
    expect(bossSkillTheme("quake", "Physical").weight).toBeGreaterThan(
      bossSkillTheme("barrier", "Physical").weight,
    );
  });

  it("carries the signature kind and label through from the base spec", () => {
    expect(bossSkillTheme("rally", "Magic").signature).toBe("rally");
    expect(bossSkillTheme("rally", "Magic").label).toBe(bossSkillSignature("rally").label);
  });
});
