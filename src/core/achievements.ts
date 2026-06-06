import { addTowerToCollection, isTowerOwned } from "./collection.ts";
import type { HeroSave } from "./save.ts";

export interface AchievementUnlock {
  id: string;
  description: string;
  rewardCharacterId: string;
  checkFn: (save: HeroSave) => boolean;
}

export const ACHIEVEMENT_UNLOCKS: AchievementUnlock[] = [
  {
    id: "clear-stage-3",
    description: "Clear Stage 3 on any difficulty",
    rewardCharacterId: "tobi-skipstone",
    checkFn: (save) => {
      const r = save.progress.stageClearMap["stage-3"];
      return !!(r && (r.Normal || r.Hard || r.Nightmare));
    },
  },
  {
    id: "place-50-towers",
    description: "Place 50 towers total across all battles",
    rewardCharacterId: "mochi-morale-sprite",
    checkFn: (save) => save.progress.totalTowersPlaced >= 50,
  },
];

export function checkAndGrantAchievements(save: HeroSave): string[] {
  const granted: string[] = [];
  for (const ach of ACHIEVEMENT_UNLOCKS) {
    if (save.progress.achievementFlags[ach.id]) continue;
    if (!ach.checkFn(save)) continue;
    save.progress.achievementFlags[ach.id] = true;
    if (!isTowerOwned(save, ach.rewardCharacterId)) {
      addTowerToCollection(save, ach.rewardCharacterId);
    }
    granted.push(ach.rewardCharacterId);
  }
  return granted;
}
