# Phase 3b — Tower Collection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist tower ownership (collection) and star ranks in the save, apply star+level scaling to towers placed in battle via the existing `towerStatPipeline`.

**Architecture:** New `src/core/collection.ts` for pure collection-mutation helpers. `HeroSave` gains a `collection` field (save v2 migration). `BattleState.placeTower` checks ownership and resolves tower stats via the pipeline when `heroSave` is present.

**Tech Stack:** TypeScript, Vitest. No new deps. `npm test` / `npm run typecheck` / `npm run build`.

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Modify | `src/data/schema.ts` | Add `TowerCollectionEntry` interface |
| Modify | `src/core/save.ts` | Add `TowerCollection` type + `collection` field to `HeroSave`; bump to v2; add v1→v2 migration |
| Create | `src/core/collection.ts` | `addTowerToCollection`, `addTowerDupe`, `isTowerOwned`, `getTowerStars` |
| Modify | `src/core/battle.ts` | `placeTower`: ownership check + pipeline-resolved stats |
| Create | `tests/collection.test.ts` | Unit tests for all collection helpers |
| Create | `tests/phase3b.test.ts` | Integration: stars boost stats in battle, unowned tower rejected |

---

## Task 1 — Schema + Save v2

**Files:** `src/data/schema.ts`, `src/core/save.ts`, `tests/save-v2.test.ts`

- [ ] **Write failing tests** — create `tests/save-v2.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createFreshSave, loadAndMigrate, CURRENT_SAVE_VERSION } from "../src/core/save.ts";
import type { TowerCollection } from "../src/core/save.ts";

describe("HeroSave v2 — collection field", () => {
  it("createFreshSave has empty collection", () => {
    const save = createFreshSave();
    expect(save.collection).toBeDefined();
    expect(Object.keys(save.collection)).toHaveLength(0);
  });

  it("CURRENT_SAVE_VERSION is 2", () => {
    expect(CURRENT_SAVE_VERSION).toBe(2);
  });

  it("migrate v1 (no collection) → v2 adds empty collection", () => {
    const v1: any = {
      version: 1,
      heroId: "h1",
      hero: { level: 5, totalXp: 1000, skillPoints: 4, unlockedNodes: [], obtainedSkills: [], equippedSkillId: null },
      inventory: { items: [], equipped: {} },
      lastSavedAt: 0,
    };
    const migrated = loadAndMigrate(v1);
    expect(migrated.version).toBe(2);
    expect(migrated.collection).toEqual({});
    expect(migrated.hero.level).toBe(5); // existing data preserved
  });
});
```

- [ ] **Run to confirm failures:** `npm test -- tests/save-v2.test.ts 2>&1 | tail -8`

- [ ] **Add `TowerCollectionEntry` to `src/data/schema.ts`** (after `PetUtility`):

```ts
/** One owned tower entry in the hero's collection. */
export interface TowerCollectionEntry {
  /** Star rank 1–5. 1 = first copy; each duplicate adds 1 star up to 5. */
  stars: number;
}
```

- [ ] **Update `src/core/save.ts`**:

Change `CURRENT_SAVE_VERSION` from `1` to `2`.

Add `TowerCollection` type and `collection` field:

```ts
import type { TowerCollectionEntry } from "../data/schema.ts";

export type TowerCollection = Record<string, TowerCollectionEntry>;
```

Add `collection: TowerCollection` to `HeroSave`:
```ts
export interface HeroSave {
  version: number;
  heroId: string;
  hero: HeroProgressSave;
  inventory: InventorySave;
  collection: TowerCollection;   // NEW
  lastSavedAt: number;
}
```

Add `collection: {}` to `createFreshSave()`.

Add migration in `loadAndMigrate`:
```ts
export function loadAndMigrate(raw: unknown): HeroSave {
  if (!raw || typeof raw !== "object") return createFreshSave();
  let save = raw as HeroSave;
  if ((save.version ?? 0) < 2) save = { ...save, collection: {}, version: 2 };
  save.version = CURRENT_SAVE_VERSION;
  return save;
}
```

- [ ] **Run tests:** `npm run typecheck && npm test -- tests/save-v2.test.ts 2>&1 | tail -10`
  Expected: 3 tests pass.

- [ ] **Run full suite:** `npm test 2>&1 | tail -8` — all 135+ tests still pass.

- [ ] **Commit:** `git add src/data/schema.ts src/core/save.ts tests/save-v2.test.ts && git commit -m "feat(schema): TowerCollectionEntry + HeroSave v2 with collection field"`

---

## Task 2 — Collection Helpers

**Files:** `src/core/collection.ts`, `tests/collection.test.ts`

- [ ] **Write failing tests** — create `tests/collection.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  addTowerToCollection,
  addTowerDupe,
  isTowerOwned,
  getTowerStars,
} from "../src/core/collection.ts";
import { createFreshSave } from "../src/core/save.ts";

describe("collection helpers", () => {
  it("isTowerOwned returns false for unowned tower", () => {
    const save = createFreshSave();
    expect(isTowerOwned(save, "zoran-thricedraw")).toBe(false);
  });

  it("addTowerToCollection sets stars to 1", () => {
    const save = createFreshSave();
    addTowerToCollection(save, "zoran-thricedraw");
    expect(isTowerOwned(save, "zoran-thricedraw")).toBe(true);
    expect(getTowerStars(save, "zoran-thricedraw")).toBe(1);
  });

  it("addTowerToCollection on already-owned tower acts as dupe (adds star)", () => {
    const save = createFreshSave();
    addTowerToCollection(save, "zoran-thricedraw");
    addTowerToCollection(save, "zoran-thricedraw"); // second copy
    expect(getTowerStars(save, "zoran-thricedraw")).toBe(2);
  });

  it("addTowerDupe increments stars up to 5", () => {
    const save = createFreshSave();
    addTowerToCollection(save, "t");
    expect(getTowerStars(save, "t")).toBe(1);
    addTowerDupe(save, "t");
    expect(getTowerStars(save, "t")).toBe(2);
    addTowerDupe(save, "t");
    addTowerDupe(save, "t");
    addTowerDupe(save, "t");
    expect(getTowerStars(save, "t")).toBe(5);
  });

  it("addTowerDupe caps at 5 stars", () => {
    const save = createFreshSave();
    addTowerToCollection(save, "t");
    for (let i = 0; i < 10; i++) addTowerDupe(save, "t");
    expect(getTowerStars(save, "t")).toBe(5);
  });

  it("getTowerStars returns 0 for unowned tower", () => {
    const save = createFreshSave();
    expect(getTowerStars(save, "unknown")).toBe(0);
  });

  it("multiple towers tracked independently", () => {
    const save = createFreshSave();
    addTowerToCollection(save, "a");
    addTowerToCollection(save, "b");
    addTowerDupe(save, "a");
    expect(getTowerStars(save, "a")).toBe(2);
    expect(getTowerStars(save, "b")).toBe(1);
  });
});
```

- [ ] **Run to confirm failures:** `npm test -- tests/collection.test.ts 2>&1 | tail -8`

- [ ] **Create `src/core/collection.ts`**:

```ts
/**
 * Tower collection helpers — Phase 3b.
 *
 * Pure save-mutating functions. No side effects beyond the HeroSave parameter.
 */
import type { HeroSave } from "./save.ts";

export const MAX_STARS = 5;

/**
 * Add a tower to the collection. If it's the first copy, sets stars to 1.
 * If already owned, increments stars (same as addTowerDupe).
 */
export function addTowerToCollection(save: HeroSave, towerId: string): void {
  if (save.collection[towerId]) {
    addTowerDupe(save, towerId);
  } else {
    save.collection[towerId] = { stars: 1 };
  }
}

/** Increment star rank by 1 (cap: MAX_STARS). No-op if tower not owned. */
export function addTowerDupe(save: HeroSave, towerId: string): void {
  const entry = save.collection[towerId];
  if (!entry) return;
  entry.stars = Math.min(entry.stars + 1, MAX_STARS);
}

/** Returns true if the tower is in the collection. */
export function isTowerOwned(save: HeroSave, towerId: string): boolean {
  return towerId in save.collection;
}

/** Returns star rank (1–5), or 0 if not owned. */
export function getTowerStars(save: HeroSave, towerId: string): number {
  return save.collection[towerId]?.stars ?? 0;
}
```

- [ ] **Run tests:** `npm run typecheck && npm test -- tests/collection.test.ts 2>&1 | tail -10`
  Expected: all 7 tests pass.

- [ ] **Commit:** `git add src/core/collection.ts tests/collection.test.ts && git commit -m "feat(core): tower collection helpers — add, dupe, star rank (1-5)"`

---

## Task 3 — Wire BattleState + Integration Tests

**Files:** `src/core/battle.ts`, `tests/phase3b.test.ts`

- [ ] **Write failing tests** — create `tests/phase3b.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { BattleState } from "../src/core/battle.ts";
import { makeStats } from "../src/data/schema.ts";
import { createFreshSave } from "../src/core/save.ts";
import { addTowerToCollection, addTowerDupe } from "../src/core/collection.ts";
import { mkEnemy, mkStage, mkTower, oneWave, runUntilDone } from "./fixtures.ts";

const baseStats = makeStats({ atk: 500, maxHp: 1000, attackSpeed: 2, range: 400 });
const heroStart = { stats: baseStats, startPos: { x: 200, y: -50 } };

function makeWorld(heroSave = createFreshSave()) {
  const stage = mkStage(oneWave("grunt", 3));
  const catalog = {
    enemies: new Map([["grunt", mkEnemy()]]),
    characters: new Map([["turret", mkTower()]]),
  };
  return new BattleState(stage, catalog, { hero: heroStart, heroSave });
}

describe("BattleState tower collection — Phase 3b", () => {
  it("places tower when owned in collection", () => {
    const save = createFreshSave();
    addTowerToCollection(save, "turret");
    const b = makeWorld(save);
    expect(b.placeTower("turret", 0)).toBe(true);
  });

  it("rejects tower placement when not in collection", () => {
    const save = createFreshSave(); // turret NOT in collection
    const b = makeWorld(save);
    expect(b.placeTower("turret", 0)).toBe(false);
  });

  it("5-star tower has higher stats than 1-star tower", () => {
    const save1 = createFreshSave();
    addTowerToCollection(save1, "turret"); // 1 star

    const save5 = createFreshSave();
    addTowerToCollection(save5, "turret");
    for (let i = 0; i < 4; i++) addTowerDupe(save5, "turret"); // 5 stars

    const b1 = makeWorld(save1);
    b1.placeTower("turret", 0);
    const tower1 = b1.towers[0];

    const b5 = makeWorld(save5);
    b5.placeTower("turret", 0);
    const tower5 = b5.towers[0];

    expect(tower5.stats.atk).toBeGreaterThan(tower1.stats.atk);
    expect(tower5.hp).toBeGreaterThan(tower1.hp);
  });

  it("tower stats scale with hero level", () => {
    const saveLvl1 = createFreshSave();
    addTowerToCollection(saveLvl1, "turret");

    const saveLvl20 = createFreshSave();
    saveLvl20.hero.level = 20;
    addTowerToCollection(saveLvl20, "turret");

    const b1 = makeWorld(saveLvl1);
    b1.placeTower("turret", 0);

    const b20 = makeWorld(saveLvl20);
    b20.placeTower("turret", 0);

    expect(b20.towers[0].stats.atk).toBeGreaterThan(b1.towers[0].stats.atk);
  });

  it("no heroSave — placeTower works as before (backwards compat)", () => {
    const stage = mkStage(oneWave("grunt", 3));
    const catalog = {
      enemies: new Map([["grunt", mkEnemy()]]),
      characters: new Map([["turret", mkTower()]]),
    };
    const b = new BattleState(stage, catalog, { hero: heroStart });
    expect(b.placeTower("turret", 0)).toBe(true); // no collection check
    runUntilDone(b);
    expect(b.outcome).toBe("won");
  });
});
```

- [ ] **Run to confirm failures:** `npm test -- tests/phase3b.test.ts 2>&1 | tail -10`

- [ ] **Modify `src/core/battle.ts`**:

Add import:
```ts
import { isTowerOwned, getTowerStars } from "./collection.ts";
import { towerStatPipeline } from "./stats.ts";
```

In `placeTower`, change the tower stat initialization and add ownership check. Find:
```ts
    this.gold -= def.cost;
    this.towers.push({
      uid: this.nextUid++,
      def,
      stats: { ...def.baseStats },
```

Replace with:
```ts
    // Ownership check when heroSave is present
    if (this._heroSave && !isTowerOwned(this._heroSave, characterId)) return false;

    this.gold -= def.cost;
    const towerLevel = this._heroSave?.hero.level ?? 1;
    const towerStars = this._heroSave ? getTowerStars(this._heroSave, characterId) : 1;
    const resolvedStats = towerStatPipeline(def.baseStats, towerLevel, towerStars);
    this.towers.push({
      uid: this.nextUid++,
      def,
      stats: resolvedStats,
```

Also store `heroSave` as a private field. Add to the class body:
```ts
  private _heroSave: import("./save.ts").HeroSave | undefined;
```

In the constructor, after `if (opts.heroSave) { ... }`, add:
```ts
    this._heroSave = opts.heroSave;
```

Also update `TowerRuntime` hp initialization to use `resolvedStats`:
Find `hp: def.baseStats.maxHp,` (inside towers.push) and change to `hp: resolvedStats.maxHp,`.

- [ ] **Run full suite:** `npm run typecheck && npm test 2>&1 | tail -15`
  Expected: all tests pass (135+ original + 5 new = 140+).

- [ ] **Commit:** `git add src/core/battle.ts tests/phase3b.test.ts && git commit -m "feat(core): tower collection wired into BattleState — ownership check + star/level scaling"`

---

## Task 4 — Commit Specs + Full Verification

- [ ] **Commit specs:** `git add docs/superpowers/specs/ && git commit -m "docs: Phase 3b + 3c design specs"`

- [ ] **Final verification:** `npm run typecheck && npm test && npm run build 2>&1 | tail -12`
  Expected: all tests pass, build succeeds.
