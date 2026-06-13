import { describe, it, expect } from "vitest";
import {
  loadingHills,
  loadingTowers,
  loadingEmbers,
  emberAt,
} from "../src/core/loadingBackdrop.ts";

const W = 960;
const H = 540;

describe("loadingHills", () => {
  it("returns at least two bands ordered back -> front by depth", () => {
    const bands = loadingHills(W, H);
    expect(bands.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < bands.length; i++) {
      expect(bands[i].depth).toBeGreaterThan(bands[i - 1].depth);
    }
  });

  it("each band spans the full width and anchors to the bottom", () => {
    for (const b of loadingHills(W, H)) {
      const xs = b.points.map((p) => p.x);
      expect(Math.min(...xs)).toBeLessThanOrEqual(0);
      expect(Math.max(...xs)).toBeGreaterThanOrEqual(W);
      expect(b.points.some((p) => p.y >= H)).toBe(true);
    }
  });

  it("is deterministic", () => {
    expect(loadingHills(W, H)).toEqual(loadingHills(W, H));
  });
});

describe("loadingTowers", () => {
  it("returns 5-8 silhouettes ordered left -> right within bounds", () => {
    const towers = loadingTowers(W, H);
    expect(towers.length).toBeGreaterThanOrEqual(5);
    expect(towers.length).toBeLessThanOrEqual(8);
    for (let i = 0; i < towers.length; i++) {
      const t = towers[i];
      expect(t.x - t.width / 2).toBeGreaterThanOrEqual(0);
      expect(t.x + t.width / 2).toBeLessThanOrEqual(W);
      if (i > 0) expect(t.x).toBeGreaterThan(towers[i - 1].x);
    }
  });

  it("varies tower heights (not all equal) and keeps them above their base", () => {
    const towers = loadingTowers(W, H);
    const heights = new Set(towers.map((t) => Math.round(t.height)));
    expect(heights.size).toBeGreaterThan(1);
    for (const t of towers) {
      expect(t.height).toBeGreaterThan(0);
      expect(t.baseY).toBeLessThanOrEqual(H);
    }
  });

  it("is deterministic", () => {
    expect(loadingTowers(W, H)).toEqual(loadingTowers(W, H));
  });
});

describe("loadingEmbers", () => {
  it("returns exactly count embers within bounds", () => {
    const embers = loadingEmbers(W, H, 24);
    expect(embers).toHaveLength(24);
    for (const e of embers) {
      expect(e.x).toBeGreaterThanOrEqual(0);
      expect(e.x).toBeLessThanOrEqual(W);
      expect(e.y).toBeGreaterThanOrEqual(0);
      expect(e.y).toBeLessThanOrEqual(H);
      expect(e.r).toBeGreaterThan(0);
    }
  });

  it("is deterministic", () => {
    expect(loadingEmbers(W, H, 10)).toEqual(loadingEmbers(W, H, 10));
  });
});

describe("emberAt", () => {
  it("rises over time then wraps back near the bottom", () => {
    const [e] = loadingEmbers(W, H, 1);
    const start = emberAt(e, 0, H);
    const later = emberAt(e, 0.5, H);
    expect(later.y).toBeLessThan(start.y);
    const wrapped = emberAt(e, 1000, H);
    expect(wrapped.y).toBeGreaterThan(0);
    expect(wrapped.y).toBeLessThanOrEqual(H);
  });

  it("keeps x within bounds across the sway", () => {
    for (const e of loadingEmbers(W, H, 12)) {
      for (const t of [0, 0.25, 0.5, 1, 2, 5]) {
        const p = emberAt(e, t, H);
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(W);
      }
    }
  });
});
