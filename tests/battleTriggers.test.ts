import { describe, expect, it } from "vitest";
import { resolveBattleTriggers } from "../src/core/battleTriggers.ts";
import { createFreshSave } from "../src/core/save.ts";

const fakeInstance = (id: string, defId: string) => ({
  id,
  defId,
  acquiredLevel: 60,
  rolledStats: {},
  rolledPrimaryAffix: 0,
  rolledAffixes: [],
  enhanceLevel: 0,
});

describe("resolveBattleTriggers", () => {
  it("is empty when nothing is equipped", () => {
    const t = resolveBattleTriggers(createFreshSave());
    expect(t.onHit.length + t.onKill.length + t.onHurt.length + t.onCast.length + t.onCrit.length).toBe(
      0,
    );
  });

  it("buckets an equipped signature unique by its trigger event", () => {
    const save = createFreshSave();
    save.inventory.items.push(fakeInstance("inst1", "aegis-of-dawn") as never);
    save.inventory.equipped.BodyArmor = "inst1";
    const t = resolveBattleTriggers(save);
    expect(t.onHurt.map((e) => e.kind)).toContain("reflect");
  });

  it("buckets an on-hit signature (Dawnbreaker → executioner)", () => {
    const save = createFreshSave();
    save.inventory.items.push(fakeInstance("w1", "dawnbreaker") as never);
    save.inventory.equipped.Weapon = "w1";
    const t = resolveBattleTriggers(save);
    expect(t.onHit.map((e) => e.kind)).toContain("execute");
  });
});
