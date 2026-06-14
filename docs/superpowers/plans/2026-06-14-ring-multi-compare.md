# Ring multi-slot compare-and-replace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a player taps a ring while both ring slots are full, show the selected ring compared against *both* equipped rings, each equipped ring with its own Replace button.

**Architecture:** A new pure `equipRoute()` decides whether a bag tap should equip a free slot or compare against all full candidate slots (encoding the rings-both-full → two-target rule). `renderCompareDialog` is generalized from one equipped item to a list of compare targets, rendering SELECTED + one column-with-Replace per target. `HeroScene.openItemAction` is rewired through `equipRoute` and builds the target list.

**Tech Stack:** TypeScript, Phaser 3, Vitest. Pure logic lives in `src/data/`, Phaser presenters in `src/scenes/`.

---

### Task 1: Pure `equipRoute` decision module

**Files:**
- Create: `src/data/equipRoute.ts`
- Test: `tests/equip-route.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/equip-route.test.ts
import { describe, it, expect } from "vitest";
import { equipRoute } from "../src/data/equipRoute.ts";

describe("equipRoute", () => {
  it("equips the first ring slot when both are free", () => {
    expect(equipRoute("Ring", {})).toEqual({ kind: "equip", slot: "Ring1" });
  });

  it("equips the remaining free ring slot (Ring1 taken)", () => {
    expect(equipRoute("Ring", { Ring1: "a" })).toEqual({ kind: "equip", slot: "Ring2" });
  });

  it("compares against BOTH rings, in order, when both slots are full", () => {
    expect(equipRoute("Ring", { Ring1: "a", Ring2: "b" })).toEqual({
      kind: "compare",
      slots: ["Ring1", "Ring2"],
    });
  });

  it("equips a single-slot category when free", () => {
    expect(equipRoute("Weapon", {})).toEqual({ kind: "equip", slot: "Weapon" });
  });

  it("compares the single occupied slot for a single-slot category", () => {
    expect(equipRoute("Weapon", { Weapon: "w" })).toEqual({
      kind: "compare",
      slots: ["Weapon"],
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/equip-route.test.ts`
Expected: FAIL — "Failed to load url ../src/data/equipRoute.ts" (module not created yet).

- [ ] **Step 3: Write minimal implementation**

```ts
// src/data/equipRoute.ts
//
// Decides what tapping a BAG item should do, given which concrete equip slots
// its category occupies. A category can map to several slots (a Ring fits Ring1
// AND Ring2). If any candidate slot is free we equip into it; if every candidate
// is full we compare the bag item against ALL of them at once (the modal then
// offers a per-slot Replace). Pure — no Phaser, no save mutation.
import { equipSlotsFor, type ItemDefSlot, type ItemSlot } from "./schemaEnums.ts";

export type EquipRoute =
  | { kind: "equip"; slot: ItemSlot } // a candidate slot is free → fill it
  | { kind: "compare"; slots: ItemSlot[] }; // all candidates full → compare these

export function equipRoute(
  defSlot: ItemDefSlot,
  equipped: Partial<Record<ItemSlot, string>>,
): EquipRoute {
  const candidates = equipSlotsFor(defSlot);
  const free = candidates.find((s) => !equipped[s]);
  if (free !== undefined) return { kind: "equip", slot: free };
  return { kind: "compare", slots: candidates };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/equip-route.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/data/equipRoute.ts tests/equip-route.test.ts
git commit -m "feat(inventory): pure equipRoute decides equip vs compare-all-full slots

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Generalize `renderCompareDialog` to a list of targets

**Files:**
- Modify: `src/scenes/itemCompareDialog.ts` (whole file — signature + layout)

The current dialog takes one `equipped: ItemRef`, one `slot`, and `cb.onReplace`.
Generalize to `targets: CompareTarget[]` (each carries its own slot + onReplace),
render SELECTED plus one column per target, and put a gated Replace button under
each target column. Rows are the union of stat/affix labels across all pairs so
columns line up. The delta bracket lives in each equipped column.

- [ ] **Step 1: Replace the file contents**

Replace the entire contents of `src/scenes/itemCompareDialog.ts` with:

```ts
// src/scenes/itemCompareDialog.ts
//
// The inventory "compare & replace" modal. When a player taps a bag item whose
// equip slot(s) are already full, this lays the SELECTED (bag) item out on the
// left and ONE column per equipped item it could replace to its right. Each
// equipped column shows the same stat at the same row height as the others and
// carries the swap delta in a bracket (green = upgrade, red = downgrade), plus
// its OWN gated Replace button. A ring with both slots full therefore shows two
// equipped columns, two Replace buttons. The Enhance button sits under the
// SELECTED card; tapping the scrim closes.
//
// Renders into a caller-owned container (HeroScene.dialog) so the scene keeps
// ownership of visibility/lifecycle — mirrors renderItemTooltip's contract.
import type Phaser from "phaser";
import { crispText, panelText } from "./ui.ts";
import { compareItems, type ItemRef, type CompareRow } from "../data/itemCompare.ts";
import { makeFitIcon } from "./itemIcon.ts";
import { addGatedButton } from "./gatedButton.ts";
import { equipLevelGate } from "../data/equipGate.ts";
import { instanceReqLevel } from "../data/items.ts";
import type { Rarity, ItemSlot } from "../data/schema.ts";
import { itemTex } from "../data/assetKeys.ts";
import { RARITY_INT } from "../data/rarityColors.ts";

const RARITY_HEX: Record<Rarity, string> = {
  Common: "#c8d2dc",
  Magic: "#5fa8ff",
  Rare: "#c98bff",
  Legendary: "#ffb74d",
  Unique: "#ff7a7a",
};
const DELTA_COLOR = { "1": "#6ee06e", "-1": "#ff7a7a", "0": "#8aa0bb" } as const;

const SLOT_LABEL: Record<ItemSlot, string> = {
  Weapon: "Weapon",
  Helmet: "Helmet",
  BodyArmor: "Body",
  Gloves: "Gloves",
  Boots: "Boots",
  Amulet: "Amulet",
  Ring1: "Ring",
  Ring2: "Ring",
  Pet: "Pet",
  Wing: "Wing",
};

/** One equipped item the bag item could replace, with the swap wired in. */
export interface CompareTarget {
  ref: ItemRef; // the equipped item in this slot
  slot: ItemSlot; // Ring1 / Ring2 / Weapon / …
  onReplace: () => void; // swap THIS slot for the bag item
}

export interface CompareCallbacks {
  onEnhance: () => void; // open the enhance dialog for the bag item
  onClose: () => void; // dismiss the modal
}

const COL_W = 188; // per-item column width
const COL_GAP = 14;
const PAD = 14;
const ROW_H = 19;
const HEADER_H = 74; // icon + name + section divider
const SECTION_H = 22;
const FOOTER_H = 64;

/** Render the compare-and-replace modal into `dialog` and make it visible. */
export function renderCompareDialog(
  scene: Phaser.Scene,
  dialog: Phaser.GameObjects.Container,
  bag: ItemRef,
  targets: CompareTarget[],
  heroLevel: number,
  cb: CompareCallbacks,
): void {
  dialog.removeAll(true);

  // Per-target comparisons, then the union of row labels so every column lines
  // up row-for-row. compareItems stays the per-pair source of truth.
  const cmps = targets.map((t) => compareItems(bag, t.ref));
  const statLabels = unionLabels(cmps.map((c) => c.stats));
  const affixLabels = unionLabels(cmps.map((c) => c.affixes));

  // Body height = stats block (+ header) plus the affix block when present.
  let bodyRows = SECTION_H + Math.max(1, statLabels.length) * ROW_H;
  if (affixLabels.length) bodyRows += SECTION_H + affixLabels.length * ROW_H;
  const H = HEADER_H + bodyRows + FOOTER_H;

  const cols = targets.length + 1; // SELECTED + one per target
  const W = PAD * 2 + cols * COL_W + (cols - 1) * COL_GAP;
  const dx = (scene.scale.width - W) / 2;
  const dy = Math.max(20, (scene.scale.height - H) / 2 - 6);

  // x origin (relative to dx) of column i: 0 = SELECTED, 1.. = targets.
  const colX = (i: number) => PAD + i * (COL_W + COL_GAP);

  const g = scene.add.graphics();
  g.fillStyle(0x070b12, 0.6).fillRect(0, 0, scene.scale.width, scene.scale.height); // scrim
  g.fillStyle(0x141c28, 1).fillRoundedRect(dx, dy, W, H, 10);
  g.lineStyle(2, RARITY_INT[bag.def.rarity], 1).strokeRoundedRect(dx, dy, W, H, 10);
  for (let i = 1; i < cols; i++) {
    const mid = colX(i) - COL_GAP / 2;
    g.lineStyle(1, 0x2a3650, 0.8).lineBetween(dx + mid, dy + 10, dx + mid, dy + H - FOOTER_H + 2);
  }
  const scrim = scene.add
    .zone(0, 0, scene.scale.width, scene.scale.height)
    .setOrigin(0)
    .setInteractive();
  scrim.on("pointerup", cb.onClose);
  dialog.add(g);
  dialog.add(scrim);

  const txt = (
    xx: number,
    yy: number,
    s: string,
    style: Phaser.Types.GameObjects.Text.TextStyle = {},
  ) => {
    const t = crispText(scene, dx + xx, dy + yy, s, {
      fontSize: "12px",
      color: "#dfe8f3",
      ...style,
    });
    dialog.add(t);
    return t;
  };
  const enh = (r: ItemRef) => (r.inst.enhanceLevel ? ` +${r.inst.enhanceLevel}` : "");

  // Column header: icon + role tag + item name in its rarity colour.
  const header = (originX: number, tag: string, ref: ItemRef) => {
    const icon = makeFitIcon(scene, dx + originX + 16, dy + 26, itemTex(ref.def.id), 30, "❔");
    dialog.add(icon);
    txt(originX + 36, 10, tag, { fontSize: "9px", color: "#7e8ea3" });
    txt(originX + 36, 22, `${ref.def.name}${enh(ref)}`, {
      fontSize: "12px",
      color: RARITY_HEX[ref.def.rarity],
      fontStyle: "bold",
      wordWrap: { width: COL_W - 40 },
    });
  };
  header(colX(0), "SELECTED", bag);
  targets.forEach((t, i) => header(colX(i + 1), `EQUIPPED · ${SLOT_LABEL[t.slot]}`, t.ref));
  g.lineStyle(1, 0x2a3650, 0.9).lineBetween(
    dx + PAD,
    dy + HEADER_H - 6,
    dx + W - PAD,
    dy + HEADER_H - 6,
  );

  // Rows: same label at the same y across all columns.
  let y = HEADER_H;
  const section = (title: string) => {
    for (let i = 0; i < cols; i++) {
      txt(colX(i) + 4, y + 4, title, { fontSize: "10px", color: "#90a4bb", fontStyle: "bold" });
    }
    y += SECTION_H;
  };
  // SELECTED cell: bag's own value, plain. Equipped cell: equipped value + delta.
  const rowAt = (rows: CompareRow[], label: string) => rows.find((r) => r.label === label);
  const renderRow = (label: string, pick: (c: ReturnType<typeof compareItems>) => CompareRow[]) => {
    // SELECTED column — the bag value (same across pairs); fall back to "—".
    const sample = cmps.map(pick).map((rows) => rowAt(rows, label)).find(Boolean);
    txt(colX(0) + 6, y, label, { fontSize: "12px", color: "#cdd9ea" });
    txt(colX(0) + COL_W - 6, y, sample?.bag ?? "—", {
      fontSize: "12px",
      color: "#dfe8f3",
    }).setOrigin(1, 0);
    // One equipped column per target.
    targets.forEach((_t, i) => {
      const r = rowAt(pick(cmps[i]), label);
      const ox = colX(i + 1);
      txt(ox + 6, y, label, { fontSize: "12px", color: "#cdd9ea" });
      txt(ox + COL_W - 52, y, r?.equipped ?? "—", {
        fontSize: "12px",
        color: "#dfe8f3",
      }).setOrigin(1, 0);
      if (r) {
        txt(ox + COL_W - 2, y, `(${r.delta})`, {
          fontSize: "11px",
          color: DELTA_COLOR[String(r.dir) as "0"],
          fontStyle: "bold",
        }).setOrigin(1, 0);
      }
    });
    y += ROW_H;
  };

  section("Stats");
  if (statLabels.length) statLabels.forEach((l) => renderRow(l, (c) => c.stats));
  else {
    txt(colX(0) + 6, y, "No base stats.", { fontSize: "11px", color: "#7c8aa0" });
    y += ROW_H;
  }
  if (affixLabels.length) {
    section("Affixes");
    affixLabels.forEach((l) => renderRow(l, (c) => c.affixes));
  }

  // Footer: Enhance under SELECTED; one gated Replace under each target column.
  const btnY = dy + H - 46;
  const enhance = crispText(scene, dx + colX(0) + COL_W / 2, btnY, "⚒  Enhance", {
    fontSize: "14px",
    color: "#dfe8f3",
    backgroundColor: "#26344a",
  })
    .setOrigin(0.5, 0)
    .setPadding(14, 8, 14, 8)
    .setInteractive({ useHandCursor: true });
  enhance.on("pointerup", cb.onEnhance);
  dialog.add(enhance);

  const gate = equipLevelGate(heroLevel, instanceReqLevel(bag.inst, bag.def));
  targets.forEach((t, i) => {
    addGatedButton(scene, dialog, {
      x: dx + colX(i + 1) + COL_W / 2,
      y: btnY,
      label: "⇄  Replace",
      bg: "#1565c0",
      gate,
      onClick: t.onReplace,
    });
  });

  const close = crispText(scene, dx + W - 14, dy + 8, "✕", { fontSize: "16px", color: "#ef9a9a" })
    .setOrigin(1, 0)
    .setInteractive({ useHandCursor: true });
  close.on("pointerup", cb.onClose);
  dialog.add(close);

  dialog.add(
    panelText(scene, dx + PAD, dy + H - 16, "Bracket = change vs equipped · Green up · Red down", {
      fontSize: "9px",
      color: "#6c7c93",
    }),
  );

  dialog.setVisible(true);
}

/** Ordered union of row labels across several comparison row-lists. */
function unionLabels(lists: CompareRow[][]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const rows of lists) {
    for (const r of rows) {
      if (!seen.has(r.label)) {
        seen.add(r.label);
        out.push(r.label);
      }
    }
  }
  return out;
}
```

- [ ] **Step 2: Typecheck the file in isolation**

Run: `npx tsc --noEmit`
Expected: errors ONLY in `src/scenes/HeroScene.ts` (it still calls the old
signature) — `itemCompareDialog.ts` itself compiles clean. Task 3 fixes the caller.

- [ ] **Step 3: Commit**

```bash
git add src/scenes/itemCompareDialog.ts
git commit -m "feat(inventory): compare dialog renders one Replace column per equipped target

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Rewire `HeroScene.openItemAction` / `openCompare` through `equipRoute`

**Files:**
- Modify: `src/scenes/HeroScene.ts` (`openItemAction` ~458-483, `openCompare` ~486-520, imports)

- [ ] **Step 1: Update the imports**

Find the import that brings in `equipSlotsFor` (and `renderCompareDialog`). Ensure
these are imported. Add `equipRoute` and the `CompareTarget` type:

```ts
import { equipRoute } from "../data/equipRoute.ts";
import { renderCompareDialog, type CompareTarget } from "./itemCompareDialog.ts";
```

`equipSlotsFor` is no longer used directly in this file — remove it from its
import if it becomes unused (tsc will flag it under `noUnusedLocals` if so).

- [ ] **Step 2: Replace `openItemAction`**

```ts
  /**
   * Tapping an item decides between two flows via equipRoute: a free candidate
   * slot opens enhance (with an Equip button); all candidate slots full opens the
   * compare-and-replace dialog against EVERY full slot (so both rings each get a
   * Replace button). A tile that's already equipped goes straight to enhance.
   */
  private openItemAction(inst: ItemInstanceSave, fromSlot: ItemSlot | null): void {
    const save = this.mgr.getSave();
    const def = ITEM_CATALOG_MAP.get(inst.defId);
    if (!def) return;
    if (!fromSlot) {
      const route = equipRoute(def.slot, save.inventory.equipped);
      if (route.kind === "equip") {
        this.openEnhance(inst.id, route.slot); // a slot is open → enhance + Equip
        return;
      }
      // Every fitting slot is full → compare against each occupied slot.
      const targets = route.slots
        .map((slot) => {
          const eqInst = save.inventory.items.find((it) => it.id === save.inventory.equipped[slot]);
          const eqDef = eqInst ? ITEM_CATALOG_MAP.get(eqInst.defId) : undefined;
          return eqInst && eqDef && eqInst.id !== inst.id
            ? { slot, eqInst, eqDef }
            : null;
        })
        .filter((t): t is { slot: ItemSlot; eqInst: ItemInstanceSave; eqDef: ItemDef } => t !== null);
      if (targets.length) {
        this.openCompare(inst, def, targets);
        return;
      }
    }
    this.openEnhance(inst.id);
  }
```

- [ ] **Step 3: Replace `openCompare`**

```ts
  /** Side-by-side compare of a bag item against every equipped item it could replace. */
  private openCompare(
    bagInst: ItemInstanceSave,
    bagDef: ItemDef,
    targets: { slot: ItemSlot; eqInst: ItemInstanceSave; eqDef: ItemDef }[],
  ): void {
    this.hideTooltip();
    this.dialog.removeAll(true);
    const compareTargets: CompareTarget[] = targets.map((t) => ({
      ref: { inst: t.eqInst, def: t.eqDef },
      slot: t.slot,
      onReplace: () => {
        if (this.mgr.equipItem(bagInst.id, t.slot)) {
          fadeHide(this, this.dialog);
          this.showToast(`Equipped ${bagDef.name}`);
          this.refresh();
        } else {
          this.showToast(`Requires level ${bagInst.requiredLevel ?? bagDef.requiredLevel}`);
        }
      },
    }));
    renderCompareDialog(
      this,
      this.dialog,
      { inst: bagInst, def: bagDef },
      compareTargets,
      this.mgr.getSave().hero.level,
      {
        onEnhance: () => {
          this.dialog.setVisible(false);
          this.openEnhance(bagInst.id);
        },
        onClose: () => fadeHide(this, this.dialog),
      },
    );
    fadeShow(this, this.dialog);
  }
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (clean). If `equipSlotsFor` is now unused, remove it from the import.

- [ ] **Step 5: Run the full test suite**

Run: `npx vitest run`
Expected: PASS — all prior tests plus the 5 new `equip-route` tests.

- [ ] **Step 6: Commit**

```bash
git add src/scenes/HeroScene.ts
git commit -m "feat(inventory): tapping a ring with both slots full compares against both

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Verify whole + lint

**Files:** none (verification only)

- [ ] **Step 1: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 2: Lint the touched files**

Run: `npx eslint src/data/equipRoute.ts src/scenes/itemCompareDialog.ts src/scenes/HeroScene.ts`
Expected: clean (no max-lines or unused-var errors).

- [ ] **Step 3: Full test suite**

Run: `npx vitest run`
Expected: all green.

- [ ] **Step 4: Production build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Live playtest (CDP)**

Drive the running game via `window.__game` (see reference_playtest_and_art memory):
open Hero/Inventory, ensure both ring slots are filled, tap a bag ring, and
confirm the modal shows SELECTED + two EQUIPPED·Ring columns, each with its own
Replace button, and that tapping each Replace swaps the correct slot. Single-slot
items (e.g. a weapon with the weapon slot full) still show one equipped column.

- [ ] **Step 6: Final report**

No commit (verification only). Summarize what changed. Code-only change (no art) →
no ASSET_VERSION bump, no deploy unless requested.

---

## Self-Review notes

- **Spec coverage:** equipRoute (Task 1) ↔ spec §1; dialog generalization (Task 2)
  ↔ spec §2; HeroScene rewire (Task 3) ↔ spec §3; verify (Task 4) ↔ spec Testing.
  The "zero valid targets → fall through to enhance" defensive case is covered by
  Task 3 Step 2's `.filter` + final `openEnhance(inst.id)`.
- **Type consistency:** `CompareTarget` defined in Task 2, imported in Task 3.
  `EquipRoute`/`equipRoute` names match across Tasks 1 & 3. The internal
  `{ slot, eqInst, eqDef }` tuple type is repeated identically in `openItemAction`
  and `openCompare` signatures.
- **No placeholders:** every code step shows full code; commands have expected output.
