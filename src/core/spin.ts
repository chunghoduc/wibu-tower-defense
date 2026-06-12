/**
 * F4 — Daily Lucky Spin.
 *
 * One free weighted-wheel spin per calendar day; extra spins cost diamonds (a
 * sink). Variable-ratio dopamine kept fair by a pity counter: every 7th spin
 * without a "rare-band" prize forces one. Loop: Meta. Bartle: all.
 */
import type { HeroSave } from "./save.ts";
import { grantReward, type Reward } from "./rewards.ts";
import type { Rng } from "./rng.ts";
import { BLESS_JEWEL, SOUL_JEWEL, SUMMON_SCROLL, AWAKENING_CRYSTAL } from "../data/materials.ts";

export interface SpinPrize {
  id: string;
  label: string;
  /** Relative weight on the wheel. */
  weight: number;
  reward: Reward;
  /** Rare band — a "good" result that satisfies the pity guarantee. */
  rare?: boolean;
}

/** Diamonds for a paid (beyond the daily free) spin. */
export const PAID_SPIN_COST = 30;
/** Force a rare-band prize after this many non-rare spins. */
export const SPIN_PITY = 7;

export const SPIN_WHEEL: SpinPrize[] = [
  { id: "gold-sm", label: "200 Gold", weight: 30, reward: { gold: 200 } },
  { id: "gold-lg", label: "600 Gold", weight: 20, reward: { gold: 600 } },
  {
    id: "bless",
    label: "Jewel of Bless ×2",
    weight: 18,
    reward: { materials: { [BLESS_JEWEL]: 2 } },
  },
  { id: "diamonds-sm", label: "15 Diamonds", weight: 14, reward: { diamonds: 15 } },
  {
    id: "soul",
    label: "Jewel of Soul",
    weight: 8,
    reward: { materials: { [SOUL_JEWEL]: 1 } },
    rare: true,
  },
  {
    id: "scroll",
    label: "Summon Scroll",
    weight: 6,
    reward: { materials: { [SUMMON_SCROLL]: 1 } },
    rare: true,
  },
  { id: "diamonds-lg", label: "60 Diamonds", weight: 3, reward: { diamonds: 60 }, rare: true },
  {
    id: "jackpot",
    label: "Awakening Crystal",
    weight: 1,
    reward: { materials: { [AWAKENING_CRYSTAL]: 1 } },
    rare: true,
  },
];

const RARE_PRIZES = SPIN_WHEEL.filter((p) => p.rare);

export interface SpinResult {
  prize: SpinPrize;
  /** Whether the pity guarantee forced this result. */
  pityTriggered: boolean;
}

/** Whether the player's free daily spin is available. */
export function freeSpinAvailable(save: HeroSave, today: string): boolean {
  return save.meta.spin.lastSpinDate !== today;
}

function pickWeighted(pool: SpinPrize[], rng: Rng): SpinPrize {
  const total = pool.reduce((s, p) => s + p.weight, 0);
  let r = rng.next() * total;
  for (const p of pool) {
    r -= p.weight;
    if (r <= 0) return p;
  }
  return pool[pool.length - 1];
}

/**
 * Spin the wheel. `free` consumes the daily free spin (caller must verify
 * availability/affordability — this only rolls + grants). Updates spin pity.
 */
export function spin(save: HeroSave, today: string, rng: Rng, free: boolean): SpinResult {
  const st = save.meta.spin;
  let pityTriggered = false;
  let prize: SpinPrize;
  if (st.pityCount + 1 >= SPIN_PITY) {
    prize = pickWeighted(RARE_PRIZES, rng);
    pityTriggered = true;
  } else {
    prize = pickWeighted(SPIN_WHEEL, rng);
  }
  st.pityCount = prize.rare ? 0 : st.pityCount + 1;
  if (free) st.lastSpinDate = today;
  grantReward(save, prize.reward);
  return { prize, pityTriggered };
}
