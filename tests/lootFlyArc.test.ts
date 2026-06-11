import { describe, expect, it } from "vitest";
import { arcControl, bezierPoint } from "../src/scenes/lootFlyArc.ts";

describe("lootFlyArc", () => {
  const from = { x: 100, y: 200 };
  const to = { x: 300, y: 180 };

  it("bezier starts at `from` and ends at `to`", () => {
    const ctrl = arcControl(from, to, 40);
    expect(bezierPoint(from, ctrl, to, 0)).toEqual(from);
    const end = bezierPoint(from, ctrl, to, 1);
    expect(end.x).toBeCloseTo(to.x);
    expect(end.y).toBeCloseTo(to.y);
  });

  it("control point is the x-midpoint lifted above both endpoints (screen y grows down)", () => {
    const ctrl = arcControl(from, to, 40);
    expect(ctrl.x).toBeCloseTo(200); // (100+300)/2
    expect(ctrl.y).toBeLessThan(Math.min(from.y, to.y)); // raised up
  });

  it("the curve's midpoint sits higher than the straight-line midpoint (it arcs)", () => {
    const ctrl = arcControl(from, to, 40);
    const mid = bezierPoint(from, ctrl, to, 0.5);
    const straightMidY = (from.y + to.y) / 2;
    expect(mid.y).toBeLessThan(straightMidY);
  });

  it("guards a zero-length hop without NaN", () => {
    const ctrl = arcControl(from, from, 40);
    const p = bezierPoint(from, ctrl, from, 0.5);
    expect(Number.isFinite(p.x)).toBe(true);
    expect(Number.isFinite(p.y)).toBe(true);
  });
});
