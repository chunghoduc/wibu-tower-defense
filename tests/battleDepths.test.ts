import { describe, it, expect } from "vitest";
import { DEPTH, SKILL_FX_MAX_OFFSET } from "../src/scenes/battleDepths.ts";

describe("battle depth registry ordering", () => {
  it("paints skill VFX above the map but below the units", () => {
    // Skill casts must still be visible on the battlefield...
    expect(DEPTH.GROUND).toBeLessThan(DEPTH.ROAD);
    expect(DEPTH.ROAD).toBeLessThan(DEPTH.SKILL_FX_UNDER);
    // ...and the ENTIRE skill-VFX band must sit below the enemy/boss sprite.
    expect(DEPTH.SKILL_FX_UNDER + SKILL_FX_MAX_OFFSET).toBeLessThan(DEPTH.ENEMY);
  });

  it("keeps units and normal combat feedback on top of skill VFX", () => {
    expect(DEPTH.ENEMY).toBeLessThan(DEPTH.HERO);
    // Damage numbers / projectiles / loot live at the FX band — must stay readable
    // (at or above the units), unlike the skill-cast band.
    expect(DEPTH.FX).toBeGreaterThanOrEqual(DEPTH.ENEMY);
    expect(DEPTH.SKILL_FX_UNDER).toBeLessThan(DEPTH.FX);
  });
});
