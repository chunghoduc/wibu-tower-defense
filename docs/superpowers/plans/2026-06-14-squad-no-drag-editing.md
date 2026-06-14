# Squad No-Drag Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add tap-only squad-building paths (info-panel Add/Remove button, tap-empty-slot to place, ⚡Auto-fill / Clear) to `SquadScene` while leaving the existing drag-and-drop flow untouched.

**Architecture:** All squad-array mutation moves into one pure, Phaser-free, unit-tested module `squadEdit.ts` (add / remove / place-at / auto-fill / clear / score). `SquadScene` becomes a thin presenter: the existing drag controller and the new taps both call into this module, so they can never diverge. New UI is plain interactive `crispText`/`zone` objects guarded by the existing `!this.didDrag` tap-guard.

**Tech Stack:** TypeScript, Phaser 3, vitest. UI space 960×540. Logic modules are Phaser-free + unit-tested; scenes are thin presenters.

---

### Task 1: Pure squad-edit module (TDD)

**Files:**
- Create: `src/scenes/squadEdit.ts`
- Test: `src/scenes/squadEdit.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/scenes/squadEdit.test.ts
import { describe, it, expect } from "vitest";
import {
  squadAdd,
  squadRemove,
  squadPlaceAt,
  autoFillSquad,
  clearSquad,
  charSquadScore,
  SQUAD_MAX,
} from "./squadEdit.ts";

const empty = (): (string | null)[] => Array.from({ length: SQUAD_MAX }, () => null);

describe("squadAdd", () => {
  it("adds to the first empty slot", () => {
    const r = squadAdd(["a", null, null, null, null, null, null], "b");
    expect(r.slots).toEqual(["a", "b", null, null, null, null, null]);
    expect(r.changed).toBe(true);
    expect(r.reason).toBe("added");
  });
  it("is a no-op when the char is already in the squad", () => {
    const start = ["a", "b", null, null, null, null, null];
    const r = squadAdd(start, "a");
    expect(r.changed).toBe(false);
    expect(r.reason).toBe("noop");
    expect(r.slots).toEqual(start);
  });
  it("is a no-op with reason 'full' when all slots are filled", () => {
    const full = ["a", "b", "c", "d", "e", "f", "g"];
    const r = squadAdd(full, "h");
    expect(r.changed).toBe(false);
    expect(r.reason).toBe("full");
    expect(r.slots).toEqual(full);
  });
  it("does not mutate the input array", () => {
    const start = empty();
    squadAdd(start, "x");
    expect(start).toEqual(empty());
  });
});

describe("squadRemove", () => {
  it("removes the char wherever it sits", () => {
    const r = squadRemove(["a", "b", "c", null, null, null, null], "b");
    expect(r.slots).toEqual(["a", null, "c", null, null, null, null]);
    expect(r.changed).toBe(true);
    expect(r.reason).toBe("removed");
  });
  it("is a no-op when the char is absent", () => {
    const start = ["a", null, null, null, null, null, null];
    const r = squadRemove(start, "z");
    expect(r.changed).toBe(false);
    expect(r.slots).toEqual(start);
  });
});

describe("squadPlaceAt", () => {
  it("places into a specific empty slot", () => {
    const r = squadPlaceAt(empty(), "a", 3);
    expect(r.slots[3]).toBe("a");
    expect(r.reason).toBe("placed");
  });
  it("moves an already-slotted char (no duplicate)", () => {
    const r = squadPlaceAt(["a", null, null, null, null, null, null], "a", 4);
    expect(r.slots[0]).toBe(null);
    expect(r.slots[4]).toBe("a");
    expect(r.slots.filter((s) => s === "a")).toHaveLength(1);
  });
  it("overwrites a filled target slot (swap semantics)", () => {
    const r = squadPlaceAt(["a", "b", null, null, null, null, null], "c", 1);
    expect(r.slots[1]).toBe("c");
  });
});

describe("autoFillSquad", () => {
  it("fills only empty slots, in order, from the candidate list", () => {
    const r = autoFillSquad(["a", null, null, null, null, null, null], ["b", "c"]);
    expect(r.slots).toEqual(["a", "b", "c", null, null, null, null]);
    expect(r.filled).toBe(2);
    expect(r.reason).toBe("added");
  });
  it("never duplicates a char already in the squad", () => {
    const r = autoFillSquad(["a", null, null, null, null, null, null], ["a", "b"]);
    expect(r.slots).toEqual(["a", "b", null, null, null, null, null]);
    expect(r.filled).toBe(1);
  });
  it("never disturbs filled slots and stops when full", () => {
    const r = autoFillSquad(["a", "b", "c", "d", "e", "f", null], ["g", "h", "i"]);
    expect(r.slots).toEqual(["a", "b", "c", "d", "e", "f", "g"]);
    expect(r.filled).toBe(1);
  });
  it("is a safe no-op when there are no candidates", () => {
    const start = ["a", null, null, null, null, null, null];
    const r = autoFillSquad(start, []);
    expect(r.changed).toBe(false);
    expect(r.filled).toBe(0);
  });
});

describe("clearSquad", () => {
  it("empties every slot", () => {
    const r = clearSquad(["a", "b", null, null, null, null, null]);
    expect(r.slots).toEqual(empty());
    expect(r.reason).toBe("cleared");
    expect(r.changed).toBe(true);
  });
  it("is a no-op when already empty", () => {
    const r = clearSquad(empty());
    expect(r.changed).toBe(false);
  });
});

describe("charSquadScore", () => {
  it("ranks higher rarity above lower regardless of stars", () => {
    expect(charSquadScore("Legendary", 0)).toBeGreaterThan(charSquadScore("Rare", 5));
  });
  it("ranks more stars higher within the same rarity", () => {
    expect(charSquadScore("Rare", 3)).toBeGreaterThan(charSquadScore("Rare", 1));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/scenes/squadEdit.test.ts`
Expected: FAIL — "Failed to load url ./squadEdit.ts" (module missing).

- [ ] **Step 3: Write the minimal implementation**

```ts
// src/scenes/squadEdit.ts
/**
 * squadEdit — the single pure source of truth for squad-array mutation. Both the
 * drag controller (squadDrag.ts) and the new tap paths in SquadScene call these,
 * so add/remove/place can never diverge between input methods. Phaser-free and
 * fully unit-tested. Every function returns a NEW slots array (never mutates).
 */
import type { Rarity } from "../data/schema.ts";

export const SQUAD_MAX = 7;

export type SquadReason = "added" | "removed" | "placed" | "full" | "noop" | "cleared";

export interface SquadEditResult {
  slots: (string | null)[];
  changed: boolean;
  filled?: number;
  reason: SquadReason;
}

const RARITY_ORDER: Record<Rarity, number> = {
  Common: 0,
  Magic: 1,
  Rare: 2,
  Legendary: 3,
  Unique: 4,
};

/** Deterministic ranking score for auto-fill: rarity dominates, stars break ties. */
export function charSquadScore(rarity: Rarity, stars: number): number {
  return RARITY_ORDER[rarity] * 1000 + stars;
}

/** Add id to the first empty slot. No-op if already present or squad full. */
export function squadAdd(slots: (string | null)[], id: string): SquadEditResult {
  if (slots.includes(id)) return { slots: slots.slice(), changed: false, reason: "noop" };
  const i = slots.indexOf(null);
  if (i < 0) return { slots: slots.slice(), changed: false, reason: "full" };
  const next = slots.slice();
  next[i] = id;
  return { slots: next, changed: true, reason: "added" };
}

/** Remove id from wherever it sits. No-op if absent. */
export function squadRemove(slots: (string | null)[], id: string): SquadEditResult {
  const i = slots.indexOf(id);
  if (i < 0) return { slots: slots.slice(), changed: false, reason: "noop" };
  const next = slots.slice();
  next[i] = null;
  return { slots: next, changed: true, reason: "removed" };
}

/** Place id at a specific slot; if already slotted elsewhere, move it (no dupes). */
export function squadPlaceAt(
  slots: (string | null)[],
  id: string,
  slot: number,
): SquadEditResult {
  const next = slots.slice();
  const cur = next.indexOf(id);
  if (cur >= 0) next[cur] = null; // move, never duplicate
  next[slot] = id;
  return { slots: next, changed: true, reason: "placed" };
}

/** Fill empty slots in order from candidates (already power-sorted desc),
 *  skipping any already in the squad. Never disturbs filled slots. */
export function autoFillSquad(
  slots: (string | null)[],
  candidates: string[],
): SquadEditResult {
  const next = slots.slice();
  let filled = 0;
  for (const id of candidates) {
    if (next.includes(id)) continue;
    const i = next.indexOf(null);
    if (i < 0) break;
    next[i] = id;
    filled++;
  }
  return { slots: next, changed: filled > 0, filled, reason: filled > 0 ? "added" : "noop" };
}

/** Empty every slot. No-op (changed=false) when already empty. */
export function clearSquad(slots: (string | null)[]): SquadEditResult {
  const had = slots.some(Boolean);
  return {
    slots: Array.from({ length: slots.length }, () => null),
    changed: had,
    reason: "cleared",
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/scenes/squadEdit.test.ts`
Expected: PASS (all describe blocks green).

- [ ] **Step 5: Commit**

```bash
git add src/scenes/squadEdit.ts src/scenes/squadEdit.test.ts
git commit -m "feat(squad): pure squadEdit module (add/remove/place/auto-fill/clear)"
```

---

### Task 2: Route drag mutations through squadEdit (no behaviour change)

**Files:**
- Modify: `src/scenes/SquadScene.ts` (`assignToSlot`, the drag controller's `removeFromSquad`, add a `commit` helper)

Goal: make the EXISTING drag path call `squadEdit` so it shares the source of
truth. No visible behaviour change — the existing `repro_squad_drag.mjs` and
`squadDrag.test.ts` must still pass.

- [ ] **Step 1: Add imports and a commit helper**

Add to the import block in `src/scenes/SquadScene.ts` (after the `createSquadDrag` import):

```ts
import {
  squadAdd,
  squadRemove,
  squadPlaceAt,
  autoFillSquad,
  clearSquad,
  charSquadScore,
} from "./squadEdit.ts";
```

Add this private helper to the `SquadScene` class (next to `persist`):

```ts
/** Apply a pure squadEdit result to the working slots + persist. Never redraws
 *  (callers decide when to redraw — critically, the drag path must NOT redraw
 *  inside `drop`; see squadDrag.ts / the Phaser drop-destroy trap). */
private commit(result: { slots: (string | null)[] }): void {
  this.slots = result.slots;
  this.persist();
}
```

- [ ] **Step 2: Rewrite `assignToSlot` to use `squadPlaceAt`**

Replace the existing `assignToSlot` method body with:

```ts
/** Data mutation only — the dragend rebuild renders the result. Must NOT
 *  redraw here: that destroys the dragged tile and makes Phaser skip dragend. */
private assignToSlot(id: string, slot: number): void {
  this.commit(squadPlaceAt(this.slots, id, slot));
  this.selectedId = id; // select without redraw; dragend's refresh shows it
}
```

- [ ] **Step 3: Rewrite the drag controller's `removeFromSquad` to use `squadRemove`**

In `setupDrag`, replace the `removeFromSquad` dep:

```ts
removeFromSquad: (id) => this.commit(squadRemove(this.slots, id)),
```

- [ ] **Step 4: Run the drag tests + typecheck**

Run: `npx vitest run src/scenes/squadDrag.test.ts && npx tsc --noEmit`
Expected: PASS — drag lifecycle tests still green, no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/scenes/SquadScene.ts
git commit -m "refactor(squad): route drag mutations through squadEdit (no behaviour change)"
```

---

### Task 3: Info-panel Add/Remove action button

**Files:**
- Modify: `src/scenes/SquadScene.ts` (`drawPanel`)

The button renders inside the right info panel below the character details, only
when a character (not the hero) is selected.

- [ ] **Step 1: Add the action-button renderer**

Add this private method to `SquadScene`:

```ts
/** Full-width Add/Remove action button at the bottom of the info panel. Only
 *  shown for a selected character (not the hero). Reflects live squad state. */
private drawActionButton(def: { id: string }): void {
  const inSquad = this.slots.includes(def.id);
  const full = !inSquad && this.slots.every(Boolean);
  const label = inSquad
    ? "✓ In Squad — tap to Remove"
    : full
      ? "Squad Full (7/7) — drag to swap"
      : "+ Add to Squad";
  const bg = inSquad ? "#5a2a3a" : full ? "#23303f" : "#2a5a3a";
  const x = PANEL_X + PANEL_W / 2;
  const y = PANEL_Y + PANEL_H - 30;
  const btn = crispText(this, x, y, label, {
    fontSize: "12px",
    color: full ? "#7c8aa0" : "#fff",
    backgroundColor: bg,
    fontStyle: "bold",
    align: "center",
    fixedWidth: PANEL_W - 24,
  })
    .setOrigin(0.5)
    .setPadding(0, 6, 0, 6);
  if (!full) {
    btn.setInteractive({ useHandCursor: true }).on("pointerup", () => {
      if (this.didDrag) return;
      this.commit(inSquad ? squadRemove(this.slots, def.id) : squadAdd(this.slots, def.id));
      this.redraw();
    });
  }
  this.panel.add(btn);
}
```

- [ ] **Step 2: Call it from `drawPanel` in the character branch**

In `drawPanel`, inside the `else` branch (the `if (def)` block, after the
`renderCharInfo(...)` call), add:

```ts
this.drawActionButton(def);
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/scenes/SquadScene.ts
git commit -m "feat(squad): info-panel Add/Remove action button (no-drag equip)"
```

---

### Task 4: Tap an empty slot to place the selected character

**Files:**
- Modify: `src/scenes/SquadScene.ts` (`drawSlots`)

- [ ] **Step 1: Add a placement helper**

Add this private method to `SquadScene`:

```ts
/** Tap-to-place: if a character (not the hero, not already squadded) is
 *  selected, assign it to `slot`. No-op otherwise. */
private placeSelectedAt(slot: number): void {
  const id = this.selectedId;
  if (id === HERO_SEL || this.slots.includes(id)) return;
  if (!TOWERS.some((t) => t.id === id)) return;
  this.commit(squadPlaceAt(this.slots, id, slot));
  this.redraw();
}
```

- [ ] **Step 2: Make empty slots interactive in `drawSlots`**

In `drawSlots`, replace the `else` branch that renders the "empty" label with:

```ts
} else {
  const lbl = crispText(this, x + w / 2, y + h / 2, "empty", {
    fontSize: "10px",
    color: "#4c5a70",
  }).setOrigin(0.5);
  this.slotLayer.add(lbl);
  const z = this.add
    .zone(x, y, w, h)
    .setOrigin(0)
    .setInteractive({ useHandCursor: true });
  z.on("pointerup", () => {
    if (!this.didDrag) this.placeSelectedAt(i);
  });
  this.slotLayer.add(z);
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/scenes/SquadScene.ts
git commit -m "feat(squad): tap an empty slot to place the selected character"
```

---

### Task 5: Auto-fill and Clear controls

**Files:**
- Modify: `src/scenes/SquadScene.ts` (`drawSlots` or `redraw` — render a control row)

- [ ] **Step 1: Add the auto-fill + clear handlers**

Add these private methods to `SquadScene`:

```ts
/** Owned, not-currently-squadded character ids, ranked best-first by score. */
private autoFillCandidates(save: ReturnType<SaveManager["getSave"]>): string[] {
  return TOWERS.filter((t) => t.id in save.collection && !this.slots.includes(t.id))
    .slice()
    .sort(
      (a, b) =>
        charSquadScore(b.rarity, getTowerStars(save, b.id)) -
          charSquadScore(a.rarity, getTowerStars(save, a.id)) || a.name.localeCompare(b.name),
    )
    .map((t) => t.id);
}

private doAutoFill(): void {
  const r = autoFillSquad(this.slots, this.autoFillCandidates(this.mgr.getSave()));
  this.commit(r);
  this.flashMsg(r.filled ? `Filled ${r.filled} slot${r.filled > 1 ? "s" : ""}` : "Squad already set", r.changed);
  this.redraw();
}

private doClear(): void {
  const r = clearSquad(this.slots);
  this.commit(r);
  this.flashMsg(r.changed ? "Squad cleared" : "Squad already empty", r.changed);
  this.redraw();
}
```

- [ ] **Step 2: Render the Auto / Clear buttons**

In `drawSlots`, after the `n/SQUAD_MAX chosen` label is added, append a small
control row to the right of it:

```ts
const auto = crispText(this, 150, 94, "⚡ Auto", {
  fontSize: "11px",
  color: "#fff",
  backgroundColor: "#2a5a3a",
})
  .setPadding(7, 3, 7, 3)
  .setInteractive({ useHandCursor: true });
auto.on("pointerup", () => {
  if (!this.didDrag) this.doAutoFill();
});
this.slotLayer.add(auto);
const clear = crispText(this, 214, 94, "Clear", {
  fontSize: "11px",
  color: "#fff",
  backgroundColor: "#5a2a3a",
})
  .setPadding(7, 3, 7, 3)
  .setInteractive({ useHandCursor: true });
clear.on("pointerup", () => {
  if (!this.didDrag) this.doClear();
});
this.slotLayer.add(clear);
```

- [ ] **Step 3: Typecheck + run full unit suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS (all tests incl. squadEdit + squadDrag).

- [ ] **Step 4: Commit**

```bash
git add src/scenes/SquadScene.ts
git commit -m "feat(squad): one-tap Auto-fill best squad + Clear"
```

---

### Task 6: Verify, lint, file-size, live playtest

**Files:**
- Create: `scripts/playtest/repro_squad_noDrag.mjs`

- [ ] **Step 1: Write the CDP playtest script**

Create `scripts/playtest/repro_squad_noDrag.mjs` modelled on
`scripts/playtest/repro_squad_drag.mjs` (same WebSocket/CDP harness). It must:
seed 3 owned characters + empty squad + start `SquadScene`; read a grid tile's
`charId` and CSS centre, plus the **Add to Squad** button's CSS centre (find the
panel button by scanning `sc.panel.list` for a Text whose `.text` includes
"Add to Squad") and the **⚡ Auto** / **Clear** button centres (scan
`sc.slotLayer.list`); then:

1. Click the grid tile (select) → click **Add** → assert `sc.slots[0]` is that id.
2. Click **⚡ Auto** → assert `sc.slots.filter(Boolean).length > 1`.
3. Click **Clear** → assert `sc.slots.filter(Boolean).length === 0`.

Print `RESULT: PASS ✓` and `process.exit(0)` on success, else exit 2. Use the
canvas→CSS scaling helper `toCss` exactly as `repro_squad_drag.mjs` does.

- [ ] **Step 2: Static verification**

Run:
```bash
npx tsc --noEmit
npx eslint src/scenes/squadEdit.ts src/scenes/squadEdit.test.ts src/scenes/SquadScene.ts
npx vitest run
```
Expected: tsc clean; eslint clean (in particular **no `max-lines` error** on
`SquadScene.ts` — confirm it is still under 500 CODE lines; if it crosses, extract
`drawActionButton` + the Auto/Clear handlers into a new `squadControls.ts`
presenter and re-run); full suite green.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: succeeds (pre-existing chunk-size warning is OK).

- [ ] **Step 4: Live playtest**

Start `vite preview --port 4188` + headless Chrome (`--remote-debugging-port=9222`)
in the background, then:

Run: `node scripts/playtest/repro_squad_noDrag.mjs --out=/tmp/squad_nodrag.png`
Expected: `RESULT: PASS ✓`, exit 0. Stop the background servers after
(`pkill -f "[v]ite preview --port 4188"`; the `[v]` trick avoids self-match).

- [ ] **Step 5: Commit + update memory**

```bash
git add scripts/playtest/repro_squad_noDrag.mjs
git commit -m "test(squad): CDP repro for no-drag squad editing (add/auto/clear)"
```

Then update the `project_inventory_compare_replace` or create a short
`project_squad_no_drag_editing` memory noting: squad can now be built without
dragging via the info-panel Add/Remove button, tap-empty-slot placement, and
⚡Auto/Clear; all mutations funnel through pure `squadEdit.ts` (shared with the
drag path); drag flow unchanged. Add the one-line pointer to `MEMORY.md`.

---

## Self-Review

**Spec coverage:**
- Spec §A (info-panel action button) → Task 3. ✔
- Spec §B (tap empty slot to place) → Task 4. ✔
- Spec §C (Auto-fill + Clear) → Task 5. ✔
- Pure `squadEdit.ts` module + `charSquadScore` → Task 1. ✔
- Drag/tap share one source of truth (refactor drag through module) → Task 2. ✔
- Persistence unchanged (`commit` → `persist`) → Task 2 Step 1. ✔
- Testing: `squadEdit.test.ts` → Task 1; CDP repro → Task 6. ✔
- File-size risk mitigation (extract if >500) → Task 6 Step 2. ✔
- Drop-destroy-trap untouched (drag lifecycle unchanged; `commit` never redraws) → Task 2 Step 1 note. ✔

**Placeholder scan:** none — all code steps show full code; the playtest script
(Task 6 Step 1) is specified by exact behaviour + the existing template it mirrors.

**Type consistency:** `SquadEditResult`/`commit(result)` shape is consistent
across Tasks 1–5; `charSquadScore(rarity, stars)` signature matches its call in
Task 5; `squadPlaceAt`/`squadRemove`/`squadAdd`/`autoFillSquad`/`clearSquad`
names match between definition (Task 1) and call sites (Tasks 2–5). `commit`
takes `{slots}` and is defined once (Task 2). `HERO_SEL`, `TOWERS`,
`getTowerStars`, `PANEL_X/W/Y/H`, `crispText`, `flashMsg` all already exist in
`SquadScene.ts`.
