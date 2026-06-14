# Expedition Daily Dispatch Cap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cap expedition dispatches (starting a quest) at 5 per UTC day, mirroring the existing free-reroll daily counter.

**Architecture:** A second day-keyed counter (`dispatchesLeft`/`dispatchDay`) on `ExpeditionSave`, reset on UTC day rollover, decremented by `startQuest`. Save bumps v13→v14. UI shows the remaining count and disables Assign at 0.

**Tech Stack:** TypeScript, vitest, Phaser 3. Pure core logic unit-tested RED-first.

---

### Task 1: Save shape — two new ExpeditionSave fields

**Files:**
- Modify: `src/core/meta.ts` (`ExpeditionSave`, `defaultMeta`, `backfillMeta`)
- Test: `src/core/meta.test.ts` (exists)

- [ ] **Step 1: Add fields to the interface.** In `ExpeditionSave` add:
```ts
  /** Quest dispatches remaining today (0..DISPATCH_PER_DAY). */
  dispatchesLeft: number;
  /** UTC yyyy-mm-dd the dispatch counter was last reset. "" = never. */
  dispatchDay: string;
```

- [ ] **Step 2: Seed defaults.** In `defaultMeta()` expedition literal add `dispatchesLeft: 5, dispatchDay: ""`. In `backfillMeta` expedition object add `dispatchesLeft: meta.expedition?.dispatchesLeft ?? 5, dispatchDay: meta.expedition?.dispatchDay ?? ""`.

- [ ] **Step 3: Failing test** in `src/core/meta.test.ts`:
```ts
it("backfillMeta seeds a full daily dispatch allowance", () => {
  const m = backfillMeta(undefined);
  expect(m.expedition.dispatchesLeft).toBe(5);
  expect(m.expedition.dispatchDay).toBe("");
});
```

- [ ] **Step 4: Run** `npx vitest run src/core/meta.test.ts` → PASS.

- [ ] **Step 5: Commit** `feat(expedition): ExpeditionSave dispatch counter fields`.

---

### Task 2: Core — DISPATCH_PER_DAY + reset + cap in startQuest

**Files:**
- Modify: `src/core/expeditionBoard.ts`
- Test: `src/core/expeditionBoard.test.ts` (exists)

- [ ] **Step 1: Failing tests** in `src/core/expeditionBoard.test.ts`. Use the existing `createFreshSave()`/`Rng` helpers and a valid assignment helper pattern already in that file. Add:
```ts
import { DISPATCH_PER_DAY } from "./expeditionBoard.ts";

it("caps dispatches at DISPATCH_PER_DAY per day and decrements each dispatch", () => {
  // Build a save with enough eligible towers + Available quests, dispatch
  // DISPATCH_PER_DAY times successfully, assert dispatchesLeft hits 0 and the
  // next startQuest returns false (towers for it stay free).
});

it("an invalid assignment does not consume a dispatch", () => {
  // startQuest with a bad towerIds set returns false and dispatchesLeft unchanged.
});

it("restores the full dispatch allowance on a new UTC day", () => {
  // After spending some, ensureBoard on a later day refills dispatchesLeft.
});
```
(See the existing reroll tests in the same file for the seeding boilerplate to copy.)

- [ ] **Step 2: Run** `npx vitest run src/core/expeditionBoard.test.ts` → FAIL (`DISPATCH_PER_DAY` undefined).

- [ ] **Step 3: Implement.** In `src/core/expeditionBoard.ts`:
```ts
/** Max quest dispatches a player can start each UTC day. */
export const DISPATCH_PER_DAY = 5;

/** Refill the dispatch counter when the UTC day rolls over. Pure, idempotent. */
function resetDailyDispatches(board: HeroSave["meta"]["expedition"], today: string): void {
  if (board.dispatchDay !== today) {
    board.dispatchesLeft = DISPATCH_PER_DAY;
    board.dispatchDay = today;
  }
}
```
In `ensureBoard`, after `resetDailyRerolls(board, today);` add `resetDailyDispatches(board, today);`.
In `startQuest`, replace the body so the cap is the LAST gate:
```ts
export function startQuest(
  save: HeroSave,
  questId: string,
  towerIds: string[],
  nowMs: number,
): boolean {
  const q = save.meta.expedition.quests.find((x) => x.id === questId);
  if (!q || q.startedAt > 0) return false;
  if (!assignmentMeetsSlots(save, q, towerIds)) return false;
  resetDailyDispatches(save.meta.expedition, dayKey(nowMs));
  if (save.meta.expedition.dispatchesLeft <= 0) return false;
  q.assigned = [...towerIds];
  q.startedAt = nowMs;
  save.meta.expedition.dispatchesLeft--;
  return true;
}
```

- [ ] **Step 4: Run** `npx vitest run src/core/expeditionBoard.test.ts` → PASS.

- [ ] **Step 5: Commit** `feat(expedition): cap dispatches at 5/day (TDD)`.

---

### Task 3: Save migration v13 → v14

**Files:**
- Modify: `src/core/save.ts`
- Test: `src/core/save.test.ts` (exists)

- [ ] **Step 1: Failing test** in `src/core/save.test.ts`:
```ts
it("v13→v14 backfills the daily dispatch allowance", () => {
  const v13 = { ...createFreshSave(), version: 13 } as any;
  delete v13.meta.expedition.dispatchesLeft;
  delete v13.meta.expedition.dispatchDay;
  const out = loadAndMigrate(v13);
  expect(out.meta.expedition.dispatchesLeft).toBe(5);
  expect(out.meta.expedition.dispatchDay).toBe("");
});
```

- [ ] **Step 2: Run** `npx vitest run src/core/save.test.ts` → FAIL.

- [ ] **Step 3: Implement.** Bump `export const CURRENT_SAVE_VERSION = 14;`. After the `< 13` hop add:
```ts
  if ((save.version ?? 0) < 14) {
    // Expedition daily dispatch cap: existing boards start the day with a full 5.
    save = { ...save, version: 14 };
    if (save.meta?.expedition) {
      save.meta.expedition.dispatchesLeft ??= 5;
      save.meta.expedition.dispatchDay ??= "";
    }
  }
```
(`backfillMeta` already covers the defensive partial-save path.)

- [ ] **Step 4: Run** `npx vitest run src/core/save.test.ts` → PASS.

- [ ] **Step 5: Commit** `feat(expedition): save v13→v14 dispatch-cap migration`.

---

### Task 4: SaveManager accessor

**Files:**
- Modify: `src/core/saveManager.ts`

- [ ] **Step 1: Implement** after `expeditionRerollsLeft()`:
```ts
  /** Quest dispatches remaining today (day-reset aware via ensureExpeditionBoard). */
  expeditionDispatchesLeft(): number {
    return this.save.meta.expedition.dispatchesLeft;
  }
```

- [ ] **Step 2: Run** `npx vitest run src/core/saveManager.test.ts` (if present) + `npx tsc --noEmit` → green.

- [ ] **Step 3: Commit** `feat(expedition): SaveManager expeditionDispatchesLeft`.

---

### Task 5: ExpeditionScene UI — show count + gate Assign

**Files:**
- Modify: `src/scenes/ExpeditionScene.ts`

- [ ] **Step 1:** In `redraw()`, below the reroll button, add a dispatch-count label near it:
```ts
const dleft = this.mgr.expeditionDispatchesLeft();
this.layer.add(
  crispText(this, W - 24, 54, `🧭 Dispatches ${dleft}/5`, {
    fontSize: "12px",
    color: dleft > 0 ? "#bfe3ff" : "#7a8699",
    fontStyle: "bold",
  }).setOrigin(1, 0),
);
```

- [ ] **Step 2:** In `drawAvailable`, gate the Assign button on remaining dispatches:
```ts
private drawAvailable(q: QuestInstance, y: number): void {
  const canDispatch = this.mgr.expeditionDispatchesLeft() > 0;
  this.button(CARD_X + CARD_W - 16, y + CARD_H / 2, "Assign", "#3a6a9a", canDispatch, () => {
    if (!canDispatch) return;
    new QuestAssignDialog(this, this.mgr, q, (towerIds) => {
      if (this.mgr.startExpeditionQuest(q.id, towerIds)) {
        this.showToast(`Dispatched ${towerIds.length} hero${towerIds.length === 1 ? "" : "es"}!`);
        this.redraw();
      }
    });
  });
  if (!canDispatch) {
    // Disabled button has no handler; add a tap-target that explains why.
    const hint = crispText(this, CARD_X + CARD_W - 16, y + CARD_H / 2, "Assign", {
      fontSize: "15px", color: "#7a8699", backgroundColor: "#2a3340", fontStyle: "bold",
    }).setOrigin(1, 0.5).setPadding(16, 7, 16, 7).setInteractive({ useHandCursor: true });
    hint.on("pointerup", () => this.showToast("No expeditions left today (0/5)"));
    this.layer.add(hint);
  }
}
```
NOTE: `button()` already renders a greyed, non-interactive button when `enabled=false`; the extra `hint` overlays it only to attach the explanatory toast. Keep both so the player gets feedback.

- [ ] **Step 3: Run** `npx tsc --noEmit` → clean. `npx eslint src/scenes/ExpeditionScene.ts` → clean, file < 500 lines.

- [ ] **Step 4: Commit** `feat(expedition): show dispatches n/5 + gate Assign at 0`.

---

### Task 6: Verify + CDP repro + memory

**Files:**
- Modify: `scripts/playtest/repro_expedition_icons.mjs` (extend), `memory/project_expedition_quest_board.md`

- [ ] **Step 1: Full verify:** `npx vitest run` (all green), `npx tsc --noEmit`, `npx eslint .`, `npm run lint:cycles`, `npm run build`.

- [ ] **Step 2: Extend the CDP repro** to also assert the board report carries a `Dispatches \d/5` text, and run it against `npm run dev` on :4188 (vite preview gets SIGKILLed in this sandbox). Expected `VERDICT: PASS`.

- [ ] **Step 3: Update memory** `project_expedition_quest_board.md` with a "daily dispatch cap" note (DISPATCH_PER_DAY=5, save v13→v14, no art).

- [ ] **Step 4: Commit** `test(expedition): CDP repro asserts dispatch cap + memory`.

---

## Self-Review

- **Spec coverage:** data fields (T1), DISPATCH_PER_DAY + reset + startQuest cap + ensureBoard (T2), migration v13→v14 (T3), SaveManager accessor (T4), UI count + gated Assign (T5), tests + repro + memory (T6). All spec sections covered.
- **Placeholder scan:** Task 2's test bodies are described rather than fully spelled out because they reuse the file's existing seeding boilerplate (valid assignment + Rng) — the executor copies the adjacent reroll tests. All other code blocks are complete.
- **Type consistency:** `dispatchesLeft`/`dispatchDay`, `DISPATCH_PER_DAY`, `resetDailyDispatches`, `expeditionDispatchesLeft` used identically across tasks. `startQuest` signature unchanged.

## Execution

Full-auto: executing inline this session with TDD (RED→GREEN→REFACTOR), committing per task.
