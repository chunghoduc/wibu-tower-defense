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

describe("homeNavLayout (rails + bottom row)", () => {
  const lay = () => homeNavLayout({ left: 4, right: 4, bottom: 3 }, W, H);

  it("produces exactly the requested per-region counts", () => {
    const l = lay();
    expect(l.left).toHaveLength(4);
    expect(l.right).toHaveLength(4);
    expect(l.bottom).toHaveLength(3);
  });

  it("left rail hugs the left edge, right rail hugs the right edge", () => {
    const l = lay();
    for (const c of l.left) expect(c.x).toBeLessThan(W * 0.15);
    for (const c of l.right) expect(c.x).toBeGreaterThan(W * 0.85);
  });

  it("each rail has a constant x and ascends in y (top to bottom)", () => {
    const l = lay();
    for (const rail of [l.left, l.right]) {
      const xs = new Set(rail.map((c) => c.x));
      expect(xs.size).toBe(1);
      for (let i = 1; i < rail.length; i++) expect(rail[i].y).toBeGreaterThan(rail[i - 1].y);
    }
  });

  it("rails are vertically centered and clear of the top band and the dock", () => {
    const l = lay();
    for (const rail of [l.left, l.right]) {
      const ys = rail.map((c) => c.y);
      const mid = (Math.min(...ys) + Math.max(...ys)) / 2;
      expect(Math.abs(mid - H * 0.46)).toBeLessThan(2);
      for (const c of rail) {
        expect(c.y - c.h / 2).toBeGreaterThan(H * 0.18);
        expect(c.y + c.h / 2).toBeLessThan(l.panel.y);
      }
    }
  });

  it("primary CTA sits above every bottom cell and inside the panel", () => {
    const l = lay();
    expect(l.primary.x).toBeGreaterThanOrEqual(l.panel.x);
    expect(l.primary.x + l.primary.w).toBeLessThanOrEqual(l.panel.x + l.panel.w);
    for (const c of l.bottom) expect(c.y).toBeGreaterThan(l.primary.y);
  });

  it("bottom row sits inside the dock, ascends in x, centered on W/2", () => {
    const l = lay();
    for (const c of l.bottom) {
      expect(c.x).toBeGreaterThanOrEqual(l.panel.x);
      expect(c.x).toBeLessThanOrEqual(l.panel.x + l.panel.w);
      expect(c.y).toBeGreaterThanOrEqual(l.panel.y);
      expect(c.y).toBeLessThanOrEqual(l.panel.y + l.panel.h);
    }
    const xs = l.bottom.map((c) => c.x);
    for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeGreaterThan(xs[i - 1]);
    const mid = (Math.min(...xs) + Math.max(...xs)) / 2;
    expect(Math.abs(mid - W / 2)).toBeLessThan(2);
  });

  it("the whole dock stays in the lower half and on-screen", () => {
    const l = lay();
    expect(l.panel.y).toBeGreaterThan(H * 0.5);
    expect(l.panel.y + l.panel.h).toBeLessThanOrEqual(H);
  });
});

describe("homeNavLayout primary CTA prominence", () => {
  it("makes the primary CTA taller than the secondary bottom cells", () => {
    const l = homeNavLayout({ left: 4, right: 4, bottom: 3 }, W, H);
    const bottomH = l.bottom[0].h;
    expect(l.primary.h).toBeGreaterThan(bottomH);
    expect(l.primary.h).toBe(52);
  });
  it("grows the dock panel to fully contain the taller primary + the row", () => {
    const l = homeNavLayout({ left: 4, right: 4, bottom: 3 }, W, H);
    expect(l.primary.y).toBeGreaterThanOrEqual(l.panel.y);
    const lastBottom = l.bottom[l.bottom.length - 1];
    expect(lastBottom.y + lastBottom.h / 2).toBeLessThanOrEqual(l.panel.y + l.panel.h);
    expect(l.panel.y + l.panel.h).toBeLessThanOrEqual(H);
  });
});
