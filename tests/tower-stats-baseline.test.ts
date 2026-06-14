import { describe, expect, it } from "vitest";
import { towerBaseline } from "../src/data/towerStats.ts";

describe("towerBaseline — lowered base power (BASE_POWER_SCALE 0.7)", () => {
  it("damage/Common: atk & maxHp cut to 70%, cost & attackSpeed unchanged", () => {
    const { core, cost } = towerBaseline("damage", "Common");
    expect(core.atk).toBe(11); // round(16 * 1.0 * 0.7)
    expect(core.maxHp).toBe(91); // round(130 * 1.0 * 0.7)
    expect(core.attackSpeed).toBeCloseTo(1.2, 5); // unchanged (1.2 * (1 + 0))
    expect(cost).toBe(45); // round5(45 * 1.0) — unchanged
  });

  it("damage/Unique: scales with rarity power, still 70%", () => {
    const { core, cost } = towerBaseline("damage", "Unique");
    expect(core.atk).toBe(37); // round(16 * 3.3 * 0.7)
    expect(core.maxHp).toBe(196); // round(130 * 2.15 * 0.7)
    expect(cost).toBe(150); // round5(45 * 3.3) — unchanged
  });

  it("support keeps manaOnHit 0 and tanker stays the tankiest", () => {
    expect(towerBaseline("support", "Common").core.manaOnHit).toBe(0);
    const tanker = towerBaseline("tanker", "Common").core.maxHp ?? 0;
    const dmg = towerBaseline("damage", "Common").core.maxHp ?? 0;
    expect(tanker).toBeGreaterThan(dmg);
  });
});
