# Wing Craft UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the buggy Craft Wings dialog and add a rarity filter, an Auto-fill button, and a scrollable inventory tray.

**Architecture:** Replace drag-to-machine with tap-to-load + a row-windowed scrollable tray (reusing `scrollDrag.ts`). Materials load by tapping their machine socket. New pure module `wingTray.ts` owns filter/auto/window math; new presenter `wingCraftTray.ts` owns the chip row + scrollable grid; `wingCraftDialog.ts` is rewritten to orchestrate. No save/craft-math changes.

**Tech Stack:** TypeScript, Phaser 3, vitest. Pure logic isolated from Phaser presenters.

---

### Task 1: Pure `wingTray.ts` — filter / auto / window math

**Files:**
- Create: `src/core/wingTray.ts`
- Test: `tests/wingTray.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/wingTray.test.ts
import { describe, it, expect } from "vitest";
import {
  wingRarityFilters,
  filterWingItems,
  autoWingSelection,
  trayWindow,
  type WingItemLike,
} from "../src/core/wingTray.ts";

const mk = (id: string, rarity: WingItemLike["rarity"]): WingItemLike => ({ id, rarity });

describe("wingRarityFilters", () => {
  it("returns distinct present rarities in ladder order", () => {
    const items = [mk("a", "Rare"), mk("b", "Common"), mk("c", "Rare"), mk("d", "Legendary")];
    expect(wingRarityFilters(items)).toEqual(["Common", "Rare", "Legendary"]);
  });
  it("empty for no items", () => {
    expect(wingRarityFilters([])).toEqual([]);
  });
});

describe("filterWingItems", () => {
  const items = [mk("a", "Common"), mk("b", "Rare"), mk("c", "Common")];
  it("all → unchanged order", () => {
    expect(filterWingItems(items, "all").map((i) => i.id)).toEqual(["a", "b", "c"]);
  });
  it("single rarity, order preserved", () => {
    expect(filterWingItems(items, "Common").map((i) => i.id)).toEqual(["a", "c"]);
  });
  it("no match → empty", () => {
    expect(filterWingItems(items, "Unique")).toEqual([]);
  });
});

describe("autoWingSelection", () => {
  const items = [
    mk("leg", "Legendary"),
    mk("c1", "Common"),
    mk("r1", "Rare"),
    mk("c2", "Common"),
    mk("m1", "Magic"),
    mk("c3", "Common"),
  ];
  it("picks the lowest-rarity `need` items, stable tie-break by input order", () => {
    const r = autoWingSelection(items, {
      need: 3,
      jewelCap: 4,
      feathersOwned: 1,
      selected: new Set(),
    });
    expect(r.ids).toEqual(["c1", "c2", "c3"]);
    expect(r.jewels).toBe(1);
    expect(r.feather).toBe(true);
  });
  it("skips already-selected items and tops up", () => {
    const r = autoWingSelection(items, {
      need: 2,
      jewelCap: 4,
      feathersOwned: 1,
      selected: new Set(["c1", "c2"]),
    });
    expect(r.ids).toEqual(["c3", "m1"]);
  });
  it("jewels capped at 1; 0 when none owned; feather false when none owned", () => {
    const r = autoWingSelection(items, {
      need: 1,
      jewelCap: 0,
      feathersOwned: 0,
      selected: new Set(),
    });
    expect(r.jewels).toBe(0);
    expect(r.feather).toBe(false);
  });
  it("returns fewer ids than need when the pool is too small", () => {
    const r = autoWingSelection([mk("x", "Common")], {
      need: 5,
      jewelCap: 4,
      feathersOwned: 1,
      selected: new Set(),
    });
    expect(r.ids).toEqual(["x"]);
  });
});

describe("trayWindow", () => {
  it("computes rows, maxOffset and the visible slice", () => {
    // 30 items, 12 cols → 3 rows; 2 rows visible → maxOffset 1
    const w = trayWindow(30, 12, 2, 0);
    expect(w.rows).toBe(3);
    expect(w.maxOffset).toBe(1);
    expect(w.startRow).toBe(0);
    expect(w.visibleCount).toBe(24);
  });
  it("clamps offset to maxOffset and windows the tail", () => {
    const w = trayWindow(30, 12, 2, 9);
    expect(w.startRow).toBe(1);
    expect(w.visibleCount).toBe(30 - 12); // rows 1-2 → items 12..29
  });
  it("fewer than one page → maxOffset 0, all visible", () => {
    const w = trayWindow(5, 12, 2, 3);
    expect(w.maxOffset).toBe(0);
    expect(w.startRow).toBe(0);
    expect(w.visibleCount).toBe(5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/wingTray.test.ts`
Expected: FAIL — cannot find module `../src/core/wingTray.ts`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/core/wingTray.ts
//
// Pure tray math for the Craft Wings dialog: which rarity chips to show, filtering
// the gear list, the cheapest valid Auto-fill selection, and the row-window for the
// scrollable grid. No Phaser. The presenter (wingCraftTray.ts) renders these.
import { RARITIES, type Rarity } from "../data/schemaEnums.ts";

export interface WingItemLike {
  id: string;
  rarity: Rarity;
}

export type WingFilter = Rarity | "all";

const rank = (r: Rarity): number => RARITIES.indexOf(r);

/** Distinct rarities present in `items`, in ladder order (for the chip row). */
export function wingRarityFilters(items: WingItemLike[]): Rarity[] {
  const present = new Set(items.map((i) => i.rarity));
  return RARITIES.filter((r) => present.has(r));
}

/** Items matching `filter` ("all" → every item), original order preserved. */
export function filterWingItems<T extends WingItemLike>(items: T[], filter: WingFilter): T[] {
  return filter === "all" ? items.slice() : items.filter((i) => i.rarity === filter);
}

/** Cheapest valid auto-fill: lowest-rarity `need` unselected items + 1 jewel + feather. */
export function autoWingSelection(
  items: WingItemLike[],
  opts: { need: number; jewelCap: number; feathersOwned: number; selected: Set<string> },
): { ids: string[]; jewels: number; feather: boolean } {
  const pool = items
    .map((it, i) => ({ it, i }))
    .filter(({ it }) => !opts.selected.has(it.id))
    .sort((a, b) => rank(a.it.rarity) - rank(b.it.rarity) || a.i - b.i);
  const ids = pool.slice(0, Math.max(0, opts.need)).map((p) => p.it.id);
  return {
    ids,
    jewels: Math.min(1, Math.max(0, opts.jewelCap)),
    feather: opts.feathersOwned >= 1,
  };
}

export interface TrayWindow {
  startRow: number; // first visible row (clamped offset)
  visibleCount: number; // number of tiles in the window
  maxOffset: number; // max scroll offset in rows
  rows: number; // total rows
}

/** Row-window over a `cols`-wide grid showing `rowsVisible` rows from `offset`. */
export function trayWindow(
  count: number,
  cols: number,
  rowsVisible: number,
  offset: number,
): TrayWindow {
  const c = Math.max(1, cols);
  const rv = Math.max(1, rowsVisible);
  const rows = Math.ceil(count / c);
  const maxOffset = Math.max(0, rows - rv);
  const startRow = Math.min(Math.max(0, Math.round(offset)), maxOffset);
  const start = startRow * c;
  const end = Math.min(count, start + rv * c);
  return { startRow, visibleCount: Math.max(0, end - start), maxOffset, rows };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/wingTray.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/core/wingTray.ts tests/wingTray.test.ts
git commit -m "feat(wingcraft): pure tray filter/auto/window math (TDD)"
```

---

### Task 2: Extend `wingMachineLayout` — chip row, Auto/Clear, tray grid metrics

**Files:**
- Modify: `src/core/wingCraftMachine.ts` (the `MachineLayout` interface + `wingMachineLayout`)
- Test: `tests/wingCraftMachine.test.ts` (add cases)

- [ ] **Step 1: Write the failing test (append to the existing describe block)**

```ts
// tests/wingCraftMachine.test.ts — add inside the existing file
import { wingMachineLayout } from "../src/core/wingCraftMachine.ts";

describe("wingMachineLayout — redesign additions", () => {
  const L = wingMachineLayout(1280, 720);
  const within = (r: { x: number; y: number; w: number; h: number }) =>
    r.x >= L.panel.x &&
    r.y >= L.panel.y &&
    r.x + r.w <= L.panel.x + L.panel.w &&
    r.y + r.h <= L.panel.y + L.panel.h;

  it("exposes a filter row, auto + clear buttons inside the panel", () => {
    expect(within(L.filterRow)).toBe(true);
    expect(within(L.autoBtn)).toBe(true);
    expect(within(L.clearBtn)).toBe(true);
  });
  it("control row sits below the readout and above the tray", () => {
    expect(L.filterRow.y).toBeGreaterThanOrEqual(L.readout.y + L.readout.h);
    expect(L.tray.y).toBeGreaterThanOrEqual(L.filterRow.y + L.filterRow.h);
  });
  it("auto + clear share the control row and don't overlap the filter area", () => {
    expect(L.autoBtn.x).toBeGreaterThanOrEqual(L.filterRow.x + L.filterRow.w);
    expect(L.clearBtn.x).toBeGreaterThanOrEqual(L.autoBtn.x + L.autoBtn.w);
  });
  it("exposes grid metrics with at least one visible row", () => {
    expect(L.cols).toBeGreaterThanOrEqual(1);
    expect(L.rowsVisible).toBeGreaterThanOrEqual(1);
    expect(L.cell).toBeGreaterThan(0);
  });
  it("tray stays above the craft button", () => {
    expect(L.tray.y + L.tray.h).toBeLessThanOrEqual(L.craftBtn.y);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/wingCraftMachine.test.ts`
Expected: FAIL — `L.filterRow` / `L.autoBtn` / `L.clearBtn` / `L.cols` undefined.

- [ ] **Step 3: Update the interface + layout**

In `src/core/wingCraftMachine.ts`, extend `MachineLayout`:

```ts
export interface MachineLayout {
  panel: Rect;
  machine: Rect; // the cauldron / drop zone
  jewelSocket: Rect;
  featherSocket: Rect;
  readout: Rect;
  oddsBar: Rect;
  filterRow: Rect; // rarity chip strip (left of the control row)
  autoBtn: Rect; // Auto-fill button (control row)
  clearBtn: Rect; // Clear button (control row)
  craftBtn: Rect;
  tray: Rect; // scrollable gear grid viewport
  cell: number; // tile pitch (px)
  cols: number; // tiles per tray row
  rowsVisible: number; // tray rows shown at once
}
```

Replace the body of `wingMachineLayout` with (note `bh` grows to 500, machine
shrinks to 120, and a control row is inserted):

```ts
export function wingMachineLayout(W: number, H: number): MachineLayout {
  const bw = 600;
  const bh = 500;
  const bx = (W - bw) / 2;
  const by = (H - bh) / 2;
  const panel: Rect = { x: bx, y: by, w: bw, h: bh };

  const innerX = bx + PAD;
  const innerW = bw - PAD * 2;

  const machine: Rect = { x: innerX, y: by + 40, w: innerW, h: 120 };

  const sock = 44;
  const jewelSocket: Rect = {
    x: machine.x + machine.w - sock - 10,
    y: machine.y + 10,
    w: sock,
    h: sock,
  };
  const featherSocket: Rect = { x: jewelSocket.x, y: jewelSocket.y + sock + 8, w: sock, h: sock };

  const readout: Rect = { x: innerX, y: machine.y + machine.h + 8, w: innerW, h: 80 };
  const oddsBar: Rect = { x: readout.x + 8, y: readout.y + 56, w: readout.w - 16, h: 18 };

  // Control row: filter chips on the left, Auto + Clear on the right.
  const ctrlY = readout.y + readout.h + 6;
  const ctrlH = 28;
  const btnW = 58;
  const clearBtn: Rect = { x: innerX + innerW - btnW, y: ctrlY, w: btnW, h: ctrlH };
  const autoBtn: Rect = { x: clearBtn.x - 6 - btnW, y: ctrlY, w: btnW, h: ctrlH };
  const filterRow: Rect = { x: innerX, y: ctrlY, w: autoBtn.x - 6 - innerX, h: ctrlH };

  const craftBtn: Rect = { x: innerX, y: by + bh - 46, w: innerW - 96, h: 36 };

  const trayY = ctrlY + ctrlH + 6;
  const tray: Rect = { x: innerX, y: trayY, w: innerW, h: craftBtn.y - trayY - 8 };

  const cell = 46;
  const cols = Math.max(1, Math.floor(tray.w / cell));
  const rowsVisible = Math.max(1, Math.floor(tray.h / cell));

  return {
    panel,
    machine,
    jewelSocket,
    featherSocket,
    readout,
    oddsBar,
    filterRow,
    autoBtn,
    clearBtn,
    craftBtn,
    tray,
    cell,
    cols,
    rowsVisible,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/wingCraftMachine.test.ts`
Expected: PASS (existing nesting/socket cases still pass; new cases pass).

- [ ] **Step 5: Commit**

```bash
git add src/core/wingCraftMachine.ts tests/wingCraftMachine.test.ts
git commit -m "feat(wingcraft): layout adds chip row + auto/clear + grid metrics"
```

---

### Task 3: `wingCraftTray.ts` presenter — scrollable, filtered, tap-to-load grid

**Files:**
- Create: `src/scenes/wingCraftTray.ts`

This presenter renders the rarity chip row and a row-windowed scrollable grid of gear
tiles. Each tile is tap-to-load via a hit `Zone` (so missing-texture items are still
selectable). It owns `filter` + `offset` state and wires `attachDragScroll`. No tests
(Phaser); verified in Task 5 playtest.

- [ ] **Step 1: Create the file**

```ts
// src/scenes/wingCraftTray.ts
//
// The Craft Wings gear tray: a rarity-filter chip row above a row-windowed,
// scrollable, tap-to-load grid. Every tile is a hit Zone (always tappable, even when
// the icon texture is missing — then a rarity-colored letter tile is drawn). Pure
// tray math lives in core/wingTray.ts; this only renders + wires scroll.
import type Phaser from "phaser";
import { crispText } from "./ui.ts";
import { itemTex } from "../data/assetKeys.ts";
import { RARITY_INT, idealTextColor } from "../data/rarityColors.ts";
import { attachDragScroll, type DragScrollHandle } from "./scrollDrag.ts";
import {
  wingRarityFilters,
  filterWingItems,
  trayWindow,
  type WingFilter,
} from "../core/wingTray.ts";
import type { MachineLayout } from "../core/wingCraftMachine.ts";
import type { WingCraftItem } from "./wingCraftDialog.ts";

const ACCENT = 0x9a59d6;

export interface WingTrayOpts {
  scene: Phaser.Scene;
  parent: Phaser.GameObjects.Container;
  layout: MachineLayout;
  items: WingCraftItem[];
  isLoaded: (id: string) => boolean;
  onLoad: (id: string) => void; // load one gear item into the machine
}

export interface WingTrayHandle {
  render: () => void;
  destroy: () => void;
}

export function createWingTray(opts: WingTrayOpts): WingTrayHandle {
  const { scene, parent, layout: L, items } = opts;
  let filter: WingFilter = "all";
  let offset = 0;

  const chipLayer = scene.add.container(0, 0);
  const gridLayer = scene.add.container(0, 0);
  parent.add([chipLayer, gridLayer]);

  const visible = (): WingCraftItem[] => filterWingItems(items, filter);

  const drawChips = (): void => {
    chipLayer.removeAll(true);
    const rarities = wingRarityFilters(items);
    const opts2: { key: WingFilter; label: string; col: number }[] = [
      { key: "all", label: "All", col: ACCENT },
      ...rarities.map((r) => ({ key: r as WingFilter, label: r[0], col: RARITY_INT[r] })),
    ];
    let cx = L.filterRow.x;
    const chipW = Math.min(46, Math.floor((L.filterRow.w - (opts2.length - 1) * 4) / opts2.length));
    for (const o of opts2) {
      const on = filter === o.key;
      const g = scene.add.graphics();
      g.fillStyle(o.col, on ? 0.95 : 0.18).fillRoundedRect(cx, L.filterRow.y, chipW, L.filterRow.h, 6);
      g.lineStyle(1, o.col, on ? 1 : 0.5).strokeRoundedRect(cx, L.filterRow.y, chipW, L.filterRow.h, 6);
      const t = crispText(scene, cx + chipW / 2, L.filterRow.y + L.filterRow.h / 2, o.label, {
        fontSize: "12px",
        color: on ? idealTextColor(o.col) : "#cdb8e6",
        fontStyle: "bold",
      }).setOrigin(0.5);
      const z = scene.add
        .zone(cx + chipW / 2, L.filterRow.y + L.filterRow.h / 2, chipW, L.filterRow.h)
        .setInteractive({ useHandCursor: true })
        .on("pointerup", () => {
          filter = o.key;
          offset = 0;
          render();
        });
      chipLayer.add([g, t, z]);
      cx += chipW + 4;
    }
  };

  const drawGrid = (): void => {
    gridLayer.removeAll(true);
    const list = visible();
    const win = trayWindow(list.length, L.cols, L.rowsVisible, offset);
    offset = win.startRow; // keep state clamped
    const start = win.startRow * L.cols;
    for (let i = 0; i < win.visibleCount; i++) {
      const it = list[start + i];
      if (!it) continue;
      const cx = L.tray.x + (i % L.cols) * L.cell;
      const cy = L.tray.y + Math.floor(i / L.cols) * L.cell;
      const cxc = cx + L.cell / 2;
      const cyc = cy + L.cell / 2;
      const loaded = opts.isLoaded(it.id);
      const col = RARITY_INT[it.rarity];

      const ring = scene.add.graphics();
      ring.lineStyle(1, col, loaded ? 0.25 : 0.7).strokeRoundedRect(cx + 2, cy + 2, L.cell - 6, L.cell - 6, 6);
      gridLayer.add(ring);

      const texKey = itemTex(it.defId);
      if (scene.textures.exists(texKey)) {
        const img = scene.add.image(cxc, cyc, texKey).setDisplaySize(38, 38).setAlpha(loaded ? 0.32 : 1);
        gridLayer.add(img);
      } else {
        // Fallback: rarity-colored letter tile so the item is visible + tappable.
        const g = scene.add.graphics();
        g.fillStyle(col, loaded ? 0.18 : 0.55).fillRoundedRect(cx + 5, cy + 5, L.cell - 12, L.cell - 12, 6);
        const letter = crispText(scene, cxc, cyc, (it.name[0] ?? "?").toUpperCase(), {
          fontSize: "16px",
          color: idealTextColor(col),
          fontStyle: "bold",
        }).setOrigin(0.5).setAlpha(loaded ? 0.4 : 1);
        gridLayer.add([g, letter]);
      }

      const z = scene.add
        .zone(cxc, cyc, L.cell, L.cell)
        .setInteractive({ useHandCursor: true })
        .on("pointerup", () => {
          if (scroll.didScroll()) return; // a scroll gesture, not a tap
          if (!opts.isLoaded(it.id)) opts.onLoad(it.id);
          render();
        });
      gridLayer.add(z);
    }
  };

  const maxOffset = (): number =>
    trayWindow(visible().length, L.cols, L.rowsVisible, offset).maxOffset;

  const scroll: DragScrollHandle = attachDragScroll(scene, {
    rect: () => L.tray,
    rowH: L.cell,
    maxOffset,
    getOffset: () => offset,
    setOffset: (n) => {
      offset = n;
    },
    onChange: () => drawGrid(),
  });

  function render(): void {
    drawChips();
    drawGrid();
  }

  render();

  return {
    render,
    destroy: () => {
      chipLayer.destroy();
      gridLayer.destroy();
    },
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (the dialog still references the old API until Task 4; if tsc errors
come only from `wingCraftDialog.ts` imports they are resolved in Task 4 — run tsc
again after Task 4). Fix any errors local to `wingCraftTray.ts` now.

- [ ] **Step 3: Commit**

```bash
git add src/scenes/wingCraftTray.ts
git commit -m "feat(wingcraft): scrollable filtered tap-to-load gear tray presenter"
```

---

### Task 4: Rewrite `wingCraftDialog.ts` — tap sockets, Auto/Clear, use the tray

**Files:**
- Modify: `src/scenes/wingCraftDialog.ts` (full rewrite of the tray + interaction parts)
- Modify: `src/scenes/wingCraftDrag.ts` (remove `makeDraggable` + `machineZoneHit`; keep `drawSocket`)

- [ ] **Step 1: Trim `wingCraftDrag.ts` to just the socket drawer**

Replace the whole file with:

```ts
// src/scenes/wingCraftDrag.ts
//
// Socket drawing for the Craft Wings machine. (Drag-to-machine was removed in the
// 2026-06-14 redesign — the tray is now tap-to-load + scroll.)
import type Phaser from "phaser";
import type { Rect } from "../core/wingCraftMachine.ts";

/** Filled, bordered material socket; brightens when `on`. */
export function drawSocket(g: Phaser.GameObjects.Graphics, r: Rect, on: boolean): void {
  g.fillStyle(on ? 0x3a2a55 : 0x201830, 0.95).fillRoundedRect(r.x, r.y, r.w, r.h, 8);
  g.lineStyle(2, on ? 0xffffff : 0x6a5a86, on ? 1 : 0.5).strokeRoundedRect(r.x, r.y, r.w, r.h, 8);
}
```

- [ ] **Step 2: Rewrite `wingCraftDialog.ts`**

Replace the entire file with the following. Key changes vs. the old version: imports
the tray + `autoWingSelection`; drops `makeDraggable`/`machineZoneHit`/the `dragging`
tap-out guard; machine sockets are tappable (jewel cycles, feather toggles); adds Auto
+ Clear buttons; the tray is delegated to `createWingTray`.

```ts
/**
 * Craft Wings — load gear + materials into the machine, then Forge. The tray (gear
 * picker) is a scrollable, rarity-filterable, tap-to-load grid (wingCraftTray). Gear
 * loads by tapping a tray tile; the two materials load by tapping their machine
 * socket (jewel cycles 0..cap, feather toggles). Auto fills the cheapest valid craft;
 * Clear empties the machine. A live readout shows success % + outcome odds. The
 * caller owns inventory access, the preview math and the craft (confirm).
 */
import type Phaser from "phaser";
import { crispText } from "./ui.ts";
import { materialTex } from "../data/assetKeys.ts";
import { RARITY_INT } from "../data/rarityColors.ts";
import { JEWEL_OF_CHAOS, FEATHER } from "../data/materials.ts";
import { MAX_JEWELS, MIN_ITEMS } from "../core/wingCraft.ts";
import {
  wingCraftGate,
  wingMachineLayout,
  loadedSlotLayout,
  oddsBarSegments,
} from "../core/wingCraftMachine.ts";
import { autoWingSelection } from "../core/wingTray.ts";
import { drawSocket } from "./wingCraftDrag.ts";
import { createWingTray, type WingTrayHandle } from "./wingCraftTray.ts";
import type { Rarity } from "../data/schema.ts";

export interface WingCraftItem {
  id: string;
  defId: string;
  name: string;
  rarity: Rarity;
}

export interface WingCraftPreview {
  success: number; // 0..1
  odds: { rarity: Rarity; chance: number }[];
}

export interface WingCraftOpts {
  items: WingCraftItem[];
  jewelsOwned: number;
  feathersOwned: number;
  preview(selectedIds: string[], jewels: number): WingCraftPreview;
  confirm(selectedIds: string[], jewels: number): void;
  onClose(): void;
}

const ACCENT = 0x9a59d6; // chaos violet

export function openWingCraftDialog(
  scene: Phaser.Scene,
  opts: WingCraftOpts,
): Phaser.GameObjects.Container {
  const W = scene.scale.width;
  const H = scene.scale.height;
  const L = wingMachineLayout(W, H);

  // ---- mutable machine state -------------------------------------------------
  const selected = new Set<string>();
  const jewelCap = Math.min(MAX_JEWELS, Math.max(0, opts.jewelsOwned));
  let jewels = 0;
  let feather = false;

  const c = scene.add.container(0, 0).setDepth(320);

  // Dim + tap-out (no drag any more, so a plain tap-out close is safe).
  const dim = scene.add.graphics();
  dim.fillStyle(0x000000, 0.78).fillRect(0, 0, W, H);
  const dimZone = scene.add
    .zone(W / 2, H / 2, W, H)
    .setInteractive()
    .on("pointerup", () => opts.onClose());
  c.add([dim, dimZone]);

  // Panel.
  const panel = scene.add.graphics();
  panel.fillStyle(0x141022, 0.99).fillRoundedRect(L.panel.x, L.panel.y, L.panel.w, L.panel.h, 12);
  panel.lineStyle(2, ACCENT, 1).strokeRoundedRect(L.panel.x, L.panel.y, L.panel.w, L.panel.h, 12);
  const panelZone = scene.add
    .zone(L.panel.x + L.panel.w / 2, L.panel.y + L.panel.h / 2, L.panel.w, L.panel.h)
    .setInteractive();
  c.add([panel, panelZone]);

  c.add(
    crispText(scene, W / 2, L.panel.y + 12, "Craft Wings", {
      fontSize: "18px",
      color: "#e9d5ff",
      fontStyle: "bold",
    }).setOrigin(0.5, 0),
  );

  // ---- machine ---------------------------------------------------------------
  const machineGfx = scene.add.graphics();
  c.add(machineGfx);
  const drawMachine = (): void => {
    machineGfx.clear();
    machineGfx
      .fillStyle(0x1d1430, 0.95)
      .fillRoundedRect(L.machine.x, L.machine.y, L.machine.w, L.machine.h, 10);
    machineGfx
      .lineStyle(2, ACCENT, 0.7)
      .strokeRoundedRect(L.machine.x, L.machine.y, L.machine.w, L.machine.h, 10);
  };
  c.add(
    crispText(scene, L.machine.x + 12, L.machine.y + 8, "Tap gear below + the sockets →", {
      fontSize: "11px",
      color: "#8a7aa6",
    }),
  );

  const loadedLayer = scene.add.container(0, 0);
  c.add(loadedLayer);

  // ---- material sockets (tap to load) ----------------------------------------
  const socketGfx = scene.add.graphics();
  c.add(socketGfx);
  const jewelCountText = crispText(scene, 0, 0, "", { fontSize: "12px", color: "#fff" }).setOrigin(0.5);
  const featherCountText = crispText(scene, 0, 0, "", { fontSize: "12px", color: "#fff" }).setOrigin(0.5);
  c.add([jewelCountText, featherCountText]);
  // Optional material icons behind the count glyphs (if textures exist).
  for (const [key, sock] of [
    [materialTex(JEWEL_OF_CHAOS), L.jewelSocket],
    [materialTex(FEATHER), L.featherSocket],
  ] as const) {
    if (scene.textures.exists(key)) {
      c.add(
        scene.add.image(sock.x + sock.w / 2, sock.y + sock.h / 2, key).setDisplaySize(30, 30).setAlpha(0.5),
      );
    }
  }
  const jewelZone = scene.add
    .zone(L.jewelSocket.x + L.jewelSocket.w / 2, L.jewelSocket.y + L.jewelSocket.h / 2, L.jewelSocket.w, L.jewelSocket.h)
    .setInteractive({ useHandCursor: true })
    .on("pointerup", () => {
      if (jewelCap <= 0) return;
      jewels = jewels >= jewelCap ? 0 : jewels + 1; // cycle 0..cap
      render();
    });
  const featherZone = scene.add
    .zone(L.featherSocket.x + L.featherSocket.w / 2, L.featherSocket.y + L.featherSocket.h / 2, L.featherSocket.w, L.featherSocket.h)
    .setInteractive({ useHandCursor: true })
    .on("pointerup", () => {
      if (opts.feathersOwned < 1) return;
      feather = !feather;
      render();
    });
  c.add([jewelZone, featherZone]);

  // ---- readout ----------------------------------------------------------------
  const statusText = crispText(scene, L.readout.x, L.readout.y, "", { fontSize: "13px", color: "#e9d5ff" });
  const successText = crispText(scene, L.readout.x, L.readout.y + 26, "", {
    fontSize: "15px",
    color: "#ffe6a0",
    fontStyle: "bold",
  });
  c.add([statusText, successText]);
  c.add(
    crispText(scene, L.readout.x + L.readout.w, L.readout.y + 40, "Wing odds:", {
      fontSize: "11px",
      color: "#9fb0c4",
    }).setOrigin(1, 0),
  );
  const oddsGfx = scene.add.graphics();
  const oddsLabels = scene.add.container(0, 0);
  c.add([oddsGfx, oddsLabels]);

  // ---- Auto / Clear -----------------------------------------------------------
  const mkBtn = (rect: { x: number; y: number; w: number; h: number }, label: string, fill: number): Phaser.GameObjects.Text => {
    const g = scene.add.graphics();
    g.fillStyle(fill, 0.9).fillRoundedRect(rect.x, rect.y, rect.w, rect.h, 6);
    g.lineStyle(1, 0xffffff, 0.25).strokeRoundedRect(rect.x, rect.y, rect.w, rect.h, 6);
    c.add(g);
    const t = crispText(scene, rect.x + rect.w / 2, rect.y + rect.h / 2, label, {
      fontSize: "12px",
      color: "#fff",
      fontStyle: "bold",
    }).setOrigin(0.5);
    c.add(t);
    const z = scene.add
      .zone(rect.x + rect.w / 2, rect.y + rect.h / 2, rect.w, rect.h)
      .setInteractive({ useHandCursor: true });
    c.add(z);
    t.setData("zone", z);
    return t;
  };
  const autoBtn = mkBtn(L.autoBtn, "Auto", 0x2f7a4a);
  (autoBtn.getData("zone") as Phaser.GameObjects.Zone).on("pointerup", () => {
    const sel = autoWingSelection(opts.items, {
      need: Math.max(0, MIN_ITEMS - selected.size),
      jewelCap,
      feathersOwned: opts.feathersOwned,
      selected,
    });
    for (const id of sel.ids) selected.add(id);
    if (jewels === 0) jewels = sel.jewels;
    feather = feather || sel.feather;
    render();
  });
  const clearBtn = mkBtn(L.clearBtn, "Clear", 0x6a2f2f);
  (clearBtn.getData("zone") as Phaser.GameObjects.Zone).on("pointerup", () => {
    selected.clear();
    jewels = 0;
    feather = false;
    render();
  });

  // ---- craft + close ----------------------------------------------------------
  const craftBtn = crispText(scene, L.craftBtn.x, L.craftBtn.y, "", {
    fontSize: "15px",
    color: "#fff",
    fixedWidth: L.craftBtn.w,
    align: "center",
  })
    .setOrigin(0, 0)
    .setPadding(0, 8, 0, 8)
    .setInteractive({ useHandCursor: true });
  craftBtn.on("pointerup", () => {
    if (!wingCraftGate(gateInput()).canCraft) return;
    opts.confirm([...selected], jewels);
  });
  c.add(craftBtn);

  const close = crispText(scene, L.panel.x + L.panel.w - 56, L.craftBtn.y + 6, "Close", {
    fontSize: "13px",
    color: "#cdb8e6",
  })
    .setOrigin(0.5, 0)
    .setPadding(0, 4, 0, 4)
    .setInteractive({ useHandCursor: true });
  close.on("pointerup", () => opts.onClose());
  c.add(close);

  // ---- tray (delegated) -------------------------------------------------------
  const tray: WingTrayHandle = createWingTray({
    scene,
    parent: c,
    layout: L,
    items: opts.items,
    isLoaded: (id) => selected.has(id),
    onLoad: (id) => {
      selected.add(id);
      render();
    },
  });

  // ---- render -----------------------------------------------------------------
  function gateInput(): {
    itemCount: number;
    jewels: number;
    feather: boolean;
    jewelsOwned: number;
    feathersOwned: number;
  } {
    return {
      itemCount: selected.size,
      jewels,
      feather,
      jewelsOwned: opts.jewelsOwned,
      feathersOwned: opts.feathersOwned,
    };
  }

  function renderLoaded(): void {
    loadedLayer.removeAll(true);
    const pts = loadedSlotLayout(selected.size, L.machine, 30);
    [...selected].forEach((id, i) => {
      const it = opts.items.find((x) => x.id === id);
      const p = pts[i];
      if (!it || !p) return;
      const col = RARITY_INT[it.rarity];
      const g = scene.add.graphics();
      g.fillStyle(col, 0.85).fillRoundedRect(p.x - 13, p.y - 13, 26, 26, 5);
      const t = crispText(scene, p.x, p.y, (it.name[0] ?? "?").toUpperCase(), {
        fontSize: "13px",
        color: "#10121a",
        fontStyle: "bold",
      }).setOrigin(0.5);
      const z = scene.add
        .zone(p.x, p.y, 28, 28)
        .setInteractive({ useHandCursor: true })
        .on("pointerup", () => {
          selected.delete(id); // tap a loaded chip to unload it
          render();
        });
      loadedLayer.add([g, t, z]);
    });
  }

  function renderSockets(): void {
    socketGfx.clear();
    drawSocket(socketGfx, L.jewelSocket, jewels > 0);
    drawSocket(socketGfx, L.featherSocket, feather);
    jewelCountText
      .setText(`◈${jewels}`)
      .setPosition(L.jewelSocket.x + L.jewelSocket.w / 2, L.jewelSocket.y + L.jewelSocket.h - 9)
      .setColor(jewels > 0 ? "#e9d5ff" : "#6a5a86");
    featherCountText
      .setText(feather ? "✦" : "·")
      .setPosition(L.featherSocket.x + L.featherSocket.w / 2, L.featherSocket.y + L.featherSocket.h - 9)
      .setColor(feather ? "#fff6c0" : "#6a5a86");
  }

  function renderReadout(): void {
    const gate = wingCraftGate(gateInput());
    statusText.setText(
      `Items ${selected.size}/${MIN_ITEMS}   ·   Jewels ${jewels}/${jewelCap}   ·   Feather ${feather ? "✓" : "✗"}`,
    );
    const p = opts.preview([...selected], jewels);
    successText.setText(gate.canCraft ? `Success ${Math.round(p.success * 100)}%` : "Success —");

    oddsGfx.clear();
    oddsLabels.removeAll(true);
    const segs = oddsBarSegments(p.odds.length ? p.odds : [{ rarity: "Common", chance: 1 }], L.oddsBar);
    for (const s of segs) {
      oddsGfx.fillStyle(RARITY_INT[s.rarity], 0.9).fillRect(s.x, L.oddsBar.y, Math.max(0, s.w - 1), L.oddsBar.h);
      if (s.w > 34) {
        oddsLabels.add(
          crispText(scene, s.x + s.w / 2, L.oddsBar.y + L.oddsBar.h / 2, `${Math.round(s.chance * 100)}%`, {
            fontSize: "10px",
            color: "#10121a",
            fontStyle: "bold",
          }).setOrigin(0.5),
        );
      }
    }

    const hint = gate.needItems
      ? `Load ${gate.needItems} more item(s)`
      : !gate.hasJewel
        ? "Tap the ◈ socket"
        : !gate.hasFeather
          ? "Tap the ✦ socket"
          : "🔨 Forge Wings";
    craftBtn
      .setText(hint)
      .setColor(gate.canCraft ? "#fff" : "#8a7a9a")
      .setBackgroundColor(gate.canCraft ? "#6a2fa0" : "#2a2140");
  }

  function render(): void {
    drawMachine();
    renderLoaded();
    renderSockets();
    renderReadout();
    tray.render();
  }

  c.once("destroy", () => tray.destroy());

  render();
  return c;
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS. (If an unused-import error fires for anything removed, delete the
import.)

- [ ] **Step 4: Run the full unit suite**

Run: `npx vitest run`
Expected: PASS (wingTray + wingCraftMachine + everything else green).

- [ ] **Step 5: Commit**

```bash
git add src/scenes/wingCraftDialog.ts src/scenes/wingCraftDrag.ts
git commit -m "feat(wingcraft): tap-to-load dialog with sockets, auto/clear, scroll tray"
```

---

### Task 5: Verify — lint, build, live playtest, memory

**Files:** none (verification only)

- [ ] **Step 1: Lint (max-lines 500 guard + cycles)**

Run: `npm run lint`
Expected: PASS. Confirm `wingCraftDialog.ts` < 500 lines (`wc -l src/scenes/wingCraftDialog.ts`). If over, extract the Auto/Clear/material-socket block into a small `wingCraftControls.ts` presenter and re-commit.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: tsc clean + vite build clean.

- [ ] **Step 3: Live playtest via CDP**

Launch the dev server and drive `window.__game` to open Forge → Craft Wings (per `reference_playtest_and_art`). Verify, with a save that has many unequipped items:
- the tray scrolls (drag + flick) and never spills outside the panel;
- filter chips switch the gear shown and reset scroll;
- tapping a tray tile loads it; tapping a loaded chip in the machine unloads it;
- tapping the ◈ socket cycles jewels 0..cap..0; tapping ✦ toggles the feather;
- Auto fills 5 lowest-rarity items + 1 jewel + feather and the button unlocks;
- Clear empties the machine;
- Forge works and produces a wing/dissolve toast.
Capture a screenshot.

- [ ] **Step 4: Update memory**

Update `project_craft_wings.md` (and `MEMORY.md` pointer if the hook changes): note the 2026-06-14 UI redesign — drag-to-machine removed, tray is tap-to-load + rarity filter + windowed scroll (`core/wingTray.ts` + `scenes/wingCraftTray.ts`), materials load via tappable sockets, Auto/Clear buttons; `wingCraftDrag.ts` reduced to `drawSocket`.

- [ ] **Step 5: Final commit (if memory/docs changed) + report**

```bash
git add -A && git commit -m "docs(wingcraft): record UI redesign in memory + plan checkboxes"
```
```
