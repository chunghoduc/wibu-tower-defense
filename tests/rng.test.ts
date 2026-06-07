import { describe, expect, it } from "vitest";
import { Rng } from "../src/core/rng.ts";

describe("Rng", () => {
  it("is deterministic for a given seed", () => {
    const a = new Rng(42), b = new Rng(42);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });

  it("rollChance consumes RNG identically to chance (deterministic swap)", () => {
    const a = new Rng(7), b = new Rng(7);
    const ps = [0, 0.1, 0.5, 1, 0.3, 0.9]; // includes the no-draw edges (0 and 1)
    for (const p of ps) expect(a.chance(p)).toBe(b.rollChance(p).hit);
    // After identical consumption the streams stay in lock-step.
    expect(a.next()).toBe(b.next());
  });

  it("rollChance.hit equals roll < p, and reports no draw at the edges", () => {
    const r = new Rng(99);
    for (let i = 0; i < 200; i++) {
      const { hit, roll } = r.rollChance(0.37);
      expect(hit).toBe(roll < 0.37);
    }
    expect(Number.isNaN(new Rng(1).rollChance(0).roll)).toBe(true);
    expect(Number.isNaN(new Rng(1).rollChance(1).roll)).toBe(true);
    expect(new Rng(1).rollChance(0).hit).toBe(false);
    expect(new Rng(1).rollChance(1).hit).toBe(true);
  });

  it("crit rate converges to the configured probability", () => {
    const r = new Rng(2024);
    const N = 50_000, p = 0.3;
    let hits = 0;
    for (let i = 0; i < N; i++) if (r.chance(p)) hits++;
    expect(hits / N).toBeCloseTo(p, 2); // within ~0.005
  });

  it("0% never crits and 100% always crits", () => {
    const r = new Rng(5);
    for (let i = 0; i < 50; i++) {
      expect(r.chance(0)).toBe(false);
      expect(r.chance(1)).toBe(true);
    }
  });
});
