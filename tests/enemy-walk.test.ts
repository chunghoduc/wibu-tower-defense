import { describe, it, expect } from "vitest";
// @ts-expect-error — art-pipeline JS module (scripts/ is outside the TS project), no .d.ts
import { composeEnemyFrames, ENEMY_SPECS } from "../scripts/pixelart/creatures.mjs";

// Lowest (max) filled y on a canvas half. left=true → x < S/2, else x >= S/2.
function footY(cv: { w: number; d: (string | null)[] }, left: boolean): number {
  const S = cv.w;
  let maxY = -1;
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const inHalf = left ? x < S / 2 : x >= S / 2;
      if (inHalf && cv.d[y * S + x]) maxY = y;
    }
  return maxY;
}

function key(cv: { d: (string | null)[] }): string {
  return cv.d.map((c) => (c ? "1" : "0")).join("");
}

describe("composeEnemyFrames", () => {
  it("emits an 8-frame sheet with a 4-frame walk cycle", () => {
    const { names, frames } = composeEnemyFrames(ENEMY_SPECS.grunt);
    expect(names).toEqual(["idle", "walk1", "walk2", "walk3", "walk4", "atk1", "atk2", "hurt"]);
    expect(frames).toHaveLength(8);
    const S = frames[0].w;
    for (const f of frames) expect(f.w).toBe(S);
  });

  it("walk frames are pairwise distinct (not a uniform shear)", () => {
    const { frames } = composeEnemyFrames(ENEMY_SPECS.grunt);
    const walk = frames.slice(1, 5).map(key);
    expect(new Set(walk).size).toBe(4);
  });

  it("a biped strides: left/right foot asymmetry flips between contact frames", () => {
    const { names, frames } = composeEnemyFrames(ENEMY_SPECS.grunt);
    const f = (n: string) => frames[names.indexOf(n)];
    const d1 = footY(f("walk1"), true) - footY(f("walk1"), false); // <0: left foot lifted
    const d3 = footY(f("walk3"), true) - footY(f("walk3"), false); // >0: right foot lifted
    expect(d1).toBeLessThan(0);
    expect(d3).toBeGreaterThan(0);
  });

  it("legless bodies (slime/ghost/winged) compose 8 distinct frames without error", () => {
    for (const id of ["slime", "phantom", "gargoyle"] as const) {
      const { frames } = composeEnemyFrames(ENEMY_SPECS[id]);
      expect(frames).toHaveLength(8);
      expect(new Set(frames.map(key)).size).toBeGreaterThan(1);
    }
  });
});
