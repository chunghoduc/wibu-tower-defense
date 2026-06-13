/**
 * Craft Wings — sacrifice ≥5 gear + a Feather + 1–4 Jewels of Chaos for a CHANCE
 * at a random-rarity pair of Wings. A pure gear sink: inputs are consumed whether
 * or not the craft succeeds, and the outcome rarity is biased one tier below the
 * average of the sacrificed gear (rare upside, common downside). Reuses the
 * existing 5-tier skywings item line for the minted wing — no new wing art.
 *
 * The odds helpers mirror boxes.ts/boxRarityOdds: a clamp-and-fold 3-point
 * distribution so preview and roll share one source of truth.
 *
 * Pure mutations on HeroSave (like smelt.ts / reforge.ts); SaveManager wraps with
 * persistence.
 */
import type { HeroSave, ItemInstanceSave } from "./save.ts";
import type { Rng } from "./rng.ts";
import { ITEM_CATALOG_MAP, rollItem, MAX_ITEM_REQ_LEVEL } from "../data/items.ts";
import { type Rarity, RARITIES } from "../data/schema.ts";
import { toItemInstanceSave } from "./itemDrop.ts";
import { JEWEL_OF_CHAOS, FEATHER } from "../data/materials.ts";

export const MIN_ITEMS = 5;
export const BASE_SUCCESS = 0.2;
export const JEWEL_BONUS = 0.1; // per extra jewel beyond the mandatory first
export const MAX_JEWELS = 4;
export const SUCCESS_CAP = 0.8;

/** Per-component success contribution by rarity. */
export const ITEM_RARITY_SUCCESS: Record<Rarity, number> = {
  Common: 0.01,
  Magic: 0.02,
  Rare: 0.04,
  Legendary: 0.07,
  Unique: 0.1,
};

// Outcome distribution: biased one tier DOWN from the component average.
const OUTCOME_W_BELOW = 0.6,
  OUTCOME_W_CENTER = 0.35,
  OUTCOME_W_ABOVE = 0.05;

const SKYWINGS_BY_RARITY: Record<Rarity, string> = {
  Common: "worn-skywings",
  Magic: "fine-skywings",
  Rare: "masterwork-skywings",
  Legendary: "heroic-skywings",
  Unique: "mythic-skywings",
};

/** The skywings def id minted for a given outcome rarity. */
export function skywingsDefId(rarity: Rarity): string {
  return SKYWINGS_BY_RARITY[rarity];
}

/**
 * Success chance for a craft. `rarities` is the rarity of every component item
 * (≥5); `jewels` is the Jewel-of-Chaos count (1..4). Clamped to [0, 0.80].
 */
export function wingSuccessChance(rarities: Rarity[], jewels: number): number {
  const j = Math.max(1, Math.min(MAX_JEWELS, jewels));
  const itemSum = rarities.reduce((s, r) => s + (ITEM_RARITY_SUCCESS[r] ?? 0), 0);
  const jewelBonus = JEWEL_BONUS * (j - 1);
  return Math.max(0, Math.min(SUCCESS_CAP, BASE_SUCCESS + itemSum + jewelBonus));
}

/**
 * Outcome rarity odds — a 3-point band { avg-1, avg, avg+1 } weighted
 * { .60, .35, .05 } around the rounded average component rarity. Off-ladder
 * weight folds onto the nearest valid tier. Pure; drives BOTH preview and roll.
 */
export function wingOutcomeOdds(rarities: Rarity[]): { rarity: Rarity; chance: number }[] {
  const last = RARITIES.length - 1;
  const mean =
    rarities.reduce((s, r) => s + RARITIES.indexOf(r), 0) / Math.max(1, rarities.length);
  const center = Math.max(0, Math.min(last, Math.round(mean)));
  const w = new Array<number>(RARITIES.length).fill(0);
  const add = (idx: number, weight: number) => {
    w[Math.max(0, Math.min(last, idx))] += weight; // clamp folds off-ladder weight inward
  };
  add(center - 1, OUTCOME_W_BELOW);
  add(center, OUTCOME_W_CENTER);
  add(center + 1, OUTCOME_W_ABOVE);
  return RARITIES.map((rarity, i) => ({ rarity, chance: Math.round(w[i] * 1e6) / 1e6 })).filter(
    (o) => o.chance > 0,
  );
}

function pickOutcomeRarity(rarities: Rarity[], rng: Rng): Rarity {
  const odds = wingOutcomeOdds(rarities);
  const total = odds.reduce((a, o) => a + o.chance, 0);
  let r = rng.next() * total;
  for (const o of odds) {
    r -= o.chance;
    if (r <= 0) return o.rarity;
  }
  return odds[odds.length - 1].rarity;
}

export interface CraftWingsRequest {
  itemIds: string[];
  jewels: number;
}

export type CraftWingsReason =
  | "too-few-items"
  | "bad-jewels"
  | "no-jewels"
  | "no-feather"
  | "missing-item";

export interface CraftWingsResult {
  ok: boolean;
  reason?: CraftWingsReason;
  /** present when ok: did the craft succeed? */
  success?: boolean;
  rarity?: Rarity;
  item?: ItemInstanceSave;
}

/**
 * Resolve a wing craft. Validates, then ALWAYS consumes inputs (the stake), then
 * rolls success and — on success — mints a skywings of the rolled rarity at the
 * hero's level. Mutates `save`.
 */
export function craftWings(save: HeroSave, req: CraftWingsRequest, rng: Rng): CraftWingsResult {
  const { itemIds, jewels } = req;
  if (itemIds.length < MIN_ITEMS) return { ok: false, reason: "too-few-items" };
  if (jewels < 1 || jewels > MAX_JEWELS) return { ok: false, reason: "bad-jewels" };
  if ((save.materials[JEWEL_OF_CHAOS] ?? 0) < jewels) return { ok: false, reason: "no-jewels" };
  if ((save.materials[FEATHER] ?? 0) < 1) return { ok: false, reason: "no-feather" };

  const equipped = new Set(Object.values(save.inventory.equipped).filter(Boolean) as string[]);
  const ids = new Set(itemIds);
  const selected = save.inventory.items.filter((it) => ids.has(it.id));
  if (selected.length < MIN_ITEMS || selected.some((it) => equipped.has(it.id))) {
    return { ok: false, reason: "missing-item" };
  }

  const rarities: Rarity[] = selected.map(
    (it) => ITEM_CATALOG_MAP.get(it.defId)?.rarity ?? "Common",
  );

  // Consume inputs (the stake is paid whatever the outcome).
  save.inventory.items = save.inventory.items.filter((it) => !ids.has(it.id));
  save.materials[JEWEL_OF_CHAOS] = (save.materials[JEWEL_OF_CHAOS] ?? 0) - jewels;
  save.materials[FEATHER] = (save.materials[FEATHER] ?? 0) - 1;

  if (rng.next() >= wingSuccessChance(rarities, jewels)) {
    return { ok: true, success: false };
  }

  const rarity = pickOutcomeRarity(rarities, rng);
  const def = ITEM_CATALOG_MAP.get(skywingsDefId(rarity))!;
  const heroLevel = Math.max(1, save.hero.level);
  const reqLevel = Math.min(MAX_ITEM_REQ_LEVEL, heroLevel);
  const inst = rollItem(def, heroLevel, Math.floor(rng.next() * 999983), reqLevel, {
    ignoreFloor: true,
  });
  const saved = toItemInstanceSave(inst);
  save.inventory.items.push(saved);
  return { ok: true, success: true, rarity, item: saved };
}
