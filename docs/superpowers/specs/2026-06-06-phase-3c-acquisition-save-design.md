# Phase 3c — Acquisition + Save Design

**Date:** 2026-06-06
**Status:** Approved (autonomous — user delegated full Phase 3)
**Scope:** Currency system, gacha/summon with pity, campaign drops, shop, achievement unlocks, complete local save persistence

---

## Design Decisions (autonomous)

### Currency
Single soft currency: **Crystals** (icon 💎, id: `crystals`). Earned from:
- Stage clear: 20 crystals (Normal), 30 (Hard), 50 (Nightmare)
- First clear bonus: +50 crystals per stage per difficulty
- Daily login: 10 crystals (tracked in save)
- Achievement milestones

No premium hard currency in v1 — all crystals are earnable. Monetization is deferred to Phase 5.

**Pull cost:** 160 crystals per single pull, 1440 for 10-pull (10% discount). These are tunable constants.

### Gacha Banner — Pull Rates
Single "Standard" banner covering all characters.

| Rarity | Base rate | Notes |
|--------|-----------|-------|
| Unique | 0.6% | Soft pity at pull 75, hard pity at pull 90 |
| Legendary | 5.1% | No pity |
| Rare | 12.0% | No pity |
| Magic | 25.6% | No pity |
| Common | 56.7% | No pity |

**Soft pity (Unique):** Starting at pull 75 (without a Unique since last Unique), the Unique rate increases by +6.0% per pull. At pull 89 the rate exceeds 82%. Pull 90 is the hard pity — guaranteed Unique.

**Pity state** in save: `pityCount: number` (resets to 0 on Unique pull).

**Verified math (from research):** Monotonically non-decreasing pull probability → pity provably increases player satisfaction and revenue. The "whale property" (high spenders always get what free players get, just faster) is satisfied.

**Note:** The Granblue Fantasy "pity originated in 2016 / is theoretically optimal worst-case insurance" claim was REFUTED in the deep research. Do not encode it.

### What you can get from pulls
All 32 characters in the catalog. Rarity determines pull rate — Common characters are weighted in the Common bucket, Legendary in the Legendary bucket, etc. Equal weight within each rarity tier.

Pulling a duplicate adds a star rank to the owned tower.

### Campaign Drops
After clearing a stage, `processStageClear` runs and may award:
- **Crystals** (always, see above)
- **Item drop** (30% chance, item's requiredLevel = stage index × 8 + 5, rarity weighted by stage)
- **Active skill drop** (15% chance, from skills not yet owned — skills are unique collectibles)
- **Character drop** (5% chance, from characters not yet owned at Common/Magic rarity only — Rare+ only from gacha)

### Shop
A small static shop refreshed daily (tracked in save). Sells:
- Specific Common/Magic items for crystals
- A rotating "featured character" (Magic rarity) for 800 crystals
- Pity insurance: "guaranteed next pull is Rare+" for 400 crystals

### Achievement Unlocks
Two characters are unlocked via achievements (not pullable from gacha), to give F2P players progression goals:
- `tobi-skipstone` (Common chain) — unlocked: "clear stage 3 on any difficulty"
- `mochi-morale-sprite` (Common support) — unlocked: "place 50 towers total"

These are hardcoded in an `ACHIEVEMENT_UNLOCKS` catalog.

### Local Save — Complete Integration
Phase 3c completes the save layer by adding:
- `currency: CurrencySave` (crystals, daily login timestamp, shop refresh state)
- `progress: ProgressSave` (stage clears per difficulty, achievement flags)
- Save version bumps to **3**
- Auto-save hooks: `SaveManager` class wraps `SaveProvider` and exposes `afterBattle(stageId, outcome)`, `afterSummon()`, `afterShopPurchase()` — each mutates and auto-persists

---

## Data Model

### New types in `src/core/save.ts`

```ts
export const CURRENT_SAVE_VERSION = 3;  // bumped from 2

export interface CurrencySave {
  crystals: number;
  pityCount: number;          // pulls since last Unique
  lastDailyLoginDate: string; // ISO date string "2026-06-06"
}

export interface StageClearRecord {
  Normal: boolean;
  Hard: boolean;
  Nightmare: boolean;
}

export interface ProgressSave {
  stageClearMap: Record<string, StageClearRecord>;  // keyed by stageId
  achievementFlags: Record<string, boolean>;         // keyed by achievementId
  totalTowersPlaced: number;
}

export interface HeroSave {
  version: number;
  heroId: string;
  hero: HeroProgressSave;
  inventory: InventorySave;
  collection: TowerCollection;
  currency: CurrencySave;
  progress: ProgressSave;
  lastSavedAt: number;
}
```

---

## New Modules

### `src/core/gacha.ts`
```ts
performSummon(save: HeroSave, rng: Rng): SummonResult
performMultiSummon(save: HeroSave, rng: Rng, count: number): SummonResult[]
canAffordSummon(save: HeroSave, count?: number): boolean

interface SummonResult {
  characterId: string;
  rarity: Rarity;
  isNew: boolean;         // first time getting this character
  newStars: number;       // stars after this pull (1 if new, prev+1 if dupe)
  pityCounted: number;    // pityCount after this pull
}
```

### `src/core/drops.ts`
```ts
processStageClear(save: HeroSave, stageId: string, difficulty: Difficulty, rng: Rng): DropResult
interface DropResult {
  crystalsAwarded: number;
  itemDropped: ItemInstance | null;
  skillDropped: string | null;      // skillId
  characterDropped: string | null;  // characterId
  isFirstClear: boolean;
}
```

### `src/core/shop.ts`
```ts
SHOP_CATALOG: ShopEntry[]
interface ShopEntry {
  id: string;
  name: string;
  cost: number;
  rewardType: "item" | "character" | "pity-boost";
  rewardRef: string;
}
purchaseShopItem(save: HeroSave, entryId: string): PurchaseResult
```

### `src/core/achievements.ts`
```ts
ACHIEVEMENT_UNLOCKS: AchievementUnlock[]
interface AchievementUnlock {
  id: string;
  description: string;
  rewardCharacterId: string;
  checkFn: (save: HeroSave) => boolean;
}
checkAndGrantAchievements(save: HeroSave): string[]  // returns newly granted characterIds
```

### `src/core/saveManager.ts`
```ts
class SaveManager {
  constructor(provider: SaveProvider)
  getSave(): HeroSave
  afterBattle(stageId: string, outcome: "won" | "lost", difficulty: Difficulty, rng: Rng): DropResult | null
  afterSummon(count: 1 | 10, rng: Rng): SummonResult[]
  afterShopPurchase(entryId: string): PurchaseResult
  grantDailyLogin(): number  // returns crystals granted (0 if already claimed today)
}
```

---

## Migrations

```ts
// v1 → v2: add collection
function migrate_v1_to_v2(save): HeroSave { return { ...save, collection: {}, version: 2 }; }

// v2 → v3: add currency + progress
function migrate_v2_to_v3(save): HeroSave {
  return {
    ...save,
    currency: { crystals: 0, pityCount: 0, lastDailyLoginDate: "" },
    progress: { stageClearMap: {}, achievementFlags: {}, totalTowersPlaced: 0 },
    version: 3,
  };
}
```

---

## What Phase 3c Does NOT Include
- Premium currency / real-money purchases (Phase 5)
- Cloud save sync (Phase 5)
- Banner UI / summon animation (Phase 4)
- Full shop UI (Phase 4)
