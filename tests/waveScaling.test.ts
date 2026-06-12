import { describe, expect, it } from "vitest";
import { waveScaling, WAVE_HP_RAMP, WAVE_ATK_RAMP } from "../src/core/waveScaling.ts";

describe("waveScaling — intra-stage escalation", () => {
  it("the first wave is the unscaled baseline (×1.0)", () => {
    const s = waveScaling(0, 6);
    expect(s.hpMult).toBeCloseTo(1, 6);
    expect(s.atkMult).toBeCloseTo(1, 6);
  });

  it("the last wave of a stage hits the full intra-stage ramp", () => {
    const s = waveScaling(5, 6); // last of 6
    expect(s.hpMult).toBeCloseTo(1 + WAVE_HP_RAMP, 6); // ≈2.6×
    expect(s.atkMult).toBeCloseTo(1 + WAVE_ATK_RAMP, 6); // ≈1.7×
  });

  it("HP/atk multipliers increase monotonically across waves", () => {
    let prevHp = 0,
      prevAtk = 0;
    for (let i = 0; i < 6; i++) {
      const s = waveScaling(i, 6);
      expect(s.hpMult).toBeGreaterThan(prevHp);
      expect(s.atkMult).toBeGreaterThan(prevAtk);
      prevHp = s.hpMult;
      prevAtk = s.atkMult;
    }
  });

  it("bosses are exempt from the intra-stage ramp (×1.0)", () => {
    const boss = waveScaling(5, 6, true); // last wave, would-be full ramp
    expect(boss.hpMult).toBeCloseTo(1, 6);
    expect(boss.atkMult).toBeCloseTo(1, 6);
    // and far below what a non-boss on the same wave would get
    const trash = waveScaling(5, 6, false);
    expect(boss.hpMult).toBeLessThan(trash.hpMult);
  });

  it("a single-wave stage produces no intra-stage ramp (no divide-by-zero)", () => {
    const s = waveScaling(0, 1);
    expect(s.hpMult).toBeCloseTo(1, 6);
    expect(s.atkMult).toBeCloseTo(1, 6);
  });
});
