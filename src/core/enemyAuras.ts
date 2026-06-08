/**
 * Support-enemy auras (Herald / Hexer). A support enemy projects a radial aura
 * that bolsters nearby allies — move speed, healing, flat damage reduction,
 * armor and magic resist — and (Hexer) slows nearby towers. The buffs are
 * TRANSIENT: recomputed every tick from current positions, so they vanish the
 * instant the support dies or an ally leaves the radius (no stale stacking).
 *
 * This module is pure (no Phaser, no BattleState): it maps a snapshot of
 * enemies to per-enemy buff mods. The battle loop applies the mods to movement
 * and damage mitigation, heals from `healPerSec`, and handles the tower slow
 * separately (it needs the tower list).
 */
import type { EnemyDef, Vec2 } from "../data/schema.ts";
import { dist } from "./path.ts";

export interface AuraMods {
  /** Multiplier on the ally's move speed (1 = none). */
  moveMult: number;
  /** Additive flat damage-reduction fraction contributed by auras. */
  drAdd: number;
  /** Flat armor added. */
  armorAdd: number;
  /** Flat magic resist added. */
  magicResistAdd: number;
}

/** Shared read-only "no buffs" mods — safe to alias since callers never mutate. */
export const NEUTRAL_AURA: AuraMods = { moveMult: 1, drAdd: 0, armorAdd: 0, magicResistAdd: 0 };

/** The minimal view of an enemy the aura pass reads. */
export interface AuraEnemy {
  uid: number;
  alive: boolean;
  pos: Vec2;
  def: EnemyDef;
}

export interface AuraResult {
  mods: AuraMods;
  /** Total healing-per-second this ally receives from nearby supports. */
  healPerSec: number;
}

/**
 * Compute each living enemy's aura buffs from every nearby support enemy.
 * Auras never buff their own emitter and stack additively across supports.
 * Returns only the enemies that actually receive a buff (uid → result).
 */
export function computeAuraMods(enemies: readonly AuraEnemy[]): Map<number, AuraResult> {
  const out = new Map<number, AuraResult>();
  const sources = enemies.filter((e) => e.alive && e.def.special?.supportAura);
  if (sources.length === 0) return out;

  for (const ally of enemies) {
    if (!ally.alive) continue;
    let moveMult = 1, drAdd = 0, armorAdd = 0, magicResistAdd = 0, healPerSec = 0;
    for (const s of sources) {
      if (s === ally) continue;
      const a = s.def.special!.supportAura!;
      if (dist(s.pos, ally.pos) > a.radius) continue;
      if (a.moveSpeedMult) moveMult *= a.moveSpeedMult;
      if (a.damageReductionAdd) drAdd += a.damageReductionAdd;
      if (a.armorAdd) armorAdd += a.armorAdd;
      if (a.magicResistAdd) magicResistAdd += a.magicResistAdd;
      if (a.healPerSec) healPerSec += a.healPerSec;
    }
    if (moveMult !== 1 || drAdd > 0 || armorAdd > 0 || magicResistAdd > 0 || healPerSec > 0) {
      out.set(ally.uid, { mods: { moveMult, drAdd, armorAdd, magicResistAdd }, healPerSec });
    }
  }
  return out;
}
