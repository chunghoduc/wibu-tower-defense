// src/data/skillMotif.ts
//
// Resolves the LITERAL projectile a skill fires from the caster — the thing the
// player actually sees leave the hero/tower. Hero actives author their motif on
// the SKILL_VFX spec (single source of truth); tower actives have no prose, so we
// derive a motif from their mechanical SkillShape. Area / melee / curse skills
// resolve to NO_MOTIF (nothing flies; the effect erupts at the target).
//
// Pure data — Phaser-free, fully testable.
import { SKILL_VFX, NO_MOTIF, type SkillMotif } from "./skillVfxMeta.ts";
import { SKILL_SHAPE } from "./towerSkillShapeIndex.ts";
import type { SkillShape } from "./attackStyle.ts";

/** The literal projectile a tower-skill SHAPE fires (or NO_MOTIF for area shapes). */
export function motifForShape(shape: SkillShape): SkillMotif {
  switch (shape) {
    case "barrage":
      return { kind: "bullet", count: 4, spread: "stream" };
    case "chain":
      return { kind: "orb", count: 3, spread: "stream" };
    case "beam":
      return { kind: "bolt", count: 1, spread: "pierce" };
    case "bolt":
      return { kind: "orb", count: 1, spread: "single" };
    // nova / slam / cloud / aura erupt AT the target — nothing is fired.
    case "nova":
    case "slam":
    case "cloud":
    case "aura":
      return NO_MOTIF;
  }
}

/**
 * The literal projectile motif for any skill id. Hero actives resolve to their
 * authored spec motif; tower actives derive from their SkillShape; unknown ids
 * fire nothing.
 */
export function skillMotif(skillId: string | undefined): SkillMotif {
  if (!skillId) return NO_MOTIF;
  const hero = SKILL_VFX[skillId]?.motif;
  if (hero) return hero;
  // No bespoke hero spec → tower active: derive from the mechanical shape, but
  // ONLY for ids that are genuinely in the tower roster. Unknown ids (typos) are
  // not in SKILL_SHAPE and fire nothing, rather than a spurious fallback orb.
  const shape = SKILL_SHAPE[skillId];
  return shape ? motifForShape(shape) : NO_MOTIF;
}
