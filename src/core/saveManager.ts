import { checkAndGrantAchievements } from "./achievements.ts";
import { processStageClear, type DropResult } from "./drops.ts";
import { performMultiSummon, performSummon, type SummonResult } from "./gacha.ts";
import { awardHeroXp } from "./hero.ts";
import { equipItem, equipSkill, unequipSkill, unequipSlot } from "./loadout.ts";
import { purchaseShopItem, type PurchaseResult } from "./shop.ts";
import type { ItemSlot } from "../data/schema.ts";
import { Rng } from "./rng.ts";
import type { Difficulty } from "../data/schema.ts";
import { createFreshSave, type HeroSave, type SaveProvider } from "./save.ts";
import { SINGLE_PULL_COST } from "./gacha.ts";
import { addTowerToCollection } from "./collection.ts";

const DAILY_LOGIN_CRYSTALS = 10;
const STARTER_CRYSTALS = SINGLE_PULL_COST * 50; // enough for at least 50 summons

/** A common-rarity character per role, granted to new players so they can play immediately. */
const STARTER_SQUAD = [
  "yamo-desert-bandit",   // damage
  "pip-powderkeg",        // splash
  "tobi-skipstone",       // chain
  "bram-thornling",       // dot
  "doro-mire-spirit",     // debuff
  "mochi-morale-sprite",  // support
];

const XP_BY_DIFFICULTY: Record<Difficulty, number> = {
  Normal: 50,
  Hard: 80,
  Nightmare: 120,
};

export class SaveManager {
  private save: HeroSave;

  constructor(private readonly provider: SaveProvider) {
    const loaded = provider.load();
    this.save = loaded ?? createFreshSave();
    // New players get starter crystals AND a starter squad so they can place
    // towers and play immediately (placement is ownership-gated).
    if (!loaded) {
      this.save.currency.crystals = STARTER_CRYSTALS;
      for (const id of STARTER_SQUAD) addTowerToCollection(this.save, id);
    }
    this.persist();
  }

  getSave(): HeroSave {
    return this.save;
  }

  afterBattle(
    stageId: string,
    outcome: "won" | "lost",
    difficulty: Difficulty,
    rng: Rng,
  ): DropResult | null {
    if (outcome !== "won") return null;
    const result = processStageClear(this.save, stageId, difficulty, rng);
    awardHeroXp(this.save, XP_BY_DIFFICULTY[difficulty]);
    checkAndGrantAchievements(this.save);
    this.persist();
    return result;
  }

  afterSummon(count: 1 | 10, rng: Rng): SummonResult[] {
    const results =
      count === 1
        ? [performSummon(this.save, rng)]
        : performMultiSummon(this.save, rng, 10);
    checkAndGrantAchievements(this.save);
    this.persist();
    return results;
  }

  /** Unlock a passive node. Returns false if not enough skill points or node unreachable. */
  unlockPassiveNode(nodeId: string): boolean {
    const save = this.save;
    if (save.hero.skillPoints <= 0) return false;
    if (save.hero.unlockedNodes.includes(nodeId)) return false;
    save.hero.unlockedNodes.push(nodeId);
    save.hero.skillPoints -= 1;
    this.persist();
    return true;
  }

  /** Set the chosen battle squad (owned tower ids, capped at 7). Persists. */
  setSquad(ids: string[]): void {
    const owned = ids.filter((id) => id in this.save.collection).slice(0, 7);
    this.save.squad = owned;
    this.persist();
  }

  /** Equip an owned item instance. Returns false if not equippable. Persists on success. */
  equipItem(instanceId: string): boolean {
    const ok = equipItem(this.save, instanceId);
    if (ok) this.persist();
    return ok;
  }

  /** Clear an equipment slot and persist. */
  unequipSlot(slot: ItemSlot): void {
    unequipSlot(this.save, slot);
    this.persist();
  }

  /** Equip an owned active skill. Returns false if not owned. Persists on success. */
  equipSkill(skillId: string): boolean {
    const ok = equipSkill(this.save, skillId);
    if (ok) this.persist();
    return ok;
  }

  /** Clear the equipped active skill and persist. */
  unequipSkill(): void {
    unequipSkill(this.save);
    this.persist();
  }

  afterShopPurchase(entryId: string): PurchaseResult {
    const result = purchaseShopItem(this.save, entryId);
    if (result.success) this.persist();
    return result;
  }

  grantDailyLogin(todayIso: string): number {
    if (this.save.currency.lastDailyLoginDate === todayIso) return 0;
    this.save.currency.lastDailyLoginDate = todayIso;
    this.save.currency.crystals += DAILY_LOGIN_CRYSTALS;
    this.persist();
    return DAILY_LOGIN_CRYSTALS;
  }

  private persist(): void {
    this.save.lastSavedAt = Date.now();
    this.provider.persist(this.save);
  }
}
