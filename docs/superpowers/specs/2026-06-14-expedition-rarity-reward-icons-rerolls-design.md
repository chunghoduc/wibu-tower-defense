# Expedition: rarity icons, reward icons & free daily rerolls

**Date:** 2026-06-14
**Status:** Approved (full-auto self-approval)

## Problem

The Expedition quest board (`ExpeditionScene`) communicates two key facts as bare
text:

1. **Slot rarity requirement** — `Needs ≥Common + ≥Magic` (line ~150). Players must
   parse the word-rarity to know which towers qualify. Every other surface in the
   game shows rarity through colour/iconography.
2. **Reward** — `Reward: <hint> · <duration>` (line ~156). The reward is a plain
   string ("Solid loot · gems"), while the rest of the game has a single
   reward→icon resolver (`rewardIcon.ts`) used by the spin reel and post-battle
   panel. The expedition card never uses it.

Separately, the board only rerolls its Available quests **once per day**
automatically. A player who dislikes the current board has no agency until the
next UTC day.

## Goals

- **(a)** Show the required rarity for each quest slot as a **rarity gem icon**,
  not text.
- **(b)** Show each quest's reward as an **icon row** (the reward *pool*), driven
  by the existing `rewardIcon.ts` single source — not a text hint.
- **(c)** Let the player **reroll the board up to 5 times per day, free of
  charge**, with the remaining count surfaced in the UI.

## Non-goals

- No change to reward *values*, drop odds, durations, slot floors, or tier
  weights. The reward is still rolled at claim time (a surprise); (b) previews the
  *pool*, never the exact future roll.
- No new reward *materials*. Reuse the existing material set.
- No paid reroll / gem-cost path. Rerolls are free and simply capped at 5/day.

## Design

### (a) Rarity gem icons for slot requirements

**Art (SDXL, pipeline-consistent).** Add one faceted-gem emblem per rarity, keyed
`rarity__<Rarity>` (Common…Unique), generated through `scripts/sdart` like every
other icon. Each gem is tinted to its rarity hue (`RARITY_INT`): grey / blue /
purple / orange / red. Loaded in `PreloadScene` via a `RARITIES` loop and
`versioned()`.

**Key.** Add the sole builder to `assetKeys.ts`:
`export const rarityTex = (rarity: string): string => \`rarity__${rarity}\`;`

**Geometry (pure, tested).** New `src/scenes/raritySlotRow.ts` exporting
`raritySlotRow(slots: Rarity[], x: number, y: number): { rarity: Rarity; cx: number;
cy: number; size: number }[]` — left-to-right gem layout (fixed GEM=18, GAP=4). No
Phaser imports.

**Render (`ExpeditionScene`).** Replace the `Needs ≥…` text with a small "Needs:"
caption followed by the gem row. For each entry draw `rarityTex(rarity)`
**exists()-gated**; when the texture is missing draw a **procedural faceted gem**
(a diamond polygon filled with `RARITY_INT[rarity]` + lighter top facet) so
headless tests and first paint always render something legible. A one-line legend
is unnecessary — gems sit on the card next to the existing rarity-coloured title.

### (b) Reward icon row

**Pool declaration (pure, tested).** Add to `expeditionQuests.ts`:
`export function tierRewardPreview(rarity: Rarity): RewardIconView[]` returning the
icons a tier *can* pay, built only from `rewardIcon.ts` resolvers
(`goldIcon`/`diamondIcon`/`materialIcon`). Mapping mirrors each tier's `rewardRoll`:

| Tier      | Preview icons                                              |
|-----------|-----------------------------------------------------------|
| Common    | gold, bless-jewel                                         |
| Magic     | gold, diamond, soul-jewel                                 |
| Rare      | gold, diamond, soul-jewel, summon-scroll                  |
| Legendary | gold, diamond, awakening-crystal, jewel-of-chaos*         |
| Unique    | gold, diamond, awakening-crystal, jewel-of-chaos*, feather|

(*`CHAOS_JEWEL`/`JEWEL_OF_CHAOS` exactly as the tier's `rewardRoll` uses them.)
Gold always first; capped at 5 icons to fit the card.

**Render (`ExpeditionScene`).** Replace the `Reward: <hint>` text with the duration
caption + an icon row. Each icon uses the established `makeFitIcon(scene, x, y,
view.iconKey, size, view.emoji)` exists()-gated pattern (same as the spin reel /
running-tower icons already in this scene). The short tier `rewardHint` is kept as
a tiny sub-caption so the flavour text survives.

### (c) Free daily rerolls (cap 5)

**Save schema (`core/meta.ts`).** Extend `ExpeditionSave`:

```ts
export interface ExpeditionSave {
  quests: QuestInstance[];
  lastRerollDay: string;
  nextQuestSeq: number;
  freeRerollsLeft: number; // rerolls remaining today (0..REROLL_PER_DAY)
  rerollDay: string;       // UTC yyyy-mm-dd the counter was last reset
}
```

Default: `freeRerollsLeft: REROLL_PER_DAY, rerollDay: ""`. `backfillMeta()` fills
both for old saves.

**Constant.** `export const REROLL_PER_DAY = 5;` in `expeditionBoard.ts`.

**Daily reset.** `ensureBoard` already detects a new day via `dayKey`. Extend that
same block (or a sibling `resetDailyRerolls`) so that when `rerollDay !== today`,
`freeRerollsLeft` is set to `REROLL_PER_DAY` and `rerollDay = today`. Keep the
existing once-per-day auto-rotation of Available quests unchanged.

**Reroll op (pure, tested).** New `rerollBoard(save, nowMs, rng): boolean`:

1. `resetDailyRerolls(board, today)` first (so a fresh day grants the 5).
2. If `board.freeRerollsLeft <= 0` → return `false` (no-op).
3. Drop Available quests (`startedAt <= 0`), keep Running, refill to `BOARD_SIZE`
   with `generateQuest`.
4. `board.freeRerollsLeft--`; return `true`.

**SaveManager.** `rerollExpeditionBoard(nowMs = Date.now()): boolean` →
`rerollBoard(...)`, persist on success; plus `expeditionRerollsLeft(nowMs)` reading
the (day-reset-aware) counter.

**Save version.** Bump `CURRENT_SAVE_VERSION` 12 → 13; backfill covers the two new
fields. No destructive migration.

**UI (`ExpeditionScene`).** Add a `🎲 Reroll (n/5)` button in the board header.
Enabled when `n > 0`; on click call `rerollExpeditionBoard()` then re-render.
Disabled/greyed at 0 with the count still shown. Keep the scene < 500 lines by
putting the button presenter in a small helper if needed.

## Testing (TDD, RED first)

- `raritySlotRow.test.ts` — gem count == slot count; monotonically increasing `cx`;
  fixed size; empty slots → empty row.
- `tierRewardPreview.test.ts` — gold always first & present; gem tiers include
  diamond; per-tier signature material present; length ≤ 5; every entry is a valid
  `RewardIconView` (built via rewardIcon resolvers, keys via assetKeys).
- `expeditionBoard.test.ts` (extend) — `rerollBoard`: decrements, refills Available
  only, preserves Running, no-op + `false` at 0; `resetDailyRerolls` restores to 5
  on a new `dayKey`; idempotent within a day.
- `save migration` — a v12 save (missing fields) backfills to
  `freeRerollsLeft = 5`, `rerollDay = ""`, `CURRENT_SAVE_VERSION === 13`.

A CDP repro (`scripts/playtest/repro_expedition_icons.mjs`) screenshots the board
and asserts the gem + reward-icon images and the reroll button render.

## Files touched

- `src/data/assetKeys.ts` — add `rarityTex`.
- `src/data/expeditionQuests.ts` — add `tierRewardPreview`.
- `src/scenes/raritySlotRow.ts` — **new** pure geometry.
- `src/core/meta.ts` — extend `ExpeditionSave` + default + backfill.
- `src/core/expeditionBoard.ts` — `REROLL_PER_DAY`, `resetDailyRerolls`, `rerollBoard`.
- `src/core/saveManager.ts` — `rerollExpeditionBoard`, `expeditionRerollsLeft`.
- `src/core/save.ts` — `CURRENT_SAVE_VERSION` 12 → 13.
- `src/scenes/ExpeditionScene.ts` — gem row, reward icon row, reroll button.
- `src/scenes/PreloadScene.ts` — load `rarity__<Rarity>` icons.
- `scripts/sdart/prompts.mjs` (+ `prompts.d.mts`) — rarity gem prompt spec.
- Tests as above; bump `ASSET_VERSION` on art regen.

## Risks / decisions

- **Preview ≠ exact roll.** Acceptable & intended — the surprise is a design
  feature; the icons telegraph the *pool*, matching the existing text hint's
  spoiler-free intent.
- **First-paint blank gems.** Mitigated by the procedural faceted-gem fallback —
  never depend solely on the SDXL texture.
- **Daily reset coupling.** Rerolls reset on the same `dayKey` boundary as the
  auto-rotation; resetting the counter must not itself rotate the board (only the
  player-driven `rerollBoard` rotates within a day).
