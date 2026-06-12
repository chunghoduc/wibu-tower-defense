# Unified Asset-Key Registry & Entity-Icon Resolver — Design Spec

**Date:** 2026-06-12
**Status:** Approved (full-auto session)
**Follows:** `2026-06-12-consistent-reward-icons-design.md` (which centralized the *reward-panel/spin* slice via `rewardIcon.ts`). This spec generalizes that pattern to **every entity class** so the same item/tower/material/currency renders identically on every screen.

## Problem

Icons drift across screens because the data→texture mapping is **not** single-sourced:

1. **Scattered key derivation.** Texture keys are built as inline template strings (`` `item__${id}` ``, `` `tower__${id}` ``, `` `material__${id}` ``, `` `box__${id}` ``, `` `skill__${id}` ``, `` `jewel__${id}` ``) in **~27 files** across `src/scenes/` and `src/data/`. A naming change must be hand-edited everywhere; a typo fails silently to Phaser's `__MISSING` sentinel.
2. **Three reimplementations of the same logic.** The material-vs-box icon decision is independently coded in `src/data/rewardIcon.ts` (`materialIcon`), `src/data/boxRewardView.ts` (lines 30–42), and `src/scenes/HeroScene.ts` (`makeMaterialTile`, line 354 — `textures.exists('material__'+id) ? ... : 'box__'+id`). These can drift.
3. **Partial single-source.** `rewardIcon.ts` is canonical only for the reward panel + spin reel. Inventory, Shop, Collection, Squad, Battle, Hero doll, box-open overlay etc. each derive keys on their own.
4. **Three existing key helpers are unused by their own loader.** `materialIconKey`/`jewelIconKey`/`skillIconKey` exist in separate manifest files, yet `PreloadScene` inlines the same templates rather than calling them, and no helper exists at all for `item__`/`tower__`/`box__`/currency keys.

## Research grounding (deep-research, verified claims)

- **SSOT id-keyed registry** (3-0): master each entity→visual mapping in exactly one place; a missing entry should be a build/test failure, not silent per-screen drift.
- **Flyweight def/instance split** (3-0): shared catalog definition (intrinsic: icon key, color, name) vs per-instance data (extrinsic: count, level). Already present here as `ItemDef` vs `ItemInstanceSave` — keep and formalize; the resolver consumes the *instance* and looks up the *def*.
- **Centralized typed key derivation** (3-0): one derivation point instead of scattered concatenation. A lone runtime concat helper is *not sufficient on its own* (a refuted sibling claim) — **pair it with a contract test** that proves every derived key is real.
- **Resolver / view-model layer** (3-0): pure entity→`{iconKey, emoji, color, ...}` functions outside the scene layer, unit-testable and reused.
- **Phaser Texture Manager is the engine-level key registry** (3-0): our domain registry resolves *into* texture keys; the engine fails visibly (`__MISSING`) on a bad key.
- **Refuted, and respected:** (a) do NOT rely on Phaser instance-sharing semantics for cross-screen consistency — rely on the **key**. (b) Prefer typed/contract-checked derivation over bare runtime concat.

## Goals

- One module owns **all** texture-key derivation. Changing a naming convention is a one-line edit there.
- One resolver layer maps any entity (item instance, tower, skill, material, currency, reward) → `IconView` (`{iconKey, emoji, color}`), reusing the existing `rewardIcon.ts` shapes.
- The three material/box reimplementations collapse into the shared resolver.
- A contract test proves every catalog entity resolves to a convention-correct key that `PreloadScene` actually loads; a guard test prevents new inline `__${` templates from creeping into scenes.
- **Zero visible output change** for screens that were already correct — this is a consolidation, not a re-skin. Guarded by existing tests (`rewardPanel`, `rewardIcon`, `materialIcons`, `iconFit`).

## Non-goals / YAGNI

- **No branded/nominal ids.** High-confidence benefit but real retrofit churn and call-site ceremony for this game's id volume; the key-derivation module + contract test deliver ~90% of the safety. Considered and deferred.
- **No build-time codegen of typed accessors.** The codebase hand-maintains `spriteManifest`; a runtime derivation module + contract test is the right weight here. (The one source advocating codegen targeted Phaser-CE/2 and had a known strict-mode bug.)
- **No art regeneration, no new textures, no resizing.** Naming conventions and the on-disk asset layout are unchanged.
- **No change to drop/roll/economy logic**, stats, or the instance/def data shapes themselves.
- **No collapsing of distinct entity classes** into one mega-Record. Per-domain resolver functions sharing one `IconView` contract + one key module is the right granularity for the 500-line rule.

## Architecture — four units

### Unit 1 — `src/data/assetKeys.ts` (the single key-derivation point)

Pure, Phaser-free. The ONE place any `<namespace>__<id>` key is built.

```ts
// Entity-keyed derivations
export const itemTex     = (id: string) => `item__${id}`;
export const towerTex    = (id: string) => `tower__${id}`;
export const jewelTex    = (id: string) => `jewel__${id}`;
export const materialTex = (id: string) => `material__${id}`;
export const boxTex      = (id: string) => `box__${id}`;
export const skillTex    = (id: string) => `skill__${id}`;
export const menuTex     = (id: string) => `menu__${id}`;
export const fxTex        = (id: string) => `fx__${id}`;
// Fixed currency / singleton keys (named constants, not magic strings)
export const GOLD_TEX = "icon__gold", GEM_TEX = "icon__gem", XP_TEX = "icon__xp";
export const HERODOLL_BASE_TEX = "herodoll__base";
```

The existing `materialIconKey`/`jewelIconKey`/`skillIconKey` in their manifest files **delegate** to these (re-export, no signature change) so nothing breaks and the manifest files keep their `*_ICON_IDS` lists. `PreloadScene` imports the derivations instead of inlining templates.

### Unit 2 — generalize the resolver (`rewardIcon.ts` + entity helpers)

`rewardIcon.ts` already exports `IconView`/`RewardIconView` and per-kind helpers. It will:
- Derive all keys via `assetKeys.ts` (no more inline templates in this file).
- Gain entity-level resolvers that return `IconView`:
  - `itemInstanceIcon(inst: ItemInstanceSave): IconView` — looks up the def (flyweight) for rarity color, derives `itemTex(inst.defId)`.
  - `towerIcon(id: string): IconView` — `towerTex(id)`, rarity color from the tower def, `✨` fallback.
  - `skillIcon(id: string): IconView` — `skillTex(id)`, `⚡` fallback.
  - `materialIcon(id)` (exists) — already does the box-vs-material branch; remains the **sole** owner of that decision.

If `rewardIcon.ts` approaches its size budget, the entity-level resolvers split into `src/data/entityIcon.ts` (same contract, imports `assetKeys` + the per-kind color helpers). Both files stay well under 500 lines.

### Unit 3 — migrate call sites + remove duplication

- **Kill the dupes:** `boxRewardView.ts` and `HeroScene.makeMaterialTile` call the shared resolver / `materialTex`/`boxTex` instead of hand-rolling the branch. `boxRewardView` keeps its `BoxRewardEntry` shape; only the iconKey source changes.
- **Mechanical swap:** every inline `` `item__${…}` ``/`` `tower__${…}` ``/`` `skill__${…}` `` etc. in scenes becomes the matching `assetKeys` call. No behavioral change — same string out.
- Scope the migration to the call sites the Explore audit enumerated (battleSceneInput, battleSceneSprites, BattleScene, CollectionScene, dressHero, ExpeditionScene, fx, HeroScene, heroEquipVisuals, homeRoom, itemCompareDialog, MainMenuScene, ShopScene, SkillsScene, squadInfoPanel, SquadScene, summonResultOverlay, boxOpenOverlay, skillVfx, PreloadScene, rewardTiles, boxRewardView).

### Unit 4 — contract / anti-drift tests

1. **Catalog→key contract** (`tests/assetKeys.test.ts`): for every entity in each catalog (`ITEM_CATALOG`, `TOWERS`+B+C, `JEWEL_CATALOG`, `MATERIALS`, boxes, skill ids), assert the resolver/derivation produces a key matching the namespace convention, and that the corresponding `*_ICON_IDS`/`PreloadScene` load list would register it (no orphans — every derived key is loadable, every loaded key is derivable).
2. **No-inline-keys guard** (`tests/assetKeyDiscipline.test.ts`): scan `src/scenes/` + `src/data/` source for backtick texture templates (`/`(item|tower|jewel|material|box|skill|menu|fx)__\$\{/`) and assert the only file allowed to contain them is `assetKeys.ts`. This is the regression fence that keeps the registry single.
3. Existing `rewardPanel`/`rewardIcon`/`materialIcons`/`iconFit` tests stay green (output-unchanged proof).

## Data flow

```
catalog def (intrinsic) ─┐
                         ├─► resolver (rewardIcon/entityIcon) ─► IconView{iconKey,emoji,color}
instance save (extrinsic)┘            │ derives key via
                                      ▼
                               assetKeys.ts (single derivation)
                                      │
                                      ▼
                          makeFitIcon(scene, …, iconKey, fit, emoji)
                                      │  resolves into
                                      ▼
                          Phaser Texture Manager (__MISSING on bad key)
```

## Edge cases

- **Un-arted entity:** texture absent → `makeFitIcon` already falls back to the emoji in the `IconView`. Unchanged.
- **Box vs material:** a single owner (`materialIcon`) makes the decision; callers never branch.
- **Missing def lookup:** resolvers default rarity/color (`Common`) exactly as the current tiles do — no NaN, no throw.
- **Manifest helpers:** delegating (not deleting) `materialIconKey`/`jewelIconKey`/`skillIconKey` keeps their `*_ICON_IDS` exports and all current importers working.

## TDD strategy

RED→GREEN per unit, commit per unit:
1. Write `assetKeys.test.ts` (derivation shape) RED → create `assetKeys.ts` GREEN.
2. Write entity-resolver tests RED → add `itemInstanceIcon`/`towerIcon`/`skillIcon` GREEN; refactor `rewardIcon.ts` to derive via `assetKeys` (existing tests stay green).
3. Migrate call sites + dedupe; the no-inline-keys guard test goes RED first (proves it catches the current scatter), then GREEN as sites migrate.
4. Full verify: `npx vitest run`, `tsc`, `npm run build`, CDP playtest across Inventory/Shop/Collection/Activities, confirm files < 500 lines, update memory.

## Success criteria

- One module derives every texture key; the guard test fails if a scene inlines one.
- The material/box branch exists in exactly one place.
- Every catalog entity provably resolves to a loadable key (contract test).
- All existing tests green; no visible change to already-correct screens; full suite + build clean; all touched files < 500 lines.
