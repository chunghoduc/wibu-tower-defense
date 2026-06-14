import { describe, expect, it } from "vitest";
import { ACTIVE_SKILLS } from "../src/data/skills.ts";
import { skillMotif, motifForShape } from "../src/data/skillMotif.ts";
import { NO_MOTIF, type MotifKind } from "../src/data/skillVfxMeta.ts";
import { SKILL_SHAPES } from "../src/data/attackStyle.ts";

const KINDS: MotifKind[] = ["arrow", "bolt", "bullet", "orb", "blade", "none"];

describe("skill motif — literal projectile per skill", () => {
  it("fires three arrows in a fan for tri-shot (the headline case)", () => {
    expect(skillMotif("tri-shot")).toEqual({ kind: "arrow", count: 3, spread: "fan" });
  });

  it("streams five bullets for rapid-fire", () => {
    expect(skillMotif("rapid-fire")).toEqual({ kind: "bullet", count: 5, spread: "stream" });
  });

  it("sends a single piercing arrow down a line", () => {
    expect(skillMotif("piercing-arrow")).toEqual({ kind: "arrow", count: 1, spread: "pierce" });
  });

  it("fires one heavy round for concussion-round", () => {
    const m = skillMotif("concussion-round");
    expect(m.kind).toBe("bullet");
    expect(m.count).toBe(1);
  });

  it("hurls a single orb for spirit-bolt and mana-burst", () => {
    expect(skillMotif("spirit-bolt").kind).toBe("orb");
    expect(skillMotif("spirit-bolt").count).toBe(1);
    expect(skillMotif("mana-burst").kind).toBe("orb");
  });

  it("fires nothing (none) for melee / area / curse / sky skills", () => {
    for (const id of [
      "valiant-strike",
      "iron-cleave",
      "stone-bash",
      "execute-slash",
      "arcane-nova",
      "shadow-curse",
      "true-strike",
      "void-palm",
    ]) {
      expect(skillMotif(id).kind, `${id} should fire no projectile`).toBe("none");
    }
  });

  it("resolves a known motif kind for every active skill", () => {
    for (const s of ACTIVE_SKILLS) {
      const m = skillMotif(s.id);
      expect(KINDS, `${s.id}.kind`).toContain(m.kind);
      expect(m.count, `${s.id}.count`).toBeGreaterThanOrEqual(0);
    }
  });

  it("returns NO_MOTIF for unknown ids", () => {
    expect(skillMotif("not-a-real-skill")).toEqual(NO_MOTIF);
    expect(skillMotif(undefined)).toEqual(NO_MOTIF);
  });
});

describe("tower-shape motif derivation", () => {
  it("derives a literal motif from each projectile shape", () => {
    expect(motifForShape("barrage").kind).toBe("bullet");
    expect(motifForShape("barrage").spread).toBe("stream");
    expect(motifForShape("bolt")).toEqual({ kind: "orb", count: 1, spread: "single" });
    expect(motifForShape("chain").kind).toBe("orb");
    expect(motifForShape("chain").count).toBeGreaterThan(1);
    expect(motifForShape("beam").kind).toBe("bolt");
    expect(motifForShape("beam").spread).toBe("pierce");
  });

  it("fires no projectile for area shapes (nova/slam/cloud/aura)", () => {
    for (const shape of ["nova", "slam", "cloud", "aura"] as const) {
      expect(motifForShape(shape).kind, shape).toBe("none");
    }
  });

  it("maps every SkillShape to a defined motif", () => {
    for (const shape of SKILL_SHAPES) {
      expect(KINDS).toContain(motifForShape(shape).kind);
    }
  });
});
