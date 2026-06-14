/**
 * Expedition quest tiers. The board (core/expeditionBoard.ts) is built from these
 * pure definitions: one tier per Rarity, each fixing a dispatch duration, the
 * tower-slot rarity requirements, a board-generation weight, a player-facing
 * reward hint, and a seeded reward roll that scales up with rarity. Reward is
 * rolled at CLAIM time (a surprise) — never stored on the quest.
 */
import { RARITIES, type Rarity } from "./schemaEnums.ts";
import type { Reward } from "../core/rewards.ts";
import type { Rng } from "../core/rng.ts";
import {
  BLESS_JEWEL,
  SOUL_JEWEL,
  SUMMON_SCROLL,
  CHAOS_JEWEL,
  AWAKENING_CRYSTAL,
  JEWEL_OF_CHAOS,
  FEATHER,
} from "./materials.ts";

const MIN = 60 * 1000;
const HOUR = 60 * MIN;

/** Strength index of a rarity (Common = 0 … Unique = 4). */
export function rarityRank(r: Rarity): number {
  return RARITIES.indexOf(r);
}

/** Inclusive integer in [lo, hi] from one rng draw. */
function intRange(rng: Rng, lo: number, hi: number): number {
  return lo + Math.floor(rng.next() * (hi - lo + 1));
}

export interface QuestTierDef {
  rarity: Rarity;
  durationMs: number;
  /** Minimum rarity required per dispatched tower slot. */
  slots: Rarity[];
  /** Relative weight for board generation (higher = more common). */
  genWeight: number;
  /** [min, max] gold payout (also the tier's gold "floor" for ordering). */
  goldRange: [number, number];
  /** Short, spoiler-free payout hint shown on the card. */
  rewardHint: string;
  /** Roll the actual reward (surprise) — always grants at least some gold. */
  rewardRoll(rng: Rng): Reward;
}

/** Build a tier def, wiring the standard roll shape (gold + diamond + materials). */
function tier(
  rarity: Rarity,
  durationMs: number,
  slots: Rarity[],
  genWeight: number,
  goldRange: [number, number],
  rewardHint: string,
  roll: (rng: Rng, reward: Reward) => void,
): QuestTierDef {
  return {
    rarity,
    durationMs,
    slots,
    genWeight,
    goldRange,
    rewardHint,
    rewardRoll(rng: Rng): Reward {
      const reward: Reward = { gold: intRange(rng, goldRange[0], goldRange[1]) };
      roll(rng, reward);
      return reward;
    },
  };
}

/** Add `n` of a material to a reward bundle. */
function mat(reward: Reward, id: string, n: number): void {
  if (n <= 0) return;
  reward.materials = { ...(reward.materials ?? {}), [id]: (reward.materials?.[id] ?? 0) + n };
}

export const QUEST_TIERS: Record<Rarity, QuestTierDef> = {
  Common: tier("Common", 15 * MIN, ["Common"], 40, [80, 160], "Pocket change", (rng, r) => {
    if (rng.chance(0.1)) r.diamonds = 1;
    if (rng.chance(0.25)) mat(r, BLESS_JEWEL, 1);
  }),
  Magic: tier("Magic", 45 * MIN, ["Common", "Magic"], 27, [220, 420], "Tidy haul", (rng, r) => {
    if (rng.chance(0.3)) r.diamonds = intRange(rng, 1, 2);
    if (rng.chance(0.4)) mat(r, rng.chance(0.5) ? SOUL_JEWEL : BLESS_JEWEL, 1);
  }),
  Rare: tier(
    "Rare",
    2 * HOUR,
    ["Magic", "Rare"],
    20,
    [600, 1050],
    "Solid loot · gems",
    (rng, r) => {
      if (rng.chance(0.5)) r.diamonds = intRange(rng, 2, 4);
      mat(r, SOUL_JEWEL, intRange(rng, 1, 2));
      if (rng.chance(0.25)) mat(r, SUMMON_SCROLL, 1);
    },
  ),
  Legendary: tier(
    "Legendary",
    6 * HOUR,
    ["Rare", "Rare", "Legendary"],
    10,
    [1700, 3000],
    "Big haul · rare mats",
    (rng, r) => {
      if (rng.chance(0.8)) r.diamonds = intRange(rng, 5, 10);
      mat(r, AWAKENING_CRYSTAL, 1);
      if (rng.chance(0.5)) mat(r, CHAOS_JEWEL, 1);
      if (rng.chance(0.35)) mat(r, SUMMON_SCROLL, 1);
    },
  ),
  Unique: tier(
    "Unique",
    12 * HOUR,
    ["Legendary", "Legendary", "Unique"],
    3,
    [4800, 8000],
    "Jackpot · premium mats",
    (rng, r) => {
      r.diamonds = intRange(rng, 14, 28);
      mat(r, AWAKENING_CRYSTAL, 2);
      mat(r, JEWEL_OF_CHAOS, 1);
      mat(r, FEATHER, 1);
      mat(r, SUMMON_SCROLL, 1);
    },
  ),
};

/** A generated, persistable quest on the board. */
export interface QuestInstance {
  id: string;
  rarity: Rarity;
  slots: Rarity[];
  durationMs: number;
  /** 0 = Available; >0 = epoch ms the quest was dispatched. */
  startedAt: number;
  /** Tower ids locked to this quest while it runs. */
  assigned: string[];
}

/** Pick a tier by gen weight and instantiate an Available quest with the given id. */
export function generateQuest(rng: Rng, id: string): QuestInstance {
  const tiers = RARITIES.map((r) => QUEST_TIERS[r]);
  const total = tiers.reduce((s, t) => s + t.genWeight, 0);
  let roll = rng.next() * total;
  let chosen = tiers[0];
  for (const t of tiers) {
    roll -= t.genWeight;
    if (roll < 0) {
      chosen = t;
      break;
    }
  }
  return {
    id,
    rarity: chosen.rarity,
    slots: [...chosen.slots],
    durationMs: chosen.durationMs,
    startedAt: 0,
    assigned: [],
  };
}
