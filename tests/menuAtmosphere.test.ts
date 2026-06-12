import { describe, it, expect } from "vitest";
import {
  buildMenuAtmosphere, motePos, emberPos, rayAlpha, flicker,
} from "../src/scenes/menuAtmosphere.ts";

const W = 960, H = 540, SEED = 1337;
const dims = { width: W, height: H };

describe("buildMenuAtmosphere", () => {
  it("is deterministic for a fixed seed", () => {
    expect(buildMenuAtmosphere(W, H, SEED)).toEqual(buildMenuAtmosphere(W, H, SEED));
  });

  it("produces populated, sane layers", () => {
    const s = buildMenuAtmosphere(W, H, SEED);
    expect(s.rays.length).toBeGreaterThanOrEqual(3);
    expect(s.motes.length).toBeGreaterThan(10);
    expect(s.embers.length).toBeGreaterThan(10);
    expect(s.torches.length).toBeGreaterThan(0);
    expect(s.vignette.cy).toBeLessThan(H / 2);
    expect(s.vignette.innerR).toBeLessThan(s.vignette.outerR);
    expect(Math.abs(s.keyLight.x - W / 2)).toBeLessThan(W * 0.2);
    expect(s.keyLight.y).toBeLessThan(H * 0.6);
  });

  it("places every mote and ember inside the canvas at t=0", () => {
    const s = buildMenuAtmosphere(W, H, SEED);
    for (const m of s.motes) {
      const p = motePos(m, 0, dims);
      expect(p.x).toBeGreaterThanOrEqual(-20); expect(p.x).toBeLessThanOrEqual(W + 20);
      expect(p.y).toBeGreaterThanOrEqual(-20); expect(p.y).toBeLessThanOrEqual(H + 20);
    }
    for (const e of s.embers) {
      const p = emberPos(e, 0, dims);
      expect(Number.isFinite(p.x)).toBe(true);
      expect(p.y).toBeGreaterThanOrEqual(0); expect(p.y).toBeLessThanOrEqual(H);
    }
  });

  it("keeps positions finite and embers rising across a time sweep", () => {
    const s = buildMenuAtmosphere(W, H, SEED);
    const e = s.embers[0];
    const y0 = emberPos(e, 0, dims).y, y1 = emberPos(e, 0.5, dims).y;
    expect(y1).toBeLessThan(y0);
    for (let t = 0; t < 12; t += 0.37) {
      for (const m of s.motes) {
        const p = motePos(m, t, dims);
        expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
      }
    }
  });

  it("rayAlpha and flicker are bounded in [0,1] and vary with t", () => {
    const s = buildMenuAtmosphere(W, H, SEED);
    const r = s.rays[0];
    const a0 = rayAlpha(r, 0), a1 = rayAlpha(r, 1.3);
    for (const a of [a0, a1]) { expect(a).toBeGreaterThanOrEqual(0); expect(a).toBeLessThanOrEqual(1); }
    expect(a0).not.toBe(a1);
    const f0 = flicker(0, 0.3), f1 = flicker(0.9, 0.3);
    for (const f of [f0, f1]) { expect(f).toBeGreaterThanOrEqual(0); expect(f).toBeLessThanOrEqual(1); }
    expect(f0).not.toBe(f1);
  });
});
