import { describe, it, expect } from "vitest";
import {
  clampZoom,
  treeBounds,
  clampScroll,
  frontierCenter,
  ZOOM_MIN,
  ZOOM_MAX,
} from "../src/scenes/passiveTreeCamera.ts";

const toPixel = (gx: number, gy: number) => ({ x: gx * 28, y: gy * 28 });
const nodes = [
  { id: "a", gridX: 0, gridY: 0 },
  { id: "b", gridX: 10, gridY: 6 },
  { id: "grid-start", gridX: 12, gridY: 9 },
];

describe("passiveTreeCamera", () => {
  it("clamps zoom to [ZOOM_MIN, ZOOM_MAX]", () => {
    expect(clampZoom(99)).toBe(ZOOM_MAX);
    expect(clampZoom(0.01)).toBe(ZOOM_MIN);
    expect(clampZoom(1)).toBe(1);
  });

  it("computes pixel bounds with margin", () => {
    const b = treeBounds(nodes, toPixel, 100);
    expect(b.minX).toBe(0 - 100);
    expect(b.maxX).toBe(12 * 28 + 100);
    expect(b.maxY).toBe(9 * 28 + 100);
  });

  it("clamps scroll so the camera stays within bounds", () => {
    const b = treeBounds(nodes, toPixel, 0);
    const s = clampScroll(99999, -99999, b, 800, 540, 1);
    expect(s.scrollX).toBeLessThanOrEqual(b.maxX);
    expect(s.scrollX).toBeGreaterThanOrEqual(b.minX);
    expect(s.scrollY).toBeGreaterThanOrEqual(b.minY - 540);
  });

  it("frontier center is the centroid of unlocked nodes", () => {
    const c = frontierCenter(nodes, ["a", "b"], toPixel);
    expect(c.x).toBeCloseTo((0 + 10 * 28) / 2);
    expect(c.y).toBeCloseTo((0 + 6 * 28) / 2);
  });

  it("frontier center falls back to grid-start when nothing unlocked", () => {
    const c = frontierCenter(nodes, [], toPixel);
    expect(c.x).toBe(12 * 28);
    expect(c.y).toBe(9 * 28);
  });
});
