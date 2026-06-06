# Phase 3b — Tower Collection Design

**Date:** 2026-06-06
**Status:** Approved (autonomous — user delegated full Phase 3)
**Scope:** Tower leveling, star ranks, collection save state, BattleState wiring for tower stat pipeline

---

## Design Decisions (autonomous)

### Tower Level
Tower level **automatically equals the hero's current level** — no separate XP grind per tower. This is the simplest model and avoids the "bench penalty" where players avoid using new towers because they need to be leveled. The `towerStatPipeline(base, heroLevel, stars)` already accepts a level; we just pass `heroSave.hero.level`.

### Star Ranks
- Range: **1–5 stars** (1 = base acquisition, 5 = fully maxed)
- First copy acquired = 1 star
- Each duplicate adds 1 star (4 dupes total to max out)
- Star stat bonus: **+8% increased% to all stats per star** (already implemented in `towerStatPipeline`)
- At 5 stars: +40% to all stats over the 1-star baseline — meaningful but not game-breaking

### Collection State
A tower is "owned" the moment it enters the collection. Not every tower in the catalog is available — players must acquire them via gacha/drops (Phase 3c). The collection tracks:
```ts
interface TowerCollectionEntry { stars: number }  // 1..5
type TowerCollection = Record<string, TowerCollectionEntry>  // keyed by characterId
```

### Save Schema — Version 2
Phase 3b adds `collection` to `HeroSave`. The migration v1→v2 adds an empty collection.

### BattleState Integration
`placeTower` currently copies `def.baseStats` directly. With Phase 3b, it must:
1. Look up the tower in `heroSave.collection` to get its star rank
2. Call `towerStatPipeline(def.baseStats, heroLevel, stars)`
3. Use the resolved stats

If `heroSave` is absent (tests / Phase 1 mode): use level 1, 0 stars (same as before, +0% bonus, level 1 scaling → no change since `towerStatPipeline(base, 1, 0)` returns base).

**Wait — 0 stars means the tower isn't in the collection.** Decision: if a tower is placed but NOT in the collection (possible in test fixtures), treat it as 1 star (owned, not duped). 0 stars means unowned and cannot be placed.

Actually: tests use `placeTower` directly with mock towers that bypass the collection check. To avoid breaking all tests, the logic is:
- If `heroSave` present and tower IS in collection → use collection stars
- If `heroSave` present and tower NOT in collection → **reject placement** (can't place unowned towers)
- If `heroSave` absent → use level=1, stars=1 (backwards compat, tests pass)

---

## Data Model

### New types in `src/data/schema.ts`
```ts
export interface TowerCollectionEntry {
  stars: number;  // 1..5
}
```

### HeroSave v2 (in `src/core/save.ts`)
```ts
export interface HeroSave {
  version: number;           // now 2
  heroId: string;
  hero: HeroProgressSave;
  inventory: InventorySave;
  collection: TowerCollection;   // NEW
  lastSavedAt: number;
}
export type TowerCollection = Record<string, TowerCollectionEntry>;
```

---

## New Functions in `src/core/collection.ts`

```ts
// Add a tower to collection (first copy = 1 star)
addTowerToCollection(save: HeroSave, towerId: string): void

// Add a duplicate (increments stars up to 5)
addTowerDupe(save: HeroSave, towerId: string): void

// Check if owned
isTowerOwned(save: HeroSave, towerId: string): boolean

// Get stars (0 if not owned)
getTowerStars(save: HeroSave, towerId: string): number
```

---

## BattleState Changes

`placeTower(characterId, slotIndex)` gains two new behaviours:
1. If `heroSave` present: check `isTowerOwned` → reject if not owned
2. Resolve stats via `towerStatPipeline(def.baseStats, heroLevel, stars)`

The `TowerRuntime.stats` is now the pipeline-resolved value instead of raw `def.baseStats`.

---

## Migration v1 → v2

```ts
function migrate_v1_to_v2(save: HeroSave): HeroSave {
  return { ...save, collection: {}, version: 2 };
}
```

---

## What Phase 3b Does NOT Include
- UI for browsing the collection (Phase 4)
- How towers are acquired — gacha, drops, shop (Phase 3c)
- Duplicate handling beyond star increment (Phase 3c designs the acquisition flow)
