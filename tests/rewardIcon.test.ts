import { describe, it, expect } from "vitest";
import {
  goldIcon,
  diamondIcon,
  xpIcon,
  itemIcon,
  jewelIcon,
  materialIcon,
  rewardPrimaryIcon,
  RARITY_INT,
  GOLD_INT,
  DIAMOND_INT,
  MAT_INT,
} from "../src/data/rewardIcon.ts";
import { SPIN_WHEEL } from "../src/core/spin.ts";
import { battleLootTiles } from "../src/data/rewardTiles.ts";
import type { Reward } from "../src/core/rewards.ts";

describe("per-kind icon resolvers", () => {
  it("gold/diamond/xp use the shared UI icon keys", () => {
    expect(goldIcon()).toEqual({ iconKey: "icon__gold", emoji: "🪙", color: GOLD_INT });
    expect(diamondIcon()).toEqual({ iconKey: "icon__gem", emoji: "💎", color: DIAMOND_INT });
    expect(xpIcon().iconKey).toBe("icon__xp");
  });

  it("item/jewel keys follow the texture convention with rarity color", () => {
    expect(itemIcon("Legendary", "dawnbreaker")).toEqual({
      iconKey: "item__dawnbreaker",
      emoji: "📦",
      color: RARITY_INT.Legendary,
    });
    expect(jewelIcon("Rare", "ruby")).toEqual({
      iconKey: "jewel__ruby",
      emoji: "💠",
      color: RARITY_INT.Rare,
    });
  });

  it("non-box material → material__<id> + MAT color", () => {
    expect(materialIcon("bless-jewel")).toEqual({
      iconKey: "material__bless-jewel",
      emoji: "💠",
      color: MAT_INT,
    });
  });
});

describe("rewardPrimaryIcon", () => {
  it("picks the single salient icon by kind", () => {
    expect(rewardPrimaryIcon({ gold: 200 }).iconKey).toBe("icon__gold");
    expect(rewardPrimaryIcon({ diamonds: 15 }).iconKey).toBe("icon__gem");
    expect(rewardPrimaryIcon({ materials: { "soul-jewel": 1 } }).iconKey).toBe(
      "material__soul-jewel",
    );
  });

  it("ranks a material/box bundle above bare currency and returns sparkle for empty", () => {
    expect(rewardPrimaryIcon({ gold: 5, materials: { "soul-jewel": 1 } }).iconKey).toBe(
      "material__soul-jewel",
    );
    expect(rewardPrimaryIcon({}).emoji).toBe("✨");
    expect(rewardPrimaryIcon({ materials: { "soul-jewel": 0 } }).iconKey).toBe(""); // zero-count ignored → empty bundle
  });

  // Anti-drift guard: the spin and the post-battle panel must agree on every wheel prize.
  it("agrees with the reward panel's iconKey for every SPIN_WHEEL prize", () => {
    for (const prize of SPIN_WHEEL) {
      const reward: Reward = prize.reward;
      const summary = {
        outcome: "won" as const,
        isFirstClear: false,
        xp: 0,
        gold: reward.gold ?? 0,
        diamonds: reward.diamonds ?? 0,
        items: [],
        jewels: [],
        skills: [],
        characters: [],
        materials: reward.materials ?? {},
      };
      const panelKeys = battleLootTiles(summary).map((t) => t.iconKey);
      expect(panelKeys).toContain(rewardPrimaryIcon(reward).iconKey);
    }
  });
});
