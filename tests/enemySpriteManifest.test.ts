import { describe, it, expect } from "vitest";
import { SPRITE_MANIFEST } from "../src/data/spriteManifest.ts";

// The enemy convention: every regular enemy ships a SINGLE static SDXL sprite
// (frames === 1). ALL locomotion is the procedural enemyWalkTransform — there are
// no authored/baked walk frames. This is load-bearing:
//
//   * PreloadScene.create() builds idle/walk/attack anims ONLY for entries with
//     frames > 1, so a single-frame enemy is never frame-cycled (no animation
//     ever swaps its displayed frame).
//   * battleSceneSprites.ensureSprite() does `add.sprite(x, y, key)`, which shows
//     frame "0". The ONLY way an enemy could "show all frames at once" is if its
//     sheet were multi-frame AND something rendered the whole strip — so pinning
//     frames === 1 makes that class of bug structurally impossible.
//
// A future art regen that emits a multi-frame enemy sheet (or a manifest entry
// that disagrees with its names array) would silently reintroduce the "all frames
// shown together" / wrong-frame-slice regression. This test is the tripwire.
// See memory project_procedural_sprite_animation.

describe("enemy sprite manifest contract", () => {
  const enemies = SPRITE_MANIFEST.filter((e) => e.kind === "enemy");

  it("has a non-empty enemy roster", () => {
    expect(enemies.length).toBeGreaterThan(0);
  });

  for (const e of enemies) {
    it(`${e.id} is a single static frame (walks procedurally, never frame-cycled)`, () => {
      expect(e.frames, `${e.id} frames`).toBe(1);
      expect(e.names.length, `${e.id} names length`).toBe(1);
      // A single frame means the slice IS the whole image: width === one frame.
      // (frameWidth/frameHeight are the full PNG dims for a 1-frame sheet.)
      expect(e.frameWidth, `${e.id} frameWidth`).toBeGreaterThan(0);
      expect(e.frameHeight, `${e.id} frameHeight`).toBeGreaterThan(0);
    });
  }
});
