/**
 * Boss loot boxes (T15).
 *
 * Every stage clear guarantees one Boss Chest whose tier (1..5) scales with the
 * stage/boss. Opening a chest consumes it and rolls a balanced reward bundle:
 * crystals + Bless jewels (guaranteed, scaling), a chance at a Soul jewel, and a
 * good chance at a gear drop whose item level scales with the tier. Tiers are
 * tuned so a stronger boss is strictly more rewarding in expectation.
 */
import type { HeroSave, ItemInstanceSave } from "./save.ts";
import type { Rng } from "./rng.ts";
import { ITEM_CATALOG, rollItem, MAX_ITEM_REQ_LEVEL } from "../data/items.ts";
import { toItemInstanceSave } from "./itemDrop.ts";
import { BLESS_JEWEL, SOUL_JEWEL, MATERIALS_MAP } from "../data/materials.ts";

interface TierConfig {
  crystals: number;        // base crystals (×0.8..1.2 variance)
  bless: number;           // guaranteed bless jewels
  soulChance: number;      // chance of a soul jewel
  itemChance: number;      // chance of a gear drop
  itemLevel: number;       // item level rolled
}

const TIERS: Record<number, TierConfig> = {
  1: { crystals: 30, bless: 1, soulChance: 0.05, itemChance: 0.5, itemLevel: 10 },
  2: { crystals: 55, bless: 1, soulChance: 0.12, itemChance: 0.6, itemLevel: 22 },
  3: { crystals: 85, bless: 2, soulChance: 0.2, itemChance: 0.72, itemLevel: 38 },
  4: { crystals: 130, bless: 2, soulChance: 0.32, itemChance: 0.85, itemLevel: 54 },
  5: { crystals: 200, bless: 3, soulChance: 0.5, itemChance: 1, itemLevel: 72 },
};

export interface BoxReward {
  opened: boolean;
  crystals: number;
  materials: Record<string, number>;
  item: ItemInstanceSave | null;
}

export function tierOfBox(boxId: string): number {
  const m = boxId.match(/t(\d+)$/);
  return m ? Math.max(1, Math.min(5, parseInt(m[1], 10))) : 1;
}

export interface BoxOdds {
  tier: number;
  /** Base crystals (gold) before the ±20% roll variance. */
  crystals: number;
  bless: number;
  /** Soul-jewel chance, 0..1. */
  soulChance: number;
  /** Gear-drop chance, 0..1. */
  itemChance: number;
  /** Reference item level for the gear roll. */
  itemLevel: number;
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
  return [
    "Opening odds:",
    `• ~${o.crystals} gold + ${o.bless}× Bless Jewel (guaranteed)`,
    `• ${pct(o.soulChance)} Soul Jewel`,
    `• ${pct(o.itemChance)} gear drop (around lvl ${o.itemLevel})`,
  ].join("\n");
}

/** Open one chest of `boxId`, mutating `save`. Returns the rolled rewards (or
 *  opened:false if the player has none). */
export function openBox(save: HeroSave, boxId: string, rng: Rng): BoxReward {
  const empty: BoxReward = { opened: false, crystals: 0, materials: {}, item: null };
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
  give(BLESS_JEWEL, cfg.bless);
  if (rng.next() < cfg.soulChance) give(SOUL_JEWEL, 1);

  let item: ItemInstanceSave | null = null;
  if (rng.next() < cfg.itemChance) {
    // Box items roll a required level around the hero's level (±30%), capped at
    // 90 — so chests track the player's progression, and a high-level hero can
    // pull a level-90 Apex piece.
    const heroLevel = Math.max(1, save.hero.level);
    const reqLevel = Math.min(
      MAX_ITEM_REQ_LEVEL,
      Math.max(1, Math.round(heroLevel * (0.7 + rng.next() * 0.6))),
    );
    const eligible = ITEM_CATALOG.filter((d) => d.requiredLevel <= reqLevel);
    if (eligible.length > 0) {
      const def = eligible[Math.floor(rng.next() * eligible.length)];
      const inst = rollItem(def, reqLevel, Math.floor(rng.next() * 999983), reqLevel);
      item = toItemInstanceSave(inst);
      save.inventory.items.push(item);
    }
  }

  return { opened: true, crystals, materials, item };
}
