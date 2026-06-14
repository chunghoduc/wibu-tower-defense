import { describe, it, expect } from "vitest";
import { rarityTex } from "./assetKeys.ts";

describe("rarityTex", () => {
  it("builds the rarity__<rarity> key", () => {
    expect(rarityTex("Legendary")).toBe("rarity__Legendary");
    expect(rarityTex("Common")).toBe("rarity__Common");
  });
});
