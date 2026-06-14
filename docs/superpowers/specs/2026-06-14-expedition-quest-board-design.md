# Expedition Quest Board — Design Spec

**Date:** 2026-06-14
**Status:** Approved (full-auto, self-approved per delegated session)
**Author:** Claude (Opus 4.8)

## 1. Problem & Intent

The user asked to **redesign the Activities feature, starting with Expedition**.
Concretely (verbatim intent): Expedition should become a board of **multiple
quests**, where:

- each quest **requires some towers of different rarity** to be dispatched,
- each quest takes a **fixed amount of time based on that quest's rarity**, and
- each quest gives **random rewards that scale up with the quest's rarity**.

### Today's behaviour (what we are replacing)

`core/expedition.ts` + `scenes/ExpeditionScene.ts` model a **single** continuous
idle run: dispatch up to 3 spare towers, accrue `gold/hr` (rarity + ★ scaled),
collect after a 15-minute minimum, capped at 8h. One run, one reward type (gold +
a chance of Bless jewels). It is a passive faucet with no decisions after the
first dispatch.

The redesign turns it into an **active dispatch board**: several parallel quests,
each a small commitment puzzle (which spare towers satisfy this quest's rarity
slots?) with a timer and a rarity-tiered surprise payout. This adds repeated
decisions, a reason to own a *deep* bench (not just a squad), and a steady
multi-currency faucet that respects the existing economy.

## 2. Scope

**In scope**

- A new pure data module describing **quest tiers** (one per rarity): duration,
  tower-slot requirements, board-generation weight, reward-roll table, and a
  human reward hint.
- A new pure core module for the **board**: generate/refresh quests, validate &
  start an assignment, query state/time-remaining, and claim (roll + grant a
  reward, free the towers, refill the slot).
- A **save model change**: `meta.expedition` becomes a quest board. Save version
  bump **10 → 11** with a migration that resets expedition to a fresh empty board
  (any in-flight legacy idle run is forfeited — acceptable for a redesign; noted
  in the migration comment).
- A **redesigned `ExpeditionScene`** rendering the board (quest cards with state:
  Available / Running / Ready) plus an **assign-dialog** presenter (a tower picker
  filtered to each slot's rarity floor).
- Rewiring `SaveManager` board methods, the **Activities hub** summary card
  (`drawExpedition`), and the pending-action badge count.

**Out of scope (YAGNI)**

- No new art / no `ASSET_VERSION` bump (reuses tower textures + emoji).
- No changes to the other Activities sections (Trials, Bounties, Milestones).
- Reward bundles stay within the existing `Reward` shape (gold / diamonds /
  materials). No item or character rewards from quests.
- No offline catch-up math beyond "the timer keeps running in real time" — a
  quest started before you close the game is simply Ready when you return if its
  duration has elapsed (timestamps are absolute epoch ms).

## 3. Model

### 3.1 Quest tiers (`src/data/expeditionQuests.ts`, pure)

One `QuestTierDef` per `Rarity`, ordered Common→Unique:

| Rarity     | Duration | Slots (min rarity per slot)             | Gen weight |
| ---------- | -------- | --------------------------------------- | ---------- |
| Common     | 15 min   | [Common]                                | 40         |
| Magic      | 45 min   | [Common, Magic]                         | 27         |
| Rare       | 2 h      | [Magic, Rare]                           | 20         |
| Legendary  | 6 h      | [Rare, Rare, Legendary]                 | 10         |
| Unique     | 12 h     | [Legendary, Legendary, Unique]          | 3          |

- **Slots** are *minimum* rarities: a tower satisfies a slot if its rarity ≥ the
  slot's floor (rarity order Common<Magic<Rare<Legendary<Unique). "Towers from
  different rarity" is realised by mixed-floor slot lists at higher tiers.
- **Reward roll** `rewardRoll(rng): Reward` — random within rarity-scaled ranges
  (always some gold; escalating chance/size of diamonds; escalating quantity and
  quality of materials). Indicative ranges (final numbers tuned in the plan):

  | Rarity     | Gold        | Diamonds (chance×amt)    | Materials (chance)                          |
  | ---------- | ----------- | ------------------------ | ------------------------------------------- |
  | Common     | 80–160      | 10% × 1                  | 25% × 1 Bless                               |
  | Magic      | 220–420     | 30% × 1–2                | 40% × 1 Bless/Soul                          |
  | Rare       | 600–1050    | 50% × 2–4                | 1–2 Soul; 25% × 1 Summon Scroll             |
  | Legendary  | 1700–3000   | 80% × 5–10               | 1 Awakening Crystal; 50% × 1 Chaos Jewel; 35% × 1 Summon Scroll |
  | Unique     | 4800–8000   | 100% × 14–28             | 2 Awakening Crystal; 1 Jewel of Chaos; 1 Feather; 1 Summon Scroll |

- **Reward hint** `rewardHint: string` — a short tier label shown on the card
  ("Big haul · gems + rare mats") so the payout reads as *better* at higher tiers
  without revealing the exact roll (the surprise is the hook).
- **`generateQuest(rng, id): QuestInstance`** — pick a tier by gen weight, then
  build the instance from that tier's template.

### 3.2 Quest instance (persisted in save)

```ts
interface QuestInstance {
  id: string;          // unique within the board
  rarity: Rarity;      // quest tier
  slots: Rarity[];     // min rarity required per slot (copied from the tier)
  durationMs: number;  // copied from the tier
  startedAt: number;   // 0 = Available; >0 = epoch ms dispatched
  assigned: string[];  // tower ids locked to this quest while running
}
```

Reward is **not** stored — it is rolled at claim time from the tier table, so it
stays a surprise and the save stays small/stable.

### 3.3 Board save shape (`meta.expedition`)

```ts
interface ExpeditionSave {
  quests: QuestInstance[];  // up to BOARD_SIZE
  lastRerollDay: string;    // ISO yyyy-mm-dd of the last daily reroll
  nextQuestSeq: number;     // monotonic id source
}
```

`BOARD_SIZE = 5`. Migration v10→v11 replaces the old `{startedAt, towerIds,
lastCollectAt}` with `{ quests: [], lastRerollDay: "", nextQuestSeq: 0 }`.

### 3.4 Board logic (`src/core/expeditionBoard.ts`, pure)

- **`ensureBoard(save, nowMs, rng)`** — (a) if `lastRerollDay !== today`, reroll
  every **Available** quest (Running quests are preserved) and refill to
  `BOARD_SIZE`; (b) always top up empty slots to `BOARD_SIZE`. Sets
  `lastRerollDay = today`. Idempotent within a day.
- **`questState(q, nowMs)`** → `"available" | "running" | "ready"`.
- **`questRemainingMs(q, nowMs)`** → ms left (0 when ready/available).
- **`questAssignedTowerIds(save)`** → set of all tower ids locked by Running
  quests (used to exclude them from other assignments).
- **`eligibleTowersForSlot(save, slotRarity, alreadyPicked)`** → owned tower ids
  not in the battle squad, not assigned to another quest, not already picked for
  *this* dialog, with rarity ≥ `slotRarity`.
- **`assignmentMeetsSlots(save, q, towerIds)`** → validates count == slots.length
  and a one-to-one matching where each picked tower satisfies its slot (greedy by
  ascending slot floor is sufficient because slots are min-rarity gates).
- **`startQuest(save, questId, towerIds, nowMs)`** → if valid, set `startedAt`,
  `assigned`, locking the towers. No-op on invalid input.
- **`claimableQuestCount(save, nowMs)`** → number of Ready quests (for badges).
- **`claimQuest(save, questId, nowMs, rng): Reward`** → if Ready: roll the tier
  reward, `grantReward`, free the towers, and **replace** that quest in place with
  a freshly generated one (board stays full). Returns `{}` if not Ready.

All board functions are Phaser-free and fully unit-tested with a seeded `Rng`.

### 3.5 SaveManager surface

Replace the `expedition*` idle methods with board wrappers:
`ensureExpeditionBoard()`, `expeditionQuests()`, `expeditionEligibleForSlot(slot, picked)`,
`startExpeditionQuest(id, ids)`, `claimExpeditionQuest(id)`, `expeditionClaimable()`.
The pending-action badge counts `claimableQuestCount`.

## 4. UI

### 4.1 `ExpeditionScene` (board)

- Title "🧭 Expedition Board"; "← Back" → ActivitiesScene.
- Calls `ensureExpeditionBoard()` on `create`, then renders up to 5 **quest
  cards** (scroll if needed). Each card shows: rarity name (rarity-coloured),
  duration, the slot requirements as small rarity chips, the reward hint, and a
  state-dependent control:
  - **Available** → `Assign` button (opens the assign dialog).
  - **Running** → live countdown `⏳ mm:ss` / `Hh Mm` + the assigned tower icons;
    refreshed on a 1s scene timer.
  - **Ready** → `Claim` button (rolls reward, celebrates via the shared burst,
    refills the slot).
- Card border/accent uses `RARITY_INT/RARITY_HEX` so tier reads at a glance.

### 4.2 `questAssignDialog.ts` (presenter)

A modal over the board (own module to keep the scene < 500 lines): shows the
quest's slots and a grid of **eligible** towers (reusing the existing tower-tile
look from the old ExpeditionScene). The player taps to fill slots in order; a
live "n/total slots filled" + validity check enables a `Dispatch` button that
calls `startExpeditionQuest`. Cancel closes without changes.

### 4.3 Activities hub card (`drawExpedition`)

Becomes a **summary + open** card: "🧭 Expedition Board — N running · M ready to
claim", a `Claim All` shortcut when any are Ready (claims every Ready quest), and
an `Open` button → ExpeditionScene. No per-quest UI in the hub.

## 5. Module / file plan (all < 500 lines)

| File                                   | Kind                | Responsibility                              |
| -------------------------------------- | ------------------- | ------------------------------------------- |
| `src/data/expeditionQuests.ts`         | new, pure data      | tier table, reward rolls, `generateQuest`   |
| `src/core/expeditionBoard.ts`          | new, pure core      | board generate/assign/start/claim/query     |
| `src/core/meta.ts`                     | edit                | new `ExpeditionSave` shape + default        |
| `src/core/save.ts`                     | edit                | v10→v11 migration                           |
| `src/core/saveManager.ts`              | edit                | board wrappers; badge count                 |
| `src/core/expedition.ts`              | **delete**          | superseded by expeditionBoard.ts            |
| `src/scenes/ExpeditionScene.ts`        | rewrite             | board of quest cards + countdown timer      |
| `src/scenes/questAssignDialog.ts`      | new presenter       | eligible-tower picker modal                 |
| `src/scenes/ActivitiesScene.ts`        | edit `drawExpedition` | summary card + Claim All / Open           |
| `tests/expeditionBoard.test.ts`        | new                 | board lifecycle (seeded)                    |
| `tests/expeditionQuests.test.ts`       | new                 | tier table + reward-roll scaling            |
| `tests/expedition.test.ts`             | replace             | retarget old idle tests to the board        |

## 6. Testing strategy (TDD, RED→GREEN)

- **expeditionQuests:** every rarity has a tier; durations strictly increase with
  rarity; `generateQuest` is deterministic per seed; reward rolls always grant
  *something*, and higher tiers have a strictly higher *expected* gold floor;
  slot lists are non-empty and non-decreasing-ish per the table.
- **expeditionBoard:** `ensureBoard` fills to BOARD_SIZE and is idempotent same
  day, rerolls Available but preserves Running across a day change; eligibility
  excludes squad + cross-quest-locked towers and enforces the rarity floor;
  `assignmentMeetsSlots` accepts a valid matching and rejects under-rarity / wrong
  count; `startQuest` locks towers and flips state to running; a quest becomes
  ready exactly at `startedAt + durationMs`; `claimQuest` grants the rolled
  reward, frees the towers, refills the slot, and is a no-op before Ready.
- **save migration:** a v10 save with a legacy idle expedition loads as v11 with
  an empty board and no crash.

## 7. Risks & mitigations

- **Save migration / data loss** — only the (cosmetic) idle accrual is lost; the
  migration is additive otherwise. Covered by a migration test.
- **Tower double-booking** across quests/squad — single source of truth
  `questAssignedTowerIds` + squad set drives every eligibility query; tested.
- **File-size limit (500 lines)** — scene split into board + assign-dialog
  presenter; logic lives in pure cores.
- **Timer churn** — the scene refreshes countdowns on a 1s `time.addEvent`, only
  re-rendering label text (not the whole board) to stay cheap.

## 8. Out-of-the-box defaults chosen (no user round-trip; full-auto)

- Board size 5; daily reroll of Available quests; claimed slots refill instantly.
- Rewards rolled at claim (surprise) with a tier hint shown beforehand.
- Quests run in parallel; towers lock for the duration; squad towers excluded.
- Durations 15m / 45m / 2h / 6h / 12h by tier.
