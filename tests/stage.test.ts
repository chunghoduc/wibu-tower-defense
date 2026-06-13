import { describe, it, expect } from "vitest";
import { STAGES, WORLD_WIDTH, WORLD_HEIGHT } from "../src/data/stage.ts";
import { groundLanes } from "../src/core/path.ts";

// Lane count we expect per Chapter 1 stage (1-indexed). Matches the design table.
const CH1_LANE_COUNT = [1, 1, 2, 2, 2, 2, 2, 2, 2, 3];

function ch1(): typeof STAGES {
  return STAGES.slice(0, 10);
}

function segDist(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const l2 = dx * dx + dy * dy || 1;
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

describe("Chapter 1 branching maps", () => {
  it("each stage exposes the designed number of ground lanes", () => {
    ch1().forEach((s, i) => {
      expect(groundLanes(s).length).toBe(CH1_LANE_COUNT[i]);
    });
  });

  it("path mirrors lanes[0] on multi-lane stages", () => {
    ch1().forEach((s) => {
      if (s.lanes && s.lanes.length > 0) expect(s.path).toEqual(s.lanes[0]);
    });
  });

  it("every lane has >=2 points and ends at the shared keep", () => {
    ch1().forEach((s) => {
      const keep = s.path[s.path.length - 1];
      for (const lane of groundLanes(s)) {
        expect(lane.length).toBeGreaterThanOrEqual(2);
        expect(lane[lane.length - 1]).toEqual(keep);
      }
    });
  });

  it("keeps every lane in-bounds of the world (allowing an off-screen entrance)", () => {
    ch1().forEach((s) => {
      for (const lane of groundLanes(s)) {
        for (const p of lane) {
          expect(p.x).toBeGreaterThanOrEqual(-60);
          expect(p.x).toBeLessThanOrEqual(WORLD_WIDTH + 60);
          expect(p.y).toBeGreaterThanOrEqual(-60);
          expect(p.y).toBeLessThanOrEqual(WORLD_HEIGHT + 60);
        }
      }
    });
  });

  it("generated terrain blocks none of the lanes", () => {
    ch1().forEach((s) => {
      for (const f of s.terrain ?? []) {
        if (!f.blocks) continue;
        for (const lane of groundLanes(s)) {
          for (let i = 1; i < lane.length; i++) {
            expect(segDist(f, lane[i - 1], lane[i])).toBeGreaterThan(f.r);
          }
        }
      }
    });
  });
});
