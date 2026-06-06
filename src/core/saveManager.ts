import { checkAndGrantAchievements } from "./achievements.ts";
import { processStageClear, type DropResult } from "./drops.ts";
import { performMultiSummon, performSummon, type SummonResult } from "./gacha.ts";
import { awardHeroXp } from "./hero.ts";
import { purchaseShopItem, type PurchaseResult } from "./shop.ts";
import { Rng } from "./rng.ts";
import type { Difficulty } from "../data/schema.ts";
import { createFreshSave, type HeroSave, type SaveProvider } from "./save.ts";
import { SINGLE_PULL_COST } from "./gacha.ts";

const DAILY_LOGIN_CRYSTALS = 10;
const STARTER_CRYSTALS = SINGLE_PULL_COST; // one free pull for new players

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
    // Grant starter crystals to brand-new saves (lastSavedAt === 0 signals never-persisted)
    if (!loaded) {
      this.save.currency.crystals = STARTER_CRYSTALS;
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
