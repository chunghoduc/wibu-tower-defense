import { describe, expect, it } from "vitest";
import { staggerPlan, STAGGER_RISE } from "../src/scenes/uiMotion.ts";

describe("staggerPlan", () => {
  // Regression: SettingsScene tagged its toggle Zones "ctl" and fed them to
  // staggerIn. A Phaser Zone has NO Alpha component, so `o.alpha` is undefined;
  // the old code emitted `alpha: undefined` into tweens.add, and Phaser's tween
  // builder calls `.hasOwnProperty` on that undefined value → TypeError on open.
  it("skips interaction-only objects that have no numeric alpha (e.g. Phaser Zones)", () => {
    const text = { y: 100, alpha: 1 }; // real display object (Alpha component)
    const zone = { y: 50 } as { y: number; alpha?: number }; // Zone-like: no alpha

    const steps = staggerPlan([text, zone]);

    expect(steps).toHaveLength(1);
    expect(steps[0].index).toBe(0); // the Zone (index 1) is dropped
    // Never plan an undefined alpha — that is the exact value Phaser chokes on.
    for (const s of steps) expect(typeof s.toAlpha).toBe("number");
  });

  it("plans a fade-in from STAGGER_RISE px below, restoring each final y/alpha", () => {
    const a = { y: 10, alpha: 1 };
    const b = { y: 20, alpha: 0.8 };

    const steps = staggerPlan([a, b]);

    expect(steps).toHaveLength(2);
    expect(steps[0]).toMatchObject({
      index: 0,
      fromY: 10 + STAGGER_RISE,
      toY: 10,
      fromAlpha: 0,
      toAlpha: 1,
    });
    expect(steps[1]).toMatchObject({ index: 1, toY: 20, toAlpha: 0.8 });
  });

  it("carries the per-index stagger delay through", () => {
    const items = [
      { y: 0, alpha: 1 },
      { y: 0, alpha: 1 },
      { y: 0, alpha: 1 },
    ];
    const steps = staggerPlan(items, { step: 30, from: 0 });
    expect(steps.map((s) => s.delay)).toEqual([0, 30, 60]);
  });
});
