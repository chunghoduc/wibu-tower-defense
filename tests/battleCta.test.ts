import { describe, it, expect } from "vitest";
import { battleCtaPlan } from "../src/scenes/battleCta.ts";

const R = { x: 100, y: 400, w: 300, h: 52 };

describe("battleCtaPlan", () => {
  it("body sits inside the rect, inset by the bevel on every side", () => {
    const p = battleCtaPlan(R);
    expect(p.body.x).toBeGreaterThanOrEqual(R.x);
    expect(p.body.y).toBeGreaterThanOrEqual(R.y);
    expect(p.body.x + p.body.w).toBeLessThanOrEqual(R.x + R.w);
    expect(p.body.y + p.body.h).toBeLessThanOrEqual(R.y + R.h);
    expect(p.bevel).toBeGreaterThan(0);
  });

  it("gloss band hugs the TOP of the body and is at most half its height", () => {
    const p = battleCtaPlan(R);
    expect(p.gloss.x).toBeGreaterThanOrEqual(p.body.x);
    expect(p.gloss.x + p.gloss.w).toBeLessThanOrEqual(p.body.x + p.body.w);
    expect(p.gloss.y).toBeCloseTo(p.body.y, 0);
    expect(p.gloss.h).toBeLessThanOrEqual(p.body.h / 2);
  });

  it("emblem is anchored LEFT and the label is centered to its RIGHT", () => {
    const p = battleCtaPlan(R);
    expect(p.emblem.x).toBeLessThan(R.x + R.w / 2);
    expect(p.label.x).toBeGreaterThan(p.emblem.x);
    expect(p.emblem.size).toBeGreaterThan(0);
    expect(p.emblem.size).toBeLessThanOrEqual(R.h);
  });

  it("has four rivets, one inset into each corner of the body", () => {
    const p = battleCtaPlan(R);
    expect(p.rivets).toHaveLength(4);
    for (const rv of p.rivets) {
      expect(rv.x).toBeGreaterThan(p.body.x);
      expect(rv.x).toBeLessThan(p.body.x + p.body.w);
      expect(rv.y).toBeGreaterThan(p.body.y);
      expect(rv.y).toBeLessThan(p.body.y + p.body.h);
    }
    const xs = new Set(p.rivets.map((r) => Math.round(r.x)));
    const ys = new Set(p.rivets.map((r) => Math.round(r.y)));
    expect(xs.size).toBe(2); // two distinct columns
    expect(ys.size).toBe(2); // two distinct rows
  });

  it("sheen travel spans across (and slightly beyond) the full body width", () => {
    const p = battleCtaPlan(R);
    expect(p.sheen.x0).toBeLessThanOrEqual(p.body.x);
    expect(p.sheen.x1).toBeGreaterThanOrEqual(p.body.x + p.body.w);
    expect(p.sheen.w).toBeGreaterThan(0);
  });

  it("scales linearly with the rect (twice as wide ⇒ body twice as wide)", () => {
    const a = battleCtaPlan(R);
    const b = battleCtaPlan({ ...R, w: R.w * 2 });
    expect(b.body.w).toBeCloseTo(a.body.w + R.w, 0);
  });
});
