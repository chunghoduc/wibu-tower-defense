import { describe, expect, it } from "vitest";
import { computeAuraMods, type AuraEnemy } from "../src/core/enemyAuras.ts";
import { mkEnemy } from "./fixtures.ts";

const herald = mkEnemy({
  id: "herald",
  archetype: "Herald",
  special: { supportAura: { radius: 115, moveSpeedMult: 1.3, damageReductionAdd: 0.15 } },
});
const hexer = mkEnemy({
  id: "hexer",
  archetype: "Hexer",
  special: { supportAura: { radius: 125, healPerSec: 14, armorAdd: 25, magicResistAdd: 25 } },
});
const grunt = mkEnemy();

const at = (uid: number, def = grunt, x = 0): AuraEnemy => ({
  uid,
  alive: true,
  pos: { x, y: 0 },
  def,
});

describe("computeAuraMods", () => {
  it("a Herald buffs a nearby ally's move speed and damage reduction, but not itself", () => {
    const r = computeAuraMods([at(1, herald), at(2, grunt, 50)]);
    expect(r.get(2)?.mods.moveMult).toBeCloseTo(1.3);
    expect(r.get(2)?.mods.drAdd).toBeCloseTo(0.15);
    expect(r.has(1)).toBe(false); // the source is never buffed by its own aura
  });

  it("an ally outside the radius receives nothing", () => {
    const r = computeAuraMods([at(1, herald), at(2, grunt, 500)]);
    expect(r.has(2)).toBe(false);
  });

  it("a Hexer contributes healing, armor and magic resist", () => {
    const r = computeAuraMods([at(1, hexer), at(2, grunt, 40)]);
    expect(r.get(2)?.healPerSec).toBe(14);
    expect(r.get(2)?.mods.armorAdd).toBe(25);
    expect(r.get(2)?.mods.magicResistAdd).toBe(25);
  });

  it("two supports stack on a shared ally", () => {
    const r = computeAuraMods([at(1, herald), at(2, hexer, 10), at(3, grunt, 30)]);
    const m = r.get(3)!;
    expect(m.mods.moveMult).toBeCloseTo(1.3);
    expect(m.mods.drAdd).toBeCloseTo(0.15);
    expect(m.mods.armorAdd).toBe(25);
    expect(m.healPerSec).toBe(14);
  });

  it("returns an empty map when there are no support enemies", () => {
    expect(computeAuraMods([at(1), at(2, grunt, 20)]).size).toBe(0);
  });
});
