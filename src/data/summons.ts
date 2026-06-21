/**
 * Summon archetypes — temporary friendly minions conjured by summon active
 * skills. Pure data + a Phaser-free stat-derivation helper. A minion's combat
 * stats scale off the SUMMONER's resolved attack/HP (a fraction), so summons
 * stay relevant as the hero/tower grows without their own progression system.
 *
 * Minions render PROCEDURALLY (an element-coloured spirit) — no sprite art — so
 * this never touches the SDXL pipeline or ASSET_VERSION.
 */
import type { DamageType } from "./schemaEnums.ts";
import { makeStats, type Stats } from "./schemaStats.ts";

export type SummonElement = "fire" | "ice" | "lightning" | "arcane" | "physical";

export interface SummonDef {
  id: string;
  name: string;
  element: SummonElement;
  /** Minion atk = summoner effAtk × atkFrac. */
  atkFrac: number;
  /** Minion maxHp = max(summoner maxHp × hpFrac, HP floor). */
  hpFrac: number;
  attackSpeed: number;
  range: number;
  damageType: DamageType;
  /** Default minions spawned per cast. */
  count: number;
  /** Seconds the minion lasts before fading. */
  lifespan: number;
  /** Optional slow applied on hit (frost summons). */
  slow?: { pct: number; duration: number };
}

/** Floor so a low-level summoner still gets a minion that survives a hit or two. */
const MIN_MINION_HP = 120;

export const SUMMONS: SummonDef[] = [
  {
    id: "flame-sprite",
    name: "Flame Sprite",
    element: "fire",
    atkFrac: 0.45,
    hpFrac: 0.04,
    attackSpeed: 1.6,
    range: 150,
    damageType: "Magic",
    count: 3,
    lifespan: 16,
  },
  {
    id: "frost-golem",
    name: "Frost Golem",
    element: "ice",
    atkFrac: 0.7,
    hpFrac: 0.18,
    attackSpeed: 0.7,
    range: 120,
    damageType: "Magic",
    count: 1,
    lifespan: 22,
    slow: { pct: 0.35, duration: 1.5 },
  },
  {
    id: "storm-hawk",
    name: "Storm Hawk",
    element: "lightning",
    atkFrac: 0.55,
    hpFrac: 0.05,
    attackSpeed: 1.3,
    range: 210,
    damageType: "Magic",
    count: 2,
    lifespan: 18,
  },
];

export const SUMMON_MAP = new Map<string, SummonDef>(SUMMONS.map((s) => [s.id, s]));

/** Derive a minion's battle Stats from its summoner's resolved atk + maxHp. */
export function minionStatsFrom(def: SummonDef, summonerAtk: number, summonerMaxHp: number): Stats {
  return makeStats({
    atk: Math.max(0, summonerAtk * def.atkFrac),
    maxHp: Math.max(MIN_MINION_HP, summonerMaxHp * def.hpFrac),
    attackSpeed: def.attackSpeed,
    range: def.range,
  });
}
