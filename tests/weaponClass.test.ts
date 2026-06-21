import { describe, expect, it } from "vitest";
import { weaponClassMet } from "../src/core/weaponClass.ts";

describe("weaponClassMet", () => {
  it("no requirement → always met", () => {
    expect(weaponClassMet(undefined, "Sword")).toBe(true);
    expect(weaponClassMet(undefined, undefined)).toBe(true);
  });

  it("magic is met by dedicated caster weapons — staves and tomes (scepters/wands map to Staff)", () => {
    expect(weaponClassMet("magic", "Staff")).toBe(true);
    expect(weaponClassMet("magic", "Tome")).toBe(true);
  });

  it("magic is NOT met by a sword — including an enchanted 'magic sword'", () => {
    // A spell weapon is required; a sword is never a spell weapon regardless of build.
    expect(weaponClassMet("magic", "Sword")).toBe(false);
  });

  it("magic is NEVER met by a gun or a bow (the closed magic-archetype loophole)", () => {
    // A magic-archetype gun/bow used to slip through the old `archetype === 'magic'`
    // clause; the rule is now purely weapon-type based, so they cannot cast spells.
    expect(weaponClassMet("magic", "Gun")).toBe(false);
    expect(weaponClassMet("magic", "Bow")).toBe(false);
  });

  it("magic is NOT met by an empty weapon slot", () => {
    expect(weaponClassMet("magic", undefined)).toBe(false);
  });

  it("melee is met by swords, not bows", () => {
    expect(weaponClassMet("melee", "Sword")).toBe(true);
    expect(weaponClassMet("melee", "Bow")).toBe(false);
  });

  it("ranged is met by bows and guns, not staves", () => {
    expect(weaponClassMet("ranged", "Bow")).toBe(true);
    expect(weaponClassMet("ranged", "Gun")).toBe(true);
    expect(weaponClassMet("ranged", "Staff")).toBe(false);
  });
});
