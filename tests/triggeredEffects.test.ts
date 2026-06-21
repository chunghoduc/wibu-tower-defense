import { describe, expect, it } from "vitest";
import { TRIGGERED_EFFECTS } from "../src/data/triggeredEffects.ts";

describe("triggered-effect catalog", () => {
  it("every effect has an event, a kind, a sane chance, and a describe()", () => {
    for (const [id, e] of Object.entries(TRIGGERED_EFFECTS)) {
      expect(e.event, id).toMatch(/^on(Hit|Crit|Kill|Hurt|Cast)$/);
      expect(e.chance, id).toBeGreaterThan(0);
      expect(e.chance, id).toBeLessThanOrEqual(1);
      expect(typeof e.describe(), id).toBe("string");
      expect(e.describe().length, id).toBeGreaterThan(0);
    }
  });

  it("executioner is a chance-based non-boss kill; cull is a guaranteed threshold execute", () => {
    expect(TRIGGERED_EFFECTS.executioner.kind).toBe("execute");
    expect(TRIGGERED_EFFECTS.executioner.chance).toBeLessThan(1);
    expect(TRIGGERED_EFFECTS.cull.chance).toBe(1);
    expect(TRIGGERED_EFFECTS.cull.hpFrac).toBeGreaterThan(0);
  });

  it("thornmail reflects on being hit", () => {
    expect(TRIGGERED_EFFECTS.thornmail.event).toBe("onHurt");
    expect(TRIGGERED_EFFECTS.thornmail.kind).toBe("reflect");
  });

  it("carries the new creative kinds on the right events", () => {
    expect(TRIGGERED_EFFECTS.timewarp.kind).toBe("slow");
    expect(TRIGGERED_EFFECTS.timewarp.event).toBe("onHit");
    expect(TRIGGERED_EFFECTS.deepwound.kind).toBe("bleed");
    expect(TRIGGERED_EFFECTS.deepwound.event).toBe("onCrit");
    expect(TRIGGERED_EFFECTS.overkiller.kind).toBe("overkill");
    expect(TRIGGERED_EFFECTS.frostnova.kind).toBe("frostnova");
    expect(TRIGGERED_EFFECTS.pyreburst.kind).toBe("pyre");
    expect(TRIGGERED_EFFECTS.glaciate.event).toBe("onHurt");
    expect(TRIGGERED_EFFECTS.glaciate.kind).toBe("glaciate");
    expect(TRIGGERED_EFFECTS.painnova.kind).toBe("painnova");
    expect(TRIGGERED_EFFECTS.castfrost.event).toBe("onCast");
    expect(TRIGGERED_EFFECTS.castfrost.kind).toBe("castnova");
  });

  it("the slow effect declares a slow magnitude and duration", () => {
    expect(TRIGGERED_EFFECTS.timewarp.slowPct).toBeGreaterThan(0);
    expect(TRIGGERED_EFFECTS.timewarp.seconds).toBeGreaterThan(0);
  });

  it("carries the new DEFENSIVE on-hurt kinds with the fields their handlers read", () => {
    const def = ["frostguard", "aegisthorns", "secondwind", "undying"];
    for (const k of def) {
      expect(TRIGGERED_EFFECTS[k], k).toBeDefined();
      expect(TRIGGERED_EFFECTS[k].event, k).toBe("onHurt");
    }
    // frostguard = on-struck chill aura (slow magnitude + duration + radius)
    expect(TRIGGERED_EFFECTS.frostguard.kind).toBe("frostguard");
    expect(TRIGGERED_EFFECTS.frostguard.slowPct).toBeGreaterThan(0);
    expect(TRIGGERED_EFFECTS.frostguard.seconds).toBeGreaterThan(0);
    // aegisthorns = retaliate for a fraction of the hero's MAX HP
    expect(TRIGGERED_EFFECTS.aegisthorns.kind).toBe("aegisthorns");
    expect(TRIGGERED_EFFECTS.aegisthorns.hpFrac).toBeGreaterThan(0);
    // secondwind = low-HP last-stand heal (heal % + a threshold)
    expect(TRIGGERED_EFFECTS.secondwind.kind).toBe("secondwind");
    expect(TRIGGERED_EFFECTS.secondwind.hpFrac).toBeGreaterThan(0);
    expect(TRIGGERED_EFFECTS.secondwind.threshold).toBeGreaterThan(0);
    expect(TRIGGERED_EFFECTS.secondwind.threshold).toBeLessThan(1);
    // undying = cheat-death revive fraction
    expect(TRIGGERED_EFFECTS.undying.kind).toBe("undying");
    expect(TRIGGERED_EFFECTS.undying.hpFrac).toBeGreaterThan(0);
  });
});
