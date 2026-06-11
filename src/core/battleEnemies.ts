/**
 * Enemy simulation for {@link BattleState}: status ticks, movement, support
 * auras, boss mechanics, and the damage enemies deal to the hero/towers.
 * Methods are merged onto the BattleState prototype in `battle.ts`.
 */
import { type BossSkill, type Stats } from "../data/schema.ts";
import { mitigatedDamage, mitigationBreakdown, clamp01, type DamagePacket } from "./damage.ts";
import { combatLogOn, emitDamageLog } from "./combatLog.ts";
import { slowedSpeed, type Dot } from "./effects.ts";
import { dist, lerp, pointAtDistance } from "./path.ts";
import { computeAuraMods, NEUTRAL_AURA } from "./enemyAuras.ts";
import { enemyTowerAttack } from "./enemyCombat.ts";
import { shouldFrenzy, frenzyMods } from "./enemyFrenzy.ts";
import { advanceAdaptivePhase, adaptiveImmuneType } from "./enemyAdaptive.ts";
import { castleLeakDamage } from "../data/enemies.ts";
import type { BattleState } from "./battle.ts";
import {
  type EnemyRuntime, type TowerRuntime,
  BOSS_MANA_REGEN, HERO_BLOCK_RANGE,
} from "./battleTypes.ts";

export const enemyMethods = {
  updateEnemies(this: BattleState, dt: number): void {
    for (const e of this.enemies) {
      if (!e.alive) continue;

      this.tickEnemyStatus(e, dt);
      if (!e.alive) continue;

      if (e.stats.hpRegen > 0) e.hp = Math.min(e.stats.maxHp, e.hp + e.stats.hpRegen * dt);
      if (e.def.special?.healAura) this.applyHealAura(e, dt);
      if (e.def.boss) this.updateBoss(e, dt);
      if (shouldFrenzy(e.def.special, e.hp / e.stats.maxHp, e.frenzied)) e.frenzied = true;
      if (e.def.special?.summon) {
        e.summonTimer -= dt;
        if (e.summonTimer <= 0) {
          this.queueSummon(e, e.def.special.summon.enemyId, e.def.special.summon.count);
          e.summonTimer = e.def.special.summon.interval;
        }
      }
      if (e.def.special?.towerDisablePulse) {
        const p = e.def.special.towerDisablePulse;
        e.disablePulseTimer -= dt;
        if (e.disablePulseTimer <= 0) {
          let hit = false;
          for (const t of this.towers) {
            if (t.alive && dist(e.pos, t.pos) <= p.radius) {
              t.disabledTimer = Math.max(t.disabledTimer, p.duration);
              hit = true;
            }
          }
          if (hit) this.emit({ type: "splash", at: { x: e.pos.x, y: e.pos.y }, radius: p.radius, damageType: "Magic" });
          e.disablePulseTimer = p.interval;
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
        // Bosses, flyers, and ordinary melee strike in passing without halting;
        // only dedicated tower-killers (Sapper/Raider) stop to demolish.
        if (!action.blocking) this.advanceEnemy(e, dt);
      } else {
        this.advanceEnemy(e, dt);
      }
      this.updateEnemyThreat(e);
    }
  },

  tickEnemyStatus(this: BattleState, e: EnemyRuntime, dt: number): void {
    if (e.slowTimer > 0) {
      e.slowTimer -= dt;
      if (e.slowTimer <= 0) e.slowPct = 0;
    }
    if (e.stunTimer > 0) e.stunTimer -= dt;

    if (e.def.special?.adaptiveImmunity) {
      const r = advanceAdaptivePhase(e.def.special, e.adaptPhaseTimer, e.adaptPhaseIndex, dt);
      e.adaptPhaseTimer = r.timer;
      e.adaptPhaseIndex = r.index;
      if (r.switched) {
        const imm = adaptiveImmuneType(e.def.special, e.adaptPhaseIndex) ?? "Physical";
        this.emit({ type: "splash", at: { x: e.pos.x, y: e.pos.y }, radius: 28, damageType: imm });
      }
    }

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
  },

  chooseEnemyAction(
    this: BattleState,
    e: EnemyRuntime,
  ): { kind: "hero" } | { kind: "tower"; tower: TowerRuntime; blocking: boolean } | { kind: "move" } {
    if (this.hero.alive && !e.flying && dist(e.pos, this.hero.pos) <= HERO_BLOCK_RANGE) {
      return { kind: "hero" };
    }
    const atk = enemyTowerAttack(e.def);
    if (atk) {
      let best: TowerRuntime | null = null;
      for (const t of this.towers) {
        if (t.alive && dist(e.pos, t.pos) <= atk.range) {
          if (!best || dist(e.pos, t.pos) < dist(e.pos, best.pos)) best = t;
        }
      }
      if (best) return { kind: "tower", tower: best, blocking: !atk.whileMoving };
    }
    return { kind: "move" };
  },

  enemyAttack(this: BattleState, e: EnemyRuntime, dt: number, hit: () => void): void {
    e.attackCd -= dt;
    if (e.attackCd <= 0 && e.stats.attackSpeed > 0) {
      hit();
      e.attackCd = 1 / e.stats.attackSpeed;
    }
  },

  /** Refresh every enemy's transient support-aura buffs and apply aura healing. */
  recomputeEnemyAuras(this: BattleState, dt: number): void {
    const results = computeAuraMods(this.enemies);
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const r = results.get(e.uid);
      if (r) {
        e.aura = r.mods;
        if (r.healPerSec > 0) e.hp = Math.min(e.stats.maxHp, e.hp + r.healPerSec * dt);
      } else if (e.aura !== NEUTRAL_AURA) {
        e.aura = NEUTRAL_AURA;
      }
    }
  },

  /** Enemy defence stats with current support-aura bonuses folded in (for mitigation). */
  effDefStats(this: BattleState, e: EnemyRuntime): Stats {
    const a = e.aura;
    if (a.armorAdd === 0 && a.magicResistAdd === 0 && a.drAdd === 0) return e.stats;
    return {
      ...e.stats,
      armor: e.stats.armor + a.armorAdd,
      magicResist: e.stats.magicResist + a.magicResistAdd,
      damageReduction: 1 - (1 - clamp01(e.stats.damageReduction)) * (1 - clamp01(a.drAdd)),
    };
  },

  applyHealAura(this: BattleState, healer: EnemyRuntime, dt: number): void {
    const aura = healer.def.special!.healAura!;
    for (const o of this.enemies) {
      if (!o.alive || o === healer) continue;
      if (dist(healer.pos, o.pos) <= aura.radius) o.hp = Math.min(o.stats.maxHp, o.hp + aura.hps * dt);
    }
  },

  updateBoss(this: BattleState, e: EnemyRuntime, dt: number): void {
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
  },

  /** Apply a boss's active skill and emit its cast FX. */
  castBossSkill(this: BattleState, e: EnemyRuntime, skill: BossSkill): void {
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
  },

  enemySpeed(this: BattleState, e: EnemyRuntime): number {
    const base = slowedSpeed(e.stats.moveSpeed, e.slowPct) * e.aura.moveMult;
    const enrage = e.enraged && e.def.boss?.enrage ? e.def.boss.enrage.speedMult : 1;
    return base * enrage * frenzyMods(e.def.special, e.frenzied).speedMult;
  },

  enemyAtk(this: BattleState, e: EnemyRuntime): number {
    const enrage = e.enraged && e.def.boss?.enrage ? e.def.boss.enrage.atkMult : 1;
    return e.stats.atk * enrage * frenzyMods(e.def.special, e.frenzied).atkMult;
  },

  advanceEnemy(this: BattleState, e: EnemyRuntime, dt: number): void {
    const step = this.enemySpeed(e) * dt;
    if (e.flying) {
      const lineLen = Math.max(1e-6, dist(e.airStart, this.castlePos));
      e.airProgress += step / lineLen;
      if (e.airProgress >= 1) return this.reachCastle(e);
      e.pos = lerp(e.airStart, this.castlePos, e.airProgress);
    } else {
      e.distanceAlong += step;
      if (e.distanceAlong >= e.routeLen) return this.reachCastle(e);
      e.pos = pointAtDistance(e.route, e.distanceAlong);
    }
  },

  updateEnemyThreat(this: BattleState, e: EnemyRuntime): void {
    e.threat = e.flying
      ? Math.min(1, e.airProgress)
      : Math.min(1, e.routeLen === 0 ? 1 : e.distanceAlong / e.routeLen);
  },

  reachCastle(this: BattleState, e: EnemyRuntime): void {
    this.castleHp -= castleLeakDamage(e.def);
    e.alive = false;
    // F14: a leak voids this wave's (and the stage's) flawless bonus.
    this.waveLeaked = true;
    this.anyLeak = true;
    // A leak also breaks the kill streak.
    this.combo = 0;
    this.comboTimer = 0;
  },

  dealDamageToHero(this: BattleState, attacker: EnemyRuntime): void {
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
  },

  /** Log an enemy's hit on the hero/a tower (these don't run through applyDamage). */
  logEnemyHit(this: BattleState, attacker: EnemyRuntime, targetLabel: string, packet: DamagePacket, defender: Stats, hpAfter: number): void {
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
  },

  dealDamageToTower(this: BattleState, attacker: EnemyRuntime, tower: TowerRuntime): void {
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
  },

  queueSummon(this: BattleState, parent: EnemyRuntime, enemyId: string, count: number): void {
    for (let i = 0; i < count; i++) {
      this.pending.push(
        parent.flying
          ? { enemyId, airProgress: parent.airProgress, airStart: parent.airStart }
          : { enemyId, distanceAlong: parent.distanceAlong, route: parent.route },
      );
    }
  },

  flushPending(this: BattleState): void {
    if (this.pending.length === 0) return;
    const reqs = this.pending;
    this.pending = [];
    for (const r of reqs) this.spawnEnemy(r);
  },
};

export type EnemyMethods = typeof enemyMethods;
