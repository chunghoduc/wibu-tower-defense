import { describe, it, expect } from "vitest";
import type { PassiveNodeDef } from "../src/data/schema.ts";
import { selectedChoice, effectiveNode } from "../src/core/passiveChoice.ts";

const choiceNode: PassiveNodeDef = {
  id: "x-mastery",
  type: "mastery",
  region: "brawler",
  name: "X Mastery",
  description: "Choose one.",
  gridX: 0,
  gridY: 0,
  neighbors: [],
  choices: [
    { id: "a", label: "A", increased: { critDamage: 0.2 } },
    { id: "b", label: "B", increased: { armorPen: 0.15 } },
    { id: "c", label: "C", flat: { maxHp: 100 } },
  ],
};

const plainNode: PassiveNodeDef = {
  id: "x-path",
  type: "path",
  region: "brawler",
  name: "Plain",
  description: "",
  gridX: 0,
  gridY: 0,
  neighbors: [],
  increased: { atk: 0.05 },
};

describe("selectedChoice", () => {
  it("returns the chosen option when recorded", () => {
    expect(selectedChoice(choiceNode, { "x-mastery": "b" })?.id).toBe("b");
  });
  it("returns null for an unrecorded choice node", () => {
    expect(selectedChoice(choiceNode, {})).toBeNull();
  });
  it("returns null for a non-choice node", () => {
    expect(selectedChoice(plainNode, { "x-path": "a" })).toBeNull();
  });
});

describe("effectiveNode", () => {
  it("uses the chosen option's stats", () => {
    const n = effectiveNode(choiceNode, { "x-mastery": "b" });
    expect(n.increased).toEqual({ armorPen: 0.15 });
    expect(n.flat).toBeUndefined();
  });
  it("falls back to the first option when unrecorded", () => {
    const n = effectiveNode(choiceNode, {});
    expect(n.increased).toEqual({ critDamage: 0.2 });
  });
  it("falls back to the first option when the recorded id is unknown", () => {
    const n = effectiveNode(choiceNode, { "x-mastery": "zzz" });
    expect(n.increased).toEqual({ critDamage: 0.2 });
  });
  it("passes a non-choice node through unchanged", () => {
    const n = effectiveNode(plainNode, {});
    expect(n).toBe(plainNode);
  });
  it("preserves identity fields on a choice node", () => {
    const n = effectiveNode(choiceNode, { "x-mastery": "c" });
    expect(n.id).toBe("x-mastery");
    expect(n.flat).toEqual({ maxHp: 100 });
    expect(n.increased).toBeUndefined();
  });
});
