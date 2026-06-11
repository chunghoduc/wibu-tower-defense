// src/data/towerSkillShapeIndex.ts
//
// id → SkillShape for every tower active skill, computed ONCE from the tower
// catalog at module load. Lives apart from attackStyle.ts so the classifier
// (towerSkillShape) stays free of a catalog import — this is the only module
// that pulls TOWERS in for the lookup. The VFX layer only has the skill-id
// string at cast time, so it looks the shape up here.
import { TOWERS } from "./towers.ts";
import { towerSkillShape, type SkillShape } from "./attackStyle.ts";

/** Every tower active id mapped to its mechanical-motion shape. */
export const SKILL_SHAPE: Record<string, SkillShape> = (() => {
  const m: Record<string, SkillShape> = {};
  for (const def of TOWERS) {
    if (def.active) m[def.active] = towerSkillShape(def);
  }
  return m;
})();

/** Shape for a skill id — falls back to "bolt" for hero/unknown/undefined ids. */
export function skillShapeFor(id: string | undefined): SkillShape {
  return (id ? SKILL_SHAPE[id] : undefined) ?? "bolt";
}
