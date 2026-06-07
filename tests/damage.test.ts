import { describe, expect, it } from "vitest";
import { mitigatedDamage, mitigationBreakdown, rollAttackDamage, critMultiplier, MITIGATION_CONSTANT } from "../src/core/damage.ts";
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

describe("mitigationBreakdown", () => {
  it("its `final` always equals mitigatedDamage (single source of truth)", () => {
    const def = makeStats({ armor: 150, magicResist: 60, damageReduction: 0.1 });
    for (const type of ["Physical", "Magic", "True"] as const) {
      for (const pen of [0, 0.3, 1]) {
        const packet = { amount: 200, type, armorPen: pen, magicPen: pen };
        expect(mitigationBreakdown(packet, def).final).toBeCloseTo(mitigatedDamage(packet, def), 9);
      }
    }
  });

  it("reports each term of the formula", () => {
    const def = makeStats({ armor: 100, damageReduction: 0.5 });
    // 100 armor, 50% pen → eff 50 → curve 50/150 = 33.3% mitigation → 66.67 → DR 50% → 33.33
    const b = mitigationBreakdown({ amount: 100, type: "Physical", armorPen: 0.5, magicPen: 0 }, def);
    expect(b.defRating).toBe(100);
    expect(b.effRating).toBeCloseTo(50, 5);
    expect(b.mitigationFrac).toBeCloseTo(50 / 150, 5);
    expect(b.afterMitig).toBeCloseTo(66.667, 2);
    expect(b.damageReduction).toBe(0.5);
    expect(b.final).toBeCloseTo(33.333, 2);
  });

  it("True damage shows no armor/resist mitigation", () => {
    const b = mitigationBreakdown({ amount: 100, type: "True", armorPen: 0, magicPen: 0 }, makeStats({ armor: 999, magicResist: 999 }));
    expect(b.mitigationFrac).toBe(0);
    expect(b.afterMitig).toBe(100);
    expect(b.final).toBe(100);
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
