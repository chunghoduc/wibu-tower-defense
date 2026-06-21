import { describe, it, expect } from "vitest";
import { towerStatRows, AURA_BUFF_COLOR } from "../src/scenes/statFormat.ts";

const base = { atk: 100, range: 200, attackSpeed: 1.5, critRate: 0.1 };

describe("towerStatRows", () => {
  it("leaves atk/attackSpeed un-tinted at their base when there is no aura", () => {
    const rows = towerStatRows(base, 0, 0);
    const atk = rows.find((r) => r.key === "atk")!;
    const as = rows.find((r) => r.key === "attackSpeed")!;
    expect(atk.value).toBe("100");
    expect(atk.buffColor).toBeUndefined();
    expect(as.value).toBe("1.5");
    expect(as.buffColor).toBeUndefined();
  });

  it("folds an atk aura buff into the displayed atk and tints it", () => {
    const rows = towerStatRows(base, 0.2, 0);
    const atk = rows.find((r) => r.key === "atk")!;
    expect(atk.value).toContain("120");
    expect(atk.buffColor).toBe(AURA_BUFF_COLOR);
    // attack-speed unaffected
    expect(rows.find((r) => r.key === "attackSpeed")!.buffColor).toBeUndefined();
  });

  it("folds an attack-speed aura buff into the displayed attack-speed and tints it", () => {
    const rows = towerStatRows(base, 0, 0.2);
    const as = rows.find((r) => r.key === "attackSpeed")!;
    expect(as.value).toContain("1.8");
    expect(as.buffColor).toBe(AURA_BUFF_COLOR);
    expect(rows.find((r) => r.key === "atk")!.buffColor).toBeUndefined();
  });

  it("does not tint non-buffable stats", () => {
    const rows = towerStatRows(base, 0.5, 0.5);
    expect(rows.find((r) => r.key === "range")!.buffColor).toBeUndefined();
    expect(rows.find((r) => r.key === "critRate")!.buffColor).toBeUndefined();
  });
});
