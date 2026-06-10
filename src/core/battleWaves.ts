/**
 * Wave scheduling + enemy spawning for {@link BattleState}. Methods are merged
 * onto the BattleState prototype in `battle.ts`; `this` is the live battle.
 */
import { DIFFICULTY_SCALING, type Immunity, type StageDef, type Stats } from "../data/schema.ts";
import { stageNumber } from "../data/stage.ts";
import { lerp, pointAtDistance } from "./path.ts";
import { applyEliteBoost, rollEliteImmunity } from "./elite.ts";
import { waveScaling } from "./waveScaling.ts";
import { progressionScaling } from "./progressionScaling.ts";
import { endlessWave, endlessEnemyMul } from "./endless.ts";
import { bossRushWave, BOSS_RUSH_TIERS } from "./bossRush.ts";
import type { BattleState } from "./battle.ts";
import {
  type Catalogs, type ScheduledSpawn, type SpawnRequest,
  INTER_WAVE_DELAY, PERFECT_WAVE_BONUS_FRAC,
} from "./battleTypes.ts";

export const waveMethods = {
  updateWaves(this: BattleState, dt: number): void {
    // Boss rush runs a fixed gauntlet (BOSS_RUSH_TIERS waves); endless never ends;
    // a normal stage runs its authored count.
    const totalWaves = this.bossRush ? BOSS_RUSH_TIERS : this.stage.waves.length;
    if (!this.waveActive) {
      // Endless never runs out of waves — it keeps generating them until the
      // castle falls, so allWavesStarted (the "won" gate) is never tripped.
      if (!this.endless && this.waveIndex + 1 >= totalWaves) {
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
      // A wave is fully cleared here — drives the boss-rush tier (bosses defeated).
      this.wavesCleared++;
      // F14: wave cleared — if nothing leaked, pay a perfect-wave bonus.
      if (!this.waveLeaked) {
        const bonus = Math.round(this.waveGold * PERFECT_WAVE_BONUS_FRAC);
        if (bonus > 0) this.gold += bonus;
        this.emit({ type: "perfect", waveIndex: this.waveIndex, bonus });
      }
      if (!this.endless && this.waveIndex + 1 >= totalWaves) this.allWavesStarted = true;
    }
  },

  startNextWave(this: BattleState): void {
    this.waveIndex++;
    // F14: a fresh wave starts flawless; track its kill gold for the bonus.
    this.waveLeaked = false;
    this.waveGold = 0;
    // Endless generates wave N on demand (1-based); boss rush pulls the gauntlet
    // tier; normal stages read their authored waves.
    const wave = this.endless
      ? endlessWave(this.waveIndex + 1)
      : this.bossRush
        ? bossRushWave(this.waveIndex + 1)
        : this.stage.waves[this.waveIndex];
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
    const isBoss = def.archetype === "Boss";
    // Intra-stage escalation: each successive wave in a stage is tougher than the
    // last, so the back half of a stage is a real throughput test (not a victory
    // lap one tower can sweep). Bosses are exempt from the steep ramp — they
    // already carry the stage's difficulty spike via the escalating boss roster.
    // In endless the intra-stage ramp is meaningless (stage.waves.length no longer
    // bounds the run); the compounding per-wave endless curve carries escalation
    // instead, evaluated freshly each wave so strength grows without limit.
    const ramp = this.endless
      ? { hpMult: 1, atkMult: 1 }
      : waveScaling(this.waveIndex, this.stage.waves.length, isBoss);
    const endlessW = this.endless ? endlessEnemyMul(this.waveIndex + 1) : this.endlessMul;
    // Cross-stage/chapter long-game curve: the SAME enemy gets geometrically
    // tougher the deeper you are in the campaign (applies to bosses too).
    const prog = progressionScaling(stageNumber(this.stage.id));
    // Bosses scale harder than trash on the upper tiers (boss* multipliers).
    const bossHp = isBoss ? scale.bossHpMult : 1;
    const bossAtk = isBoss ? scale.bossAtkMult : 1;
    const hpMul = (ch.enemyHpMul ?? 1) * endlessW * ramp.hpMult * prog.hpMult;
    const atkMul = endlessW * ramp.atkMult * prog.atkMult;
    let stats: Stats = {
      ...def.baseStats,
      maxHp: def.baseStats.maxHp * scale.hpMult * bossHp * hpMul,
      atk: def.baseStats.atk * scale.atkMult * bossAtk * atkMul,
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
      shield: (def.special?.shieldHp ?? 0) * scale.hpMult * endlessW * ramp.hpMult * prog.hpMult,
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
