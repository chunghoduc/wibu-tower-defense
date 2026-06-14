import { describe, expect, it } from "vitest";
import { planVolley } from "../src/scenes/projectileVolley.ts";
import type { SkillMotif } from "../src/data/skillVfxMeta.ts";

const from = { x: 100, y: 300 };
const at = { x: 400, y: 300 }; // straight to the right

const m = (kind: SkillMotif["kind"], count: number, spread: SkillMotif["spread"]): SkillMotif => ({
  kind,
  count,
  spread,
});

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(b.x - a.x, b.y - a.y);

describe("planVolley — per-projectile travel frames", () => {
  it("returns no shots when nothing is fired", () => {
    expect(planVolley(from, at, m("none", 0, "single"))).toEqual([]);
    expect(planVolley(from, at, m("orb", 0, "single"))).toEqual([]);
  });

  it("single: one shot heading straight at the target", () => {
    const shots = planVolley(from, at, m("orb", 1, "single"));
    expect(shots).toHaveLength(1);
    expect(shots[0].from).toEqual(from);
    expect(shots[0].to.x).toBeCloseTo(at.x, 1);
    expect(shots[0].to.y).toBeCloseTo(at.y, 1);
    expect(shots[0].angle).toBeCloseTo(0, 2); // due east
    expect(shots[0].delay).toBe(0);
  });

  it("fan: count shots from one launch point, spread around the target, no stagger", () => {
    const shots = planVolley(from, at, m("arrow", 3, "fan"));
    expect(shots).toHaveLength(3);
    // all launch from the caster
    for (const s of shots) expect(s.from).toEqual(from);
    // all land at distinct points
    const keys = new Set(shots.map((s) => `${s.to.x.toFixed(2)},${s.to.y.toFixed(2)}`));
    expect(keys.size).toBe(3);
    // the middle shot heads at the target; outer two are angled off it
    const mid = shots[1];
    expect(mid.to.x).toBeCloseTo(at.x, 0);
    expect(mid.to.y).toBeCloseTo(at.y, 0);
    expect(shots[0].angle).not.toBeCloseTo(shots[2].angle, 2);
    for (const s of shots) expect(s.delay).toBe(0);
  });

  it("stream: count shots down the line with a ramped, non-decreasing stagger", () => {
    const shots = planVolley(from, at, m("bullet", 5, "stream"));
    expect(shots).toHaveLength(5);
    for (let i = 1; i < shots.length; i++) {
      expect(shots[i].delay).toBeGreaterThanOrEqual(shots[i - 1].delay);
    }
    expect(shots[4].delay).toBeGreaterThan(0);
    // every shot heads broadly toward the target
    for (const s of shots) expect(s.to.x).toBeGreaterThan(from.x);
  });

  it("pierce: one shot whose path extends past the target along the same heading", () => {
    const shots = planVolley(from, at, m("arrow", 1, "pierce"));
    expect(shots).toHaveLength(1);
    expect(dist(from, shots[0].to)).toBeGreaterThan(dist(from, at));
    expect(shots[0].angle).toBeCloseTo(0, 2); // same heading as the target
  });
});
