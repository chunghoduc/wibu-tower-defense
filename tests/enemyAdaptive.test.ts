import { describe, expect, it } from "vitest";
import { adaptiveImmuneType, advanceAdaptivePhase } from "../src/core/enemyAdaptive.ts";
import type { EnemySpecial } from "../src/data/schema.ts";

const AD: EnemySpecial = {
  adaptiveImmunity: { types: ["Physical", "Magic"], switchIntervalSec: 3.5 },
};

describe("enemyAdaptive", () => {
  it("reports the current immune type by phase index, wrapping", () => {
    expect(adaptiveImmuneType(AD, 0)).toBe("Physical");
    expect(adaptiveImmuneType(AD, 1)).toBe("Magic");
    expect(adaptiveImmuneType(AD, 2)).toBe("Physical");
    expect(adaptiveImmuneType(undefined, 0)).toBeNull();
    expect(adaptiveImmuneType({}, 0)).toBeNull();
  });

  it("advances the phase only when the timer expires", () => {
    const a = advanceAdaptivePhase(AD, 3.5, 0, 1);
    expect(a).toEqual({ timer: 2.5, index: 0, switched: false });
    const b = advanceAdaptivePhase(AD, 0.5, 0, 1); // 0.5 - 1 = -0.5 → +3.5
    expect(b.index).toBe(1);
    expect(b.switched).toBe(true);
    expect(b.timer).toBeCloseTo(3.0, 5);
  });

  it("handles a long dt that crosses multiple intervals", () => {
    const r = advanceAdaptivePhase(AD, 1, 0, 7.5); // 1-7.5=-6.5 → -3 (i1) → 0.5 (i0)
    expect(r.switched).toBe(true);
    expect(r.timer).toBeCloseTo(0.5, 5);
    expect(r.index).toBe(0); // two switches from index 0 → back to 0
  });

  it("is a no-op for non-adapters", () => {
    expect(advanceAdaptivePhase(undefined, 2, 0, 1)).toEqual({
      timer: 2,
      index: 0,
      switched: false,
    });
  });
});
