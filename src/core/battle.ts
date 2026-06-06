/**
 * BattleState — the headless battle simulation.
 *
 * This is pure game logic: no Phaser, no rendering, no DOM. A scene drives it by
 * calling `tick(dt)` each frame and reads its public fields to draw. Input
 * (placing towers, moving the hero) goes through methods. Because all randomness
 * comes from a seeded Rng, an entire battle is deterministic and unit-testable.
 *
 * Phase 1 scope (intentional simplifications, all noted inline):
 * - Tower roles: `damage` (single-target) and `splash` (AoE) are fully modelled;
 *   other roles fall back to single-target damage for now.
 * - Enemies damage the castle (on arrival) and the hero (on contact / body-block).
 *   Tower HP exists in the model but enemies do not yet attack towers.
 * - Active skills (hero + towers) are a generic AoE burst around the caster's
 *   target, scaled by Skill Power.
 */
import type {
  CharacterDef,
  DamageType,
  EnemyDef,
  StageDef,
  Stats,
  TargetType,
  Vec2,
} from "../data/schema.ts";
import { mitigatedDamage, rollAttackDamage, type DamagePacket } from "./damage.ts";
import { dist, lerp, pathLength, pointAtDistance } from "./path.ts";
import { Rng } from "./rng.ts";
import { selectTarget, type TargetFilter, type Targetable } from "./targeting.ts";

export type Outcome = "ongoing" | "won" | "lost";

/** How close an enemy must be to the hero to be body-blocked into melee. */
export const HERO_BLOCK_RANGE = 28;
/** Radius of generic active-skill / splash AoE bursts. */
export const SPLASH_RADIUS = 60;
/** Pause between waves once the current wave is fully cleared. */
export const INTER_WAVE_DELAY = 3;

export interface EnemyRuntime extends Targetable {
  uid: number;
  def: EnemyDef;
  stats: Stats;
  hp: number;
  flying: boolean;
  /** Ground: distance travelled along the lane. Flying: unused. */
  distanceAlong: number;
  /** Flying: 0..1 progress along the straight beeline to the castle. */
  airProgress: number;
  airStart: Vec2;
  pos: Vec2;
  threat: number;
  alive: boolean;
  attackCd: number;
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
}

export interface HeroRuntime {
  stats: Stats;
  damageType: DamageType;
  pos: Vec2;
  /** Where the player has ordered the hero to walk to. */
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
}

interface Catalogs {
  enemies: Map<string, EnemyDef>;
  characters: Map<string, CharacterDef>;
}

interface ScheduledSpawn {
  at: number;
  enemyId: string;
}

function targetFilter(target: TargetType): TargetFilter {
  return {
    canHitGround: target === "Ground" || target === "Both",
    canHitAir: target === "Air" || target === "Both",
  };
}

export class BattleState {
  readonly stage: StageDef;
  readonly enemies: EnemyRuntime[] = [];
  readonly towers: TowerRuntime[] = [];
  readonly hero: HeroRuntime;
  readonly castlePos: Vec2;

  castleHp: number;
  gold: number;
  time = 0;
  outcome: Outcome = "ongoing";

  /** 0-based index of the wave currently active, or -1 before the first wave. */
  waveIndex = -1;

  private readonly cat: Catalogs;
  private readonly rng: Rng;
  private readonly totalPathLen: number;

  // Wave-runner internal state.
  private schedule: ScheduledSpawn[] = [];
  private schedulePtr = 0;
  private waveActive = false;
  private interWaveTimer = INTER_WAVE_DELAY;
  private allWavesStarted = false;
  private nextUid = 1;

  constructor(stage: StageDef, catalogs: Catalogs, opts: BattleOptions) {
    this.stage = stage;
    this.cat = catalogs;
    this.rng = new Rng(opts.seed ?? 1);
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
  }

  // ---- Input -------------------------------------------------------------

  /** Order the hero to walk toward a world point. */
  commandHero(target: Vec2): void {
    this.hero.moveTarget = { ...target };
  }

  /** Try to place a character as a tower on an empty slot. Returns success. */
  placeTower(characterId: string, slotIndex: number): boolean {
    if (this.outcome !== "ongoing") return false;
    const def = this.cat.characters.get(characterId);
    if (!def) return false;
    if (slotIndex < 0 || slotIndex >= this.stage.towerSlots.length) return false;
    if (this.towers.some((t) => t.slotIndex === slotIndex && t.alive)) return false;
    if (this.gold < def.cost) return false;

    this.gold -= def.cost;
    this.towers.push({
      uid: this.nextUid++,
      def,
      stats: { ...def.baseStats },
      slotIndex,
      pos: { ...this.stage.towerSlots[slotIndex] },
      hp: def.baseStats.maxHp,
      mana: 0,
      attackCd: 0,
      alive: true,
    });
    return true;
  }

  // ---- Simulation --------------------------------------------------------

  tick(dt: number): void {
    if (this.outcome !== "ongoing" || dt <= 0) return;
    this.time += dt;

    this.updateWaves(dt);
    this.updateEnemies(dt);
    this.updateTowers(dt);
    this.updateHero(dt);
    this.cleanupDead();
    this.checkOutcome();
  }

  private updateWaves(dt: number): void {
    if (!this.waveActive) {
      // Waiting to launch the next wave.
      if (this.waveIndex + 1 >= this.stage.waves.length) {
        this.allWavesStarted = true;
        return;
      }
      this.interWaveTimer -= dt;
      if (this.interWaveTimer <= 0) this.startNextWave();
      return;
    }

    // Spawn everything due by now.
    while (this.schedulePtr < this.schedule.length && this.schedule[this.schedulePtr].at <= this.time) {
      this.spawnEnemy(this.schedule[this.schedulePtr].enemyId);
      this.schedulePtr++;
    }

    // Wave is cleared once everything has spawned and no enemies remain.
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
        schedule.push({ at: this.time + group.delay + i * group.interval, enemyId: group.enemyId });
      }
    }
    schedule.sort((a, b) => a.at - b.at);
    this.schedule = schedule;
    this.schedulePtr = 0;
    this.waveActive = true;
  }

  private spawnEnemy(enemyId: string): void {
    const def = this.cat.enemies.get(enemyId);
    if (!def) return;
    const flying = def.flying;
    const airStart =
      this.stage.airSpawns.length > 0
        ? this.stage.airSpawns[this.nextUid % this.stage.airSpawns.length]
        : this.stage.path[0];
    const pos = flying ? { ...airStart } : { ...this.stage.path[0] };
    this.enemies.push({
      uid: this.nextUid++,
      def,
      stats: { ...def.baseStats },
      hp: def.baseStats.maxHp,
      flying,
      distanceAlong: 0,
      airProgress: 0,
      airStart,
      pos,
      threat: 0,
      alive: true,
      attackCd: 0,
    });
  }

  private updateEnemies(dt: number): void {
    for (const e of this.enemies) {
      if (!e.alive) continue;

      // Regen.
      if (e.stats.hpRegen > 0) e.hp = Math.min(e.stats.maxHp, e.hp + e.stats.hpRegen * dt);

      // Body-block: a ground enemy in contact with the hero stops and fights.
      const blockedByHero =
        this.hero.alive && !e.flying && dist(e.pos, this.hero.pos) <= HERO_BLOCK_RANGE;

      if (blockedByHero) {
        e.attackCd -= dt;
        if (e.attackCd <= 0 && e.stats.attackSpeed > 0) {
          this.dealDamageToHero(e);
          e.attackCd = 1 / e.stats.attackSpeed;
        }
      } else {
        this.advanceEnemy(e, dt);
      }
      this.updateEnemyThreat(e);
    }
  }

  private advanceEnemy(e: EnemyRuntime, dt: number): void {
    const step = e.stats.moveSpeed * dt;
    if (e.flying) {
      const lineLen = Math.max(1e-6, dist(e.airStart, this.castlePos));
      e.airProgress += step / lineLen;
      if (e.airProgress >= 1) {
        this.reachCastle(e);
        return;
      }
      e.pos = lerp(e.airStart, this.castlePos, e.airProgress);
    } else {
      e.distanceAlong += step;
      if (e.distanceAlong >= this.totalPathLen) {
        this.reachCastle(e);
        return;
      }
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
      amount: attacker.stats.atk,
      type: attacker.def.damageType,
      armorPen: attacker.stats.armorPen,
      magicPen: attacker.stats.magicPen,
    };
    this.hero.hp -= mitigatedDamage(packet, this.hero.stats);
    if (this.hero.hp <= 0) this.hero.alive = false;
  }

  private updateTowers(dt: number): void {
    for (const t of this.towers) {
      if (!t.alive) continue;
      if (t.stats.maxMana > 0) {
        t.mana = Math.min(t.stats.maxMana, t.mana + t.stats.manaRegen * dt);
      }
      t.attackCd -= dt;
      if (t.attackCd > 0 || t.stats.attackSpeed <= 0) continue;

      const target = selectTarget(t.pos, t.stats.range, this.enemies, targetFilter(t.def.target));
      if (!target) continue;

      this.performAttack(t.stats, t.def.damageType, target, () => {
        t.mana = Math.min(t.stats.maxMana, t.mana + t.stats.manaOnHit);
      });
      // Splash role hits everything around the primary target.
      if (t.def.role === "splash") this.applySplash(t.stats, t.def.damageType, target.pos, target);

      // Active: auto-cast when the mana bar fills.
      if (t.stats.maxMana > 0 && t.mana >= t.stats.maxMana) {
        this.castActive(t.stats, t.def.damageType, target.pos);
        t.mana = 0;
      }
      t.attackCd = 1 / t.stats.attackSpeed;
    }
  }

  private updateHero(dt: number): void {
    const h = this.hero;
    if (!h.alive) return;

    if (h.stats.hpRegen > 0) h.hp = Math.min(h.stats.maxHp, h.hp + h.stats.hpRegen * dt);
    if (h.stats.maxMana > 0) h.mana = Math.min(h.stats.maxMana, h.mana + h.stats.manaRegen * dt);

    // Move toward the player's commanded point.
    const toTarget = dist(h.pos, h.moveTarget);
    if (toTarget > 1) {
      const step = Math.min(toTarget, h.stats.moveSpeed * dt);
      h.pos = lerp(h.pos, h.moveTarget, step / toTarget);
    }

    h.attackCd -= dt;
    if (h.attackCd > 0 || h.stats.attackSpeed <= 0) return;

    // Hero hits both ground and air.
    const target = selectTarget(h.pos, h.stats.range, this.enemies, {
      canHitGround: true,
      canHitAir: true,
    });
    if (!target) return;

    this.performAttack(h.stats, h.damageType, target, () => {
      h.mana = Math.min(h.stats.maxMana, h.mana + h.stats.manaOnHit);
    });
    if (h.stats.maxMana > 0 && h.mana >= h.stats.maxMana) {
      this.castActive(h.stats, h.damageType, target.pos);
      h.mana = 0;
    }
    h.attackCd = 1 / h.stats.attackSpeed;
  }

  /** A single-target attack: roll crit, mitigate, apply, handle kill. */
  private performAttack(
    attacker: Stats,
    damageType: DamageType,
    target: EnemyRuntime,
    onHit: () => void,
  ): void {
    const didCrit = this.rng.chance(attacker.critRate);
    const raw = rollAttackDamage(attacker, didCrit);
    this.damageEnemy(attacker, damageType, target, raw, false);
    onHit();
  }

  /**
   * Apply a raw damage amount to an enemy using the given damage type and the
   * attacker's penetration, honouring the single-immunity rule, then resolve
   * death. `isAoE` lets AoE-immune enemies shrug off splash/active bursts.
   */
  private damageEnemy(
    attacker: Stats,
    damageType: DamageType,
    target: EnemyRuntime,
    rawAmount: number,
    isAoE: boolean,
  ): void {
    if (!target.alive) return;
    if (this.isImmune(target, damageType, isAoE)) return;
    const packet: DamagePacket = {
      amount: rawAmount,
      type: damageType,
      armorPen: attacker.armorPen,
      magicPen: attacker.magicPen,
    };
    const dealt = mitigatedDamage(packet, target.stats);
    target.hp -= dealt;
    if (target.hp <= 0) this.killEnemy(target);
  }

  /** An enemy may be immune to ONE of {Physical, Magic, CC, AoE}. */
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
    center: Vec2,
    primary: EnemyRuntime,
  ): void {
    for (const e of this.enemies) {
      if (!e.alive || e === primary) continue;
      if (dist(e.pos, center) <= SPLASH_RADIUS) {
        this.damageEnemy(attacker, damageType, e, attacker.atk, true);
      }
    }
  }

  /** Generic active-skill burst: AoE around a point, scaled by Skill Power. */
  private castActive(attacker: Stats, damageType: DamageType, center: Vec2): void {
    const burst = attacker.atk * 2 * Math.max(1, attacker.skillPower);
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (dist(e.pos, center) <= SPLASH_RADIUS) {
        this.damageEnemy(attacker, damageType, e, burst, true);
      }
    }
  }

  private killEnemy(e: EnemyRuntime): void {
    if (!e.alive) return;
    e.alive = false;
    this.gold += Math.round(e.def.bounty * (1 + this.hero.stats.goldFind));
  }

  private cleanupDead(): void {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      if (!this.enemies[i].alive) this.enemies.splice(i, 1);
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
