import { describe, expect, it } from "vitest";
import { resolveBattleTriggers } from "../src/core/battleTriggers.ts";
import { createFreshSave } from "../src/core/save.ts";
import { TRIGGERED_EFFECTS } from "../src/data/triggeredEffects.ts";
import { SIGNATURE_TRIGGER_POOLS } from "../src/data/uniqueTriggers.ts";

const fakeInstance = (id: string, defId: string) => ({
  id,
  defId,
  acquiredLevel: 60,
  rolledStats: {},
  rolledPrimaryAffix: 0,
  rolledAffixes: [],
  enhanceLevel: 0,
});

const allTriggers = (t: ReturnType<typeof resolveBattleTriggers>) => [
  ...t.onHit,
  ...t.onCrit,
  ...t.onKill,
  ...t.onHurt,
  ...t.onCast,
];

describe("resolveBattleTriggers", () => {
  it("is empty when nothing is equipped", () => {
    expect(allTriggers(resolveBattleTriggers(createFreshSave())).length).toBe(0);
  });

  it("rolls exactly one trigger for an equipped unique, from its theme pool", () => {
    const save = createFreshSave();
    save.inventory.items.push(fakeInstance("inst1", "aegis-of-dawn") as never);
    save.inventory.equipped.BodyArmor = "inst1";
    const t = resolveBattleTriggers(save);
    const all = allTriggers(t);
    expect(all.length).toBe(1);
    const pool = SIGNATURE_TRIGGER_POOLS["aegis-of-dawn"].map((k) => TRIGGERED_EFFECTS[k]);
    expect(pool).toContain(all[0]);
    // and it is bucketed under its own declared event
    expect(t[all[0].event].length).toBe(1);
  });

  it("buckets the rolled effect under its declared event", () => {
    const save = createFreshSave();
    save.inventory.items.push(fakeInstance("w1", "dawnbreaker") as never);
    save.inventory.equipped.Weapon = "w1";
    const t = resolveBattleTriggers(save);
    const e = allTriggers(t)[0];
    expect(t[e.event]).toContain(e);
  });

  it("two different copies of the same unique can resolve different triggers", () => {
    const kinds = new Set<string>();
    for (let i = 0; i < 30; i++) {
      const save = createFreshSave();
      save.inventory.items.push(fakeInstance(`copy-${i}`, "dawnbreaker") as never);
      save.inventory.equipped.Weapon = `copy-${i}`;
      kinds.add(allTriggers(resolveBattleTriggers(save))[0].kind);
    }
    expect(kinds.size).toBeGreaterThan(1);
  });
});
