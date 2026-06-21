import { describe, it, expect } from "vitest";
import { battleCtaPlan, battleCtaContent, type ContentDims } from "../src/scenes/battleCta.ts";

const R = { x: 100, y: 400, w: 300, h: 52 };

describe("battleCtaPlan", () => {
  it("body sits inside the rect, inset by the rim on every side", () => {
    const p = battleCtaPlan(R);
    expect(p.body.x).toBeGreaterThanOrEqual(R.x);
    expect(p.body.y).toBeGreaterThanOrEqual(R.y);
    expect(p.body.x + p.body.w).toBeLessThanOrEqual(R.x + R.w);
    expect(p.body.y + p.body.h).toBeLessThanOrEqual(R.y + R.h);
    expect(p.rim).toBeGreaterThan(0);
  });

  it("is a capsule: corner radius equals half the height", () => {
    const p = battleCtaPlan(R);
    expect(p.radius).toBeCloseTo(R.h / 2, 5);
  });

  it("gloss band hugs the TOP of the body and is at most half its height", () => {
    const p = battleCtaPlan(R);
    expect(p.gloss.x).toBeGreaterThanOrEqual(p.body.x);
    expect(p.gloss.x + p.gloss.w).toBeLessThanOrEqual(p.body.x + p.body.w);
    expect(p.gloss.y).toBeGreaterThanOrEqual(p.body.y);
    expect(p.gloss.h).toBeLessThanOrEqual(p.body.h / 2);
  });

  it("glow halo fully contains the rect (a soft outer spread on every side)", () => {
    const p = battleCtaPlan(R);
    expect(p.glow.x).toBeLessThan(R.x);
    expect(p.glow.y).toBeLessThan(R.y);
    expect(p.glow.x + p.glow.w).toBeGreaterThan(R.x + R.w);
    expect(p.glow.y + p.glow.h).toBeGreaterThan(R.y + R.h);
  });

  it("scales linearly with the rect (twice as wide ⇒ body twice as wide)", () => {
    const a = battleCtaPlan(R);
    const b = battleCtaPlan({ ...R, w: R.w * 2 });
    expect(b.body.w).toBeCloseTo(a.body.w + R.w, 0);
  });
});

describe("battleCtaContent", () => {
  const dims: ContentDims = { iconSize: 26, iconGap: 8, textW: 110, chevGap: 10, chevW: 18 };

  it("centres the whole [icon · label · chevrons] unit horizontally in the rect", () => {
    const c = battleCtaContent(R, dims);
    const cx = R.x + R.w / 2;
    // Unit centre = (start + width/2) must equal rect centre.
    expect(c.start + c.width / 2).toBeCloseTo(cx, 5);
  });

  it("orders the parts left→right: icon, then label, then chevrons", () => {
    const c = battleCtaContent(R, dims);
    expect(c.iconCenter.x).toBeLessThan(c.labelCenter.x);
    expect(c.labelCenter.x).toBeLessThan(c.chevCenter.x);
  });

  it("aligns every part to the vertical centre line of the rect", () => {
    const c = battleCtaContent(R, dims);
    const cy = R.y + R.h / 2;
    expect(c.iconCenter.y).toBeCloseTo(cy, 5);
    expect(c.labelCenter.y).toBeCloseTo(cy, 5);
    expect(c.chevCenter.y).toBeCloseTo(cy, 5);
  });

  it("lays flourishes OUTSIDE the content unit, never overlapping it", () => {
    const c = battleCtaContent(R, dims);
    expect(c.leftFlank.x1).toBeLessThanOrEqual(c.start);
    expect(c.rightFlank.x0).toBeGreaterThanOrEqual(c.start + c.width);
    expect(c.leftFlank.y).toBeCloseTo(R.y + R.h / 2, 5);
  });

  it("widening the label pushes the chevrons further right and the icon further left", () => {
    const narrow = battleCtaContent(R, dims);
    const wide = battleCtaContent(R, { ...dims, textW: dims.textW + 60 });
    expect(wide.chevCenter.x).toBeGreaterThan(narrow.chevCenter.x);
    expect(wide.iconCenter.x).toBeLessThan(narrow.iconCenter.x);
  });
});
