import { describe, it, expect } from "vitest";
import { dockLayout } from "../src/scenes/menuLayout.ts";

const W = 960,
  H = 540;

describe("dockLayout", () => {
  it("produces one cell per item (12 = 6x2)", () => {
    const lay = dockLayout(12, W, H);
    expect(lay.cells).toHaveLength(12);
  });

  it("lays items out in row-major 6-wide rows", () => {
    const lay = dockLayout(12, W, H);
    const r0 = lay.cells.slice(0, 6).map((c) => c.y);
    const r1 = lay.cells.slice(6).map((c) => c.y);
    expect(new Set(r0).size).toBe(1);
    expect(new Set(r1).size).toBe(1);
    expect(r1[0]).toBeGreaterThan(r0[0]);
  });

  it("every cell sits inside the dock panel", () => {
    const lay = dockLayout(12, W, H);
    for (const c of lay.cells) {
      expect(c.x).toBeGreaterThanOrEqual(lay.panel.x);
      expect(c.x).toBeLessThanOrEqual(lay.panel.x + lay.panel.w);
      expect(c.y).toBeGreaterThanOrEqual(lay.panel.y);
      expect(c.y).toBeLessThanOrEqual(lay.panel.y + lay.panel.h);
    }
  });

  it("cells in a row do not overlap and are left-to-right", () => {
    const lay = dockLayout(12, W, H);
    const xs = lay.cells.slice(0, 6).map((c) => c.x);
    for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeGreaterThan(xs[i - 1]);
  });

  it("the grid is horizontally centred on the screen", () => {
    const lay = dockLayout(12, W, H);
    const xs = lay.cells.map((c) => c.x);
    const mid = (Math.min(...xs) + Math.max(...xs)) / 2;
    expect(Math.abs(mid - W / 2)).toBeLessThan(1);
  });

  it("docks in the lower portion, within bounds", () => {
    const lay = dockLayout(12, W, H);
    expect(lay.panel.y).toBeGreaterThan(H * 0.6);
    expect(lay.panel.x).toBeGreaterThanOrEqual(0);
    expect(lay.panel.x + lay.panel.w).toBeLessThanOrEqual(W);
    expect(lay.panel.y + lay.panel.h).toBeLessThanOrEqual(H);
  });

  it("is pure (same input → identical output)", () => {
    expect(dockLayout(12, W, H)).toEqual(dockLayout(12, W, H));
  });

  it("handles a non-multiple-of-6 count without crashing", () => {
    const lay = dockLayout(10, W, H);
    expect(lay.cells).toHaveLength(10);
  });
});
