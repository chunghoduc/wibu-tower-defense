import { checkAndGrantAchievements } from "./achievements.ts";
import { processStageClear, type DropResult } from "./drops.ts";
import { performMultiSummon, performSummon, type SummonResult } from "./gacha.ts";
import { purchaseShopItem, type PurchaseResult } from "./shop.ts";
import { Rng } from "./rng.ts";
import type { Difficulty } from "../data/schema.ts";
import { createFreshSave, type HeroSave, type SaveProvider } from "./save.ts";

const DAILY_LOGIN_CRYSTALS = 10;

export class SaveManager {
  private save: HeroSave;

  constructor(private readonly provider: SaveProvider) {
    this.save = provider.load() ?? createFreshSave();
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
