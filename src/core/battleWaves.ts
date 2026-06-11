/**
 * Wave scheduling + enemy spawning for {@link BattleState}. Methods are merged
 * onto the BattleState prototype in `battle.ts`; `this` is the live battle.
 */
import { DIFFICULTY_SCALING, type Immunity, type StageDef, type Stats } from "../data/schema.ts";
import { stageNumber } from "../data/stage.ts";
import { lerp, pathLength, pointAtDistance } from "./path.ts";
import { applyEliteBoost, rollEliteImmunity } from "./elite.ts";
import { waveScaling } from "./waveScaling.ts";
import { progressionScaling } from "./progressionScaling.ts";
import { endlessWave, endlessEnemyMul } from "./endless.ts";
import { bossRushWave, BOSS_RUSH_TIERS } from "./bossRush.ts";
import type { BattleState } from "./battle.ts";
import {
  type Catalogs, type ScheduledSpawn, type SpawnRequest,
  INTER_WAVE_DELAY, WAVE_INTERVAL, SKIP_COIN_PER_SEC, PERFECT_WAVE_BONUS_FRAC,
  AUTO_SKIP_COUNTDOWN,
} from "./battleTypes.ts";

export const waveMethods = {
  /** Campaign stages run the fixed 30s cadence + skip; endless/boss-rush don't. */
  usesCadence(this: BattleState): boolean {
    return !this.endless && !this.bossRush;
  },

  /** How many waves this run has in total (∞ for endless → Infinity). */
  totalWaves(this: BattleState): number {
    return this.bossRush ? BOSS_RUSH_TIERS : this.endless ? Infinity : this.stage.waves.length;
  },

  updateWaves(this: BattleState, dt: number): void {
    if (this.usesCadence()) {
      // Campaign cadence: the next wave launches WAVE_INTERVAL after the LAST one
      // spawned, regardless of whether it's been cleared — so a stalled wave gets
      // reinforced and the player feels time pressure. BUT if the player wipes the
      // wave out early (no live enemies, no pending spawns), don't make them wait
      // the rest of the cadence: bank the time-saved bonus and auto-launch the next
      // wave after a short on-screen countdown. Until the final wave is out, run
      // one of those clocks; once it's out, trip the "won" gate.
      if (this.waveIndex + 1 < this.totalWaves()) {
        // Only after a wave has actually launched — at battle start the schedule is
        // empty and the field is bare, which must run the opening timer, not auto-skip.
        const fieldClear = this.waveIndex >= 0 && this.schedulePtr >= this.schedule.length && this.enemies.length === 0;
        if (this.autoSkipTimer > 0) {
          // An early-clear countdown is running — tick it down to the auto-launch.
          this.autoSkipTimer -= dt;
          if (this.autoSkipTimer <= 0) this.startNextWave();
        } else if (fieldClear) {
          // Just cleared early: pay the remaining-time bonus once, then start the
          // countdown. `skipReward` reads the cadence time still on the clock, so
          // this is exactly what tapping ⏩ at this instant would have paid.
          const bonus = this.skipReward();
          if (bonus > 0) this.gold += bonus;
          this.emit({ type: "autoskip", bonus });
          this.autoSkipTimer = AUTO_SKIP_COUNTDOWN;
        } else {
          this.nextWaveTimer -= dt;
          if (this.nextWaveTimer <= 0) this.startNextWave();
        }
      } else {
        this.allWavesStarted = true;
      }
      this.drainSchedule();
      this.waveActive = this.schedulePtr < this.schedule.length;
      // Clear-credit (perfect bonus + cleared count) is run in tick() AFTER kills
      // resolve, so the final wave's bonus lands on the same tick it's cleared.
      return;
    }

    // Endless / boss rush: one wave at a time — advance only once it's cleared,
    // after a short INTER_WAVE_DELAY breather.
    const total = this.totalWaves();
    if (!this.waveActive) {
      if (!this.endless && this.waveIndex + 1 >= total) {
        this.allWavesStarted = true;
        return;
      }
      this.nextWaveTimer -= dt;
      if (this.nextWaveTimer <= 0) this.startNextWave();
      return;
    }
    this.drainSchedule();
    if (this.schedulePtr >= this.schedule.length && this.enemies.length === 0) {
      this.waveActive = false;
      this.nextWaveTimer = INTER_WAVE_DELAY;
      // A wave is fully cleared here — drives the boss-rush tier (bosses defeated).
      this.wavesCleared++;
      // F14: wave cleared — if nothing leaked, pay a perfect-wave bonus.
      if (!this.waveLeaked) {
        const bonus = Math.round(this.waveGold * PERFECT_WAVE_BONUS_FRAC);
        if (bonus > 0) this.gold += bonus;
        this.emit({ type: "perfect", waveIndex: this.waveIndex, bonus });
      }
      if (!this.endless && this.waveIndex + 1 >= total) this.allWavesStarted = true;
    }
  },

  /** Spawn every scheduled enemy whose time has come. */
  drainSchedule(this: BattleState): void {
    while (
      this.schedulePtr < this.schedule.length &&
      this.schedule[this.schedulePtr].at <= this.time
    ) {
      this.spawnEnemy({ enemyId: this.schedule[this.schedulePtr].enemyId, fromWave: true });
      this.schedulePtr++;
    }
  },

  /**
   * Cadence-mode clear handling: when every wave launched so far is fully
   * cleared (no pending spawns, no live enemies), pay the perfect-wave bonus
   * once and advance the cleared-wave counter. Fires once per lull — it can't
   * re-fire until another wave launches and bumps waveIndex.
   */
  creditClearedWaves(this: BattleState): void {
    if (this.waveActive || this.enemies.length > 0) return;
    if (this.wavesCleared >= this.waveIndex + 1) return;
    if (!this.waveLeaked) {
      const bonus = Math.round(this.waveGold * PERFECT_WAVE_BONUS_FRAC);
      if (bonus > 0) this.gold += bonus;
      this.emit({ type: "perfect", waveIndex: this.waveIndex, bonus });
    }
    this.wavesCleared = this.waveIndex + 1;
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
    // Merge the new wave into the live schedule: drop the already-spawned prefix,
    // append the new spawns, and re-sort. In endless/boss-rush the previous wave
    // is always drained first, so this is just a fresh list; in cadence mode it
    // lets a new wave overlap one still spilling enemies onto the field.
    const merged: ScheduledSpawn[] = this.schedule.slice(this.schedulePtr);
    for (const group of wave.spawns) {
      for (let i = 0; i < group.count; i++) {
        merged.push({ at: this.time + group.delay + i * group.interval, enemyId: group.enemyId });
      }
    }
    merged.sort((a, b) => a.at - b.at);
    this.schedule = merged;
    this.schedulePtr = 0;
    this.waveActive = true;
    // A wave is launching — any pending early-clear countdown is consumed.
    this.autoSkipTimer = 0;
    // Restart the cadence clock from this launch (campaign); endless/boss-rush
    // overwrite it with INTER_WAVE_DELAY when the wave clears.
    this.nextWaveTimer = this.usesCadence() ? WAVE_INTERVAL : INTER_WAVE_DELAY;
  },

  // ---- Call-wave-early skip (campaign only) -------------------------------

  /**
   * Is a manual early wave-call available right now (campaign, mid-run, more waves
   * left)? Suppressed while an auto-skip countdown is running — that path already
   * launches the next wave (and paid the bonus), so the ⏩ button steps aside.
   */
  canCallWave(this: BattleState): boolean {
    return (
      this.usesCadence() &&
      this.outcome === "ongoing" &&
      this.autoSkipTimer <= 0 &&
      this.waveIndex + 1 < this.totalWaves()
    );
  },

  /** Seconds left on the next-wave countdown, or -1 when no skip is offered. */
  getNextWaveIn(this: BattleState): number {
    return this.canCallWave() ? Math.max(0, this.nextWaveTimer) : -1;
  },

  /** Seconds left on the early-clear auto-skip countdown, or -1 when not counting down. */
  getAutoSkipIn(this: BattleState): number {
    return this.autoSkipTimer > 0 ? this.autoSkipTimer : -1;
  },

  /** Gold a skip would pay right now (0 when unavailable) — scales with time left. */
  skipReward(this: BattleState): number {
    if (!this.canCallWave()) return 0;
    return Math.round(Math.max(0, this.nextWaveTimer) * SKIP_COIN_PER_SEC);
  },

  /**
   * Skip the countdown: spawn the next wave immediately and bank the bonus gold
   * for the time skipped. Returns the gold paid (0 if no skip was available).
   */
  callNextWave(this: BattleState): number {
    if (!this.canCallWave()) return 0;
    const bonus = this.skipReward();
    this.gold += bonus;
    this.startNextWave();
    return bonus;
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
    const arena = this.stage.arena;
    // Arena: ground enemies pick a random precomputed corridor; flyers beeline the
    // center from a random gate. Campaign: the single shared lane / round-robin air.
    const route = req.route ??
      (arena ? arena.routes[Math.floor(this.rng.next() * arena.routes.length)] : this.stage.path);
    const airStart =
      req.airStart ??
      (arena
        ? arena.gates[Math.floor(this.rng.next() * arena.gates.length)]
        : this.stage.airSpawns.length > 0
          ? this.stage.airSpawns[this.nextUid % this.stage.airSpawns.length]
          : this.stage.path[0]);
    const routeLen = pathLength(route);
    const distanceAlong = req.distanceAlong ?? 0;
    const airProgress = req.airProgress ?? 0;
    const pos = flying ? lerp(airStart, this.castlePos, airProgress) : pointAtDistance(route, distanceAlong);

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
      route,
      routeLen,
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
