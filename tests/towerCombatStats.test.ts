import { describe, it, expect } from "vitest";
import { effectiveTowerCombat } from "../src/core/towerCombatStats.ts";
import { ATTACK_SPEED_CAP } from "../src/core/attackSpeedCap.ts";

describe("effectiveTowerCombat", () => {
  it("returns the base numbers and no buff flags when there is no aura", () => {
    const c = effectiveTowerCombat(100, 1.2, 0, 0);
    expect(c.atk).toBe(100);
    expect(c.attackSpeed).toBeCloseTo(1.2);
    expect(c.atkBuffed).toBe(false);
    expect(c.asBuffed).toBe(false);
  });

  it("raises attack by buffAtkPct and flags it buffed", () => {
    const c = effectiveTowerCombat(100, 1, 0.25, 0);
    expect(c.atk).toBeCloseTo(125);
    expect(c.atkBuffed).toBe(true);
    expect(c.asBuffed).toBe(false);
  });

  it("raises attack-speed by buffAsPct and flags it buffed", () => {
    const c = effectiveTowerCombat(50, 2, 0, 0.5);
    expect(c.attackSpeed).toBeCloseTo(3);
    expect(c.asBuffed).toBe(true);
    expect(c.atkBuffed).toBe(false);
  });

  it("clamps buffed attack-speed to the global cap", () => {
    const c = effectiveTowerCombat(10, 4.5, 0, 0.5); // 4.5*1.5 = 6.75 → capped
    expect(c.attackSpeed).toBe(ATTACK_SPEED_CAP);
  });

  it("does not flag attack-speed buffed when the cap swallows the whole buff", () => {
    const c = effectiveTowerCombat(10, ATTACK_SPEED_CAP, 0, 0.5); // already at the cap
    expect(c.attackSpeed).toBe(ATTACK_SPEED_CAP);
    expect(c.asBuffed).toBe(false);
  });

  it("ignores a negative (debuff) attack-speed delta — only positive auras flag", () => {
    const c = effectiveTowerCombat(100, 2, 0, -0.25); // hexer slow
    expect(c.attackSpeed).toBeCloseTo(1.5);
    expect(c.asBuffed).toBe(false);
  });
});
