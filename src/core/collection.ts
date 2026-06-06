import type { HeroSave } from "./save.ts";

export const MAX_STARS = 5;

export function addTowerToCollection(save: HeroSave, towerId: string): void {
  if (save.collection[towerId]) {
    addTowerDupe(save, towerId);
  } else {
    save.collection[towerId] = { stars: 1 };
  }
}

export function addTowerDupe(save: HeroSave, towerId: string): void {
  const entry = save.collection[towerId];
  if (!entry) return;
  entry.stars = Math.min(entry.stars + 1, MAX_STARS);
}

export function isTowerOwned(save: HeroSave, towerId: string): boolean {
  return towerId in save.collection;
}

export function getTowerStars(save: HeroSave, towerId: string): number {
  return save.collection[towerId]?.stars ?? 0;
}
