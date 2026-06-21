import { describe, expect, it } from "vitest";
import {
  activeBurst,
  spellPowerMult,
  ACTIVE_ATK_COEF,
  ACTIVE_SPELL_GAIN,
  ACTIVE_BASE_FLAT,
} from "../src/core/activeDamage.ts";
import type { DamageType } from "../src/data/schema.ts";

/**
 * The reworked active-skill formula:
 *   additive = powerMult×BASE_FLAT + powerMult×atkCoef(type)×atk
 *   burst    = additive × spellPowerMult(type, skillPower) + defBonus
 *
 * ATK is ADDITIVE; spell power is MULTIPLICATIVE and gated to Magic/True.
 * Physical lives on ATK; Magic lives on spell power; True is the hybrid.
 */
describe("active-damage coefficients", () => {
  it("ATK scaling is ordered Physical > True > Magic", () => {
    expect(ACTIVE_ATK_COEF.Physical).toBeGreaterThan(ACTIVE_ATK_COEF.True);
    expect(ACTIVE_ATK_COEF.True).toBeGreaterThan(ACTIVE_ATK_COEF.Magic);
  });

  it("spell-power gain is ordered Magic > True > Physical, and Physical is locked to 0", () => {
    expect(ACTIVE_SPELL_GAIN.Physical).toBe(0);
    expect(ACTIVE_SPELL_GAIN.Magic).toBeGreaterThan(ACTIVE_SPELL_GAIN.True);
    expect(ACTIVE_SPELL_GAIN.True).toBeGreaterThan(0);
  });
});

describe("spellPowerMult", () => {
  it("is exactly 1 for Physical at any spell power (cannot use the stat)", () => {
    expect(spellPowerMult("Physical", 1)).toBe(1);
    expect(spellPowerMult("Physical", 3)).toBe(1);
    expect(spellPowerMult("Physical", 0.2)).toBe(1);
  });

  it("is 1 for an un-invested hero (skillPower ≤ 1) on every type", () => {
    for (const t of ["Physical", "Magic", "True"] as DamageType[]) {
      expect(spellPowerMult(t, 1)).toBe(1);
      expect(spellPowerMult(t, 0)).toBe(1); // clamped to the max(1,…) floor
    }
  });

  it("rises with spell power for Magic faster than True", () => {
    const magic = spellPowerMult("Magic", 3);
    const trueT = spellPowerMult("True", 3);
    expect(magic).toBeCloseTo(1 + 2 * ACTIVE_SPELL_GAIN.Magic, 9);
    expect(trueT).toBeCloseTo(1 + 2 * ACTIVE_SPELL_GAIN.True, 9);
    expect(magic).toBeGreaterThan(trueT);
  });
});

describe("activeBurst", () => {
  const base = { atk: 300, powerMult: 1.7 };

  it("ATK contributes ADDITIVELY: burst = powerMult×(BASE_FLAT + atkCoef×atk) when spell power is neutral", () => {
    const burst = activeBurst({ ...base, skillPower: 1, damageType: "Physical" });
    const expected = base.powerMult * (ACTIVE_BASE_FLAT + ACTIVE_ATK_COEF.Physical * base.atk);
    expect(burst).toBeCloseTo(expected, 6);
  });

  it("Physical burst does NOT change with spell power", () => {
    const lo = activeBurst({ ...base, skillPower: 1, damageType: "Physical" });
    const hi = activeBurst({ ...base, skillPower: 4, damageType: "Physical" });
    expect(hi).toBeCloseTo(lo, 6);
  });

  it("Magic burst scales MULTIPLICATIVELY with spell power", () => {
    const lo = activeBurst({ ...base, skillPower: 1, damageType: "Magic" });
    const hi = activeBurst({ ...base, skillPower: 3, damageType: "Magic" });
    expect(hi / lo).toBeCloseTo(spellPowerMult("Magic", 3), 6);
  });

  it("True scales with spell power but less than Magic; more than Physical", () => {
    const ratioTrue =
      activeBurst({ ...base, skillPower: 3, damageType: "True" }) /
      activeBurst({ ...base, skillPower: 1, damageType: "True" });
    const ratioMagic =
      activeBurst({ ...base, skillPower: 3, damageType: "Magic" }) /
      activeBurst({ ...base, skillPower: 1, damageType: "Magic" });
    expect(ratioTrue).toBeGreaterThan(1);
    expect(ratioTrue).toBeLessThan(ratioMagic);
  });

  it("Physical out-damages Magic at equal ATK when neither has spell power (Physical lives on ATK)", () => {
    const phys = activeBurst({ ...base, skillPower: 1, damageType: "Physical" });
    const magic = activeBurst({ ...base, skillPower: 1, damageType: "Magic" });
    expect(phys).toBeGreaterThan(magic);
  });

  it("Magic overtakes Physical once enough spell power is invested", () => {
    const phys = activeBurst({ ...base, skillPower: 1, damageType: "Physical" });
    const magic = activeBurst({ ...base, skillPower: 3, damageType: "Magic" });
    expect(magic).toBeGreaterThan(phys);
  });

  it("burst grows linearly in ATK (additive term)", () => {
    const a = activeBurst({ atk: 100, powerMult: 2, skillPower: 1, damageType: "Physical" });
    const b = activeBurst({ atk: 200, powerMult: 2, skillPower: 1, damageType: "Physical" });
    const c = activeBurst({ atk: 300, powerMult: 2, skillPower: 1, damageType: "Physical" });
    expect(b - a).toBeCloseTo(c - b, 6); // equal ATK steps ⇒ equal burst steps
  });

  it("defBonus is added FLAT after the spell multiplier (defensive payoff, not a spell)", () => {
    const noDef = activeBurst({ ...base, skillPower: 1, damageType: "Physical" });
    const withDef = activeBurst({ ...base, skillPower: 1, damageType: "Physical", defBonus: 250 });
    expect(withDef - noDef).toBeCloseTo(250, 6);
  });

  it("a fresh-hero Physical cast stays in the ballpark of the legacy atk×powerMult", () => {
    const legacy = base.atk * base.powerMult; // old: atk × powerMult × 1
    const now = activeBurst({ ...base, skillPower: 1, damageType: "Physical" });
    expect(now).toBeGreaterThan(legacy); // never a silent nerf for physical
    expect(now / legacy).toBeLessThan(1.2); // and not an inflation either
  });
});
