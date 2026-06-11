/**
 * Boss loot boxes (T15).
 *
 * Every stage clear guarantees one Boss Chest whose tier (1..5) scales with the
 * stage/boss. Opening a chest consumes it and rolls a balanced reward bundle:
 * crystals + Bless jewels (guaranteed, scaling), a chance at a Soul jewel, and a
 * good chance at a gear drop. Gear LEVEL and RARITY are orthogonal axes: LEVEL
 * tracks the hero (you always get something near your own level, whatever the
 * tier), RARITY tracks the box (a ±1 band around the box's rarity, weighted to
 * the lower side). They compose freely — a Unique box can hand a level-8 rookie
 * a real level-8 Unique — because the roll bypasses the def's rarity floor.
 * Tiers are tuned so a stronger boss is strictly more rewarding in expectation.
 */
import type { HeroSave, ItemInstanceSave } from "./save.ts";
import type { Rng } from "./rng.ts";
import { ITEM_CATALOG, rollItem, MAX_ITEM_REQ_LEVEL } from "../data/items.ts";
import { type Rarity, RARITIES } from "../data/schema.ts";
import { toItemInstanceSave } from "./itemDrop.ts";
import { BLESS_JEWEL, SOUL_JEWEL, SUMMON_SCROLL, OBLIVION_ORB, MATERIALS_MAP } from "../data/materials.ts";

/** One independent chance-based crafting-material roll on a box's loot table. */
interface BonusMaterial {
  id: string;
  chance: number;          // 0..1 — rolled once per open
}

interface TierConfig {
  crystals: number;          // base crystals (×0.8..1.2 variance)
  diamonds: number;          // guaranteed premium diamonds (×0.8..1.2 variance)
  bless: number;             // guaranteed bless jewels
  bonusMaterials: BonusMaterial[]; // independent chance drops (soul / scroll / orb)
  itemChances: number[];     // independent gear-drop chances — one roll per entry
}

// Bonus crafting materials are a single tier-scaled faucet (one independent roll
// each), so a stronger boss is strictly more rewarding and the tooltip lists them
// all from one place. Each material matches an existing sink: Soul Jewel → item
// enhance (+6→), Summoning Scroll → a free summon (gacha treat, high tier only),
// Oblivion Orb → a passive respec (slow trickle, keeps respec a choice not a reflex).
// NOTE: Awakening Crystal is deliberately absent — by design it is NOT a stage
// drop (see materials.ts), so boxes must not faucet it.
const soul = (chance: number): BonusMaterial => ({ id: SOUL_JEWEL, chance });
const scroll = (chance: number): BonusMaterial => ({ id: SUMMON_SCROLL, chance });
const orb = (chance: number): BonusMaterial => ({ id: OBLIVION_ORB, chance });

// Higher tiers drop MORE gear: each entry is an independent roll (its own
// rarity + level), so a Unique chest can hand you up to three pieces at once.
// Listed high→low so the leading roll is the "guaranteed-ish" one.
const TIERS: Record<number, TierConfig> = {
  1: { crystals: 30, diamonds: 2, bless: 1, bonusMaterials: [soul(0.05), orb(0.04)], itemChances: [0.6] },
  2: { crystals: 55, diamonds: 3, bless: 1, bonusMaterials: [soul(0.12), scroll(0.03), orb(0.06)], itemChances: [0.8, 0.4] },
  3: { crystals: 85, diamonds: 5, bless: 2, bonusMaterials: [soul(0.2), scroll(0.06), orb(0.09)], itemChances: [1, 0.5, 0.1] },
  4: { crystals: 130, diamonds: 8, bless: 2, bonusMaterials: [soul(0.32), scroll(0.1), orb(0.13)], itemChances: [1, 0.6, 0.4] },
  5: { crystals: 200, diamonds: 12, bless: 3, bonusMaterials: [soul(0.5), scroll(0.16), orb(0.18)], itemChances: [1, 0.8, 0.6] },
};

/** Item rarities low→high; a box of tier T centers on RARITY_LADDER[T-1]. */
const RARITY_LADDER: readonly Rarity[] = RARITIES;

// Gear rarity sits within ±1 of the box's own rarity, weighted to the lower
// side: the tier-below is the common case, the tier-above a rare treat. Weight
// that falls off either end of the ladder folds onto the nearest valid rarity.
const RARITY_W_BELOW = 0.6, RARITY_W_CENTER = 0.35, RARITY_W_ABOVE = 0.05;

/**
 * Rarity drop odds for a box tier — a ±1 band around the box's rarity, lower
 * side favoured. Pure (tier-only), so it drives BOTH the roll and the tooltip
 * and the two can never drift apart. Weights sum to 1; zero-chance tiers omitted.
 */
export function boxRarityOdds(tier: number): { rarity: Rarity; chance: number }[] {
  const last = RARITY_LADDER.length - 1;
  const center = Math.max(0, Math.min(last, Math.round(tier) - 1));
  const w = new Array<number>(RARITY_LADDER.length).fill(0);
  const add = (idx: number, weight: number) => {
    w[Math.max(0, Math.min(last, idx))] += weight; // clamp folds off-ladder weight inward
  };
  add(center - 1, RARITY_W_BELOW);
  add(center, RARITY_W_CENTER);
  add(center + 1, RARITY_W_ABOVE);
  return RARITY_LADDER
    .map((rarity, i) => ({ rarity, chance: Math.round(w[i] * 1e6) / 1e6 })) // fold may add floats
    .filter((o) => o.chance > 0);
}

/**
 * Pick a gear rarity for a box from its ±1 band (see boxRarityOdds). Every
 * rarity exists at every level — the level roll bypasses the rarity floor — so
 * there is no equippability constraint to honour here: rarity is purely the
 * box's axis.
 */
function pickBoxRarity(tier: number, rng: Rng): Rarity {
  const weighted = boxRarityOdds(tier);
  const total = weighted.reduce((a, o) => a + o.chance, 0);
  let r = rng.next() * total;
  for (const o of weighted) {
    r -= o.chance;
    if (r <= 0) return o.rarity;
  }
  return weighted[weighted.length - 1].rarity;
}

export interface BoxReward {
  opened: boolean;
  crystals: number;
  /** Premium diamonds granted this open (tier-scaled, guaranteed). */
  diamonds: number;
  materials: Record<string, number>;
  /** Every gear piece rolled this open (0..3) — higher tiers roll more. */
  items: ItemInstanceSave[];
}

export function tierOfBox(boxId: string): number {
  const m = boxId.match(/t(\d+)$/);
  return m ? Math.max(1, Math.min(5, parseInt(m[1], 10))) : 1;
}

export interface BoxOdds {
  tier: number;
  /** Base crystals (gold) before the ±20% roll variance. */
  crystals: number;
  /** Base diamonds before the ±20% roll variance. */
  diamonds: number;
  bless: number;
  /** Independent bonus-material chances (soul / scroll / orb), each 0..1. */
  bonusMaterials: BonusMaterial[];
  /** Independent gear-drop chances, each 0..1 — one roll per entry. */
  itemChances: number[];
}

/** The opening odds for a box id — drives the reward-panel "drop rate" tooltip. */
export function boxOdds(boxId: string): BoxOdds {
  const tier = tierOfBox(boxId);
  return { tier, ...TIERS[tier] };
}

/**
 * Human-readable opening odds for a box, shown in every box tooltip across the
 * UI (inventory + post-battle reward panel) so players see the drop rates before
 * opening. `\n`-joined; callers append it under the box's own description.
 */
export function boxOddsText(boxId: string): string {
  const o = boxOdds(boxId);
  const pct = (p: number) => `${Math.round(p * 100)}%`;
  const rarityLine = boxRarityOdds(o.tier).map((r) => `${pct(r.chance)} ${r.rarity}`).join(" · ");
  const gearLine = o.itemChances.map(pct).join(" · ");
  const bonusLine = o.bonusMaterials
    .map((b) => `${pct(b.chance)} ${MATERIALS_MAP.get(b.id)?.name ?? b.id}`)
    .join(" · ");
  return [
    "Opening odds:",
    `• ~${o.crystals} gold + ~${o.diamonds} diamonds + ${o.bless}× Bless Jewel (guaranteed)`,
    `• ${bonusLine}`,
    `• ${gearLine} gear drops (each scaled to your level)`,
    `   ↳ ${rarityLine}`,
  ].join("\n");
}

/** Open one chest of `boxId`, mutating `save`. Returns the rolled rewards (or
 *  opened:false if the player has none). */
export function openBox(save: HeroSave, boxId: string, rng: Rng): BoxReward {
  const empty: BoxReward = { opened: false, crystals: 0, diamonds: 0, materials: {}, items: [] };
  if (MATERIALS_MAP.get(boxId)?.kind !== "box") return empty;
  if ((save.materials[boxId] ?? 0) <= 0) return empty;
  save.materials[boxId] -= 1;

  const cfg = TIERS[tierOfBox(boxId)];
  const materials: Record<string, number> = {};
  const give = (id: string, n: number) => {
    if (n <= 0) return;
    save.materials[id] = (save.materials[id] ?? 0) + n;
    materials[id] = (materials[id] ?? 0) + n;
  };

  const crystals = Math.round(cfg.crystals * (0.8 + rng.next() * 0.4));
  save.currency.gold += crystals;
  const diamonds = Math.round(cfg.diamonds * (0.8 + rng.next() * 0.4));
  save.currency.diamonds += diamonds;
  give(BLESS_JEWEL, cfg.bless);
  // Independent roll per bonus material (soul / scroll / orb) — tier-scaled.
  for (const b of cfg.bonusMaterials) {
    if (rng.next() < b.chance) give(b.id, 1);
  }

  // One independent gear roll per entry in itemChances — higher tiers roll more.
  const tier = tierOfBox(boxId);
  const items: ItemInstanceSave[] = [];
  for (const chance of cfg.itemChances) {
    if (rng.next() >= chance) continue;
    const item = rollBoxItem(save, tier, rng);
    if (item) {
      save.inventory.items.push(item);
      items.push(item);
    }
  }

  return { opened: true, crystals, diamonds, materials, items };
}

/**
 * Roll one gear piece for a box of `tier`, on two orthogonal axes. LEVEL tracks
 * the hero (±15%), so a drop is always near what you can use, whatever the tier.
 * RARITY tracks the box (a ±1 band around its rarity, lower side favoured — see
 * pickBoxRarity). They compose because the roll bypasses the def's rarity floor,
 * so any rarity lands at the hero's level — a Unique box can give a rookie a
 * level-8 Unique (full Unique multipliers/affixes, level-8 scalars).
 */
function rollBoxItem(save: HeroSave, tier: number, rng: Rng): ItemInstanceSave | null {
  const heroLevel = Math.max(1, save.hero.level);
  const reqLevel = Math.max(
    1,
    Math.min(MAX_ITEM_REQ_LEVEL, Math.round(heroLevel * (0.85 + rng.next() * 0.3))),
  );
  const rarity = pickBoxRarity(tier, rng);
  const pool = ITEM_CATALOG.filter((d) => d.rarity === rarity);
  if (pool.length === 0) return null;
  const def = pool[Math.floor(rng.next() * pool.length)];
  const inst = rollItem(def, heroLevel, Math.floor(rng.next() * 999983), reqLevel, {
    ignoreFloor: true,
  });
  return toItemInstanceSave(inst);
}
