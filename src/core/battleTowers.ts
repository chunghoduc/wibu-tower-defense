/**
 * Tower simulation for {@link BattleState}: support-aura buffs, stealth reveal,
 * per-tower attack/skill cadence, and role-specific on-hit effects. Methods are
 * merged onto the BattleState prototype in `battle.ts`.
 */
import { dist } from "./path.ts";
import { selectTarget } from "./targeting.ts";
import { attackStyleFor, isMeleeStyle } from "../data/attackStyle.ts";
import type { BattleState } from "./battle.ts";
import {
  type EnemyRuntime,
  type TowerRuntime,
  targetFilter,
  SPLASH_RADIUS,
  MANA_MAX,
} from "./battleTypes.ts";

export const towerMethods = {
  recomputeTowerBuffs(this: BattleState): void {
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
    // Hexer support enemies slow nearby towers (a negative attack-speed buff).
    for (const s of this.enemies) {
      const a = s.def.special?.supportAura;
      if (!s.alive || !a?.towerAttackSpeedMult) continue;
      for (const t of this.towers) {
        if (t.alive && dist(s.pos, t.pos) <= a.radius) t.buffAsPct += a.towerAttackSpeedMult - 1;
      }
    }
  },

  /** A stealthed enemy is revealed while inside the hero's range; towers may then
   *  target it (if it is also in the tower's range). The hero always sees them. */
  updateStealthReveal(this: BattleState): void {
    const h = this.hero;
    const r2 = h.stats.range * h.stats.range;
    for (const e of this.enemies) {
      if (!e.stealth) {
        e.revealed = true;
        continue;
      }
      e.revealed = h.alive && (e.pos.x - h.pos.x) ** 2 + (e.pos.y - h.pos.y) ** 2 <= r2;
    }
  },

  updateTowers(this: BattleState, dt: number): void {
    for (const t of this.towers) {
      if (!t.alive) continue;
      if (t.disabledTimer > 0) {
        t.disabledTimer -= dt;
        continue;
      }

      const effAs = t.stats.attackSpeed * (1 + t.buffAsPct);
      t.attackCd -= dt;
      if (t.attackCd > 0 || effAs <= 0) continue;

      const target = selectTarget(t.pos, t.stats.range, this.enemies, targetFilter(t.def.target));
      if (!target) continue;

      const effAtk = t.stats.atk * (1 + t.buffAtkPct);
      const style = attackStyleFor(t.def);
      this.performAttack(
        t,
        t.pos,
        effAtk,
        t.def.damageType,
        target,
        "tower",
        t.def.role,
        t.uid,
        style,
      );
      this.applyRoleEffect(t, effAtk, target);
      // Melee swings cleave: every strike also hits all other enemies within the
      // tower's (short) reach for the same damage — short range, wide arc.
      if (isMeleeStyle(style)) this.applyCleave(t.stats, t.def.damageType, effAtk, t.pos, target);

      // Support towers are aura-only and never cast; everyone else casts at a full bar.
      if (t.def.role !== "support" && t.mana >= MANA_MAX) {
        // Skills may deal True damage (the only path to True).
        const activeType = t.behavior?.activeType ?? t.def.damageType;
        this.castActive(
          t.stats,
          effAtk,
          activeType,
          target.pos,
          t.pos,
          "tower",
          t.uid,
          t.def.active ?? undefined,
          t.behavior?.defenseScale,
        );
        t.mana = 0;
      }
      t.attackCd = 1 / effAs;
    }
  },

  /** Apply a tower's role-specific on-hit effect (splash/chain/dot/debuff). */
  applyRoleEffect(this: BattleState, t: TowerRuntime, effAtk: number, target: EnemyRuntime): void {
    const bhv = t.behavior;
    switch (t.def.role) {
      case "splash":
        this.applySplash(
          t.stats,
          t.def.damageType,
          effAtk,
          target.pos,
          target,
          bhv?.splashRadius ?? SPLASH_RADIUS,
        );
        break;
      case "chain":
        this.applyChain(t, effAtk, target, bhv?.chainTargets ?? 2, bhv?.chainFalloff ?? 0.6);
        break;
      case "dot":
        if (bhv?.dot) {
          this.addDot(
            target,
            bhv.dot.damageType ?? t.def.damageType,
            bhv.dot.dps,
            bhv.dot.duration,
            t.stats,
          );
        }
        break;
      case "debuff":
        if (bhv?.slow) this.applySlow(target, bhv.slow.pct, bhv.slow.duration);
        if (bhv?.stun) this.applyStun(target, bhv.stun.duration, bhv.stun.chance);
        break;
      default:
        break;
    }
  },
};

export type TowerMethods = typeof towerMethods;
