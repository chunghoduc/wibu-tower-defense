/**
 * Hero simulation for {@link BattleState}: pet gold trickle, HP regen,
 * movement toward the tap target, auto-attack, and the full-mana active cast
 * (including live skill use-XP). Methods are merged onto the BattleState
 * prototype in `battle.ts`.
 */
import { dist, lerp } from "./path.ts";
import { selectTarget } from "./targeting.ts";
import { heroAttackStyle } from "../data/attackStyle.ts";
import { heroActiveBurst, awardSkillUseXp } from "./hero.ts";
import type { BattleState } from "./battle.ts";
import { HERO_FILTER, MANA_MAX } from "./battleTypes.ts";

export const heroMethods = {
  updateHero(this: BattleState, dt: number): void {
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

    this.performAttack(
      h,
      h.pos,
      h.stats.atk,
      h.damageType,
      target,
      "hero",
      "hero",
      -1,
      heroAttackStyle(h.weaponType, h.damageType, h.stats.range),
    );
    if (h.mana >= MANA_MAX) {
      // The equipped active drives both the burst size (its levelled power) and
      // the damage type — a True/Magic skill casts True/Magic even on a Physical
      // weapon. Falls back to the legacy ×2 / weapon type when nothing is equipped.
      this.castActive(
        h.stats,
        h.stats.atk,
        h.activeDamageType ?? h.damageType,
        target.pos,
        h.pos,
        "hero",
        -1,
        h.equippedSkillId,
        undefined,
        h.activeMult ?? 2,
      );
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
  },
};

export type HeroMethods = typeof heroMethods;
