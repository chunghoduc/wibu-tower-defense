import { describe, expect, it } from "vitest";
import { FixedStepper, SIM_STEP } from "../src/core/fixedStep.ts";

describe("FixedStepper", () => {
  it("emits no step until a full STEP accumulates, then exactly one", () => {
    const s = new FixedStepper();
    expect(s.advance(0.016)).toBe(0);
    expect(s.advance(0.016)).toBe(0);
    expect(s.advance(0.016)).toBe(0); // 0.048 < 0.05
    expect(s.advance(0.016)).toBe(1); // 0.064 → 1 step, 0.014 left
  });

  it("emits multiple steps for a large frame and keeps the remainder as alpha", () => {
    const s = new FixedStepper();
    expect(s.advance(0.12)).toBe(2); // 0.12 → 2 steps + 0.02
    expect(s.alpha).toBeCloseTo(0.02 / SIM_STEP, 10);
  });

  it("alpha stays in [0,1) and grows on stepless frames", () => {
    const s = new FixedStepper();
    s.advance(0.03);
    expect(s.alpha).toBeCloseTo(0.6, 10);
    s.advance(0.01);
    expect(s.alpha).toBeCloseTo(0.8, 10);
  });

  it("caps catch-up at maxSteps and drops the whole-step excess", () => {
    const s = new FixedStepper();
    expect(s.advance(1.0)).toBe(5); // 20 owed → capped at 5
    expect(s.alpha).toBeLessThan(1); // fractional remainder kept, whole excess dropped
    expect(s.advance(0)).toBe(0); // no debt carried into the next frame
  });

  it("ignores zero/negative dt (pause = no accumulation)", () => {
    const s = new FixedStepper();
    s.advance(0.04);
    expect(s.advance(0)).toBe(0);
    expect(s.advance(-1)).toBe(0);
    expect(s.alpha).toBeCloseTo(0.8, 10);
  });

  it("reset clears the accumulator", () => {
    const s = new FixedStepper();
    s.advance(0.04);
    s.reset();
    expect(s.alpha).toBe(0);
    expect(s.advance(0.04)).toBe(0);
  });

  it("a 60fps stream at 1x runs sim time ≈ wall time", () => {
    const s = new FixedStepper();
    let steps = 0;
    for (let i = 0; i < 600; i++) steps += s.advance(1 / 60); // 10s of frames
    expect(steps * SIM_STEP).toBeCloseTo(10, 1);
  });
});
