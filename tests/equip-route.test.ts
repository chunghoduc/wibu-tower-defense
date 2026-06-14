import { describe, it, expect } from "vitest";
import { equipRoute } from "../src/data/equipRoute.ts";

describe("equipRoute", () => {
  it("equips the first ring slot when both are free", () => {
    expect(equipRoute("Ring", {})).toEqual({ kind: "equip", slot: "Ring1" });
  });

  it("equips the remaining free ring slot (Ring1 taken)", () => {
    expect(equipRoute("Ring", { Ring1: "a" })).toEqual({ kind: "equip", slot: "Ring2" });
  });

  it("compares against BOTH rings, in order, when both slots are full", () => {
    expect(equipRoute("Ring", { Ring1: "a", Ring2: "b" })).toEqual({
      kind: "compare",
      slots: ["Ring1", "Ring2"],
    });
  });

  it("equips a single-slot category when free", () => {
    expect(equipRoute("Weapon", {})).toEqual({ kind: "equip", slot: "Weapon" });
  });

  it("compares the single occupied slot for a single-slot category", () => {
    expect(equipRoute("Weapon", { Weapon: "w" })).toEqual({
      kind: "compare",
      slots: ["Weapon"],
    });
  });
});
