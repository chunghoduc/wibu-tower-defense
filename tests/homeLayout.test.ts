import { describe, it, expect } from "vitest";
import { homeTopBar, homeNavLayout } from "../src/scenes/homeLayout.ts";

const W = 960,
  H = 540;

describe("homeTopBar", () => {
  it("places gold to the RIGHT of diamonds (gold outermost)", () => {
    const t = homeTopBar(W, H);
    expect(t.gold.x).toBeGreaterThan(t.diamonds.x);
  });
  it("keeps both pills inside the screen and in the top band", () => {
    const t = homeTopBar(W, H);
    for (const p of [t.gold, t.diamonds]) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x + p.w).toBeLessThanOrEqual(W);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y + p.h).toBeLessThanOrEqual(H * 0.18);
    }
  });
  it("pills do not overlap", () => {
    const t = homeTopBar(W, H);
    expect(t.diamonds.x + t.diamonds.w).toBeLessThanOrEqual(t.gold.x);
  });
  it("brand anchor sits in the top-left", () => {
    const t = homeTopBar(W, H);
    expect(t.brand.x).toBeLessThan(W * 0.4);
    expect(t.brand.y).toBeLessThan(H * 0.18);
  });
});

describe("homeNavLayout", () => {
  const lay = () => homeNavLayout(11, W, H);

  it("produces exactly `secondaryCount` cells", () => {
    expect(lay().cells).toHaveLength(11);
  });
  it("primary CTA sits above every secondary cell and inside the panel", () => {
    const l = lay();
    expect(l.primary.x).toBeGreaterThanOrEqual(l.panel.x);
    expect(l.primary.x + l.primary.w).toBeLessThanOrEqual(l.panel.x + l.panel.w);
    for (const c of l.cells) expect(c.y).toBeGreaterThan(l.primary.y);
  });
  it("every cell sits inside the dock panel", () => {
    const l = lay();
    for (const c of l.cells) {
      expect(c.x).toBeGreaterThanOrEqual(l.panel.x);
      expect(c.x).toBeLessThanOrEqual(l.panel.x + l.panel.w);
      expect(c.y).toBeGreaterThanOrEqual(l.panel.y);
      expect(c.y).toBeLessThanOrEqual(l.panel.y + l.panel.h);
    }
  });
  it("rows are monotonic: row 2 below row 1, x ascends within a row", () => {
    const l = lay();
    const r0 = l.cells.slice(0, 6);
    const r1 = l.cells.slice(6);
    expect(new Set(r0.map((c) => c.y)).size).toBe(1);
    expect(r1[0].y).toBeGreaterThan(r0[0].y);
    const xs = r0.map((c) => c.x);
    for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeGreaterThan(xs[i - 1]);
  });
  it("the grid is horizontally centred on the screen", () => {
    const l = lay();
    const xs = l.cells.map((c) => c.x);
    const mid = (Math.min(...xs) + Math.max(...xs)) / 2;
    expect(Math.abs(mid - W / 2)).toBeLessThan(2);
  });
  it("the whole dock stays in the lower half of the screen", () => {
    const l = lay();
    expect(l.panel.y).toBeGreaterThan(H * 0.5);
    expect(l.panel.y + l.panel.h).toBeLessThanOrEqual(H);
  });
});
