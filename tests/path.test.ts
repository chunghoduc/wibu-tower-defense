import { describe, expect, it } from "vitest";
import { dist, pathLength, pointAtDistance } from "../src/core/path.ts";

const L: { x: number; y: number }[] = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
];

describe("path geometry", () => {
  it("computes euclidean distance", () => {
    expect(dist({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it("sums polyline length", () => {
    expect(pathLength(L)).toBe(200);
  });

  it("locates a point partway along the first segment", () => {
    expect(pointAtDistance(L, 50)).toEqual({ x: 50, y: 0 });
  });

  it("locates a point on a later segment", () => {
    expect(pointAtDistance(L, 150)).toEqual({ x: 100, y: 50 });
  });

  it("clamps before the start and past the end", () => {
    expect(pointAtDistance(L, -10)).toEqual({ x: 0, y: 0 });
    expect(pointAtDistance(L, 999)).toEqual({ x: 100, y: 100 });
  });
});
