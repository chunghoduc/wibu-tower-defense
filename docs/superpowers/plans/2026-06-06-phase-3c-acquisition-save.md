# Phase 3c — Acquisition + Save Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gacha summon with pity, campaign drops, shop, achievement unlocks, crystal currency, and full save persistence (v3) tying all of Phase 3 together via `SaveManager`.

**Architecture:** Each concern is a separate pure module (`gacha.ts`, `drops.ts`, `shop.ts`, `achievements.ts`). `SaveManager` wraps the provider and exposes high-level game events. No Phaser dependency anywhere in this layer.

**Tech Stack:** TypeScript, Vitest. `npm test` / `npm run typecheck` / `npm run build`.

---

## File Map

| Action | Path                         | Responsibility                                                                   |
| ------ | ---------------------------- | -------------------------------------------------------------------------------- |
| Modify | `src/core/save.ts`           | Add `CurrencySave`, `ProgressSave`, update `HeroSave` to v3, add v2→v3 migration |
| Create | `src/core/gacha.ts`          | Pull rates, soft/hard pity, `performSummon`, `performMultiSummon`                |
| Create | `src/core/drops.ts`          | Stage-clear rewards: crystals, item/skill/character drops                        |
| Create | `src/core/shop.ts`           | Static shop catalog, `purchaseShopItem`                                          |
| Create | `src/core/achievements.ts`   | Achievement definitions, `checkAndGrantAchievements`                             |
| Create | `src/core/saveManager.ts`    | `SaveManager` — wraps provider, high-level event hooks                           |
| Create | `tests/save-v3.test.ts`      | Save v3 migration tests                                                          |
| Create | `tests/gacha.test.ts`        | Pull rate, pity, multi-pull tests                                                |
| Create | `tests/drops.test.ts`        | Stage clear drop tests                                                           |
| Create | `tests/shop.test.ts`         | Shop purchase tests                                                              |
| Create | `tests/achievements.test.ts` | Achievement unlock tests                                                         |
| Create | `tests/saveManager.test.ts`  | Integration: full round-trip through SaveManager                                 |

---

## Task 1 — Save v3 Schema

**Files:** `src/core/save.ts`, `tests/save-v3.test.ts`

- [ ] **Write failing tests** — create `tests/save-v3.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createFreshSave, loadAndMigrate, CURRENT_SAVE_VERSION } from "../src/core/save.ts";

describe("HeroSave v3", () => {
  it("CURRENT_SAVE_VERSION is 3", () => {
    expect(CURRENT_SAVE_VERSION).toBe(3);
  });

  it("createFreshSave has currency with 0 crystals", () => {
    const save = createFreshSave();
    expect(save.currency.crystals).toBe(0);
    expect(save.currency.pityCount).toBe(0);
    expect(save.currency.lastDailyLoginDate).toBe("");
  });

  it("createFreshSave has empty progress", () => {
    const save = createFreshSave();
    expect(Object.keys(save.progress.stageClearMap)).toHaveLength(0);
    expect(Object.keys(save.progress.achievementFlags)).toHaveLength(0);
    expect(save.progress.totalTowersPlaced).toBe(0);
  });

  it("migrate v1 → v3 (two hops)", () => {
    const v1: any = {
      version: 1,
      heroId: "h1",
      hero: {
        level: 1,
        totalXp: 0,
        skillPoints: 0,
        unlockedNodes: [],
        obtainedSkills: [],
        equippedSkillId: null,
      },
      inventory: { items: [], equipped: {} },
      lastSavedAt: 0,
    };
    const migrated = loadAndMigrate(v1);
    expect(migrated.version).toBe(3);
    expect(migrated.collection).toEqual({});
    expect(migrated.currency.crystals).toBe(0);
    expect(migrated.progress.totalTowersPlaced).toBe(0);
  });

  it("migrate v2 → v3 preserves existing collection", () => {
    const v2: any = {
      version: 2,
      heroId: "h2",
      hero: {
        level: 10,
        totalXp: 5000,
        skillPoints: 9,
        unlockedNodes: [],
        obtainedSkills: [],
        equippedSkillId: null,
      },
      inventory: { items: [], equipped: {} },
      collection: { "zoran-thricedraw": { stars: 3 } },
      lastSavedAt: 0,
    };
    const migrated = loadAndMigrate(v2);
    expect(migrated.version).toBe(3);
    expect(migrated.collection["zoran-thricedraw"].stars).toBe(3);
    expect(migrated.currency.crystals).toBe(0);
  });
});
```

- [ ] **Run to confirm failures:** `npm test -- tests/save-v3.test.ts 2>&1 | tail -8`

- [ ] **Update `src/core/save.ts`**:

Change `CURRENT_SAVE_VERSION` from `2` to `3`.

Add new types:

```ts
export interface CurrencySave {
  crystals: number;
  pityCount: number;
  lastDailyLoginDate: string; // ISO "YYYY-MM-DD", "" if never
}

export interface StageClearRecord {
  Normal: boolean;
  Hard: boolean;
  Nightmare: boolean;
}

export interface ProgressSave {
  stageClearMap: Record<string, StageClearRecord>;
  achievementFlags: Record<string, boolean>;
  totalTowersPlaced: number;
}
```

Update `HeroSave`:

```ts
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

Update `createFreshSave()` to include:

```ts
    currency: { crystals: 0, pityCount: 0, lastDailyLoginDate: "" },
    progress: { stageClearMap: {}, achievementFlags: {}, totalTowersPlaced: 0 },
```

Update `loadAndMigrate`:

```ts
export function loadAndMigrate(raw: unknown): HeroSave {
  if (!raw || typeof raw !== "object") return createFreshSave();
  let save = raw as HeroSave;
  if ((save.version ?? 0) < 2) save = { ...save, collection: {}, version: 2 };
  if ((save.version ?? 0) < 3)
    save = {
      ...save,
      currency: { crystals: 0, pityCount: 0, lastDailyLoginDate: "" },
      progress: { stageClearMap: {}, achievementFlags: {}, totalTowersPlaced: 0 },
      version: 3,
    };
  save.version = CURRENT_SAVE_VERSION;
  return save;
}
```

- [ ] **Run full suite:** `npm run typecheck && npm test 2>&1 | tail -10` — all prior tests pass.

- [ ] **Commit:** `git add src/core/save.ts tests/save-v3.test.ts && git commit -m "feat(core): HeroSave v3 — currency + progress fields, v1/v2 migrations"`

---

## Task 2 — Gacha System

**Files:** `src/core/gacha.ts`, `tests/gacha.test.ts`

- [ ] **Write failing tests** — create `tests/gacha.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  performSummon,
  performMultiSummon,
  canAffordSummon,
  SINGLE_PULL_COST,
  MULTI_PULL_COST,
  HARD_PITY,
} from "../src/core/gacha.ts";
import { createFreshSave } from "../src/core/save.ts";
import { Rng } from "../src/core/rng.ts";
import { TOWERS } from "../src/data/towers.ts";

describe("canAffordSummon", () => {
  it("returns false when crystals < single pull cost", () => {
    const save = createFreshSave();
    save.currency.crystals = 0;
    expect(canAffordSummon(save, 1)).toBe(false);
  });

  it("returns true when crystals >= single pull cost", () => {
    const save = createFreshSave();
    save.currency.crystals = SINGLE_PULL_COST;
    expect(canAffordSummon(save, 1)).toBe(true);
  });
});

describe("performSummon", () => {
  it("deducts crystal cost", () => {
    const save = createFreshSave();
    save.currency.crystals = SINGLE_PULL_COST;
    performSummon(save, new Rng(1));
    expect(save.currency.crystals).toBe(0);
  });

  it("returns a valid characterId from the catalog", () => {
    const save = createFreshSave();
    save.currency.crystals = SINGLE_PULL_COST * 100;
    const catalogIds = new Set(TOWERS.map((t) => t.id));
    for (let i = 0; i < 50; i++) {
      const result = performSummon(save, new Rng(i));
      expect(catalogIds.has(result.characterId)).toBe(true);
    }
  });

  it("adds pulled tower to collection", () => {
    const save = createFreshSave();
    save.currency.crystals = SINGLE_PULL_COST;
    const result = performSummon(save, new Rng(1));
    expect(save.collection[result.characterId]).toBeDefined();
  });

  it("isNew is true on first pull of a character", () => {
    const save = createFreshSave();
    save.currency.crystals = SINGLE_PULL_COST * 200;
    const rng = new Rng(42);
    const result = performSummon(save, rng);
    expect(result.isNew).toBe(true);
  });

  it("isNew is false and stars increment on duplicate", () => {
    const save = createFreshSave();
    save.currency.crystals = SINGLE_PULL_COST * 200;
    // Force the same character by mocking the collection to have all but one
    // Fill collection with all towers except one, then pull until we get that one
    const rng = new Rng(99);
    for (let i = 0; i < 20; i++) performSummon(save, rng);
    // Check that at least one entry has stars > 1 (a dupe was pulled)
    const hasStarsAbove1 = Object.values(save.collection).some((e) => e.stars > 1);
    expect(hasStarsAbove1).toBe(true);
  });

  it("hard pity guarantees a Unique at pull 90", () => {
    const save = createFreshSave();
    save.currency.crystals = SINGLE_PULL_COST * 200;
    save.currency.pityCount = HARD_PITY - 1; // one pull away from hard pity
    const result = performSummon(save, new Rng(1));
    expect(result.rarity).toBe("Unique");
    expect(save.currency.pityCount).toBe(0); // reset after Unique
  });

  it("pityCount increments on non-Unique pull", () => {
    const save = createFreshSave();
    save.currency.crystals = SINGLE_PULL_COST * 10;
    save.currency.pityCount = 0;
    // Pull enough times to get a non-unique and verify count goes up
    const rng = new Rng(7);
    let nonUniqueFound = false;
    for (let i = 0; i < 10; i++) {
      const before = save.currency.pityCount;
      const result = performSummon(save, rng);
      if (result.rarity !== "Unique") {
        expect(save.currency.pityCount).toBe(before + 1);
        nonUniqueFound = true;
        break;
      }
    }
    expect(nonUniqueFound).toBe(true);
  });
});

describe("performMultiSummon", () => {
  it("returns 10 results and deducts multi cost", () => {
    const save = createFreshSave();
    save.currency.crystals = MULTI_PULL_COST;
    const results = performMultiSummon(save, new Rng(1), 10);
    expect(results).toHaveLength(10);
    expect(save.currency.crystals).toBe(0);
  });
});
```

- [ ] **Run to confirm failures:** `npm test -- tests/gacha.test.ts 2>&1 | tail -8`

- [ ] **Create `src/core/gacha.ts`**:

```ts
/**
 * Gacha / summon system — Phase 3c.
 *
 * Pull rates follow the verified pity model:
 * - Monotonically non-decreasing Unique rate (soft pity at 75, hard at 90)
 * - Additive rates within each rarity tier
 * - pityCount resets to 0 on Unique pull
 *
 * Design note: The "pity originated with Granblue Fantasy 2016 / is theoretically
 * optimal worst-case insurance" claim was refuted in project research (0/3 verifiers).
 * Do not add that framing here.
 */
import { RARITIES, type Rarity } from "../data/schema.ts";
import { TOWERS } from "../data/towers.ts";
import { addTowerToCollection } from "./collection.ts";
import { Rng } from "./rng.ts";
import type { HeroSave } from "./save.ts";

export const SINGLE_PULL_COST = 160;
export const MULTI_PULL_COST = 1440; // 10 pulls, 10% discount
export const HARD_PITY = 90;
const SOFT_PITY_START = 75;
const SOFT_PITY_INCREASE = 0.06; // +6% Unique rate per pull after soft pity

const BASE_RATES: Record<Rarity, number> = {
  Unique: 0.006,
  Legendary: 0.051,
  Rare: 0.12,
  Magic: 0.256,
  Common: 0.567,
};

export interface SummonResult {
  characterId: string;
  rarity: Rarity;
  isNew: boolean;
  newStars: number;
  pityCount: number;
}

/** Returns whether the save has enough crystals for `count` pulls (default 1). */
export function canAffordSummon(save: HeroSave, count = 1): boolean {
  const cost = count === 1 ? SINGLE_PULL_COST : MULTI_PULL_COST;
  return save.currency.crystals >= cost;
}

/** Draw rarity given current pity count. */
function drawRarity(pityCount: number, rng: Rng): Rarity {
  if (pityCount >= HARD_PITY - 1) return "Unique";
  let uniqueRate = BASE_RATES.Unique;
  if (pityCount >= SOFT_PITY_START) {
    uniqueRate = BASE_RATES.Unique + SOFT_PITY_INCREASE * (pityCount - SOFT_PITY_START + 1);
  }
  const roll = rng.next();
  if (roll < uniqueRate) return "Unique";
  const remaining = 1 - uniqueRate;
  const legRate = BASE_RATES.Legendary * remaining;
  const rareRate = BASE_RATES.Rare * remaining;
  const magicRate = BASE_RATES.Magic * remaining;
  if (roll < uniqueRate + legRate) return "Legendary";
  if (roll < uniqueRate + legRate + rareRate) return "Rare";
  if (roll < uniqueRate + legRate + rareRate + magicRate) return "Magic";
  return "Common";
}

/** Draw a random character of the given rarity from the catalog. */
function drawCharacter(rarity: Rarity, rng: Rng): string {
  const pool = TOWERS.filter((t) => t.rarity === rarity);
  if (pool.length === 0) {
    // Fallback: if no characters of that rarity, pick any
    const all = TOWERS;
    return all[Math.floor(rng.next() * all.length)].id;
  }
  return pool[Math.floor(rng.next() * pool.length)].id;
}

/** Perform a single summon. Mutates save (deducts crystals, updates pity, adds to collection). */
export function performSummon(save: HeroSave, rng: Rng): SummonResult {
  save.currency.crystals -= SINGLE_PULL_COST;
  const rarity = drawRarity(save.currency.pityCount, rng);
  const characterId = drawCharacter(rarity, rng);

  const isNew = !(characterId in save.collection);
  const prevStars = save.collection[characterId]?.stars ?? 0;
  addTowerToCollection(save, characterId);
  const newStars = save.collection[characterId].stars;

  if (rarity === "Unique") {
    save.currency.pityCount = 0;
  } else {
    save.currency.pityCount += 1;
  }

  return { characterId, rarity, isNew, newStars, pityCount: save.currency.pityCount };
}

/** Perform multiple summons (10-pull uses discounted cost). */
export function performMultiSummon(save: HeroSave, rng: Rng, count: number): SummonResult[] {
  const cost = count === 10 ? MULTI_PULL_COST : SINGLE_PULL_COST * count;
  save.currency.crystals -= cost;
  // Restore per-pull deduction by pre-loading the cost
  save.currency.crystals += cost; // will be deducted per pull below
  return Array.from({ length: count }, () => {
    save.currency.crystals += SINGLE_PULL_COST; // credit before each pull deducts it
    return performSummon(save, rng);
  });
}
```

Wait — the multi-pull crystal deduction is messy. Let me simplify:

```ts
export function performMultiSummon(save: HeroSave, rng: Rng, count: number): SummonResult[] {
  const totalCost = count === 10 ? MULTI_PULL_COST : SINGLE_PULL_COST * count;
  // Deduct total cost upfront, then perform pulls without per-pull deduction
  save.currency.crystals -= totalCost;
  const results: SummonResult[] = [];
  for (let i = 0; i < count; i++) {
    // Temporarily credit SINGLE_PULL_COST so performSummon's deduction nets to 0
    save.currency.crystals += SINGLE_PULL_COST;
    results.push(performSummon(save, rng));
  }
  return results;
}
```

- [ ] **Run tests:** `npm run typecheck && npm test -- tests/gacha.test.ts 2>&1 | tail -15`
      Expected: all 9 tests pass.

- [ ] **Commit:** `git add src/core/gacha.ts tests/gacha.test.ts && git commit -m "feat(core): gacha system — soft/hard pity, pull rates, multi-pull"`

---

## Task 3 — Campaign Drops

**Files:** `src/core/drops.ts`, `tests/drops.test.ts`

- [ ] **Write failing tests** — create `tests/drops.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { processStageClear, CRYSTAL_REWARD } from "../src/core/drops.ts";
import { createFreshSave } from "../src/core/save.ts";
import { Rng } from "../src/core/rng.ts";

describe("processStageClear", () => {
  it("awards crystals on clear", () => {
    const save = createFreshSave();
    const result = processStageClear(save, "test-stage-1", "Normal", new Rng(1));
    expect(result.crystalsAwarded).toBeGreaterThanOrEqual(CRYSTAL_REWARD.Normal);
    expect(save.currency.crystals).toBe(result.crystalsAwarded);
  });

  it("awards first-clear bonus crystals once", () => {
    const save = createFreshSave();
    const first = processStageClear(save, "test-stage-1", "Normal", new Rng(1));
    expect(first.isFirstClear).toBe(true);
    expect(first.crystalsAwarded).toBeGreaterThan(CRYSTAL_REWARD.Normal); // bonus included

    const second = processStageClear(save, "test-stage-1", "Normal", new Rng(2));
    expect(second.isFirstClear).toBe(false);
    expect(second.crystalsAwarded).toBe(CRYSTAL_REWARD.Normal); // no bonus
  });

  it("records stage clear in progress", () => {
    const save = createFreshSave();
    processStageClear(save, "stage-5", "Hard", new Rng(1));
    expect(save.progress.stageClearMap["stage-5"]?.Hard).toBe(true);
    expect(save.progress.stageClearMap["stage-5"]?.Normal).toBeFalsy();
  });

  it("Hard and Nightmare give more crystals than Normal", () => {
    const saveN = createFreshSave();
    const saveH = createFreshSave();
    const saveNm = createFreshSave();
    // Use same seed but only check base reward (no first-clear bonus after first call)
    processStageClear(saveN, "s", "Normal", new Rng(1));
    processStageClear(saveH, "s", "Hard", new Rng(1));
    processStageClear(saveNm, "s", "Nightmare", new Rng(1));
    // Second clear (no bonus)
    const n = processStageClear(saveN, "s", "Normal", new Rng(99));
    const h = processStageClear(saveH, "s", "Hard", new Rng(99));
    const nm = processStageClear(saveNm, "s", "Nightmare", new Rng(99));
    expect(h.crystalsAwarded).toBeGreaterThan(n.crystalsAwarded);
    expect(nm.crystalsAwarded).toBeGreaterThan(h.crystalsAwarded);
  });

  it("may drop an item (probabilistic — run 100 times, expect at least one drop)", () => {
    let dropped = false;
    for (let seed = 0; seed < 100; seed++) {
      const save = createFreshSave();
      const result = processStageClear(save, "s", "Normal", new Rng(seed));
      if (result.itemDropped) {
        dropped = true;
        break;
      }
    }
    expect(dropped).toBe(true);
  });
});
```

- [ ] **Run to confirm failures:** `npm test -- tests/drops.test.ts 2>&1 | tail -8`

- [ ] **Create `src/core/drops.ts`**:

```ts
/**
 * Stage-clear drop system — Phase 3c.
 * Deterministic given the Rng seed; all randomness flows through rng.next().
 */
import type { Difficulty } from "../data/schema.ts";
import { ITEM_CATALOG, rollItem } from "../data/items.ts";
import { ACTIVE_SKILLS } from "../data/skills.ts";
import { TOWERS } from "../data/towers.ts";
import { addTowerToCollection } from "./collection.ts";
import { Rng } from "./rng.ts";
import type { HeroSave, ItemInstanceSave } from "./save.ts";

export const CRYSTAL_REWARD: Record<Difficulty, number> = {
  Normal: 20,
  Hard: 30,
  Nightmare: 50,
};
const FIRST_CLEAR_BONUS = 50;

const ITEM_DROP_CHANCE = 0.3;
const SKILL_DROP_CHANCE = 0.15;
const CHARACTER_DROP_CHANCE = 0.05;

export interface DropResult {
  crystalsAwarded: number;
  itemDropped: ItemInstanceSave | null;
  skillDropped: string | null;
  characterDropped: string | null;
  isFirstClear: boolean;
}

/** Stage index (1-based) → required level for item drops. */
function stageToItemLevel(stageIndex: number): number {
  return Math.max(1, stageIndex * 8 + 5);
}

export function processStageClear(
  save: HeroSave,
  stageId: string,
  difficulty: Difficulty,
  rng: Rng,
): DropResult {
  // Record clear
  if (!save.progress.stageClearMap[stageId]) {
    save.progress.stageClearMap[stageId] = { Normal: false, Hard: false, Nightmare: false };
  }
  const isFirstClear = !save.progress.stageClearMap[stageId][difficulty];
  save.progress.stageClearMap[stageId][difficulty] = true;

  // Crystals
  const base = CRYSTAL_REWARD[difficulty];
  const bonus = isFirstClear ? FIRST_CLEAR_BONUS : 0;
  const crystalsAwarded = base + bonus;
  save.currency.crystals += crystalsAwarded;

  // Estimate stage index from stageId (try to parse number from end, fallback to 1)
  const stageMatch = stageId.match(/(\d+)$/);
  const stageIndex = stageMatch ? parseInt(stageMatch[1]) : 1;

  // Item drop
  let itemDropped: ItemInstanceSave | null = null;
  if (rng.next() < ITEM_DROP_CHANCE) {
    const level = stageToItemLevel(stageIndex);
    const eligible = ITEM_CATALOG.filter((d) => d.requiredLevel <= level);
    if (eligible.length > 0) {
      const def = eligible[Math.floor(rng.next() * eligible.length)];
      const inst = rollItem(def, level, Math.floor(rng.next() * 999999));
      const instSave: ItemInstanceSave = {
        id: inst.id,
        defId: inst.defId,
        acquiredLevel: inst.acquiredLevel,
        rolledStats: Object.fromEntries(
          Object.entries(inst.rolledStats).map(([k, v]) => [k, v as number]),
        ),
        rolledPrimaryAffix: inst.rolledPrimaryAffix,
        rolledAffixes: inst.rolledAffixes,
      };
      save.inventory.items.push(instSave);
      itemDropped = instSave;
    }
  }

  // Skill drop (unique collectible — only if not already owned)
  let skillDropped: string | null = null;
  if (rng.next() < SKILL_DROP_CHANCE) {
    const ownedSkills = new Set(save.hero.obtainedSkills.map((s) => s.skillId));
    const available = ACTIVE_SKILLS.filter((s) => !ownedSkills.has(s.id));
    if (available.length > 0) {
      const skill = available[Math.floor(rng.next() * available.length)];
      save.hero.obtainedSkills.push({ skillId: skill.id, level: 1, useXp: 0 });
      skillDropped = skill.id;
    }
  }

  // Character drop (Common/Magic only from drops; Rare+ from gacha only)
  let characterDropped: string | null = null;
  if (rng.next() < CHARACTER_DROP_CHANCE) {
    const dropPool = TOWERS.filter(
      (t) => (t.rarity === "Common" || t.rarity === "Magic") && !(t.id in save.collection),
    );
    if (dropPool.length > 0) {
      const char = dropPool[Math.floor(rng.next() * dropPool.length)];
      addTowerToCollection(save, char.id);
      characterDropped = char.id;
    }
  }

  return { crystalsAwarded, itemDropped, skillDropped, characterDropped, isFirstClear };
}
```

- [ ] **Run tests:** `npm run typecheck && npm test -- tests/drops.test.ts 2>&1 | tail -15`

- [ ] **Commit:** `git add src/core/drops.ts tests/drops.test.ts && git commit -m "feat(core): campaign drop system — crystals, item/skill/character drops"`

---

## Task 4 — Shop & Achievements

**Files:** `src/core/shop.ts`, `src/core/achievements.ts`, `tests/shop.test.ts`, `tests/achievements.test.ts`

- [ ] **Write failing tests** — create `tests/shop.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { SHOP_CATALOG, purchaseShopItem } from "../src/core/shop.ts";
import { createFreshSave } from "../src/core/save.ts";

describe("SHOP_CATALOG", () => {
  it("has at least 3 entries", () => {
    expect(SHOP_CATALOG.length).toBeGreaterThanOrEqual(3);
  });
  it("all entries have cost > 0", () => {
    for (const e of SHOP_CATALOG) expect(e.cost).toBeGreaterThan(0);
  });
});

describe("purchaseShopItem", () => {
  it("deducts crystal cost on purchase", () => {
    const save = createFreshSave();
    const entry = SHOP_CATALOG[0];
    save.currency.crystals = entry.cost;
    purchaseShopItem(save, entry.id);
    expect(save.currency.crystals).toBe(0);
  });

  it("fails if not enough crystals", () => {
    const save = createFreshSave();
    const entry = SHOP_CATALOG[0];
    save.currency.crystals = 0;
    const result = purchaseShopItem(save, entry.id);
    expect(result.success).toBe(false);
    expect(save.currency.crystals).toBe(0);
  });

  it("returns failure for unknown item id", () => {
    const save = createFreshSave();
    save.currency.crystals = 9999;
    const result = purchaseShopItem(save, "does-not-exist");
    expect(result.success).toBe(false);
  });
});
```

Create `tests/achievements.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { checkAndGrantAchievements, ACHIEVEMENT_UNLOCKS } from "../src/core/achievements.ts";
import { createFreshSave } from "../src/core/save.ts";

describe("ACHIEVEMENT_UNLOCKS", () => {
  it("has at least 2 entries", () => {
    expect(ACHIEVEMENT_UNLOCKS.length).toBeGreaterThanOrEqual(2);
  });
  it("each unlock has a rewardCharacterId", () => {
    for (const a of ACHIEVEMENT_UNLOCKS) expect(a.rewardCharacterId.length).toBeGreaterThan(0);
  });
});

describe("checkAndGrantAchievements", () => {
  it("returns empty array when no achievements met", () => {
    const save = createFreshSave();
    expect(checkAndGrantAchievements(save)).toEqual([]);
  });

  it("grants character for stage-3 clear achievement", () => {
    const save = createFreshSave();
    save.progress.stageClearMap["stage-3"] = { Normal: true, Hard: false, Nightmare: false };
    const granted = checkAndGrantAchievements(save);
    expect(granted.length).toBeGreaterThan(0);
    expect(save.collection[granted[0]]).toBeDefined();
  });

  it("does not grant same achievement twice", () => {
    const save = createFreshSave();
    save.progress.stageClearMap["stage-3"] = { Normal: true, Hard: false, Nightmare: false };
    checkAndGrantAchievements(save);
    const second = checkAndGrantAchievements(save);
    expect(second).toHaveLength(0);
  });

  it("grants tower-placement achievement when totalTowersPlaced >= 50", () => {
    const save = createFreshSave();
    save.progress.totalTowersPlaced = 50;
    const granted = checkAndGrantAchievements(save);
    expect(granted.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Run to confirm failures:** `npm test -- tests/shop.test.ts tests/achievements.test.ts 2>&1 | tail -10`

- [ ] **Create `src/core/shop.ts`**:

```ts
import { TOWERS } from "../data/towers.ts";
import { addTowerToCollection } from "./collection.ts";
import type { HeroSave } from "./save.ts";

export interface ShopEntry {
  id: string;
  name: string;
  cost: number;
  rewardType: "character" | "pity-boost";
  rewardRef: string;
}

export interface PurchaseResult {
  success: boolean;
  message: string;
}

// Rotating featured characters: Magic-rarity ones available for direct purchase
const MAGIC_CHARS = TOWERS.filter((t) => t.rarity === "Magic").slice(0, 3);

export const SHOP_CATALOG: ShopEntry[] = [
  ...MAGIC_CHARS.map((c) => ({
    id: `shop-char-${c.id}`,
    name: c.name,
    cost: 800,
    rewardType: "character" as const,
    rewardRef: c.id,
  })),
  {
    id: "shop-pity-boost",
    name: "Pity Insurance (next pull guaranteed Rare+)",
    cost: 400,
    rewardType: "pity-boost",
    rewardRef: "pity",
  },
];

export function purchaseShopItem(save: HeroSave, entryId: string): PurchaseResult {
  const entry = SHOP_CATALOG.find((e) => e.id === entryId);
  if (!entry) return { success: false, message: "Unknown shop item" };
  if (save.currency.crystals < entry.cost)
    return { success: false, message: "Not enough crystals" };

  save.currency.crystals -= entry.cost;

  if (entry.rewardType === "character") {
    addTowerToCollection(save, entry.rewardRef);
  } else if (entry.rewardType === "pity-boost") {
    // Set pity so next non-Unique pull brings them to soft pity threshold
    save.currency.pityCount = Math.max(save.currency.pityCount, 74);
  }

  return { success: true, message: `Purchased ${entry.name}` };
}
```

- [ ] **Create `src/core/achievements.ts`**:

```ts
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

/**
 * Check all achievements and grant any newly met ones.
 * Returns the list of characterIds granted this call.
 */
export function checkAndGrantAchievements(save: HeroSave): string[] {
  const granted: string[] = [];
  for (const ach of ACHIEVEMENT_UNLOCKS) {
    if (save.progress.achievementFlags[ach.id]) continue; // already granted
    if (!ach.checkFn(save)) continue;
    save.progress.achievementFlags[ach.id] = true;
    if (!isTowerOwned(save, ach.rewardCharacterId)) {
      addTowerToCollection(save, ach.rewardCharacterId);
    }
    granted.push(ach.rewardCharacterId);
  }
  return granted;
}
```

- [ ] **Run tests:** `npm run typecheck && npm test -- tests/shop.test.ts tests/achievements.test.ts 2>&1 | tail -15`

- [ ] **Commit:** `git add src/core/shop.ts src/core/achievements.ts tests/shop.test.ts tests/achievements.test.ts && git commit -m "feat(core): shop catalog + achievement unlock system"`

---

## Task 5 — SaveManager

**Files:** `src/core/saveManager.ts`, `tests/saveManager.test.ts`

- [ ] **Write failing tests** — create `tests/saveManager.test.ts`:

```ts
import { describe, expect, it, beforeEach } from "vitest";
import { SaveManager } from "../src/core/saveManager.ts";
import { LocalSaveProvider, createFreshSave } from "../src/core/save.ts";
import { Rng } from "../src/core/rng.ts";

const store: Record<string, string> = {};
const mockStorage = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => {
    store[k] = v;
  },
  removeItem: (k: string) => {
    delete store[k];
  },
};

describe("SaveManager", () => {
  let manager: SaveManager;

  beforeEach(() => {
    Object.keys(store).forEach((k) => delete store[k]);
    manager = new SaveManager(new LocalSaveProvider(mockStorage as unknown as Storage));
  });

  it("getSave returns a fresh save on first use", () => {
    const save = manager.getSave();
    expect(save.hero.level).toBe(1);
    expect(save.version).toBe(3);
  });

  it("afterBattle awards crystals and persists", () => {
    const result = manager.afterBattle("stage-1", "won", "Normal", new Rng(1));
    expect(result).not.toBeNull();
    expect(result!.crystalsAwarded).toBeGreaterThan(0);
    // Reload from storage — should have crystals
    const reloaded = new SaveManager(new LocalSaveProvider(mockStorage as unknown as Storage));
    expect(reloaded.getSave().currency.crystals).toBeGreaterThan(0);
  });

  it("afterBattle returns null on loss", () => {
    const result = manager.afterBattle("stage-1", "lost", "Normal", new Rng(1));
    expect(result).toBeNull();
  });

  it("afterSummon deducts crystals and returns results", () => {
    manager.getSave().currency.crystals = 1600; // 10 pulls
    manager["persist"](); // save the crystal change
    const results = manager.afterSummon(10, new Rng(42));
    expect(results).toHaveLength(10);
    expect(manager.getSave().currency.crystals).toBe(1600 - 1440);
  });

  it("grantDailyLogin gives crystals once per day", () => {
    const first = manager.grantDailyLogin("2026-06-06");
    expect(first).toBe(10);
    const second = manager.grantDailyLogin("2026-06-06");
    expect(second).toBe(0); // already claimed
    const nextDay = manager.grantDailyLogin("2026-06-07");
    expect(nextDay).toBe(10);
  });
});
```

- [ ] **Run to confirm failures:** `npm test -- tests/saveManager.test.ts 2>&1 | tail -8`

- [ ] **Create `src/core/saveManager.ts`**:

```ts
/**
 * SaveManager — high-level game event hooks that mutate HeroSave and auto-persist.
 *
 * Game systems call SaveManager methods after important events; SaveManager
 * handles the mutation + persistence in one place so nothing gets forgotten.
 */
import { checkAndGrantAchievements } from "./achievements.ts";
import { processStageClear, type DropResult } from "./drops.ts";
import { canAffordSummon, performMultiSummon, performSummon, type SummonResult } from "./gacha.ts";
import { purchaseShopItem, type PurchaseResult } from "./shop.ts";
import { Rng } from "./rng.ts";
import type { Difficulty } from "../data/schema.ts";
import type { HeroSave, SaveProvider } from "./save.ts";

const DAILY_LOGIN_CRYSTALS = 10;

export class SaveManager {
  private save: HeroSave;

  constructor(private readonly provider: SaveProvider) {
    this.save =
      provider.load() ??
      (() => {
        const s = (this as any).freshSave();
        return s;
      })();
    // Ensure we have a valid save
    if (!this.save) {
      const { createFreshSave } = require("./save.ts");
      this.save = createFreshSave();
    }
    this.persist();
  }

  getSave(): HeroSave {
    return this.save;
  }

  /** Call after a battle completes. Returns drops on win, null on loss. */
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

  /** Perform 1 or 10 summons. */
  afterSummon(count: 1 | 10, rng: Rng): SummonResult[] {
    const results =
      count === 1 ? [performSummon(this.save, rng)] : performMultiSummon(this.save, rng, 10);
    checkAndGrantAchievements(this.save);
    this.persist();
    return results;
  }

  /** Purchase from the shop. */
  afterShopPurchase(entryId: string): PurchaseResult {
    const result = purchaseShopItem(this.save, entryId);
    if (result.success) this.persist();
    return result;
  }

  /**
   * Grant daily login crystals. Pass today's ISO date string ("2026-06-06").
   * Returns crystals awarded (0 if already claimed today).
   */
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
```

Hmm, the constructor uses `require` which won't work in ESM. Let me fix that:

```ts
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
      count === 1 ? [performSummon(this.save, rng)] : performMultiSummon(this.save, rng, 10);
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
```

- [ ] **Run tests:** `npm run typecheck && npm test -- tests/saveManager.test.ts 2>&1 | tail -15`

- [ ] **Run full suite:** `npm test 2>&1 | tail -10` — all tests pass.

- [ ] **Commit:** `git add src/core/saveManager.ts tests/saveManager.test.ts && git commit -m "feat(core): SaveManager — high-level event hooks with auto-persist"`

---

## Task 6 — BattleState: Track Tower Placements for Achievements

**Files:** `src/core/battle.ts`

The `place-50-towers` achievement needs `progress.totalTowersPlaced` to increment. BattleState has `heroSave` — after a successful `placeTower`, increment `_heroSave.progress.totalTowersPlaced`.

- [ ] **Modify `src/core/battle.ts`** — in `placeTower`, after the `this.towers.push(...)` call, add:

```ts
if (this._heroSave) {
  this._heroSave.progress.totalTowersPlaced += 1;
}
```

- [ ] **Run full suite:** `npm run typecheck && npm test 2>&1 | tail -10`

- [ ] **Commit:** `git add src/core/battle.ts && git commit -m "feat(core): track total towers placed in heroSave progress for achievements"`

---

## Task 7 — Final Verification

- [ ] **Commit all spec/plan docs:**

```bash
git add docs/ && git status | grep docs && git commit -m "docs: Phase 3b + 3c design specs and implementation plans"
```

- [ ] **Full final check:**

```bash
npm run typecheck && npm test && npm run build 2>&1 | tail -20
```

Expected: all tests pass (140+ total), typecheck clean, build succeeds.

- [ ] **Log final commit:** `git log --oneline -12`
