import type { Difficulty, EnemyDef } from "../data/schema.ts";
import type { Rng } from "./rng.ts";
import type { HeroSave, ItemInstanceSave } from "./save.ts";
import { awardHeroXp } from "./hero.ts";
import { rollItemDrop } from "./itemDrop.ts";
import { rollEliteBoxTier } from "./elite.ts";
import { boxIdForTier } from "../data/materials.ts";

// Per-kill drops persist immediately (the hero keeps XP/loot even if the stage
// is abandoned), so the chances are deliberately small — bulk loot still comes
// from the stage-clear reward.
const KILL_ITEM_DROP_CHANCE = 0.02;
const BOSS_ITEM_DROP_CHANCE = 0.5;

const DIFF_XP_MULT: Record<Difficulty, number> = { Normal: 1, Hard: 1.25, Nightmare: 1.5 };

/** XP granted for killing one enemy — scales with its bounty, bosses pay far more. */
export function killXpFor(def: EnemyDef, difficulty: Difficulty): number {
  const boss = def.archetype === "Boss";
  const base = Math.max(1, Math.round(def.bounty * (boss ? 4 : 1)));
  return Math.max(1, Math.round(base * DIFF_XP_MULT[difficulty]));
}

export interface KillReward {
  xp: number;
  itemDropped: ItemInstanceSave | null;
  /** Box material id granted by an elite kill (T17), else null. */
  boxDropped: string | null;
}

/**
 * Award the XP + (chance) item drop for a single enemy kill straight into the
 * save. The caller persists. Returns what was granted for floating-text FX.
 * An `elite` kill additionally drops a guaranteed weighted-rarity loot box.
 */
export function processEnemyKill(
  save: HeroSave,
  def: EnemyDef,
  difficulty: Difficulty,
  itemLevel: number,
  rng: Rng,
  elite = false,
): KillReward {
  const xp = killXpFor(def, difficulty);
  awardHeroXp(save, xp);
  const boss = def.archetype === "Boss";
  const chance = boss ? BOSS_ITEM_DROP_CHANCE : KILL_ITEM_DROP_CHANCE;
  // Only bosses can drop Legendary/Unique; regular enemies are capped at Rare.
  const itemDropped = rng.next() < chance ? rollItemDrop(save, itemLevel, rng, boss) : null;

  // Elites guarantee a loot box; its rarity is weighted toward Common (T17).
  let boxDropped: string | null = null;
  if (elite) {
    boxDropped = boxIdForTier(rollEliteBoxTier(rng));
    save.materials[boxDropped] = (save.materials[boxDropped] ?? 0) + 1;
  }

  return { xp, itemDropped, boxDropped };
}
