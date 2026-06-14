# Expedition daily dispatch cap — design

## Request

> "can only do maximum 5 expedition per day"

Limit the number of expedition **dispatches** (starting/sending a quest) to a
maximum of 5 per UTC day. This is separate from the existing free-reroll cap
(also 5/day) added in the prior pass — rerolling rotates the board; dispatching
sends towers on a quest. Claiming a finished quest is **not** capped (you should
always be able to collect a reward you already earned).

## Decision

Mirror the proven daily-reroll counter pattern already in `expeditionBoard.ts`
(`REROLL_PER_DAY` + `resetDailyRerolls` + `rerollDay`/`freeRerollsLeft`). A
second day-keyed counter caps dispatches.

### Data (`ExpeditionSave` in `core/meta.ts`)

Two new fields, defaulting to a full allowance:

- `dispatchesLeft: number` — dispatches remaining today (`0..DISPATCH_PER_DAY`).
- `dispatchDay: string` — UTC `yyyy-mm-dd` the counter was last reset (`""` = never).

`defaultMeta`, `backfillMeta` both seed `dispatchesLeft: 5, dispatchDay: ""`.

### Core (`core/expeditionBoard.ts`)

- `export const DISPATCH_PER_DAY = 5;`
- `resetDailyDispatches(board, today)` — idempotent refill on UTC day rollover
  (same `dayKey()` boundary as rerolls/auto-rotate).
- `ensureBoard` calls `resetDailyDispatches` (so a board opened on a new day
  shows a fresh allowance, exactly like rerolls).
- `startQuest(save, questId, towerIds, nowMs)` — after the existing validity
  checks, run `resetDailyDispatches`; if `dispatchesLeft <= 0` return `false`
  (no-op, towers stay free); on a successful dispatch decrement `dispatchesLeft`.
  The cap is the **last** gate so an invalid assignment never burns an allowance.

### SaveManager (`core/saveManager.ts`)

- `expeditionDispatchesLeft(): number` — returns `meta.expedition.dispatchesLeft`
  (day-reset aware via `ensureExpeditionBoard`, mirroring `expeditionRerollsLeft`).

### Save migration (`core/save.ts`)

Bump `CURRENT_SAVE_VERSION` 13 → 14. v14 hop backfills `dispatchesLeft ??= 5`,
`dispatchDay ??= ""` on existing expedition boards. Defensive `backfillMeta`
covers partial saves.

### UI (`scenes/ExpeditionScene.ts`)

- Header line near the reroll button shows `🧭 Dispatches n/5`.
- `drawAvailable`: when `dispatchesLeft <= 0`, render the **Assign** button greyed
  (disabled) so the player can't open the picker; a tap shows a toast
  `No expeditions left today (0/5)`. When > 0, behaviour is unchanged. (Defence in
  depth: `startQuest` already refuses at 0, so even a stale button is safe.)

## Testing (TDD, RED first)

- `expeditionBoard.test.ts`: a 6th dispatch in one day fails; `dispatchesLeft`
  decrements per dispatch; an **invalid** assignment does not consume an
  allowance; a new UTC day restores the full 5; claiming is unaffected.
- `meta`/`save.test.ts`: v13→v14 backfills `dispatchesLeft: 5, dispatchDay: ""`.
- CDP repro extension: header shows `Dispatches n/5`.

## Out of scope / YAGNI

- No paid extra dispatches, no per-rarity dispatch costs, no carry-over. A flat
  5/day matches the request and the sibling reroll cap.
- Claiming and rerolling caps unchanged.

## Files touched

`core/meta.ts`, `core/expeditionBoard.ts`, `core/saveManager.ts`, `core/save.ts`,
`scenes/ExpeditionScene.ts`, plus the three test files. No art, **no
ASSET_VERSION bump** (no new sprites).
