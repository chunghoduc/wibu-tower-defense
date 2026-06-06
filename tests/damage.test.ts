import { describe, expect, it } from "vitest";
import { mitigatedDamage, rollAttackDamage, MITIGATION_CONSTANT } from "../src/core/damage.ts";
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
});
