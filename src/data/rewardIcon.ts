// src/data/rewardIcon.ts
//
// THE single source of truth mapping a reward (or one of its components) to its
// on-screen icon: { iconKey, emoji, color }. Both the post-battle reward panel
// (via rewardTiles.ts) and the Lucky Spin reel (spinReel.ts) consume these so a
// given reward looks identical everywhere — real texture when loaded, emoji
// fallback when not. Phaser-free so it is unit-testable.
import type { Reward } from "../core/rewards.ts";
import type { Rarity } from "./schema.ts";
import { MATERIALS_MAP } from "./materials.ts";
import { itemTex, jewelTex, materialTex, boxTex, GOLD_TEX, GEM_TEX, XP_TEX } from "./assetKeys.ts";

export interface RewardIconView {
  /** Texture key to draw when loaded (e.g. "material__soul-jewel"). "" = no texture. */
  iconKey: string;
  /** Emoji fallback when the texture is missing. */
  emoji: string;
  /** Frame / accent color (hex int). */
  color: number;
}

export const RARITY_ORDER: Rarity[] = ["Common", "Magic", "Rare", "Legendary", "Unique"];
export const RARITY_INT: Record<Rarity, number> = {
  Common: 0x9e9e9e, Magic: 0x2196f3, Rare: 0x9c27b0, Legendary: 0xff9800, Unique: 0xf44336,
};
export const GOLD_INT = 0xffcf4d, DIAMOND_INT = 0x7ec8ff, MAT_INT = 0xa5d6a7, XP_INT = 0x9cc6ff;

export function goldIcon(): RewardIconView { return { iconKey: GOLD_TEX, emoji: "🪙", color: GOLD_INT }; }
export function diamondIcon(): RewardIconView { return { iconKey: GEM_TEX, emoji: "💎", color: DIAMOND_INT }; }
export function xpIcon(): RewardIconView { return { iconKey: XP_TEX, emoji: "⭐", color: XP_INT }; }

export function itemIcon(rarity: Rarity, defId: string): RewardIconView {
  return { iconKey: itemTex(defId), emoji: "📦", color: RARITY_INT[rarity] };
}
export function jewelIcon(rarity: Rarity, defId: string): RewardIconView {
  return { iconKey: jewelTex(defId), emoji: "💠", color: RARITY_INT[rarity] };
}

/** Material or boss-box icon. Boxes ship a box__<id> texture + rarity color; other materials use material__<id>. */
export function materialIcon(id: string): RewardIconView {
  const def = MATERIALS_MAP.get(id);
  if (def?.kind === "box") {
    const rarity = RARITY_ORDER[(def.rarity ?? 1) - 1] ?? "Common";
    return { iconKey: boxTex(id), emoji: "🎁", color: RARITY_INT[rarity] };
  }
  return { iconKey: materialTex(id), emoji: "💠", color: MAT_INT };
}

/** Salience rank for picking the dominant material in a bundle. Boxes rank by rarity tier; others mid. */
function materialRank(id: string): number {
  const def = MATERIALS_MAP.get(id);
  if (def?.kind === "box") return 10 + (def.rarity ?? 1);
  return 5;
}

const SPARKLE: RewardIconView = { iconKey: "", emoji: "✨", color: MAT_INT };

/**
 * The single most salient icon for a reward bundle, for callers that show ONE
 * icon (the spin reel cell, a one-line toast). Priority: rarest material/box >
 * diamonds > gold. Returns a sparkle for an empty bundle.
 */
export function rewardPrimaryIcon(reward: Reward): RewardIconView {
  const mats = reward.materials ?? {};
  const ids = Object.keys(mats).filter((id) => (mats[id] ?? 0) > 0);
  if (ids.length) {
    const best = ids.reduce((a, b) => (materialRank(b) > materialRank(a) ? b : a));
    return materialIcon(best);
  }
  if (reward.diamonds) return diamondIcon();
  if (reward.gold) return goldIcon();
  return SPARKLE;
}
