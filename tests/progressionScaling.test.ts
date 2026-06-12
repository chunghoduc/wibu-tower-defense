import { describe, expect, it } from "vitest";
import {
  progressionScaling,
  STAGES_PER_CHAPTER,
  PROG_HP_PER_STAGE,
  PROG_ATK_PER_STAGE,
  PROG_HP_PER_CHAPTER,
} from "../src/core/progressionScaling.ts";

describe("progressionScaling — cross-stage/chapter long-game curve", () => {
  it("stage 1 is the unscaled authored baseline (×1.0)", () => {
    const s = progressionScaling(1);
    expect(s.hpMult).toBeCloseTo(1, 6);
    expect(s.atkMult).toBeCloseTo(1, 6);
  });

  it("compounds geometrically within a chapter", () => {
    // Stage 3 (idx 2) — still chapter 1, so no chapter step yet.
    const s = progressionScaling(3);
    expect(s.hpMult).toBeCloseTo((1 + PROG_HP_PER_STAGE) ** 2, 6);
    expect(s.atkMult).toBeCloseTo((1 + PROG_ATK_PER_STAGE) ** 2, 6);
  });

  it("adds a discrete chapter 'wall' at each chapter boundary", () => {
    // ch2-s1 is global stage 6 (idx 5): five per-stage steps + ONE chapter step.
    const s = progressionScaling(STAGES_PER_CHAPTER + 1);
    expect(s.hpMult).toBeCloseTo(
      (1 + PROG_HP_PER_STAGE) ** STAGES_PER_CHAPTER * (1 + PROG_HP_PER_CHAPTER),
      6,
    );
  });

  it("is strictly monotonic across the whole campaign", () => {
    let prevHp = 0,
      prevAtk = 0;
    for (let n = 1; n <= 30; n++) {
      const s = progressionScaling(n);
      expect(s.hpMult).toBeGreaterThan(prevHp);
      expect(s.atkMult).toBeGreaterThan(prevAtk);
      prevHp = s.hpMult;
      prevAtk = s.atkMult;
    }
  });

  it("a new chapter's first stage is tougher than the previous chapter's last", () => {
    const ch1Last = progressionScaling(STAGES_PER_CHAPTER); // stage 5
    const ch2First = progressionScaling(STAGES_PER_CHAPTER + 1); // stage 6
    expect(ch2First.hpMult).toBeGreaterThan(ch1Last.hpMult);
    expect(ch2First.atkMult).toBeGreaterThan(ch1Last.atkMult);
  });

  it("end-game enemies are a different beast (~35× HP at ch6-s10)", () => {
    const s = progressionScaling(30); // ch6-s10
    expect(s.hpMult).toBeGreaterThan(25);
    expect(s.hpMult).toBeLessThan(50);
  });

  it("clamps non-positive / fractional stage numbers to the baseline", () => {
    expect(progressionScaling(0).hpMult).toBeCloseTo(1, 6);
    expect(progressionScaling(-3).hpMult).toBeCloseTo(1, 6);
    expect(progressionScaling(1.9).hpMult).toBeCloseTo(1, 6); // floors to stage 1
  });
});
