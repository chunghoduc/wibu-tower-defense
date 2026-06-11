import { describe, it, expect } from "vitest";
import { buildEndlessBackdrop, emberPos, type Dims } from "../src/core/endlessBackdrop.ts";
import type { ArenaDef } from "../src/data/schema.ts";

const DIMS: Dims = { width: 1280, height: 720 };

// A tiny hand-made arena: center + 3 gates on different edges.
const ARENA: ArenaDef = {
  center: { x: 640, y: 360 },
  gates: [
    { x: 640, y: -20 },           // top
    { x: -20, y: 360 },           // left
    { x: 1300, y: 360 },          // right
  ],
  airSpawns: [],
  routes: [],
};

describe("buildEndlessBackdrop", () => {
  it("is deterministic for the same (arena, dims, seed)", () => {
    expect(buildEndlessBackdrop(ARENA, DIMS, 3)).toEqual(buildEndlessBackdrop(ARENA, DIMS, 3));
  });

  it("centers the vignette and castle ring on the arena center", () => {
    const s = buildEndlessBackdrop(ARENA, DIMS, 3);
    expect(s.vignette.cx).toBe(640);
    expect(s.vignette.cy).toBe(360);
    expect(s.castleRing.cx).toBe(640);
    expect(s.castleRing.cy).toBe(360);
    expect(s.vignette.outerR).toBeGreaterThan(s.vignette.innerR);
  });

  it("emits one battle-scar per gate, each starting at the castle and heading toward its gate", () => {
    const s = buildEndlessBackdrop(ARENA, DIMS, 3);
    expect(s.scars).toHaveLength(ARENA.gates.length);
    s.scars.forEach((scar, i) => {
      const first = scar.points[0];
      const last = scar.points[scar.points.length - 1];
      // starts at the castle
      expect(Math.hypot(first.x - 640, first.y - 360)).toBeLessThan(2);
      // far end is on the castle→gate side: dot(last-center, gate-center) > 0
      const gx = ARENA.gates[i].x, gy = ARENA.gates[i].y;
      const dot = (last.x - 640) * (gx - 640) + (last.y - 360) * (gy - 360);
      expect(dot).toBeGreaterThan(0);
      // far end stays on-screen (gates can sit off-map)
      expect(last.x).toBeGreaterThanOrEqual(0);
      expect(last.x).toBeLessThanOrEqual(DIMS.width);
      expect(last.y).toBeGreaterThanOrEqual(0);
      expect(last.y).toBeLessThanOrEqual(DIMS.height);
    });
  });

  it("scatters embers inside the field with sane alphas", () => {
    const s = buildEndlessBackdrop(ARENA, DIMS, 3);
    expect(s.embers.length).toBeGreaterThan(0);
    for (const e of s.embers) {
      expect(e.x).toBeGreaterThanOrEqual(0);
      expect(e.x).toBeLessThanOrEqual(DIMS.width);
      expect(e.y).toBeGreaterThanOrEqual(0);
      expect(e.y).toBeLessThanOrEqual(DIMS.height);
      expect(e.alpha).toBeGreaterThan(0);
      expect(e.alpha).toBeLessThanOrEqual(1);
    }
  });

  it("emberPos rises, wraps within height, and sways within drift", () => {
    const s = buildEndlessBackdrop(ARENA, DIMS, 3);
    const e = s.embers[0];
    for (const t of [0, 1.3, 5, 40]) {
      const p = emberPos(e, t, DIMS);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThan(DIMS.height);
      expect(Math.abs(p.x - e.x)).toBeLessThanOrEqual(e.drift + 1e-6);
    }
  });
});
