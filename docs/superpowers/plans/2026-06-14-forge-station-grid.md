# Forge Station Grid Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace ForgeScene's vertical text-menu with a grid of station cards where every function shows a visual input→output, and each station opens a focused dialog laying out INPUT slots → forge arrow → OUTPUT slots with the action button inside that visual.

**Architecture:** A pure, unit-tested view-model module (`core/forgeStations.ts`) turns SaveManager/data primitives into `StationVM`/`ForgeRecipeVM`/`ForgeIngredient` descriptors + a grid layout. Two Phaser presenters consume it: `forgeStationCard.ts` (one tappable card with a mini input→output preview) and `forgeRecipeDialog.ts` (the focused transformation modal). `ForgeScene.ts` is rewritten as the orchestrator (resource bar + grid + dialog wiring). Craft Wings keeps its existing drag-machine dialog, launched from a card. No mechanic, balance, schema, or art changes.

**Tech Stack:** TypeScript, Phaser 3, vitest. Reuses `makeFitIcon` (texture-or-emoji), `data/rewardIcon` resolvers, `uiKit` (`accentPanel`/`interactive`/`dimBackdrop`/`closeModal`), and existing crafting logic in `SaveManager`, `core/awakening`, `core/banner`, `data/alchemy`.

---

## File Structure

- **Create** `src/core/forgeStations.ts` — pure VM builders + `forgeGridLayout`. Phaser-free.
- **Create** `tests/forgeStations.test.ts` — unit tests for the pure module.
- **Create** `src/scenes/forgeStationCard.ts` — presenter: one station card.
- **Create** `src/scenes/forgeRecipeDialog.ts` — presenter: the input→output modal.
- **Rewrite** `src/scenes/ForgeScene.ts` — orchestrator (resource bar + grid + wiring). Replaces the old draw* text methods; keeps Wings via `openWingCraftDialog`.

All five files stay well under 500 code lines.

---

## Task 1: Pure view-model core (`forgeStations.ts`)

**Files:**
- Create: `src/core/forgeStations.ts`
- Test: `tests/forgeStations.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/forgeStations.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import {
  alchemyRecipeVMs,
  awakeningVMs,
  copyExchangeVMs,
  sparkVM,
  stationPreview,
  forgeGridLayout,
  type ForgeRecipeVM,
} from "../src/core/forgeStations.ts";
import { ALCHEMY_RECIPES, COPIES_PER_CRYSTAL } from "../src/data/alchemy.ts";
import { awakeningCost, MAX_AWAKENING } from "../src/core/awakening.ts";

describe("alchemyRecipeVMs", () => {
  test("gates craftability on owned inputs and carries qty/outputs", () => {
    const r0 = ALCHEMY_RECIPES[0];
    const inKey = Object.keys(r0.inputs)[0];
    const need = r0.inputs[inKey];
    const short = alchemyRecipeVMs({ [inKey]: need - 1 });
    expect(short[0].canCraft).toBe(false);
    const ok = alchemyRecipeVMs({ [inKey]: need });
    expect(ok[0].canCraft).toBe(true);
    expect(ok[0].inputs[0].qty).toBe(need);
    expect(ok[0].inputs[0].have).toBe(need);
    expect(ok[0].outputs.length).toBeGreaterThan(0);
  });
});

describe("awakeningVMs", () => {
  test("input cost comes from awakeningCost and gates on crystals", () => {
    const cost = awakeningCost(0);
    const [vm] = awakeningVMs([{ id: "t", name: "T", rank: 0, crystalsHave: cost }]);
    expect(vm.canCraft).toBe(true);
    expect(vm.inputs[0].qty).toBe(cost);
    const [poor] = awakeningVMs([{ id: "t", name: "T", rank: 0, crystalsHave: cost - 1 }]);
    expect(poor.canCraft).toBe(false);
  });
  test("max rank is not craftable and has no inputs", () => {
    const [vm] = awakeningVMs([{ id: "t", name: "T", rank: MAX_AWAKENING, crystalsHave: 999 }]);
    expect(vm.canCraft).toBe(false);
    expect(vm.inputs.length).toBe(0);
    expect(vm.note ?? "").toContain("Awakened");
  });
});

describe("copyExchangeVMs", () => {
  test("includes only towers at/above the copy threshold", () => {
    const vms = copyExchangeVMs([
      { id: "a", name: "A", copies: COPIES_PER_CRYSTAL },
      { id: "b", name: "B", copies: COPIES_PER_CRYSTAL - 1 },
    ]);
    expect(vms.length).toBe(1);
    expect(vms[0].id).toBe("a");
    expect(vms[0].inputs[0].qty).toBe(COPIES_PER_CRYSTAL);
    expect(vms[0].outputs[0].qty).toBe(1);
  });
});

describe("sparkVM", () => {
  test("gates on the pity count and reports the shortfall", () => {
    expect(sparkVM(200, 200, "u", "U").canCraft).toBe(true);
    const s = sparkVM(150, 200, "u", "U");
    expect(s.canCraft).toBe(false);
    expect(s.note ?? "").toContain("50");
  });
});

describe("stationPreview", () => {
  const mk = (emoji: string, craft: boolean): ForgeRecipeVM => ({
    id: emoji,
    label: emoji,
    inputs: [{ iconKey: "", emoji, color: 0, qty: 1 }],
    outputs: [{ iconKey: "", emoji: "o", color: 0, qty: 1 }],
    canCraft: craft,
  });
  test("prefers a craftable recipe, returns null for empty", () => {
    expect(stationPreview([mk("a", false), mk("b", true)])?.input.emoji).toBe("b");
    expect(stationPreview([])).toBeNull();
  });
});

describe("forgeGridLayout", () => {
  test("2 columns, in-bounds, rows stack down", () => {
    const rects = forgeGridLayout(5, 960, 80);
    expect(rects.length).toBe(5);
    expect(rects[1].x).toBeGreaterThan(rects[0].x);
    expect(rects[2].y).toBeGreaterThan(rects[0].y);
    for (const r of rects) {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.x + r.w).toBeLessThanOrEqual(960);
    }
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/forgeStations.test.ts`
Expected: FAIL — cannot resolve `../src/core/forgeStations.ts`.

- [ ] **Step 3: Write the pure module**

Create `src/core/forgeStations.ts`:

```ts
/**
 * forgeStations — pure (Phaser-free) view-models for the Forge's redesigned
 * station grid. Turns SaveManager/data primitives into icon descriptors so both
 * the station cards and the focused forge dialog render a visual INPUT → OUTPUT
 * instead of a text line + one button. No crafting logic lives here — only the
 * shape of what goes in and what comes out.
 */
import { ALCHEMY_RECIPES, COPIES_PER_CRYSTAL } from "../data/alchemy.ts";
import { AWAKENING_CRYSTAL, JEWEL_OF_CHAOS, MATERIALS_MAP } from "../data/materials.ts";
import { MAX_AWAKENING, awakeningCost } from "./awakening.ts";
import { materialIcon, towerIcon } from "../data/rewardIcon.ts";

/** One slot in a forge transformation (a material/tower/currency with a count). */
export interface ForgeIngredient {
  iconKey: string; // assetKeys texture; "" → use emoji
  emoji: string; // fallback glyph
  color: number; // tint (hex int)
  qty: number; // amount consumed/produced
  have?: number; // owned (inputs only) → drives short-of-target coloring
  label?: string; // short name under the tile
}

/** A single craftable transformation: its inputs, outputs and whether it's ready. */
export interface ForgeRecipeVM {
  id: string;
  label: string;
  inputs: ForgeIngredient[];
  outputs: ForgeIngredient[];
  canCraft: boolean;
  note?: string;
}

export type StationId = "awaken" | "alchemy" | "copies" | "wings" | "spark";

/** A station tile on the grid: emblem + readiness + its recipes + a mini preview. */
export interface StationVM {
  id: StationId;
  title: string;
  emoji: string;
  accent: number;
  ready: boolean;
  badge: string;
  recipes: ForgeRecipeVM[];
  preview: { input: ForgeIngredient; output: ForgeIngredient } | null;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const EMPTY: ForgeIngredient = { iconKey: "", emoji: "•", color: 0x6b7a8d, qty: 0 };

function matIngredient(id: string, qty: number, have?: number): ForgeIngredient {
  const ic = materialIcon(id);
  return {
    iconKey: ic.iconKey,
    emoji: ic.emoji,
    color: ic.color,
    qty,
    have,
    label: MATERIALS_MAP.get(id)?.name ?? id,
  };
}

function towerIngredient(id: string, name: string, qty = 1, have?: number): ForgeIngredient {
  const ic = towerIcon(id);
  return { iconKey: ic.iconKey, emoji: ic.emoji, color: ic.color, qty, have, label: name };
}

export function alchemyRecipeVMs(haves: Record<string, number>): ForgeRecipeVM[] {
  return ALCHEMY_RECIPES.map((r) => {
    const inputs = Object.entries(r.inputs).map(([m, n]) => matIngredient(m, n, haves[m] ?? 0));
    const outputs = Object.entries(r.outputs).map(([m, n]) => matIngredient(m, n));
    return {
      id: r.id,
      label: r.name,
      inputs,
      outputs,
      canCraft: inputs.every((i) => (i.have ?? 0) >= i.qty),
    };
  });
}

export interface AwakenTowerInput {
  id: string;
  name: string;
  rank: number;
  crystalsHave: number;
}

export function awakeningVMs(rows: AwakenTowerInput[]): ForgeRecipeVM[] {
  return rows.map((t) => {
    const max = t.rank >= MAX_AWAKENING;
    const cost = awakeningCost(t.rank);
    return {
      id: t.id,
      label: t.name,
      inputs: max ? [] : [matIngredient(AWAKENING_CRYSTAL, cost, t.crystalsHave)],
      outputs: [towerIngredient(t.id, t.name)],
      canCraft: !max && t.crystalsHave >= cost,
      note: max
        ? "Fully Awakened (+30% atk/hp)"
        : `✦${t.rank} → ✦${t.rank + 1}   ·   +10% atk/hp`,
    };
  });
}

export interface CopyTowerInput {
  id: string;
  name: string;
  copies: number;
}

export function copyExchangeVMs(rows: CopyTowerInput[]): ForgeRecipeVM[] {
  return rows
    .filter((t) => t.copies >= COPIES_PER_CRYSTAL)
    .sort((a, b) => b.copies - a.copies)
    .map((t) => ({
      id: t.id,
      label: t.name,
      inputs: [{ ...towerIngredient(t.id, t.name, COPIES_PER_CRYSTAL, t.copies), label: `${t.name} copies` }],
      outputs: [matIngredient(AWAKENING_CRYSTAL, 1)],
      canCraft: true,
      note: `You have ${t.copies} banked copies`,
    }));
}

export function sparkVM(
  sparks: number,
  pity: number,
  featuredId: string,
  featuredName: string,
): ForgeRecipeVM {
  const can = sparks >= pity;
  return {
    id: "spark",
    label: "Spark Guarantee",
    inputs: [{ iconKey: "", emoji: "✦", color: 0xffe07a, qty: pity, have: sparks, label: "Sparks" }],
    outputs: [{ ...towerIngredient(featuredId, featuredName), label: featuredName }],
    canCraft: can,
    note: can ? "Claim a guaranteed featured Unique!" : `${pity - sparks} more sparks needed`,
  };
}

export function wingsStationVM(jewels: number, feathers: number, gearCount: number): StationVM {
  const ready = jewels >= 1 && feathers >= 1 && gearCount >= 5;
  return {
    id: "wings",
    title: "Craft Wings",
    emoji: "🪽",
    accent: 0x9a59d6,
    recipes: [],
    ready,
    badge: ready ? "Ready" : "Gather mats",
    preview: {
      input: { ...matIngredient(JEWEL_OF_CHAOS, 1, jewels) },
      output: { iconKey: "", emoji: "🪽", color: 0xe9b8ff, qty: 1, label: "Wings" },
    },
  };
}

/** The lead input + lead output of the most-actionable recipe, for the card preview. */
export function stationPreview(
  recipes: ForgeRecipeVM[],
): { input: ForgeIngredient; output: ForgeIngredient } | null {
  if (recipes.length === 0) return null;
  const r = recipes.find((x) => x.canCraft) ?? recipes[0];
  return { input: r.inputs[0] ?? EMPTY, output: r.outputs[0] ?? EMPTY };
}

/** Assemble a recipe-backed station (everything except Wings). */
export function stationFromRecipes(
  id: StationId,
  title: string,
  emoji: string,
  accent: number,
  recipes: ForgeRecipeVM[],
): StationVM {
  const readyCount = recipes.filter((r) => r.canCraft).length;
  return {
    id,
    title,
    emoji,
    accent,
    recipes,
    ready: readyCount > 0,
    badge:
      recipes.length === 0
        ? "—"
        : readyCount === 0
          ? "Locked"
          : readyCount > 1
            ? `${readyCount} ready`
            : "Ready",
    preview: stationPreview(recipes),
  };
}

/** A 2-column card grid in scene space (mirrors the home nav layout's feel). */
export function forgeGridLayout(count: number, width: number, top: number): Rect[] {
  const cols = 2;
  const pad = 24;
  const gap = 16;
  const cardW = (width - pad * 2 - gap) / cols;
  const cardH = 96;
  const rects: Rect[] = [];
  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    rects.push({
      x: pad + col * (cardW + gap),
      y: top + row * (cardH + gap),
      w: cardW,
      h: cardH,
    });
  }
  return rects;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/forgeStations.test.ts`
Expected: PASS (all tests green).

- [ ] **Step 5: Commit**

```bash
git add src/core/forgeStations.ts tests/forgeStations.test.ts
git commit -m "feat(forge): pure station/recipe view-models + grid layout

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Station card presenter (`forgeStationCard.ts`)

**Files:**
- Create: `src/scenes/forgeStationCard.ts`

No unit test — Phaser presenter, smoke-covered by the live playtest in Task 5.

- [ ] **Step 1: Write the presenter**

Create `src/scenes/forgeStationCard.ts`:

```ts
/**
 * forgeStationCard — renders one Forge station as a tappable card: accent panel
 * (hot when ready), emblem + title + readiness badge, and a mini INPUT → OUTPUT
 * strip built from the pure StationVM preview (real icons via makeFitIcon, emoji
 * fallback). The whole card has the standard button-feel and opens the station.
 */
import type Phaser from "phaser";
import { crispText } from "./ui.ts";
import { accentPanel, interactive } from "./uiKit.ts";
import { makeFitIcon } from "./itemIcon.ts";
import type { ForgeIngredient, Rect, StationVM } from "../core/forgeStations.ts";

function miniIcon(
  scene: Phaser.Scene,
  x: number,
  y: number,
  ing: ForgeIngredient,
): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  c.add(makeFitIcon(scene, 0, 0, ing.iconKey, 26, ing.emoji));
  if (ing.qty > 1) {
    c.add(
      crispText(scene, 13, 9, `×${ing.qty}`, {
        fontSize: "10px",
        color: "#ffe9a8",
        fontStyle: "bold",
        stroke: "#10131c",
        strokeThickness: 3,
      }).setOrigin(0.5),
    );
  }
  return c;
}

/** Build a centered, interactive station card at `rect`; `onOpen` fires on tap. */
export function buildStationCard(
  scene: Phaser.Scene,
  rect: Rect,
  vm: StationVM,
  onOpen: (vm: StationVM) => void,
): Phaser.GameObjects.Container {
  const w = rect.w;
  const h = rect.h;
  const c = scene.add.container(rect.x + w / 2, rect.y + h / 2);

  c.add(accentPanel(scene, -w / 2, -h / 2, w, h, vm.accent, vm.ready));
  c.add(crispText(scene, -w / 2 + 14, -h / 2 + 10, vm.emoji, { fontSize: "26px" }).setOrigin(0, 0));
  c.add(
    crispText(scene, -w / 2 + 52, -h / 2 + 14, vm.title, {
      fontSize: "15px",
      color: "#ffe9b0",
      fontStyle: "bold",
    }).setOrigin(0, 0),
  );
  c.add(
    crispText(scene, w / 2 - 12, -h / 2 + 16, vm.badge, {
      fontSize: "11px",
      color: vm.ready ? "#a5f0b0" : "#8090a4",
      fontStyle: "bold",
    }).setOrigin(1, 0),
  );

  if (vm.preview) {
    const py = h / 2 - 22;
    c.add(miniIcon(scene, -w / 2 + 56, py, vm.preview.input));
    c.add(
      crispText(scene, -w / 2 + 92, py, "➜", { fontSize: "16px", color: "#cdd6e6" }).setOrigin(0.5),
    );
    c.add(miniIcon(scene, -w / 2 + 128, py, vm.preview.output));
    c.add(
      crispText(scene, w / 2 - 12, h / 2 - 14, "Tap to forge", {
        fontSize: "10px",
        color: "#7f93a8",
      }).setOrigin(1, 0.5),
    );
  }

  c.setSize(w, h).setInteractive({ useHandCursor: true });
  interactive(scene, c, () => onOpen(vm), { hoverScale: 1.03, pressScale: 0.98 });
  return c;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors from `forgeStationCard.ts` (the file is unused until Task 4, so an "unused" lint may appear — ignore until wired).

- [ ] **Step 3: Commit**

```bash
git add src/scenes/forgeStationCard.ts
git commit -m "feat(forge): station card presenter with input→output preview

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Forge recipe dialog presenter (`forgeRecipeDialog.ts`)

**Files:**
- Create: `src/scenes/forgeRecipeDialog.ts`

- [ ] **Step 1: Write the presenter**

Create `src/scenes/forgeRecipeDialog.ts`:

```ts
/**
 * forgeRecipeDialog — the focused "forge machine" modal for a station. Lays the
 * transformation out visually: a recipe selector (when a station has >1 option),
 * then INPUT slots → a forge arrow → OUTPUT slots, a note, and a Forge button
 * that lives inside the visual (not a bare text row). Generic over every
 * recipe-backed station (Awakening / Alchemy / Copy Exchange / Spark); Craft
 * Wings keeps its own drag machine. Returns { refresh, close } so the scene can
 * re-render in place after a successful craft.
 */
import type Phaser from "phaser";
import { crispText } from "./ui.ts";
import { COLORS, dimBackdrop, closeModal, interactive } from "./uiKit.ts";
import { makeFitIcon } from "./itemIcon.ts";
import type { ForgeIngredient, ForgeRecipeVM, StationVM } from "../core/forgeStations.ts";

export interface ForgeDialogHandle {
  refresh(station: StationVM): void;
  close(): void;
}

export interface ForgeDialogOpts {
  station: StationVM;
  confirm(recipeId: string): void;
  onClose(): void;
  /** Optional secondary action (Spark's "Cycle Wishlist"). */
  secondary?: { label: string; run(): void };
}

const PANEL_W = 600;
const PANEL_H = 340;
const MAX_CHIPS = 8; // cap selector chips; surplus surfaced via a "+N more" note

function hex(int: number): string {
  return "#" + int.toString(16).padStart(6, "0");
}

function slot(
  scene: Phaser.Scene,
  x: number,
  y: number,
  ing: ForgeIngredient,
  showHave: boolean,
): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  g.fillStyle(0x121a28, 0.96).fillRoundedRect(-26, -26, 52, 52, 8);
  g.lineStyle(2, ing.color || 0x3a567f, 1).strokeRoundedRect(-26, -26, 52, 52, 8);
  c.add(g);
  c.add(makeFitIcon(scene, 0, -4, ing.iconKey, 38, ing.emoji));
  if (ing.qty > 0) {
    c.add(
      crispText(scene, 20, 16, `×${ing.qty}`, {
        fontSize: "12px",
        color: "#ffe9a8",
        fontStyle: "bold",
        stroke: "#10131c",
        strokeThickness: 3,
      }).setOrigin(0.5),
    );
  }
  if (ing.label) {
    c.add(
      crispText(scene, 0, 36, ing.label, { fontSize: "10px", color: "#aab8cc" }).setOrigin(0.5, 0),
    );
  }
  if (showHave && ing.have !== undefined) {
    const short = ing.have < ing.qty;
    c.add(
      crispText(scene, 0, 50, `have ${ing.have}`, {
        fontSize: "10px",
        color: short ? COLORS.bad : COLORS.good,
        fontStyle: "bold",
      }).setOrigin(0.5, 0),
    );
  }
  return c;
}

export function openForgeDialog(scene: Phaser.Scene, opts: ForgeDialogOpts): ForgeDialogHandle {
  const W = scene.scale.width;
  const H = scene.scale.height;
  const px = (W - PANEL_W) / 2;
  const py = (H - PANEL_H) / 2;

  const c = scene.add.container(0, 0).setDepth(320);
  let closing = false;
  const close = (): void => {
    if (closing) return;
    closing = true;
    closeModal(scene, c, opts.onClose);
  };
  dimBackdrop(scene, c, () => close());

  // Static panel shell (persists across refreshes).
  const shell = scene.add.graphics();
  shell.fillStyle(0x10131c, 0.99).fillRoundedRect(px, py, PANEL_W, PANEL_H, 14);
  shell.lineStyle(2, 0x3a567f, 1).strokeRoundedRect(px, py, PANEL_W, PANEL_H, 14);
  const shellZone = scene.add.zone(px + PANEL_W / 2, py + PANEL_H / 2, PANEL_W, PANEL_H).setInteractive();
  c.add([shell, shellZone]);

  const content = scene.add.container(0, 0);
  c.add(content);

  let station = opts.station;
  let sel = 0;

  function render(): void {
    content.removeAll(true);
    const recipes = station.recipes;
    const recipe: ForgeRecipeVM | undefined = recipes[sel];

    // Header.
    content.add(
      crispText(scene, px + 18, py + 14, `${station.emoji}  ${station.title}`, {
        fontSize: "18px",
        color: hex(station.accent),
        fontStyle: "bold",
      }).setOrigin(0, 0),
    );
    if (opts.secondary) {
      const s = crispText(scene, px + PANEL_W - 18, py + 16, opts.secondary.label, {
        fontSize: "12px",
        color: "#fff",
        backgroundColor: "#3a567f",
        fontStyle: "bold",
      })
        .setOrigin(1, 0)
        .setPadding(10, 5, 10, 5)
        .setInteractive({ useHandCursor: true });
      s.on("pointerup", () => opts.secondary?.run());
      content.add(s);
    }

    // Recipe selector chips (only when there's a choice).
    let laneTop = py + 56;
    if (recipes.length > 1) {
      const shown = recipes.slice(0, MAX_CHIPS);
      let cx = px + 18;
      let cy = py + 52;
      shown.forEach((r, i) => {
        const label = r.label.length > 16 ? r.label.slice(0, 15) + "…" : r.label;
        const chip = crispText(scene, cx, cy, `${r.canCraft ? "●" : "○"} ${label}`, {
          fontSize: "12px",
          color: i === sel ? "#10131c" : r.canCraft ? "#dfe7f2" : "#8090a4",
          backgroundColor: i === sel ? "#ffd56a" : "#1b2436",
          fontStyle: "bold",
        })
          .setPadding(8, 4, 8, 4)
          .setInteractive({ useHandCursor: true });
        chip.on("pointerup", () => {
          sel = i;
          render();
        });
        content.add(chip);
        cx += chip.width + 8;
        if (cx > px + PANEL_W - 120) {
          cx = px + 18;
          cy += 28;
        }
      });
      if (recipes.length > MAX_CHIPS) {
        content.add(
          crispText(scene, px + 18, cy + 26, `+${recipes.length - MAX_CHIPS} more`, {
            fontSize: "10px",
            color: "#7f93a8",
          }),
        );
      }
      laneTop = cy + 40;
    }

    // Transformation lane: INPUTS  ➜⚒➜  OUTPUTS.
    const laneY = Math.max(laneTop, py + 150);
    const inputs = recipe?.inputs ?? [];
    const outputs = recipe?.outputs ?? [];
    const inStartX = px + 70;
    const outStartX = px + PANEL_W - 70 - (outputs.length - 1) * 70;
    inputs.forEach((ing, i) => content.add(slot(scene, inStartX + i * 70, laneY, ing, true)));
    outputs.forEach((ing, i) => content.add(slot(scene, outStartX + i * 70, laneY, ing, false)));
    content.add(
      crispText(scene, px + PANEL_W / 2, laneY - 6, "⚒", {
        fontSize: "30px",
        color: "#ffd56a",
      }).setOrigin(0.5),
    );
    content.add(
      crispText(scene, px + PANEL_W / 2, laneY + 20, "➜", {
        fontSize: "20px",
        color: "#cdd6e6",
      }).setOrigin(0.5),
    );

    // Note.
    if (recipe?.note) {
      content.add(
        crispText(scene, px + PANEL_W / 2, laneY + 56, recipe.note, {
          fontSize: "12px",
          color: "#cdd6e6",
        }).setOrigin(0.5, 0),
      );
    }

    // Forge button (inside the visual).
    const can = recipe?.canCraft ?? false;
    const btn = crispText(scene, px + PANEL_W / 2, py + PANEL_H - 26, can ? "⚒  Forge" : "Cannot forge", {
      fontSize: "16px",
      color: can ? "#fff" : "#8a7a9a",
      backgroundColor: can ? hex(station.accent) : "#262c3a",
      fontStyle: "bold",
      fixedWidth: 200,
      align: "center",
    })
      .setOrigin(0.5)
      .setPadding(0, 10, 0, 10)
      .setInteractive({ useHandCursor: true });
    interactive(scene, btn, () => {
      if (recipe && recipe.canCraft) opts.confirm(recipe.id);
    });
    content.add(btn);

    // Close.
    const x = crispText(scene, px + PANEL_W - 16, py + PANEL_H - 26, "Close", {
      fontSize: "13px",
      color: "#9fb0c4",
    })
      .setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true });
    x.on("pointerup", () => close());
    content.add(x);
  }

  render();
  return {
    refresh(next: StationVM): void {
      station = next;
      sel = Math.min(sel, Math.max(0, next.recipes.length - 1));
      render();
    },
    close,
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no type errors in `forgeRecipeDialog.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/scenes/forgeRecipeDialog.ts
git commit -m "feat(forge): focused input→output forge dialog (selector + lane + button)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Rewrite `ForgeScene` as the grid orchestrator

**Files:**
- Modify (rewrite): `src/scenes/ForgeScene.ts`

- [ ] **Step 1: Replace the scene body**

Replace the entire contents of `src/scenes/ForgeScene.ts` with:

```ts
/**
 * ForgeScene — the crafting hub, redesigned as a station grid. A resource bar
 * (crystals / sparks / jewels / feathers) sits over a 2-column grid of station
 * cards (Awakening · Alchemy · Copy Exchange · Craft Wings · Spark Guarantee).
 * Each card shows a mini input→output preview; tapping opens a focused forge
 * dialog that lays the transformation out visually with the action inside it.
 * Craft Wings keeps its bespoke drag machine. All crafting logic is reused —
 * this scene only gathers primitives, builds pure StationVMs and wires taps.
 */
import Phaser from "phaser";
import { fadeIn, fadeToScene } from "./uiKit.ts";
import { crispText } from "./ui.ts";
import { makeFitIcon } from "./itemIcon.ts";
import { buildStationCard } from "./forgeStationCard.ts";
import { openForgeDialog, type ForgeDialogHandle } from "./forgeRecipeDialog.ts";
import { staggerIn } from "./uiKit.ts";
import type { SaveManager } from "../core/saveManager.ts";
import { TOWERS } from "../data/towers.ts";
import { AWAKENING_CRYSTAL, JEWEL_OF_CHAOS, FEATHER } from "../data/materials.ts";
import { materialTex } from "../data/assetKeys.ts";
import { ALCHEMY_RECIPES } from "../data/alchemy.ts";
import { featuredForWeek, SPARK_PITY } from "../core/banner.ts";
import { isoWeekKey } from "../core/meta.ts";
import { openWingCraftDialog, type WingCraftItem } from "./wingCraftDialog.ts";
import { ITEM_CATALOG_MAP } from "../data/items.ts";
import { wingSuccessChance, wingOutcomeOdds, MIN_ITEMS } from "../core/wingCraft.ts";
import {
  alchemyRecipeVMs,
  awakeningVMs,
  copyExchangeVMs,
  sparkVM,
  stationFromRecipes,
  wingsStationVM,
  forgeGridLayout,
  type StationVM,
  type AwakenTowerInput,
  type CopyTowerInput,
} from "../core/forgeStations.ts";
import type { Rarity } from "../data/schema.ts";

const W = 960;
const NAME = new Map(TOWERS.map((t) => [t.id, t.name]));
const UNIQUES = TOWERS.filter((t) => t.rarity === "Unique");

export class ForgeScene extends Phaser.Scene {
  private mgr!: SaveManager;
  private grid!: Phaser.GameObjects.Container;
  private bar!: Phaser.GameObjects.Container;
  private toast!: Phaser.GameObjects.Text;
  private dialog: ForgeDialogHandle | null = null;

  constructor() {
    super("ForgeScene");
  }

  create(): void {
    fadeIn(this);
    this.dialog = null;
    this.mgr = this.registry.get("saveManager");
    this.mgr.ensureBanner(isoWeekKey(new Date()));

    crispText(this, W / 2, 10, "⚒ Forge", { fontSize: "24px", color: "#ffd700", fontStyle: "bold" })
      .setOrigin(0.5, 0)
      .setDepth(50);
    crispText(this, 20, 12, "← Back", { fontSize: "15px", color: "#90caf9" })
      .setDepth(50)
      .setInteractive({ useHandCursor: true })
      .on("pointerup", () => fadeToScene(this, "MainMenuScene"));

    this.bar = this.add.container(0, 0);
    this.grid = this.add.container(0, 0);
    this.toast = crispText(this, W / 2, 512, "", {
      fontSize: "13px",
      color: "#ffe1a8",
      backgroundColor: "#2a1f14",
    })
      .setOrigin(0.5)
      .setPadding(10, 5, 10, 5)
      .setDepth(60)
      .setVisible(false);

    this.rebuild();
  }

  // ---- data gathering --------------------------------------------------------
  private awakenRows(): AwakenTowerInput[] {
    const save = this.mgr.getSave();
    const crystals = this.mgr.getMaterial(AWAKENING_CRYSTAL);
    return Object.keys(save.collection)
      .filter((id) => (save.collection[id]?.stars ?? 0) >= 5)
      .map((id) => ({
        id,
        name: NAME.get(id) ?? id,
        rank: this.mgr.awakeningRank(id),
        crystalsHave: crystals,
      }));
  }

  private copyRows(): CopyTowerInput[] {
    const save = this.mgr.getSave();
    return Object.keys(save.collection).map((id) => ({
      id,
      name: NAME.get(id) ?? id,
      copies: save.collection[id]?.copies ?? 0,
    }));
  }

  private alchemyHaves(): Record<string, number> {
    const ids = new Set<string>();
    for (const r of ALCHEMY_RECIPES) {
      Object.keys(r.inputs).forEach((m) => ids.add(m));
      Object.keys(r.outputs).forEach((m) => ids.add(m));
    }
    const haves: Record<string, number> = {};
    ids.forEach((m) => (haves[m] = this.mgr.getMaterial(m)));
    return haves;
  }

  private unequippedGearCount(): number {
    const save = this.mgr.getSave();
    const equipped = new Set(Object.values(save.inventory.equipped).filter(Boolean) as string[]);
    return save.inventory.items.filter((it) => !equipped.has(it.id)).length;
  }

  private stations(): StationVM[] {
    const feat = featuredForWeek(isoWeekKey(new Date()));
    return [
      stationFromRecipes("awaken", "Awakening", "✦", 0x8a5cc0, awakeningVMs(this.awakenRows())),
      stationFromRecipes("alchemy", "Alchemy", "⚗", 0x3a6a9a, alchemyRecipeVMs(this.alchemyHaves())),
      stationFromRecipes("copies", "Copy Exchange", "♻", 0x4a8a6a, copyExchangeVMs(this.copyRows())),
      wingsStationVM(
        this.mgr.getMaterial(JEWEL_OF_CHAOS),
        this.mgr.getMaterial(FEATHER),
        this.unequippedGearCount(),
      ),
      stationFromRecipes("spark", "Spark Guarantee", "★", 0xffc94d, [
        sparkVM(this.mgr.sparks(), SPARK_PITY, feat.unique, NAME.get(feat.unique) ?? "—"),
      ]),
    ];
  }

  // ---- rendering -------------------------------------------------------------
  private rebuild(): void {
    this.drawBar();
    const stations = this.stations();
    const rects = forgeGridLayout(stations.length, W, 78);
    this.grid.removeAll(true);
    const cards = stations.map((vm, i) =>
      buildStationCard(this, rects[i], vm, (s) => this.openStation(s)),
    );
    this.grid.add(cards);
    staggerIn(this, cards);
  }

  private drawBar(): void {
    this.bar.removeAll(true);
    const chips: [string, string, number | string][] = [
      ["✦", `material__${AWAKENING_CRYSTAL}`, this.mgr.getMaterial(AWAKENING_CRYSTAL)],
      ["✧", "", `${this.mgr.sparks()}/${SPARK_PITY}`],
      ["💠", `material__${JEWEL_OF_CHAOS}`, this.mgr.getMaterial(JEWEL_OF_CHAOS)],
      ["🪶", `material__${FEATHER}`, this.mgr.getMaterial(FEATHER)],
    ];
    const gap = 224;
    chips.forEach(([emoji, key, val], i) => {
      const x = 40 + i * gap;
      this.bar.add(makeFitIcon(this, x, 52, key, 22, emoji));
      this.bar.add(
        crispText(this, x + 18, 52, `${val}`, {
          fontSize: "14px",
          color: "#ffe07a",
          fontStyle: "bold",
        }).setOrigin(0, 0.5),
      );
    });
  }

  // ---- station interaction ---------------------------------------------------
  private openStation(vm: StationVM): void {
    if (vm.id === "wings") {
      this.openWingCraft();
      return;
    }
    const secondary =
      vm.id === "spark" && UNIQUES.length > 1
        ? { label: "Cycle Wishlist", run: () => this.cycleWishlist() }
        : undefined;
    this.dialog = openForgeDialog(this, {
      station: vm,
      secondary,
      confirm: (recipeId) => this.craft(vm.id, recipeId),
      onClose: () => {
        this.dialog = null;
      },
    });
  }

  private craft(stationId: StationVM["id"], recipeId: string): void {
    let msg = "";
    if (stationId === "awaken") {
      const r = this.mgr.awaken(recipeId);
      if (r >= 0) msg = `${NAME.get(recipeId) ?? recipeId} → Awakening ${r}!`;
    } else if (stationId === "alchemy") {
      if (this.mgr.craftAlchemy(recipeId, 1) > 0) msg = "Transmuted!";
    } else if (stationId === "copies") {
      if (this.mgr.exchangeCopies(recipeId, 1) > 0) msg = "Minted an Awakening Crystal!";
    } else if (stationId === "spark") {
      const id = this.mgr.claimSpark();
      if (id) msg = `✦ Guaranteed: ${NAME.get(id) ?? id}!`;
    }
    if (!msg) {
      this.showToast("Cannot forge — check materials.");
      return;
    }
    this.showToast(msg);
    this.rebuild();
    // Re-derive the same station so the open dialog reflects the new state.
    const fresh = this.stations().find((s) => s.id === stationId);
    if (this.dialog && fresh && fresh.recipes.length > 0) this.dialog.refresh(fresh);
    else this.dialog?.close();
  }

  private cycleWishlist(): void {
    const wish = this.mgr.getSave().meta.banner.pickedFeaturedId;
    const idx = UNIQUES.findIndex((t) => t.id === wish);
    const next = UNIQUES[(idx + 1) % UNIQUES.length];
    this.mgr.setWishlist(next.id);
    this.showToast(`Wishlist → ${next.name}`);
  }

  private openWingCraft(): void {
    const save = this.mgr.getSave();
    const equipped = new Set(Object.values(save.inventory.equipped).filter(Boolean) as string[]);
    const items: WingCraftItem[] = save.inventory.items
      .filter((it) => !equipped.has(it.id))
      .map((it) => {
        const def = ITEM_CATALOG_MAP.get(it.defId);
        return {
          id: it.id,
          defId: it.defId,
          name: def?.name ?? it.defId,
          rarity: (def?.rarity ?? "Common") as Rarity,
        };
      });
    const raritiesOf = (ids: string[]): Rarity[] =>
      ids.map((id) => items.find((i) => i.id === id)?.rarity).filter((r): r is Rarity => !!r);
    const dialog = openWingCraftDialog(this, {
      items,
      jewelsOwned: this.mgr.getMaterial(JEWEL_OF_CHAOS),
      feathersOwned: this.mgr.getMaterial(FEATHER),
      preview: (selectedIds, j) => {
        const rs = raritiesOf(selectedIds);
        return {
          success: rs.length >= MIN_ITEMS ? wingSuccessChance(rs, j) : 0,
          odds: wingOutcomeOdds(rs.length ? rs : (["Common"] as Rarity[])),
        };
      },
      confirm: (selectedIds, j) => {
        const r = this.mgr.craftWings(selectedIds, j);
        if (!r.ok) {
          this.showToast("Craft failed — check materials.");
          return;
        }
        if (r.success && r.item) {
          this.showToast(`✦ Forged ${ITEM_CATALOG_MAP.get(r.item.defId)?.name ?? "Wings"}!`);
        } else {
          this.showToast("The wings dissolved into chaos…");
        }
        dialog.destroy();
        this.rebuild();
      },
      onClose: () => dialog.destroy(),
    });
  }

  private showToast(msg: string): void {
    this.toast.setText(msg).setVisible(true);
    this.time.delayedCall(1800, () => this.toast.setVisible(false));
  }
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no type errors; ESLint 0 errors (pre-existing `any` warnings only). If
`makeFitIcon`'s `material__<id>` key is wrong, fix by importing `materialTex` from
`../data/assetKeys.ts` and using `materialTex(AWAKENING_CRYSTAL)` etc. in `drawBar`.

- [ ] **Step 3: Commit**

```bash
git add src/scenes/ForgeScene.ts
git commit -m "feat(forge): station-grid ForgeScene (resource bar + cards + dialogs)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Verify whole + live playtest + memory

**Files:**
- Modify: `memory/project_*.md` (+ `memory/MEMORY.md` index)

- [ ] **Step 1: Full test suite + lint + build**

Run: `npx vitest run && npm run lint && npm run build`
Expected: all tests pass (incl. new `forgeStations.test.ts`), 0 lint errors, build succeeds.

- [ ] **Step 2: Live CDP playtest the Forge**

Start dev server + headless Chrome, then open the Forge and exercise it:

```bash
npm run dev >/tmp/forge_vite.log 2>&1 &
# launch headless chrome on :9222 (project's usual playtest setup)
```

Write `/tmp/cap_forge.mjs` (model it on `/tmp/cap_maps.mjs`): wait for the menu via
`window.__game`, then `g.scene.start("ForgeScene")`, screenshot
`/tmp/forge_grid.png`. Then drive a dialog open via a tap on a card's center
(or call the scene method through `__game.scene.getScene("ForgeScene")`), screenshot
`/tmp/forge_dialog.png`. Collect `Runtime.exceptionThrown` — expect **none**.

Verify visually: a resource bar, a 2-column grid of 5 station cards each with an
emblem + input→output mini preview + readiness badge, and (on tap) a dialog showing
INPUT slots → ⚒ → OUTPUT slots + a Forge button.

- [ ] **Step 3: Sanity-craft an alchemy recipe (state changes)**

In the playtest, grant materials and confirm a craft mutates counts:

```js
const bs = window.__game.scene.getScene("ForgeScene");
const mgr = window.__game.registry.get("saveManager");
// give enough of recipe 0's first input, then craft via the scene
```

Confirm `getMaterial` for the output increases and the grid badge/preview refresh.

- [ ] **Step 4: Kill servers + record memory**

Stop the vite + chrome background processes. Write a memory file
`memory/project_forge_station_grid.md` (type: project) capturing: Forge is now a
station grid (pure `core/forgeStations.ts` VMs + `forgeStationCard`/`forgeRecipeDialog`
presenters), every station shows visual input→output, Wings keeps its drag machine,
no mechanic/art changes. Add a one-line pointer in `memory/MEMORY.md`. Link
`[[project_smelt_reforge_chaos]]`, `[[project_craft_wings]]`,
`[[project_addictive_features]]`.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "docs(memory): record Forge station-grid redesign

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review Notes

- **Spec coverage:** grid home (Task 4), per-station input→output card preview (Task 2),
  focused input→output dialog with the action inside (Task 3), all 5 stations incl.
  Wings reuse (Task 4 `openStation`/`openWingCraft`), no mechanic/art change (logic
  reused verbatim), pure/presenter split + <500 lines (Tasks 1–4), resource bar
  (Task 4 `drawBar`). Covered.
- **Types:** `StationVM`/`ForgeRecipeVM`/`ForgeIngredient`/`Rect`/`AwakenTowerInput`/
  `CopyTowerInput`/`StationId` defined in Task 1 and used consistently in Tasks 2–4.
  `ForgeDialogHandle`/`ForgeDialogOpts` defined + used in Tasks 3–4.
- **Placeholder note:** the scene's `material__<id>` bar keys have a documented
  fallback to `materialTex(...)` if the inline key form is ever wrong.
```
