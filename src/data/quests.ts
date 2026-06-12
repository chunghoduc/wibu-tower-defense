/**
 * Daily quest catalog — 7 static quests, same every day, reset at midnight.
 * Completing all 7 awards a 50-diamond bonus.
 *
 * Quest rewards:
 *  - Most quests give Gold (everyday currency) — keeps the gold loop active.
 *  - Difficulty-gating quests give a small Diamond bonus.
 *  - The boss-kill quest uniquely rewards a Summon Scroll.
 *
 * Track-keys mirror the quest IDs and are incremented by the tracker.
 */

export interface QuestReward {
  gold?: number;
  diamonds?: number;
  scroll?: number; // Summoning Scroll count
}

export interface QuestDef {
  id: string;
  label: string; // player-facing short name
  description: string; // what to do
  target: number; // amount needed to complete
  reward: QuestReward;
}

export const DAILY_QUESTS: QuestDef[] = [
  {
    id: "kill_enemies",
    label: "Enemy Hunter",
    description: "Kill 30 enemies in battle.",
    target: 30,
    reward: { gold: 200 },
  },
  {
    id: "kill_bosses",
    label: "Boss Slayer",
    description: "Kill 5 bosses.",
    target: 5,
    reward: { scroll: 1 }, // the single Summon Scroll quest
  },
  {
    id: "clear_stages",
    label: "Conqueror",
    description: "Clear 3 stages.",
    target: 3,
    reward: { gold: 300 },
  },
  {
    id: "clear_hard",
    label: "Challenger",
    description: "Clear 1 Hard or Nightmare stage.",
    target: 1,
    reward: { diamonds: 10 },
  },
  {
    id: "place_towers",
    label: "Commander",
    description: "Place 15 towers across all battles.",
    target: 15,
    reward: { gold: 200 },
  },
  {
    id: "upgrade_towers",
    label: "Forgemaster",
    description: "Upgrade towers 5 times in battle.",
    target: 5,
    reward: { diamonds: 8 },
  },
  {
    id: "enhance_items",
    label: "Artisan",
    description: "Enhance any item 3 times.",
    target: 3,
    reward: { diamonds: 10 },
  },
];

export const DAILY_QUESTS_MAP = new Map<string, QuestDef>(DAILY_QUESTS.map((q) => [q.id, q]));

/** Short human-readable reward summary for tooltip / results display. */
export function questRewardLabel(reward: QuestReward): string {
  const parts: string[] = [];
  if (reward.gold) parts.push(`+${reward.gold} 🪙`);
  if (reward.diamonds) parts.push(`+${reward.diamonds} 💎`);
  if (reward.scroll) parts.push(`+${reward.scroll} Summon Scroll`);
  return parts.join("  ·  ");
}
