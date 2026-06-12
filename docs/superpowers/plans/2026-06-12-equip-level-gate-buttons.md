# Level-gated Replace / Equip Buttons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Disable the inventory Replace (compare dialog) and Equip (enhance dialog) buttons when the hero's level is below the item's required level, and show the requirement on hover.

**Architecture:** A pure `equipLevelGate(heroLevel, reqLevel)` helper computes the met/unmet decision + hover hint string. A shared Phaser presenter `addGatedButton` renders a button in either state (interactive blue/green when met; greyed, non-clickable, with a hover hint when unmet). The two dialogs call it; `HeroScene.openCompare` threads the hero level into the compare dialog.

**Tech Stack:** TypeScript, Phaser 3, Vitest. Spec: `docs/superpowers/specs/2026-06-12-equip-level-gate-buttons.md`.

---

## File Structure

- Create `src/data/equipGate.ts` — pure gate (`equipLevelGate`). Phaser-free.
- Create `src/scenes/gatedButton.ts` — `addGatedButton` presenter (met / unmet + hover hint).
- Modify `src/scenes/itemCompareDialog.ts` — add `heroLevel` param; Replace via `addGatedButton`.
- Modify `src/scenes/itemEnhanceDialog.ts` — Equip via `addGatedButton`.
- Modify `src/scenes/HeroScene.ts:417,420` — pass hero level to `renderCompareDialog`.
- Create `tests/equipGate.test.ts`.

---

### Task 1: Pure `equipLevelGate`

**Files:**

- Create: `src/data/equipGate.ts`
- Test: `tests/equipGate.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { equipLevelGate } from "../src/data/equipGate.ts";

describe("equipLevelGate", () => {
  it("is met when the hero level meets or exceeds the required level", () => {
    expect(equipLevelGate(20, 20).met).toBe(true);
    expect(equipLevelGate(25, 20).met).toBe(true);
  });

  it("is unmet below the required level", () => {
    expect(equipLevelGate(19, 20).met).toBe(false);
  });

  it("carries the resolved levels through", () => {
    const g = equipLevelGate(7, 40);
    expect(g.heroLevel).toBe(7);
    expect(g.reqLevel).toBe(40);
  });

  it("has an empty hint when met and a formatted hint when unmet", () => {
    expect(equipLevelGate(40, 40).hint).toBe("");
    expect(equipLevelGate(7, 40).hint).toBe("Requires level 40 · you are 7");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/equipGate.test.ts`
Expected: FAIL — `equipLevelGate` is not exported / module missing.

- [ ] **Step 3: Write minimal implementation**

```ts
/**
 * Level gate for equipping an item — mirrors the `equipItem` rule
 * (`hero.level < instanceReqLevel(...)` blocks the equip). Pure / Phaser-free
 * so the Replace and Equip buttons can show an *advance* disabled state and a
 * hover hint instead of failing silently with a toast.
 */
export interface EquipLevelGate {
  /** Whether the hero may equip (heroLevel >= reqLevel). */
  met: boolean;
  /** The item's required level (resolve via instanceReqLevel at the call site). */
  reqLevel: number;
  /** The hero's current level. */
  heroLevel: number;
  /** "" when met, else "Requires level N · you are M" for the hover hint. */
  hint: string;
}

export function equipLevelGate(heroLevel: number, reqLevel: number): EquipLevelGate {
  const met = heroLevel >= reqLevel;
  return {
    met,
    reqLevel,
    heroLevel,
    hint: met ? "" : `Requires level ${reqLevel} · you are ${heroLevel}`,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/equipGate.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/data/equipGate.ts tests/equipGate.test.ts
git commit -m "feat(equip): pure equipLevelGate for level-gated actions"
```

---

### Task 2: `addGatedButton` presenter

**Files:**

- Create: `src/scenes/gatedButton.ts`

No unit test (Phaser presenter; covered structurally by the CDP playtest in Task 5 — matches how `itemCompareDialog`/`itemEnhanceDialog` are verified). Keep it small.

- [ ] **Step 1: Write the implementation**

```ts
// src/scenes/gatedButton.ts
//
// A button that renders an equip-action in one of two states from an
// EquipLevelGate: when the level requirement is met it's a normal interactive
// coloured button; when not, it's greyed, non-clickable, and reveals the
// requirement ("Requires level N · you are M") on hover. Shared by the compare
// (Replace) and enhance (Equip) dialogs so the disabled treatment is identical.
import Phaser from "phaser";
import { crispText } from "./ui.ts";
import type { EquipLevelGate } from "../data/equipGate.ts";

export interface GatedButtonOpts {
  x: number; // absolute scene x (button is origin 0.5,0)
  y: number; // absolute scene y
  label: string; // e.g. "⇄  Replace"
  bg: string; // background colour when enabled
  color?: string; // text colour when enabled (default white)
  gate: EquipLevelGate;
  onClick: () => void; // wired only when gate.met
}

/** Add a level-gated action button (and, when locked, its hover hint) to `container`. */
export function addGatedButton(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  opts: GatedButtonOpts,
): void {
  const { x, y, label, bg, gate, onClick } = opts;
  const met = gate.met;
  const btn = crispText(scene, x, y, met ? label : `${label} 🔒`, {
    fontSize: "14px",
    color: met ? (opts.color ?? "#fff") : "#c2c9d2",
    backgroundColor: met ? bg : "#3a3f48",
  })
    .setOrigin(0.5, 0)
    .setPadding(14, 8, 14, 8)
    .setAlpha(met ? 1 : 0.55);
  btn.setInteractive({ useHandCursor: met });
  container.add(btn);

  if (met) {
    btn.on("pointerup", onClick);
    return;
  }

  // Locked: no click handler (tapping is a no-op and shields the scrim, keeping
  // the dialog open). Reveal the requirement on hover, just under the button.
  const hint = crispText(scene, x, y + btn.height + 6, gate.hint, {
    fontSize: "11px",
    color: "#ffb38a",
    backgroundColor: "#1a1f29",
  })
    .setOrigin(0.5, 0)
    .setPadding(6, 3, 6, 3)
    .setVisible(false);
  container.add(hint);
  btn.on("pointerover", () => hint.setVisible(true));
  btn.on("pointerout", () => hint.setVisible(false));
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (no errors).

- [ ] **Step 3: Commit**

```bash
git add src/scenes/gatedButton.ts
git commit -m "feat(equip): addGatedButton presenter with locked hover hint"
```

---

### Task 3: Wire the Replace button (compare dialog)

**Files:**

- Modify: `src/scenes/itemCompareDialog.ts`
- Modify: `src/scenes/HeroScene.ts`

- [ ] **Step 1: Add imports to `itemCompareDialog.ts`**

After the existing `import { makeFitIcon } from "./itemIcon.ts";` line, add:

```ts
import { addGatedButton } from "./gatedButton.ts";
import { equipLevelGate } from "../data/equipGate.ts";
import { instanceReqLevel } from "../data/items.ts";
```

- [ ] **Step 2: Add the `heroLevel` parameter**

Change the `renderCompareDialog` signature — add `heroLevel: number` after `slot`:

```ts
export function renderCompareDialog(
  scene: Phaser.Scene,
  dialog: Phaser.GameObjects.Container,
  bag: ItemRef,
  equipped: ItemRef,
  slot: ItemSlot,
  heroLevel: number,
  cb: CompareCallbacks,
): void {
```

- [ ] **Step 3: Replace the Replace-button block**

Find the current Replace button block:

```ts
const replace = crispText(scene, dx + rightX + colW / 2, btnY, "⇄  Replace", {
  fontSize: "14px",
  color: "#fff",
  backgroundColor: "#1565c0",
})
  .setOrigin(0.5, 0)
  .setPadding(14, 8, 14, 8)
  .setInteractive({ useHandCursor: true });
replace.on("pointerup", cb.onReplace);
dialog.add(replace);
```

Replace it with:

```ts
addGatedButton(scene, dialog, {
  x: dx + rightX + colW / 2,
  y: btnY,
  label: "⇄  Replace",
  bg: "#1565c0",
  gate: equipLevelGate(heroLevel, instanceReqLevel(bag.inst, bag.def)),
  onClick: cb.onReplace,
});
```

- [ ] **Step 4: Update the caller in `HeroScene.ts`**

In `openCompare` (around line 420), change the `renderCompareDialog` call to pass the hero level. Find:

```ts
    renderCompareDialog(this, this.dialog, { inst: bagInst, def: bagDef }, { inst: eqInst, def: eqDef }, slot, {
```

Change to:

```ts
    renderCompareDialog(this, this.dialog, { inst: bagInst, def: bagDef }, { inst: eqInst, def: eqDef }, slot, this.mgr.getSave().hero.level, {
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/scenes/itemCompareDialog.ts src/scenes/HeroScene.ts
git commit -m "feat(compare): level-gate the Replace button"
```

---

### Task 4: Wire the Equip button (enhance dialog)

**Files:**

- Modify: `src/scenes/itemEnhanceDialog.ts`

- [ ] **Step 1: Add imports**

After `import { enhancePreviewRows } from "../data/itemDisplay.ts";`, add:

```ts
import { instanceReqLevel } from "../data/items.ts";
import { equipLevelGate } from "../data/equipGate.ts";
import { addGatedButton } from "./gatedButton.ts";
```

- [ ] **Step 2: Replace the Equip-button block**

Find the current Equip block inside `render()`:

```ts
if (cb.onEquip) {
  const equip = crispText(scene, dx + W * 0.34, dy + H - 50, "✓  Equip", {
    fontSize: "15px",
    color: "#fff",
    backgroundColor: "#2e7d32",
  })
    .setOrigin(0.5, 0)
    .setPadding(16, 8, 16, 8)
    .setInteractive({ useHandCursor: true });
  equip.on("pointerup", cb.onEquip);
  dialog.add(equip);
}
```

Replace it with:

```ts
if (cb.onEquip) {
  addGatedButton(scene, dialog, {
    x: dx + W * 0.34,
    y: dy + H - 50,
    label: "✓  Equip",
    bg: "#2e7d32",
    gate: equipLevelGate(save.hero.level, instanceReqLevel(inst, def)),
    onClick: cb.onEquip,
  });
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Run the full suite**

Run: `npx vitest run`
Expected: PASS (existing 862 + 4 new = 866).

- [ ] **Step 5: Commit**

```bash
git add src/scenes/itemEnhanceDialog.ts
git commit -m "feat(enhance): level-gate the Equip button"
```

---

### Task 5: Verify whole + playtest

**Files:** none (verification only).

- [ ] **Step 1: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed.

- [ ] **Step 2: Full test suite**

Run: `npx vitest run`
Expected: all green (866).

- [ ] **Step 3: File-size check**

Run: `wc -l src/scenes/gatedButton.ts src/data/equipGate.ts src/scenes/itemCompareDialog.ts src/scenes/itemEnhanceDialog.ts`
Expected: all under 500 lines.

- [ ] **Step 4: CDP playtest — locked state**

Build + serve, then drive HeroScene: fabricate a bag item with `requiredLevel` above the default hero level whose equip slot is full, call `openItemAction` to force the compare dialog. Assert the Replace button text contains "🔒", is greyed, and a hint object with "Requires level" text exists. Screenshot to `/tmp/equip-gate-locked.png`.

- [ ] **Step 5: CDP playtest — met state**

Raise the fabricated hero level above the item's requirement (or use a low-req item), re-open compare. Assert the Replace button is the blue interactive variant (no 🔒). Screenshot to `/tmp/equip-gate-open.png`.

- [ ] **Step 6: Update memory**

Append to `memory/project_inventory_compare_replace.md` a note that Replace/Equip buttons are level-gated via `equipLevelGate` + `addGatedButton` (hover hint when locked). Add a one-line pointer if a new memory file is warranted (it isn't — extend the existing one).

---

## Self-Review

**1. Spec coverage:**

- Disable when `heroLevel < reqLevel` → Task 2 (`addGatedButton` unmet branch) + Tasks 3/4 wiring. ✓
- Hover shows requirement → Task 2 hint on `pointerover`/`pointerout`. ✓
- Met behaves as today → Task 2 met branch keeps colour + `pointerup`. ✓
- Pure testable gate → Task 1. ✓
- Out-of-scope Enhance button unchanged → Tasks 3/4 touch only Replace/Equip. ✓

**2. Placeholder scan:** No TBD/TODO; all code blocks complete. ✓

**3. Type consistency:** `equipLevelGate` returns `EquipLevelGate {met,reqLevel,heroLevel,hint}` — consumed identically in `gatedButton.ts` (`gate.met`, `gate.hint`). `addGatedButton(scene, container, opts)` signature matches both call sites. `renderCompareDialog` new `heroLevel` param positioned before `cb` in both the definition (Task 3 Step 2) and the caller (Task 3 Step 4). `instanceReqLevel(inst, def)` matches its export in `items.ts`. ✓
