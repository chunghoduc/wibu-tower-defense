# Project Restructure & Reformat — Design

**Date:** 2026-06-13
**Goal:** behavior-preserving structural cleanup of the whole codebase: consistent
formatting, mechanical enforcement of the existing design rules, dependency
hygiene, and de-duplication of scene UI scaffolding. Zero gameplay/balance
change; the full test suite stays green at every milestone.

## Findings from the rescan

- **No formatter or linter exists.** `prettier --check` flags ~320 files of
  drift across src/tests/scripts. Style is inconsistent file-to-file.
- **One file breaks the 500-line hard rule:** `src/core/battle.ts` (527).
  Everything else is already split (the god-class declaration-merge pattern).
- **14 madge cycles**, of which 7 are the _intentional_ declaration-merging
  splits (`battle.ts` ↔ battleWaves/Enemies/Towers/Damage, `BattleScene.ts` ↔
  battleSceneInput/Render/Sprites), 6 are type-only back-imports (benign
  aggregator stars), and exactly **one is a real runtime cycle**:
  `schema.ts` ⇄ `schemaValidators.ts` (validators import enum constants from
  `schema.ts` even though the leaf `schemaEnums.ts` already exists).
- **Layer purity is already perfect:** zero Phaser imports in src/core or
  src/data.
- **Scene UI scaffolding is copy-pasted:** accent panels + compact buttons
  (ActivitiesScene/ForgeScene/…), dim-backdrop modals (ShopScene/
  CollectionScene/battleSceneInput), and rarity color tables redefined in 4+
  scenes.

## Decisions

1. **M1 Prettier.** `.prettierrc` (default style, printWidth 100),
   `.prettierignore` excluding `public/`, `dist/`, and — temporarily — the
   files carrying uncommitted prior-session art work
   (`src/data/spriteManifest.ts`, `scripts/sdart/sync_manifest.mjs`); drop
   those entries once that work lands. One pure-format commit; `format` /
   `format:check` npm scripts.
2. **M2 battleHero.ts.** Extract `updateHero` into a `heroMethods` sibling
   module using the exact existing pattern (interface + Object.assign on the
   prototype). battle.ts goes under 500.
3. **M3 ESLint.** Flat config, typescript-eslint, deliberately small rule set:
   `max-lines: 500` as an **error** (turns the memory rule into CI),
   `@typescript-eslint/consistent-type-imports`, and the recommended baseline
   minus rules that fight the codebase's established patterns. `lint` script.
4. **M4 Cycle hygiene.** Point `schemaValidators.ts` at `schemaEnums.ts`;
   add `lint:cycles` (madge with `skipTypeImports`) asserting the only cycles
   are the allowlisted declaration-merge ones.
5. **M5 uiKit dedup.** Shared helpers in `src/scenes/uiKit.ts` (accent panel,
   compact button, dim backdrop) + one rarity-color token module; migrate the
   duplicating scenes mechanically.

## Explicit non-goals

- Recombining or re-privatizing the BattleState/BattleScene splits (the
  pattern is deliberate — see memory `project_god_class_split_pattern`).
- Touching/committing the dirty tower-art files from the prior session.
- Any gameplay, balance, data, or visual-behavior change.

## Verification

Per milestone: `tsc --noEmit` + `vitest run` green, then commit. Final:
production build + CDP playtest screenshots (menu + battle) to confirm the
UI-dedup milestone changed nothing visually.
