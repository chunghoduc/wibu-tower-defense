# Expedition Rarity Icons, Reward Icons & Free Daily Rerolls — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the Expedition board, show each quest's required slot rarities as gem icons and its reward pool as reward icons (not text), and let the player reroll the board up to 5 times per day for free.

**Architecture:** Three independent slices. (1) Pure `raritySlotRow` geometry + SDXL rarity-gem art rendered exists()-gated with a procedural faceted-gem fallback. (2) Pure `tierRewardPreview` built from the existing `rewardIcon.ts` single source, rendered with the existing `makeFitIcon` pattern. (3) Pure `rerollBoard` + daily-reset counter on `ExpeditionSave`, save v12→13, SaveManager wrapper, and a reroll button. Pure modules are Phaser-free and unit-tested RED-first.

**Tech Stack:** TypeScript, Phaser 3, vitest, Vite. SDXL art via `scripts/sdart`.

---

## File Structure

- `src/scenes/raritySlotRow.ts` — **new** pure gem-row geometry.
- `src/scenes/raritySlotRow.test.ts` — **new** tests.
- `src/data/assetKeys.ts` — add `rarityTex`.
- `src/data/expeditionQuests.ts` — add `tierRewardPreview`.
- `src/data/expeditionQuests.test.ts` — **new/extend** tests for `tierRewardPreview`.
- `src/core/meta.ts` — extend `ExpeditionSave` + default + backfill.
- `src/core/expeditionBoard.ts` — `REROLL_PER_DAY`, `resetDailyRerolls`, `rerollBoard`.
- `src/core/expeditionBoard.test.ts` — **extend** with reroll + reset tests.
- `src/core/save.ts` — `CURRENT_SAVE_VERSION` 12→13 + v13 migration hop.
- `src/core/save.test.ts` (or existing migration test) — **extend** with v12→13 backfill test.
- `src/core/saveManager.ts` — `rerollExpeditionBoard`, `expeditionRerollsLeft`.
- `src/scenes/ExpeditionScene.ts` — gem row, reward icon row, reroll button.
- `src/scenes/PreloadScene.ts` — load `rarity__<Rarity>` icons.
- `scripts/sdart/prompts.mjs` + `prompts.d.mts` — `RARITY_GEM_VISUAL` + `rarityGemStyle`.
- `scripts/sdart/sdgen.mjs` — rarity-gem job loop.
- `src/data/assetVersion.ts` — bump `ASSET_VERSION` after art regen.
- `scripts/playtest/repro_expedition_icons.mjs` — **new** CDP repro.

---

## Task 1: `rarityTex` asset key

**Files:**
- Modify: `src/data/assetKeys.ts`
- Test: `src/data/assetKeys.test.ts` (extend if present; else add a focused test file)

- [ ] **Step 1: Write the failing test**

Add to `src/data/assetKeys.test.ts` (create the file if it does not exist, importing the same way sibling tests do):

```ts
import { describe, it, expect } from "vitest";
import { rarityTex } from "./assetKeys.ts";

describe("rarityTex", () => {
  it("builds the rarity__<rarity> key", () => {
    expect(rarityTex("Legendary")).toBe("rarity__Legendary");
    expect(rarityTex("Common")).toBe("rarity__Common");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/assetKeys.test.ts`
Expected: FAIL — `rarityTex is not a function` / not exported.

- [ ] **Step 3: Add the key builder**

In `src/data/assetKeys.ts`, after the `achievementTex` line (~line 32):

```ts
export const rarityTex = (rarity: string): string => `rarity__${rarity}`;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/data/assetKeys.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/assetKeys.ts src/data/assetKeys.test.ts
git commit -m "feat(expedition): add rarityTex asset key"
```

---

## Task 2: Pure `raritySlotRow` geometry

**Files:**
- Create: `src/scenes/raritySlotRow.ts`
- Test: `src/scenes/raritySlotRow.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { raritySlotRow, GEM, GAP } from "./raritySlotRow.ts";
import type { Rarity } from "../data/schemaEnums.ts";

describe("raritySlotRow", () => {
  it("returns one gem per slot, left-to-right, fixed size", () => {
    const slots: Rarity[] = ["Common", "Magic", "Rare"];
    const row = raritySlotRow(slots, 100, 50);
    expect(row).toHaveLength(3);
    expect(row.map((g) => g.rarity)).toEqual(slots);
    expect(row.every((g) => g.size === GEM)).toBe(true);
    expect(row[0].cy).toBe(50);
    // strictly increasing centres, spaced by GEM + GAP
    expect(row[1].cx - row[0].cx).toBe(GEM + GAP);
    expect(row[2].cx - row[1].cx).toBe(GEM + GAP);
    // first gem centre is x + half a gem
    expect(row[0].cx).toBe(100 + GEM / 2);
  });

  it("empty slots → empty row", () => {
    expect(raritySlotRow([], 0, 0)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/scenes/raritySlotRow.test.ts`
Expected: FAIL — cannot find module `./raritySlotRow.ts`.

- [ ] **Step 3: Write minimal implementation**

Create `src/scenes/raritySlotRow.ts`:

```ts
/**
 * Pure layout for the row of rarity gems that shows a quest's required tower-slot
 * rarities on the Expedition card. Left-to-right, fixed-size gems with a fixed
 * gap; Phaser-free so the geometry is unit-tested. The presenter draws a
 * rarity__<rarity> texture at each centre, falling back to a procedural gem.
 */
import type { Rarity } from "../data/schemaEnums.ts";

/** Gem diameter in px. */
export const GEM = 18;
/** Horizontal gap between gems in px. */
export const GAP = 4;

export interface RaritySlotGem {
  rarity: Rarity;
  /** Gem centre x. */
  cx: number;
  /** Gem centre y. */
  cy: number;
  /** Gem box size (== GEM). */
  size: number;
}

/** Place `slots` as a left-to-right gem row whose left edge is `x`, centred at `y`. */
export function raritySlotRow(slots: Rarity[], x: number, y: number): RaritySlotGem[] {
  return slots.map((rarity, i) => ({
    rarity,
    cx: x + GEM / 2 + i * (GEM + GAP),
    cy: y,
    size: GEM,
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/scenes/raritySlotRow.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/scenes/raritySlotRow.ts src/scenes/raritySlotRow.test.ts
git commit -m "feat(expedition): pure raritySlotRow gem geometry (TDD)"
```

---

## Task 3: Pure `tierRewardPreview`

**Files:**
- Modify: `src/data/expeditionQuests.ts`
- Test: `src/data/expeditionQuests.test.ts` (create if absent)

- [ ] **Step 1: Write the failing test**

Add to `src/data/expeditionQuests.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { tierRewardPreview } from "./expeditionQuests.ts";
import { GOLD_TEX, GEM_TEX, materialTex } from "./assetKeys.ts";
import { RARITIES } from "./schemaEnums.ts";

describe("tierRewardPreview", () => {
  it("always leads with gold and caps at 5 icons", () => {
    for (const r of RARITIES) {
      const pv = tierRewardPreview(r);
      expect(pv.length).toBeGreaterThan(0);
      expect(pv.length).toBeLessThanOrEqual(5);
      expect(pv[0].iconKey).toBe(GOLD_TEX);
    }
  });

  it("gem-dropping tiers include the diamond icon", () => {
    for (const r of ["Magic", "Rare", "Legendary", "Unique"] as const) {
      expect(tierRewardPreview(r).some((v) => v.iconKey === GEM_TEX)).toBe(true);
    }
  });

  it("includes each tier's signature material", () => {
    expect(tierRewardPreview("Common").some((v) => v.iconKey === materialTex("bless-jewel"))).toBe(
      true,
    );
    expect(tierRewardPreview("Unique").some((v) => v.iconKey === materialTex("feather"))).toBe(
      true,
    );
    expect(
      tierRewardPreview("Legendary").some((v) => v.iconKey === materialTex("awakening-crystal")),
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/expeditionQuests.test.ts`
Expected: FAIL — `tierRewardPreview is not a function`.

- [ ] **Step 3: Write minimal implementation**

In `src/data/expeditionQuests.ts`, add imports near the top (after the existing `materials.ts` import) and the function after `QUEST_TIERS`:

```ts
// add to the existing import list:
import { goldIcon, diamondIcon, materialIcon, type RewardIconView } from "./rewardIcon.ts";

/**
 * The icons a tier *can* pay (its reward pool), for the card preview. Gold always
 * leads; gem-dropping tiers show the diamond; then each tier's signature
 * material(s). Mirrors the tier's `rewardRoll` shape — never the exact future
 * roll (that stays a claim-time surprise). Capped at 5 to fit the card.
 */
export function tierRewardPreview(rarity: Rarity): RewardIconView[] {
  const v: RewardIconView[] = [goldIcon()];
  const mats: string[] = [];
  switch (rarity) {
    case "Common":
      mats.push(BLESS_JEWEL);
      break;
    case "Magic":
      v.push(diamondIcon());
      mats.push(SOUL_JEWEL);
      break;
    case "Rare":
      v.push(diamondIcon());
      mats.push(SOUL_JEWEL, SUMMON_SCROLL);
      break;
    case "Legendary":
      v.push(diamondIcon());
      mats.push(AWAKENING_CRYSTAL, CHAOS_JEWEL);
      break;
    case "Unique":
      v.push(diamondIcon());
      mats.push(AWAKENING_CRYSTAL, JEWEL_OF_CHAOS, FEATHER);
      break;
  }
  for (const id of mats) v.push(materialIcon(id));
  return v.slice(0, 5);
}
```

Note: `BLESS_JEWEL`, `SOUL_JEWEL`, `SUMMON_SCROLL`, `AWAKENING_CRYSTAL`, `CHAOS_JEWEL`, `JEWEL_OF_CHAOS`, `FEATHER` are already imported at the top of this file.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/data/expeditionQuests.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/expeditionQuests.ts src/data/expeditionQuests.test.ts
git commit -m "feat(expedition): pure tierRewardPreview icon pool (TDD)"
```

---

## Task 4: `ExpeditionSave` reroll fields + save v13 migration

**Files:**
- Modify: `src/core/meta.ts:22-30` (interface), `:119` (default), `:144-148` (backfill)
- Modify: `src/core/save.ts:5` (version), `:287-291` area (migration hop)
- Test: `src/core/save.test.ts` (extend; or the existing migration test file)

- [ ] **Step 1: Write the failing test**

Add to `src/core/save.test.ts` (match the existing import style for `migrateSave`/`loadSave` — use whatever the file already imports to run a migration; if a `migrate`-style helper exists, reuse it):

```ts
import { describe, it, expect } from "vitest";
import { migrateSave, CURRENT_SAVE_VERSION } from "./save.ts";

describe("save v12 → v13 expedition reroll fields", () => {
  it("backfills freeRerollsLeft and rerollDay", () => {
    const v12: any = {
      version: 12,
      meta: { expedition: { quests: [], lastRerollDay: "", nextQuestSeq: 0 } },
    };
    const out = migrateSave(v12);
    expect(out.version).toBe(CURRENT_SAVE_VERSION);
    expect(CURRENT_SAVE_VERSION).toBe(13);
    expect(out.meta.expedition.freeRerollsLeft).toBe(5);
    expect(out.meta.expedition.rerollDay).toBe("");
  });
});
```

If the migration entry point is named differently (e.g. `loadSaveFromRaw`), use that name — check the top of `save.ts`/existing tests first.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/save.test.ts`
Expected: FAIL — `freeRerollsLeft` is `undefined` and/or `CURRENT_SAVE_VERSION` is 12.

- [ ] **Step 3: Implement the schema + migration**

In `src/core/meta.ts`, extend the interface (lines 22-30):

```ts
/** F2 — Expedition quest board (parallel dispatch quests). */
export interface ExpeditionSave {
  /** Active quests on the board (Available or Running). */
  quests: QuestInstance[];
  /** ISO yyyy-mm-dd of the last daily reroll of Available quests. */
  lastRerollDay: string;
  /** Monotonic counter that sources unique quest ids. */
  nextQuestSeq: number;
  /** Free board rerolls remaining today (0..REROLL_PER_DAY). */
  freeRerollsLeft: number;
  /** UTC yyyy-mm-dd the reroll counter was last reset. "" = never. */
  rerollDay: string;
}
```

Update the default (line 119):

```ts
    expedition: { quests: [], lastRerollDay: "", nextQuestSeq: 0, freeRerollsLeft: 5, rerollDay: "" },
```

Update the backfill (lines 144-148):

```ts
    expedition: {
      quests: meta.expedition?.quests ?? [],
      lastRerollDay: meta.expedition?.lastRerollDay ?? "",
      nextQuestSeq: meta.expedition?.nextQuestSeq ?? 0,
      freeRerollsLeft: meta.expedition?.freeRerollsLeft ?? 5,
      rerollDay: meta.expedition?.rerollDay ?? "",
    },
```

In `src/core/save.ts`, bump the version (line 5):

```ts
export const CURRENT_SAVE_VERSION = 13;
```

Add the migration hop after the v12 block (after line 291, before the "Defensive backfill" comment):

```ts
  if ((save.version ?? 0) < 13) {
    // Expedition free rerolls: existing boards start the day with a full 5.
    save = { ...save, version: 13 };
    if (save.meta?.expedition) {
      save.meta.expedition.freeRerollsLeft ??= 5;
      save.meta.expedition.rerollDay ??= "";
    }
  }
```

(The `backfillMeta(save.meta)` call at line 324 covers any save that skips the hop.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/save.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/meta.ts src/core/save.ts src/core/save.test.ts
git commit -m "feat(expedition): ExpeditionSave reroll fields + save v13 (TDD)"
```

---

## Task 5: `rerollBoard` + `resetDailyRerolls` core

**Files:**
- Modify: `src/core/expeditionBoard.ts`
- Test: `src/core/expeditionBoard.test.ts` (extend)

- [ ] **Step 1: Write the failing test**

Add to `src/core/expeditionBoard.test.ts` (reuse the test file's existing helpers for building a `HeroSave` + `Rng`; the snippet below assumes a `makeSave()`/`Rng` already used by sibling tests — match them):

```ts
import { rerollBoard, ensureBoard, REROLL_PER_DAY, BOARD_SIZE } from "./expeditionBoard.ts";

describe("rerollBoard", () => {
  const DAY = Date.parse("2026-06-14T08:00:00Z");

  it("rerolls Available, keeps Running, decrements the free counter", () => {
    const save = makeSave();
    ensureBoard(save, DAY, new Rng(1));
    // dispatch the first quest so it becomes Running
    const q = save.meta.expedition.quests[0];
    q.startedAt = DAY;
    q.assigned = ["t1"];
    const runningId = q.id;
    const before = save.meta.expedition.freeRerollsLeft;

    expect(rerollBoard(save, DAY, new Rng(2))).toBe(true);
    expect(save.meta.expedition.freeRerollsLeft).toBe(before - 1);
    expect(save.meta.expedition.quests).toHaveLength(BOARD_SIZE);
    // running quest preserved
    expect(save.meta.expedition.quests.some((x) => x.id === runningId)).toBe(true);
  });

  it("is a no-op returning false when no free rerolls remain", () => {
    const save = makeSave();
    ensureBoard(save, DAY, new Rng(1));
    save.meta.expedition.freeRerollsLeft = 0;
    save.meta.expedition.rerollDay = "2026-06-14";
    const snapshot = save.meta.expedition.quests.map((x) => x.id);
    expect(rerollBoard(save, DAY, new Rng(3))).toBe(false);
    expect(save.meta.expedition.quests.map((x) => x.id)).toEqual(snapshot);
  });

  it("restores the counter to REROLL_PER_DAY on a new day", () => {
    const save = makeSave();
    ensureBoard(save, DAY, new Rng(1));
    save.meta.expedition.freeRerollsLeft = 0;
    save.meta.expedition.rerollDay = "2026-06-14";
    const NEXT = Date.parse("2026-06-15T08:00:00Z");
    expect(rerollBoard(save, NEXT, new Rng(4))).toBe(true);
    // started the new day with 5, then spent one
    expect(save.meta.expedition.freeRerollsLeft).toBe(REROLL_PER_DAY - 1);
    expect(save.meta.expedition.rerollDay).toBe("2026-06-15");
  });
});
```

If the test file lacks a `makeSave()` helper, build a minimal `HeroSave` with `meta.expedition = { quests: [], lastRerollDay: "", nextQuestSeq: 0, freeRerollsLeft: 5, rerollDay: "" }` and a `collection`/`squad` as the sibling tests do.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/expeditionBoard.test.ts`
Expected: FAIL — `rerollBoard`/`REROLL_PER_DAY` not exported.

- [ ] **Step 3: Implement**

In `src/core/expeditionBoard.ts`, add the constant near `BOARD_SIZE` (line 21):

```ts
export const REROLL_PER_DAY = 5;
```

Add a reset helper after `dayKey` (after line 28):

```ts
/** Refill the free-reroll counter when the UTC day rolls over. Pure, idempotent. */
function resetDailyRerolls(board: HeroSave["meta"]["expedition"], today: string): void {
  if (board.rerollDay !== today) {
    board.freeRerollsLeft = REROLL_PER_DAY;
    board.rerollDay = today;
  }
}
```

Call it inside `ensureBoard` so the counter resets on board entry. Replace the body of `ensureBoard` (lines 59-67) with:

```ts
export function ensureBoard(save: HeroSave, nowMs: number, rng: Rng): void {
  const board = save.meta.expedition;
  const today = dayKey(nowMs);
  resetDailyRerolls(board, today);
  if (board.lastRerollDay !== today) {
    board.quests = board.quests.filter((q) => q.startedAt > 0); // keep Running, drop Available
    board.lastRerollDay = today;
  }
  while (board.quests.length < BOARD_SIZE) board.quests.push(generateQuest(rng, nextId(save)));
}
```

Add `rerollBoard` at the end of the file:

```ts
/**
 * Player-driven board reroll: refill the daily counter if the day changed, then —
 * if a free reroll remains — drop every Available quest (Running ones survive),
 * refill to BOARD_SIZE with fresh quests, and spend one reroll. Returns false
 * (no-op) when none remain.
 */
export function rerollBoard(save: HeroSave, nowMs: number, rng: Rng): boolean {
  const board = save.meta.expedition;
  resetDailyRerolls(board, dayKey(nowMs));
  if (board.freeRerollsLeft <= 0) return false;
  board.quests = board.quests.filter((q) => q.startedAt > 0); // keep Running
  while (board.quests.length < BOARD_SIZE) board.quests.push(generateQuest(rng, nextId(save)));
  board.freeRerollsLeft--;
  return true;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/expeditionBoard.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/expeditionBoard.ts src/core/expeditionBoard.test.ts
git commit -m "feat(expedition): rerollBoard + daily free-reroll reset (TDD)"
```

---

## Task 6: SaveManager reroll wrappers

**Files:**
- Modify: `src/core/saveManager.ts` (expedition method cluster, ~lines 150-175)
- Test: none new required (thin persistence wrapper); covered by Task 5 core + Task 9 repro. (If `saveManager.test.ts` exists, add a one-liner asserting `rerollExpeditionBoard` decrements `expeditionRerollsLeft`.)

- [ ] **Step 1: Add the imports + methods**

In `src/core/saveManager.ts`, add `rerollBoard` and `REROLL_PER_DAY` to the existing import from `./expeditionBoard.ts`, then add near the other expedition methods:

```ts
  /** Reroll the Available quests (free, capped per day). Returns false if none left. */
  rerollExpeditionBoard(nowMs = Date.now()): boolean {
    const ok = rerollBoard(this.save, nowMs, new Rng((Math.random() * 1e9) | 0));
    if (ok) this.persist();
    return ok;
  }

  /** Free rerolls remaining today (day-reset aware via ensureExpeditionBoard). */
  expeditionRerollsLeft(): number {
    return this.save.meta.expedition.freeRerollsLeft;
  }
```

Confirm `Rng` is already imported in this file (the existing `claimExpeditionQuest` uses `new Rng(...)`, so it is).

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/core/saveManager.ts
git commit -m "feat(expedition): SaveManager reroll wrappers"
```

---

## Task 7: ExpeditionScene — gem row, reward icons, reroll button

**Files:**
- Modify: `src/scenes/ExpeditionScene.ts`

- [ ] **Step 1: Add imports**

At the top of `src/scenes/ExpeditionScene.ts` add:

```ts
import { makeFitIcon } from "./itemIcon.ts";
import { rarityTex } from "../data/assetKeys.ts";
import { raritySlotRow } from "./raritySlotRow.ts";
import { tierRewardPreview } from "../data/expeditionQuests.ts";
```

(`QUEST_TIERS`, `RARITY_INT`, `RARITY_HEX` are already imported.)

- [ ] **Step 2: Replace the slot-requirement text with a gem row**

In `drawCard`, replace the `Needs ≥…` block (current lines 149-154) with a "Needs" caption + gem row. Add a helper method and call it:

```ts
    // "Needs" caption + rarity gem row (replaces the text "Needs ≥Common + …")
    this.layer.add(
      crispText(this, CARD_X + 14, y + 33, "Needs", { fontSize: "11px", color: "#aab8cc" }),
    );
    this.drawRarityGems(q.slots, CARD_X + 58, y + 39);
```

Add the method (near `drawCard`):

```ts
  /** Draw the required-rarity gem row; texture per gem, procedural faceted fallback. */
  private drawRarityGems(slots: import("../data/schemaEnums.ts").Rarity[], x: number, y: number): void {
    for (const gem of raritySlotRow(slots, x, y)) {
      const key = rarityTex(gem.rarity);
      if (this.textures.exists(key)) {
        const img = this.add.image(gem.cx, gem.cy, key).setOrigin(0.5);
        img.setScale(gem.size / Math.max(img.width, img.height));
        this.layer.add(img);
      } else {
        const g = this.add.graphics();
        const r = gem.size / 2;
        const col = RARITY_INT[gem.rarity];
        g.fillStyle(col, 1).fillPoints(
          [
            { x: gem.cx, y: gem.cy - r },
            { x: gem.cx + r, y: gem.cy },
            { x: gem.cx, y: gem.cy + r },
            { x: gem.cx - r, y: gem.cy },
          ],
          true,
        );
        g.fillStyle(0xffffff, 0.35).fillPoints(
          [
            { x: gem.cx, y: gem.cy - r },
            { x: gem.cx + r * 0.5, y: gem.cy - r * 0.2 },
            { x: gem.cx, y: gem.cy },
            { x: gem.cx - r * 0.5, y: gem.cy - r * 0.2 },
          ],
          true,
        );
        this.layer.add(g);
      }
    }
  }
```

- [ ] **Step 3: Replace the reward text with an icon row**

Replace the `Reward: ${tier.rewardHint} · …` block (current lines 155-163) with the duration + hint caption and a reward icon row:

```ts
    const tier = QUEST_TIERS[q.rarity];
    this.layer.add(
      crispText(this, CARD_X + 14, y + 54, `${tier.rewardHint} · ${fmtDuration(q.durationMs)}`, {
        fontSize: "11px",
        color: "#ffe07a",
      }),
    );
    tierRewardPreview(q.rarity).forEach((view, i) => {
      this.layer.add(makeFitIcon(this, CARD_X + 250 + i * 26, y + 58, view.iconKey, 22, view.emoji));
    });
```

(`fmtDuration` already exists in this file.)

- [ ] **Step 4: Add the reroll button in the header**

In `redraw()`, after the `${quests.length} quests · …` summary text, add a reroll button. Append inside `redraw()`:

```ts
    const left = this.mgr.expeditionRerollsLeft();
    const rerollLabel = `🎲 Reroll (${left}/5)`;
    const btn = crispText(this, W - 24, 30, rerollLabel, {
      fontSize: "14px",
      color: left > 0 ? "#ffffff" : "#7a8699",
      backgroundColor: left > 0 ? "#5a3a7a" : "#2a3340",
      fontStyle: "bold",
    })
      .setOrigin(1, 0)
      .setPadding(12, 6, 12, 6);
    if (left > 0) {
      btn.setInteractive({ useHandCursor: true });
      btn.on("pointerup", () => {
        if (this.mgr.rerollExpeditionBoard()) {
          this.showToast("Board rerolled!");
          this.redraw();
        }
      });
    }
    this.layer.add(btn);
```

- [ ] **Step 5: Typecheck + ensure scene < 500 lines**

Run: `npx tsc --noEmit && npx eslint src/scenes/ExpeditionScene.ts`
Expected: no errors, no `max-lines` violation (the scene is ~260 lines; the additions keep it well under 500).

- [ ] **Step 6: Commit**

```bash
git add src/scenes/ExpeditionScene.ts
git commit -m "feat(expedition): gem requirement row, reward icons, reroll button"
```

---

## Task 8: Rarity gem art (SDXL) + PreloadScene load

**Files:**
- Modify: `scripts/sdart/prompts.mjs`, `scripts/sdart/prompts.d.mts`, `scripts/sdart/sdgen.mjs`
- Modify: `src/scenes/PreloadScene.ts`
- Modify: `src/data/assetVersion.ts`

- [ ] **Step 1: Add the prompt spec**

In `scripts/sdart/prompts.mjs`, near `ROLE_VISUAL`/`achievementIconStyle`, add:

```js
// Rarity gem emblems — one faceted gemstone per rarity tier, tinted to its hue.
export const RARITY_GEM_VISUAL = {
  Common: "a plain polished grey quartz gemstone, simple faceted cut, muted silver-grey",
  Magic: "a brilliant sapphire-blue faceted gemstone, glowing azure core",
  Rare: "a radiant amethyst-purple faceted gemstone, violet inner glow",
  Legendary: "a blazing amber-orange faceted gemstone, fiery golden glow",
  Unique: "a molten ruby-red faceted gemstone, intense crimson radiance",
};
export const RARITY_GEM_NEGATIVE =
  "text, words, letters, ring, jewelry setting, hand, background scene, photorealistic skin";
export function rarityGemStyle(visual) {
  return `game icon of ${visual}, single centered gemstone, bold clean vector emblem, thick dark outline, flat cel shading, vivid saturated colors, crisp highlights, plain transparent background, centered, no text`;
}
```

In `scripts/sdart/prompts.d.mts`, add the decls:

```ts
export const RARITY_GEM_VISUAL: Record<string, string>;
export const RARITY_GEM_NEGATIVE: string;
export function rarityGemStyle(visual: string): string;
```

- [ ] **Step 2: Add the sdgen job loop**

In `scripts/sdart/sdgen.mjs`, add to the imports from `prompts.mjs`:

```js
  RARITY_GEM_VISUAL,
  rarityGemStyle,
  RARITY_GEM_NEGATIVE,
```

After the achievement-medallion loop (after line 227), add:

```js
  // rarity gem emblems — one faceted gemstone per rarity, transparent-cut to 64px.
  for (const [rarity, v] of Object.entries(RARITY_GEM_VISUAL)) {
    jobs.push({
      kind: "rarity",
      id: rarity,
      file: `${rarity}.png`,
      prompt: rarityGemStyle(v),
      seed: seedOf(`rarity-${rarity}`),
      w: 768,
      h: 768,
      size: 64,
      neg: RARITY_GEM_NEGATIVE,
    });
  }
```

(`kind: "rarity"` writes to `assets/sprites/rarity/<Rarity>.png`, matching the `roleicon`/`achievement` dir convention.)

- [ ] **Step 3: Load the icons in PreloadScene**

In `src/scenes/PreloadScene.ts`, add `rarityTex` to the `assetKeys` import and `RARITIES` to the `schemaEnums` import, then after the achievement-load loop (~line 117) add:

```ts
    // Rarity gem emblems (SDXL). Missing files degrade to the procedural gem.
    for (const r of RARITIES) {
      this.load.image(rarityTex(r), versioned(`assets/sprites/rarity/${r}.png`));
    }
```

- [ ] **Step 4: Generate the art**

Run: `npm run gen:sprites -- --only rarity` (or the project's equivalent filter; if no `--only` filter exists for new kinds, run `npm run gen:sprites` and let it skip already-generated files). Confirm 5 PNGs land in `public/assets/sprites/rarity/`:

Run: `ls -la public/assets/sprites/rarity/`
Expected: `Common.png Magic.png Rare.png Legendary.png Unique.png` present, each ~64×64 transparent.

- [ ] **Step 5: Bump ASSET_VERSION**

In `src/data/assetVersion.ts`, bump the suffix letter (e.g. `2026-06-14h` → `2026-06-14i`):

```ts
export const ASSET_VERSION = "2026-06-14i";
```

- [ ] **Step 6: Commit**

```bash
git add scripts/sdart/prompts.mjs scripts/sdart/prompts.d.mts scripts/sdart/sdgen.mjs \
        src/scenes/PreloadScene.ts src/data/assetVersion.ts public/assets/sprites/rarity/
git commit -m "feat(art): SDXL rarity gem emblems + preload + ASSET_VERSION bump"
```

---

## Task 9: Verify whole + CDP repro + memory

**Files:**
- Create: `scripts/playtest/repro_expedition_icons.mjs`

- [ ] **Step 1: Full verify**

Run:
```bash
npx tsc --noEmit && npx vitest run && npx eslint src && npm run build
```
Expected: tsc clean, all tests pass, no lint errors, build succeeds.

- [ ] **Step 2: Write the CDP repro**

Create `scripts/playtest/repro_expedition_icons.mjs` modeled on `scripts/playtest/repro_battle_cta.mjs`. It must: launch the dev server + headless Chrome, navigate into `ExpeditionScene` (via `window.__game` scene start), assert `this.textures.exists("rarity__Legendary")` (or degrade gracefully if art absent), assert the reroll button text matches `/Reroll \(\d\/5\)/`, click it once and assert the remaining count decremented, screenshot `/tmp/expedition_icons.png`, and print `VERDICT PASS`/`FAIL`.

- [ ] **Step 3: Run the repro**

Run: `node scripts/playtest/repro_expedition_icons.mjs`
Expected: `VERDICT PASS`, screenshot written.

- [ ] **Step 4: Send the screenshot + commit**

Emit `[[send: /tmp/expedition_icons.png]]` in the report. Then:

```bash
git add scripts/playtest/repro_expedition_icons.mjs
git commit -m "test(expedition): CDP repro for rarity/reward icons + reroll"
```

- [ ] **Step 5: Record memory**

Update `memory/project_expedition_quest_board.md` (and the `MEMORY.md` index line) to note: rarity-gem requirement row (`raritySlotRow` + `rarity__<Rarity>` SDXL, procedural faceted fallback), reward icon row (`tierRewardPreview` off `rewardIcon.ts`), and 5 free rerolls/day (`rerollBoard`/`REROLL_PER_DAY`, save v13). Mention `ASSET_VERSION` bump.

- [ ] **Step 6: Deploy (only if explicitly requested)**

Deploy is local-only and not part of this plan unless the user asks; if asked: `npm run build && npx firebase-tools deploy --only hosting`.

---

## Self-Review notes

- **Spec coverage:** (a) Tasks 1,2,7,8. (b) Tasks 3,7. (c) Tasks 4,5,6,7. Art Task 8. Verify Task 9. All spec sections mapped.
- **Type consistency:** `RaritySlotGem`/`raritySlotRow` (Task 2) consumed in Task 7; `tierRewardPreview` → `RewardIconView[]` (Task 3) consumed in Task 7; `freeRerollsLeft`/`rerollDay` named identically across meta/save/board/saveManager (Tasks 4-6); `REROLL_PER_DAY` defined once in expeditionBoard (Task 5) reused in saveManager (Task 6).
- **Fallbacks:** every texture render (gems, reward icons) is exists()-gated with a procedural/emoji fallback, so tests + first paint never blank.
