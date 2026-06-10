import { describe, expect, it } from "vitest";
import {
  waveScaling, WAVE_HP_RAMP, WAVE_ATK_RAMP, STAGE_HP_RAMP, STAGE_ATK_RAMP,
} from "../src/core/waveScaling.ts";

describe("waveScaling — intra-stage escalation", () => {
  it("the first wave of stage 1 is the unscaled baseline (×1.0)", () => {
    const s = waveScaling(0, 6, 1);
    expect(s.hpMult).toBeCloseTo(1, 6);
    expect(s.atkMult).toBeCloseTo(1, 6);
  });

  it("the last wave of a stage hits the full intra-stage ramp", () => {
    const s = waveScaling(5, 6, 1); // last of 6, stage 1 (no stage bump)
    expect(s.hpMult).toBeCloseTo(1 + WAVE_HP_RAMP, 6);   // ≈2.6×
    expect(s.atkMult).toBeCloseTo(1 + WAVE_ATK_RAMP, 6); // ≈1.7×
  });

  it("HP/atk multipliers increase monotonically across waves", () => {
    let prevHp = 0, prevAtk = 0;
    for (let i = 0; i < 6; i++) {
      const s = waveScaling(i, 6, 1);
      expect(s.hpMult).toBeGreaterThan(prevHp);
      expect(s.atkMult).toBeGreaterThan(prevAtk);
      prevHp = s.hpMult;
      prevAtk = s.atkMult;
    }
  });

  it("a later stage is tougher than the same wave in an earlier stage", () => {
    const early = waveScaling(2, 6, 1);
    const late = waveScaling(2, 6, 10);
    expect(late.hpMult).toBeGreaterThan(early.hpMult);
    expect(late.atkMult).toBeGreaterThan(early.atkMult);
  });

  it("stage-10 baseline matches the documented gentle stage ramp", () => {
    const s = waveScaling(0, 6, 10); // first wave ⇒ frac 0 ⇒ only stage ramp
    expect(s.hpMult).toBeCloseTo(1 + STAGE_HP_RAMP * 9, 6);   // ≈1.72×
    expect(s.atkMult).toBeCloseTo(1 + STAGE_ATK_RAMP * 9, 6); // ≈1.45×
  });

  it("bosses are exempt from the steep intra-stage ramp (stage bump only)", () => {
    const boss = waveScaling(5, 6, 1, true); // last wave, would-be full ramp
    expect(boss.hpMult).toBeCloseTo(1, 6);  // stage 1 ⇒ no bump, no wave ramp
    expect(boss.atkMult).toBeCloseTo(1, 6);

    const lateBoss = waveScaling(5, 6, 10, true);
    expect(lateBoss.hpMult).toBeCloseTo(1 + STAGE_HP_RAMP * 9, 6); // gentle only
    // and far below what a non-boss on the same wave would get
    const trash = waveScaling(5, 6, 10, false);
    expect(lateBoss.hpMult).toBeLessThan(trash.hpMult);
  });

  it("a single-wave stage produces no intra-stage ramp (no divide-by-zero)", () => {
    const s = waveScaling(0, 1, 1);
    expect(s.hpMult).toBeCloseTo(1, 6);
    expect(s.atkMult).toBeCloseTo(1, 6);
  });
});
