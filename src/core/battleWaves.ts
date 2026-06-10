/**
 * Wave scheduling + enemy spawning for {@link BattleState}. Methods are merged
 * onto the BattleState prototype in `battle.ts`; `this` is the live battle.
 */
import { DIFFICULTY_SCALING, type Immunity, type StageDef, type Stats } from "../data/schema.ts";
import { stageNumber } from "../data/stage.ts";
import { lerp, pointAtDistance } from "./path.ts";
import { applyEliteBoost, rollEliteImmunity } from "./elite.ts";
import { waveScaling } from "./waveScaling.ts";
import type { BattleState } from "./battle.ts";
import {
  type Catalogs, type ScheduledSpawn, type SpawnRequest,
  INTER_WAVE_DELAY, PERFECT_WAVE_BONUS_FRAC,
} from "./battleTypes.ts";

export const waveMethods = {
  updateWaves(this: BattleState, dt: number): void {
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
      this.spawnEnemy({ enemyId: this.schedule[this.schedulePtr].enemyId, fromWave: true });
      this.schedulePtr++;
    }

    const fullySpawned = this.schedulePtr >= this.schedule.length;
    if (fullySpawned && this.enemies.length === 0) {
      this.waveActive = false;
      this.interWaveTimer = INTER_WAVE_DELAY;
      // F14: wave cleared — if nothing leaked, pay a perfect-wave bonus.
      if (!this.waveLeaked) {
        const bonus = Math.round(this.waveGold * PERFECT_WAVE_BONUS_FRAC);
        if (bonus > 0) this.gold += bonus;
        this.emit({ type: "perfect", waveIndex: this.waveIndex, bonus });
      }
      if (this.waveIndex + 1 >= this.stage.waves.length) this.allWavesStarted = true;
    }
  },

  startNextWave(this: BattleState): void {
    this.waveIndex++;
    // F14: a fresh wave starts flawless; track its kill gold for the bonus.
    this.waveLeaked = false;
    this.waveGold = 0;
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
  },

  /** Total non-boss enemies scheduled across all waves — the elite-target pool. */
  countEligibleWaveSpawns(this: BattleState, stage: StageDef, cat: Catalogs): number {
    let n = 0;
    for (const wave of stage.waves) {
      for (const group of wave.spawns) {
        const d = cat.enemies.get(group.enemyId);
        if (d && d.archetype !== "Boss") n += group.count;
      }
    }
    return n;
  },

  spawnEnemy(this: BattleState, req: SpawnRequest): void {
    const def = this.cat.enemies.get(req.enemyId);
    if (!def) return;
    const scale = DIFFICULTY_SCALING[this.difficulty];
    // F5 challenge tilts + F11 endless ramp layer on top of difficulty scaling.
    const ch = this.challenge;
    // Intra-stage escalation: each successive wave in a stage is tougher than the
    // last, so the back half of a stage is a real throughput test (not a victory
    // lap one tower can sweep). Bosses are exempt from the steep ramp — they
    // already carry the stage's difficulty spike via the escalating boss roster.
    const ramp = waveScaling(
      this.waveIndex,
      this.stage.waves.length,
      stageNumber(this.stage.id),
      def.archetype === "Boss",
    );
    const hpMul = (ch.enemyHpMul ?? 1) * this.endlessMul * ramp.hpMult;
    const atkMul = this.endlessMul * ramp.atkMult;
    let stats: Stats = {
      ...def.baseStats,
      maxHp: def.baseStats.maxHp * scale.hpMult * hpMul,
      atk: def.baseStats.atk * scale.atkMult * atkMul,
      armor: def.baseStats.armor * (ch.enemyArmorMul ?? 1),
      magicResist: def.baseStats.magicResist * (ch.enemyArmorMul ?? 1),
      moveSpeed: def.baseStats.moveSpeed * (ch.enemySpeedMul ?? 1),
    };
    // Elite promotion (T17, reworked): at most ONE elite per battle, fixed to a
    // pre-rolled eligible wave-spawn index. Summons/splits are never elite.
    let elite = false;
    if (req.fromWave && def.archetype !== "Boss") {
      if (this.eliteThisBattle && !this.eliteSpawned && this.eligibleSpawnSeen === this.eliteTargetIndex) {
        elite = true;
        this.eliteSpawned = true;
      }
      this.eligibleSpawnSeen++;
    }
    // Elites gain a damage-type immunity (Physical or Magic) and a flat 50%
    // reduction — but only grant the immunity if the base has none, so we never
    // make a unit that only True damage can hurt.
    let eliteImmunity: Immunity | null = null;
    if (elite) {
      stats = applyEliteBoost(stats);
      if (def.immunity === null) eliteImmunity = rollEliteImmunity(this.rng);
    }
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
      shield: (def.special?.shieldHp ?? 0) * scale.hpMult * ramp.hpMult,
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
      elite,
      eliteImmunity,
      aura: { moveMult: 1, drAdd: 0, armorAdd: 0, magicResistAdd: 0 },
      mana: 0,
    });
  },
};

export type WaveMethods = typeof waveMethods;
