import { describe, expect, it } from "vitest";
import {
  WEAPON_FAMILIES, FAMILY, deriveDamageType, weaponBaseRange,
  type WeaponSpec,
} from "../src/data/weaponFamily.ts";

describe("weapon-family taxonomy", () => {
  it("every family has a damage class and a base range", () => {
    for (const f of WEAPON_FAMILIES) {
      const row = FAMILY[f];
      expect(row.damageClass === "Physical" || row.damageClass === "Magic", f).toBe(true);
      expect(row.range, f).toBeGreaterThan(0);
    }
  });

  it("ranged families reach past melee, melee families stay short", () => {
    for (const f of ["bow", "crossbow", "gun", "staff", "tome", "scepter"] as const) {
      expect(FAMILY[f].range, f).toBeGreaterThanOrEqual(120);
    }
    for (const f of ["fist", "sword", "blunt"] as const) {
      expect(FAMILY[f].range, f).toBeLessThan(140);
    }
  });

  it("family default decides damage type", () => {
    expect(deriveDamageType({ family: "bow", display: "" })).toBe("Physical");
    expect(deriveDamageType({ family: "gun", display: "" })).toBe("Physical");
    expect(deriveDamageType({ family: "staff", display: "" })).toBe("Magic");
    expect(deriveDamageType({ family: "tome", display: "" })).toBe("Magic");
  });

  it("elemental enchant flips a physical weapon to Magic (option ii)", () => {
    expect(deriveDamageType({ family: "sword", display: "" })).toBe("Physical");
    expect(deriveDamageType({ family: "sword", enchanted: true, display: "" })).toBe("Magic");
    expect(deriveDamageType({ family: "fist", element: "fire", enchanted: true, display: "" })).toBe("Magic");
  });

  it("weaponBaseRange returns the family base", () => {
    const spec: WeaponSpec = { family: "bow", display: "a bow" };
    expect(weaponBaseRange(spec)).toBe(FAMILY.bow.range);
  });
});
