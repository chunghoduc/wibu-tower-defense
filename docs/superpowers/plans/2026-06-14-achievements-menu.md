# Achievements Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give achievements a dedicated, visible menu reachable from the home screen, and grow the catalog from 2 to 20 achievements across five categories — while preserving the existing silent auto-grant of rewards.

**Architecture:** Pure data catalog (`data/achievements.ts`) + pure logic (`core/achievements.ts`, reworked to drive off a `progress()` function and a generalized reward) + pure view-model (`core/achievementView.ts`) + a thin Phaser presenter (`scenes/AchievementScene.ts`). A 🏆 nav tile on the home bottom dock opens it. Rewards still auto-grant the instant a condition is met (the 5 existing `checkAndGrantAchievements` call sites are untouched); the scene is a progress *tracker*.

**Tech Stack:** TypeScript, Phaser 3, Vitest. UI space 960×540. Pure-core / Phaser-presenter split (cf. `data/quests.ts`+`core/questTracker.ts`, `core/forgeStations.ts`+`scenes/forgeRecipeDialog.ts`).

---

## Background the engineer needs

- **Save fields available to `progress()` (all verified to exist):**
  - `save.hero.level` — hero level.
  - `save.meta.profile.lifetimeKills` — cumulative kills.
  - `save.meta.endless.bestWave` — `Record<stageId, number>`; best = `Math.max(0, ...Object.values(...))`.
  - `save.progress.totalTowersPlaced` — cumulative towers placed.
  - `save.progress.stageClearMap[id]` — `{ Normal, Hard, Nightmare }` booleans (may be undefined).
  - `Object.keys(save.collection).length` — number of owned heroes.
  - `collectionPct(save)` — fraction 0..1 of the codex discovered (from `src/core/collection.ts`).
- **Reward funnel:** `grantReward(save, reward)` in `src/core/rewards.ts` applies `{ gold?, diamonds?, materials? }`. Tower rewards use `addTowerToCollection(save, id)` + `isTowerOwned(save, id)` from `src/core/collection.ts`.
- **Material ids** (string consts in `src/data/materials.ts`): `AWAKENING_CRYSTAL`, `JEWEL_OF_CHAOS`, `FEATHER`.
- **Existing achievement state:** `save.progress.achievementFlags: Record<string, boolean>` — "this achievement's reward has been granted". Already initialized/backfilled everywhere; additive, no migration needed.
- **`checkAndGrantAchievements(save): string[]`** is called from 5 sites in `src/core/saveManagerCore.ts` (lines ~125, 133, 386, 404, 432). **Keep its signature returning `string[]`** so those sites are unaffected.
- **Scene conventions:** see `src/scenes/QuestScene.ts` (2-col card grid, progress bars, back button, toast) and `src/scenes/ActivitiesScene.ts` (scrollable `layer` + mouse-wheel clamp).
- **Run commands:** tests `npx vitest run <file>`; full `npx vitest run`; types `npx tsc --noEmit`; lint `npm run lint`; build `npm run build`.

---

## File Structure

- **Create `src/data/achievements.ts`** — `AchievementCategory`, `AchievementReward`, `AchievementDef`, `CATEGORY_ORDER`, `ACHIEVEMENTS` (20), `achievementRewardLabel()`. Pure, no Phaser.
- **Modify `src/core/achievements.ts`** — rework `checkAndGrantAchievements` to drive off `ACHIEVEMENTS`/`progress()` + generalized reward; re-export catalog symbols.
- **Create `src/core/achievementView.ts`** — `AchievementCardVM`, `AchievementGroupVM`, `buildAchievementView(save)`. Pure.
- **Create `src/scenes/AchievementScene.ts`** — the presenter.
- **Modify `src/main.ts`** — register the scene.
- **Modify `src/scenes/MainMenuScene.ts`** — add the nav tile + trophy glyph.
- **Modify `tests/achievements.test.ts`** — update to the new model.
- **Create `tests/achievementView.test.ts`** — view-model tests.

---

## Task 1: Pure achievement catalog (`data/achievements.ts`)

**Files:**
- Create: `src/data/achievements.ts`
- Test: `tests/achievementCatalog.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/achievementCatalog.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  ACHIEVEMENTS,
  CATEGORY_ORDER,
  achievementRewardLabel,
} from "../src/data/achievements.ts";
import { isEmptyReward } from "../src/core/rewards.ts";
import { createFreshSave } from "../src/core/save.ts";

describe("ACHIEVEMENTS catalog", () => {
  it("has 20 achievements", () => {
    expect(ACHIEVEMENTS).toHaveLength(20);
  });

  it("has unique ids", () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every achievement is well-formed", () => {
    const save = createFreshSave();
    for (const a of ACHIEVEMENTS) {
      expect(a.name.length).toBeGreaterThan(0);
      expect(a.description.length).toBeGreaterThan(0);
      expect(CATEGORY_ORDER).toContain(a.category);
      const p = a.progress(save);
      expect(p.target).toBeGreaterThan(0);
      expect(p.current).toBeGreaterThanOrEqual(0);
      // a reward must give something: a bundle or a tower.
      expect(isEmptyReward(a.reward) && !a.reward.characterId).toBe(false);
    }
  });

  it("preserves the two legacy tower achievements", () => {
    const legacy = ACHIEVEMENTS.filter((a) => a.reward.characterId);
    expect(legacy.map((a) => a.id).sort()).toEqual(
      ["clear-stage-3", "place-50-towers"].sort(),
    );
  });

  it("progress reflects save state for place-50-towers", () => {
    const save = createFreshSave();
    save.progress.totalTowersPlaced = 30;
    const def = ACHIEVEMENTS.find((a) => a.id === "place-50-towers")!;
    expect(def.progress(save)).toEqual({ current: 30, target: 50 });
  });

  it("achievementRewardLabel renders tower and bundle rewards", () => {
    expect(achievementRewardLabel({ characterId: "tobi-skipstone" })).toContain("Hero");
    expect(achievementRewardLabel({ gold: 500 })).toContain("500");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/achievementCatalog.test.ts`
Expected: FAIL — cannot resolve `../src/data/achievements.ts`.

- [ ] **Step 3: Create the catalog**

Create `src/data/achievements.ts`:

```ts
/**
 * Achievement catalog — pure data + progress functions. Each achievement is a
 * goal with a live progress(save) reading existing save fields, plus a reward
 * (a gold/diamonds/materials bundle and/or a reward hero). The two legacy
 * achievements keep their character reward; the rest grant resource bundles.
 * Logic (grant/unlock) lives in core/achievements.ts; UI in AchievementScene.
 */
import type { Reward } from "../core/rewards.ts";
import type { HeroSave } from "../core/save.ts";
import { collectionPct } from "../core/collection.ts";
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
```

> **Note:** verify `collectionPct` is exported from `src/core/collection.ts` (it is imported there by `src/core/profile.ts`). If it lives elsewhere, fix the import path and the test's expectation accordingly.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/achievementCatalog.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/data/achievements.ts tests/achievementCatalog.test.ts
git commit -m "feat(achievements): pure 20-entry catalog with progress + rewards

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Rework grant logic (`core/achievements.ts`)

**Files:**
- Modify: `src/core/achievements.ts` (replace contents)
- Test: `tests/achievements.test.ts` (rewrite)

- [ ] **Step 1: Rewrite the failing test**

Replace `tests/achievements.test.ts` with:

```ts
import { describe, expect, it } from "vitest";
import { checkAndGrantAchievements } from "../src/core/achievements.ts";
import { ACHIEVEMENTS } from "../src/data/achievements.ts";
import { createFreshSave } from "../src/core/save.ts";

describe("checkAndGrantAchievements", () => {
  it("returns empty when no achievements met", () => {
    expect(checkAndGrantAchievements(createFreshSave())).toEqual([]);
  });

  it("grants the legacy tower for a stage-3 clear", () => {
    const save = createFreshSave();
    save.progress.stageClearMap["stage-3"] = { Normal: true, Hard: false, Nightmare: false };
    const granted = checkAndGrantAchievements(save);
    expect(granted.length).toBeGreaterThan(0);
    expect(save.collection["tobi-skipstone"]).toBeDefined();
    expect(save.progress.achievementFlags["clear-stage-3"]).toBe(true);
  });

  it("does not grant the same achievement twice", () => {
    const save = createFreshSave();
    save.progress.totalTowersPlaced = 50;
    checkAndGrantAchievements(save);
    expect(checkAndGrantAchievements(save)).toHaveLength(0);
  });

  it("grants a resource bundle achievement and applies the reward", () => {
    const save = createFreshSave();
    const goldBefore = save.currency.gold;
    save.hero.level = 10; // unlocks hero-level-10 → +2000 gold
    const granted = checkAndGrantAchievements(save);
    expect(granted.length).toBeGreaterThan(0);
    expect(save.currency.gold).toBe(goldBefore + 2000);
    expect(save.progress.achievementFlags["hero-level-10"]).toBe(true);
  });

  it("covers every catalog id with a flag once unlocked", () => {
    // Force every achievement to its target, then grant all.
    const save = createFreshSave();
    save.hero.level = 50;
    save.meta.profile.lifetimeKills = 100000;
    save.meta.endless.bestWave["endless"] = 50;
    save.progress.totalTowersPlaced = 5000;
    for (const id of ["stage-3", "stage-10", "stage-20"]) {
      save.progress.stageClearMap[id] = { Normal: true, Hard: false, Nightmare: true };
    }
    checkAndGrantAchievements(save);
    // Collection/codex achievements may not all be reachable from a fresh save;
    // assert at least the deterministic ones flagged.
    for (const id of [
      "clear-stage-3",
      "hero-level-50",
      "kills-100000",
      "endless-wave-50",
      "place-5000-towers",
      "win-nightmare",
    ]) {
      expect(save.progress.achievementFlags[id]).toBe(true);
    }
    expect(ACHIEVEMENTS.length).toBe(20);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/achievements.test.ts`
Expected: FAIL — old `core/achievements.ts` still exports the old model / grant logic doesn't apply bundles.

- [ ] **Step 3: Replace the logic module**

Replace the entire contents of `src/core/achievements.ts` with:

```ts
/**
 * Achievement grant logic. Achievements auto-grant their reward the instant
 * their condition is met (progress.current >= target). State lives in
 * save.progress.achievementFlags. The catalog + progress functions live in
 * data/achievements.ts; the AchievementScene reads progress for display.
 */
import { addTowerToCollection, isTowerOwned } from "./collection.ts";
import { grantReward } from "./rewards.ts";
import type { HeroSave } from "./save.ts";
import { ACHIEVEMENTS, type AchievementDef } from "../data/achievements.ts";

export type { AchievementDef } from "../data/achievements.ts";
export { ACHIEVEMENTS } from "../data/achievements.ts";

/** True if this achievement's condition is currently satisfied. */
export function isAchievementUnlocked(def: AchievementDef, save: HeroSave): boolean {
  const p = def.progress(save);
  return p.current >= p.target;
}

/**
 * Grant every newly-satisfied achievement: flag it, grant its reward bundle and
 * (if any) its reward hero. Returns the reward labels granted this call (used by
 * the SaveManager call sites for celebration); empty when nothing new unlocked.
 */
export function checkAndGrantAchievements(save: HeroSave): string[] {
  const granted: string[] = [];
  for (const def of ACHIEVEMENTS) {
    if (save.progress.achievementFlags[def.id]) continue;
    if (!isAchievementUnlocked(def, save)) continue;
    save.progress.achievementFlags[def.id] = true;
    grantReward(save, def.reward);
    if (def.reward.characterId && !isTowerOwned(save, def.reward.characterId)) {
      addTowerToCollection(save, def.reward.characterId);
    }
    granted.push(def.reward.characterId ?? def.name);
  }
  return granted;
}
```

> **Note:** `grantReward` ignores unknown keys (`characterId`), so passing the
> whole `AchievementReward` is safe — it only applies gold/diamonds/materials.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/achievements.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the full suite to catch import-break fallout**

Run: `npx vitest run` then `npx tsc --noEmit`
Expected: PASS. If anything imported the removed `ACHIEVEMENT_UNLOCKS` symbol, repoint it to `ACHIEVEMENTS` (only `saveManagerCore.ts` imports `checkAndGrantAchievements`, which is unchanged; the old `ACHIEVEMENT_UNLOCKS` was only referenced by the rewritten test).

- [ ] **Step 6: Commit**

```bash
git add src/core/achievements.ts tests/achievements.test.ts
git commit -m "feat(achievements): grant logic drives off catalog + generic rewards

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Pure view-model (`core/achievementView.ts`)

**Files:**
- Create: `src/core/achievementView.ts`
- Test: `tests/achievementView.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/achievementView.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildAchievementView } from "../src/core/achievementView.ts";
import { ACHIEVEMENTS, CATEGORY_ORDER } from "../src/data/achievements.ts";
import { createFreshSave } from "../src/core/save.ts";

describe("buildAchievementView", () => {
  it("covers every achievement exactly once across groups", () => {
    const view = buildAchievementView(createFreshSave());
    const cards = view.groups.flatMap((g) => g.cards);
    expect(cards).toHaveLength(ACHIEVEMENTS.length);
    expect(new Set(cards.map((c) => c.id)).size).toBe(ACHIEVEMENTS.length);
  });

  it("orders groups by CATEGORY_ORDER and omits empty categories", () => {
    const view = buildAchievementView(createFreshSave());
    const order = view.groups.map((g) => g.category);
    // every present group respects the canonical order
    const expected = CATEGORY_ORDER.filter((c) => order.includes(c));
    expect(order).toEqual(expected);
  });

  it("derives unlocked + clamps frac to 0..1", () => {
    const save = createFreshSave();
    save.progress.totalTowersPlaced = 75; // place-50 done (75>50), place-500 partial
    const view = buildAchievementView(save);
    const cards = view.groups.flatMap((g) => g.cards);
    const done = cards.find((c) => c.id === "place-50-towers")!;
    const partial = cards.find((c) => c.id === "place-500-towers")!;
    expect(done.unlocked).toBe(true);
    expect(done.frac).toBe(1); // clamped even though current > target
    expect(partial.unlocked).toBe(false);
    expect(partial.frac).toBeCloseTo(75 / 500, 5);
  });

  it("counts unlocked totals", () => {
    const save = createFreshSave();
    save.hero.level = 10; // unlocks hero-level-10 only among hero tier
    const view = buildAchievementView(save);
    expect(view.total).toBe(ACHIEVEMENTS.length);
    expect(view.unlocked).toBeGreaterThanOrEqual(1);
    expect(view.unlocked).toBeLessThan(view.total);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/achievementView.test.ts`
Expected: FAIL — cannot resolve `../src/core/achievementView.ts`.

- [ ] **Step 3: Create the view-model**

Create `src/core/achievementView.ts`:

```ts
/**
 * Pure view-model for the AchievementScene: groups the catalog by category (in
 * CATEGORY_ORDER), computes per-card progress/unlocked/frac, and totals. The
 * scene consumes this and never recomputes progress. Phaser-free + unit-tested.
 */
import type { HeroSave } from "./save.ts";
import { isAchievementUnlocked } from "./achievements.ts";
import {
  ACHIEVEMENTS,
  CATEGORY_ORDER,
  achievementRewardLabel,
  type AchievementCategory,
  type AchievementDef,
} from "../data/achievements.ts";

export interface AchievementCardVM {
  id: string;
  name: string;
  description: string;
  rewardLabel: string;
  current: number;
  target: number;
  /** Progress fraction, clamped to 0..1. */
  frac: number;
  unlocked: boolean;
}

export interface AchievementGroupVM {
  category: AchievementCategory;
  cards: AchievementCardVM[];
}

export interface AchievementViewVM {
  groups: AchievementGroupVM[];
  unlocked: number;
  total: number;
}

function cardOf(def: AchievementDef, save: HeroSave): AchievementCardVM {
  const { current, target } = def.progress(save);
  const unlocked = isAchievementUnlocked(def, save);
  const frac = target <= 0 ? 0 : Math.max(0, Math.min(1, current / target));
  return {
    id: def.id,
    name: def.name,
    description: def.description,
    rewardLabel: achievementRewardLabel(def.reward),
    current,
    target,
    frac,
    unlocked,
  };
}

export function buildAchievementView(save: HeroSave): AchievementViewVM {
  const groups: AchievementGroupVM[] = [];
  let unlocked = 0;
  for (const category of CATEGORY_ORDER) {
    const cards = ACHIEVEMENTS.filter((a) => a.category === category).map((a) =>
      cardOf(a, save),
    );
    if (cards.length === 0) continue;
    unlocked += cards.filter((c) => c.unlocked).length;
    groups.push({ category, cards });
  }
  return { groups, unlocked, total: ACHIEVEMENTS.length };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/achievementView.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/achievementView.ts tests/achievementView.test.ts
git commit -m "feat(achievements): pure category-grouped view-model

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: AchievementScene presenter

**Files:**
- Create: `src/scenes/AchievementScene.ts`

There is no unit test for the Phaser presenter (consistent with QuestScene); it is
covered by `tsc`, the build, and the live playtest in Task 6. Keep it under 500
lines (it will be ~180).

- [ ] **Step 1: Create the scene**

Create `src/scenes/AchievementScene.ts`:

```ts
/**
 * AchievementScene — the dedicated achievements board. Shows every achievement
 * grouped by category with a live progress bar, its reward, and an unlocked /
 * in-progress status, plus a header summary (N / M unlocked). Rewards auto-grant
 * elsewhere (core/achievements.ts); this scene is a tracker. Scrolls vertically.
 */
import Phaser from "phaser";
import { fadeIn, fadeToScene } from "./uiKit.ts";
import { crispText } from "./ui.ts";
import type { SaveManager } from "../core/saveManager.ts";
import {
  buildAchievementView,
  type AchievementCardVM,
  type AchievementGroupVM,
} from "../core/achievementView.ts";

const W = 960;
const COLS = 2;
const CW = 452;
const CH = 92;
const X0 = 20;
const GAP_X = 16;
const GAP_Y = 10;
const VIEW_H = 460; // visible content height below the header

export class AchievementScene extends Phaser.Scene {
  private mgr!: SaveManager;
  private layer!: Phaser.GameObjects.Container;
  private scrollY = 0;
  private contentH = 0;

  constructor() {
    super("AchievementScene");
  }

  create(): void {
    fadeIn(this);
    this.scrollY = 0;
    this.contentH = 0; // reset on re-entry (Phaser reuses instances)
    this.mgr = this.registry.get("saveManager");

    crispText(this, W / 2, 10, "🏆 Achievements", {
      fontSize: "24px",
      color: "#ffd700",
      fontStyle: "bold",
    })
      .setOrigin(0.5, 0)
      .setDepth(50);
    crispText(this, 20, 12, "← Back", { fontSize: "15px", color: "#90caf9" })
      .setDepth(50)
      .setInteractive({ useHandCursor: true })
      .on("pointerup", () => fadeToScene(this, "MainMenuScene"));

    this.layer = this.add.container(0, 0);
    this.input.on("wheel", (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      this.scrollY = Phaser.Math.Clamp(
        this.scrollY - dy * 0.5,
        Math.min(0, -(this.contentH - VIEW_H)),
        0,
      );
      this.layer.y = this.scrollY;
    });

    this.redraw();
  }

  private redraw(): void {
    this.layer.removeAll(true);
    this.layer.y = this.scrollY;
    const view = buildAchievementView(this.mgr.getSave());

    this.layer.add(
      crispText(this, W / 2, 40, `${view.unlocked} / ${view.total} unlocked`, {
        fontSize: "13px",
        color: view.unlocked > 0 ? "#ffd56a" : "#90a4bb",
        fontStyle: "bold",
      }).setOrigin(0.5, 0),
    );

    let y = 64;
    for (const group of view.groups) y = this.drawGroup(group, y);
    this.contentH = y + 20;
  }

  private drawGroup(group: AchievementGroupVM, y: number): number {
    const done = group.cards.filter((c) => c.unlocked).length;
    this.layer.add(
      crispText(this, X0, y, `${group.category}   ${done}/${group.cards.length}`, {
        fontSize: "15px",
        color: "#cfe0f5",
        fontStyle: "bold",
      }),
    );
    let rowY = y + 24;
    group.cards.forEach((card, i) => {
      const x = X0 + (i % COLS) * (CW + GAP_X);
      const cy = rowY + Math.floor(i / COLS) * (CH + GAP_Y);
      this.drawCard(card, x, cy);
    });
    const rows = Math.ceil(group.cards.length / COLS);
    return rowY + rows * (CH + GAP_Y) + 8;
  }

  private drawCard(card: AchievementCardVM, x: number, y: number): void {
    const g = this.add.graphics();
    g.fillStyle(card.unlocked ? 0x1f2a18 : 0x161d28, 1).fillRoundedRect(x, y, CW, CH, 10);
    g.lineStyle(2, card.unlocked ? 0xffc94d : 0x2c3a4f, 1).strokeRoundedRect(x, y, CW, CH, 10);
    this.layer.add(g);

    this.layer.add(
      crispText(this, x + 14, y + 10, card.name, {
        fontSize: "16px",
        color: card.unlocked ? "#ffe9b0" : "#cdd6e6",
        fontStyle: "bold",
      }),
    );
    this.layer.add(
      crispText(this, x + CW - 14, y + 12, card.rewardLabel, {
        fontSize: "12px",
        color: "#ffe07a",
      }).setOrigin(1, 0),
    );
    this.layer.add(
      crispText(this, x + 14, y + 32, card.description, {
        fontSize: "11px",
        color: "#aab8cc",
        wordWrap: { width: CW - 140 },
      }),
    );

    // Progress bar.
    const bx = x + 14;
    const by = y + CH - 22;
    const bw = CW - 150;
    const bar = this.add.graphics();
    bar.fillStyle(0x000000, 0.5).fillRoundedRect(bx, by, bw, 12, 4);
    bar
      .fillStyle(card.unlocked ? 0x53c46a : 0x4a8cff, 1)
      .fillRoundedRect(bx, by, Math.max(2, bw * card.frac), 12, 4);
    this.layer.add(bar);
    this.layer.add(
      crispText(
        this,
        bx + bw + 6,
        by - 1,
        `${Math.min(card.current, card.target)}/${card.target}`,
        { fontSize: "11px", color: "#cdd6e6" },
      ),
    );

    // Status badge.
    this.layer.add(
      crispText(
        this,
        x + CW - 14,
        y + CH - 24,
        card.unlocked ? "✓ Unlocked" : "In progress",
        {
          fontSize: "12px",
          color: card.unlocked ? "#9fe0b0" : "#6b7a8d",
          fontStyle: card.unlocked ? "bold" : "normal",
        },
      ).setOrigin(1, 0),
    );
  }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS. (Scene is not yet registered — that's Task 5.)

- [ ] **Step 3: Commit**

```bash
git add src/scenes/AchievementScene.ts
git commit -m "feat(achievements): dedicated AchievementScene tracker UI

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Wire scene registration + home nav tile

**Files:**
- Modify: `src/main.ts` (import + scene array)
- Modify: `src/scenes/MainMenuScene.ts` (`BOTTOM_ITEMS`, layout count, trophy glyph)

- [ ] **Step 1: Register the scene in `main.ts`**

Add the import alongside the other scene imports (after the `ForgeScene` import, line ~16):

```ts
import { AchievementScene } from "./scenes/AchievementScene.ts";
```

Add `AchievementScene` to the `scene: [...]` array (after `ForgeScene,`):

```ts
    ForgeScene,
    AchievementScene,
```

- [ ] **Step 2: Add the nav tile in `MainMenuScene.ts`**

In `BOTTOM_ITEMS` (around line 47-50), insert the Achievements entry before Settings:

```ts
const BOTTOM_ITEMS: MenuItem[] = [
  { key: "quests", label: "Quests", scene: "QuestScene" },
  { key: "activities", label: "Activities", scene: "ActivitiesScene" },
  { key: "achievements", label: "Achievements", scene: "AchievementScene" },
  { key: "settings", label: "Settings", scene: "SettingsScene" },
];
```

No change is needed to the `homeNavLayout(...)` call — it already passes
`bottom: BOTTOM_ITEMS.length`, which now evaluates to 4.

- [ ] **Step 3: Add the trophy glyph**

In `drawMenuGlyph` (the `switch (key)` block), add a `case "achievements"` before
the `default:` (a trophy cup):

```ts
    case "achievements": { // trophy cup
      g.fillStyle(W, 1).fillRoundedRect(x - s * 0.55, y - s * 0.7, s * 1.1, s * 0.8, 3);
      g.lineStyle(2, W, 1)
        .beginPath();
      g.arc(x - s * 0.75, y - s * 0.35, s * 0.32, Math.PI * 0.5, Math.PI * 1.5);
      g.strokePath();
      g.beginPath();
      g.arc(x + s * 0.75, y - s * 0.35, s * 0.32, Math.PI * 1.5, Math.PI * 0.5);
      g.strokePath();
      g.fillStyle(0xd6dded, 1).fillRect(x - s * 0.18, y + s * 0.1, s * 0.36, s * 0.5);
      g.fillStyle(W, 1).fillRect(x - s * 0.5, y + s * 0.6, s * 1.0, s * 0.22);
      break;
    }
```

- [ ] **Step 4: Type-check + build**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS.

- [ ] **Step 5: Confirm `homeLayout` tests still pass with 4 bottom cells**

Run: `npx vitest run tests/homeLayout.test.ts`
Expected: PASS — the suite's local helper uses `bottom: 3`; the production layout
is data-driven and accepts 4. (No assertion hard-codes the count outside that
helper.)

- [ ] **Step 6: Commit**

```bash
git add src/main.ts src/scenes/MainMenuScene.ts
git commit -m "feat(achievements): register scene + home-dock Achievements tile

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Verify + live playtest + memory

**Files:** none (verification only); update memory index outside the repo.

- [ ] **Step 1: Full verification**

Run, in order:
- `npx tsc --noEmit` — expect clean.
- `npx vitest run` — expect all green (prior count + new achievement tests).
- `npm run lint` — expect 0 errors (pre-existing `any` warnings OK). Confirm no
  file exceeds 500 code lines (AchievementScene ~180; data/achievements ~230 incl.
  comments — if the lint flags >500 *code* lines, split the catalog array into a
  second file `src/data/achievementsCatalog.ts` re-exported from `achievements.ts`).
- `npm run build` — expect success.

- [ ] **Step 2: Live CDP playtest**

Start Vite + headless Chrome (reuse the project's existing harness pattern, e.g. a
`/tmp/cap_*.mjs` script over `http://localhost:9222` with the page at
`http://localhost:5173/?debug` and `window.__game`). Then:
1. From `MainMenuScene`, confirm a "🏆 Achievements" tile renders in the bottom dock.
2. `window.__game.scene.start("AchievementScene")` and wait; assert the scene is
   active, the header reads `N / M unlocked`, and there are 20 cards across 5
   category groups (count `children`/layer text or call
   `buildAchievementView(mgr.getSave()).groups`).
3. Seed an unlock (e.g. set `save.hero.level = 10`, call
   `mgr` save path or directly `checkAndGrantAchievements(save)`), re-enter the
   scene, and screenshot to `/tmp/achievements.png`; confirm the `hero-level-10`
   card shows `✓ Unlocked` and a full bar.
4. Assert zero `Runtime.exceptionThrown` across the run.

Capture: `/tmp/achievements.png` (overview) and one seeded-unlock screenshot.

- [ ] **Step 3: Update memory**

Append a new memory file
`~/.claude/projects/-home-shyaken-Workplace-wibu-tower-defense/memory/project_achievements_menu.md`
describing: the new `data/achievements.ts` catalog (20, 5 categories) + generic
`AchievementReward` (bundle ± `characterId`), the reworked auto-grant
`checkAndGrantAchievements` (progress-driven), the pure `core/achievementView.ts`,
the `AchievementScene` tracker, the home-dock tile, and that rewards still
auto-grant (no claim). Add one line to `MEMORY.md`. Link `[[project_addictive_features]]`.

- [ ] **Step 4: Final report**

Summarize what shipped: dedicated Achievements menu, 2→20 achievements, the
pure-core/presenter split, verification results, and screenshots. No deploy unless
asked.

---

## Self-Review

**1. Spec coverage:**
- Dedicated AchievementScene with progress bars, category grouping, status, header → Task 4. ✓
- 2 → 20 catalog across 5 categories → Task 1. ✓
- Auto-grant preserved + generalized reward → Task 2 (signature kept `string[]`). ✓
- Pure view-model → Task 3. ✓
- Home nav tile + scene registration + glyph → Task 5. ✓
- No ASSET_VERSION bump (procedural glyph) → noted; no art tasks. ✓
- Milestones left in Activities → no task touches ActivitiesScene. ✓
- Tests (catalog, grant, view) → Tasks 1-3; homeLayout regression check → Task 5. ✓

**2. Placeholder scan:** No TBD/TODO; all code blocks complete; the only "if needed" branches (collectionPct import path; >500-line split) are explicit contingencies with concrete instructions, not deferred work.

**3. Type consistency:** `AchievementDef.progress` returns `{current,target}` used identically in Tasks 1/2/3. `AchievementReward = Reward & { characterId? }` consumed by `grantReward` (ignores `characterId`) and `achievementRewardLabel`. `checkAndGrantAchievements(save): string[]` signature unchanged (Task 2) → 5 call sites safe. `buildAchievementView` returns `{groups,unlocked,total}` consumed verbatim by AchievementScene. `CATEGORY_ORDER` shared by catalog + view. Card VM fields (`name,description,rewardLabel,current,target,frac,unlocked`) match scene usage.
