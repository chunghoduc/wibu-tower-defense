/**
 * Achievement grant logic. Achievements auto-grant their reward the instant
 * their condition is met (progress.current >= target). State lives in
 * save.progress.achievementFlags. The catalog + progress functions live in
 * data/achievements.ts; the AchievementScene reads progress for display.
 */
import { addTowerToCollection, isTowerOwned } from "./collection.ts";
import { grantReward } from "./rewards.ts";
import type { HeroSave } from "./save.ts";
import { ACHIEVEMENTS, type AchievementDef } from "../data/achievements.ts";

export type { AchievementDef } from "../data/achievements.ts";
export { ACHIEVEMENTS } from "../data/achievements.ts";

/** True if this achievement's condition is currently satisfied. */
export function isAchievementUnlocked(def: AchievementDef, save: HeroSave): boolean {
  const p = def.progress(save);
  return p.current >= p.target;
}

/**
 * Grant every newly-satisfied achievement: flag it, grant its reward bundle and
 * (if any) its reward hero. Returns the reward labels granted this call (used by
 * the SaveManager call sites for celebration); empty when nothing new unlocked.
 */
export function checkAndGrantAchievements(save: HeroSave): string[] {
  const granted: string[] = [];
  for (const def of ACHIEVEMENTS) {
    if (save.progress.achievementFlags[def.id]) continue;
    if (!isAchievementUnlocked(def, save)) continue;
    save.progress.achievementFlags[def.id] = true;
    grantReward(save, def.reward);
    if (def.reward.characterId && !isTowerOwned(save, def.reward.characterId)) {
      addTowerToCollection(save, def.reward.characterId);
    }
    granted.push(def.reward.characterId ?? def.name);
  }
  return granted;
}
