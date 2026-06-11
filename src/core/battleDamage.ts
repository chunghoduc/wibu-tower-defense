/**
 * Damage application for {@link BattleState}: single-target attacks, mitigation,
 * AoE (cleave/splash), chain bounce, DoT/slow/stun, active-skill bursts, and the
 * kill pipeline (bounty + combo + loot). Methods are merged onto the BattleState
 * prototype in `battle.ts`.
 */
import { DIFFICULTY_SCALING, type DamageType, type Stats, type Vec2 } from "../data/schema.ts";
import { mitigatedDamage, mitigationBreakdown, critMultiplier, type DamagePacket } from "./damage.ts";
import { combatLogOn, emitDamageLog } from "./combatLog.ts";
import { absorbWithShield, ccDuration } from "./effects.ts";
import { dist } from "./path.ts";
import { ELITE_BOUNTY_MULT } from "./elite.ts";
import { recordKill, bestiaryDamageMul } from "./bestiary.ts";
import { processEnemyKill } from "./killRewards.ts";
import { itemLevelForStage, chapterLevelRange } from "./itemDrop.ts";
import { incrementQuestKey } from "./questTracker.ts";
import { incrementBountyEvent } from "./bounties.ts";
import { isoWeekKey } from "./meta.ts";
import { addMasteryXp, MASTERY_XP_PER_KILL } from "./mastery.ts";
import { adaptiveImmuneType } from "./enemyAdaptive.ts";
import type { BattleState } from "./battle.ts";
import {
  type DmgCtx, type EnemyRuntime, type FxEvent, type TowerRuntime,
  COMBO_DECAY, SPLASH_RADIUS, MANA_MAX, manaGainOnHit,
} from "./battleTypes.ts";

export const damageMethods = {
  /** Append a transient visual event (bounded so a stalled renderer can't grow it). */
  emit(this: BattleState, e: FxEvent): void {
    if (this.fx.length < 256) this.fx.push(e);
  },

  /** One single-target attack with crit + mana credit + omnivamp. */
  performAttack(
    this: BattleState,
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

    // Mana charges on every hit (support towers are aura-only and never cast).
    if (role !== "support") {
      unit.mana = Math.min(MANA_MAX, unit.mana + manaGainOnHit(unit.stats));
      if (wasAlive && !target.alive) {
        unit.mana = Math.min(MANA_MAX, unit.mana + unit.stats.manaOnKill);
      }
    }
    if (unit.stats.omnivamp > 0 && dealt > 0) {
      unit.hp = Math.min(unit.stats.maxHp, unit.hp + dealt * unit.stats.omnivamp);
    }
  },

  /**
   * Apply raw damage of a type to an enemy: honour the single-immunity rule,
   * mitigate by armor/resist, absorb with shield, reduce HP, resolve death.
   * Returns the total damage applied (for omnivamp).
   */
  applyDamage(
    this: BattleState,
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
    // F9 bestiary: permanent +% damage vs an archetype the player has mastered.
    if (this._heroSave) rawAmount *= bestiaryDamageMul(this._heroSave, target.def.archetype);
    const defStats = this.effDefStats(target);
    const packet: DamagePacket = { amount: rawAmount, type: damageType, armorPen, magicPen };
    const incoming = mitigatedDamage(packet, defStats);
    if (incoming <= 0) return 0;

    if (emitHit) {
      this.emit({ type: "hit", uid: target.uid, at: { x: target.pos.x, y: target.pos.y }, damageType, amount: incoming, aoe: isAoE });
    }
    const { shield, overflow } = absorbWithShield(target.shield, incoming);
    target.shield = shield;
    target.hp -= overflow;

    if (dbg && combatLogOn()) {
      const b = mitigationBreakdown(packet, defStats);
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
  },

  /** Build a damage-log context only when logging is on (cheap no-op otherwise). */
  dmgCtx(this: BattleState, src: string, kind: string, rawFormula: string, crit?: DmgCtx["crit"]): DmgCtx | undefined {
    return combatLogOn() ? { src, kind, rawFormula, crit } : undefined;
  },

  isImmune(this: BattleState, target: EnemyRuntime, damageType: DamageType, isAoE: boolean): boolean {
    const imm = target.def.immunity;
    if (imm !== null) {
      if (isAoE && imm === "AoE") return true;
      if (imm === "Physical" && damageType === "Physical") return true;
      if (imm === "Magic" && damageType === "Magic") return true;
    }
    // Elite-granted immunity (only ever Physical or Magic; never set when the
    // base already has an immunity).
    const ei = target.eliteImmunity;
    if (ei === "Physical" && damageType === "Physical") return true;
    if (ei === "Magic" && damageType === "Magic") return true;
    // Adapter: immune to whichever type its current phase has rotated to.
    if (adaptiveImmuneType(target.def.special, target.adaptPhaseIndex) === damageType) return true;
    return false;
  },

  /**
   * Melee cleave: a melee tower's basic swing strikes every OTHER enemy within
   * its reach (centered on the tower) for the SAME full damage as the primary
   * hit. AoE-flagged, so it honours AoE immunity and armor/resist mitigation —
   * the short-range tradeoff for clearing whole clusters at once.
   */
  applyCleave(
    this: BattleState,
    attacker: Stats,
    damageType: DamageType,
    effAtk: number,
    center: Vec2,
    primary: EnemyRuntime,
  ): void {
    const radius = attacker.range;
    if (radius <= 0) return;
    const ctx = this.dmgCtx("cleave", "cleave", `cleave atk ${effAtk.toFixed(1)}`);
    for (const e of this.enemies) {
      if (!e.alive || e === primary) continue;
      if (dist(e.pos, center) <= radius) {
        this.applyDamage(e, damageType, effAtk, attacker.armorPen, attacker.magicPen, true, true, ctx);
      }
    }
  },

  applySplash(
    this: BattleState,
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
  },

  applyChain(
    this: BattleState,
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
  },

  addDot(
    this: BattleState,
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
  },

  applySlow(this: BattleState, target: EnemyRuntime, pct: number, duration: number): void {
    if (target.def.immunity === "CC") return;
    target.slowPct = Math.max(target.slowPct, pct);
    target.slowTimer = Math.max(target.slowTimer, ccDuration(duration, target.stats.tenacity));
  },

  applyStun(this: BattleState, target: EnemyRuntime, duration: number, chance: number): void {
    if (target.def.immunity === "CC") return;
    if (!this.rng.chance(chance)) return;
    target.stunTimer = Math.max(target.stunTimer, ccDuration(duration, target.stats.tenacity));
  },

  castActive(
    this: BattleState,
    attacker: Stats,
    effAtk: number,
    damageType: DamageType,
    center: Vec2,
    source: "tower" | "hero",
    uid: number,
    skillId?: string,
    defenseScale?: { armor?: number; magicResist?: number; maxHp?: number },
    powerMult = 2,
  ): void {
    this.emit({ type: "cast", uid, at: { x: center.x, y: center.y }, damageType, radius: SPLASH_RADIUS, source, skillId });
    const sp = Math.max(1, attacker.skillPower);
    let burst = effAtk * powerMult * sp;
    let detail = `atk ${effAtk.toFixed(1)} ×${powerMult.toFixed(2)} ×skillPower ${sp.toFixed(2)}`;
    if (defenseScale) {
      // tanker payoff: fold the caster's own defenses into the burst.
      const defBonus = attacker.armor * (defenseScale.armor ?? 0)
        + attacker.magicResist * (defenseScale.magicResist ?? 0)
        + attacker.maxHp * (defenseScale.maxHp ?? 0);
      burst += defBonus;
      detail += ` + defense ${defBonus.toFixed(1)}`;
    }
    const ctx = this.dmgCtx(`${source}:${uid}`, "active", detail);
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (dist(e.pos, center) <= SPLASH_RADIUS) {
        this.applyDamage(e, damageType, burst, attacker.armorPen, attacker.magicPen, true, true, ctx);
      }
    }
  },

  killEnemy(this: BattleState, e: EnemyRuntime): void {
    if (!e.alive) return;
    e.alive = false;
    const scale = DIFFICULTY_SCALING[this.difficulty];
    const eliteBonus = e.elite ? ELITE_BOUNTY_MULT : 1;
    const baseReward = e.def.bounty * scale.bountyMult * eliteBonus * (1 + this.hero.stats.goldFind);
    // F13 combo: a rapid kill-streak multiplies gold (×1 → ×3) and resets its decay.
    this.combo += 1;
    this.comboTimer = COMBO_DECAY;
    const reward = Math.round(baseReward * this.comboMult());
    this.gold += reward;
    this.waveGold += reward;
    const boss = e.def.archetype === "Boss";
    this.emit({ type: "death", at: { x: e.pos.x, y: e.pos.y }, boss, elite: e.elite, bounty: e.def.bounty });
    this.emit({ type: "loot", at: { x: e.pos.x, y: e.pos.y }, to: { x: this.hero.pos.x, y: this.hero.pos.y }, gold: reward });
    if (this.combo >= 3) this.emit({ type: "combo", at: { x: e.pos.x, y: e.pos.y - 22 }, count: this.combo, mult: this.comboMult() });
    // Per-kill XP + loot persist immediately (kept even if the stage is abandoned).
    if (this._heroSave) {
      const kr = processEnemyKill(this._heroSave, e.def, this.difficulty, itemLevelForStage(this.stage.id), this.rng, e.elite, chapterLevelRange(this.stage.id));
      // Tally it so the post-battle screen can show everything looted this run.
      this.battleLoot.xp += kr.xp;
      if (kr.itemDropped) this.battleLoot.items.push(kr.itemDropped);
      if (kr.boxDropped) this.battleLoot.boxes[kr.boxDropped] = (this.battleLoot.boxes[kr.boxDropped] ?? 0) + 1;
      this.emit({ type: "killReward", at: { x: e.pos.x, y: e.pos.y - 14 }, to: { x: this.hero.pos.x, y: this.hero.pos.y }, xp: kr.xp, item: kr.itemDropped !== null, itemDefId: kr.itemDropped?.defId ?? null, box: kr.boxDropped });
      const today = new Date().toISOString().slice(0, 10);
      incrementQuestKey(this._heroSave, boss ? "kill_bosses" : "kill_enemies", 1, today);
      incrementBountyEvent(this._heroSave, "kill", 1, isoWeekKey(new Date()));
      recordKill(this._heroSave, e.def.archetype); // F9 bestiary + F16 lifetime kills
      // F6: every tower fielded this battle earns mastery XP from the kill.
      for (const id of this.deployedTowerIds) addMasteryXp(this._heroSave, id, MASTERY_XP_PER_KILL);
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
  },
};

export type DamageMethods = typeof damageMethods;
