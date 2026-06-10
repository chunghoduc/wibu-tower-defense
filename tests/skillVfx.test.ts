import { describe, expect, it } from "vitest";
import { ACTIVE_SKILLS } from "../src/data/skills.ts";
import { SKILL_VFX, skillVfxSpec } from "../src/data/skillVfxMeta.ts";
import { BattleState, MANA_MAX } from "../src/core/battle.ts";
import { createFreshSave } from "../src/core/save.ts";
import { makeStats } from "../src/data/schema.ts";
import { mkEnemy, mkStage, oneWave } from "./fixtures.ts";

// NOTE: renderer coverage (every `signature` has a draw function) is enforced at
// COMPILE TIME by the `Record<SkillSignature, SigFn>` in skillSignatures.ts, so
// these runtime tests only need to guard the data side + the cast plumbing.

describe("skill VFX metadata", () => {
  it("gives every active skill a unique signature set-piece", () => {
    const sigs = ACTIVE_SKILLS.map((s) => {
      const spec = SKILL_VFX[s.id];
      expect(spec, `missing SKILL_VFX entry for "${s.id}"`).toBeTruthy();
      return spec.signature;
    });
    expect(new Set(sigs).size).toBe(ACTIVE_SKILLS.length); // all distinct
  });

  it("has no orphan VFX entries (1:1 with ACTIVE_SKILLS)", () => {
    const ids = new Set(ACTIVE_SKILLS.map((s) => s.id));
    for (const id of Object.keys(SKILL_VFX)) expect(ids.has(id), `orphan "${id}"`).toBe(true);
    expect(Object.keys(SKILL_VFX).length).toBe(ACTIVE_SKILLS.length);
  });

  it("describes the look of each skill with a distinct, non-trivial appearance", () => {
    const seen = new Set<string>();
    for (const s of ACTIVE_SKILLS) {
      const { appearance } = SKILL_VFX[s.id];
      expect(appearance.length, `appearance for "${s.id}" too short`).toBeGreaterThan(40);
      expect(seen.has(appearance), `duplicate appearance for "${s.id}"`).toBe(false);
      seen.add(appearance);
    }
  });

  it("gives every skill a full 3-colour palette", () => {
    for (const s of ACTIVE_SKILLS) {
      const { palette } = SKILL_VFX[s.id];
      for (const k of ["core", "hot", "deep"] as const) {
        expect(typeof palette[k], `${s.id}.${k}`).toBe("number");
      }
    }
  });

  it("skillVfxSpec resolves hero skills and ignores everything else", () => {
    expect(skillVfxSpec("spirit-bolt")?.signature).toBe("spirit-comet");
    expect(skillVfxSpec(undefined)).toBeUndefined();
    expect(skillVfxSpec("not-a-skill")).toBeUndefined();
    expect(skillVfxSpec("burst")).toBeUndefined(); // a tower active — keyword fallback path
  });
});

describe("hero cast plumbing", () => {
  function heroBattleCasting(skillId: string): BattleState {
    const save = createFreshSave();
    save.hero.obtainedSkills = [{ skillId, level: 1, useXp: 0 }];
    save.hero.equippedSkillIds = [skillId];
    const enemy = mkEnemy({ baseStats: makeStats({ maxHp: 1e9, moveSpeed: 1, atk: 0, attackSpeed: 0 }) });
    const stage = mkStage(oneWave("grunt", 1), { castleHp: 1e9 });
    return new BattleState(
      stage,
      { enemies: new Map([["grunt", enemy]]), characters: new Map() },
      {
        seed: 1, eliteChance: 0, heroSave: save,
        hero: { stats: makeStats({ maxHp: 1e9 }), startPos: { x: 0, y: 0 } },
      },
    );
  }

  it("carries the hero's equipped skill id onto the battle runtime", () => {
    const b = heroBattleCasting("spirit-bolt");
    expect(b.hero.equippedSkillId).toBe("spirit-bolt");
  });

  it("emits a cast event tagged with the equipped skill id when the hero casts", () => {
    const b = heroBattleCasting("execute-slash");
    // Force the hero to be able to attack the spawned enemy.
    b.hero.stats.range = 400;
    b.hero.stats.attackSpeed = 10;
    let castSkillId: string | undefined | null = null;
    // The first wave spawns at INTER_WAVE_DELAY (3s); keep the hero charged so it
    // casts the instant a target appears.
    for (let t = 0; t < 160 && castSkillId === null; t++) {
      b.hero.mana = MANA_MAX;
      b.tick(0.05);
      for (const fx of b.fx) if (fx.type === "cast" && fx.source === "hero") castSkillId = fx.skillId;
    }
    expect(castSkillId).toBe("execute-slash");
  });
});
