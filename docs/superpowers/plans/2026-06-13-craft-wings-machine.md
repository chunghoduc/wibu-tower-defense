# Craft Wings Machine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat tap-to-toggle Craft Wings dialog with a drag-and-drop "craft machine" where the player drags items + materials into a cauldron, the Craft button unlocks only when minimums are met, and a live readout shows success rate + outcome rarity odds.

**Architecture:** A new pure, Phaser-free module `src/core/wingCraftMachine.ts` owns the gating (`wingCraftGate`) and all geometry (`wingMachineLayout`, `loadedSlotLayout`, `oddsBarSegments`); it is fully unit-tested. The presenter `src/scenes/wingCraftDialog.ts` is rewritten around that geometry using Phaser native drag/drop, keeping its existing exported `openWingCraftDialog` signature so `ForgeScene` is untouched. The craft engine (`src/core/wingCraft.ts`) and its preview math are reused verbatim.

**Tech Stack:** TypeScript (strict, ESM `.ts` import specifiers), Phaser 3 (input drag/drop, Zones), Vitest. ESLint max-lines = 500 CODE lines (hard error). Prettier printWidth 100.

---

## File Structure

- **Create** `src/core/wingCraftMachine.ts` — pure gate + geometry helpers (no Phaser import).
- **Create** `tests/wingCraftMachine.test.ts` — Vitest unit tests for the pure module.
- **Rewrite** `src/scenes/wingCraftDialog.ts` — Phaser presenter; SAME exported
  `openWingCraftDialog(scene, opts)` + `WingCraftItem`/`WingCraftPreview`/`WingCraftOpts` types.
- **Contingency, only if presenter ≥ ~480 lines** `src/scenes/wingCraftDrag.ts` — extract
  `makeDraggable(...)` ghost-follow helper.
- **Unchanged:** `src/core/wingCraft.ts`, `src/scenes/ForgeScene.ts`, `src/core/saveManagerCore.ts`,
  `src/data/materials.ts`, `src/data/rarityColors.ts`, `src/data/assetKeys.ts`.

Reused exports (verified): `MIN_ITEMS=5`, `MAX_JEWELS=4` from `src/core/wingCraft.ts`;
`RARITY_INT` from `src/data/rarityColors.ts`; `itemTex` from `src/data/assetKeys.ts`;
`Rarity` type + `RARITIES` from `src/data/schema.ts`; `materialTex`/material icon keys via
`src/data/assetKeys.ts`; `JEWEL_OF_CHAOS`,`FEATHER` from `src/data/materials.ts`.

---

### Task 1: Pure gate — `wingCraftGate`

**Files:**
- Create: `src/core/wingCraftMachine.ts`
- Test: `tests/wingCraftMachine.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/wingCraftMachine.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { wingCraftGate } from "../src/core/wingCraftMachine.ts";

const base = { itemCount: 5, jewels: 1, feather: true, jewelsOwned: 4, feathersOwned: 2 };

describe("wingCraftGate", () => {
  it("locks when fewer than 5 items are loaded", () => {
    const g = wingCraftGate({ ...base, itemCount: 3 });
    expect(g.canCraft).toBe(false);
    expect(g.needItems).toBe(2);
  });

  it("unlocks at exactly 5 items + a jewel + a feather", () => {
    const g = wingCraftGate(base);
    expect(g.canCraft).toBe(true);
    expect(g.needItems).toBe(0);
    expect(g.hasJewel).toBe(true);
    expect(g.hasFeather).toBe(true);
  });

  it("locks with no jewel loaded", () => {
    const g = wingCraftGate({ ...base, jewels: 0 });
    expect(g.hasJewel).toBe(false);
    expect(g.canCraft).toBe(false);
  });

  it("locks when loaded jewels exceed owned", () => {
    const g = wingCraftGate({ ...base, jewels: 3, jewelsOwned: 2 });
    expect(g.hasJewel).toBe(false);
    expect(g.canCraft).toBe(false);
  });

  it("locks without a feather (or none owned)", () => {
    expect(wingCraftGate({ ...base, feather: false }).hasFeather).toBe(false);
    expect(wingCraftGate({ ...base, feathersOwned: 0 }).hasFeather).toBe(false);
  });

  it("never reports negative needItems above the minimum", () => {
    expect(wingCraftGate({ ...base, itemCount: 9 }).needItems).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/wingCraftMachine.test.ts`
Expected: FAIL — cannot resolve `../src/core/wingCraftMachine.ts` / `wingCraftGate is not a function`.

- [ ] **Step 3: Write minimal implementation**

Create `src/core/wingCraftMachine.ts`:

```ts
/**
 * Pure geometry + gating for the Craft Wings machine UI. No Phaser. The craft
 * engine (success %, outcome odds, the actual craft) lives in wingCraft.ts; this
 * module only decides "can the player craft yet?" and where every piece is drawn.
 */
import { MIN_ITEMS, MAX_JEWELS } from "./wingCraft.ts";
import type { Rarity } from "../data/schema.ts";

export interface MachineGate {
  canCraft: boolean;
  needItems: number; // how many MORE items are required (0 when satisfied)
  hasJewel: boolean; // ≥1 jewel loaded AND that many owned
  hasFeather: boolean; // feather loaded AND ≥1 owned
}

export function wingCraftGate(input: {
  itemCount: number;
  jewels: number;
  feather: boolean;
  jewelsOwned: number;
  feathersOwned: number;
}): MachineGate {
  const needItems = Math.max(0, MIN_ITEMS - input.itemCount);
  const hasJewel = input.jewels >= 1 && input.jewels <= MAX_JEWELS && input.jewelsOwned >= input.jewels;
  const hasFeather = input.feather && input.feathersOwned >= 1;
  return { canCraft: needItems === 0 && hasJewel && hasFeather, needItems, hasJewel, hasFeather };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/wingCraftMachine.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/wingCraftMachine.ts tests/wingCraftMachine.test.ts
git commit -m "feat(forge): pure wingCraftGate for craft-machine UI

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Pure layout — `wingMachineLayout`

**Files:**
- Modify: `src/core/wingCraftMachine.ts`
- Test: `tests/wingCraftMachine.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/wingCraftMachine.test.ts`:

```ts
import { wingMachineLayout, type Rect } from "../src/core/wingCraftMachine.ts";

const inside = (a: Rect, b: Rect): boolean =>
  a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h;

describe("wingMachineLayout", () => {
  const L = wingMachineLayout(960, 540);

  it("nests the machine, tray, readout and craft button inside the panel", () => {
    for (const r of [L.machine, L.tray, L.readout, L.craftBtn, L.oddsBar]) {
      expect(inside(r, L.panel)).toBe(true);
    }
  });

  it("puts the tray below the machine", () => {
    expect(L.tray.y).toBeGreaterThanOrEqual(L.machine.y + L.machine.h);
  });

  it("keeps the odds bar inside the readout region", () => {
    expect(inside(L.oddsBar, L.readout)).toBe(true);
  });

  it("places jewel and feather sockets inside the machine", () => {
    expect(inside(L.jewelSocket, L.machine)).toBe(true);
    expect(inside(L.featherSocket, L.machine)).toBe(true);
  });

  it("centers the panel on screen", () => {
    expect(L.panel.x + L.panel.w / 2).toBeCloseTo(480, 0);
    expect(L.panel.y + L.panel.h / 2).toBeCloseTo(270, 0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/wingCraftMachine.test.ts`
Expected: FAIL — `wingMachineLayout is not a function`.

- [ ] **Step 3: Write minimal implementation**

Append to `src/core/wingCraftMachine.ts`:

```ts
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface MachineLayout {
  panel: Rect;
  machine: Rect; // the cauldron / drop zone
  jewelSocket: Rect;
  featherSocket: Rect;
  readout: Rect;
  oddsBar: Rect;
  craftBtn: Rect;
  tray: Rect;
}

const PAD = 16;

/** Centered modal: machine (with material sockets) on top, readout, then tray. */
export function wingMachineLayout(W: number, H: number): MachineLayout {
  const bw = 600;
  const bh = 460;
  const bx = (W - bw) / 2;
  const by = (H - bh) / 2;
  const panel: Rect = { x: bx, y: by, w: bw, h: bh };

  const innerX = bx + PAD;
  const innerW = bw - PAD * 2;

  const machine: Rect = { x: innerX, y: by + 44, w: innerW, h: 150 };

  // Material sockets hug the machine's right edge (top: jewel, below: feather).
  const sock = 44;
  const jewelSocket: Rect = { x: machine.x + machine.w - sock - 10, y: machine.y + 12, w: sock, h: sock };
  const featherSocket: Rect = {
    x: jewelSocket.x,
    y: jewelSocket.y + sock + 10,
    w: sock,
    h: sock,
  };

  const readout: Rect = { x: innerX, y: machine.y + machine.h + 10, w: innerW, h: 64 };
  const oddsBar: Rect = { x: readout.x + 8, y: readout.y + 34, w: readout.w - 16, h: 18 };

  const craftBtn: Rect = { x: innerX, y: by + bh - 50, w: innerW - 96, h: 38 };

  const trayY = readout.y + readout.h + 8;
  const tray: Rect = { x: innerX, y: trayY, w: innerW, h: craftBtn.y - trayY - 10 };

  return { panel, machine, jewelSocket, featherSocket, readout, oddsBar, craftBtn, tray };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/wingCraftMachine.test.ts`
Expected: PASS (all Task 1 + Task 2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/wingCraftMachine.ts tests/wingCraftMachine.test.ts
git commit -m "feat(forge): wingMachineLayout geometry

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Pure helpers — `loadedSlotLayout` + `oddsBarSegments`

**Files:**
- Modify: `src/core/wingCraftMachine.ts`
- Test: `tests/wingCraftMachine.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/wingCraftMachine.test.ts`:

```ts
import { loadedSlotLayout, oddsBarSegments } from "../src/core/wingCraftMachine.ts";

describe("loadedSlotLayout", () => {
  const machine: Rect = { x: 100, y: 100, w: 400, h: 150 };

  it("returns exactly `count` points", () => {
    expect(loadedSlotLayout(7, machine)).toHaveLength(7);
    expect(loadedSlotLayout(0, machine)).toHaveLength(0);
  });

  it("keeps every slot inside the machine", () => {
    for (const p of loadedSlotLayout(12, machine, 36)) {
      expect(p.x).toBeGreaterThanOrEqual(machine.x);
      expect(p.y).toBeGreaterThanOrEqual(machine.y);
      expect(p.x).toBeLessThanOrEqual(machine.x + machine.w);
      expect(p.y).toBeLessThanOrEqual(machine.y + machine.h);
    }
  });
});

describe("oddsBarSegments", () => {
  const bar: Rect = { x: 10, y: 0, w: 300, h: 18 };
  const odds = [
    { rarity: "Common" as const, chance: 0.6 },
    { rarity: "Magic" as const, chance: 0.35 },
    { rarity: "Rare" as const, chance: 0.05 },
  ];

  it("tiles the bar exactly with no gaps and preserves order", () => {
    const segs = oddsBarSegments(odds, bar);
    expect(segs.map((s) => s.rarity)).toEqual(["Common", "Magic", "Rare"]);
    expect(segs[0].x).toBe(bar.x);
    for (let i = 1; i < segs.length; i++) {
      expect(segs[i].x).toBeCloseTo(segs[i - 1].x + segs[i - 1].w, 5);
    }
    const last = segs[segs.length - 1];
    expect(last.x + last.w).toBeCloseTo(bar.x + bar.w, 5);
  });

  it("makes widths proportional to chance", () => {
    const segs = oddsBarSegments(odds, bar);
    expect(segs[0].w).toBeGreaterThan(segs[1].w);
    expect(segs[1].w).toBeGreaterThan(segs[2].w);
  });

  it("handles a single-segment outcome", () => {
    const segs = oddsBarSegments([{ rarity: "Common", chance: 1 }], bar);
    expect(segs).toHaveLength(1);
    expect(segs[0].w).toBeCloseTo(bar.w, 5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/wingCraftMachine.test.ts`
Expected: FAIL — `loadedSlotLayout is not a function`.

- [ ] **Step 3: Write minimal implementation**

Append to `src/core/wingCraftMachine.ts`:

```ts
/** Centered, wrapping grid of up to `count` loaded item icons inside `machine`. */
export function loadedSlotLayout(
  count: number,
  machine: Rect,
  cell = 34,
): { x: number; y: number }[] {
  if (count <= 0) return [];
  const pad = 12;
  const usableW = machine.w - pad * 2 - 60; // leave room for the right-edge sockets
  const perRow = Math.max(1, Math.floor(usableW / cell));
  const rows = Math.ceil(count / cell === 0 ? 1 : count / perRow);
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) {
    const r = Math.floor(i / perRow);
    const c = i % perRow;
    const rowCount = Math.min(perRow, count - r * perRow);
    const rowW = rowCount * cell;
    const startX = machine.x + pad + (usableW - rowW) / 2 + cell / 2;
    const startY = machine.y + pad + cell / 2 + ((machine.h - pad * 2 - rows * cell) / 2);
    pts.push({ x: startX + c * cell, y: startY + r * cell });
  }
  return pts;
}

export interface OddsSegment {
  rarity: Rarity;
  x: number;
  w: number;
  chance: number;
}

/** Contiguous colored segments tiling `bar.w`; last absorbs rounding. */
export function oddsBarSegments(
  odds: { rarity: Rarity; chance: number }[],
  bar: Rect,
): OddsSegment[] {
  const total = odds.reduce((s, o) => s + o.chance, 0) || 1;
  const segs: OddsSegment[] = [];
  let x = bar.x;
  odds.forEach((o, i) => {
    const w = i === odds.length - 1 ? bar.x + bar.w - x : (o.chance / total) * bar.w;
    segs.push({ rarity: o.rarity, x, w, chance: o.chance });
    x += w;
  });
  return segs;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/wingCraftMachine.test.ts`
Expected: PASS (all pure-module tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/wingCraftMachine.ts tests/wingCraftMachine.test.ts
git commit -m "feat(forge): loadedSlotLayout + oddsBarSegments

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Rewrite presenter — drag-and-drop craft machine

**Files:**
- Rewrite: `src/scenes/wingCraftDialog.ts`
- (No test file — Phaser presenter; verified by tsc + build + playtest in Task 5.)

**Contract preserved (do not change):** the exported function signature
`openWingCraftDialog(scene: Phaser.Scene, opts: WingCraftOpts): Phaser.GameObjects.Container`
and the exported interfaces `WingCraftItem`, `WingCraftPreview`, `WingCraftOpts` — `ForgeScene`
imports `openWingCraftDialog` and `WingCraftItem` and must keep compiling untouched.

- [ ] **Step 1: Replace the file contents**

Overwrite `src/scenes/wingCraftDialog.ts` with:

```ts
/**
 * Craft Wings — a drag-and-drop craft machine. Drag inventory items and the two
 * materials (Jewel of Chaos, Feather) from the tray INTO the central machine; the
 * Forge button unlocks only when the gate passes (≥5 items + a jewel + the
 * feather). A live readout shows the success rate and a colored bar of the outcome
 * rarity odds. The caller owns inventory access, the preview math and the actual
 * craft (confirm); this module owns the machine UI only. Geometry + gating come
 * from the pure wingCraftMachine module.
 */
import type Phaser from "phaser";
import { crispText } from "./ui.ts";
import { itemTex, materialTex } from "../data/assetKeys.ts";
import { RARITY_INT } from "../data/rarityColors.ts";
import { JEWEL_OF_CHAOS, FEATHER } from "../data/materials.ts";
import { MAX_JEWELS } from "../core/wingCraft.ts";
import {
  wingCraftGate,
  wingMachineLayout,
  loadedSlotLayout,
  oddsBarSegments,
  type Rect,
} from "../core/wingCraftMachine.ts";
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
const CELL = 46;

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

  // Dim + tap-out.
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
    crispText(scene, W / 2, L.panel.y + 14, "Craft Wings", {
      fontSize: "18px",
      color: "#e9d5ff",
      fontStyle: "bold",
    }).setOrigin(0.5, 0),
  );

  // ---- machine drop zone (border redrawn by render/hover) --------------------
  const machineGfx = scene.add.graphics();
  c.add(machineGfx);
  const drawMachine = (hot: boolean): void => {
    machineGfx.clear();
    machineGfx.fillStyle(0x1d1430, 0.95).fillRoundedRect(L.machine.x, L.machine.y, L.machine.w, L.machine.h, 10);
    machineGfx
      .lineStyle(hot ? 3 : 2, hot ? 0xffffff : ACCENT, hot ? 1 : 0.7)
      .strokeRoundedRect(L.machine.x, L.machine.y, L.machine.w, L.machine.h, 10);
  };
  const machineZone = scene.add
    .zone(L.machine.x + L.machine.w / 2, L.machine.y + L.machine.h / 2, L.machine.w, L.machine.h)
    .setRectangleDropZone(L.machine.w, L.machine.h);
  c.add(machineZone);
  c.add(
    crispText(scene, L.machine.x + 12, L.machine.y + 8, "Drag items + materials here", {
      fontSize: "11px",
      color: "#8a7aa6",
    }),
  );

  // Layer that holds the loaded-item icons (re-rendered each change).
  const loadedLayer = scene.add.container(0, 0);
  c.add(loadedLayer);

  // ---- material sockets (jewel + feather) ------------------------------------
  const socketGfx = scene.add.graphics();
  c.add(socketGfx);
  const jewelCountText = crispText(scene, 0, 0, "", { fontSize: "12px", color: "#fff" }).setOrigin(0.5);
  const featherCountText = crispText(scene, 0, 0, "", { fontSize: "12px", color: "#fff" }).setOrigin(0.5);
  c.add([jewelCountText, featherCountText]);

  // ---- readout ----------------------------------------------------------------
  const statusText = crispText(scene, L.readout.x, L.readout.y, "", {
    fontSize: "13px",
    color: "#e9d5ff",
  });
  const successText = crispText(scene, L.readout.x, L.readout.y + 16, "", {
    fontSize: "15px",
    color: "#ffe6a0",
    fontStyle: "bold",
  });
  c.add([statusText, successText]);
  const oddsGfx = scene.add.graphics();
  const oddsLabels = scene.add.container(0, 0);
  c.add([oddsGfx, oddsLabels]);

  // ---- craft + close ----------------------------------------------------------
  const craftBtn = crispText(scene, L.craftBtn.x, L.craftBtn.y, "", {
    fontSize: "15px",
    color: "#fff",
    fixedWidth: L.craftBtn.w,
    align: "center",
  })
    .setOrigin(0, 0)
    .setPadding(0, 9, 0, 9)
    .setInteractive({ useHandCursor: true });
  craftBtn.on("pointerup", () => {
    if (!wingCraftGate(gateInput()).canCraft) return;
    opts.confirm([...selected], jewels);
  });
  c.add(craftBtn);

  const close = crispText(scene, L.panel.x + L.panel.w - 60, L.craftBtn.y + 8, "Close", {
    fontSize: "13px",
    color: "#cdb8e6",
  })
    .setOrigin(0.5, 0)
    .setPadding(0, 4, 0, 4)
    .setInteractive({ useHandCursor: true });
  close.on("pointerup", () => opts.onClose());
  c.add(close);

  // ---- tray (draggable item + material tiles) --------------------------------
  // Returns true if the source was consumed (so the tray tile dims).
  const tryLoad = (kind: "item" | "jewel" | "feather", id?: string): boolean => {
    if (kind === "item" && id && !selected.has(id) && opts.items.some((i) => i.id === id)) {
      selected.add(id);
      return true;
    }
    if (kind === "jewel" && jewels < jewelCap) {
      jewels++;
      return true;
    }
    if (kind === "feather" && !feather && opts.feathersOwned >= 1) {
      feather = true;
      return true;
    }
    return false;
  };

  const tileRefs: {
    kind: "item" | "jewel" | "feather";
    id?: string;
    img: Phaser.GameObjects.Image | null;
    ring: Phaser.GameObjects.Graphics;
    x: number;
    y: number;
  }[] = [];

  const trayCols = Math.max(1, Math.floor(L.tray.w / CELL));
  let slot = 0;
  const placeTile = (
    kind: "item" | "jewel" | "feather",
    texKey: string,
    rarity: Rarity | null,
    id?: string,
  ): void => {
    const cx = L.tray.x + (slot % trayCols) * CELL;
    const cy = L.tray.y + Math.floor(slot / trayCols) * CELL;
    slot++;
    const ring = scene.add.graphics();
    c.add(ring);
    let img: Phaser.GameObjects.Image | null = null;
    if (scene.textures.exists(texKey)) {
      img = scene.add.image(cx + 22, cy + 22, texKey).setDisplaySize(40, 40);
      c.add(img);
      makeDraggable(scene, img, cx + 22, cy + 22, () => {
        if (machineZoneHit(scene) && tryLoad(kind, id)) render();
      });
      img.on("pointerup", () => {
        if (tryLoad(kind, id)) render(); // tap-to-load fallback
      });
    }
    void rarity;
    tileRefs.push({ kind, id, img, ring, x: cx, y: cy });
  };

  // Material tiles first (always visible), then items.
  placeTile("jewel", materialTex(JEWEL_OF_CHAOS), null);
  placeTile("feather", materialTex(FEATHER), null);
  for (const it of opts.items) placeTile("item", itemTex(it.defId), it.rarity, it.id);

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

  function render(): void {
    drawMachine(false);

    // Loaded item icons inside the machine.
    loadedLayer.removeAll(true);
    const pts = loadedSlotLayout(selected.size, L.machine, 34);
    [...selected].forEach((id, i) => {
      const it = opts.items.find((x) => x.id === id);
      const p = pts[i];
      if (!it || !p) return;
      if (scene.textures.exists(itemTex(it.defId))) {
        const im = scene.add.image(p.x, p.y, itemTex(it.defId)).setDisplaySize(30, 30);
        im.setInteractive({ useHandCursor: true }).on("pointerup", () => {
          selected.delete(id); // tap a loaded icon to unload it
          render();
        });
        loadedLayer.add(im);
      }
    });

    // Material sockets.
    socketGfx.clear();
    drawSocket(socketGfx, L.jewelSocket, jewels > 0);
    drawSocket(socketGfx, L.featherSocket, feather);
    jewelCountText
      .setText(`◈${jewels}`)
      .setPosition(L.jewelSocket.x + L.jewelSocket.w / 2, L.jewelSocket.y + L.jewelSocket.h / 2)
      .setColor(jewels > 0 ? "#e9d5ff" : "#6a5a86");
    featherCountText
      .setText(feather ? "✦" : "·")
      .setPosition(L.featherSocket.x + L.featherSocket.w / 2, L.featherSocket.y + L.featherSocket.h / 2)
      .setColor(feather ? "#fff6c0" : "#6a5a86");

    // Tray tile rings + dimming (loaded → dim).
    for (const t of tileRefs) {
      const isLoaded =
        (t.kind === "item" && t.id && selected.has(t.id)) ||
        (t.kind === "jewel" && jewels >= jewelCap) ||
        (t.kind === "feather" && feather);
      const owned =
        t.kind === "item" ? true : t.kind === "jewel" ? jewelCap > 0 : opts.feathersOwned >= 1;
      if (t.img) t.img.setAlpha(isLoaded || !owned ? 0.35 : 1);
      const col =
        t.kind === "item"
          ? RARITY_INT[opts.items.find((i) => i.id === t.id)?.rarity ?? "Common"]
          : ACCENT;
      t.ring.clear();
      t.ring.lineStyle(1, col, owned ? 0.6 : 0.25).strokeRoundedRect(t.x, t.y, CELL - 2, CELL - 2, 6);
    }

    // Readout.
    const gate = wingCraftGate(gateInput());
    statusText.setText(
      `Items ${selected.size}/5   ·   Jewels ${jewels}/${MAX_JEWELS}   ·   Feather ${feather ? "✓" : "✗"}`,
    );
    const p = opts.preview([...selected], jewels);
    successText.setText(gate.canCraft ? `Success ${Math.round(p.success * 100)}%` : `Success —`);

    // Odds bar.
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

    // Craft button.
    const hint = gate.needItems
      ? `Load ${gate.needItems} more item(s)`
      : !gate.hasJewel
        ? "Add a Jewel of Chaos"
        : !gate.hasFeather
          ? "Add a Feather"
          : "🔨 Forge Wings";
    craftBtn
      .setText(hint)
      .setColor(gate.canCraft ? "#fff" : "#8a7a9a")
      .setBackgroundColor(gate.canCraft ? "#6a2fa0" : "#2a2140");
  }

  // Brighten the machine while a drag hovers it.
  scene.input.on("drag", () => {
    if (machineZoneHit(scene)) drawMachine(true);
    else drawMachine(false);
  });

  render();
  return c;
}

// ----- local helpers ---------------------------------------------------------

function drawSocket(g: Phaser.GameObjects.Graphics, r: Rect, on: boolean): void {
  g.fillStyle(on ? 0x3a2a55 : 0x201830, 0.95).fillRoundedRect(r.x, r.y, r.w, r.h, 8);
  g.lineStyle(2, on ? 0xffffff : 0x6a5a86, on ? 1 : 0.5).strokeRoundedRect(r.x, r.y, r.w, r.h, 8);
}

/** Is the pointer currently over the machine drop zone? */
function machineZoneHit(scene: Phaser.Scene): boolean {
  const zones = scene.input.hitTestPointer(scene.input.activePointer);
  return zones.some((z) => (z as Phaser.GameObjects.Zone).input?.dropZone === true);
}

/** Make an image draggable: it follows the pointer, then snaps home on release. */
function makeDraggable(
  scene: Phaser.Scene,
  img: Phaser.GameObjects.Image,
  homeX: number,
  homeY: number,
  onDrop: () => void,
): void {
  img.setInteractive({ useHandCursor: true, draggable: true });
  scene.input.setDraggable(img);
  img.on("drag", (_p: Phaser.Input.Pointer, dx: number, dy: number) => {
    img.setPosition(dx, dy).setDepth(400);
  });
  img.on("dragend", () => {
    img.setPosition(homeX, homeY).setDepth(0);
    onDrop();
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (no errors). If `materialTex` is not exported from `src/data/assetKeys.ts`, open that
file, find the material texture-key helper (search `material`) and use the real name; do NOT inline a
`<ns>__<id>` string (assetKeys is the sole key source).

- [ ] **Step 3: Lint the file size**

Run: `npx eslint src/scenes/wingCraftDialog.ts`
Expected: PASS. If `max-lines` errors (>500 code lines), extract `makeDraggable`, `drawSocket`,
`machineZoneHit` into a new `src/scenes/wingCraftDrag.ts` and import them.

- [ ] **Step 4: Run the full unit suite (no regressions)**

Run: `npx vitest run`
Expected: PASS (including the new `wingCraftMachine` tests).

- [ ] **Step 5: Commit**

```bash
git add src/scenes/wingCraftDialog.ts
git commit -m "feat(forge): drag-and-drop Craft Wings machine UI

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Verify whole — build + self-playtest + memory

**Files:**
- Modify (if playtest reveals issues): `src/scenes/wingCraftDialog.ts` and/or `src/core/wingCraftMachine.ts`
- Update memory: `~/.claude/projects/.../memory/` (project_craft_wings entry + MEMORY.md pointer)

- [ ] **Step 1: Production build**

Run: `npm run build`
Expected: `tsc` passes, Vite emits `dist/` with no errors.

- [ ] **Step 2: CDP self-playtest**

Launch the dev server and drive via `window.__game` (per the playtest memory):
navigate to `ForgeScene`, open the Craft Wings dialog, then exercise it:
- Confirm the Craft button reads "Load 5 more item(s)" and is dim on open.
- Drag (and tap) 5 items into the machine — they appear inside the cauldron; button advances
  through "Add a Jewel of Chaos" → "Add a Feather".
- Drag the Jewel stack and the Feather stack in; the sockets light, button reads "🔨 Forge Wings"
  and brightens; the odds bar shows colored segments with % labels and "Success XX%" appears.
- Tap a loaded item icon to unload it; the button re-locks. Forge once and confirm the toast.

Capture a screenshot to `/tmp/craft-wings-machine.png` and review it.

- [ ] **Step 3: Fix any issues found, re-run `npx tsc --noEmit` + `npx vitest run`**

Expected: all green. Re-screenshot if UI changed.

- [ ] **Step 4: Update memory**

Edit `~/.claude/projects/-home-shyaken-Workplace-wibu-tower-defense/memory/project_craft_wings.md`
to note the new drag-and-drop machine UI (pure `wingCraftMachine.ts` gate+geometry; presenter rewrite;
`ForgeScene` contract unchanged). Keep the MEMORY.md pointer line current.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "test(forge): verify craft-wings machine + memory note

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

Note: leave the pre-existing dirty tower-sprite/manifest/gacha files UNCOMMITTED (do not stage them
individually; `git add -A` here is acceptable ONLY if those files are confirmed unchanged by this work —
otherwise stage just the craft-wings files. Prefer explicit `git add` of touched files.)

---

## Self-Review

**Spec coverage:**
- Drag items into machine → Task 4 `makeDraggable` + `tryLoad("item")`, loaded icons via `loadedSlotLayout` (Task 3). ✓
- Draggable material stacks (jewel/feather) → Task 4 `placeTile("jewel"/"feather")` + sockets. ✓
- Craft button locked until minimums → Task 1 `wingCraftGate` drives `craftBtn` enable + hint. ✓
- Success rate shown → Task 4 `successText` from `opts.preview`. ✓
- Outcome rarity odds shown → Task 3 `oddsBarSegments` + Task 4 colored bar + % labels. ✓
- Drop-zone hover highlight → Task 4 `scene.input.on("drag")` → `drawMachine(true)`. ✓
- `ForgeScene` unchanged → Task 4 preserves `openWingCraftDialog`/`WingCraftOpts` exports. ✓
- Edge cases (0 jewels owned, jewel cap, no feather, <5 items, empty preview) → gate + `tryLoad` caps + `oddsBarSegments` fallback. ✓
- Pure module tested, ≤500 lines enforced → Tasks 1–3 tests + Task 4 Step 3 eslint. ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete code; the only conditional is the
documented `max-lines` contingency (real extraction instructions, not a placeholder).

**Type consistency:** `wingCraftGate` input shape matches `gateInput()` (itemCount/jewels/feather/
jewelsOwned/feathersOwned). `MachineLayout` field names (`machine`/`tray`/`readout`/`oddsBar`/
`craftBtn`/`jewelSocket`/`featherSocket`/`panel`) are used identically in Task 2, 3 tests and Task 4.
`oddsBarSegments`/`loadedSlotLayout`/`Rect` names consistent across tasks. `MAX_JEWELS`/`MIN_ITEMS`
imported from `wingCraft.ts` (verified exported). `RARITY_INT` keyed by `Rarity` (verified).
