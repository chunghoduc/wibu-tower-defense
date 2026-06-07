import { describe, expect, it } from "vitest";
import { mitigatedDamage, rollAttackDamage, critMultiplier, MITIGATION_CONSTANT } from "../src/core/damage.ts";
import { makeStats } from "../src/data/schema.ts";

describe("mitigatedDamage", () => {
  it("reduces Physical damage by the armor curve r/(r+K)", () => {
    const def = makeStats({ armor: MITIGATION_CONSTANT }); // 100 armor => 50% mitigation
    const out = mitigatedDamage({ amount: 100, type: "Physical", armorPen: 0, magicPen: 0 }, def);
    expect(out).toBeCloseTo(50, 5);
  });

  it("armor penetration lowers effective armor", () => {
    const def = makeStats({ armor: 100 });
    // 50% pen => effective armor 50 => mitigation 50/150 => 0.3333 => 66.67 dealt
    const out = mitigatedDamage({ amount: 100, type: "Physical", armorPen: 0.5, magicPen: 0 }, def);
    expect(out).toBeCloseTo(66.667, 2);
  });

  it("Magic damage is mitigated by magic resist, not armor", () => {
    const def = makeStats({ armor: 1000, magicResist: 100 });
    const out = mitigatedDamage({ amount: 100, type: "Magic", armorPen: 0, magicPen: 0 }, def);
    expect(out).toBeCloseTo(50, 5);
  });

  it("True damage ignores armor and magic resist", () => {
    const def = makeStats({ armor: 1000, magicResist: 1000 });
    const out = mitigatedDamage({ amount: 100, type: "True", armorPen: 0, magicPen: 0 }, def);
    expect(out).toBeCloseTo(100, 5);
  });

  it("Damage Reduction applies to ALL types including True", () => {
    const def = makeStats({ damageReduction: 0.25 });
    const out = mitigatedDamage({ amount: 100, type: "True", armorPen: 0, magicPen: 0 }, def);
    expect(out).toBeCloseTo(75, 5);
  });

  it("never returns negative damage", () => {
    const def = makeStats({ damageReduction: 1 });
    const out = mitigatedDamage({ amount: 100, type: "Physical", armorPen: 0, magicPen: 0 }, def);
    expect(out).toBe(0);
  });
});

describe("rollAttackDamage", () => {
  it("applies the crit multiplier on a crit", () => {
    const atk = makeStats({ atk: 50, critDamage: 2 });
    expect(rollAttackDamage(atk, false)).toBe(50);
    expect(rollAttackDamage(atk, true)).toBe(100);
  });
  it("crit defense reduces only the bonus crit portion", () => {
    const atk = makeStats({ atk: 50, critDamage: 2 }); // +100% bonus on crit
    // 50% crit defense halves the +100% bonus → 1.5x → 75; non-crit unaffected.
    expect(rollAttackDamage(atk, true, 0.5)).toBe(75);
    expect(rollAttackDamage(atk, false, 0.5)).toBe(50);
  });
});

describe("critMultiplier (crit defense)", () => {
  it("returns full crit damage with no crit defense", () => {
    expect(critMultiplier(2.0, 0)).toBeCloseTo(2.0, 5);
  });
  it("scales the bonus down by crit defense, never below the base hit", () => {
    expect(critMultiplier(2.0, 0.5)).toBeCloseTo(1.5, 5); // half the +100% bonus
    expect(critMultiplier(2.0, 1)).toBeCloseTo(1.0, 5);   // full defense → no bonus
    expect(critMultiplier(1.5, 1)).toBeCloseTo(1.0, 5);
  });
  it("clamps crit defense to [0,1]", () => {
    expect(critMultiplier(2.0, 5)).toBeCloseTo(1.0, 5);
    expect(critMultiplier(2.0, -3)).toBeCloseTo(2.0, 5);
  });
});
