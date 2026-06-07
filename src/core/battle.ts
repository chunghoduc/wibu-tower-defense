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
 */
import {
  DIFFICULTY_SCALING,
  type CharacterDef,
  type DamageType,
  type Difficulty,
  type EnemyDef,
  type PassiveNodeDef,
  type StageDef,
  type Stats,
  type TargetType,
  type TowerBehavior,
  type BossSkill,
  type Vec2,
} from "../data/schema.ts";
import { mitigatedDamage, mitigationBreakdown, critMultiplier, type DamagePacket } from "./damage.ts";
import { combatLogOn, emitDamageLog } from "./combatLog.ts";
import { absorbWithShield, ccDuration, slowedSpeed, type Dot } from "./effects.ts";
import { dist, lerp, pathLength, pointAtDistance } from "./path.ts";
import { Rng } from "./rng.ts";
import { addHeroShare, collectPassiveMore, heroStatPipeline, towerStatPipeline } from "./stats.ts";
import { effectiveBehavior } from "./towerUpgrade.ts";
import { scaleStatsByEnhance } from "./enhance.ts";
import { attackStyleFor, heroAttackStyle } from "../data/attackStyle.ts";
import { selectTarget, type TargetFilter } from "./targeting.ts";
import { PASSIVE_NODES_MAP } from "../data/passiveGrid.ts";
import { ITEM_CATALOG_MAP } from "../data/items.ts";
import { WORLD_WIDTH, WORLD_HEIGHT } from "../data/stage.ts";
import type { HeroSave } from "./save.ts";
import { isTowerOwned, getTowerStars } from "./collection.ts";
import { processEnemyKill } from "./killRewards.ts";
import { itemLevelForStage } from "./itemDrop.ts";
import { buildAffixStats } from "./affixStats.ts";

export type Outcome = "ongoing" | "won" | "lost";

/** Distance from point p to segment a-b (for lane-clearance checks). */
function segDist(p: Vec2, a: Vec2, b: Vec2): number {
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
  | { type: "death"; at: Vec2; boss: boolean; bounty: number }
  | { type: "enemyAttack"; uid: number; at: Vec2; targetAt: Vec2; target: "hero" | "tower" }
  | { type: "cast"; uid: number; at: Vec2; damageType: DamageType; radius: number; source: "tower" | "hero"; skillId?: string }
  | { type: "splash"; at: Vec2; radius: number; damageType: DamageType }
  | { type: "chain"; from: Vec2; to: Vec2 }
  | { type: "bossCast"; uid: number; at: Vec2; skill: string; radius: number; name: string }
  | { type: "loot"; at: Vec2; gold: number }
  | { type: "killReward"; at: Vec2; xp: number; item: boolean };

/** Debug context threaded into applyDamage so the combat logger can print the
 * full per-hit formula (only built when logging is on). */
interface DmgCtx {
  src: string;
  kind: string;
  rawFormula: string;
  crit?: { rate: number; roll: number; hit: boolean; mult: number };
}

/** How close an enemy must be to the hero to be body-blocked into melee. */
export const HERO_BLOCK_RANGE = 28;
/** Default radius of splash / active-skill AoE bursts. */
export const SPLASH_RADIUS = 60;
/** Pause between waves once the current wave is fully cleared. */
export const INTER_WAVE_DELAY = 3;
/** Free-placement: towers can't be placed within this distance of the lane. */
export const LANE_CLEARANCE = 30;
/** Free-placement: minimum spacing between two towers. */
export const MIN_TOWER_DIST = 34;
/** Free-placement: keep towers this far inside the world edges. */
export const PLACE_MARGIN = 14;
/** Max in-battle upgrade levels a tower can buy. */
export const MAX_TOWER_UPGRADES = 5;
/** Boss skill mana gained per second (T16); a boss casts roughly every manaCost/this seconds. */
const BOSS_MANA_REGEN = 14;
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
}

interface Catalogs {
  enemies: Map<string, EnemyDef>;
  characters: Map<string, CharacterDef>;
}

interface ScheduledSpawn {
  at: number;
  enemyId: string;
}

interface SpawnRequest {
  enemyId: string;
  distanceAlong?: number;
  airProgress?: number;
  airStart?: Vec2;
}

function targetFilter(target: TargetType): TargetFilter {
  return {
    canHitGround: target === "Ground" || target === "Both",
    canHitAir: target === "Air" || target === "Both",
    seeStealth: false,
  };
}

const HERO_FILTER: TargetFilter = { canHitGround: true, canHitAir: true, seeStealth: true };

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

  private readonly cat: Catalogs;
  private readonly rng: Rng;
  private readonly totalPathLen: number;

  private petGoldPerSec = 0;
  private petGoldCarry = 0;
  private _heroSave: HeroSave | undefined;

  private schedule: ScheduledSpawn[] = [];
  private schedulePtr = 0;
  private waveActive = false;
  private interWaveTimer = INTER_WAVE_DELAY;
  private allWavesStarted = false;
  private nextUid = 1;
  /** Mid-tick spawn queue (summons/splits) flushed after all updates. */
  private pending: SpawnRequest[] = [];

  constructor(stage: StageDef, catalogs: Catalogs, opts: BattleOptions) {
    this.stage = stage;
    this.cat = catalogs;
    this.rng = new Rng(opts.seed ?? 1);
    this.difficulty = opts.difficulty ?? "Normal";
    this.totalPathLen = pathLength(stage.path);
    this.castlePos = stage.path[stage.path.length - 1];
    this.castleHp = stage.castleHp;
    this.gold = stage.startingGold;
    this.hero = {
      stats: opts.hero.stats,
      damageType: opts.hero.damageType ?? "Physical",
      pos: { ...opts.hero.startPos },
      moveTarget: { ...opts.hero.startPos },
      hp: opts.hero.stats.maxHp,
      mana: 0,
      attackCd: 0,
      alive: true,
    };

    if (opts.heroSave) {
      const save = opts.heroSave;
      const unlockedNodes = save.hero.unlockedNodes
        .map((id) => PASSIVE_NODES_MAP.get(id))
        .filter((n): n is PassiveNodeDef => n !== undefined);

      const itemStats: Partial<Stats>[] = [];

      for (const [slot, instanceId] of Object.entries(save.inventory.equipped)) {
        if (!instanceId) continue;
        const instance = save.inventory.items.find((it) => it.id === instanceId);
        if (!instance) continue;
        const def = ITEM_CATALOG_MAP.get(instance.defId);
        if (!def) continue;
        itemStats.push(scaleStatsByEnhance(instance.rolledStats as Partial<Stats>, instance.enhanceLevel ?? 0));
        if (slot === "Pet" && def.petUtility?.goldPerSec) {
          this.petGoldPerSec = def.petUtility.goldPerSec;
        }
      }

      // More% multipliers from every allocated node that declares one (keystones
      // and the prestige gates alike — not gated on type, or a notable's more% is lost).
      const keystoneMore = collectPassiveMore(unlockedNodes);

      // Item affixes (primary + rolled): flat contributions go straight in;
      // increased% contributions ride in as synthetic increased-only nodes.
      const affix = buildAffixStats(save);
      const affixNodes = affix.increased.map((increased) => ({ flat: {}, increased, more: undefined }));

      const resolvedStats = heroStatPipeline(
        opts.hero.stats,
        save.hero.level,
        [...unlockedNodes, ...affixNodes],
        itemStats,
        affix.flat,
        keystoneMore,
      );

      this.hero = {
        stats: resolvedStats,
        damageType: opts.hero.damageType ?? "Physical",
        pos: { ...opts.hero.startPos },
        moveTarget: { ...opts.hero.startPos },
        hp: resolvedStats.maxHp,
        mana: 0,
        attackCd: 0,
        alive: true,
      };
    }
    this._heroSave = opts.heroSave;
  }

  // ---- Input -------------------------------------------------------------

  commandHero(target: Vec2): void {
    this.hero.moveTarget = { ...target };
  }

  placeTower(characterId: string, slotIndex: number): boolean {
    if (this.outcome !== "ongoing") return false;
    const def = this.cat.characters.get(characterId);
    if (!def) return false;
    if (slotIndex < 0 || slotIndex >= this.stage.towerSlots.length) return false;
    if (this.towers.some((t) => t.slotIndex === slotIndex && t.alive)) return false;
    if (this.gold < def.cost) return false;
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
    if (this.gold < def.cost) return false;
    if (this._heroSave && !isTowerOwned(this._heroSave, characterId)) return false;
    if (!this.canPlaceAt(pos)) return false;
    this.spawnTower(characterId, def, { x: pos.x, y: pos.y }, -1);
    return true;
  }

  private spawnTower(characterId: string, def: CharacterDef, pos: Vec2, slotIndex: number): void {
    this.gold -= def.cost;
    const towerLevel = this._heroSave?.hero.level ?? 1;
    const towerStars = this._heroSave ? getTowerStars(this._heroSave, characterId) : 1;
    // The hero commands their towers: 60% of the hero's resolved stats flow onto
    // each one, so leveling/gearing the hero strengthens the whole squad.
    const resolvedStats = addHeroShare(
      towerStatPipeline(def.baseStats, towerLevel, towerStars, def.role, 0),
      this.hero.stats,
    );
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
      goldSpent: def.cost,
    });
    if (this._heroSave) this._heroSave.progress.totalTowersPlaced += 1;
  }

  /** Gold cost to upgrade a tower one battle level (escalates), or 0 if maxed/missing. */
  upgradeCost(uid: number): number {
    const t = this.towers.find((x) => x.uid === uid && x.alive);
    if (!t || t.battleLevel >= MAX_TOWER_UPGRADES) return 0;
    return Math.round(t.def.cost * 0.8 * (t.battleLevel + 1));
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
    const manaFrac = t.stats.maxMana > 0 ? t.mana / t.stats.maxMana : 0;
    t.stats = addHeroShare(
      towerStatPipeline(t.def.baseStats, t.baseLevel, t.stars, t.def.role, t.battleLevel),
      this.hero.stats,
    );
    t.behavior = effectiveBehavior(t.def, t.battleLevel);
    t.hp = t.stats.maxHp * hpFrac;
    t.mana = t.stats.maxMana * manaFrac;
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

    this.updateWaves(dt);
    this.recomputeTowerBuffs();
    this.updateEnemies(dt);
    this.updateStealthReveal();
    this.updateTowers(dt);
    this.updateHero(dt);
    this.flushPending();
    this.cleanupDead();
    this.checkOutcome();
  }

  // ---- Waves -------------------------------------------------------------

  private updateWaves(dt: number): void {
    if (!this.waveActive) {
      if (this.waveIndex + 1 >= this.stage.waves.length) {
        this.allWavesStarted = true;
        return;
      }
      this.interWaveTimer -= dt;
      if (this.interWaveTimer <= 0) this.startNextWave();
      return;
    }

    while (
      this.schedulePtr < this.schedule.length &&
      this.schedule[this.schedulePtr].at <= this.time
    ) {
      this.spawnEnemy({ enemyId: this.schedule[this.schedulePtr].enemyId });
      this.schedulePtr++;
    }

    const fullySpawned = this.schedulePtr >= this.schedule.length;
    if (fullySpawned && this.enemies.length === 0) {
      this.waveActive = false;
      this.interWaveTimer = INTER_WAVE_DELAY;
      if (this.waveIndex + 1 >= this.stage.waves.length) this.allWavesStarted = true;
    }
  }

  private startNextWave(): void {
    this.waveIndex++;
    const wave = this.stage.waves[this.waveIndex];
    const schedule: ScheduledSpawn[] = [];
    for (const group of wave.spawns) {
      for (let i = 0; i < group.count; i++) {
        schedule.push({
          at: this.time + group.delay + i * group.interval,
          enemyId: group.enemyId,
        });
      }
    }
    schedule.sort((a, b) => a.at - b.at);
    this.schedule = schedule;
    this.schedulePtr = 0;
    this.waveActive = true;
  }

  private spawnEnemy(req: SpawnRequest): void {
    const def = this.cat.enemies.get(req.enemyId);
    if (!def) return;
    const scale = DIFFICULTY_SCALING[this.difficulty];
    const stats: Stats = {
      ...def.baseStats,
      maxHp: def.baseStats.maxHp * scale.hpMult,
      atk: def.baseStats.atk * scale.atkMult,
    };
    const flying = def.flying;
    const airStart =
      req.airStart ??
      (this.stage.airSpawns.length > 0
        ? this.stage.airSpawns[this.nextUid % this.stage.airSpawns.length]
        : this.stage.path[0]);
    const distanceAlong = req.distanceAlong ?? 0;
    const airProgress = req.airProgress ?? 0;
    const pos = flying ? lerp(airStart, this.castlePos, airProgress) : pointAtDistance(this.stage.path, distanceAlong);

    this.enemies.push({
      uid: this.nextUid++,
      def,
      stats,
      hp: stats.maxHp,
      shield: (def.special?.shieldHp ?? 0) * scale.hpMult,
      flying,
      stealth: def.special?.stealth ?? false,
      revealed: !(def.special?.stealth ?? false),
      distanceAlong,
      airProgress,
      airStart,
      pos,
      threat: 0,
      alive: true,
      attackCd: 0,
      slowPct: 0,
      slowTimer: 0,
      stunTimer: 0,
      dots: [],
      summonTimer: def.special?.summon?.interval ?? 0,
      bossSummonTimer: def.boss?.summon?.interval ?? 0,
      bossDisableTimer: def.boss?.towerDisable?.interval ?? 0,
      enraged: false,
      mana: 0,
    });
  }

  // ---- Enemies -----------------------------------------------------------

  private updateEnemies(dt: number): void {
    for (const e of this.enemies) {
      if (!e.alive) continue;

      this.tickEnemyStatus(e, dt);
      if (!e.alive) continue;

      if (e.stats.hpRegen > 0) e.hp = Math.min(e.stats.maxHp, e.hp + e.stats.hpRegen * dt);
      if (e.def.special?.healAura) this.applyHealAura(e, dt);
      if (e.def.boss) this.updateBoss(e, dt);
      if (e.def.special?.summon) {
        e.summonTimer -= dt;
        if (e.summonTimer <= 0) {
          this.queueSummon(e, e.def.special.summon.enemyId, e.def.special.summon.count);
          e.summonTimer = e.def.special.summon.interval;
        }
      }

      if (e.stunTimer > 0) {
        this.updateEnemyThreat(e);
        continue;
      }

      const action = this.chooseEnemyAction(e);
      if (action.kind === "hero") {
        this.enemyAttack(e, dt, () => this.dealDamageToHero(e));
      } else if (action.kind === "tower") {
        const tower = action.tower;
        this.enemyAttack(e, dt, () => this.dealDamageToTower(e, tower));
      } else {
        this.advanceEnemy(e, dt);
      }
      this.updateEnemyThreat(e);
    }
  }

  private tickEnemyStatus(e: EnemyRuntime, dt: number): void {
    if (e.slowTimer > 0) {
      e.slowTimer -= dt;
      if (e.slowTimer <= 0) e.slowPct = 0;
    }
    if (e.stunTimer > 0) e.stunTimer -= dt;

    if (e.dots.length > 0) {
      const survivors: Dot[] = [];
      for (const d of e.dots) {
        const active = Math.min(dt, d.remaining);
        if (active > 0) {
          const ctx = this.dmgCtx("dot", "dot", `dot ${d.dps}/s ×${active.toFixed(2)}s`);
          this.applyDamage(e, d.type, d.dps * active, d.armorPen, d.magicPen, false, false, ctx);
        }
        const left = d.remaining - dt;
        if (left > 0 && e.alive) survivors.push({ ...d, remaining: left });
      }
      e.dots = survivors;
    }
  }

  private chooseEnemyAction(
    e: EnemyRuntime,
  ): { kind: "hero" } | { kind: "tower"; tower: TowerRuntime } | { kind: "move" } {
    if (this.hero.alive && !e.flying && dist(e.pos, this.hero.pos) <= HERO_BLOCK_RANGE) {
      return { kind: "hero" };
    }
    const atk = e.def.special?.attacksTowers;
    if (atk) {
      let best: TowerRuntime | null = null;
      for (const t of this.towers) {
        if (t.alive && dist(e.pos, t.pos) <= atk.range) {
          if (!best || dist(e.pos, t.pos) < dist(e.pos, best.pos)) best = t;
        }
      }
      if (best) return { kind: "tower", tower: best };
    }
    return { kind: "move" };
  }

  private enemyAttack(e: EnemyRuntime, dt: number, hit: () => void): void {
    e.attackCd -= dt;
    if (e.attackCd <= 0 && e.stats.attackSpeed > 0) {
      hit();
      e.attackCd = 1 / e.stats.attackSpeed;
    }
  }

  private applyHealAura(healer: EnemyRuntime, dt: number): void {
    const aura = healer.def.special!.healAura!;
    for (const o of this.enemies) {
      if (!o.alive || o === healer) continue;
      if (dist(healer.pos, o.pos) <= aura.radius) o.hp = Math.min(o.stats.maxHp, o.hp + aura.hps * dt);
    }
  }

  private updateBoss(e: EnemyRuntime, dt: number): void {
    const b = e.def.boss!;
    if (b.enrage && !e.enraged && e.hp / e.stats.maxHp <= b.enrage.belowHpPct) e.enraged = true;
    if (b.summon) {
      e.bossSummonTimer -= dt;
      if (e.bossSummonTimer <= 0) {
        this.queueSummon(e, b.summon.enemyId, b.summon.count);
        e.bossSummonTimer = b.summon.interval;
      }
    }
    if (b.towerDisable) {
      e.bossDisableTimer -= dt;
      if (e.bossDisableTimer <= 0) {
        for (const t of this.towers) {
          if (t.alive && dist(e.pos, t.pos) <= b.towerDisable.radius) {
            t.disabledTimer = Math.max(t.disabledTimer, b.towerDisable.duration);
          }
        }
        e.bossDisableTimer = b.towerDisable.interval;
      }
    }
    // Boss active skill — mana fills over time, cast when full (T16).
    if (b.skill) {
      e.mana += BOSS_MANA_REGEN * dt;
      if (e.mana >= b.skill.manaCost) { this.castBossSkill(e, b.skill); e.mana = 0; }
    }
  }

  /** Apply a boss's active skill and emit its cast FX. */
  private castBossSkill(e: EnemyRuntime, skill: BossSkill): void {
    const R = skill.radius ?? 150;
    this.emit({ type: "bossCast", uid: e.uid, at: { x: e.pos.x, y: e.pos.y }, skill: skill.type, radius: R, name: skill.name });
    switch (skill.type) {
      case "quake": {
        // Disable towers in radius and hammer the hero if caught inside.
        for (const t of this.towers) {
          if (t.alive && dist(e.pos, t.pos) <= R) t.disabledTimer = Math.max(t.disabledTimer, 2);
        }
        if (this.hero.alive && dist(e.pos, this.hero.pos) <= R) {
          const dmg = (skill.power ?? 0.12) * this.hero.stats.maxHp;
          this.hero.hp = Math.max(0, this.hero.hp - dmg);
        }
        break;
      }
      case "rally": {
        const heal = skill.power ?? 0.15;
        for (const o of this.enemies) {
          if (o.alive && dist(e.pos, o.pos) <= R) o.hp = Math.min(o.stats.maxHp, o.hp + heal * o.stats.maxHp);
        }
        break;
      }
      case "barrier": {
        const sh = skill.power ?? 0.25;
        for (const o of this.enemies) {
          if (o.alive && dist(e.pos, o.pos) <= R) o.shield = Math.max(o.shield, sh * o.stats.maxHp);
        }
        break;
      }
      case "summon-surge":
        this.queueSummon(e, skill.summonId ?? "imp", Math.round(skill.power ?? 3));
        break;
    }
  }

  private enemySpeed(e: EnemyRuntime): number {
    const base = slowedSpeed(e.stats.moveSpeed, e.slowPct);
    return e.enraged && e.def.boss?.enrage ? base * e.def.boss.enrage.speedMult : base;
  }

  private enemyAtk(e: EnemyRuntime): number {
    return e.enraged && e.def.boss?.enrage ? e.stats.atk * e.def.boss.enrage.atkMult : e.stats.atk;
  }

  private advanceEnemy(e: EnemyRuntime, dt: number): void {
    const step = this.enemySpeed(e) * dt;
    if (e.flying) {
      const lineLen = Math.max(1e-6, dist(e.airStart, this.castlePos));
      e.airProgress += step / lineLen;
      if (e.airProgress >= 1) return this.reachCastle(e);
      e.pos = lerp(e.airStart, this.castlePos, e.airProgress);
    } else {
      e.distanceAlong += step;
      if (e.distanceAlong >= this.totalPathLen) return this.reachCastle(e);
      e.pos = pointAtDistance(this.stage.path, e.distanceAlong);
    }
  }

  private updateEnemyThreat(e: EnemyRuntime): void {
    e.threat = e.flying
      ? Math.min(1, e.airProgress)
      : Math.min(1, this.totalPathLen === 0 ? 1 : e.distanceAlong / this.totalPathLen);
  }

  private reachCastle(e: EnemyRuntime): void {
    this.castleHp -= e.def.castleDamage;
    e.alive = false;
  }

  private dealDamageToHero(attacker: EnemyRuntime): void {
    const packet: DamagePacket = {
      amount: this.enemyAtk(attacker),
      type: attacker.def.damageType,
      armorPen: attacker.stats.armorPen,
      magicPen: attacker.stats.magicPen,
    };
    this.emit({ type: "enemyAttack", uid: attacker.uid, at: { x: attacker.pos.x, y: attacker.pos.y }, targetAt: { x: this.hero.pos.x, y: this.hero.pos.y }, target: "hero" });
    this.hero.hp -= mitigatedDamage(packet, this.hero.stats);
    this.logEnemyHit(attacker, "hero", packet, this.hero.stats, this.hero.hp);
    if (this.hero.hp <= 0) this.hero.alive = false;
  }

  /** Log an enemy's hit on the hero/a tower (these don't run through applyDamage). */
  private logEnemyHit(attacker: EnemyRuntime, targetLabel: string, packet: DamagePacket, defender: Stats, hpAfter: number): void {
    if (!combatLogOn()) return;
    const b = mitigationBreakdown(packet, defender);
    emitDamageLog({
      src: `enemy:${attacker.uid}`, target: targetLabel, kind: "enemy-atk", type: packet.type,
      raw: Math.max(0, packet.amount), rawFormula: `atk ${packet.amount.toFixed(1)}`,
      defRating: b.defRating, pen: packet.type === "Physical" ? packet.armorPen : packet.type === "Magic" ? packet.magicPen : 0,
      effRating: b.effRating, mitigationFrac: b.mitigationFrac, afterMitig: b.afterMitig,
      damageReduction: b.damageReduction, afterDR: b.final, shieldAbsorbed: 0, hpDamage: b.final,
      targetHpAfter: Math.max(0, hpAfter), targetHpMax: defender.maxHp,
    });
  }

  private dealDamageToTower(attacker: EnemyRuntime, tower: TowerRuntime): void {
    const packet: DamagePacket = {
      amount: this.enemyAtk(attacker),
      type: attacker.def.damageType,
      armorPen: attacker.stats.armorPen,
      magicPen: attacker.stats.magicPen,
    };
    this.emit({ type: "enemyAttack", uid: attacker.uid, at: { x: attacker.pos.x, y: attacker.pos.y }, targetAt: { x: tower.pos.x, y: tower.pos.y }, target: "tower" });
    tower.hp -= mitigatedDamage(packet, tower.stats);
    this.logEnemyHit(attacker, `tower:${tower.uid}`, packet, tower.stats, tower.hp);
    if (tower.hp <= 0) tower.alive = false;
  }

  private queueSummon(parent: EnemyRuntime, enemyId: string, count: number): void {
    for (let i = 0; i < count; i++) {
      this.pending.push(
        parent.flying
          ? { enemyId, airProgress: parent.airProgress, airStart: parent.airStart }
          : { enemyId, distanceAlong: parent.distanceAlong },
      );
    }
  }

  private flushPending(): void {
    if (this.pending.length === 0) return;
    const reqs = this.pending;
    this.pending = [];
    for (const r of reqs) this.spawnEnemy(r);
  }

  // ---- Towers ------------------------------------------------------------

  private recomputeTowerBuffs(): void {
    for (const t of this.towers) {
      t.buffAtkPct = 0;
      t.buffAsPct = 0;
    }
    for (const s of this.towers) {
      const aura = s.behavior?.buffAura;
      if (!s.alive || s.disabledTimer > 0 || s.def.role !== "support" || !aura) continue;
      for (const t of this.towers) {
        if (!t.alive || t === s) continue;
        if (dist(s.pos, t.pos) <= aura.radius) {
          t.buffAtkPct += aura.atkPct ?? 0;
          t.buffAsPct += aura.attackSpeedPct ?? 0;
        }
      }
    }
  }

  /** A stealthed enemy is revealed while inside the hero's range; towers may then
   *  target it (if it is also in the tower's range). The hero always sees them. */
  private updateStealthReveal(): void {
    const h = this.hero;
    const r2 = h.stats.range * h.stats.range;
    for (const e of this.enemies) {
      if (!e.stealth) { e.revealed = true; continue; }
      e.revealed = h.alive && (e.pos.x - h.pos.x) ** 2 + (e.pos.y - h.pos.y) ** 2 <= r2;
    }
  }

  private updateTowers(dt: number): void {
    for (const t of this.towers) {
      if (!t.alive) continue;
      if (t.disabledTimer > 0) {
        t.disabledTimer -= dt;
        continue;
      }

      if (t.stats.maxMana > 0) t.mana = Math.min(t.stats.maxMana, t.mana + t.stats.manaRegen * dt);

      const effAs = t.stats.attackSpeed * (1 + t.buffAsPct);
      t.attackCd -= dt;
      if (t.attackCd > 0 || effAs <= 0) continue;

      const target = selectTarget(t.pos, t.stats.range, this.enemies, targetFilter(t.def.target));
      if (!target) continue;

      const effAtk = t.stats.atk * (1 + t.buffAtkPct);
      this.performAttack(t, t.pos, effAtk, t.def.damageType, target, "tower", t.def.role, t.uid, attackStyleFor(t.def));
      this.applyRoleEffect(t, effAtk, target);

      if (t.stats.maxMana > 0 && t.mana >= t.stats.maxMana) {
        // Skills may deal True damage (the only path to True).
        const activeType = t.behavior?.activeType ?? t.def.damageType;
        this.castActive(t.stats, effAtk, activeType, target.pos, "tower", t.uid, t.def.active ?? undefined);
        t.mana = 0;
      }
      t.attackCd = 1 / effAs;
    }
  }

  /** Apply a tower's role-specific on-hit effect (splash/chain/dot/debuff). */
  private applyRoleEffect(t: TowerRuntime, effAtk: number, target: EnemyRuntime): void {
    const bhv = t.behavior;
    switch (t.def.role) {
      case "splash":
        this.applySplash(t.stats, t.def.damageType, effAtk, target.pos, target, bhv?.splashRadius ?? SPLASH_RADIUS);
        break;
      case "chain":
        this.applyChain(t, effAtk, target, bhv?.chainTargets ?? 2, bhv?.chainFalloff ?? 0.6);
        break;
      case "dot":
        if (bhv?.dot) {
          this.addDot(target, bhv.dot.damageType ?? t.def.damageType, bhv.dot.dps, bhv.dot.duration, t.stats);
        }
        break;
      case "debuff":
        if (bhv?.slow) this.applySlow(target, bhv.slow.pct, bhv.slow.duration);
        if (bhv?.stun) this.applyStun(target, bhv.stun.duration, bhv.stun.chance);
        break;
      default:
        break;
    }
  }

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
    if (h.stats.maxMana > 0) h.mana = Math.min(h.stats.maxMana, h.mana + h.stats.manaRegen * dt);

    const toTarget = dist(h.pos, h.moveTarget);
    if (toTarget > 1) {
      const step = Math.min(toTarget, h.stats.moveSpeed * dt);
      h.pos = lerp(h.pos, h.moveTarget, step / toTarget);
    }

    h.attackCd -= dt;
    if (h.attackCd > 0 || h.stats.attackSpeed <= 0) return;

    const target = selectTarget(h.pos, h.stats.range, this.enemies, HERO_FILTER);
    if (!target) return;

    this.performAttack(h, h.pos, h.stats.atk, h.damageType, target, "hero", "hero", -1, heroAttackStyle(h.damageType, h.stats.range));
    if (h.stats.maxMana > 0 && h.mana >= h.stats.maxMana) {
      this.castActive(h.stats, h.stats.atk, h.damageType, target.pos, "hero", -1);
      h.mana = 0;
    }
    h.attackCd = 1 / h.stats.attackSpeed;
  }

  // ---- Damage application ------------------------------------------------

  /** Append a transient visual event (bounded so a stalled renderer can't grow it). */
  private emit(e: FxEvent): void {
    if (this.fx.length < 256) this.fx.push(e);
  }

  /** One single-target attack with crit + mana credit + omnivamp. */
  private performAttack(
    unit: { stats: Stats; mana: number; hp: number },
    fromPos: Vec2,
    rawAtk: number,
    damageType: DamageType,
    target: EnemyRuntime,
    source: "tower" | "hero",
    role: string,
    srcUid: number,
    style: string,
  ): void {
    const wasAlive = target.alive;
    const { hit: didCrit, roll: critRoll } = this.rng.rollChance(unit.stats.critRate);
    const critMult = critMultiplier(unit.stats.critDamage, target.stats.critDefense);
    const raw = didCrit ? rawAtk * critMult : rawAtk;
    this.emit({
      type: "attack",
      uid: srcUid,
      from: { x: fromPos.x, y: fromPos.y },
      to: { x: target.pos.x, y: target.pos.y },
      ranged: dist(fromPos, target.pos) > 44,
      damageType,
      crit: didCrit,
      role,
      source,
      style,
    });
    const ctx = this.dmgCtx(`${source}:${srcUid}`, "basic", `atk ${rawAtk.toFixed(1)}`,
      combatLogOn() ? { rate: unit.stats.critRate, roll: critRoll, hit: didCrit, mult: critMult } : undefined);
    const dealt = this.applyDamage(target, damageType, raw, unit.stats.armorPen, unit.stats.magicPen, false, true, ctx);

    if (unit.stats.maxMana > 0) {
      unit.mana = Math.min(unit.stats.maxMana, unit.mana + unit.stats.manaOnHit);
      if (wasAlive && !target.alive) {
        unit.mana = Math.min(unit.stats.maxMana, unit.mana + unit.stats.manaOnKill);
      }
    }
    if (unit.stats.omnivamp > 0 && dealt > 0) {
      unit.hp = Math.min(unit.stats.maxHp, unit.hp + dealt * unit.stats.omnivamp);
    }
  }

  /**
   * Apply raw damage of a type to an enemy: honour the single-immunity rule,
   * mitigate by armor/resist, absorb with shield, reduce HP, resolve death.
   * Returns the total damage applied (for omnivamp).
   */
  private applyDamage(
    target: EnemyRuntime,
    damageType: DamageType,
    rawAmount: number,
    armorPen: number,
    magicPen: number,
    isAoE: boolean,
    emitHit = true,
    dbg?: DmgCtx,
  ): number {
    if (!target.alive) return 0;
    if (this.isImmune(target, damageType, isAoE)) return 0;
    const packet: DamagePacket = { amount: rawAmount, type: damageType, armorPen, magicPen };
    const incoming = mitigatedDamage(packet, target.stats);
    if (incoming <= 0) return 0;

    if (emitHit) {
      this.emit({ type: "hit", uid: target.uid, at: { x: target.pos.x, y: target.pos.y }, damageType, amount: incoming, aoe: isAoE });
    }
    const { shield, overflow } = absorbWithShield(target.shield, incoming);
    target.shield = shield;
    target.hp -= overflow;

    if (dbg && combatLogOn()) {
      const b = mitigationBreakdown(packet, target.stats);
      emitDamageLog({
        src: dbg.src, target: `${target.def.id}#${target.uid}`, kind: dbg.kind, type: damageType,
        raw: Math.max(0, rawAmount), rawFormula: dbg.rawFormula, crit: dbg.crit,
        defRating: b.defRating, pen: damageType === "Physical" ? armorPen : damageType === "Magic" ? magicPen : 0,
        effRating: b.effRating, mitigationFrac: b.mitigationFrac, afterMitig: b.afterMitig,
        damageReduction: b.damageReduction, afterDR: b.final,
        shieldAbsorbed: incoming - overflow, hpDamage: overflow,
        targetHpAfter: Math.max(0, target.hp), targetHpMax: target.stats.maxHp,
      });
    }
    if (target.hp <= 0) this.killEnemy(target);
    return incoming;
  }

  /** Build a damage-log context only when logging is on (cheap no-op otherwise). */
  private dmgCtx(src: string, kind: string, rawFormula: string, crit?: DmgCtx["crit"]): DmgCtx | undefined {
    return combatLogOn() ? { src, kind, rawFormula, crit } : undefined;
  }

  private isImmune(target: EnemyRuntime, damageType: DamageType, isAoE: boolean): boolean {
    const imm = target.def.immunity;
    if (imm === null) return false;
    if (isAoE && imm === "AoE") return true;
    if (imm === "Physical" && damageType === "Physical") return true;
    if (imm === "Magic" && damageType === "Magic") return true;
    return false;
  }

  private applySplash(
    attacker: Stats,
    damageType: DamageType,
    effAtk: number,
    center: Vec2,
    primary: EnemyRuntime,
    radius: number,
  ): void {
    this.emit({ type: "splash", at: { x: center.x, y: center.y }, radius, damageType });
    const ctx = this.dmgCtx("splash", "splash", `splash atk ${effAtk.toFixed(1)}`);
    for (const e of this.enemies) {
      if (!e.alive || e === primary) continue;
      if (dist(e.pos, center) <= radius) {
        this.applyDamage(e, damageType, effAtk, attacker.armorPen, attacker.magicPen, true, true, ctx);
      }
    }
  }

  private applyChain(
    t: TowerRuntime,
    effAtk: number,
    primary: EnemyRuntime,
    bounces: number,
    falloff: number,
  ): void {
    let from = primary;
    let dmg = effAtk * falloff;
    const hit = new Set<number>([primary.uid]);
    for (let i = 0; i < bounces; i++) {
      let next: EnemyRuntime | null = null;
      for (const e of this.enemies) {
        if (!e.alive || hit.has(e.uid)) continue;
        if (dist(from.pos, e.pos) <= SPLASH_RADIUS * 1.5) {
          if (!next || dist(from.pos, e.pos) < dist(from.pos, next.pos)) next = e;
        }
      }
      if (!next) break;
      this.emit({ type: "chain", from: { x: from.pos.x, y: from.pos.y }, to: { x: next.pos.x, y: next.pos.y } });
      const ctx = this.dmgCtx(`tower:${t.uid}`, "chain", `chain bounce ${i + 1} dmg ${dmg.toFixed(1)} (×falloff ${falloff})`);
      this.applyDamage(next, t.def.damageType, dmg, t.stats.armorPen, t.stats.magicPen, false, true, ctx);
      hit.add(next.uid);
      from = next;
      dmg *= falloff;
    }
  }

  private addDot(
    target: EnemyRuntime,
    type: DamageType,
    dps: number,
    duration: number,
    attacker: Stats,
  ): void {
    target.dots.push({
      dps,
      remaining: duration,
      type,
      armorPen: attacker.armorPen,
      magicPen: attacker.magicPen,
    });
  }

  private applySlow(target: EnemyRuntime, pct: number, duration: number): void {
    if (target.def.immunity === "CC") return;
    target.slowPct = Math.max(target.slowPct, pct);
    target.slowTimer = Math.max(target.slowTimer, ccDuration(duration, target.stats.tenacity));
  }

  private applyStun(target: EnemyRuntime, duration: number, chance: number): void {
    if (target.def.immunity === "CC") return;
    if (!this.rng.chance(chance)) return;
    target.stunTimer = Math.max(target.stunTimer, ccDuration(duration, target.stats.tenacity));
  }

  private castActive(
    attacker: Stats,
    effAtk: number,
    damageType: DamageType,
    center: Vec2,
    source: "tower" | "hero",
    uid: number,
    skillId?: string,
  ): void {
    this.emit({ type: "cast", uid, at: { x: center.x, y: center.y }, damageType, radius: SPLASH_RADIUS, source, skillId });
    const sp = Math.max(1, attacker.skillPower);
    const burst = effAtk * 2 * sp;
    const ctx = this.dmgCtx(`${source}:${uid}`, "active", `atk ${effAtk.toFixed(1)} ×2 ×skillPower ${sp.toFixed(2)}`);
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (dist(e.pos, center) <= SPLASH_RADIUS) {
        this.applyDamage(e, damageType, burst, attacker.armorPen, attacker.magicPen, true, true, ctx);
      }
    }
  }

  private killEnemy(e: EnemyRuntime): void {
    if (!e.alive) return;
    e.alive = false;
    const scale = DIFFICULTY_SCALING[this.difficulty];
    const reward = Math.round(e.def.bounty * scale.bountyMult * (1 + this.hero.stats.goldFind));
    this.gold += reward;
    const boss = e.def.archetype === "Boss";
    this.emit({ type: "death", at: { x: e.pos.x, y: e.pos.y }, boss, bounty: e.def.bounty });
    this.emit({ type: "loot", at: { x: e.pos.x, y: e.pos.y }, gold: reward });
    // Per-kill XP + loot persist immediately (kept even if the stage is abandoned).
    if (this._heroSave) {
      const kr = processEnemyKill(this._heroSave, e.def, this.difficulty, itemLevelForStage(this.stage.id), this.rng);
      this.emit({ type: "killReward", at: { x: e.pos.x, y: e.pos.y - 14 }, xp: kr.xp, item: kr.itemDropped !== null });
    }
    const split = e.def.special?.splitInto;
    if (split) {
      for (let i = 0; i < split.count; i++) {
        this.pending.push(
          e.flying
            ? { enemyId: split.enemyId, airProgress: e.airProgress, airStart: e.airStart }
            : { enemyId: split.enemyId, distanceAlong: e.distanceAlong },
        );
      }
    }
  }

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
