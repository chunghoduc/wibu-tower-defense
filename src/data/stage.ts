/**
 * Stage 1 placeholder (Phase 1). One lane with a couple of bends, eight tower
 * slots, flying spawn points, and three waves culminating in a boss.
 *
 * Logical play area is 960x540; the scene scales this to the screen.
 */
import { makeStats, type StageDef } from "./schema.ts";

export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;

export const STAGE_1: StageDef = {
  id: "ch1-s1",
  name: "Greywood Pass",
  path: [
    { x: -20, y: 120 },
    { x: 300, y: 120 },
    { x: 300, y: 420 },
    { x: 660, y: 420 },
    { x: 660, y: 210 },
    { x: 900, y: 210 },
  ],
  airSpawns: [
    { x: -20, y: 480 },
    { x: -20, y: 60 },
  ],
  castleHp: 30,
  startingGold: 160,
  towerSlots: [
    { x: 200, y: 60 },
    { x: 360, y: 230 },
    { x: 360, y: 340 },
    { x: 520, y: 480 },
    { x: 600, y: 340 },
    { x: 740, y: 150 },
    { x: 820, y: 300 },
    { x: 480, y: 200 },
  ],
  waves: [
    {
      spawns: [
        { enemyId: "grunt", count: 6, interval: 1.0, delay: 0 },
        { enemyId: "runner", count: 3, interval: 0.8, delay: 5 },
      ],
    },
    {
      spawns: [
        { enemyId: "grunt", count: 8, interval: 0.8, delay: 0 },
        { enemyId: "gargoyle", count: 3, interval: 1.5, delay: 3 },
        { enemyId: "brute", count: 1, interval: 1, delay: 8 },
      ],
    },
    {
      spawns: [
        { enemyId: "grunt", count: 6, interval: 0.7, delay: 0 },
        { enemyId: "brute", count: 3, interval: 2.0, delay: 4 },
        { enemyId: "gargoyle", count: 4, interval: 1.2, delay: 6 },
        { enemyId: "warden", count: 1, interval: 1, delay: 12 },
      ],
    },
  ],
};

/** Default hero loadout for Phase 1 (Phase 3 replaces this with persistence). */
export function defaultHeroStats() {
  return makeStats({
    atk: 28,
    attackSpeed: 1.1,
    range: 130,
    critRate: 0.15,
    critDamage: 1.6,
    maxHp: 600,
    hpRegen: 8,
    armor: 30,
    moveSpeed: 160,
    maxMana: 100,
    manaOnHit: 12,
    manaRegen: 4,
    skillPower: 1.5,
    goldFind: 0.1,
  });
}
