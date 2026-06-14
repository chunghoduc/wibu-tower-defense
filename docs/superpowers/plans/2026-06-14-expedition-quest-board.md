# Expedition Quest Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single idle Expedition with a board of multiple parallel quests, each requiring spare towers of specified rarities, running for a fixed rarity-based duration, and paying a random rarity-scaled reward.

**Architecture:** Pure data (`data/expeditionQuests.ts`: tier table + reward rolls + quest generator) + pure core (`core/expeditionBoard.ts`: generate/assign/start/claim/query over a new `meta.expedition` board shape) + Phaser presenters (`ExpeditionScene` board grid, `questAssignDialog` tower picker). Save bumps v10→v11. Everything Phaser-free is unit-tested with a seeded `Rng`.

**Tech Stack:** TypeScript, Phaser 3, Vitest. Reuses `Reward`/`grantReward` (rewards.ts), `Rng` (rng.ts), `RARITIES` (schemaEnums.ts), rarity tokens (rarityColors.ts), `towerRarity`/`getTowerStars` (collection.ts).

---

## File Structure

| File | Kind | Responsibility |
| --- | --- | --- |
| `src/data/expeditionQuests.ts` | new, pure | `Rarity`-keyed tier table (duration, slots, gen weight, reward hint, `rewardRoll`), `generateQuest` |
| `src/core/expeditionBoard.ts` | new, pure | board generate/refresh, eligibility, assignment validation, start, claim, queries |
| `src/core/meta.ts` | modify | new `ExpeditionSave` board shape + default + backfill |
| `src/core/save.ts` | modify | v10→v11 migration |
| `src/core/saveManager.ts` | modify | board wrapper methods + badge count |
| `src/core/expedition.ts` | **delete** | superseded |
| `src/scenes/ExpeditionScene.ts` | rewrite | board of quest cards + 1s countdown |
| `src/scenes/questAssignDialog.ts` | new presenter | eligible-tower picker modal |
| `src/scenes/ActivitiesScene.ts` | modify `drawExpedition` | summary card: N running · M ready + Claim All + Open |
| `tests/expeditionQuests.test.ts` | new | tier table + reward-roll scaling |
| `tests/expeditionBoard.test.ts` | new | board lifecycle (seeded) |
| `tests/expedition.test.ts` | rewrite | retarget to board (delete idle-run tests) |

Rarity order index: `RARITIES = ["Common","Magic","Rare","Legendary","Unique"]` (index 0..4 = strength).

---

## Task 1: Quest tier data + reward rolls + generator

**Files:**
- Create: `src/data/expeditionQuests.ts`
- Test: `tests/expeditionQuests.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/expeditionQuests.test.ts
import { describe, it, expect } from "vitest";
import { RARITIES } from "../src/data/schemaEnums.ts";
import { Rng } from "../src/core/rng.ts";
import {
  QUEST_TIERS,
  generateQuest,
  rarityRank,
} from "../src/data/expeditionQuests.ts";

describe("expedition quest tiers", () => {
  it("defines a tier for every rarity", () => {
    for (const r of RARITIES) expect(QUEST_TIERS[r]).toBeTruthy();
  });

  it("durations strictly increase with rarity", () => {
    const ds = RARITIES.map((r) => QUEST_TIERS[r].durationMs);
    for (let i = 1; i < ds.length; i++) expect(ds[i]).toBeGreaterThan(ds[i - 1]);
  });

  it("every slot floor is a valid rarity and slot count is non-empty", () => {
    for (const r of RARITIES) {
      const t = QUEST_TIERS[r];
      expect(t.slots.length).toBeGreaterThan(0);
      for (const s of t.slots) expect(RARITIES).toContain(s);
    }
  });

  it("reward rolls always grant something and never go negative", () => {
    const rng = new Rng(7);
    for (const r of RARITIES) {
      for (let i = 0; i < 50; i++) {
        const reward = QUEST_TIERS[r].rewardRoll(rng);
        expect((reward.gold ?? 0)).toBeGreaterThan(0);
        expect((reward.diamonds ?? 0)).toBeGreaterThanOrEqual(0);
        for (const n of Object.values(reward.materials ?? {})) expect(n).toBeGreaterThan(0);
      }
    }
  });

  it("higher tiers have a strictly higher minimum gold floor", () => {
    const floors = RARITIES.map((r) => QUEST_TIERS[r].goldRange[0]);
    for (let i = 1; i < floors.length; i++) expect(floors[i]).toBeGreaterThan(floors[i - 1]);
  });

  it("generateQuest is deterministic per seed and well-formed", () => {
    const a = generateQuest(new Rng(123), "q1");
    const b = generateQuest(new Rng(123), "q1");
    expect(a).toEqual(b);
    expect(a.id).toBe("q1");
    expect(a.startedAt).toBe(0);
    expect(a.assigned).toEqual([]);
    expect(a.slots).toEqual(QUEST_TIERS[a.rarity].slots);
    expect(a.durationMs).toBe(QUEST_TIERS[a.rarity].durationMs);
  });

  it("rarityRank orders Common<…<Unique", () => {
    expect(rarityRank("Common")).toBeLessThan(rarityRank("Unique"));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/expeditionQuests.test.ts`
Expected: FAIL — cannot resolve `../src/data/expeditionQuests.ts`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/data/expeditionQuests.ts
/**
 * Expedition quest tiers. The board (core/expeditionBoard.ts) is built from these
 * pure definitions: one tier per Rarity, each fixing a dispatch duration, the
 * tower-slot rarity requirements, a board-generation weight, a player-facing
 * reward hint, and a seeded reward roll that scales up with rarity. Reward is
 * rolled at CLAIM time (a surprise) — never stored on the quest.
 */
import { RARITIES, type Rarity } from "./schemaEnums.ts";
import type { Reward } from "../core/rewards.ts";
import type { Rng } from "../core/rng.ts";
import {
  BLESS_JEWEL,
  SOUL_JEWEL,
  SUMMON_SCROLL,
  CHAOS_JEWEL,
  AWAKENING_CRYSTAL,
  JEWEL_OF_CHAOS,
  FEATHER,
} from "./materials.ts";

const MIN = 60 * 1000;
const HOUR = 60 * MIN;

/** Strength index of a rarity (Common = 0 … Unique = 4). */
export function rarityRank(r: Rarity): number {
  return RARITIES.indexOf(r);
}

/** Inclusive integer in [lo, hi] from one rng draw. */
function intRange(rng: Rng, lo: number, hi: number): number {
  return lo + Math.floor(rng.next() * (hi - lo + 1));
}

export interface QuestTierDef {
  rarity: Rarity;
  durationMs: number;
  /** Minimum rarity required per dispatched tower slot. */
  slots: Rarity[];
  /** Relative weight for board generation (higher = more common). */
  genWeight: number;
  /** [min, max] gold payout (also the tier's gold "floor" for ordering). */
  goldRange: [number, number];
  /** Short, spoiler-free payout hint shown on the card. */
  rewardHint: string;
  /** Roll the actual reward (surprise) — always grants at least some gold. */
  rewardRoll(rng: Rng): Reward;
}

/** Build a tier def, wiring the standard roll shape (gold + diamond + materials). */
function tier(
  rarity: Rarity,
  durationMs: number,
  slots: Rarity[],
  genWeight: number,
  goldRange: [number, number],
  rewardHint: string,
  roll: (rng: Rng, reward: Reward) => void,
): QuestTierDef {
  return {
    rarity,
    durationMs,
    slots,
    genWeight,
    goldRange,
    rewardHint,
    rewardRoll(rng: Rng): Reward {
      const reward: Reward = { gold: intRange(rng, goldRange[0], goldRange[1]) };
      roll(rng, reward);
      return reward;
    },
  };
}

/** Add `n` of a material to a reward bundle. */
function mat(reward: Reward, id: string, n: number): void {
  if (n <= 0) return;
  reward.materials = { ...(reward.materials ?? {}), [id]: (reward.materials?.[id] ?? 0) + n };
}

export const QUEST_TIERS: Record<Rarity, QuestTierDef> = {
  Common: tier("Common", 15 * MIN, ["Common"], 40, [80, 160], "Pocket change", (rng, r) => {
    if (rng.chance(0.1)) r.diamonds = 1;
    if (rng.chance(0.25)) mat(r, BLESS_JEWEL, 1);
  }),
  Magic: tier("Magic", 45 * MIN, ["Common", "Magic"], 27, [220, 420], "Tidy haul", (rng, r) => {
    if (rng.chance(0.3)) r.diamonds = intRange(rng, 1, 2);
    if (rng.chance(0.4)) mat(r, rng.chance(0.5) ? SOUL_JEWEL : BLESS_JEWEL, 1);
  }),
  Rare: tier("Rare", 2 * HOUR, ["Magic", "Rare"], 20, [600, 1050], "Solid loot · gems", (rng, r) => {
    if (rng.chance(0.5)) r.diamonds = intRange(rng, 2, 4);
    mat(r, SOUL_JEWEL, intRange(rng, 1, 2));
    if (rng.chance(0.25)) mat(r, SUMMON_SCROLL, 1);
  }),
  Legendary: tier(
    "Legendary",
    6 * HOUR,
    ["Rare", "Rare", "Legendary"],
    10,
    [1700, 3000],
    "Big haul · rare mats",
    (rng, r) => {
      if (rng.chance(0.8)) r.diamonds = intRange(rng, 5, 10);
      mat(r, AWAKENING_CRYSTAL, 1);
      if (rng.chance(0.5)) mat(r, CHAOS_JEWEL, 1);
      if (rng.chance(0.35)) mat(r, SUMMON_SCROLL, 1);
    },
  ),
  Unique: tier(
    "Unique",
    12 * HOUR,
    ["Legendary", "Legendary", "Unique"],
    3,
    [4800, 8000],
    "Jackpot · premium mats",
    (rng, r) => {
      r.diamonds = intRange(rng, 14, 28);
      mat(r, AWAKENING_CRYSTAL, 2);
      mat(r, JEWEL_OF_CHAOS, 1);
      mat(r, FEATHER, 1);
      mat(r, SUMMON_SCROLL, 1);
    },
  ),
};

/** A generated, persistable quest on the board. */
export interface QuestInstance {
  id: string;
  rarity: Rarity;
  slots: Rarity[];
  durationMs: number;
  /** 0 = Available; >0 = epoch ms the quest was dispatched. */
  startedAt: number;
  /** Tower ids locked to this quest while it runs. */
  assigned: string[];
}

/** Pick a tier by gen weight and instantiate an Available quest with the given id. */
export function generateQuest(rng: Rng, id: string): QuestInstance {
  const tiers = RARITIES.map((r) => QUEST_TIERS[r]);
  const total = tiers.reduce((s, t) => s + t.genWeight, 0);
  let roll = rng.next() * total;
  let chosen = tiers[0];
  for (const t of tiers) {
    roll -= t.genWeight;
    if (roll < 0) {
      chosen = t;
      break;
    }
  }
  return {
    id,
    rarity: chosen.rarity,
    slots: [...chosen.slots],
    durationMs: chosen.durationMs,
    startedAt: 0,
    assigned: [],
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/expeditionQuests.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/data/expeditionQuests.ts tests/expeditionQuests.test.ts
git commit -m "feat(expedition): pure quest-tier table + reward rolls + generator"
```

---

## Task 2: New save shape (meta + migration)

**Files:**
- Modify: `src/core/meta.ts` (replace `ExpeditionSave`, default, backfill)
- Modify: `src/core/save.ts` (add v10→v11 migration; bump `CURRENT_SAVE_VERSION`)
- Test: `tests/expedition.test.ts` (replace file — migration tests here)

- [ ] **Step 1: Replace the test file with migration coverage**

Replace the entire contents of `tests/expedition.test.ts` with:

```ts
import { describe, it, expect } from "vitest";
import { loadAndMigrate, CURRENT_SAVE_VERSION } from "../src/core/save.ts";

describe("expedition save migration v10→v11", () => {
  it("bumps a legacy idle-expedition save to a fresh empty board", () => {
    const legacy = {
      version: 10,
      meta: {
        expedition: { startedAt: 123, towerIds: ["a", "b"], lastCollectAt: 99 },
      },
    };
    const save = loadAndMigrate(legacy);
    expect(save.version).toBe(CURRENT_SAVE_VERSION);
    expect(save.meta.expedition.quests).toEqual([]);
    expect(save.meta.expedition.lastRerollDay).toBe("");
    expect(save.meta.expedition.nextQuestSeq).toBe(0);
  });

  it("a fresh save already has the board shape", () => {
    const save = loadAndMigrate(undefined);
    expect(Array.isArray(save.meta.expedition.quests)).toBe(true);
    expect(save.meta.expedition.nextQuestSeq).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/expedition.test.ts`
Expected: FAIL — `save.meta.expedition.quests` is undefined (still old shape) / `CURRENT_SAVE_VERSION` still 10.

- [ ] **Step 3a: Replace the `ExpeditionSave` interface in `src/core/meta.ts`**

Find:

```ts
/** F2 — Idle expedition (offline accrual). */
export interface ExpeditionSave {
  /** Epoch ms the current expedition began; 0 = none active. */
  startedAt: number;
  /** Tower ids dispatched (up to 3). */
  towerIds: string[];
  /** Epoch ms rewards were last collected (accrual baseline). */
  lastCollectAt: number;
}
```

Replace with:

```ts
import type { QuestInstance } from "../data/expeditionQuests.ts";

/** F2 — Expedition quest board (parallel dispatch quests). */
export interface ExpeditionSave {
  /** Active quests on the board (Available or Running). */
  quests: QuestInstance[];
  /** ISO yyyy-mm-dd of the last daily reroll of Available quests. */
  lastRerollDay: string;
  /** Monotonic counter that sources unique quest ids. */
  nextQuestSeq: number;
}
```

(Put the `import type { QuestInstance }` line with the other imports at the top of `meta.ts`, not inline.)

- [ ] **Step 3b: Update the default in `defaultMeta()`**

Find: `expedition: { startedAt: 0, towerIds: [], lastCollectAt: 0 },`
Replace with: `expedition: { quests: [], lastRerollDay: "", nextQuestSeq: 0 },`

- [ ] **Step 3c: Update `backfillMeta()` merge**

Find: `expedition: { ...d.expedition, ...meta.expedition },`
Replace with:

```ts
    expedition: {
      quests: meta.expedition?.quests ?? [],
      lastRerollDay: meta.expedition?.lastRerollDay ?? "",
      nextQuestSeq: meta.expedition?.nextQuestSeq ?? 0,
    },
```

- [ ] **Step 3d: Add the v10→v11 migration in `src/core/save.ts`**

Bump the constant: change `export const CURRENT_SAVE_VERSION = 10;` to `= 11;`.

After the existing `if ((save.version ?? 0) < 10) { … version: 10 }` block, add:

```ts
  if ((save.version ?? 0) < 11) {
    // Expedition redesign: the single idle run becomes a quest board. Any
    // in-flight idle accrual is forfeited (cosmetic) — reset to an empty board.
    save = {
      ...save,
      meta: {
        ...save.meta,
        expedition: { quests: [], lastRerollDay: "", nextQuestSeq: 0 },
      },
      version: 11,
    };
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/expedition.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/meta.ts src/core/save.ts tests/expedition.test.ts
git commit -m "feat(expedition): board save shape + v10→v11 migration"
```

---

## Task 3: Pure board core

**Files:**
- Create: `src/core/expeditionBoard.ts`
- Test: `tests/expeditionBoard.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/expeditionBoard.test.ts
import { describe, it, expect } from "vitest";
import { Rng } from "../src/core/rng.ts";
import { createFreshSave } from "../src/core/save.ts";
import type { HeroSave } from "../src/core/save.ts";
import {
  BOARD_SIZE,
  ensureBoard,
  questState,
  questRemainingMs,
  questAssignedTowerIds,
  eligibleTowersForSlot,
  assignmentMeetsSlots,
  startQuest,
  claimableQuestCount,
  claimQuest,
} from "../src/core/expeditionBoard.ts";
import { QUEST_TIERS } from "../src/data/expeditionQuests.ts";

// Hand-build a save owning towers of known rarity by reusing real tower ids.
import { TOWERS } from "../src/data/towers.ts";

function ownerOf(rarity: string): string {
  const t = TOWERS.find((t) => t.rarity === rarity);
  if (!t) throw new Error(`no tower of rarity ${rarity}`);
  return t.id;
}

function saveOwning(ids: string[]): HeroSave {
  const save = createFreshSave();
  for (const id of ids) save.collection[id] = { copies: 0, stars: 1 };
  return save;
}

describe("expedition board", () => {
  it("ensureBoard fills to BOARD_SIZE and is idempotent within a day", () => {
    const save = createFreshSave();
    ensureBoard(save, Date.parse("2026-06-14T10:00:00Z"), new Rng(1));
    expect(save.meta.expedition.quests.length).toBe(BOARD_SIZE);
    const ids = save.meta.expedition.quests.map((q) => q.id);
    ensureBoard(save, Date.parse("2026-06-14T18:00:00Z"), new Rng(2));
    expect(save.meta.expedition.quests.map((q) => q.id)).toEqual(ids); // same day → unchanged
  });

  it("daily reroll replaces Available quests but preserves Running ones", () => {
    const save = saveOwning([ownerOf("Common")]);
    ensureBoard(save, Date.parse("2026-06-14T10:00:00Z"), new Rng(1));
    // Force the first quest to Common with a single Common slot, then start it.
    const q = save.meta.expedition.quests[0];
    q.rarity = "Common";
    q.slots = ["Common"];
    q.durationMs = QUEST_TIERS.Common.durationMs;
    startQuest(save, q.id, [ownerOf("Common")], Date.parse("2026-06-14T10:05:00Z"));
    expect(questState(save.meta.expedition.quests[0], Date.parse("2026-06-14T10:06:00Z"))).toBe(
      "running",
    );
    ensureBoard(save, Date.parse("2026-06-15T09:00:00Z"), new Rng(9)); // next day
    const stillThere = save.meta.expedition.quests.find((x) => x.id === q.id);
    expect(stillThere).toBeTruthy(); // running quest preserved across reroll
    expect(save.meta.expedition.quests.length).toBe(BOARD_SIZE);
  });

  it("eligibility excludes squad + cross-quest-locked + under-rarity towers", () => {
    const rare = ownerOf("Rare");
    const common = ownerOf("Common");
    const save = saveOwning([rare, common]);
    save.squad = [common];
    const forRare = eligibleTowersForSlot(save, "Rare", []);
    expect(forRare).toContain(rare);
    expect(forRare).not.toContain(common); // in squad
    const forCommon = eligibleTowersForSlot(save, "Common", []);
    expect(forCommon).toContain(rare); // Rare satisfies a Common floor
    expect(forCommon).not.toContain(common); // squad
  });

  it("assignmentMeetsSlots accepts a valid matching, rejects wrong count / under-rarity", () => {
    const rare = ownerOf("Rare");
    const magic = ownerOf("Magic");
    const save = saveOwning([rare, magic]);
    const q = { id: "x", rarity: "Rare" as const, slots: ["Magic", "Rare"] as const as string[], durationMs: 1, startedAt: 0, assigned: [] };
    expect(assignmentMeetsSlots(save, q, [magic, rare])).toBe(true);
    expect(assignmentMeetsSlots(save, q, [rare])).toBe(false); // wrong count
    expect(assignmentMeetsSlots(save, q, [magic, magic])).toBe(false); // 2nd slot needs Rare
  });

  it("startQuest locks towers; quest is ready exactly at startedAt+duration", () => {
    const common = ownerOf("Common");
    const save = saveOwning([common]);
    ensureBoard(save, 0, new Rng(1));
    const q = save.meta.expedition.quests[0];
    q.rarity = "Common";
    q.slots = ["Common"];
    q.durationMs = 1000;
    startQuest(save, q.id, [common], 5000);
    expect(questAssignedTowerIds(save).has(common)).toBe(true);
    expect(questState(q, 5999)).toBe("running");
    expect(questRemainingMs(q, 5999)).toBe(1);
    expect(questState(q, 6000)).toBe("ready");
    expect(claimableQuestCount(save, 6000)).toBe(1);
  });

  it("claimQuest grants the reward, frees towers, and refills the slot; no-op before ready", () => {
    const common = ownerOf("Common");
    const save = saveOwning([common]);
    ensureBoard(save, 0, new Rng(1));
    const q = save.meta.expedition.quests[0];
    q.rarity = "Common";
    q.slots = ["Common"];
    q.durationMs = 1000;
    startQuest(save, q.id, [common], 0);
    const goldBefore = save.currency.gold;
    expect(claimQuest(save, q.id, 500, new Rng(3))).toEqual({}); // not ready yet
    const reward = claimQuest(save, q.id, 2000, new Rng(3));
    expect((reward.gold ?? 0)).toBeGreaterThan(0);
    expect(save.currency.gold).toBe(goldBefore + (reward.gold ?? 0));
    expect(questAssignedTowerIds(save).has(common)).toBe(false); // freed
    expect(save.meta.expedition.quests.length).toBe(BOARD_SIZE); // refilled
    expect(save.meta.expedition.quests.some((x) => x.id === q.id)).toBe(false); // replaced
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/expeditionBoard.test.ts`
Expected: FAIL — cannot resolve `../src/core/expeditionBoard.ts`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/core/expeditionBoard.ts
/**
 * Expedition quest board — pure logic over save.meta.expedition. The board holds
 * up to BOARD_SIZE quests; each is Available (assign spare towers that meet its
 * rarity slots), Running (locked for its duration), or Ready (claim a rolled,
 * rarity-scaled reward). Claiming frees the towers and refills the slot with a
 * fresh quest. A daily reroll rotates Available quests while preserving Running
 * ones. Phaser-free; every random decision flows through a seeded Rng.
 */
import type { HeroSave } from "./save.ts";
import type { Rng } from "./rng.ts";
import { grantReward, type Reward } from "./rewards.ts";
import { towerRarity } from "./collection.ts";
import { QUEST_TIERS, generateQuest, rarityRank, type QuestInstance } from "../data/expeditionQuests.ts";

export const BOARD_SIZE = 5;

export type QuestState = "available" | "running" | "ready";

/** ISO yyyy-mm-dd for a given epoch ms (UTC — matches the rest of the meta loop). */
function dayKey(nowMs: number): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}

/** Mint the next unique quest id and bump the save's counter. */
function nextId(save: HeroSave): string {
  const seq = save.meta.expedition.nextQuestSeq++;
  return `xq${seq}`;
}

export function questState(q: QuestInstance, nowMs: number): QuestState {
  if (q.startedAt <= 0) return "available";
  return nowMs >= q.startedAt + q.durationMs ? "ready" : "running";
}

export function questRemainingMs(q: QuestInstance, nowMs: number): number {
  if (q.startedAt <= 0) return 0;
  return Math.max(0, q.startedAt + q.durationMs - nowMs);
}

/** All tower ids locked by Running quests right now. */
export function questAssignedTowerIds(save: HeroSave): Set<string> {
  const ids = new Set<string>();
  for (const q of save.meta.expedition.quests) {
    if (q.startedAt > 0) for (const id of q.assigned) ids.add(id);
  }
  return ids;
}

/**
 * Fill the board to BOARD_SIZE and, once per day, reroll every Available quest
 * (Running quests are preserved). Idempotent within the same day.
 */
export function ensureBoard(save: HeroSave, nowMs: number, rng: Rng): void {
  const board = save.meta.expedition;
  const today = dayKey(nowMs);
  if (board.lastRerollDay !== today) {
    board.quests = board.quests.filter((q) => q.startedAt > 0); // keep Running, drop Available
    board.lastRerollDay = today;
  }
  while (board.quests.length < BOARD_SIZE) board.quests.push(generateQuest(rng, nextId(save)));
}

/**
 * Owned towers eligible for a slot: not in the battle squad, not locked by
 * another Running quest, not already picked in this dialog, rarity ≥ the floor.
 */
export function eligibleTowersForSlot(
  save: HeroSave,
  slotRarity: string,
  alreadyPicked: string[],
): string[] {
  const squad = new Set(save.squad ?? []);
  const locked = questAssignedTowerIds(save);
  const picked = new Set(alreadyPicked);
  const floor = rarityRank(slotRarity as never);
  return Object.keys(save.collection).filter(
    (id) =>
      !squad.has(id) &&
      !locked.has(id) &&
      !picked.has(id) &&
      rarityRank(towerRarity(id)) >= floor,
  );
}

/**
 * True if `towerIds` is a valid one-to-one assignment to `q.slots`: exact count,
 * all owned/eligible, and a matching where each tower meets its slot floor.
 * Greedy by ascending slot floor is optimal because slots are pure min-gates.
 */
export function assignmentMeetsSlots(
  save: HeroSave,
  q: QuestInstance,
  towerIds: string[],
): boolean {
  if (towerIds.length !== q.slots.length) return false;
  if (new Set(towerIds).size !== towerIds.length) return false; // no dupes
  const squad = new Set(save.squad ?? []);
  const locked = questAssignedTowerIds(save);
  for (const id of towerIds) {
    if (!(id in save.collection)) return false;
    if (squad.has(id) || locked.has(id)) return false;
  }
  // Match hardest slots to strongest towers (both sorted desc); each must fit.
  const slots = [...q.slots].sort((a, b) => rarityRank(b as never) - rarityRank(a as never));
  const towers = [...towerIds].sort((a, b) => rarityRank(towerRarity(b)) - rarityRank(towerRarity(a)));
  for (let i = 0; i < slots.length; i++) {
    if (rarityRank(towerRarity(towers[i])) < rarityRank(slots[i] as never)) return false;
  }
  return true;
}

/** Dispatch a quest: lock the towers and start its timer. No-op if invalid. */
export function startQuest(
  save: HeroSave,
  questId: string,
  towerIds: string[],
  nowMs: number,
): boolean {
  const q = save.meta.expedition.quests.find((x) => x.id === questId);
  if (!q || q.startedAt > 0) return false;
  if (!assignmentMeetsSlots(save, q, towerIds)) return false;
  q.assigned = [...towerIds];
  q.startedAt = nowMs;
  return true;
}

/** Number of Ready (claimable) quests on the board. */
export function claimableQuestCount(save: HeroSave, nowMs: number): number {
  return save.meta.expedition.quests.filter((q) => questState(q, nowMs) === "ready").length;
}

/**
 * Claim a Ready quest: roll its tier reward, grant it, free the towers, and
 * replace the quest in place with a freshly generated one. Returns {} if not
 * Ready (or unknown id).
 */
export function claimQuest(save: HeroSave, questId: string, nowMs: number, rng: Rng): Reward {
  const board = save.meta.expedition;
  const idx = board.quests.findIndex((x) => x.id === questId);
  if (idx < 0) return {};
  const q = board.quests[idx];
  if (questState(q, nowMs) !== "ready") return {};
  const reward = QUEST_TIERS[q.rarity].rewardRoll(rng);
  grantReward(save, reward);
  board.quests[idx] = generateQuest(rng, nextId(save)); // refill the slot
  return reward;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/expeditionBoard.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/expeditionBoard.ts tests/expeditionBoard.test.ts
git commit -m "feat(expedition): pure quest-board core (generate/assign/start/claim)"
```

---

## Task 4: SaveManager wrappers + delete old module

**Files:**
- Modify: `src/core/saveManager.ts` (swap idle methods for board methods; fix badge count)
- Delete: `src/core/expedition.ts`

- [ ] **Step 1: Replace the expedition import block in `saveManager.ts`**

Find (lines ~8-18):

```ts
import {
  expeditionActive,
  expeditionPendingGold,
  startExpedition,
  collectExpedition,
  expeditionGoldPerHour,
  expeditionGoldPerHourFor,
  expeditionCanCollect,
  expeditionCollectReadyAt,
  expeditionEligibleTowerIds,
} from "./expedition.ts";
```

Replace with:

```ts
import {
  ensureBoard,
  startQuest,
  claimQuest,
  claimableQuestCount,
  eligibleTowersForSlot,
} from "./expeditionBoard.ts";
import { Rng } from "./rng.ts";
```

(If `Rng` is already imported in `saveManager.ts`, do not add a duplicate import.)

- [ ] **Step 2: Replace the F2 method block**

Find the whole `// ── F2 Idle expedition ──` block (the 7 wrapper methods through `expeditionEligibleTowerIds`). Replace with:

```ts
  // ── F2 Expedition quest board ────────────────────────────────────────────────
  /** Fill/refresh the board (call on opening the Expedition screen). */
  ensureExpeditionBoard(nowMs = Date.now()): void {
    ensureBoard(this.save, nowMs, new Rng((nowMs & 0x7fffffff) || 1));
    this.persist();
  }
  /** The current board quests (Available / Running / Ready). */
  expeditionQuests() {
    return this.save.meta.expedition.quests;
  }
  /** Owned towers that satisfy a slot's rarity floor and aren't otherwise busy. */
  expeditionEligibleForSlot(slotRarity: string, alreadyPicked: string[]): string[] {
    return eligibleTowersForSlot(this.save, slotRarity, alreadyPicked);
  }
  /** Dispatch a quest; returns whether it started. */
  startExpeditionQuest(questId: string, towerIds: string[], nowMs = Date.now()): boolean {
    const ok = startQuest(this.save, questId, towerIds, nowMs);
    if (ok) this.persist();
    return ok;
  }
  /** Claim a Ready quest; returns the rolled reward ({} if not ready). */
  claimExpeditionQuest(questId: string, nowMs = Date.now()) {
    const reward = claimQuest(this.save, questId, nowMs, new Rng((nowMs & 0x7fffffff) || 1));
    this.persist();
    return reward;
  }
  /** Count of Ready quests (drives the Activities badge). */
  expeditionClaimable(nowMs = Date.now()): number {
    return claimableQuestCount(this.save, nowMs);
  }
```

NOTE: confirm the private persist method's real name first — run
`grep -n "persist\|private save\b\|this.provider.save" src/core/saveManager.ts src/core/saveManagerCore.ts`.
If saves are persisted via a differently-named method (e.g. `this.flush()` or
`this.write()`), use that exact name in place of `this.persist()` above.

- [ ] **Step 3: Fix the pending-action badge count**

In `saveManager.ts` find (line ~133):

```ts
    if (expeditionCanCollect(this.save, nowMs) && expeditionPendingGold(this.save, nowMs) > 0) n++;
```

Replace with:

```ts
    n += claimableQuestCount(this.save, nowMs);
```

(`claimableQuestCount` is already imported via Step 1.)

- [ ] **Step 4: Delete the superseded module**

```bash
git rm src/core/expedition.ts
```

- [ ] **Step 5: Typecheck (the UI still references old methods — expect ExpeditionScene/ActivitiesScene errors only)**

Run: `npx tsc --noEmit`
Expected: errors ONLY in `src/scenes/ExpeditionScene.ts` and `src/scenes/ActivitiesScene.ts` (old method calls). `core/` and `data/` must be clean. If any `core/` error appears (e.g. wrong persist name), fix it now.

- [ ] **Step 6: Run core tests**

Run: `npx vitest run tests/expeditionBoard.test.ts tests/expeditionQuests.test.ts tests/expedition.test.ts`
Expected: PASS (all).

- [ ] **Step 7: Commit**

```bash
git add src/core/saveManager.ts
git rm src/core/expedition.ts
git commit -m "feat(expedition): SaveManager board wrappers; remove idle module"
```

---

## Task 5: Assign-dialog presenter

**Files:**
- Create: `src/scenes/questAssignDialog.ts`

This is a pure-ish presenter (Phaser GameObjects, no new logic). It draws a modal
over the board: the quest's slots and a grid of eligible towers; the player taps
to fill slots in order; a Dispatch button calls back when the assignment is valid.

- [ ] **Step 1: Create the presenter**

```ts
// src/scenes/questAssignDialog.ts
/**
 * questAssignDialog — modal tower picker for an Expedition quest. Shows the
 * quest's rarity slots and a grid of eligible spare towers (rarity ≥ each slot's
 * floor, not in the squad, not locked by another quest). The player taps to fill
 * slots in order; when the picked set satisfies every slot, Dispatch fires the
 * onConfirm callback with the chosen tower ids. Owns its own container; close()
 * tears it down. Kept separate so ExpeditionScene stays under the 500-line cap.
 */
import Phaser from "phaser";
import { crispText } from "./ui.ts";
import { addNamePlate } from "./namePlate.ts";
import { dimBackdrop } from "./uiKit.ts";
import type { SaveManager } from "../core/saveManager.ts";
import type { QuestInstance } from "../data/expeditionQuests.ts";
import { assignmentMeetsSlots } from "../core/expeditionBoard.ts";
import { TOWERS } from "../data/towers.ts";
import { getTowerStars } from "../core/collection.ts";
import { towerTex } from "../data/assetKeys.ts";
import { RARITY_HEX, RARITY_INT } from "../data/rarityColors.ts";

const W = 960;
const H = 540;

export class QuestAssignDialog {
  private root: Phaser.GameObjects.Container;
  private picked: string[] = [];

  constructor(
    private scene: Phaser.Scene,
    private mgr: SaveManager,
    private quest: QuestInstance,
    private onConfirm: (towerIds: string[]) => void,
  ) {
    this.root = scene.add.container(0, 0).setDepth(400);
    this.draw();
  }

  close(): void {
    this.root.destroy(true);
  }

  private toggle(id: string): void {
    const i = this.picked.indexOf(id);
    if (i >= 0) this.picked.splice(i, 1);
    else if (this.picked.length < this.quest.slots.length) this.picked.push(id);
    this.draw();
  }

  private draw(): void {
    this.root.removeAll(true);
    // Backdrop blocks clicks to the board behind.
    this.root.add(dimBackdrop(this.scene, 0.6).setInteractive());
    const px = 40,
      py = 40,
      pw = W - 80,
      ph = H - 80;
    const g = this.scene.add.graphics();
    g.fillStyle(0x121a26, 1).fillRoundedRect(px, py, pw, ph, 14);
    g.lineStyle(2, RARITY_INT[this.quest.rarity], 1).strokeRoundedRect(px, py, pw, ph, 14);
    this.root.add(g);

    this.root.add(
      crispText(this.scene, W / 2, py + 14, `Assign — ${this.quest.rarity} Expedition`, {
        fontSize: "20px",
        color: RARITY_HEX[this.quest.rarity],
        fontStyle: "bold",
      }).setOrigin(0.5, 0),
    );

    // Slot requirement chips.
    const slotsLabel = this.quest.slots.map((s, i) => `${i + 1}: ≥${s}`).join("    ");
    this.root.add(
      crispText(this.scene, W / 2, py + 44, `Slots — ${slotsLabel}`, {
        fontSize: "13px",
        color: "#cfe0f5",
      }).setOrigin(0.5, 0),
    );

    this.drawGrid(px, py + 76, pw);

    // Footer: validity + Dispatch / Cancel.
    const valid = assignmentMeetsSlots(this.mgr.getSave(), this.quest, this.picked);
    this.root.add(
      crispText(
        this.scene,
        px + 20,
        py + ph - 30,
        `Picked ${this.picked.length}/${this.quest.slots.length}` +
          (this.picked.length === this.quest.slots.length && !valid
            ? " — picks don't meet the rarity slots"
            : ""),
        { fontSize: "13px", color: valid ? "#9fe0b0" : "#ffd56a" },
      ),
    );
    this.dialogButton(px + pw - 230, py + ph - 34, "Cancel", "#5a3a3a", true, () => this.close());
    this.dialogButton(px + pw - 110, py + ph - 34, "Dispatch", "#1f8f43", valid, () => {
      this.onConfirm([...this.picked]);
      this.close();
    });
  }

  private drawGrid(x0: number, y0: number, areaW: number): void {
    const save = this.mgr.getSave();
    // Union of every tower eligible for ANY slot (so the player sees the full bench).
    const seen = new Set<string>();
    for (const slot of this.quest.slots)
      for (const id of this.mgr.expeditionEligibleForSlot(slot, [])) seen.add(id);
    const owned = TOWERS.filter((t) => seen.has(t.id)).sort(
      (a, b) => RARITY_INT[b.rarity] - RARITY_INT[a.rarity] || a.name.localeCompare(b.name),
    );
    if (owned.length === 0) {
      this.root.add(
        crispText(this.scene, x0 + 20, y0, "No spare heroes meet these slots — free up squad towers or summon more.", {
          fontSize: "13px",
          color: "#90a4bb",
          wordWrap: { width: areaW - 40 },
        }),
      );
      return;
    }
    const COLS = 7,
      CW = 122,
      CH = 92,
      startX = x0 + 24,
      maxRows = 3;
    owned.slice(0, COLS * maxRows).forEach((t, idx) => {
      const cx = startX + (idx % COLS) * CW;
      const cy = y0 + Math.floor(idx / COLS) * CH;
      this.root.add(this.makeTile(t.id, t.name, t.rarity, cx, cy, CW - 12, CH - 12, getTowerStars(save, t.id)));
    });
  }

  private makeTile(
    id: string,
    name: string,
    rarity: import("../data/schemaEnums.ts").Rarity,
    cx: number,
    cy: number,
    w: number,
    h: number,
    stars: number,
  ): Phaser.GameObjects.Container {
    const order = this.picked.indexOf(id);
    const picked = order >= 0;
    const c = this.scene.add.container(cx + w / 2, cy + h / 2).setSize(w, h);
    const g = this.scene.add.graphics();
    g.fillStyle(picked ? 0x1f3322 : 0x18202c, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 6);
    g.lineStyle(picked ? 3 : 1.5, picked ? 0x52c878 : RARITY_INT[rarity], picked ? 1 : 0.85).strokeRoundedRect(
      -w / 2,
      -h / 2,
      w,
      h,
      6,
    );
    c.add(g);
    const key = towerTex(id);
    if (this.scene.textures.exists(key)) {
      const img = this.scene.add.image(0, -10, key).setOrigin(0.5);
      img.setScale(44 / img.height);
      c.add(img);
    }
    addNamePlate(this.scene, c, name, {
      width: w,
      topY: h / 2 - 24,
      height: 24,
      radius: 6,
      accent: RARITY_INT[rarity],
      color: RARITY_HEX[rarity],
      basePx: 9,
      minPx: 7,
      maxLines: 2,
    });
    if (stars > 0)
      c.add(crispText(this.scene, -w / 2 + 4, -h / 2 + 3, "★".repeat(stars), { fontSize: "9px", color: "#ffd24a" }));
    if (picked)
      c.add(
        crispText(this.scene, w / 2 - 6, -h / 2 + 3, `${order + 1}`, {
          fontSize: "12px",
          color: "#a5f0b8",
          fontStyle: "bold",
        }).setOrigin(1, 0),
      );
    c.setInteractive({ useHandCursor: true });
    c.on("pointerup", () => this.toggle(id));
    return c;
  }

  private dialogButton(x: number, y: number, label: string, color: string, enabled: boolean, cb: () => void): void {
    const t = crispText(this.scene, x, y, label, {
      fontSize: "15px",
      color: enabled ? "#ffffff" : "#7a8699",
      backgroundColor: enabled ? color : "#2a3340",
      fontStyle: "bold",
    })
      .setOrigin(0, 0)
      .setPadding(14, 7, 14, 7);
    if (enabled) {
      t.setInteractive({ useHandCursor: true });
      t.on("pointerup", cb);
    }
    this.root.add(t);
  }
}
```

NOTE: confirm `dimBackdrop` exists and its signature with
`grep -n "export function dimBackdrop" src/scenes/uiKit.ts`. If its signature
differs (e.g. takes `(scene, alpha, depth)` or returns a Rectangle already
interactive), adapt the single call in `draw()`. If it does not exist, replace
that line with a full-screen semi-opaque rectangle:
`this.scene.add.rectangle(W/2, H/2, W, H, 0x000000, 0.6).setInteractive()` added to `this.root`.

- [ ] **Step 2: Typecheck just this file's module graph**

Run: `npx tsc --noEmit`
Expected: no NEW errors from `questAssignDialog.ts` (ExpeditionScene/ActivitiesScene old-method errors from Task 4 may still remain until Task 6/7).

- [ ] **Step 3: Commit**

```bash
git add src/scenes/questAssignDialog.ts
git commit -m "feat(expedition): assign-dialog tower-picker presenter"
```

---

## Task 6: Rewrite ExpeditionScene as the board

**Files:**
- Rewrite: `src/scenes/ExpeditionScene.ts`

- [ ] **Step 1: Replace the whole file**

```ts
// src/scenes/ExpeditionScene.ts
/**
 * ExpeditionScene — the quest board. Renders up to BOARD_SIZE quest cards, each
 * Available (Assign → tower-picker dialog), Running (live countdown + assigned
 * tower icons), or Ready (Claim → rolled, rarity-scaled reward). The board is
 * filled/rerolled on entry; countdowns tick on a 1s timer that only re-renders
 * when a quest crosses into Ready. Reward rolls + persistence live in the core.
 */
import Phaser from "phaser";
import { fadeIn, fadeToScene } from "./uiKit.ts";
import { crispText } from "./ui.ts";
import { rewardEmojis } from "./rewardBurst.ts";
import { rewardLabel } from "../core/rewards.ts";
import type { SaveManager } from "../core/saveManager.ts";
import { QuestAssignDialog } from "./questAssignDialog.ts";
import { QUEST_TIERS, type QuestInstance } from "../data/expeditionQuests.ts";
import { questState, questRemainingMs } from "../core/expeditionBoard.ts";
import { towerTex } from "../data/assetKeys.ts";
import { RARITY_HEX, RARITY_INT } from "../data/rarityColors.ts";

const W = 960;
const CARD_X = 24;
const CARD_W = W - 48;
const CARD_H = 84;
const CARD_GAP = 10;
const TOP = 56;

/** Human "5h 02m" / "3m 20s" / "ready" countdown. */
function fmt(ms: number): string {
  if (ms <= 0) return "ready";
  const s = Math.ceil(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${String(sec).padStart(2, "0")}s`;
  return `${sec}s`;
}

export class ExpeditionScene extends Phaser.Scene {
  private mgr!: SaveManager;
  private layer!: Phaser.GameObjects.Container;
  private toast!: Phaser.GameObjects.Text;
  /** Per-card live countdown labels, keyed by quest id (Running only). */
  private timerLabels = new Map<string, Phaser.GameObjects.Text>();

  constructor() {
    super("ExpeditionScene");
  }

  create(): void {
    fadeIn(this);
    this.timerLabels.clear();
    this.mgr = this.registry.get("saveManager");
    this.mgr.ensureExpeditionBoard();

    crispText(this, W / 2, 10, "🧭 Expedition Board", {
      fontSize: "22px",
      color: "#ffd700",
      fontStyle: "bold",
    })
      .setOrigin(0.5, 0)
      .setDepth(50);
    crispText(this, 20, 12, "← Back", { fontSize: "15px", color: "#90caf9" })
      .setDepth(50)
      .setInteractive({ useHandCursor: true })
      .on("pointerup", () => fadeToScene(this, "ActivitiesScene"));

    this.layer = this.add.container(0, 0);
    this.toast = crispText(this, W / 2, 520, "", {
      fontSize: "13px",
      color: "#ffe1a8",
      backgroundColor: "#2a1f14",
    })
      .setOrigin(0.5)
      .setPadding(10, 5, 10, 5)
      .setDepth(60)
      .setVisible(false);

    this.redraw();
    // Tick countdowns once a second; flip to Ready (full redraw) when due.
    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.tick() });
  }

  private tick(): void {
    const now = Date.now();
    let needsRedraw = false;
    for (const q of this.mgr.expeditionQuests()) {
      const label = this.timerLabels.get(q.id);
      if (!label) continue;
      if (questState(q, now) === "ready") {
        needsRedraw = true;
        break;
      }
      label.setText(fmt(questRemainingMs(q, now)));
    }
    if (needsRedraw) this.redraw();
  }

  private redraw(): void {
    this.layer.removeAll(true);
    this.timerLabels.clear();
    const quests = this.mgr.expeditionQuests();
    const ready = this.mgr.expeditionClaimable();
    this.layer.add(
      crispText(this, W / 2, 36, `${quests.length} quests · ${ready} ready to claim`, {
        fontSize: "13px",
        color: ready > 0 ? "#ffd56a" : "#90a4bb",
        fontStyle: "bold",
      }).setOrigin(0.5, 0),
    );
    quests.forEach((q, i) => this.drawCard(q, TOP + i * (CARD_H + CARD_GAP)));
  }

  private drawCard(q: QuestInstance, y: number): void {
    const now = Date.now();
    const state = questState(q, now);
    const accent = RARITY_INT[q.rarity];
    const g = this.add.graphics();
    g.fillStyle(state === "ready" ? 0x1f2a18 : 0x161d28, 1).fillRoundedRect(CARD_X, y, CARD_W, CARD_H, 10);
    g.lineStyle(2, state === "ready" ? 0xffc94d : accent, 1).strokeRoundedRect(CARD_X, y, CARD_W, CARD_H, 10);
    this.layer.add(g);

    this.layer.add(
      crispText(this, CARD_X + 14, y + 10, `${q.rarity} Expedition`, {
        fontSize: "16px",
        color: RARITY_HEX[q.rarity],
        fontStyle: "bold",
      }),
    );
    const tier = QUEST_TIERS[q.rarity];
    this.layer.add(
      crispText(this, CARD_X + 14, y + 32, `Needs ${q.slots.map((s) => `≥${s}`).join(" + ")}`, {
        fontSize: "11px",
        color: "#aab8cc",
      }),
    );
    this.layer.add(
      crispText(this, CARD_X + 14, y + 50, `Reward: ${tier.rewardHint}  ·  ${fmtDuration(q.durationMs)}`, {
        fontSize: "11px",
        color: "#ffe07a",
      }),
    );

    if (state === "available") this.drawAvailable(q, y);
    else this.drawRunningOrReady(q, state, y, now);
  }

  private drawAvailable(q: QuestInstance, y: number): void {
    this.button(CARD_X + CARD_W - 16, y + CARD_H / 2, "Assign", "#3a6a9a", true, () => {
      new QuestAssignDialog(this, this.mgr, q, (towerIds) => {
        if (this.mgr.startExpeditionQuest(q.id, towerIds)) {
          this.showToast(`Dispatched ${towerIds.length} hero${towerIds.length === 1 ? "" : "es"}!`);
          this.redraw();
        }
      });
    });
  }

  private drawRunningOrReady(q: QuestInstance, state: "running" | "ready", y: number, now: number): void {
    // Assigned tower icons (small).
    q.assigned.forEach((id, i) => {
      const key = towerTex(id);
      if (!this.textures.exists(key)) return;
      const img = this.add.image(CARD_X + CARD_W - 220 + i * 34, y + CARD_H / 2, key).setOrigin(0.5);
      img.setScale(30 / img.height);
      this.layer.add(img);
    });
    if (state === "ready") {
      this.button(CARD_X + CARD_W - 16, y + CARD_H / 2, "Claim", "#1f8f43", true, () => {
        const reward = this.mgr.claimExpeditionQuest(q.id);
        const label = rewardLabel(reward);
        if (label) this.celebrate(y + CARD_H / 2, rewardEmojis(reward), label);
        this.showToast(`Expedition: ${label || "claimed"}`);
        this.redraw();
      });
    } else {
      const label = crispText(this, CARD_X + CARD_W - 16, y + CARD_H / 2, fmt(questRemainingMs(q, now)), {
        fontSize: "16px",
        color: "#9fd0ff",
        fontStyle: "bold",
      }).setOrigin(1, 0.5);
      this.layer.add(label);
      this.timerLabels.set(q.id, label);
    }
  }

  private button(x: number, y: number, label: string, color: string, enabled: boolean, cb: () => void): void {
    const t = crispText(this, x, y, label, {
      fontSize: "15px",
      color: enabled ? "#ffffff" : "#7a8699",
      backgroundColor: enabled ? color : "#2a3340",
      fontStyle: "bold",
    })
      .setOrigin(1, 0.5)
      .setPadding(16, 7, 16, 7);
    if (enabled) {
      t.setInteractive({ useHandCursor: true });
      t.on("pointerup", cb);
    }
    this.layer.add(t);
  }

  /** One-shot emoji burst on the scene root (survives the redraw of `layer`). */
  private celebrate(centerY: number, emojis: string[], _label: string): void {
    emojis.slice(0, 5).forEach((e, i) => {
      const t = crispText(this, CARD_X + CARD_W - 60 + i * 6, centerY, e, { fontSize: "20px" }).setDepth(120);
      this.tweens.add({
        targets: t,
        y: centerY - 40,
        alpha: 0,
        duration: 900,
        delay: i * 60,
        onComplete: () => t.destroy(),
      });
    });
  }

  private showToast(msg: string): void {
    this.toast.setText(msg).setVisible(true);
    this.time.delayedCall(1800, () => this.toast.setVisible(false));
  }
}

/** "15m" / "2h" / "12h" duration label from ms. */
function fmtDuration(ms: number): string {
  const min = Math.round(ms / 60000);
  return min >= 60 ? `${Math.round(min / 60)}h` : `${min}m`;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: errors now ONLY in `src/scenes/ActivitiesScene.ts` (old expedition methods). ExpeditionScene + questAssignDialog clean.

NOTE: confirm `rewardEmojis` is exported from `./rewardBurst.ts` with
`grep -n "export function rewardEmojis" src/scenes/rewardBurst.ts`. It is used by
the existing ActivitiesScene, so it exists; keep the import path identical.

- [ ] **Step 3: Commit**

```bash
git add src/scenes/ExpeditionScene.ts
git commit -m "feat(expedition): board scene with quest cards + live countdowns"
```

---

## Task 7: Activities hub summary card

**Files:**
- Modify: `src/scenes/ActivitiesScene.ts` (rewrite `drawExpedition`; fix imports)

- [ ] **Step 1: Replace the expedition import in ActivitiesScene**

Find: `import { expeditionActive, expeditionPendingGold } from "../core/expedition.ts";`
Delete that line (the new `drawExpedition` uses only `this.mgr` board methods +
`rewardLabel`/`rewardEmojis`, which are already imported).

- [ ] **Step 2: Replace the `drawExpedition` method body**

Replace the whole `private drawExpedition(y: number): number { … }` method with:

```ts
  private drawExpedition(y: number): number {
    const now = Date.now();
    this.mgr.ensureExpeditionBoard(now);
    const quests = this.mgr.expeditionQuests();
    const ready = this.mgr.expeditionClaimable(now);
    const running = quests.filter((q) => q.startedAt > 0 && q.startedAt + q.durationMs > now).length;
    const h = 72;
    this.panel(y, h, 0x33405a, ready > 0);
    this.layer.add(
      crispText(this, PANEL_X + 16, y + 8, "🧭 Expedition Board", {
        fontSize: "16px",
        color: "#ffe9b0",
        fontStyle: "bold",
      }),
    );
    this.layer.add(
      crispText(
        this,
        PANEL_X + 16,
        y + 32,
        `${quests.length} quests  ·  ${running} running  ·  ${ready} ready to claim`,
        { fontSize: "12px", color: ready > 0 ? "#ffd56a" : "#9fb0c4" },
      ),
    );
    this.layer.add(
      crispText(
        this,
        PANEL_X + 16,
        y + 50,
        "Dispatch spare heroes on rarity-gated quests for timed, rarity-scaled rewards.",
        { fontSize: "11px", color: "#9fb0c4" },
      ),
    );
    if (ready > 0) {
      this.linkText(PANEL_X + PANEL_W - 130, y + h / 2, "Claim all ›", () => {
        let label = "";
        for (const q of [...this.mgr.expeditionQuests()]) {
          if (q.startedAt > 0 && q.startedAt + q.durationMs <= now) {
            const r = this.mgr.claimExpeditionQuest(q.id, now);
            label = rewardLabel(r) || label;
          }
        }
        if (label) this.celebrate(y + h / 2, rewardEmojis({ gold: 1 }), "Claimed!", 0x7fd0ff);
        this.showToast(`Claimed ${ready} expedition${ready === 1 ? "" : "s"}`);
        this.redraw();
      });
    }
    this.button(PANEL_X + PANEL_W - 16, y + h / 2, "Open ›", "#3a6a9a", true, () =>
      fadeToScene(this, "ExpeditionScene"),
    );
    return y + h + 12;
  }
```

- [ ] **Step 3: Remove the now-unused `minutesUntil` helper if nothing else uses it**

Run: `grep -n "minutesUntil" src/scenes/ActivitiesScene.ts`
If the only references are its own definition (no callers remain), delete the
`private minutesUntil(...)` method to satisfy the no-unused-locals lint. If other
callers exist, leave it.

- [ ] **Step 4: Typecheck (whole project must be clean now)**

Run: `npx tsc --noEmit`
Expected: PASS — zero errors.

- [ ] **Step 5: Commit**

```bash
git add src/scenes/ActivitiesScene.ts
git commit -m "feat(expedition): Activities hub board summary + Claim All"
```

---

## Task 8: Full verification + playtest + memory

**Files:** none (verification only) + memory update outside the repo.

- [ ] **Step 1: Full test suite**

Run: `npx vitest run`
Expected: all green (prior 1236 + new expedition tests; the removed idle-run tests are replaced by the migration tests).

- [ ] **Step 2: Lint + build**

Run: `npm run lint && npm run build`
Expected: 0 lint errors (pre-existing `any` warnings OK); build succeeds. If any
file exceeds 500 lines, split it (ExpeditionScene/questAssignDialog were designed
under the cap; re-check with `wc -l`).

- [ ] **Step 3: Live CDP playtest**

Start Vite + headless Chrome (both `run_in_background: true`; verify
`curl localhost:5173` = 200 and `curl localhost:9222/json/version`). Then, via
`window.__game`:
- `scene.start("ExpeditionScene")` → assert it's active, header shows
  `5 quests · 0 ready to claim`, and 5 cards render.
- Import the core in-browser, seed a Ready quest:
  `const m = await import("/src/core/expeditionBoard.ts"); const mgr = __game.registry.get("saveManager"); const sv = mgr.getSave(); const q = sv.meta.expedition.quests[0]; q.rarity="Common"; q.slots=["Common"]; q.durationMs=1; q.assigned=[Object.keys(sv.collection)[0]||"x"]; q.startedAt=1;` then `scene.getScene("ExpeditionScene").scene.restart()` → assert one card shows **Claim** and header says `1 ready to claim`.
- Screenshot `/tmp/expedition_board.png`. Assert 0 `Runtime.exceptionThrown`.
- Kill both background processes when done (the `[v]ite` pkill trick).

- [ ] **Step 4: Update memory**

Update `~/.claude/projects/.../memory/`:
- Edit the existing project memory (or add a new `project_expedition_quest_board.md`)
  describing: Expedition is now a quest board (data/expeditionQuests.ts tier table
  + core/expeditionBoard.ts), save v10→v11, parallel rarity-gated timed quests,
  random rarity-scaled rewards rolled at claim, board size 5 + daily reroll,
  ExpeditionScene + questAssignDialog presenters, Activities hub shows a summary +
  Claim All. Add a one-line pointer in `MEMORY.md`.

- [ ] **Step 5: Final clean-tree check**

Run: `git status --short`
Expected: clean (all work committed). Report the commit list and screenshot.

---

## Self-Review

**Spec coverage:**
- Tier table (durations/slots/weights/reward rolls/hint) → Task 1 ✓
- `generateQuest` weighted pick → Task 1 ✓
- Board save shape + v10→v11 migration → Task 2 ✓
- ensureBoard / state / remaining / eligibility / assignment / start / claimable / claim → Task 3 ✓
- SaveManager wrappers + badge count + delete old module → Task 4 ✓
- Assign-dialog tower picker → Task 5 ✓
- Board scene with countdowns → Task 6 ✓
- Activities hub summary + Claim All → Task 7 ✓
- Verify/playtest/memory → Task 8 ✓

**Placeholder scan:** No TBD/TODO; every code step shows full code. Three NOTE
callouts ask the engineer to confirm a real symbol name (`persist`, `dimBackdrop`,
`rewardEmojis`) before use — these are verification guards, not placeholders, and
each gives a concrete fallback.

**Type consistency:** `QuestInstance` defined in Task 1, imported everywhere
after. `ExpeditionSave` fields `{quests,lastRerollDay,nextQuestSeq}` consistent
across meta default (T2), backfill (T2), migration (T2), and core (T3). Method
names match between SaveManager (T4) and consumers (T6/T7):
`ensureExpeditionBoard`, `expeditionQuests`, `expeditionEligibleForSlot`,
`startExpeditionQuest`, `claimExpeditionQuest`, `expeditionClaimable`. Core
functions `questState`/`questRemainingMs` imported directly by the scene (T6),
matching their Task 3 signatures.

**Risks handled:** save migration tested (T2); tower double-booking via single
`questAssignedTowerIds` source (T3, tested); file-size via scene/dialog split;
timer churn via 1s text-only tick that only full-redraws on Ready transition.
