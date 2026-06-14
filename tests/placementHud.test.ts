import { describe, it, expect } from "vitest";
import {
  armedTileVisual,
  ghostAnchor,
  armHintText,
  BUILD_BAR_TOP,
} from "../src/core/placementHud.ts";

describe("armedTileVisual", () => {
  it("the armed tile lifts, brightens, and is selected", () => {
    expect(armedTileVisual({ anyArmed: true, isArmedTile: true, affordable: true })).toEqual({
      alpha: 1,
      scale: 1.12,
      selected: true,
    });
  });

  it("an unaffordable armed tile still highlights (you may earn gold)", () => {
    expect(armedTileVisual({ anyArmed: true, isArmedTile: true, affordable: false })).toEqual({
      alpha: 1,
      scale: 1.12,
      selected: true,
    });
  });

  it("other affordable cards dim while one is armed", () => {
    expect(armedTileVisual({ anyArmed: true, isArmedTile: false, affordable: true })).toEqual({
      alpha: 0.6,
      scale: 1,
      selected: false,
    });
  });

  it("other unaffordable cards stay at the unaffordable dim", () => {
    expect(armedTileVisual({ anyArmed: true, isArmedTile: false, affordable: false })).toEqual({
      alpha: 0.45,
      scale: 1,
      selected: false,
    });
  });

  it("nothing armed: affordable full, unaffordable dim, never selected", () => {
    expect(armedTileVisual({ anyArmed: false, isArmedTile: false, affordable: true })).toEqual({
      alpha: 1,
      scale: 1,
      selected: false,
    });
    expect(armedTileVisual({ anyArmed: false, isArmedTile: false, affordable: false })).toEqual({
      alpha: 0.45,
      scale: 1,
      selected: false,
    });
  });
});

describe("ghostAnchor", () => {
  const camCenter = { x: 640, y: 360 };
  it("a pointer inside the build-bar strip anchors the ghost at camera center", () => {
    expect(
      ghostAnchor({ pointerScreenY: BUILD_BAR_TOP, pointerWorld: { x: 10, y: 999 }, camCenter }),
    ).toEqual(camCenter);
    expect(ghostAnchor({ pointerScreenY: 520, pointerWorld: { x: 10, y: 999 }, camCenter })).toEqual(
      camCenter,
    );
  });
  it("a pointer over the field follows the real pointer world-point", () => {
    expect(
      ghostAnchor({ pointerScreenY: 300, pointerWorld: { x: 123, y: 200 }, camCenter }),
    ).toEqual({ x: 123, y: 200 });
  });
});

describe("armHintText", () => {
  it("is empty when nothing is armed", () => {
    expect(armHintText(null)).toBe("");
  });
  it("names the armed tower and tells the player to tap the map", () => {
    const t = armHintText("Vance the Drifter");
    expect(t).toContain("Vance the Drifter");
    expect(t.toLowerCase()).toContain("tap the map");
  });
});
