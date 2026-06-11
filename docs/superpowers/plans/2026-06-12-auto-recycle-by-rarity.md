# Auto-Recycle by Rarity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Auto-Recycle button to the Shop's Recycle view that bulk-smelts every non-equipped item of player-selected rarities (Common/Magic/Rare) into Jewels of Chaos in one confirmed action.

**Architecture:** Pure batch-smelt functions (`bulkSmeltPreview`, `bulkSmelt`) added to `src/core/smelt.ts`, wrapped by a `SaveManager.bulkSmeltItems` method for persistence/events, surfaced by a self-contained dialog presenter `src/scenes/autoRecycleDialog.ts`, wired into `ShopScene` behind a recycle-mode "♻ Auto" button.

**Tech Stack:** TypeScript, Phaser 3, Vitest. Pure logic is Phaser-free and unit-tested; UI verified via tsc + build + CDP playtest.

---

## File Structure

- `src/core/smelt.ts` (modify) — add `AUTO_SMELT_RARITIES`, `BulkSmeltPreview`, `bulkSmeltPreview`, `BulkSmeltResult`, `bulkSmelt`. Shares one private selector for eligible items.
- `src/core/saveManagerCore.ts` (modify) — add `bulkSmeltItems(rarities)` wrapper mirroring the existing `smeltItem` persistence/event pattern.
- `src/scenes/autoRecycleDialog.ts` (create) — Phaser dialog presenter owning rarity-toggle state + live preview.
- `src/scenes/ShopScene.ts` (modify) — add recycle-mode "♻ Auto" button; open the dialog; track it in `confirmDialog`.
- `tests/smelt.test.ts` (modify) — add bulk-smelt unit tests.

---

### Task 1: Pure bulk-smelt logic in `src/core/smelt.ts`

**Files:**
- Modify: `src/core/smelt.ts`
- Test: `tests/smelt.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `tests/smelt.test.ts` (inside the file, after the existing `describe("smelt", ...)` block — add a new `describe`). Note the existing imports already bring in `createFreshSave`, `rollItem`, `ITEM_CATALOG`, `equipSlotsFor`, `Rarity`, `toItemInstanceSave`, `CHAOS_JEWEL`, `smeltYield`. Add `bulkSmelt`, `bulkSmeltPreview`, `AUTO_SMELT_RARITIES` to the existing import from `../src/core/smelt.ts`.

```ts
import {
  smeltItem, smeltYield, SMELT_YIELD,
  bulkSmelt, bulkSmeltPreview, AUTO_SMELT_RARITIES,
} from "../src/core/smelt.ts";
```

```ts
describe("bulk smelt (auto-recycle)", () => {
  function pushOne(save: ReturnType<typeof createFreshSave>, r: Rarity, seed: number) {
    const inst = toItemInstanceSave(rollItem(defOf(r), 5, seed));
    save.inventory.items.push(inst);
    return inst;
  }

  it("AUTO_SMELT_RARITIES is exactly Common, Magic, Rare", () => {
    expect(AUTO_SMELT_RARITIES).toEqual(["Common", "Magic", "Rare"]);
  });

  it("preview counts only selected, non-equipped rarities and does not mutate", () => {
    const save = createFreshSave();
    pushOne(save, "Common", 1);
    pushOne(save, "Common", 2);
    pushOne(save, "Magic", 3);
    pushOne(save, "Rare", 4);
    const before = save.inventory.items.length;

    const p = bulkSmeltPreview(save, ["Common", "Magic"]);
    expect(p.count).toBe(3);
    expect(p.chaos).toBe(smeltYield("Common") * 2 + smeltYield("Magic"));
    expect(save.inventory.items.length).toBe(before); // no mutation
  });

  it("bulk smelt removes matched items, mints summed chaos, leaves the rest", () => {
    const save = createFreshSave();
    const c1 = pushOne(save, "Common", 1);
    const m1 = pushOne(save, "Magic", 2);
    const rare = pushOne(save, "Rare", 3);
    const leg = pushOne(save, "Legendary", 4);
    const before = save.materials[CHAOS_JEWEL] ?? 0;

    const res = bulkSmelt(save, ["Common", "Magic"]);
    expect(res.count).toBe(2);
    expect(res.chaos).toBe(smeltYield("Common") + smeltYield("Magic"));
    expect(save.materials[CHAOS_JEWEL]).toBe(before + res.chaos);
    expect(save.inventory.items.find((i) => i.id === c1.id)).toBeUndefined();
    expect(save.inventory.items.find((i) => i.id === m1.id)).toBeUndefined();
    expect(save.inventory.items.find((i) => i.id === rare.id)).toBeDefined();
    expect(save.inventory.items.find((i) => i.id === leg.id)).toBeDefined();
  });

  it("never smelts equipped items even if their rarity is selected", () => {
    const save = createFreshSave();
    const def = defOf("Common");
    const inst = toItemInstanceSave(rollItem(def, 5, 9));
    save.inventory.items.push(inst);
    save.inventory.equipped[equipSlotsFor(def.slot)[0]] = inst.id;

    const res = bulkSmelt(save, ["Common"]);
    expect(res.count).toBe(0);
    expect(save.inventory.items.find((i) => i.id === inst.id)).toBeDefined();
  });

  it("requesting Legendary/Unique smelts nothing (guard holds)", () => {
    const save = createFreshSave();
    pushOne(save, "Legendary", 1);
    pushOne(save, "Unique", 2);
    const res = bulkSmelt(save, ["Legendary", "Unique"] as Rarity[]);
    expect(res.count).toBe(0);
    expect(res.chaos).toBe(0);
    expect(save.inventory.items.length).toBe(2);
  });

  it("empty selection yields nothing and no mutation", () => {
    const save = createFreshSave();
    pushOne(save, "Common", 1);
    const res = bulkSmelt(save, []);
    expect(res).toEqual({ count: 0, chaos: 0 });
    expect(save.inventory.items.length).toBe(1);
  });

  it("preview and bulk agree for the same selection", () => {
    const save = createFreshSave();
    pushOne(save, "Common", 1);
    pushOne(save, "Magic", 2);
    pushOne(save, "Rare", 3);
    const p = bulkSmeltPreview(save, ["Common", "Magic", "Rare"]);
    const res = bulkSmelt(save, ["Common", "Magic", "Rare"]);
    expect(res.count).toBe(p.count);
    expect(res.chaos).toBe(p.chaos);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/smelt.test.ts`
Expected: FAIL — `bulkSmelt`, `bulkSmeltPreview`, `AUTO_SMELT_RARITIES` are not exported.

- [ ] **Step 3: Implement the pure functions**

Append to `src/core/smelt.ts` (after `smeltItem`):

```ts
/** Rarities the bulk/auto smelt is allowed to touch ("rare or lower"). */
export const AUTO_SMELT_RARITIES: Rarity[] = ["Common", "Magic", "Rare"];

export interface BulkSmeltPreview {
  count: number;
  chaos: number;
}

export interface BulkSmeltResult {
  count: number;
  chaos: number;
}

/**
 * Non-equipped inventory items whose def rarity is in both `rarities` and
 * AUTO_SMELT_RARITIES. Shared by preview (read) and bulk (mutate).
 */
function eligibleForBulkSmelt(
  save: HeroSave,
  rarities: Rarity[],
): { idx: number; chaos: number }[] {
  const allowed = new Set(rarities.filter((r) => AUTO_SMELT_RARITIES.includes(r)));
  const equipped = new Set(Object.values(save.inventory.equipped).filter(Boolean) as string[]);
  const out: { idx: number; chaos: number }[] = [];
  save.inventory.items.forEach((it, idx) => {
    if (equipped.has(it.id)) return;
    const def = ITEM_CATALOG_MAP.get(it.defId);
    if (!def || !allowed.has(def.rarity)) return; // unresolvable def can't be classified → skip
    out.push({ idx, chaos: smeltYield(def.rarity) });
  });
  return out;
}

/** How many items + how much chaos a bulk smelt of `rarities` would yield. Pure. */
export function bulkSmeltPreview(save: HeroSave, rarities: Rarity[]): BulkSmeltPreview {
  const hits = eligibleForBulkSmelt(save, rarities);
  return { count: hits.length, chaos: hits.reduce((s, h) => s + h.chaos, 0) };
}

/** Smelt every eligible item of `rarities` at once. Mutates `save`; mints chaos. */
export function bulkSmelt(save: HeroSave, rarities: Rarity[]): BulkSmeltResult {
  const hits = eligibleForBulkSmelt(save, rarities);
  if (hits.length === 0) return { count: 0, chaos: 0 };
  const chaos = hits.reduce((s, h) => s + h.chaos, 0);
  // Remove by descending index so earlier splices don't shift later ones.
  for (const h of hits.sort((a, b) => b.idx - a.idx)) {
    save.inventory.items.splice(h.idx, 1);
  }
  save.materials[CHAOS_JEWEL] = (save.materials[CHAOS_JEWEL] ?? 0) + chaos;
  return { count: hits.length, chaos };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/smelt.test.ts`
Expected: PASS (all original + 7 new cases).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/core/smelt.ts tests/smelt.test.ts
git commit -m "feat: pure bulk-smelt by rarity (auto-recycle core, TDD)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: `SaveManager.bulkSmeltItems` wrapper

**Files:**
- Modify: `src/core/saveManagerCore.ts` (import near line 7; method near the existing `smeltItem` at ~line 335)

- [ ] **Step 1: Read the existing `smeltItem` wrapper for the exact persistence/event pattern**

Run: open `src/core/saveManagerCore.ts` around lines 335–345 and note how `smeltItem` calls `this.save` mutation, then `persist`/`emit` (mirror those exact calls — names vary by codebase; reuse whatever `smeltItem` uses).

- [ ] **Step 2: Extend the smelt import**

Change the existing import (line ~7):

```ts
import { smeltItem, bulkSmelt, type SmeltResult, type BulkSmeltResult } from "./smelt.ts";
```

(Add `Rarity` to the existing schema type import if not already present: it is used by the new method signature. Check the top-of-file imports — `Rarity` is imported in several sibling modules from `../data/schema.ts`.)

- [ ] **Step 3: Add the wrapper method**

Immediately after the existing `smeltItem(instanceId)` method, add:

```ts
  /** Bulk-smelt all non-equipped items of the given rarities into chaos. */
  bulkSmeltItems(rarities: Rarity[]): BulkSmeltResult {
    const r = bulkSmelt(this.save, rarities);
    if (r.count > 0) {
      // Mirror smeltItem's persistence + change notification exactly.
      this.persistAndNotify();
    }
    return r;
  }
```

Replace `this.persistAndNotify()` with the **same** call(s) the existing `smeltItem` makes after mutating (e.g. `this.save()`/`this.persist()` + `this.emit(...)`). Do NOT invent a new persistence path — copy `smeltItem`'s.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Run the full suite (no regressions)**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/core/saveManagerCore.ts
git commit -m "feat: SaveManager.bulkSmeltItems wraps bulk smelt with persistence

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Auto-recycle dialog presenter

**Files:**
- Create: `src/scenes/autoRecycleDialog.ts`

This module is Phaser-aware but self-contained: it owns the rarity-toggle state and renders the preview. No unit test (pure-Phaser UI); verified by tsc + playtest in Task 5.

- [ ] **Step 1: Create the dialog module**

```ts
/**
 * Auto-recycle dialog — pick rarities (Common/Magic/Rare) and bulk-smelt every
 * non-equipped item of those rarities at once. The caller owns the actual smelt
 * (confirm) and the live count/chaos source (preview); this module owns only the
 * toggle UI + preview rendering. Visual language mirrors ShopScene.openRecycle.
 */
import Phaser from "phaser";
import { crispText } from "./ui.ts";
import { AUTO_SMELT_RARITIES, type BulkSmeltPreview } from "../core/smelt.ts";
import type { Rarity } from "../data/schema.ts";

const RARITY_INT: Record<Rarity, number> = {
  Common: 0x9e9e9e, Magic: 0x2196f3, Rare: 0x9c27b0, Legendary: 0xff9800, Unique: 0xf44336,
};
const CHAOS_COL = 0xe0457a;

export interface AutoRecycleOpts {
  preview(rarities: Rarity[]): BulkSmeltPreview;
  confirm(rarities: Rarity[]): void; // performs the smelt + redraw/flash, then dialog closes
  onClose(): void;
}

export function openAutoRecycleDialog(
  scene: Phaser.Scene,
  opts: AutoRecycleOpts,
): Phaser.GameObjects.Container {
  const W = scene.scale.width, H = scene.scale.height;
  // Default: Common + Magic on, Rare off (Rare is reforge fuel — opt-in only).
  const selected = new Set<Rarity>(["Common", "Magic"]);

  const c = scene.add.container(0, 0).setDepth(300);

  const dim = scene.add.graphics();
  dim.fillStyle(0x000000, 0.55).fillRect(0, 0, W, H);
  const dimZone = scene.add.zone(W / 2, H / 2, W, H).setInteractive().on("pointerup", () => opts.onClose());
  c.add([dim, dimZone]);

  const bw = 360, bh = 230, bx = (W - bw) / 2, by = (H - bh) / 2;
  const panel = scene.add.graphics();
  panel.fillStyle(0x141c28, 0.99).fillRoundedRect(bx, by, bw, bh, 10);
  panel.lineStyle(2, CHAOS_COL, 1).strokeRoundedRect(bx, by, bw, bh, 10);
  const panelZone = scene.add.zone(bx + bw / 2, by + bh / 2, bw, bh).setInteractive(); // swallow clicks
  c.add([panel, panelZone]);

  c.add(crispText(scene, W / 2, by + 14, "Auto Recycle", { fontSize: "16px", color: "#ffffff", fontStyle: "bold" }).setOrigin(0.5, 0));
  c.add(crispText(scene, W / 2, by + 38, "Smelt every spare item of the picked rarities", { fontSize: "11px", color: "#9fb0c4", align: "center" }).setOrigin(0.5, 0));

  // Live preview line + the toggle chips re-render via render().
  const previewText = crispText(scene, W / 2, by + 120, "", { fontSize: "13px", color: "#ffd6a0", align: "center" }).setOrigin(0.5, 0);
  c.add(previewText);

  const chipObjs: { r: Rarity; bg: Phaser.GameObjects.Graphics; label: Phaser.GameObjects.Text }[] = [];
  const chipW = 96, chipH = 34, gap = 12;
  const totalW = AUTO_SMELT_RARITIES.length * chipW + (AUTO_SMELT_RARITIES.length - 1) * gap;
  let cx = (W - totalW) / 2;
  const chipY = by + 62;
  let smeltBtn: Phaser.GameObjects.Text;

  function render(): void {
    for (const ch of chipObjs) {
      const on = selected.has(ch.r);
      const col = RARITY_INT[ch.r];
      ch.bg.clear();
      ch.bg.fillStyle(on ? col : 0x202a38, on ? 0.85 : 1).fillRoundedRect(0, 0, chipW, chipH, 6);
      ch.bg.lineStyle(2, col, 1).strokeRoundedRect(0, 0, chipW, chipH, 6);
      ch.label.setColor(on ? "#101010" : "#cdd6e4").setFontStyle(on ? "bold" : "normal");
    }
    const p = opts.preview([...selected]);
    previewText.setText(`Smelt ${p.count} item${p.count === 1 ? "" : "s"}  →  ❖ ${p.chaos} Chaos`);
    const enabled = p.count > 0;
    smeltBtn.setColor(enabled ? "#fff" : "#7a8494").setBackgroundColor(enabled ? "#7a3a5a" : "#2a3142");
  }

  for (const r of AUTO_SMELT_RARITIES) {
    const bg = scene.add.graphics();
    bg.setPosition(cx, chipY);
    const label = crispText(scene, cx + chipW / 2, chipY + chipH / 2, r, { fontSize: "12px" }).setOrigin(0.5);
    const z = scene.add.zone(cx, chipY, chipW, chipH).setOrigin(0).setInteractive({ useHandCursor: true });
    z.on("pointerup", () => {
      if (selected.has(r)) selected.delete(r); else selected.add(r);
      render();
    });
    c.add([bg, label, z]);
    chipObjs.push({ r, bg, label });
    cx += chipW + gap;
  }

  smeltBtn = crispText(scene, W / 2, by + 152, "🔨 Smelt All", { fontSize: "14px", color: "#fff", backgroundColor: "#7a3a5a", fixedWidth: bw - 60, align: "center" })
    .setOrigin(0.5, 0).setPadding(0, 9, 0, 9).setInteractive({ useHandCursor: true });
  smeltBtn.on("pointerup", () => {
    const sel = [...selected];
    const p = opts.preview(sel);
    if (p.count <= 0) return; // disabled state — inert
    opts.confirm(sel);
  });
  c.add(smeltBtn);

  const cancel = crispText(scene, W / 2, by + bh - 28, "Cancel", { fontSize: "13px", color: "#cdd6e4" })
    .setOrigin(0.5, 0).setPadding(0, 4, 0, 4).setInteractive({ useHandCursor: true });
  cancel.on("pointerup", () => opts.onClose());
  c.add(cancel);

  render();
  return c;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (If `crispText`'s option type rejects `fixedWidth`/`fontStyle`, copy the exact call shape already used in `ShopScene.openRecycle` — those options are proven there.)

- [ ] **Step 3: Commit**

```bash
git add src/scenes/autoRecycleDialog.ts
git commit -m "feat: auto-recycle dialog presenter (rarity toggles + live preview)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Wire the ♻ Auto button into ShopScene

**Files:**
- Modify: `src/scenes/ShopScene.ts`

- [ ] **Step 1: Add imports**

At the top of `src/scenes/ShopScene.ts`, add:

```ts
import { openAutoRecycleDialog } from "./autoRecycleDialog.ts";
import { bulkSmeltPreview } from "../core/smelt.ts";
```

- [ ] **Step 2: Declare the button field**

Add to the class fields (near `refreshBtn` at line ~40):

```ts
  private autoBtn!: Phaser.GameObjects.Text;
```

- [ ] **Step 3: Create the button in `create()`**

Immediately after the `refreshBtn` block (after line ~75), add:

```ts
    this.autoBtn = crispText(this, W - 20, 46, "♻ Auto", { fontSize: "12px", color: "#fff", backgroundColor: "#5a2a4a" })
      .setOrigin(1, 0).setPadding(8, 4, 8, 4).setInteractive({ useHandCursor: true }).setVisible(false);
    this.autoBtn.on("pointerup", () => this.openAutoRecycle());
```

- [ ] **Step 4: Toggle button visibility by mode in `redraw()`**

In `redraw()`, the line `this.refreshBtn.setVisible(this.mode === "buy")...` (line ~132) — add right after it:

```ts
    this.autoBtn.setVisible(this.mode === "recycle");
```

- [ ] **Step 5: Add the `openAutoRecycle` method**

Add a method (e.g. just before `openRecycle`):

```ts
  /** Bulk-smelt by rarity. Reuses the confirmDialog slot for scene-reentry cleanup. */
  private openAutoRecycle(): void {
    this.confirmDialog?.destroy(true);
    this.tooltip.setVisible(false);
    this.confirmDialog = openAutoRecycleDialog(this, {
      preview: (rarities) => bulkSmeltPreview(this.mgr.getSave(), rarities),
      confirm: (rarities) => {
        const r = this.mgr.bulkSmeltItems(rarities);
        this.closeConfirm();
        this.flash(r.count > 0 ? `Recycled ${r.count} items → ❖ ${r.chaos} Chaos` : "Nothing to recycle", r.count > 0);
        this.redraw();
      },
      onClose: () => this.closeConfirm(),
    });
  }
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Confirm file is under the 500-line cap**

Run: `wc -l src/scenes/ShopScene.ts`
Expected: comfortably under 500 (≈ 360 + ~20 = ~380).

- [ ] **Step 8: Commit**

```bash
git add src/scenes/ShopScene.ts
git commit -m "feat: ♻ Auto button opens auto-recycle dialog in the Recycle view

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Verify whole + playtest

**Files:** none (verification only)

- [ ] **Step 1: Full typecheck + test suite + build**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: tsc clean, all tests pass, build succeeds.

- [ ] **Step 2: CDP playtest**

Start dev server, drive via CDP (`window.__game`): open ShopScene, switch to Recycle, confirm the ♻ Auto button appears; open the dialog; toggle Common/Magic/Rare and confirm the preview count + chaos update; run "Smelt All"; confirm matching items vanish from the grid, the ❖ chaos counter rises by the previewed amount, and there are 0 console errors. Capture a screenshot of the dialog.

Reference the CDP/playtest approach in memory [[reference_playtest_and_art]].

- [ ] **Step 3: Final commit (if any playtest fixups)**

```bash
git add -A
git commit -m "test: verify auto-recycle dialog end-to-end (playtest)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review Notes

- **Spec coverage:** Decisions 1–4 map to Task 1 (rarity guard + scope + preview) and Task 3 (default selection, single confirm, disabled-at-0). SaveManager persistence → Task 2. Button + scene-reentry → Task 4. Tests 1–6 → Task 1 steps. Playtest → Task 5.
- **Type consistency:** `BulkSmeltResult`/`BulkSmeltPreview`/`AUTO_SMELT_RARITIES` defined in Task 1, imported unchanged in Tasks 2–4. `bulkSmeltItems(rarities: Rarity[])` signature identical across Task 2 (def) and Task 4 (call). `openAutoRecycleDialog(scene, opts)` signature identical across Task 3 (def) and Task 4 (call).
- **Persistence caveat:** Task 2 Step 3 deliberately defers to whatever `smeltItem` already does rather than hardcoding a method name, since the exact persist/emit calls live in `saveManagerCore.ts` and must be copied, not invented.
