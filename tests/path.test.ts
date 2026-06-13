import { describe, expect, it } from "vitest";
import { dist, pathLength, pointAtDistance, groundLanes } from "../src/core/path.ts";

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

describe("groundLanes", () => {
  const path = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
  ];
  const lanes = [
    [
      { x: 0, y: 0 },
      { x: 5, y: 5 },
    ],
    [
      { x: 0, y: 9 },
      { x: 5, y: 5 },
    ],
  ];
  const routes = [
    [
      { x: 1, y: 1 },
      { x: 2, y: 2 },
    ],
  ];

  it("returns [path] for a single-lane stage", () => {
    expect(groundLanes({ path })).toEqual([path]);
  });

  it("returns lanes when present", () => {
    expect(groundLanes({ path, lanes })).toBe(lanes);
  });

  it("falls back to [path] for empty lanes", () => {
    expect(groundLanes({ path, lanes: [] })).toEqual([path]);
  });

  it("prefers arena routes over lanes and path", () => {
    expect(groundLanes({ path, lanes, arena: { routes } })).toBe(routes);
  });
});
