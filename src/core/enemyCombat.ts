/**
 * Resolves how an enemy attacks towers from its archetype and (for bosses) its
 * weapon — the single source of truth the battle sim consults. Authoring an
 * enemy never repeats this:
 *   - ordinary ground enemies get a short melee swipe in passing,
 *   - dedicated tower-killers keep their tuned `attacksTowers` range and stop to
 *     demolish,
 *   - every boss reaches as far as its weapon and never halts (it steamrolls),
 *   - plain flyers beeline the castle and ignore towers entirely.
 *
 * Only the weapon's RANGE is used here; an enemy's damage type stays whatever it
 * authored (EnemyDef.damageType), so a "thrown"-weapon boss still deals its own
 * Physical/Magic/True damage when it strikes a tower.
 */
import type { EnemyDef } from "../data/schema.ts";
import { weaponBaseRange } from "../data/weaponFamily.ts";
import { MELEE_TOWER_RANGE, BOSS_DEFAULT_TOWER_RANGE } from "./battleTypes.ts";

export interface TowerAttackProfile {
  /** How close (world units) a tower must be for this enemy to hit it. */
  range: number;
  /**
   * True: strike towers in passing without halting the march (bosses, flyers,
   * ordinary on-road melee). False: stop and demolish (dedicated sappers/raiders).
   */
  whileMoving: boolean;
}

/** The tower-attack profile for an enemy, or null if it never attacks towers. */
export function enemyTowerAttack(def: EnemyDef): TowerAttackProfile | null {
  if (def.boss) {
    // Bosses attack towers in range based on their weapon, marching all the while.
    const range = def.weapon ? weaponBaseRange(def.weapon) : BOSS_DEFAULT_TOWER_RANGE;
    return { range, whileMoving: true };
  }
  const authored = def.special?.attacksTowers;
  if (authored) {
    // Dedicated tower-killers: ground ones stop to demolish; flyers strike in passing.
    return { range: authored.range, whileMoving: def.flying };
  }
  // Plain flyers beeline the castle and never bother with towers.
  if (def.flying) return null;
  // Every other ground ("on road") enemy swipes at towers hugging the lane.
  return { range: MELEE_TOWER_RANGE, whileMoving: true };
}
