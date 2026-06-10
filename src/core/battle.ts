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
 * sibling modules (battleWaves / battleEnemies / battleTowers / battleDamage)
 * and merged onto the prototype below via declaration merging. Shared mutable
 * state stays on this class; the merged methods read it through `this`. Fields
 * those modules touch are public-but-internal — not part of the external API.
 */
import {
  type CharacterDef,
  type Difficulty,
  type StageDef,
  type Vec2,
} from "../data/schema.ts";
import { dist, lerp, pathLength } from "./path.ts";
import { Rng } from "./rng.ts";
import { addHeroShare, towerStatPipeline } from "./stats.ts";
import { resolveHeroBattleStats } from "./heroStats.ts";
import { heroActiveBurst, awardSkillUseXp } from "./hero.ts";
import { effectiveBehavior, battleLevelAtkMul } from "./towerUpgrade.ts";
import { heroAttackStyle } from "../data/attackStyle.ts";
import { selectTarget } from "./targeting.ts";
import { WORLD_WIDTH, WORLD_HEIGHT } from "../data/stage.ts";
import { ELITE_BATTLE_CHANCE } from "./elite.ts";
import type { HeroSave } from "./save.ts";
import type { BattleLoot } from "../data/rewardTiles.ts";
import { isTowerOwned, getTowerStars } from "./collection.ts";
import { incrementQuestKey } from "./questTracker.ts";
import { getMasteryLevel, masteryStatMul } from "./mastery.ts";
import { getAwakening, awakeningStatMul } from "./awakening.ts";
import { squadSynergyMul } from "../data/synergies.ts";
import type { ChallengeEffects } from "../data/challengeModifiers.ts";
import {
  type Catalogs, type Outcome, type FxEvent,
  type EnemyRuntime, type TowerRuntime, type HeroRuntime,
  type BattleOptions, type ScheduledSpawn, type SpawnRequest,
  segDist, HERO_FILTER,
  INTER_WAVE_DELAY, COMBO_MAX_MULT, COMBO_KILLS_FOR_MAX,
  LANE_CLEARANCE, MIN_TOWER_DIST, PLACE_MARGIN,
  MAX_TOWER_UPGRADES, TOWER_SELL_REFUND, MANA_MAX,
} from "./battleTypes.ts";
import { waveMethods, type WaveMethods } from "./battleWaves.ts";
import { enemyMethods, type EnemyMethods } from "./battleEnemies.ts";
import { towerMethods, type TowerMethods } from "./battleTowers.ts";
import { damageMethods, type DamageMethods } from "./battleDamage.ts";

// Re-export the shared vocabulary so existing `import { ... } from "./battle.ts"`
// callsites (EnemyRuntime, TowerRuntime, FxEvent, BattleOptions, the tuning
// constants, …) keep working unchanged.
export * from "./battleTypes.ts";

/** The simulation methods split into sibling modules are merged in below. */
export interface BattleState extends WaveMethods, EnemyMethods, TowerMethods, DamageMethods {}

export class BattleState {
  readonly stage: StageDef;
  readonly enemies: EnemyRuntime[] = [];
  readonly towers: TowerRuntime[] = [];
  /** Visual events for the current tick (cleared each tick). */
  readonly fx: FxEvent[] = [];
  readonly hero: HeroRuntime;
  readonly castlePos: Vec2;
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

  private petGoldPerSec = 0;
  private petGoldCarry = 0;
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
  /** @internal */ waveActive = false;
  /** @internal */ interWaveTimer = INTER_WAVE_DELAY;
  /** @internal */ allWavesStarted = false;
  /** @internal */ nextUid = 1;
  /** @internal Mid-tick spawn queue (summons/splits) flushed after all updates. */
  pending: SpawnRequest[] = [];
  /** @internal F6: distinct tower defIds fielded this battle — each earns mastery XP per kill. */
  readonly deployedTowerIds = new Set<string>();
  /** F8: team stat multipliers from the chosen squad's active synergies. */
  private synergyMul: { atkMul: number; hpMul: number; attackSpeedMul: number } = { atkMul: 1, hpMul: 1, attackSpeedMul: 1 };
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
      this.eliteTargetIndex = eligible > 0 ? Math.floor(this.rng.next() * Math.ceil(eligible * 0.7)) : -1;
    } else {
      this.eliteTargetIndex = -1;
    }
    this.challenge = opts.challenge ?? {};
    this.endlessMul = opts.endlessMul ?? 1;
    this.endless = opts.endless ?? false;
    this.bossRush = opts.bossRush ?? false;
    this.totalPathLen = pathLength(stage.path);
    this.castlePos = stage.path[stage.path.length - 1];
    this.castleHp = stage.castleHp;
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
      const { stats: resolvedStats, petGoldPerSec, weaponType } = resolveHeroBattleStats(opts.heroSave, opts.hero.stats);
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

  // ---- Input -------------------------------------------------------------

  commandHero(target: Vec2): void {
    this.hero.moveTarget = { ...target };
  }

  /** Effective placement cost for a character (F5 challenge discount applies). */
  towerCost(def: CharacterDef): number {
    return Math.max(0, Math.round(def.cost * (this.challenge.towerCostMul ?? 1)));
  }

  placeTower(characterId: string, slotIndex: number): boolean {
    if (this.outcome !== "ongoing") return false;
    const def = this.cat.characters.get(characterId);
    if (!def) return false;
    if (slotIndex < 0 || slotIndex >= this.stage.towerSlots.length) return false;
    if (this.towers.some((t) => t.slotIndex === slotIndex && t.alive)) return false;
    if (this.gold < this.towerCost(def)) return false;
    // With heroSave: only allow placement of owned towers
    if (this._heroSave && !isTowerOwned(this._heroSave, characterId)) return false;

    this.spawnTower(characterId, def, { ...this.stage.towerSlots[slotIndex] }, slotIndex);
    return true;
  }

  /** Whether a free-placement position is buildable (bounds, lane, obstacles, spacing). */
  canPlaceAt(pos: Vec2): boolean {
    if (pos.x < PLACE_MARGIN || pos.y < PLACE_MARGIN || pos.x > WORLD_WIDTH - PLACE_MARGIN || pos.y > WORLD_HEIGHT - PLACE_MARGIN) return false;
    const path = this.stage.path;
    for (let i = 1; i < path.length; i++) {
      if (segDist(pos, path[i - 1], path[i]) < LANE_CLEARANCE) return false;
    }
    for (const f of this.stage.terrain ?? []) {
      if (f.blocks && dist(pos, f) < f.r) return false;
    }
    for (const t of this.towers) {
      if (t.alive && dist(pos, t.pos) < MIN_TOWER_DIST) return false;
    }
    return true;
  }

  /** Place a tower at a free position (T14). Validates ownership, gold, and the spot. */
  placeTowerAt(characterId: string, pos: Vec2): boolean {
    if (this.outcome !== "ongoing") return false;
    const def = this.cat.characters.get(characterId);
    if (!def) return false;
    if (this.gold < this.towerCost(def)) return false;
    if (this._heroSave && !isTowerOwned(this._heroSave, characterId)) return false;
    if (!this.canPlaceAt(pos)) return false;
    this.spawnTower(characterId, def, { x: pos.x, y: pos.y }, -1);
    return true;
  }

  private spawnTower(characterId: string, def: CharacterDef, pos: Vec2, slotIndex: number): void {
    const cost = this.towerCost(def);
    this.gold -= cost;
    const towerLevel = this._heroSave?.hero.level ?? 1;
    const towerStars = this._heroSave ? getTowerStars(this._heroSave, characterId) : 1;
    // The hero commands their towers: 60% of the hero's resolved stats flow onto
    // each one, so leveling/gearing the hero strengthens the whole squad.
    const resolvedStats = addHeroShare(
      towerStatPipeline(def.baseStats, towerLevel, towerStars, def.role, 0),
      this.hero.stats,
    );
    // F6 mastery × F7 awakening (per-tower permanent growth) × F8 squad synergy.
    const mMul = this._heroSave
      ? masteryStatMul(getMasteryLevel(this._heroSave, characterId)) * awakeningStatMul(getAwakening(this._heroSave, characterId))
      : 1;
    resolvedStats.atk *= mMul * this.synergyMul.atkMul;
    resolvedStats.maxHp *= mMul * this.synergyMul.hpMul;
    resolvedStats.attackSpeed *= this.synergyMul.attackSpeedMul;
    if (this._heroSave) this.deployedTowerIds.add(characterId);
    this.towers.push({
      uid: this.nextUid++,
      def,
      stats: resolvedStats,
      slotIndex,
      pos,
      hp: resolvedStats.maxHp,
      mana: 0,
      attackCd: 0,
      alive: true,
      buffAtkPct: 0,
      buffAsPct: 0,
      disabledTimer: 0,
      behavior: effectiveBehavior(def, 0),
      baseLevel: towerLevel,
      stars: towerStars,
      battleLevel: 0,
      goldSpent: cost,
    });
    if (this._heroSave) {
      this._heroSave.progress.totalTowersPlaced += 1;
      incrementQuestKey(this._heroSave, "place_towers", 1, new Date().toISOString().slice(0, 10));
    }
  }

  /** Gold cost to upgrade a tower one battle level (escalates), or 0 if maxed/missing. */
  upgradeCost(uid: number): number {
    const t = this.towers.find((x) => x.uid === uid && x.alive);
    if (!t || t.battleLevel >= MAX_TOWER_UPGRADES) return 0;
    // A star-up is a premium: it always costs MORE than buying a fresh tower of
    // this type (≥1.25× its placement cost), and escalates with each star. You
    // pay extra to concentrate ~+60% power onto one defended slot instead of
    // spreading it across a new unit that needs its own spot and protection.
    return Math.round(this.towerCost(t.def) * 1.25 * (t.battleLevel + 1));
  }

  /**
   * The attack range this tower WOULD have after one more upgrade — used to
   * preview coverage on the upgrade button. Non-mutating; returns null if the
   * tower is missing or already maxed. Mirrors upgradeTower's stat resolution
   * (towerStatPipeline at battleLevel+1, plus the hero share).
   */
  previewUpgradeRange(uid: number): number | null {
    const t = this.towers.find((x) => x.uid === uid && x.alive);
    if (!t || t.battleLevel >= MAX_TOWER_UPGRADES) return null;
    const upgraded = addHeroShare(
      towerStatPipeline(t.def.baseStats, t.baseLevel, t.stars, t.def.role, t.battleLevel + 1),
      this.hero.stats,
    );
    return upgraded.range;
  }

  /**
   * The attack range a tower of `characterId` WOULD have the instant it's placed
   * (★1 / battleLevel 0), used to draw an accurate placement coverage ring. Mirrors
   * spawnTower's range resolution: base reach scaled by the unit's collection-star
   * tier. The hero share no longer touches range (towers are static), so this is the
   * true reach — drawing def.baseStats.range alone under-reports starred towers.
   */
  previewPlaceRange(characterId: string): number {
    const def = this.cat.characters.get(characterId);
    if (!def) return 0;
    const towerLevel = this._heroSave?.hero.level ?? 1;
    const towerStars = this._heroSave ? getTowerStars(this._heroSave, characterId) : 1;
    return towerStatPipeline(def.baseStats, towerLevel, towerStars, def.role, 0).range;
  }

  /** Gold refunded when selling a tower (fraction of total invested). */
  sellValue(uid: number): number {
    const t = this.towers.find((x) => x.uid === uid && x.alive);
    return t ? Math.round(t.goldSpent * TOWER_SELL_REFUND) : 0;
  }

  /** Upgrade a placed tower one battle level; recompute stats, keep HP/mana fractions. */
  upgradeTower(uid: number): boolean {
    if (this.outcome !== "ongoing") return false;
    const t = this.towers.find((x) => x.uid === uid && x.alive);
    if (!t || t.battleLevel >= MAX_TOWER_UPGRADES) return false;
    const cost = this.upgradeCost(uid);
    if (this.gold < cost) return false;

    this.gold -= cost;
    t.goldSpent += cost;
    t.battleLevel += 1;
    const hpFrac = t.stats.maxHp > 0 ? t.hp / t.stats.maxHp : 1;
    t.stats = addHeroShare(
      towerStatPipeline(t.def.baseStats, t.baseLevel, t.stars, t.def.role, t.battleLevel),
      this.hero.stats,
    );
    // Re-apply F6 mastery + F7 awakening + F8 synergy so upgrading never drops it.
    const mMul = this._heroSave
      ? masteryStatMul(getMasteryLevel(this._heroSave, t.def.id)) * awakeningStatMul(getAwakening(this._heroSave, t.def.id))
      : 1;
    t.stats.atk *= mMul * this.synergyMul.atkMul;
    t.stats.maxHp *= mMul * this.synergyMul.hpMul;
    t.stats.attackSpeed *= this.synergyMul.attackSpeedMul;
    // The headline of a star-up: ~+60% attack per star, applied to the final
    // resolved atk so the hero share can't dilute it (see battleLevelAtkMul).
    t.stats.atk *= battleLevelAtkMul(t.battleLevel);
    t.behavior = effectiveBehavior(t.def, t.battleLevel);
    t.hp = t.stats.maxHp * hpFrac;
    // mana is a fixed 0..100 bar now — it carries over untouched across upgrades.
    if (this._heroSave) {
      incrementQuestKey(this._heroSave, "upgrade_towers", 1, new Date().toISOString().slice(0, 10));
    }
    return true;
  }

  /** Sell a placed tower, refund gold, remove it. Returns the refund (0 if missing). */
  sellTower(uid: number): number {
    const i = this.towers.findIndex((x) => x.uid === uid && x.alive);
    if (i < 0) return 0;
    const refund = this.sellValue(uid);
    this.gold += refund;
    this.towers.splice(i, 1);
    return refund;
  }

  // ---- Simulation --------------------------------------------------------

  tick(dt: number): void {
    if (this.outcome !== "ongoing" || dt <= 0) return;
    this.fx.length = 0; // fresh visual events for this tick
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
    this.checkOutcome();
  }

  /** F13 current gold multiplier from the kill streak (1 → COMBO_MAX_MULT). */
  comboMult(): number {
    if (this.combo <= 1) return 1;
    const t = Math.min(1, (this.combo - 1) / (COMBO_KILLS_FOR_MAX - 1));
    return 1 + (COMBO_MAX_MULT - 1) * t;
  }
  /** F13 current combo count (for the battle HUD). */
  getCombo(): number { return this.combo; }
  /** F14 flawless victory: won the stage with zero leaks (drives a bonus chest). */
  wasFlawless(): boolean { return this.outcome === "won" && !this.anyLeak; }

  // ---- Hero --------------------------------------------------------------

  private updateHero(dt: number): void {
    if (this.petGoldPerSec > 0) {
      this.petGoldCarry += this.petGoldPerSec * dt * (1 + this.hero.stats.goldFind);
      while (this.petGoldCarry >= 1) {
        this.gold += 1;
        this.petGoldCarry -= 1;
      }
    }

    const h = this.hero;
    if (!h.alive) return;

    if (h.stats.hpRegen > 0) h.hp = Math.min(h.stats.maxHp, h.hp + h.stats.hpRegen * dt);

    const toTarget = dist(h.pos, h.moveTarget);
    if (toTarget > 1) {
      const step = Math.min(toTarget, h.stats.moveSpeed * dt);
      h.pos = lerp(h.pos, h.moveTarget, step / toTarget);
    }

    h.attackCd -= dt;
    if (h.attackCd > 0 || h.stats.attackSpeed <= 0) return;

    const target = selectTarget(h.pos, h.stats.range, this.enemies, HERO_FILTER);
    if (!target) return;

    this.performAttack(h, h.pos, h.stats.atk, h.damageType, target, "hero", "hero", -1, heroAttackStyle(h.weaponType, h.damageType, h.stats.range));
    if (h.mana >= MANA_MAX) {
      // The equipped active drives both the burst size (its levelled power) and
      // the damage type — a True/Magic skill casts True/Magic even on a Physical
      // weapon. Falls back to the legacy ×2 / weapon type when nothing is equipped.
      this.castActive(h.stats, h.stats.atk, h.activeDamageType ?? h.damageType, target.pos, "hero", -1, h.equippedSkillId, undefined, h.activeMult ?? 2);
      h.mana = 0;
      // Skill leveling (spec: +1 use-XP per cast, capped at the hero's level).
      // Written straight into the live save like kill XP; the scene flushes after
      // the battle. Without this the equipped skill never levels and its Power —
      // which drives the burst size — is frozen at the level it dropped/started at.
      if (this._heroSave && h.equippedSkillId) {
        awardSkillUseXp(this._heroSave, h.equippedSkillId);
        // A level-up earned mid-battle must hit harder on the NEXT cast THIS
        // battle, not only next battle — re-resolve the frozen burst multiplier
        // from the live save so the leveling actually couples to the damage.
        h.activeMult = heroActiveBurst(this._heroSave).mult;
      }
    }
    h.attackCd = 1 / h.stats.attackSpeed;
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
Object.assign(BattleState.prototype, waveMethods, enemyMethods, towerMethods, damageMethods);
