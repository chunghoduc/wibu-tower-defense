/**
 * Player input & tower placement for {@link BattleState}: hero movement
 * commands, placement validation (slots and free positions), tower spawning
 * with the full stat pipeline, battle-level upgrades, and selling. Methods are
 * merged onto the BattleState prototype in `battle.ts`.
 */
import type { CharacterDef, Vec2 } from "../data/schema.ts";
import { dist, groundLanes } from "./path.ts";
import { addHeroShare, towerStatPipeline } from "./stats.ts";
import { effectiveBehavior, battleLevelAtkMul } from "./towerUpgrade.ts";
import { WORLD_WIDTH, WORLD_HEIGHT } from "../data/stage.ts";
import { isTowerOwned, getTowerStars } from "./collection.ts";
import { incrementQuestKey } from "./questTracker.ts";
import { getMasteryLevel, masteryStatMul } from "./mastery.ts";
import { getAwakening, awakeningStatMul } from "./awakening.ts";
import type { BattleState } from "./battle.ts";
import {
  segDist,
  LANE_CLEARANCE,
  MIN_TOWER_DIST,
  PLACE_MARGIN,
  MAX_TOWER_UPGRADES,
  TOWER_SELL_REFUND,
} from "./battleTypes.ts";

export const placementMethods = {
  commandHero(this: BattleState, target: Vec2): void {
    this.hero.moveTarget = { ...target };
  },

  /** Effective placement cost for a character (F5 challenge discount applies). */
  towerCost(this: BattleState, def: CharacterDef): number {
    return Math.max(0, Math.round(def.cost * (this.challenge.towerCostMul ?? 1)));
  },

  placeTower(this: BattleState, characterId: string, slotIndex: number): boolean {
    if (this.outcome !== "ongoing") return false;
    const def = this.cat.characters.get(characterId);
    if (!def) return false;
    if (slotIndex < 0 || slotIndex >= this.stage.towerSlots.length) return false;
    if (this.towers.some((t) => t.slotIndex === slotIndex && t.alive)) return false;
    if (this.gold < this.towerCost(def)) return false;
    // With heroSave: only allow placement of owned towers
    if (this._heroSave && !isTowerOwned(this._heroSave, characterId)) return false;

    this.spawnTower(characterId, def, { ...this.stage.towerSlots[slotIndex] }, slotIndex);
    return true;
  },

  /** Whether a free-placement position is buildable (bounds, lane, obstacles, spacing). */
  canPlaceAt(this: BattleState, pos: Vec2): boolean {
    if (
      pos.x < PLACE_MARGIN ||
      pos.y < PLACE_MARGIN ||
      pos.x > WORLD_WIDTH - PLACE_MARGIN ||
      pos.y > WORLD_HEIGHT - PLACE_MARGIN
    )
      return false;
    // Block placement on ANY road: every authored lane / arena corridor (or the
    // single legacy path). One source of truth shared with routing + rendering.
    const roads = groundLanes(this.stage);
    for (const road of roads) {
      for (let i = 1; i < road.length; i++) {
        if (segDist(pos, road[i - 1], road[i]) < LANE_CLEARANCE) return false;
      }
    }
    for (const f of this.stage.terrain ?? []) {
      if (f.blocks && dist(pos, f) < f.r) return false;
    }
    for (const t of this.towers) {
      if (t.alive && dist(pos, t.pos) < MIN_TOWER_DIST) return false;
    }
    return true;
  },

  /** Place a tower at a free position (T14). Validates ownership, gold, and the spot. */
  placeTowerAt(this: BattleState, characterId: string, pos: Vec2): boolean {
    if (this.outcome !== "ongoing") return false;
    const def = this.cat.characters.get(characterId);
    if (!def) return false;
    if (this.gold < this.towerCost(def)) return false;
    if (this._heroSave && !isTowerOwned(this._heroSave, characterId)) return false;
    if (!this.canPlaceAt(pos)) return false;
    this.spawnTower(characterId, def, { x: pos.x, y: pos.y }, -1);
    return true;
  },

  /** @internal Spawn a validated tower: pay, resolve stats, push the runtime. */
  spawnTower(
    this: BattleState,
    characterId: string,
    def: CharacterDef,
    pos: Vec2,
    slotIndex: number,
  ): void {
    const cost = this.towerCost(def);
    this.gold -= cost;
    const towerLevel = this._heroSave?.hero.level ?? 1;
    const towerStars = this._heroSave ? getTowerStars(this._heroSave, characterId) : 1;
    // The hero commands their towers: 60% of the hero's resolved stats flow onto
    // each one, so leveling/gearing the hero strengthens the whole squad.
    const resolvedStats = addHeroShare(
      towerStatPipeline(def.baseStats, towerLevel, towerStars, def.role, 0, def.rarity),
      this.hero.stats,
    );
    // F6 mastery × F7 awakening (per-tower permanent growth) × F8 squad synergy.
    const mMul = this._heroSave
      ? masteryStatMul(getMasteryLevel(this._heroSave, characterId)) *
        awakeningStatMul(getAwakening(this._heroSave, characterId))
      : 1;
    resolvedStats.atk *= mMul * this.synergyMul.atkMul;
    resolvedStats.maxHp *= mMul * this.synergyMul.hpMul;
    resolvedStats.attackSpeed *= this.synergyMul.attackSpeedMul;
    if (this._heroSave) this.deployedTowerIds.add(characterId);
    this.towers.push({
      uid: this.nextUid++,
      def,
      stats: resolvedStats,
      slotIndex,
      pos,
      hp: resolvedStats.maxHp,
      mana: 0,
      attackCd: 0,
      alive: true,
      buffAtkPct: 0,
      buffAsPct: 0,
      disabledTimer: 0,
      behavior: effectiveBehavior(def, 0),
      baseLevel: towerLevel,
      stars: towerStars,
      battleLevel: 0,
      goldSpent: cost,
    });
    if (this._heroSave) {
      this._heroSave.progress.totalTowersPlaced += 1;
      incrementQuestKey(this._heroSave, "place_towers", 1, new Date().toISOString().slice(0, 10));
    }
  },

  /** Gold cost to upgrade a tower one battle level (escalates), or 0 if maxed/missing. */
  upgradeCost(this: BattleState, uid: number): number {
    const t = this.towers.find((x) => x.uid === uid && x.alive);
    if (!t || t.battleLevel >= MAX_TOWER_UPGRADES) return 0;
    // A star-up is a premium: it always costs MORE than buying a fresh tower of
    // this type (≥1.25× its placement cost), and escalates with each star. You
    // pay extra to concentrate ~+60% power onto one defended slot instead of
    // spreading it across a new unit that needs its own spot and protection.
    return Math.round(this.towerCost(t.def) * 1.25 * (t.battleLevel + 1));
  },

  /**
   * The attack range this tower WOULD have after one more upgrade — used to
   * preview coverage on the upgrade button. Non-mutating; returns null if the
   * tower is missing or already maxed. Mirrors upgradeTower's stat resolution
   * (towerStatPipeline at battleLevel+1, plus the hero share).
   */
  previewUpgradeRange(this: BattleState, uid: number): number | null {
    const t = this.towers.find((x) => x.uid === uid && x.alive);
    if (!t || t.battleLevel >= MAX_TOWER_UPGRADES) return null;
    const upgraded = addHeroShare(
      towerStatPipeline(
        t.def.baseStats,
        t.baseLevel,
        t.stars,
        t.def.role,
        t.battleLevel + 1,
        t.def.rarity,
      ),
      this.hero.stats,
    );
    return upgraded.range;
  },

  /**
   * The attack range a tower of `characterId` WOULD have the instant it's placed
   * (★1 / battleLevel 0), used to draw an accurate placement coverage ring. Mirrors
   * spawnTower's range resolution: base reach scaled by the unit's collection-star
   * tier. The hero share no longer touches range (towers are static), so this is the
   * true reach — drawing def.baseStats.range alone under-reports starred towers.
   */
  previewPlaceRange(this: BattleState, characterId: string): number {
    const def = this.cat.characters.get(characterId);
    if (!def) return 0;
    const towerLevel = this._heroSave?.hero.level ?? 1;
    const towerStars = this._heroSave ? getTowerStars(this._heroSave, characterId) : 1;
    return towerStatPipeline(def.baseStats, towerLevel, towerStars, def.role, 0, def.rarity).range;
  },

  /** Gold refunded when selling a tower (fraction of total invested). */
  sellValue(this: BattleState, uid: number): number {
    const t = this.towers.find((x) => x.uid === uid && x.alive);
    return t ? Math.round(t.goldSpent * TOWER_SELL_REFUND) : 0;
  },

  /** Upgrade a placed tower one battle level; recompute stats, keep HP/mana fractions. */
  upgradeTower(this: BattleState, uid: number): boolean {
    if (this.outcome !== "ongoing") return false;
    const t = this.towers.find((x) => x.uid === uid && x.alive);
    if (!t || t.battleLevel >= MAX_TOWER_UPGRADES) return false;
    const cost = this.upgradeCost(uid);
    if (this.gold < cost) return false;

    this.gold -= cost;
    t.goldSpent += cost;
    t.battleLevel += 1;
    const hpFrac = t.stats.maxHp > 0 ? t.hp / t.stats.maxHp : 1;
    t.stats = addHeroShare(
      towerStatPipeline(
        t.def.baseStats,
        t.baseLevel,
        t.stars,
        t.def.role,
        t.battleLevel,
        t.def.rarity,
      ),
      this.hero.stats,
    );
    // Re-apply F6 mastery + F7 awakening + F8 synergy so upgrading never drops it.
    const mMul = this._heroSave
      ? masteryStatMul(getMasteryLevel(this._heroSave, t.def.id)) *
        awakeningStatMul(getAwakening(this._heroSave, t.def.id))
      : 1;
    t.stats.atk *= mMul * this.synergyMul.atkMul;
    t.stats.maxHp *= mMul * this.synergyMul.hpMul;
    t.stats.attackSpeed *= this.synergyMul.attackSpeedMul;
    // The headline of a star-up: ~+60% attack per star, applied to the final
    // resolved atk so the hero share can't dilute it (see battleLevelAtkMul).
    t.stats.atk *= battleLevelAtkMul(t.battleLevel);
    t.behavior = effectiveBehavior(t.def, t.battleLevel);
    t.hp = t.stats.maxHp * hpFrac;
    // mana is a fixed 0..100 bar now — it carries over untouched across upgrades.
    if (this._heroSave) {
      incrementQuestKey(this._heroSave, "upgrade_towers", 1, new Date().toISOString().slice(0, 10));
    }
    return true;
  },

  /** Sell a placed tower, refund gold, remove it. Returns the refund (0 if missing). */
  sellTower(this: BattleState, uid: number): number {
    const i = this.towers.findIndex((x) => x.uid === uid && x.alive);
    if (i < 0) return 0;
    const refund = this.sellValue(uid);
    this.gold += refund;
    this.towers.splice(i, 1);
    return refund;
  },
};

export type PlacementMethods = typeof placementMethods;
