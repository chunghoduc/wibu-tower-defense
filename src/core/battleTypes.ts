/**
 * Shared types, tuning constants, and pure helpers for the battle simulation.
 * Split out of `battle.ts` so the BattleState class and its per-concern method
 * modules (battleWaves/battleEnemies/battleTowers/battleDamage) can share one
 * vocabulary without a circular dependency. All re-exported from `battle.ts`.
 */
import {
  type CharacterDef,
  type DamageType,
  type Difficulty,
  type EnemyDef,
  type Immunity,
  type Stats,
  type TargetType,
  type TowerBehavior,
  type Vec2,
  type WeaponType,
} from "../data/schema.ts";
import type { Dot } from "./effects.ts";
import type { AuraMods } from "./enemyAuras.ts";
import type { HeroSave } from "./save.ts";
import type { TargetFilter } from "./targeting.ts";
import type { ChallengeEffects } from "../data/challengeModifiers.ts";

export type Outcome = "ongoing" | "won" | "lost";

/** Distance from point p to segment a-b (for lane-clearance checks). */
export function segDist(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const l2 = dx * dx + dy * dy || 1;
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/**
 * Transient visual events emitted by the sim each tick for the renderer to
 * animate (projectiles, swings, hits, deaths, casts, loot). `BattleState.fx`
 * holds the current tick's events; it is cleared at the start of every tick.
 */
export type FxEvent =
  | { type: "attack"; uid: number; from: Vec2; to: Vec2; ranged: boolean; damageType: DamageType; crit: boolean; role: string; source: "tower" | "hero"; style: string }
  | { type: "hit"; uid: number; at: Vec2; damageType: DamageType; amount: number; aoe: boolean }
  | { type: "death"; at: Vec2; boss: boolean; elite: boolean; bounty: number }
  | { type: "enemyAttack"; uid: number; at: Vec2; targetAt: Vec2; target: "hero" | "tower" }
  | { type: "cast"; uid: number; from: Vec2; at: Vec2; damageType: DamageType; radius: number; source: "tower" | "hero"; skillId?: string }
  | { type: "splash"; at: Vec2; radius: number; damageType: DamageType }
  | { type: "chain"; from: Vec2; to: Vec2 }
  | { type: "bossCast"; uid: number; at: Vec2; skill: string; radius: number; name: string }
  | { type: "loot"; at: Vec2; to: Vec2; gold: number }
  | { type: "killReward"; at: Vec2; to: Vec2; xp: number; item: boolean; itemDefId: string | null; box: string | null }
  // F13 combo: rapid-kill streak feedback. `mult` is the current gold multiplier.
  | { type: "combo"; at: Vec2; count: number; mult: number }
  // F14 perfect wave: a wave cleared with zero leaks. `bonus` is the bonus gold.
  | { type: "perfect"; waveIndex: number; bonus: number }
  // Wave wiped out before the cadence elapsed: a short auto-skip countdown begins
  // and `bonus` (the time-saved gold) is banked immediately.
  | { type: "autoskip"; bonus: number };

/** Debug context threaded into applyDamage so the combat logger can print the
 * full per-hit formula (only built when logging is on). */
export interface DmgCtx {
  src: string;
  kind: string;
  rawFormula: string;
  crit?: { rate: number; roll: number; hit: boolean; mult: number };
}

/** How close an enemy must be to the hero to be body-blocked into melee. */
export const HERO_BLOCK_RANGE = 28;
/**
 * Melee reach an ordinary ground ("on road") enemy uses to swipe at towers as it
 * marches past. Set just above LANE_CLEARANCE (30) so only towers planted right
 * against the road are threatened — towers set back a little stay safe.
 */
export const MELEE_TOWER_RANGE = 40;
/** Fallback tower-attack reach for a boss that authors no weapon. */
export const BOSS_DEFAULT_TOWER_RANGE = 70;
/**
 * A boss's per-hit damage is scaled by this when it strikes a TOWER (not the hero
 * or castle), so a tank tower can wall a sieging boss for a while before it falls.
 * Bosses now halt on towers (see enemyCombat.ts); without this softening even the
 * tankiest tower would pop in ~2-3 hits and the siege would feel pointless.
 */
export const BOSS_TOWER_DAMAGE_MULT = 0.4;
/**
 * Ground enemies at or above this base moveSpeed are treated as high-speed
 * rushers: they blow past the lane and beeline the castle instead of stopping to
 * swipe at towers (like flyers and stealthed infiltrators). Set above the
 * ordinary melee band (grunt 44) but at/below the fast rushers (runner 92,
 * courier 72). Dedicated tower-killers (authored `attacksTowers`) override this.
 */
export const RUSHER_BYPASS_SPEED = 70;
/** Default radius of splash / active-skill AoE bursts. */
export const SPLASH_RADIUS = 60;
/** Mana is a fixed charge bar: every caster fills the same 0..100 pool. */
export const MANA_MAX = 100;
/** Flat mana every caster gains per basic-attack hit (10% of the bar). */
export const MANA_PER_HIT = 10;
/** The `manaOnHit` bonus stat is clamped to this before it adds to the per-hit gain. */
export const MANA_ON_HIT_CAP = 15;
/** Total mana a unit gains per hit: the flat base plus its capped on-hit bonus (10..25). */
export function manaGainOnHit(stats: Stats): number {
  return MANA_PER_HIT + Math.min(MANA_ON_HIT_CAP, Math.max(0, stats.manaOnHit));
}
/** Endless / boss-rush pause between waves once the current wave is fully cleared. */
export const INTER_WAVE_DELAY = 3;
/**
 * Campaign auto-skip: when a wave is wiped out before its cadence elapses, the
 * next wave auto-launches after this short on-screen countdown (and the player
 * banks the time-saved bonus gold immediately) — clearing fast is rewarded with
 * tempo instead of forcing a tap on the ⏩ button.
 */
export const AUTO_SKIP_COUNTDOWN = 3;
/**
 * Campaign cadence: a stage launches its next wave this many seconds after the
 * previous one *spawned* — not when it clears. Stall and waves stack up on you.
 */
export const WAVE_INTERVAL = 30;
/**
 * Skip reward: calling the next wave early pays this much in-battle gold per
 * second still on the countdown (a full 30s skip ≈ 60g, about one cheap tower).
 * The earlier you call, the more you earn — trading safety for tempo + gold.
 */
export const SKIP_COIN_PER_SEC = 2;
/** F13 combo: seconds a streak survives without a kill before it resets. */
export const COMBO_DECAY = 2.5;
/** F13 combo: gold multiplier caps at this value (×3 at full streak). */
export const COMBO_MAX_MULT = 3;
/** F13 combo: kills needed to reach the max multiplier. */
export const COMBO_KILLS_FOR_MAX = 20;
/** F14 perfect wave: bonus gold = this fraction of the gold earned that wave. */
export const PERFECT_WAVE_BONUS_FRAC = 0.25;
/** Free-placement: towers can't be placed within this distance of the lane. */
export const LANE_CLEARANCE = 30;
/** Free-placement: minimum spacing between two towers. */
export const MIN_TOWER_DIST = 34;
/** Free-placement: keep towers this far inside the world edges. */
export const PLACE_MARGIN = 14;
/**
 * Max in-battle upgrades a tower can buy. A freshly placed tower is ★1 (battleLevel
 * 0, base power); two upgrades take it to ★2 and ★3 (battleLevel 2 = maxed). The
 * player-facing star count is always battleLevel + 1.
 */
export const MAX_TOWER_UPGRADES = 2;
/** Boss skill mana gained per second (T16); a boss casts roughly every manaCost/this seconds. */
export const BOSS_MANA_REGEN = 14;
/** Fraction of a tower's invested gold refunded on sell. */
export const TOWER_SELL_REFUND = 0.6;

export interface EnemyRuntime {
  uid: number;
  def: EnemyDef;
  stats: Stats;
  hp: number;
  shield: number;
  flying: boolean;
  stealth: boolean;
  /** A stealthed enemy is revealed (and tower-targetable) while in hero range (T9). */
  revealed: boolean;
  distanceAlong: number;
  /** The polyline this enemy walks (campaign: stage.path; arena: a chosen corridor). */
  route: Vec2[];
  /** Cached length of `route` (== totalPathLen for campaign). */
  routeLen: number;
  airProgress: number;
  airStart: Vec2;
  pos: Vec2;
  threat: number;
  alive: boolean;
  attackCd: number;
  // Status effects.
  slowPct: number;
  slowTimer: number;
  stunTimer: number;
  dots: Dot[];
  // Special / boss timers.
  summonTimer: number;
  bossSummonTimer: number;
  bossDisableTimer: number;
  enraged: boolean;
  /** Berserker: latched into frenzy (one-way, like `enraged`). */
  frenzied: boolean;
  /** Adapter: countdown to the next immunity switch, and the current phase index. */
  adaptPhaseTimer: number;
  adaptPhaseIndex: number;
  /** Disruptor: countdown to the next tower-disable pulse. */
  disablePulseTimer: number;
  /** Elite (T17): a promoted normal enemy — boosted stats, bigger, guaranteed box drop. */
  elite: boolean;
  /** Elite-only damage-type immunity (Physical or Magic); null for normal enemies. */
  eliteImmunity: Immunity | null;
  /** Transient support-aura buffs from nearby Heralds/Hexers (recomputed each tick). */
  aura: AuraMods;
  /** Boss skill mana (T16); fills over time + on taking damage, spent on cast. */
  mana: number;
}

export interface TowerRuntime {
  uid: number;
  def: CharacterDef;
  stats: Stats;
  slotIndex: number;
  pos: Vec2;
  hp: number;
  mana: number;
  attackCd: number;
  alive: boolean;
  buffAtkPct: number;
  buffAsPct: number;
  disabledTimer: number;
  /** Role behavior scaled for the current battleLevel (T12); never the shared def. */
  behavior: TowerBehavior;
  /** Per-tower scaling inputs so in-battle upgrades can recompute stats. */
  baseLevel: number;
  stars: number;
  /** In-battle upgrade levels purchased with gold (0..MAX_TOWER_UPGRADES). */
  battleLevel: number;
  /** Total gold sunk into this tower (cost + upgrades), for sell refund. */
  goldSpent: number;
}

export interface HeroRuntime {
  stats: Stats;
  damageType: DamageType;
  /** Equipped weapon family (null = unarmed/boxing) — drives attack style & reach. */
  weaponType: WeaponType | null;
  /** The hero's single equipped active-skill id — drives the cast VFX signature. */
  equippedSkillId?: string;
  /** Burst multiplier on atk for the equipped active (legacy ×2 when unset). */
  activeMult?: number;
  /** Damage type of the equipped active skill (falls back to weapon type). */
  activeDamageType?: DamageType;
  pos: Vec2;
  moveTarget: Vec2;
  hp: number;
  mana: number;
  attackCd: number;
  alive: boolean;
}

export interface HeroConfig {
  stats: Stats;
  startPos: Vec2;
  damageType?: DamageType;
}

export interface BattleOptions {
  seed?: number;
  hero: HeroConfig;
  difficulty?: Difficulty;
  heroSave?: HeroSave;
  /** Override the per-BATTLE elite chance (defaults to ELITE_BATTLE_CHANCE); 0 disables elites. */
  eliteChance?: number;
  /** F5 daily-challenge modifiers (enemy stat tilts + tower-cost discount). */
  challenge?: ChallengeEffects;
  /** F11 endless: enemy stat multiplier applied on top of difficulty (per-wave ramp). */
  endlessMul?: number;
  /** F11 endless survival: generate waves forever, scaling per-wave; run ends only on loss. */
  endless?: boolean;
  /** F12 boss rush: a fixed gauntlet of BOSS_RUSH_TIERS boss waves instead of authored ones. */
  bossRush?: boolean;
}

export interface Catalogs {
  enemies: Map<string, EnemyDef>;
  characters: Map<string, CharacterDef>;
}

export interface ScheduledSpawn {
  at: number;
  enemyId: string;
}

export interface SpawnRequest {
  enemyId: string;
  distanceAlong?: number;
  /** Override the polyline this spawn walks (summons inherit the parent's route). */
  route?: Vec2[];
  airProgress?: number;
  airStart?: Vec2;
  /** True for scheduled wave spawns (eligible for elite promotion); false for summons/splits. */
  fromWave?: boolean;
}

export function targetFilter(target: TargetType): TargetFilter {
  return {
    canHitGround: target === "Ground" || target === "Both",
    canHitAir: target === "Air" || target === "Both",
    seeStealth: false,
  };
}

export const HERO_FILTER: TargetFilter = { canHitGround: true, canHitAir: true, seeStealth: true };
