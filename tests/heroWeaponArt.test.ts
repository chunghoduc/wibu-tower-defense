import { describe, it, expect } from "vitest";
import { weaponArtKeys, weaponArtId } from "../src/data/heroWeaponArt.ts";
import { WEAPON_TYPES, type WeaponType } from "../src/data/schemaEnums.ts";

describe("heroWeaponArt", () => {
  it("maps every WeaponType to a stance + attack key", () => {
    for (const wt of WEAPON_TYPES) {
      const k = weaponArtKeys(wt);
      expect(k.stanceKey).toMatch(/^herobattle__[a-z]+$/);
      expect(k.attackKey).toBe(`${k.stanceKey}__attack`);
    }
  });

  it("lower-cases the weapon id (Sword → sword)", () => {
    expect(weaponArtId("Sword")).toBe("sword");
    expect(weaponArtKeys("Bow").stanceKey).toBe("herobattle__bow");
  });

  it("falls back to 'any' for null / undefined / unknown", () => {
    expect(weaponArtId(null)).toBe("any");
    expect(weaponArtId(undefined)).toBe("any");
    expect(weaponArtKeys(null).stanceKey).toBe("herobattle__any");
    expect(weaponArtKeys("Frobnicator" as WeaponType).stanceKey).toBe("herobattle__any");
  });

  it("covers each known weapon with its own id (no silent collapse to any)", () => {
    const ids = WEAPON_TYPES.map((w) => weaponArtId(w));
    expect(new Set(ids).size).toBe(WEAPON_TYPES.length);
  });
});
