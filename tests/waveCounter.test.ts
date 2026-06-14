import { describe, it, expect } from "vitest";
import { waveCounterLabel } from "../src/core/waveCounter.ts";

describe("waveCounterLabel", () => {
  it("campaign shows current/total and ignores best", () => {
    expect(waveCounterLabel({ endless: false, current: 5, total: 20, best: 99 })).toBe(
      "Wave 5/20",
    );
  });

  it("endless below best shows current/best", () => {
    expect(waveCounterLabel({ endless: true, current: 5, total: 20, best: 22 })).toBe("Wave 5/22");
  });

  it("endless at best shows identical numbers", () => {
    expect(waveCounterLabel({ endless: true, current: 22, total: 20, best: 22 })).toBe(
      "Wave 22/22",
    );
  });

  it("endless surpassing best shows two identical numbers", () => {
    expect(waveCounterLabel({ endless: true, current: 30, total: 20, best: 22 })).toBe(
      "Wave 30/30",
    );
  });

  it("endless fresh run (best 0) shows current/current", () => {
    expect(waveCounterLabel({ endless: true, current: 1, total: 20, best: 0 })).toBe("Wave 1/1");
  });
});
