import { describe, expect, it } from "vitest";
import { lerpV, snapshotPositions } from "../src/scenes/renderLerp.ts";

describe("renderLerp", () => {
  it("lerps between prev and curr by alpha", () => {
    expect(lerpV({ x: 0, y: 10 }, { x: 10, y: 30 }, 0.5)).toEqual({ x: 5, y: 20 });
  });
  it("returns curr when no prev exists (fresh spawn)", () => {
    expect(lerpV(undefined, { x: 7, y: 8 }, 0.3)).toEqual({ x: 7, y: 8 });
  });
  it("alpha 0 → prev, alpha 1 → curr", () => {
    expect(lerpV({ x: 2, y: 4 }, { x: 12, y: 24 }, 0)).toEqual({ x: 2, y: 4 });
    expect(lerpV({ x: 2, y: 4 }, { x: 12, y: 24 }, 1)).toEqual({ x: 12, y: 24 });
  });
  it("snapshotPositions copies values (not references) and prunes stale uids", () => {
    const m = new Map<number, { x: number; y: number }>();
    m.set(99, { x: 0, y: 0 }); // stale entity from a previous tick
    const e = { uid: 1, pos: { x: 3, y: 4 } };
    snapshotPositions([e], m);
    expect(m.size).toBe(1);
    expect(m.get(1)).toEqual({ x: 3, y: 4 });
    e.pos.x = 100; // sim mutates pos in place — the snapshot must not follow
    expect(m.get(1)!.x).toBe(3);
  });
});
