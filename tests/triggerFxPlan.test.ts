import { describe, expect, it } from "vitest";
import { triggerFxPlan, type TriggerFxFamily } from "../src/data/triggerFxPlan.ts";
import { TRIGGERED_EFFECTS, type TriggerKind } from "../src/data/triggeredEffects.ts";

/** Every distinct kind referenced by the catalog (the universe the sim can proc). */
const ALL_KINDS = Array.from(
  new Set(Object.values(TRIGGERED_EFFECTS).map((e) => e.kind)),
) as TriggerKind[];

/** These already render their own VFX (chain bolt / loot pop) — no trigger flourish. */
const ALREADY_RENDERED: TriggerKind[] = ["chain", "gold"];

describe("triggerFxPlan", () => {
  it("maps every catalog kind that needs a flourish to a plan", () => {
    for (const kind of ALL_KINDS) {
      const plan = triggerFxPlan(kind);
      if (ALREADY_RENDERED.includes(kind)) {
        expect(plan, `${kind} should reuse existing VFX`).toBeNull();
      } else {
        expect(plan, `${kind} needs a plan`).not.toBeNull();
      }
    }
  });

  it("uses only known families", () => {
    const families: TriggerFxFamily[] = [
      "recoil",
      "nova",
      "frost",
      "dotSeed",
      "lifeflare",
      "execute",
      "spread",
      "resurrect",
    ];
    for (const kind of ALL_KINDS) {
      const plan = triggerFxPlan(kind);
      if (plan) expect(families).toContain(plan.family);
    }
  });

  it("gives each plan a real colour", () => {
    for (const kind of ALL_KINDS) {
      const plan = triggerFxPlan(kind);
      if (plan) {
        expect(plan.color).toBeGreaterThanOrEqual(0);
        expect(plan.color).toBeLessThanOrEqual(0xffffff);
      }
    }
  });

  it("brands the marquee saves with a banner + big flag", () => {
    const undying = triggerFxPlan("undying");
    expect(undying?.family).toBe("resurrect");
    expect(undying?.label).toBe("UNDYING!");
    expect(undying?.big).toBe(true);

    const secondwind = triggerFxPlan("secondwind");
    expect(secondwind?.family).toBe("lifeflare");
    expect(secondwind?.label).toBe("SECOND WIND");
    expect(secondwind?.big).toBe(true);

    const execute = triggerFxPlan("execute");
    expect(execute?.family).toBe("execute");
    expect(execute?.label).toBe("EXECUTE");
  });

  it("routes control procs to frost and retaliation to recoil", () => {
    for (const k of ["frostguard", "frostnova", "glaciate", "freeze", "slow", "castnova"] as const)
      expect(triggerFxPlan(k)?.family).toBe("frost");
    for (const k of ["reflect", "aegisthorns", "riposte"] as const)
      expect(triggerFxPlan(k)?.family).toBe("recoil");
    for (const k of ["pyre", "cinder", "poison", "bleed"] as const)
      expect(triggerFxPlan(k)?.family).toBe("dotSeed");
  });
});
