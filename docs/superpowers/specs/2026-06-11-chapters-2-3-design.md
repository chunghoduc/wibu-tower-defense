# Chapters 2 & 3 — Sunscar Wastes & Emberfall

**Date:** 2026-06-11
**Status:** Approved (delegated session) → implementing

## Goal

Extend the campaign past Chapter 1 ("Greywood Pass", 10 stages) with two new
carefully-themed regions that are **much harder** than Chapter 1 and pay
**better rewards** — while reusing the already-generated biome backdrops and item
bands (no new art this pass).

## Regions

Each new chapter is a cohesive **single-biome 5-stage region** that maps onto an
existing pre-authored `CHAPTER_THEME` and its generated backdrop:

### Chapter 2 — Sunscar Wastes (desert · stages 11–15)
- Theme band: chapter index 2 → `CHAPTER_THEMES[2]` "Sunscar Wastes" (desert),
  backdrop `bg__chapter-desert` (already loaded).
- Homage flavor (player-facing wording original; real sources in comments only):
  a desert pilgrimage toward an immortal tyrant — *Stardust Crusaders × Dune*.
- Stages: Glassflats Crossing, The Bonewalk, Mirage Bazaar, Sunscar Trench,
  Gate of the Glass Throne.

### Chapter 3 — Emberfall (volcanic · stages 16–20)
- Theme band: chapter index 3 → `CHAPTER_THEMES[3]` "Emberfall" (volcanic),
  backdrop `bg__chapter-volcanic`.
- Homage flavor: descent into a demon-king's burning citadel —
  *Infinity Castle × Dante's Inferno*.
- Stages: Cinderfall Descent, Forge Roads, Ashen Colonnade, Magma Reliquary,
  Throne of Emberfall.

## Data-model contracts (must hold)

- **Continuous global stage numbering.** Ids are `ch2-s11`…`ch2-s15`,
  `ch3-s16`…`ch3-s20`. Many systems parse the TRAILING number
  (`stageNumber` `/s(\d+)$/`, `chapters.ts` `/(\d+)$/`); both return 11..20 for
  these ids. This keeps `progressionScaling`, `boxTierForStage`,
  `chapterIndexForStage`, and `itemLevelForStage` climbing correctly.
- **Append in order to `STAGES`.** The sequential unlock gate is
  `i>0 && !clearMap[STAGES[i-1].id]?.Normal`; appending Ch.2 after Ch.1-s10 makes
  Ch.2 auto-gate behind finishing Chapter 1.
- **Player-chapter ≠ difficulty band.** A "player chapter" is the `chN-` id
  prefix (Ch.1 spans bands 0–1; Ch.2 = band 2; Ch.3 = band 3). New
  `playerChapterOf(stageId)` parses `/^ch(\d+)/`. Difficulty-unlock gating stays
  keyed on the 5-stage band (`chapterIndexForStage`) — unchanged.

## Difficulty ("much harder")

Rely on the existing compounding curve, no opaque new multipliers:
- `progressionScaling(stageN)` → ≈3.6× HP at s11, ≈9.5× HP at s20 vs s1, before
  the Normal/Hard/Nightmare tier multipliers (×1.55 / ×7.8 / ×14.8).
- A fresh 5-stage band at s11 and s16 fires the +30% HP / +14% ATK chapter-wall
  step exactly at each region boundary.
- `buildWaves(n)` is already at max density for n≥8 (walls + priority supports
  from wave 1), and its counts keep growing with n (e.g. wave-1 grunts = 5+n), so
  stages 11–20 field genuinely larger waves than 1–10.

## Rewards ("better")

- **Boxes:** every Ch.2/3 stage drops t5 (top tier) — `boxTierForStage` already
  caps at 5 for stage ≥9.
- **Gold (new):** gold is currently flat per difficulty. Add a monotonic
  depth multiplier `1 + (stageN-1)*GOLD_DEPTH_PER_STAGE` so deeper stages pay
  more (s20 ≈ 2.1× a stage-1 clear). Applies to base + first-clear gold.
- **Diamonds:** already `base + (stageN-1)*2` — s20 ≈ 50 on a Nightmare first
  clear. Unchanged.
- **Items:** `chapterLevelRange` already allocates required-level bands by
  chapter index (Ch.2 → 41–60, Ch.3 → 61–80). Unchanged.

## UI — chapter selector

`StageSelectScene` currently renders all of `STAGES` in one flat 5-col grid
labeled `Stage {i+1}`; 20 stages overflow the 540px screen. Changes:
- Chapter tabs (Ch.1 / Ch.2 / Ch.3) above the difficulty tabs; selecting a
  chapter filters the grid to that chapter's stages (each ≤10 → fits 2 rows).
- Card label uses the true global stage number (`stageNumber(id)`), not array
  index.
- Show the selected region's name + one-line lore blurb.
- Preserve the scene re-entry reset pattern (reset pushed array fields in
  `create()`).

## File-size discipline

`stage.ts` (253 lines) would exceed 500 with 10 new layouts + lore. New stage
layouts/lore live in a focused module (`src/data/stagesExpansion.ts`); chapter
metadata in `src/data/campaign.ts`. `stage.ts` imports and concatenates them.

## Tests

- `playerChapterOf` parses ch1/ch2/ch3 prefixes.
- `BOSS_BY_STAGE` covers stages 11–20 (no undefined → no silent "overlord"
  fallback for authored stages).
- Gold scaling is monotonic non-decreasing in stage number; Ch.2/3 clear gold
  strictly exceeds the equivalent Ch.1 stage.
- New stages exist in `STAGES` with continuous numbering and valid paths/slots.
- Difficulty-unlock grouping: stages 11–15 form one band, 16–20 another.

## Out of scope (flagged)

- Bespoke Ch.2/3 boss art/characters (reusing the 10-boss roster, elite-scaled).
- New per-stage hand-painted backdrops (using the chapter biome backdrop).
- Expanding Ch.2/3 to 10 stages each (5 each now; trivially extensible).
