/**
 * Achievement catalog — pure data + progress functions. Each achievement is a
 * goal with a live progress(save) reading existing save fields, plus a reward
 * (a gold/diamonds/materials bundle and/or a reward hero). The two legacy
 * achievements keep their character reward; the rest grant resource bundles.
 * Logic (grant/unlock) lives in core/achievements.ts; UI in AchievementScene.
 */
import type { Reward } from "../core/rewards.ts";
import type { HeroSave } from "../core/save.ts";
import { collectionPct } from "../core/profile.ts";
import { AWAKENING_CRYSTAL, JEWEL_OF_CHAOS, FEATHER } from "./materials.ts";

export type AchievementCategory =
  | "Campaign"
  | "Hero"
  | "Combat"
  | "Collection"
  | "Engineering";

/** A reward bundle (gold/diamonds/materials) AND/OR a reward hero (characterId). */
export type AchievementReward = Reward & { characterId?: string };

export interface AchievementProgress {
  current: number;
  target: number;
}

export interface AchievementDef {
  id: string;
  name: string;
  category: AchievementCategory;
  description: string;
  /** Drives the progress bar; unlocked ⇔ current >= target. Pure over the save. */
  progress: (save: HeroSave) => AchievementProgress;
  reward: AchievementReward;
}

/** Render order for category sections in the UI. */
export const CATEGORY_ORDER: AchievementCategory[] = [
  "Campaign",
  "Hero",
  "Combat",
  "Collection",
  "Engineering",
];

// ── progress helpers ─────────────────────────────────────────────────────────
function stageCleared(save: HeroSave, stageId: string): number {
  const r = save.progress.stageClearMap[stageId];
  return r && (r.Normal || r.Hard || r.Nightmare) ? 1 : 0;
}
function nightmareWins(save: HeroSave): number {
  return Object.values(save.progress.stageClearMap).some((r) => r?.Nightmare) ? 1 : 0;
}
function bestEndlessWave(save: HeroSave): number {
  const ws = Object.values(save.meta.endless.bestWave);
  return ws.length ? Math.max(...ws) : 0;
}
function ownedCount(save: HeroSave): number {
  return Object.keys(save.collection).length;
}
function codexPct(save: HeroSave): number {
  return Math.round(collectionPct(save) * 100);
}

export const ACHIEVEMENTS: AchievementDef[] = [
  // ── Campaign ────────────────────────────────────────────────────────────────
  {
    id: "clear-stage-3",
    name: "First Blood",
    category: "Campaign",
    description: "Clear Stage 3 on any difficulty",
    progress: (s) => ({ current: stageCleared(s, "stage-3"), target: 1 }),
    reward: { characterId: "tobi-skipstone" },
  },
  {
    id: "clear-stage-10",
    name: "Chapter Closer",
    category: "Campaign",
    description: "Clear Stage 10 on any difficulty",
    progress: (s) => ({ current: stageCleared(s, "stage-10"), target: 1 }),
    reward: { diamonds: 60 },
  },
  {
    id: "clear-stage-20",
    name: "Into the Emberfall",
    category: "Campaign",
    description: "Clear Stage 20 on any difficulty",
    progress: (s) => ({ current: stageCleared(s, "stage-20"), target: 1 }),
    reward: { diamonds: 120, materials: { [AWAKENING_CRYSTAL]: 1 } },
  },
  {
    id: "win-nightmare",
    name: "No Mercy",
    category: "Campaign",
    description: "Win any stage on Nightmare difficulty",
    progress: (s) => ({ current: nightmareWins(s), target: 1 }),
    reward: { diamonds: 80 },
  },
  // ── Hero ──────────────────────────────────────────────────────────────────────
  {
    id: "hero-level-10",
    name: "Seasoned",
    category: "Hero",
    description: "Reach Hero Level 10",
    progress: (s) => ({ current: s.hero.level, target: 10 }),
    reward: { gold: 2000 },
  },
  {
    id: "hero-level-25",
    name: "Veteran",
    category: "Hero",
    description: "Reach Hero Level 25",
    progress: (s) => ({ current: s.hero.level, target: 25 }),
    reward: { diamonds: 90 },
  },
  {
    id: "hero-level-50",
    name: "Legend",
    category: "Hero",
    description: "Reach Hero Level 50",
    progress: (s) => ({ current: s.hero.level, target: 50 }),
    reward: { diamonds: 200, materials: { [JEWEL_OF_CHAOS]: 1 } },
  },
  // ── Combat ────────────────────────────────────────────────────────────────────
  {
    id: "kills-1000",
    name: "Cull the Horde",
    category: "Combat",
    description: "Defeat 1,000 enemies (lifetime)",
    progress: (s) => ({ current: s.meta.profile.lifetimeKills, target: 1000 }),
    reward: { gold: 3000 },
  },
  {
    id: "kills-10000",
    name: "Tide Breaker",
    category: "Combat",
    description: "Defeat 10,000 enemies (lifetime)",
    progress: (s) => ({ current: s.meta.profile.lifetimeKills, target: 10000 }),
    reward: { diamonds: 100 },
  },
  {
    id: "kills-100000",
    name: "Extinction Event",
    category: "Combat",
    description: "Defeat 100,000 enemies (lifetime)",
    progress: (s) => ({ current: s.meta.profile.lifetimeKills, target: 100000 }),
    reward: { diamonds: 250, materials: { [AWAKENING_CRYSTAL]: 2 } },
  },
  {
    id: "endless-wave-10",
    name: "Survivor",
    category: "Combat",
    description: "Reach Wave 10 in Endless Survival",
    progress: (s) => ({ current: bestEndlessWave(s), target: 10 }),
    reward: { gold: 2500 },
  },
  {
    id: "endless-wave-25",
    name: "Last Stand",
    category: "Combat",
    description: "Reach Wave 25 in Endless Survival",
    progress: (s) => ({ current: bestEndlessWave(s), target: 25 }),
    reward: { diamonds: 110 },
  },
  {
    id: "endless-wave-50",
    name: "Unbreakable",
    category: "Combat",
    description: "Reach Wave 50 in Endless Survival",
    progress: (s) => ({ current: bestEndlessWave(s), target: 50 }),
    reward: { diamonds: 220, materials: { [FEATHER]: 2 } },
  },
  // ── Collection ──────────────────────────────────────────────────────────────────
  {
    id: "own-10-towers",
    name: "Recruiter",
    category: "Collection",
    description: "Own 10 different heroes",
    progress: (s) => ({ current: ownedCount(s), target: 10 }),
    reward: { gold: 3000 },
  },
  {
    id: "own-25-towers",
    name: "Warlord",
    category: "Collection",
    description: "Own 25 different heroes",
    progress: (s) => ({ current: ownedCount(s), target: 25 }),
    reward: { diamonds: 130 },
  },
  {
    id: "codex-50",
    name: "Archivist",
    category: "Collection",
    description: "Discover 50% of the Codex",
    progress: (s) => ({ current: codexPct(s), target: 50 }),
    reward: { materials: { [AWAKENING_CRYSTAL]: 1 }, diamonds: 60 },
  },
  {
    id: "codex-100",
    name: "Completionist",
    category: "Collection",
    description: "Discover 100% of the Codex",
    progress: (s) => ({ current: codexPct(s), target: 100 }),
    reward: { diamonds: 300, materials: { [JEWEL_OF_CHAOS]: 2 } },
  },
  // ── Engineering ──────────────────────────────────────────────────────────────────
  {
    id: "place-50-towers",
    name: "Groundskeeper",
    category: "Engineering",
    description: "Place 50 towers total across all battles",
    progress: (s) => ({ current: s.progress.totalTowersPlaced, target: 50 }),
    reward: { characterId: "mochi-morale-sprite" },
  },
  {
    id: "place-500-towers",
    name: "Master Builder",
    category: "Engineering",
    description: "Place 500 towers total across all battles",
    progress: (s) => ({ current: s.progress.totalTowersPlaced, target: 500 }),
    reward: { diamonds: 120 },
  },
  {
    id: "place-5000-towers",
    name: "Architect of War",
    category: "Engineering",
    description: "Place 5,000 towers total across all battles",
    progress: (s) => ({ current: s.progress.totalTowersPlaced, target: 5000 }),
    reward: { diamonds: 240, materials: { [FEATHER]: 3 } },
  },
];

/** Short reward label for a card (`+60 💎` / `🦸 New Hero` / combined). */
export function achievementRewardLabel(reward: AchievementReward): string {
  const parts: string[] = [];
  if (reward.characterId) parts.push("🦸 New Hero");
  if (reward.gold) parts.push(`+${reward.gold} 🪙`);
  if (reward.diamonds) parts.push(`+${reward.diamonds} 💎`);
  if (reward.materials) {
    for (const [, n] of Object.entries(reward.materials)) {
      if (n) parts.push(`+${n} ✦`);
    }
  }
  return parts.join("  ·  ");
}
