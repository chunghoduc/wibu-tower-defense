/**
 * Friendly minion simulation — merged onto BattleState.prototype (god-class
 * split pattern). Minions are temporary summoned spirits: stationary, tower-like
 * targeting (highest-threat enemy in range), no pathing, fade at lifespan 0.
 *
 * Their basic attacks are single-target with NO crit/proc, so they never perturb
 * the shared RNG/loot stream (mirrors the determinism rule elsewhere in the sim).
 */
import type { BattleState } from "./battle.ts";
import type { SummonDef } from "../data/summons.ts";
import { minionStatsFrom } from "../data/summons.ts";
import { selectTarget } from "./targeting.ts";
import type { Vec2 } from "../data/schema.ts";

/** Hard cap on concurrent minions — bounds entity count regardless of spam. */
export const MINION_CAP = 12;

/** Minions see everything (incl. stealth/air) — they are the player's tools. */
const MINION_FILTER = { canHitGround: true, canHitAir: true, seeStealth: true };

export const minionMethods = {
  /** Spawn one minion of `def` at `pos`, scaling stats off the summoner. */
  summonMinion(
    this: BattleState,
    def: SummonDef,
    pos: Vec2,
    summonerAtk: number,
    summonerMaxHp: number,
    lifespan: number,
  ): void {
    // Respect the concurrency cap by retiring the oldest minion first.
    while (this.minions.length >= MINION_CAP) this.minions.shift();
    const stats = minionStatsFrom(def, summonerAtk, summonerMaxHp);
    this.minions.push({
      uid: this.nextUid++,
      def,
      stats,
      pos: { x: pos.x, y: pos.y },
      hp: stats.maxHp,
      attackCd: 1 / Math.max(0.1, def.attackSpeed),
      alive: true,
      lifespan,
      maxLifespan: lifespan,
    });
  },

  updateMinions(this: BattleState, dt: number): void {
    for (const m of this.minions) {
      if (!m.alive) continue;
      m.lifespan -= dt;
      if (m.lifespan <= 0) {
        m.alive = false;
        continue;
      }
      m.attackCd -= dt;
      if (m.attackCd > 0) continue;
      const target = selectTarget(m.pos, m.stats.range, this.enemies, MINION_FILTER);
      if (!target) continue;
      this.applyDamage(target, m.def.damageType, m.stats.atk, 0, 0, false, true);
      if (m.def.slow && target.alive) this.applySlow(target, m.def.slow.pct, m.def.slow.duration);
      m.attackCd = 1 / Math.max(0.1, m.def.attackSpeed);
    }
  },

  cleanupMinions(this: BattleState): void {
    for (let i = this.minions.length - 1; i >= 0; i--) {
      if (!this.minions[i].alive) this.minions.splice(i, 1);
    }
  },
};

export type MinionMethods = typeof minionMethods;

/** Spread N minion spawn positions in a ring around a cast center. */
export function summonRing(center: Vec2, n: number, radius = 46): Vec2[] {
  const out: Vec2[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    out.push({ x: center.x + Math.cos(a) * radius, y: center.y + Math.sin(a) * radius });
  }
  return out;
}
