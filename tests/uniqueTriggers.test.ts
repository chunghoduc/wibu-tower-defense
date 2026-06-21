import { describe, expect, it } from "vitest";
import {
  rollTrigger,
  triggerPoolFor,
  TRIGGER_POOLS,
  SIGNATURE_TRIGGER_POOLS,
} from "../src/data/uniqueTriggers.ts";
import { TRIGGERED_EFFECTS } from "../src/data/triggeredEffects.ts";
import { ITEM_CATALOG } from "../src/data/items.ts";

const u = (id: string, primaryType = "atk", archetype?: string) => ({
  id,
  rarity: "Unique",
  primaryAffix: { type: primaryType },
  archetype: archetype as never,
});

describe("trigger pools", () => {
  it("every pool key references a real catalog effect", () => {
    const pools = [...Object.values(TRIGGER_POOLS), ...Object.values(SIGNATURE_TRIGGER_POOLS)];
    for (const pool of pools) {
      expect(pool.length).toBeGreaterThan(0);
      for (const key of pool) expect(TRIGGERED_EFFECTS[key], key).toBeDefined();
    }
  });

  it("each archetype has at least two suitable triggers", () => {
    for (const [arch, pool] of Object.entries(TRIGGER_POOLS)) {
      expect(pool.length, arch).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("rollTrigger", () => {
  it("returns null for non-Unique items", () => {
    expect(rollTrigger({ ...u("x"), rarity: "Legendary" })).toBeNull();
    expect(rollTrigger({ ...u("x"), rarity: "Rare" }, "inst")).toBeNull();
  });

  it("is deterministic for a given instance id", () => {
    const a = rollTrigger(u("dawnbreaker"), "copyA");
    const b = rollTrigger(u("dawnbreaker"), "copyA");
    expect(a?.kind).toBe(b?.kind);
  });

  it("always rolls a trigger from the item's suitable pool", () => {
    const def = u("some-magic-unique", "skillPower");
    const poolEffects = triggerPoolFor(def).map((k) => TRIGGERED_EFFECTS[k]);
    for (const seed of ["a", "b", "c", "d", "e", "f"]) {
      const t = rollTrigger(def, seed);
      expect(poolEffects).toContain(t);
    }
  });

  it("two different copies of the same def CAN roll different triggers", () => {
    const def = u("variety-unique", "skillPower");
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) seen.add(rollTrigger(def, `copy-${i}`)!.kind);
    expect(seen.size).toBeGreaterThan(1);
  });

  it("signature items draw from their curated theme pool", () => {
    const dawn = SIGNATURE_TRIGGER_POOLS["dawnbreaker"].map((k) => TRIGGERED_EFFECTS[k]);
    for (let i = 0; i < 20; i++) expect(dawn).toContain(rollTrigger(u("dawnbreaker"), `c${i}`));
  });

  it("every Unique item in the catalog rolls a real trigger", () => {
    for (const def of ITEM_CATALOG.filter((d) => d.rarity === "Unique")) {
      const t = rollTrigger(def, `${def.id}-copy`);
      expect(t, def.id).not.toBeNull();
      expect(typeof t!.describe()).toBe("string");
    }
  });
});
