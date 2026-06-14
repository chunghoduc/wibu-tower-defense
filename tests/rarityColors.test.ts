import { describe, it, expect } from "vitest";
import { RARITY_INT, idealTextColor } from "../src/data/rarityColors.ts";

// Guard: a label drawn ON a filled rarity chip must stay legible. Dark rarities
// (Magic blue, Rare purple) need light text; light rarities (Common gray) need
// dark text. Regression: autoRecycleDialog used a fixed near-black label that
// vanished on the purple/blue selected chips.
describe("idealTextColor", () => {
  it("returns dark text on light backgrounds", () => {
    expect(idealTextColor(0xffffff)).toBe("#101010");
    expect(idealTextColor(RARITY_INT.Common)).toBe("#101010"); // #9e9e9e light gray
  });

  it("returns light text on dark / saturated backgrounds", () => {
    expect(idealTextColor(0x000000)).toBe("#ffffff");
    expect(idealTextColor(RARITY_INT.Rare)).toBe("#ffffff"); // #9c27b0 purple
    expect(idealTextColor(RARITY_INT.Magic)).toBe("#ffffff"); // #2196f3 blue
  });
});
