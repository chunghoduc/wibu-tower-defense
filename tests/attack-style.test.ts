import { describe, expect, it } from "vitest";
import { attackStyleFor, heroAttackStyle, type AttackStyle } from "../src/data/attackStyle.ts";
import { TOWERS } from "../src/data/towers.ts";

const style = (id: string): AttackStyle => attackStyleFor(TOWERS.find((t) => t.id === id)!);

describe("T6 — per-character attack styles", () => {
  it("derives a sensible style per archetype", () => {
    expect(style("tobi-skipstone")).toBe("lightning");   // chain
    expect(style("kona-ember-fox")).toBe("fireball");    // fire dot
    expect(style("glace-ice-maker")).toBe("iceball");    // ice debuff
    expect(style("mochi-morale-sprite")).toBe("holy");   // support
    expect(style("pip-powderkeg")).toBe("fireball");     // powder splash → fiery
  });

  it("physical damage towers are arrow (ranged) or slash (melee)", () => {
    for (const t of TOWERS.filter((x) => x.role === "damage" && x.damageType === "Physical")) {
      const s = attackStyleFor(t);
      expect([s, t.baseStats.range], t.id).toContain(s);
      expect(s === "arrow" || s === "slash").toBe(true);
    }
  });

  it("every tower resolves to a known style", () => {
    const known = new Set(["arrow", "fireball", "iceball", "lightning", "arcane", "cannon", "poison", "holy", "slash", "hex"]);
    for (const t of TOWERS) expect(known.has(attackStyleFor(t)), t.id).toBe(true);
  });

  it("hero style follows damage type / range", () => {
    expect(heroAttackStyle("Magic", 200)).toBe("arcane");
    expect(heroAttackStyle("Physical", 200)).toBe("arrow");
    expect(heroAttackStyle("Physical", 90)).toBe("slash");
  });
});
