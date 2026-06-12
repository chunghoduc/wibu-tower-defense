import { describe, it, expect } from "vitest";
import { castleArtState, castleTexForState } from "../src/scenes/castleArt.ts";
import { CASTLE_TEX, CASTLE_DAMAGED_TEX } from "../src/data/assetKeys.ts";

describe("castleArtState", () => {
  it("is intact above half health", () => {
    expect(castleArtState(15, 15)).toBe("intact");
    expect(castleArtState(8, 15)).toBe("intact"); // 53%
  });
  it("is damaged at or below half health", () => {
    expect(castleArtState(7.5, 15)).toBe("damaged"); // exactly 50%
    expect(castleArtState(7, 15)).toBe("damaged");
    expect(castleArtState(0, 15)).toBe("damaged");
  });
  it("treats negative (rubble) HP as damaged", () => {
    expect(castleArtState(-3, 15)).toBe("damaged");
  });
  it("guards against a zero/negative max (no divide-by-zero)", () => {
    expect(castleArtState(0, 0)).toBe("intact");
    expect(castleArtState(5, -1)).toBe("intact");
  });
});

describe("castleTexForState", () => {
  it("maps states to texture keys", () => {
    expect(castleTexForState("intact")).toBe(CASTLE_TEX);
    expect(castleTexForState("damaged")).toBe(CASTLE_DAMAGED_TEX);
  });
});
