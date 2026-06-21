// src/core/battleTriggerFx.ts
//
// Sim-side interpreters for triggered Unique-item effects. Merged onto the
// BattleState prototype (see battle.ts). Every public fire* method is gated by
// this._triggerDepth so triggered damage can never re-proc a trigger — only the
// ORIGINAL basic attack / kill / hit / cast does. Chance < 1 rolls the shared
// RNG; chance >= 1 is guaranteed and skips the roll (keeps the loot/crit stream
// identical to a no-unique run for deterministic effects, like applyStun).
import { dist } from "./path.ts";
import type { DamageType, Stats, Vec2 } from "../data/schema.ts";
import type { TriggeredEffect } from "../data/triggeredEffects.ts";
import { procCoefficient } from "../data/procCoefficient.ts";
import type { BattleState } from "./battle.ts";
import { type EnemyRuntime, SPLASH_RADIUS } from "./battleTypes.ts";

const TYPE = (e: TriggeredEffect): DamageType => e.type ?? "Magic";
const isBoss = (e: EnemyRuntime): boolean => e.def.boss != null || e.def.archetype === "Boss";

export const triggerMethods = {
  _rollTrigger(this: BattleState, e: TriggeredEffect): boolean {
    return e.chance >= 1 ? true : this.rng.chance(e.chance);
  },

  /** On-hit/on-crit roll scaled by the attacker's proc coefficient (fast attackers
   *  proc proportionally less per hit). Guaranteed effects (chance>=1) ignore it. */
  _rollTriggerScaled(this: BattleState, e: TriggeredEffect, coeff: number): boolean {
    return e.chance >= 1 ? true : this.rng.chance(e.chance * coeff);
  },

  /** Run a handler body with the reentrancy guard raised. */
  _withTrigger(this: BattleState, body: () => void): void {
    this._triggerDepth++;
    try {
      body();
    } finally {
      this._triggerDepth--;
    }
  },

  fireOnHit(
    this: BattleState,
    unit: { stats: Stats },
    fromPos: Vec2,
    target: EnemyRuntime,
    dealt: number,
    didCrit: boolean,
  ): void {
    if (this._triggerDepth > 0) return;
    if (this.triggers.onHit.length === 0 && (!didCrit || this.triggers.onCrit.length === 0)) return;
    const coeff = procCoefficient(unit.stats.attackSpeed);
    this._withTrigger(() => {
      for (const e of this.triggers.onHit) {
        if (this._rollTriggerScaled(e, coeff))
          this.applyTriggerEffect(e, unit.stats, fromPos, target, dealt);
      }
      if (didCrit) {
        for (const e of this.triggers.onCrit) {
          if (this._rollTriggerScaled(e, coeff))
            this.applyTriggerEffect(e, unit.stats, fromPos, target, dealt);
        }
      }
    });
  },

  fireOnKill(this: BattleState, victim: EnemyRuntime): void {
    if (this._triggerDepth > 0 || this.triggers.onKill.length === 0) return;
    this._withTrigger(() => {
      for (const e of this.triggers.onKill) {
        if (this._rollTrigger(e)) this.applyKillEffect(e, victim);
      }
    });
  },

  fireOnHurt(this: BattleState, attacker: EnemyRuntime, incoming: number): void {
    if (this._triggerDepth > 0 || this.triggers.onHurt.length === 0 || !attacker.alive) return;
    this._withTrigger(() => {
      for (const e of this.triggers.onHurt) {
        if (!this._rollTrigger(e)) continue;
        if (e.kind === "reflect") {
          this.applyDamage(attacker, TYPE(e), incoming * (e.dmgFrac ?? 0.3), 0, 0, false, true);
        } else if (e.kind === "riposte") {
          const h = this.hero;
          if (h.alive)
            this.performAttack(
              h,
              h.pos,
              h.stats.atk,
              h.damageType,
              attacker,
              "hero",
              "hero",
              -1,
              "slash",
            );
        } else if (e.kind === "glaciate") {
          this.applyStun(attacker, e.seconds ?? 1, 1);
        } else if (e.kind === "painnova") {
          this.applyBurstInRadius(
            this.hero.pos,
            e.radius ?? 80,
            this.hero.stats.atk * (e.atkFrac ?? 0.6),
            TYPE(e),
            this.hero.stats,
          );
        }
      }
    });
  },

  fireOnCast(
    this: BattleState,
    attacker: Stats,
    center: Vec2,
    burst: number,
    type: DamageType,
  ): void {
    if (this._triggerDepth > 0 || this.triggers.onCast.length === 0) return;
    this._withTrigger(() => {
      for (const e of this.triggers.onCast) {
        if (!this._rollTrigger(e)) continue;
        if (e.kind === "echo") {
          this.applyBurstInRadius(center, SPLASH_RADIUS, burst, type, attacker);
        } else if (e.kind === "cinder") {
          this.forEnemiesInRadius(center, e.radius ?? 80, (en) =>
            this.addDot(en, TYPE(e), attacker.atk * (e.atkFrac ?? 0.3), e.seconds ?? 3, attacker),
          );
        } else if (e.kind === "castnova") {
          this.forEnemiesInRadius(center, e.radius ?? 80, (en) =>
            this.applyStun(en, e.seconds ?? 0.8, 1),
          );
        }
      }
    });
  },

  /** onHit / onCrit dispatch. The target is alive unless a prior effect killed it. */
  applyTriggerEffect(
    this: BattleState,
    e: TriggeredEffect,
    srcStats: Stats,
    _fromPos: Vec2,
    target: EnemyRuntime,
    dealt: number,
  ): void {
    if (!target.alive && e.kind !== "heal") return;
    switch (e.kind) {
      case "execute":
        if (
          !isBoss(target) &&
          (e.hpFrac === undefined || target.hp <= target.stats.maxHp * e.hpFrac)
        ) {
          this.killEnemy(target);
        }
        break;
      case "blast":
        this.applySplash(
          srcStats,
          TYPE(e),
          srcStats.atk * (e.atkFrac ?? 0.5),
          target.pos,
          target,
          e.radius ?? 70,
        );
        break;
      case "chain":
        this.triggerChain(
          srcStats,
          TYPE(e),
          srcStats.atk * (e.atkFrac ?? 1),
          target,
          e.targets ?? 3,
          e.falloff ?? 0.6,
        );
        break;
      case "freeze":
        this.applyStun(target, e.seconds ?? 0.6, 1);
        break;
      case "slow":
        this.applySlow(target, e.slowPct ?? 0.6, e.seconds ?? 1.5);
        break;
      case "poison":
        this.addDot(target, TYPE(e), srcStats.atk * (e.atkFrac ?? 0.4), e.seconds ?? 3, srcStats);
        break;
      case "bleed":
        this.addDot(target, TYPE(e), srcStats.atk * (e.atkFrac ?? 0.5), e.seconds ?? 4, srcStats);
        break;
      case "heal":
        if (dealt > 0) this.healHero(dealt * (e.dmgFrac ?? 0.5));
        break;
      default:
        break;
    }
  },

  /** onKill dispatch — uses only the victim + hero (no killer needed). */
  applyKillEffect(this: BattleState, e: TriggeredEffect, victim: EnemyRuntime): void {
    switch (e.kind) {
      case "blast":
        this.applySplash(
          this.hero.stats,
          TYPE(e),
          victim.stats.maxHp * (e.hpFrac ?? 0.25),
          victim.pos,
          victim,
          e.radius ?? 80,
        );
        break;
      case "heal":
        this.healHero(this.hero.stats.maxHp * (e.hpFrac ?? 0.04));
        break;
      case "overkill":
        // After death victim.hp is negative; the magnitude is the overkill done.
        this.healHero(Math.max(0, -victim.hp) * (e.dmgFrac ?? 0.3));
        break;
      case "frostnova":
        this.forEnemiesInRadius(victim.pos, e.radius ?? 90, (en) => {
          if (en !== victim) this.applyStun(en, e.seconds ?? 0.8, 1);
        });
        break;
      case "pyre":
        this.forEnemiesInRadius(victim.pos, e.radius ?? 90, (en) => {
          if (en !== victim)
            this.addDot(
              en,
              TYPE(e),
              this.hero.stats.atk * (e.atkFrac ?? 0.3),
              e.seconds ?? 3,
              this.hero.stats,
            );
        });
        break;
      case "gold": {
        const bonus = Math.max(1, Math.round(victim.def.bounty * 0.5));
        this.gold += bonus;
        this.waveGold += bonus;
        this.emit({
          type: "loot",
          at: { x: victim.pos.x, y: victim.pos.y },
          to: { x: this.hero.pos.x, y: this.hero.pos.y },
          gold: bonus,
        });
        break;
      }
      case "contagion":
        if (victim.dots.length) {
          this.forEnemiesInRadius(victim.pos, e.radius ?? 90, (en) => {
            if (en !== victim) for (const d of victim.dots) en.dots.push({ ...d });
          });
        }
        break;
      default:
        break;
    }
  },

  // — small shared primitives —
  healHero(this: BattleState, amount: number): void {
    const h = this.hero;
    if (h.alive) h.hp = Math.min(h.stats.maxHp, h.hp + amount);
  },

  forEnemiesInRadius(
    this: BattleState,
    center: Vec2,
    radius: number,
    fn: (e: EnemyRuntime) => void,
  ): void {
    for (const en of this.enemies) if (en.alive && dist(en.pos, center) <= radius) fn(en);
  },

  applyBurstInRadius(
    this: BattleState,
    center: Vec2,
    radius: number,
    amount: number,
    type: DamageType,
    src: Stats,
  ): void {
    this.forEnemiesInRadius(center, radius, (en) =>
      this.applyDamage(en, type, amount, src.armorPen, src.magicPen, true, true),
    );
  },

  triggerChain(
    this: BattleState,
    src: Stats,
    type: DamageType,
    dmg0: number,
    primary: EnemyRuntime,
    bounces: number,
    falloff: number,
  ): void {
    let from = primary;
    let dmg = dmg0 * falloff;
    const hit = new Set<number>([primary.uid]);
    for (let i = 0; i < bounces; i++) {
      let next: EnemyRuntime | null = null;
      for (const en of this.enemies) {
        if (!en.alive || hit.has(en.uid)) continue;
        if (
          dist(from.pos, en.pos) <= SPLASH_RADIUS * 1.5 &&
          (!next || dist(from.pos, en.pos) < dist(from.pos, next.pos))
        )
          next = en;
      }
      if (!next) break;
      this.emit({
        type: "chain",
        from: { x: from.pos.x, y: from.pos.y },
        to: { x: next.pos.x, y: next.pos.y },
      });
      this.applyDamage(next, type, dmg, src.armorPen, src.magicPen, false, true);
      hit.add(next.uid);
      from = next;
      dmg *= falloff;
    }
  },
};

export type TriggerMethods = typeof triggerMethods;
