import { describe, it, expect } from "vitest";
import { uniquePowerLine, uniqueTriggerLine } from "../src/data/itemDisplay.ts";
import { uniquePowerFor } from "../src/data/uniquePowers.ts";
import { ITEM_CATALOG } from "../src/data/items.ts";
import type { ItemDef } from "../src/data/schema.ts";

// Regression: the hover tooltip used to call uniquePowerLine(def) WITHOUT the
// instance id, so every procedural-Unique copy advertised the same power even
// though the battle stat pipeline (uniquePowerStats.ts) resolves the power from
// the COPY's instance id. The tooltip then lied about what the equipped item
// grants. uniquePowerLine must thread the instance id through so the displayed
// power equals uniquePowerFor(def, instanceId) — what the hero actually gets.
describe("uniquePowerLine — per-instance display matches battle resolution", () => {
  // A procedural (non-signature) Unique: a defense item whose power varies per copy.
  const proceduralUnique = (): ItemDef => {
    const base = ITEM_CATALOG.find((d) => d.slot === "BodyArmor")!;
    return { ...base, id: "test-proc-unique", rarity: "Unique" };
  };

  it("reflects the power of the specific instance id (not the def default)", () => {
    const def = proceduralUnique();
    // Find two instance ids that hash to DIFFERENT powers in the def's pool.
    let idA = "";
    let idB = "";
    for (let i = 0; i < 200 && (!idA || !idB); i++) {
      const id = `inst-${i}`;
      const power = uniquePowerFor(def, id)!.id;
      if (!idA) idA = id;
      else if (uniquePowerFor(def, idA)!.id !== power) idB = id;
    }
    expect(idB, "pool should contain >1 power so copies can differ").not.toBe("");

    const lineA = uniquePowerLine(def, idA)!;
    const lineB = uniquePowerLine(def, idB)!;
    expect(lineA.name).toBe(uniquePowerFor(def, idA)!.name);
    expect(lineB.name).toBe(uniquePowerFor(def, idB)!.name);
    expect(lineA.name).not.toBe(lineB.name); // the two copies show different powers
  });

  it("returns null for non-Unique items", () => {
    const def = { ...proceduralUnique(), rarity: "Legendary" as const };
    expect(uniquePowerLine(def, "inst-1")).toBeNull();
    expect(uniqueTriggerLine(def, "inst-1")).toBeNull();
  });

  it("signature Uniques show their fixed power regardless of instance id", () => {
    const aegis = ITEM_CATALOG.find((d) => d.id === "aegis-of-dawn");
    if (!aegis) return; // catalog guard
    const a = uniquePowerLine(aegis, "x")!;
    const b = uniquePowerLine(aegis, "y")!;
    expect(a.name).toBe(b.name);
  });
});
