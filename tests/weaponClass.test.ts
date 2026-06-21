import { describe, expect, it } from "vitest";
import { weaponClassMet } from "../src/core/weaponClass.ts";

describe("weaponClassMet", () => {
  it("no requirement → always met", () => {
    expect(weaponClassMet(undefined, "Sword", "physical")).toBe(true);
    expect(weaponClassMet(undefined, undefined, undefined)).toBe(true);
  });

  it("magic is met by staves and tomes", () => {
    expect(weaponClassMet("magic", "Staff", "magic")).toBe(true);
    expect(weaponClassMet("magic", "Tome", undefined)).toBe(true);
  });

  it("magic is met by a magic-archetype sword (a 'magic sword')", () => {
    expect(weaponClassMet("magic", "Sword", "magic")).toBe(true);
  });

  it("magic is NOT met by a plain physical sword, bow, or gun", () => {
    expect(weaponClassMet("magic", "Sword", "physical")).toBe(false);
    expect(weaponClassMet("magic", "Bow", "physical")).toBe(false);
    expect(weaponClassMet("magic", "Gun", undefined)).toBe(false);
  });

  it("magic is NOT met by an empty weapon slot", () => {
    expect(weaponClassMet("magic", undefined, undefined)).toBe(false);
  });

  it("melee is met by swords and fists, not bows", () => {
    expect(weaponClassMet("melee", "Sword", "physical")).toBe(true);
    expect(weaponClassMet("melee", "Fist", undefined)).toBe(true);
    expect(weaponClassMet("melee", "Bow", undefined)).toBe(false);
  });

  it("ranged is met by bows and guns, not staves", () => {
    expect(weaponClassMet("ranged", "Bow", undefined)).toBe(true);
    expect(weaponClassMet("ranged", "Gun", undefined)).toBe(true);
    expect(weaponClassMet("ranged", "Staff", "magic")).toBe(false);
  });
});
