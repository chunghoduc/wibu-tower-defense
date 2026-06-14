# Dedicated Achievements menu + expanded catalog

**Date:** 2026-06-14
**Status:** Approved (full-auto self-approval)

## Problem

Achievements exist in the codebase but have **no UI whatsoever**. They unlock
silently via `checkAndGrantAchievements(save)` (called from 5 sites in
`saveManagerCore`), granting a reward tower the instant their condition is met —
the player never sees the goal, the progress, or the moment of unlock. There are
only **2** achievements (`clear-stage-3`, `place-50-towers`).

The request: *"separate achievements from the activity menu, make a new
achievement menu with more achievements."* The user's mental model files
achievements under the engagement/Activities suite; the concrete intent is to
**give achievements their own visible, dedicated menu and add many more.**

## Goals

1. A dedicated **AchievementScene** reachable from the home screen, showing every
   achievement with a live **progress bar**, its reward, a category grouping, and
   an unlocked / in-progress status — plus a header summary (`N / M unlocked`).
2. Grow the catalog from **2 → 20** achievements across five categories.
3. No regression to the existing silent auto-grant of the 2 current achievements.

## Non-goals

- **No claim mechanic.** Rewards keep auto-granting on unlock (preserves the 5
  existing call sites and needs no save migration). The scene is a *tracker*: it
  shows progress and ✓ Unlocked status, with a celebratory toast/burst on entry
  when something is newly unlocked. (Claim-based rewards already exist elsewhere —
  Quests, Milestones — so an auto-grant tracker is a deliberately distinct shape.)
- **Activities' Milestones stays put.** Milestones are a separate tiered-rewards
  system, not achievements; the user said "achievements," so Milestones is out of
  scope.
- **No art regeneration → no `ASSET_VERSION` bump.** The nav tile uses a
  procedural trophy glyph + emoji, consistent with the other home-dock icons.

## Design

### Data model (pure)

Split the catalog out of logic, mirroring `data/quests.ts` + `core/questTracker.ts`:

- **`src/data/achievements.ts`** — the catalog + types.

  ```ts
  import type { Reward } from "../core/rewards.ts";
  import type { HeroSave } from "../core/save.ts";

  export type AchievementCategory =
    | "Campaign" | "Hero" | "Combat" | "Collection" | "Engineering";

  /** Reward = a Reward bundle (gold/diamonds/materials) AND/OR a reward tower. */
  export type AchievementReward = Reward & { characterId?: string };

  export interface AchievementDef {
    id: string;
    name: string;                 // short title, e.g. "Centurion"
    category: AchievementCategory;
    description: string;          // the goal, e.g. "Place 500 towers total"
    /** Drives the progress bar; unlocked ⇔ current >= target. */
    progress: (save: HeroSave) => { current: number; target: number };
    reward: AchievementReward;
  }

  export const ACHIEVEMENTS: AchievementDef[];
  ```

- **`src/core/achievements.ts`** — keeps `checkAndGrantAchievements(save): string[]`
  but now drives off `ACHIEVEMENTS` and `progress()`:
  - unlocked ⇔ `progress(save).current >= target`;
  - on first unlock, set `save.progress.achievementFlags[id] = true`, then
    `grantReward(save, def.reward)` **and** (if `reward.characterId`) add that tower
    via the existing collection helper; return the list of granted reward labels
    (still used by the call sites' celebration path — keep the contract a `string[]`).
  - Re-export `ACHIEVEMENTS` / `AchievementDef` so existing imports keep working.

- **`src/core/achievementView.ts`** — Phaser-free view-model builder, unit-tested:
  groups `ACHIEVEMENTS` by category in a fixed category order, computes per-card
  `{ current, target, frac (clamped 0..1), unlocked }`, and totals
  `{ unlocked, total }`. The scene consumes this; it never recomputes progress.

### Catalog (20 achievements)

Every `progress()` reads only fields that already exist in the save. The 2
existing achievements are preserved verbatim (keep their `characterId` tower
reward). New achievements grant gold/diamonds/materials only (so we don't invent
unowned tower ids). Targets/rewards are starting values; the plan may fine-tune.

Field sources (verified): `save.hero.level`, `save.meta.profile.lifetimeKills`,
`max(save.meta.endless.bestWave)`, `save.progress.totalTowersPlaced`,
`save.progress.stageClearMap[id].{Normal,Hard,Nightmare}`,
`Object.keys(save.collection).length`, `collectionPct(save)` (0..1).

| Category | id | Goal | Metric → target |
|---|---|---|---|
| Campaign | `clear-stage-3` *(existing)* | Clear Stage 3 | stage-3 cleared → 1 · **tower** |
| Campaign | `clear-stage-10` | Clear Stage 10 | stage-10 cleared → 1 |
| Campaign | `clear-stage-20` | Clear Stage 20 | stage-20 cleared → 1 |
| Campaign | `win-nightmare` | Win any stage on Nightmare | nightmare clears → 1 |
| Hero | `hero-level-10` | Reach Hero Level 10 | hero.level → 10 |
| Hero | `hero-level-25` | Reach Hero Level 25 | hero.level → 25 |
| Hero | `hero-level-50` | Reach Hero Level 50 | hero.level → 50 |
| Combat | `kills-1000` | 1,000 lifetime kills | lifetimeKills → 1000 |
| Combat | `kills-10000` | 10,000 lifetime kills | lifetimeKills → 10000 |
| Combat | `kills-100000` | 100,000 lifetime kills | lifetimeKills → 100000 |
| Combat | `endless-wave-10` | Reach Endless Wave 10 | bestEndlessWave → 10 |
| Combat | `endless-wave-25` | Reach Endless Wave 25 | bestEndlessWave → 25 |
| Combat | `endless-wave-50` | Reach Endless Wave 50 | bestEndlessWave → 50 |
| Collection | `own-10-towers` | Own 10 heroes | collection size → 10 |
| Collection | `own-25-towers` | Own 25 heroes | collection size → 25 |
| Collection | `codex-50` | Discover 50% of the Codex | round(collectionPct·100) → 50 |
| Collection | `codex-100` | Complete the Codex | round(collectionPct·100) → 100 |
| Engineering | `place-50-towers` *(existing)* | Place 50 towers | totalTowersPlaced → 50 · **tower** |
| Engineering | `place-500-towers` | Place 500 towers | totalTowersPlaced → 500 |
| Engineering | `place-5000-towers` | Place 5,000 towers | totalTowersPlaced → 5000 |

Reward scale: minor milestones → gold; mid → diamonds; capstones (`codex-100`,
`kills-100000`, `hero-level-50`, `place-5000-towers`, `endless-wave-50`) →
diamonds + a forge material (awakening-crystal / jewel-of-chaos / feather).

### Presenter — `src/scenes/AchievementScene.ts`

Follows `QuestScene`/`ActivitiesScene` conventions: title + "← Back" to
MainMenuScene, a scrollable `layer` container (mouse-wheel, same clamp pattern as
ActivitiesScene), and a toast. Renders category section headers, then a 2-column
grid of achievement cards. Each card: name + reward label, description, a
progress bar with `current/target`, and a status (`✓ Unlocked` green badge or
`In progress`). Header line shows `N / M unlocked`. Card drawing kept thin by
consuming the pre-computed `achievementView` model. (Watch the 500-line cap —
split a card presenter into a helper if the scene approaches it.)

### Wiring

- **`src/main.ts`** — import + register `AchievementScene` in the scene array.
- **`src/scenes/MainMenuScene.ts`** — add `{ key: "achievements", label:
  "Achievements", scene: "AchievementScene" }` to `BOTTOM_ITEMS` (now 4 tiles),
  bump the `homeNavLayout` `bottom` count, and add a procedural 🏆 trophy glyph
  case to `iconButton`'s glyph switch.

## Testing

- **`tests/achievements.test.ts`** (extend): every def has a unique id, non-empty
  name/description, valid category, `target > 0`; the 2 legacy achievements still
  grant their tower; `checkAndGrantAchievements` grants a new bundle achievement
  once and not twice; auto-grant applies gold/diamonds/materials via `grantReward`.
- **`tests/achievementView.test.ts`** (new): grouping covers every def exactly
  once in fixed category order; `frac` clamps to 0..1; unlocked derivation matches
  `current >= target`; totals count unlocked correctly across a seeded save.
- **`tests/homeLayout.test.ts`** stays green with `bottom: 4` (layout already
  loops `counts.bottom`; no hard-coded 3 outside the local `lay()` helper).
- Full `tsc` + `vitest` + `lint` + `build`, then a live CDP playtest of the new
  scene (open from home, see populated cards + progress, confirm a seeded unlock
  shows ✓ and zero runtime exceptions).

## Risks

- **Reward generalization touches `checkAndGrantAchievements`** (returns `string[]`
  used by 5 call sites). Keep the return type `string[]` (reward labels) so call
  sites are unaffected.
- **Bottom dock 3 → 4 tiles** shrinks tile spacing slightly; verified the layout
  is data-driven. No mobile-fit regression expected (row is centered, cells fixed).

## Files

- New: `src/data/achievements.ts`, `src/core/achievementView.ts`,
  `src/scenes/AchievementScene.ts`, `tests/achievementView.test.ts`.
- Modified: `src/core/achievements.ts`, `src/scenes/MainMenuScene.ts`,
  `src/main.ts`, `tests/achievements.test.ts`.
- No save-schema change (additive use of existing `achievementFlags`); no art.
