import { describe, expect, it } from "vitest";
import { equipLevelGate } from "../src/data/equipGate.ts";

describe("equipLevelGate", () => {
  it("is met when the hero level meets or exceeds the required level", () => {
    expect(equipLevelGate(20, 20).met).toBe(true);
    expect(equipLevelGate(25, 20).met).toBe(true);
  });

  it("is unmet below the required level", () => {
    expect(equipLevelGate(19, 20).met).toBe(false);
  });

  it("carries the resolved levels through", () => {
    const g = equipLevelGate(7, 40);
    expect(g.heroLevel).toBe(7);
    expect(g.reqLevel).toBe(40);
  });

  it("has an empty hint when met and a formatted hint when unmet", () => {
    expect(equipLevelGate(40, 40).hint).toBe("");
    expect(equipLevelGate(7, 40).hint).toBe("Requires level 40 · you are 7");
  });
});
