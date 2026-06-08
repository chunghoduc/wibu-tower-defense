/**
 * F5 — Daily Challenge modifiers. One is selected deterministically per day and
 * applied to that day's challenge battle. `effects` are multipliers the battle
 * sim reads at setup; the first clear each day pays a bonus.
 */
import type { Reward } from "../core/rewards.ts";
import { AWAKENING_CRYSTAL } from "./materials.ts";

export interface ChallengeEffects {
  enemySpeedMul?: number;
  enemyHpMul?: number;
  enemyArmorMul?: number;
  /** Loot multiplier applied to gold/diamond stage rewards on clear. */
  lootMul?: number;
  /** Tower placement cost multiplier (a buff when < 1). */
  towerCostMul?: number;
}

export interface ChallengeModifierDef {
  id: string;
  name: string;
  description: string;
  effects: ChallengeEffects;
  /** First-clear-of-the-day bonus. */
  reward: Reward;
}

export const CHALLENGE_MODIFIERS: ChallengeModifierDef[] = [
  {
    id: "blitz", name: "Blitz", description: "Enemies move 50% faster, but loot is doubled.",
    effects: { enemySpeedMul: 1.5, lootMul: 2 },
    reward: { diamonds: 25 },
  },
  {
    id: "glass", name: "Glass Cannons", description: "Enemies have +60% HP but no armor — and drop +50% loot.",
    effects: { enemyHpMul: 1.6, enemyArmorMul: 0, lootMul: 1.5 },
    reward: { diamonds: 25 },
  },
  {
    id: "fortified", name: "Fortified Foe", description: "Enemies gain +80% armor. Tower costs are halved.",
    effects: { enemyArmorMul: 1.8, towerCostMul: 0.5, lootMul: 1.5 },
    reward: { diamonds: 25 },
  },
  {
    id: "onslaught", name: "Onslaught", description: "Enemies are tougher and faster — triple loot for the bold.",
    effects: { enemyHpMul: 1.4, enemySpeedMul: 1.25, lootMul: 3 },
    reward: { diamonds: 35, materials: { [AWAKENING_CRYSTAL]: 1 } },
  },
  {
    id: "bargain", name: "War Economy", description: "Tower costs cut by 60%, but enemies have +40% HP.",
    effects: { towerCostMul: 0.4, enemyHpMul: 1.4, lootMul: 1.5 },
    reward: { diamonds: 25 },
  },
];

export const CHALLENGE_MODIFIERS_MAP = new Map<string, ChallengeModifierDef>(CHALLENGE_MODIFIERS.map((m) => [m.id, m]));
