import { describe, expect, it } from "vitest";
import { TRIGGERED_EFFECTS } from "../src/data/triggeredEffects.ts";
import { uniquePowerFor } from "../src/data/uniquePowers.ts";

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
});

describe("unique power → trigger assignment", () => {
  const u = (id: string, archetype?: string) =>
    uniquePowerFor({
      id,
      rarity: "Unique",
      primaryAffix: { type: "atk" },
      archetype: archetype as never,
    });

  it("signatures carry both their stat power and a trigger", () => {
    expect(u("dawnbreaker")?.trigger?.kind).toBe("execute");
    expect(u("aegis-of-dawn")?.trigger?.kind).toBe("reflect");
    expect(u("midas-paw")?.trigger?.kind).toBe("gold");
    expect(u("dawnbreaker")?.contribution({ uniqueCount: 1 }).more?.atk).toBeGreaterThan(0);
  });

  it("a procedural unique resolves to a power deterministically (stable across calls)", () => {
    const a = u("mythic-stormpiece", "magic");
    const b = u("mythic-stormpiece", "magic");
    expect(a?.id).toBe(b?.id);
  });

  it("non-uniques never get a power", () => {
    expect(
      uniquePowerFor({ id: "x", rarity: "Legendary", primaryAffix: { type: "atk" } }),
    ).toBeNull();
  });
});
