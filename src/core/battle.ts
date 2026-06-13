/**
 * BattleState — the headless battle simulation.
 *
 * Pure game logic: no Phaser, no rendering, no DOM. A scene drives it via
 * `tick(dt)` and reads public fields to draw; input goes through methods. All
 * randomness comes from a seeded Rng, so a battle is deterministic and testable.
 *
 * Phase 2 adds the mechanics the full content roster needs:
 * - Tower roles: damage, splash, chain, dot, debuff (slow/stun), support
 *   (buff aura), economy (passive gold).
 * - Enemy specials: shield, heal aura, split-on-death, summon, stealth, and
 *   attacking towers (towers are now destructible).
 * - Boss mechanics: enrage, summon, tower-disable.
 * - Difficulty scaling (Normal/Hard/Nightmare) applied to enemy stats & bounty.
 * - Status effects (slow, stun, DoT) with tenacity, and omnivamp sustain.
 *
 * The class is large, so its simulation methods are split by concern into
 * sibling modules (battleWaves / battleEnemies / battleTowers / battleDamage /
 * battleHero / battlePlacement)
 * and merged onto the prototype below via declaration merging. Shared mutable
 * state stays on this class; the merged methods read it through `this`. Fields
 * those modules touch are public-but-internal — not part of the external API.
 */
import { type CharacterDef, type Difficulty, type StageDef, type Vec2 } from "../data/schema.ts";
import { pathLength } from "./path.ts";
import { Rng } from "./rng.ts";
import { resolveHeroBattleStats } from "./heroStats.ts";
import { heroActiveBurst } from "./hero.ts";
import { ELITE_BATTLE_CHANCE } from "./elite.ts";
import type { HeroSave } from "./save.ts";
import type { BattleLoot } from "../data/rewardTiles.ts";
import { squadSynergyMul } from "../data/synergies.ts";
import type { ChallengeEffects } from "../data/challengeModifiers.ts";
import {
  type Catalogs,
  type Outcome,
  type FxEvent,
  type EnemyRuntime,
  type TowerRuntime,
  type HeroRuntime,
  type BattleOptions,
  type ScheduledSpawn,
  type SpawnRequest,
  INTER_WAVE_DELAY,
  COMBO_MAX_MULT,
  COMBO_KILLS_FOR_MAX,
} from "./battleTypes.ts";
import { waveMethods, type WaveMethods } from "./battleWaves.ts";
import { enemyMethods, type EnemyMethods } from "./battleEnemies.ts";
import { towerMethods, type TowerMethods } from "./battleTowers.ts";
import { damageMethods, type DamageMethods } from "./battleDamage.ts";
import { heroMethods, type HeroMethods } from "./battleHero.ts";
import { placementMethods, type PlacementMethods } from "./battlePlacement.ts";

// Re-export the shared vocabulary so existing `import { ... } from "./battle.ts"`
// callsites (EnemyRuntime, TowerRuntime, FxEvent, BattleOptions, the tuning
// constants, …) keep working unchanged.
export * from "./battleTypes.ts";

/** The simulation methods split into sibling modules are merged in below. */
export interface BattleState
  extends WaveMethods, EnemyMethods, TowerMethods, DamageMethods, HeroMethods, PlacementMethods {}

export class BattleState {
  readonly stage: StageDef;
  readonly enemies: EnemyRuntime[] = [];
  readonly towers: TowerRuntime[] = [];
  /** Visual events for the current tick (cleared each tick). */
  readonly fx: FxEvent[] = [];
  readonly hero: HeroRuntime;
  readonly castlePos: Vec2;
  /** Castle HP at battle start — the denominator for the art damaged-state swap. */
  readonly castleMax: number;
  readonly difficulty: Difficulty;

  castleHp: number;
  gold: number;
  time = 0;
  outcome: Outcome = "ongoing";
  waveIndex = -1;

  /** Loot gathered DURING the battle (item/box drops + XP from kills). Persists
   *  immediately on each kill, so it is kept — and shown — even on a loss. */
  readonly battleLoot: BattleLoot = { items: [], boxes: {}, xp: 0 };

  // ---- Internal state (public for the merged method modules; not external API) ----
  /** @internal */ readonly cat: Catalogs;
  /** @internal */ readonly rng: Rng;
  /** @internal */ readonly totalPathLen: number;

  /** @internal Pet passive-gold rate (gold/sec), set from BattleOptions. */
  petGoldPerSec = 0;
  /** @internal Fractional gold accumulator for the pet trickle. */
  petGoldCarry = 0;
  /** @internal */ _heroSave: HeroSave | undefined;
  /** @internal True if THIS battle is fated to contain exactly one elite (rolled once at start). */
  readonly eliteThisBattle: boolean;
  /** @internal Which eligible wave-spawn index (0-based) becomes that elite, or -1 for none. */
  readonly eliteTargetIndex: number;
  /** @internal Count of eligible (non-boss) wave spawns seen so far — drives elite targeting. */
  eligibleSpawnSeen = 0;
  /** @internal Set once the battle's single elite has been spawned. */
  eliteSpawned = false;

  /** @internal */ schedule: ScheduledSpawn[] = [];
  /** @internal */ schedulePtr = 0;
  /** @internal True while the current wave still has un-spawned enemies pending. */
  waveActive = false;
  /** @internal Seconds until the next wave launches (campaign cadence / inter-wave delay). */
  nextWaveTimer = INTER_WAVE_DELAY;
  /** @internal Campaign auto-skip countdown: >0 while an early-cleared wave is counting down to its auto-launch (0 = inactive). */
  autoSkipTimer = 0;
  /** @internal */ allWavesStarted = false;
  /** @internal */ nextUid = 1;
  /** @internal Mid-tick spawn queue (summons/splits) flushed after all updates. */
  pending: SpawnRequest[] = [];
  /** @internal F6: distinct tower defIds fielded this battle — each earns mastery XP per kill. */
  readonly deployedTowerIds = new Set<string>();
  /** @internal F8: team stat multipliers from the chosen squad's active synergies. */
  synergyMul: { atkMul: number; hpMul: number; attackSpeedMul: number } = {
    atkMul: 1,
    hpMul: 1,
    attackSpeedMul: 1,
  };
  /** @internal F13 combo: consecutive-kill streak + decay timer (seconds). */
  combo = 0;
  /** @internal */ comboTimer = 0;
  /** @internal F14 perfect wave: did any enemy leak to the castle during the active wave? */
  waveLeaked = false;
  /** @internal F14: did ANY enemy leak across the whole stage (drives the flawless-victory bonus)? */
  anyLeak = false;
  /** @internal F14: gold earned from kills during the active wave (for the perfect-wave bonus). */
  waveGold = 0;
  /** @internal F5 daily-challenge modifiers in effect this battle (empty = none). */
  readonly challenge: ChallengeEffects;
  /** @internal F11 endless enemy stat multiplier (1 = off). */
  readonly endlessMul: number;
  /** @internal F11 endless survival: waves generate forever and scale per-wave; never "won". */
  readonly endless: boolean;
  /** @internal F12 boss rush: a fixed gauntlet of BOSS_RUSH_TIERS boss waves. */
  readonly bossRush: boolean;
  /** @internal Count of waves FULLY cleared (every enemy down) — the boss-rush tier. */
  wavesCleared = 0;

  constructor(stage: StageDef, catalogs: Catalogs, opts: BattleOptions) {
    this.stage = stage;
    this.cat = catalogs;
    this.rng = new Rng(opts.seed ?? 1);
    this.difficulty = opts.difficulty ?? "Normal";
    // Roll once whether this battle contains an elite, then pick which eligible
    // wave-spawn it will be. Bias toward the first ~70% of spawns so a fated
    // elite reliably shows up before the run ends.
    const eliteChance = opts.eliteChance ?? ELITE_BATTLE_CHANCE;
    this.eliteThisBattle = this.rng.next() < eliteChance;
    if (this.eliteThisBattle) {
      const eligible = this.countEligibleWaveSpawns(stage, catalogs);
      this.eliteTargetIndex =
        eligible > 0 ? Math.floor(this.rng.next() * Math.ceil(eligible * 0.7)) : -1;
    } else {
      this.eliteTargetIndex = -1;
    }
    this.challenge = opts.challenge ?? {};
    this.endlessMul = opts.endlessMul ?? 1;
    this.endless = opts.endless ?? false;
    this.bossRush = opts.bossRush ?? false;
    this.totalPathLen = pathLength(stage.path);
    this.castlePos = stage.arena ? stage.arena.center : stage.path[stage.path.length - 1];
    this.castleHp = stage.castleHp;
    this.castleMax = stage.castleHp;
    this.gold = stage.startingGold;
    this.hero = {
      stats: opts.hero.stats,
      damageType: opts.hero.damageType ?? "Physical",
      weaponType: null,
      pos: { ...opts.hero.startPos },
      moveTarget: { ...opts.hero.startPos },
      hp: opts.hero.stats.maxHp,
      mana: 0,
      attackCd: 0,
      alive: true,
    };

    if (opts.heroSave) {
      // Items + passive tree + jewels + level all fold into the hero's stats here
      // (and flow on to towers via the 60% share). Resolution lives in one tested
      // place — resolveHeroBattleStats — so the math stays auditable.
      const {
        stats: resolvedStats,
        petGoldPerSec,
        weaponType,
      } = resolveHeroBattleStats(opts.heroSave, opts.hero.stats);
      if (petGoldPerSec > 0) this.petGoldPerSec = petGoldPerSec;

      const active = heroActiveBurst(opts.heroSave);
      this.hero = {
        stats: resolvedStats,
        damageType: opts.hero.damageType ?? "Physical",
        weaponType,
        equippedSkillId: active.skillId,
        activeMult: active.mult,
        activeDamageType: active.damageType,
        pos: { ...opts.hero.startPos },
        moveTarget: { ...opts.hero.startPos },
        hp: resolvedStats.maxHp,
        mana: 0,
        attackCd: 0,
        alive: true,
      };
    }
    this._heroSave = opts.heroSave;

    // F8: resolve squad synergies once at battle start from the chosen squad.
    if (opts.heroSave?.squad?.length) {
      const defs = opts.heroSave.squad
        .map((id) => catalogs.characters.get(id))
        .filter((d): d is CharacterDef => !!d);
      this.synergyMul = squadSynergyMul(defs);
    }
  }

  /** Active squad-synergy multipliers (for the battle HUD). */
  getSynergyMul(): { atkMul: number; hpMul: number; attackSpeedMul: number } {
    return this.synergyMul;
  }

  // ---- Simulation --------------------------------------------------------

  tick(dt: number): void {
    // Clear visual events FIRST, even on a no-op tick. A finished battle (or a
    // paused dt<=0) must leave fx empty — otherwise the killing blow's
    // killReward/loot events linger here and the render loop, still advancing
    // its fixed-step accumulator, re-pushes them every frame (the non-stop
    // +XP/gold gain shower on the victory screen).
    this.fx.length = 0;
    if (this.outcome !== "ongoing" || dt <= 0) return;
    this.time += dt;

    // F13: decay the kill streak; a lull resets the combo multiplier.
    if (this.combo > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }

    this.updateWaves(dt);
    this.recomputeEnemyAuras(dt);
    this.recomputeTowerBuffs();
    this.updateEnemies(dt);
    this.updateStealthReveal();
    this.updateTowers(dt);
    this.updateHero(dt);
    this.flushPending();
    this.cleanupDead();
    // Campaign clear-credit runs post-cleanup so a wave wiped out this tick pays
    // its perfect-wave bonus before checkOutcome can declare victory.
    if (this.usesCadence()) this.creditClearedWaves();
    this.checkOutcome();
  }

  /** F13 current gold multiplier from the kill streak (1 → COMBO_MAX_MULT). */
  comboMult(): number {
    if (this.combo <= 1) return 1;
    const t = Math.min(1, (this.combo - 1) / (COMBO_KILLS_FOR_MAX - 1));
    return 1 + (COMBO_MAX_MULT - 1) * t;
  }
  /** F13 current combo count (for the battle HUD). */
  getCombo(): number {
    return this.combo;
  }
  /** F14 flawless victory: won the stage with zero leaks (drives a bonus chest). */
  wasFlawless(): boolean {
    return this.outcome === "won" && !this.anyLeak;
  }

  // ---- Lifecycle ---------------------------------------------------------

  private cleanupDead(): void {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      if (!this.enemies[i].alive) this.enemies.splice(i, 1);
    }
    for (let i = this.towers.length - 1; i >= 0; i--) {
      if (!this.towers[i].alive) this.towers.splice(i, 1);
    }
  }

  private checkOutcome(): void {
    if (this.castleHp <= 0 || !this.hero.alive) {
      this.outcome = "lost";
      return;
    }
    if (this.allWavesStarted && !this.waveActive && this.enemies.length === 0) {
      this.outcome = "won";
    }
  }
}

// Merge the per-concern simulation methods onto the prototype. Their `this` is
// typed as BattleState (see each module); the interface declaration above makes
// them visible to TypeScript on the class.
Object.assign(
  BattleState.prototype,
  waveMethods,
  enemyMethods,
  towerMethods,
  damageMethods,
  heroMethods,
  placementMethods,
);
