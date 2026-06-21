import { describe, it, expect } from "vitest";
import { battleSquarePlan } from "../src/scenes/battleSquare.ts";

const R = { x: 838, y: 416, w: 110, h: 110 };

describe("battleSquarePlan", () => {
  const p = battleSquarePlan(R);

  it("insets the inner content area inside the rim on every side", () => {
    expect(p.inner.x).toBeGreaterThan(R.x);
    expect(p.inner.y).toBeGreaterThan(R.y);
    expect(p.inner.x + p.inner.w).toBeLessThan(R.x + R.w);
    expect(p.inner.y + p.inner.h).toBeLessThan(R.y + R.h);
  });

  it("centres the emblem horizontally in the square", () => {
    expect(Math.abs(p.emblem.x - (R.x + R.w / 2))).toBeLessThan(1);
  });

  it("keeps the emblem fully inside the frame", () => {
    expect(p.emblem.x - p.emblem.size / 2).toBeGreaterThanOrEqual(R.x);
    expect(p.emblem.x + p.emblem.size / 2).toBeLessThanOrEqual(R.x + R.w);
    expect(p.emblem.y - p.emblem.size / 2).toBeGreaterThanOrEqual(R.y);
    expect(p.emblem.y + p.emblem.size / 2).toBeLessThanOrEqual(R.y + R.h);
  });

  it("seats the BATTLE ribbon along the bottom, below the emblem centre", () => {
    expect(p.ribbon.y).toBeGreaterThan(p.emblem.y);
    expect(p.ribbon.y + p.ribbon.h).toBeLessThanOrEqual(R.y + R.h);
    // centred horizontally
    expect(Math.abs(p.ribbon.x + p.ribbon.w / 2 - (R.x + R.w / 2))).toBeLessThan(1);
  });

  it("draws a halo glow that fully contains the frame", () => {
    expect(p.glow.x).toBeLessThan(R.x);
    expect(p.glow.y).toBeLessThan(R.y);
    expect(p.glow.x + p.glow.w).toBeGreaterThan(R.x + R.w);
    expect(p.glow.y + p.glow.h).toBeGreaterThan(R.y + R.h);
  });

  it("makes the emblem the dominant element (over half the square)", () => {
    expect(p.emblem.size).toBeGreaterThan(R.w * 0.5);
  });

  it("rounds the square corners (but not a full circle)", () => {
    expect(p.radius).toBeGreaterThan(0);
    expect(p.radius).toBeLessThan(R.h / 2);
  });
});
