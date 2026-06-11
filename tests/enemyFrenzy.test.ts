import { describe, expect, it } from "vitest";
import { shouldFrenzy, frenzyMods } from "../src/core/enemyFrenzy.ts";
import type { EnemySpecial } from "../src/data/schema.ts";

const FR: EnemySpecial = { frenzy: { belowHpPct: 0.5, speedMult: 1.8, atkMult: 1.6 } };

describe("enemyFrenzy", () => {
  it("latches only below the threshold and only once", () => {
    expect(shouldFrenzy(FR, 0.6, false)).toBe(false);
    expect(shouldFrenzy(FR, 0.5, false)).toBe(true);
    expect(shouldFrenzy(FR, 0.2, true)).toBe(false); // already frenzied
    expect(shouldFrenzy(undefined, 0.1, false)).toBe(false);
    expect(shouldFrenzy({}, 0.1, false)).toBe(false);
  });

  it("multipliers are neutral until frenzied, then the configured values", () => {
    expect(frenzyMods(FR, false)).toEqual({ speedMult: 1, atkMult: 1 });
    expect(frenzyMods(FR, true)).toEqual({ speedMult: 1.8, atkMult: 1.6 });
    expect(frenzyMods(undefined, true)).toEqual({ speedMult: 1, atkMult: 1 });
  });
});
