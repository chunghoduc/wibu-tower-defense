import { describe, it, expect } from "vitest";
import { heroStatRows } from "../src/scenes/heroStatRows.ts";
import { makeStats } from "../src/data/schema.ts";

describe("heroStatRows", () => {
  it("returns the 12 hero stats in display order with correct labels", () => {
    const rows = heroStatRows(makeStats({}));
    expect(rows.map((r) => r.label)).toEqual([
      "ATK", "Atk Spd", "Range", "Crit", "Crit Dmg", "HP",
      "HP Regen", "Armor", "M.Resist", "Skill Pwr", "Omnivamp", "Move Spd",
    ]);
  });

  it("formats scalar, percent and multiplier stats correctly", () => {
    const rows = heroStatRows(makeStats({
      atk: 142.7, attackSpeed: 1.14, range: 130.6, critRate: 0.25,
      critDamage: 1.5, maxHp: 812.3, hpRegen: 8.2, armor: 30.6,
      magicResist: 12, skillPower: 1.5, omnivamp: 0.08, moveSpeed: 160.4,
    }));
    const by = (l: string) => rows.find((r) => r.label === l)!.value;
    expect(by("ATK")).toBe("143");
    expect(by("Atk Spd")).toBe("1.1");
    expect(by("Range")).toBe("131");
    expect(by("Crit")).toBe("25%");
    expect(by("Crit Dmg")).toBe("1.5×");
    expect(by("HP")).toBe("812");
    expect(by("HP Regen")).toBe("8.2");
    expect(by("Skill Pwr")).toBe("1.5×");
    expect(by("Omnivamp")).toBe("8%");
    expect(by("Move Spd")).toBe("160");
  });
});
