// src/scenes/battleDepths.ts
//
// Single source of truth for BATTLE world-layer render depths. Phaser draws
// higher depth on top. Skill-cast VFX (SkillVfx + BossSkillFx) get their own
// SKILL_FX_UNDER band, strictly BELOW the unit sprites, so a cast never hides
// the enemy/boss it lands on — while still painting above the tilemap. All other
// FX (projectiles, melee, impacts, loot, damage numbers) stay at FX, on top of
// the units, where the player can read them.

/** Largest `depth + K` offset any skill-cast subsystem (SkillVfx / SkillElementFx /
 *  skillSignatures / BossSkillFx) adds on top of its base depth. The whole band
 *  [SKILL_FX_UNDER, SKILL_FX_UNDER + SKILL_FX_MAX_OFFSET] must stay below ENEMY. */
export const SKILL_FX_MAX_OFFSET = 6;

export const DEPTH = {
  GROUND: -12, // tilemap ground tiles
  ROAD: -11, // tilemap road tiles
  SKILL_FX_UNDER: -6, // SkillVfx + BossSkillFx base — beneath the units
  ENEMY_SHADOW: 1, // ground-contact shadow
  ENEMY_LEG: 1.5, // leg-puppet pieces — above the shadow, behind the body torso
  TERRAIN: 1, // SVG obstacles / decor
  ENEMY: 2, // enemy + boss + tower sprites
  HERO: 3, // hero layered sprite
  CASTLE: 4, // castle sprite
  DYN_GFX: 5, // HP/mana bars, aura rings, upgrade glow
  FX: 6, // projectiles, melee, impacts, loot, damage numbers
  ROLE_BADGE: 6, // tower role emblem
} as const;
