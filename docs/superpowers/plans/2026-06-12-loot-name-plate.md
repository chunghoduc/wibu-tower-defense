# Loot / Reward Tile Name-Plate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make item/material/reward names always render fully inside a dedicated "name plate" band of the tile background, never spilling off, via one shared component used by every loot/reward tile.

**Architecture:** A pure Phaser-free fit planner (`labelFit.ts`, tested) computes font size + wrapped lines + ellipsis for a name in a bounded band. A thin presenter (`namePlate.ts`) draws the plate band graphics and places the text using that plan. Each loot/reward tile call site swaps its ad-hoc background+text for an icon region plus one `addNamePlate(...)` call, keeping tile width fixed and updating grid math where height grows.

**Tech Stack:** TypeScript, Phaser 3, Vitest. Pure-helper + thin-presenter pattern (matches `heroStatRows.ts`/`heroStatsPanel.ts`, `auraIndicator.ts`).

Spec: `docs/superpowers/specs/2026-06-12-loot-name-plate-design.md`

---

## File Structure

- Create `src/scenes/labelFit.ts` — pure fit planner (`fitLabel`, types). Phaser-free.
- Create `tests/labelFit.test.ts` — Vitest unit tests for the planner.
- Create `src/scenes/namePlate.ts` — presenter: draws plate band + places fitted text. Uses a cached canvas `measure`.
- Modify `src/scenes/ui.ts` — export a shared `UI_FONT_FAMILY` constant so the presenter's `measure` font matches `crispText`.
- Modify `src/scenes/boxOpenOverlay.ts` — tile reserves a plate band; use `addNamePlate`.
- Modify `src/scenes/spinReel.ts` — prize label via `addNamePlate`.
- Modify `src/scenes/jewelOverlay.ts` — jewel name via `addNamePlate`.
- Modify `src/scenes/ExpeditionScene.ts` — character name via `addNamePlate`.
- Modify `src/scenes/summonResultOverlay.ts` — character name via `addNamePlate`.
- Modify `src/scenes/rewardPanel.ts` — rarity-word label adopts plate styling.

---

## Task 1: Pure fit planner `labelFit.ts`

**Files:**

- Create: `src/scenes/labelFit.ts`
- Test: `tests/labelFit.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/labelFit.test.ts
import { describe, it, expect } from "vitest";
import { fitLabel, type Measure } from "../src/scenes/labelFit.ts";

// Synthetic monospace measure: each char is 0.6*fontPx wide. Deterministic.
const mono: Measure = (text, px) => text.length * px * 0.6;

describe("fitLabel", () => {
  it("keeps base font on one line for a short name", () => {
    const p = fitLabel("Iron Sword", { maxWidth: 80, maxLines: 2, basePx: 12, minPx: 8 }, mono);
    expect(p.fontPx).toBe(12);
    expect(p.lines).toEqual(["Iron Sword"]);
    expect(p.truncated).toBe(false);
  });

  it("wraps to two lines when a name is too wide for one", () => {
    // "Legendary Boss Chest" = 20 chars; at 10px*0.6=6 => 120px on one line > 78.
    const p = fitLabel(
      "Legendary Boss Chest",
      { maxWidth: 78, maxLines: 2, basePx: 10, minPx: 7 },
      mono,
    );
    expect(p.lines.length).toBe(2);
    expect(p.truncated).toBe(false);
    for (const ln of p.lines) expect(mono(ln, p.fontPx)).toBeLessThanOrEqual(78);
  });

  it("shrinks the font before wrapping/ellipsis when that lets it fit one line", () => {
    // 12 chars; base 12 => 12*12*0.6=86.4 > 60; at 8 => 12*8*0.6=57.6 <= 60.
    const p = fitLabel("Thunderbolts", { maxWidth: 60, maxLines: 1, basePx: 12, minPx: 8 }, mono);
    expect(p.fontPx).toBe(8);
    expect(p.lines).toEqual(["Thunderbolts"]);
    expect(p.truncated).toBe(false);
  });

  it("ellipsis-truncates and never exceeds bounds when nothing fits", () => {
    const p = fitLabel(
      "Supercalifragilistic Doom Blade of Eternal Night",
      { maxWidth: 50, maxLines: 2, basePx: 10, minPx: 7 },
      mono,
    );
    expect(p.truncated).toBe(true);
    expect(p.lines.length).toBeLessThanOrEqual(2);
    for (const ln of p.lines) expect(mono(ln, p.fontPx)).toBeLessThanOrEqual(50);
    expect(p.lines[p.lines.length - 1].endsWith("…")).toBe(true);
  });

  it("hard-breaks a single word wider than maxWidth", () => {
    const p = fitLabel(
      "Aaaaaaaaaaaaaaaaaaaa",
      { maxWidth: 30, maxLines: 2, basePx: 8, minPx: 8 },
      mono,
    );
    for (const ln of p.lines) expect(mono(ln, p.fontPx)).toBeLessThanOrEqual(30);
  });

  it("handles empty string", () => {
    const p = fitLabel("", { maxWidth: 50, maxLines: 2, basePx: 10, minPx: 7 }, mono);
    expect(p.lines).toEqual([""]);
    expect(p.truncated).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/labelFit.test.ts`
Expected: FAIL — cannot resolve `../src/scenes/labelFit.ts`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/scenes/labelFit.ts
//
// Pure, Phaser-free text-fit planner for tile "name plates". Given a name and a
// bounded band (maxWidth x maxLines), it picks the largest font in [minPx,basePx]
// whose greedy word-wrap fits; failing that it wraps at minPx and ellipsis-
// truncates the last kept line so the text NEVER exceeds the band. Width is
// resolved through an injected `measure` so this stays pure and unit-testable.

export interface FitOpts {
  maxWidth: number;
  maxLines: number;
  basePx: number;
  minPx: number;
}
export interface FitPlan {
  fontPx: number;
  lines: string[];
  truncated: boolean;
}
export type Measure = (text: string, fontPx: number) => number;

const ELLIPSIS = "…";

/** Greedy word-wrap; words wider than maxWidth are hard-broken at the char level. */
function wrap(text: string, maxWidth: number, px: number, measure: Measure): string[] {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let line = "";
  const pushWord = (w: string) => {
    // Hard-break a single oversized word.
    if (measure(w, px) > maxWidth) {
      if (line) {
        lines.push(line);
        line = "";
      }
      let chunk = "";
      for (const ch of w) {
        if (chunk && measure(chunk + ch, px) > maxWidth) {
          lines.push(chunk);
          chunk = ch;
        } else chunk += ch;
      }
      line = chunk;
      return;
    }
    const next = line ? line + " " + w : w;
    if (measure(next, px) > maxWidth) {
      if (line) lines.push(line);
      line = w;
    } else line = next;
  };
  for (const w of words) pushWord(w);
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

/** Trim a line until it (plus an ellipsis) fits maxWidth. */
function ellipsize(line: string, maxWidth: number, px: number, measure: Measure): string {
  let s = line.trimEnd();
  while (s.length > 0 && measure(s + ELLIPSIS, px) > maxWidth) s = s.slice(0, -1).trimEnd();
  return s + ELLIPSIS;
}

export function fitLabel(text: string, opts: FitOpts, measure: Measure): FitPlan {
  const { maxWidth, maxLines, basePx, minPx } = opts;
  if (text.trim().length === 0) return { fontPx: basePx, lines: [""], truncated: false };

  for (let px = basePx; px >= minPx; px--) {
    const lines = wrap(text, maxWidth, px, measure);
    const fits = lines.length <= maxLines && lines.every((ln) => measure(ln, px) <= maxWidth);
    if (fits) return { fontPx: px, lines, truncated: false };
  }

  // Nothing fits: wrap at the floor, keep maxLines, ellipsize the last kept line.
  const wrapped = wrap(text, maxWidth, minPx, measure);
  const kept = wrapped.slice(0, maxLines);
  if (wrapped.length > maxLines || measure(kept[kept.length - 1], minPx) > maxWidth) {
    kept[kept.length - 1] = ellipsize(kept[kept.length - 1], maxWidth, minPx, measure);
  }
  return { fontPx: minPx, lines: kept, truncated: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/labelFit.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/scenes/labelFit.ts tests/labelFit.test.ts
git commit -m "feat(loot-ui): pure fit planner for tile name plates (TDD)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Shared font-family constant in `ui.ts`

**Files:**

- Modify: `src/scenes/ui.ts:23-27`

- [ ] **Step 1: Export the font family used by `crispText`**

Replace the `DEFAULT_STYLE` block so the family is a named export the presenter's
canvas `measure` can reuse (identical metrics to Phaser's text):

```ts
/** The single UI font stack. Shared so canvas-measured layout (name plates)
 *  matches what crispText actually rasterises. */
export const UI_FONT_FAMILY = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';

const DEFAULT_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: UI_FONT_FAMILY,
  stroke: "#0a0d14",
  strokeThickness: 3,
};
```

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (no errors).

- [ ] **Step 3: Commit**

```bash
git add src/scenes/ui.ts
git commit -m "refactor(ui): export UI_FONT_FAMILY for shared text measurement

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Presenter `namePlate.ts`

**Files:**

- Create: `src/scenes/namePlate.ts`
- Test: `tests/namePlate.test.ts`

- [ ] **Step 1: Write the failing test (pure geometry helper)**

The presenter is mostly Phaser drawing, but the vertical line layout is pure and
testable. Expose `plateLineLayout` and test it.

```ts
// tests/namePlate.test.ts
import { describe, it, expect } from "vitest";
import { plateLineLayout } from "../src/scenes/namePlate.ts";

describe("plateLineLayout", () => {
  it("centers a single line in the band", () => {
    // band from topY=10 height=24 => center 22; one line => baseline at center.
    const ys = plateLineLayout(10, 24, 1, 12);
    expect(ys).toHaveLength(1);
    expect(ys[0]).toBeCloseTo(22, 5);
  });

  it("stacks two lines symmetrically around the band center", () => {
    const ys = plateLineLayout(10, 28, 2, 10);
    expect(ys).toHaveLength(2);
    const center = 10 + 28 / 2;
    expect(ys[0] + ys[1]).toBeCloseTo(center * 2, 5); // symmetric
    expect(ys[1]).toBeGreaterThan(ys[0]);
  });

  it("keeps all baselines inside the band", () => {
    const topY = 0,
      h = 26,
      n = 2,
      px = 11;
    const ys = plateLineLayout(topY, h, n, px);
    for (const y of ys) {
      expect(y - px / 2).toBeGreaterThanOrEqual(topY - 1);
      expect(y + px / 2).toBeLessThanOrEqual(topY + h + 1);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/namePlate.test.ts`
Expected: FAIL — cannot resolve `plateLineLayout`.

- [ ] **Step 3: Write the presenter**

```ts
// src/scenes/namePlate.ts
//
// Draws a tile "name plate": a darker rounded band at the bottom of a loot/reward
// tile holding the item/material name, auto-fitted (shrink-then-ellipsis) so the
// text is ALWAYS contained. One component for every loot tile, so the overflow
// bug cannot recur per call site. Geometry (line baselines) is a pure export;
// width measurement uses a cached canvas context matching the UI font.

import Phaser from "phaser";
import { crispText, UI_FONT_FAMILY } from "./ui.ts";
import { fitLabel, type Measure } from "./labelFit.ts";

export interface PlateOpts {
  width: number; // tile width
  topY: number; // y of the plate band's top edge (local to the tile container)
  height: number; // band height
  radius: number; // bottom-corner radius (matches the tile)
  accent: number; // rarity / reward color for the top divider
  color: string; // text color
  basePx?: number;
  minPx?: number;
  maxLines?: number;
  pad?: number; // horizontal inset for text width
}

/** Pure: y-baseline for each of `n` lines, vertically centered in the band. */
export function plateLineLayout(topY: number, height: number, n: number, fontPx: number): number[] {
  const lineH = fontPx * 1.18;
  const blockH = n * lineH;
  const top = topY + (height - blockH) / 2 + lineH / 2;
  return Array.from({ length: n }, (_, i) => top + i * lineH);
}

let measureCtx: CanvasRenderingContext2D | null = null;
function canvasMeasure(): Measure {
  if (!measureCtx) measureCtx = document.createElement("canvas").getContext("2d");
  return (text, px) => {
    if (!measureCtx) return text.length * px * 0.6; // headless fallback
    measureCtx.font = `bold ${px}px ${UI_FONT_FAMILY}`;
    return measureCtx.measureText(text).width;
  };
}

/** Draw the plate band + the fitted name into `container`. */
export function addNamePlate(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  text: string,
  opts: PlateOpts,
): void {
  const { width, topY, height, radius, accent, color } = opts;
  const basePx = opts.basePx ?? 10,
    minPx = opts.minPx ?? 7;
  const maxLines = opts.maxLines ?? 2,
    pad = opts.pad ?? 6;

  // Band fill with only the bottom corners rounded, plus a thin accent divider.
  const g = scene.add.graphics();
  g.fillStyle(0x0b1119, 1);
  g.fillRoundedRect(-width / 2, topY, width, height, { tl: 0, tr: 0, bl: radius, br: radius });
  g.lineStyle(1, accent, 0.5).beginPath();
  g.moveTo(-width / 2 + 1, topY + 0.5);
  g.lineTo(width / 2 - 1, topY + 0.5);
  g.strokePath();
  container.add(g);

  const plan = fitLabel(
    text,
    { maxWidth: width - pad * 2, maxLines, basePx, minPx },
    canvasMeasure(),
  );
  const ys = plateLineLayout(topY, height, plan.lines.length, plan.fontPx);
  plan.lines.forEach((line, i) => {
    container.add(
      crispText(scene, 0, ys[i], line, {
        fontSize: `${plan.fontPx}px`,
        color,
        fontStyle: "bold",
        align: "center",
      }).setOrigin(0.5),
    );
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/namePlate.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/scenes/namePlate.ts tests/namePlate.test.ts
git commit -m "feat(loot-ui): name-plate presenter (band + auto-fit text)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Wire `boxOpenOverlay.ts` (the worst offender)

**Files:**

- Modify: `src/scenes/boxOpenOverlay.ts:108-138`

- [ ] **Step 1: Replace the tile body in `reveal`**

Import the presenter and rebuild the per-entry tile so the name lives in a
reserved plate band. Tile height grows `72 → 84`; icon region is the top, plate
the bottom `28px`.

Add to imports (top of file):

```ts
import { addNamePlate } from "./namePlate.ts";
```

Replace the `reveal` tile metrics + per-entry body (lines ~112-133):

```ts
const entries = boxRewardEntries(reward);
const tw = 86,
  th = 84,
  plateH = 28,
  gap = 10;
const top = -th / 2; // tile spans top..top+th
const totalW = entries.length * tw + (entries.length - 1) * gap;
const startX = cx - totalW / 2 + tw / 2;
const ty = cy + 110;

entries.forEach((e, i) => {
  const tile = s.add
    .container(startX + i * (tw + gap), ty)
    .setAlpha(0)
    .setScale(0.7);
  const col = Phaser.Display.Color.HexStringToColor(e.color).color;
  const g = s.add.graphics();
  g.fillStyle(0x121a28, 1).fillRoundedRect(-tw / 2, top, tw, th, 8);
  g.lineStyle(2, col, 1).strokeRoundedRect(-tw / 2, top, tw, th, 8);
  tile.add(g);

  // Icon sits in the region above the plate band.
  const iconCY = top + (th - plateH) / 2;
  const fallback = e.kind === "gold" ? "🪙" : e.kind === "item" ? "📦" : "💠";
  tile.add(makeFitIcon(s, 0, iconCY, e.iconKey ?? "", 50, fallback));

  const label =
    e.kind === "gold" || e.kind === "diamond"
      ? `+${e.count}`
      : e.count > 1
        ? `${e.name} ×${e.count}`
        : e.name;
  addNamePlate(s, tile, label, {
    width: tw,
    topY: top + th - plateH,
    height: plateH,
    radius: 8,
    accent: col,
    color: e.color,
    basePx: 10,
    minPx: 7,
    maxLines: 2,
  });

  this.root!.add(tile);
  s.tweens.add({
    targets: tile,
    alpha: 1,
    scale: 1,
    duration: 280,
    delay: i * 110,
    ease: "Back.easeOut",
  });
});
```

- [ ] **Step 2: Verify typecheck + tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/scenes/boxOpenOverlay.ts
git commit -m "fix(loot-ui): box-reward names contained in a reserved name plate

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Wire `spinReel.ts`

**Files:**

- Modify: `src/scenes/spinReel.ts:28-49`

- [ ] **Step 1: Replace the label in `buildCell`**

Add import:

```ts
import { addNamePlate } from "./namePlate.ts";
```

Replace the background + label tail of `buildCell` (the `crispText(... prize.label ...)` block) with a reserved plate. Cell stays `132×104`; plate is the bottom `30px`:

```ts
const g = scene.add.graphics();
g.fillStyle(0x10151f, 1).fillRoundedRect(-CELL_W / 2, -52, CELL_W, 104, 12);
g.lineStyle(2, accent, prize.rare ? 1 : 0.6).strokeRoundedRect(-CELL_W / 2, -52, CELL_W, 104, 12);
cell.add(g);
cell.add(makeFitIcon(scene, 0, -22, view.iconKey, 56, view.emoji));
addNamePlate(scene, cell, prize.label, {
  width: CELL_W,
  topY: 52 - 30,
  height: 30,
  radius: 12,
  accent,
  color: "#ffe9b0",
  basePx: 12,
  minPx: 8,
  maxLines: 2,
});
strip.add(cell);
return cell;
```

(Note: icon nudged up `-14 → -22` so it stays centered in the region above the plate.)

- [ ] **Step 2: Verify typecheck + tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/scenes/spinReel.ts
git commit -m "fix(loot-ui): lucky-spin prize labels use the shared name plate

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Wire `jewelOverlay.ts`

**Files:**

- Modify: `src/scenes/jewelOverlay.ts:115-141`

- [ ] **Step 1: Replace the name `Text` in `jewelTile`**

Add import at top:

```ts
import { addNamePlate } from "./namePlate.ts";
```

The tile uses a `Rectangle` (not graphics) for its background + hover. Grow it to
`88×84` and add a plate band container for the name. Replace the name-`Text` line
(`this.scene.add.text(0, 20, name, ...)`) and bump the rectangle/icon:

```ts
const cell = this.scene.add
  .rectangle(0, 0, 88, 84, 0x1d2330, 1)
  .setStrokeStyle(2, tint, 0.9)
  .setInteractive({ useHandCursor: true });
cell.on("pointerover", () => cell.setFillStyle(0x2a3346));
cell.on("pointerout", () => cell.setFillStyle(0x1d2330));
cell.on("pointerdown", onPick);
c.add(cell);

c.add(makeFitIcon(this.scene, 0, -18, jewelIconKey(defId), 46, "💠"));
addNamePlate(this.scene, c, name, {
  width: 88,
  topY: 42 - 28,
  height: 28,
  radius: 3,
  accent: tint,
  color: "#e6e9ef",
  basePx: 10,
  minPx: 7,
  maxLines: 2,
});
```

Also move the `✕` affordance up to clear the larger tile: change `(36, -34)` to `(36, -38)`.

- [ ] **Step 2: Verify typecheck + tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/scenes/jewelOverlay.ts
git commit -m "fix(loot-ui): jewel-picker names use the shared name plate

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Wire `ExpeditionScene.ts` and `summonResultOverlay.ts`

**Files:**

- Modify: `src/scenes/ExpeditionScene.ts:112-132`
- Modify: `src/scenes/summonResultOverlay.ts` (character-name label)

- [ ] **Step 1: Read both tile builders first**

Run: `sed -n '108,135p' src/scenes/ExpeditionScene.ts` and the name-label region of `summonResultOverlay.ts` to capture exact tile dims (`w`,`h`) and the name-`Text` line before editing.

- [ ] **Step 2: ExpeditionScene — replace the name `Text` with a plate**

Add `import { addNamePlate } from "./namePlate.ts";`. Replace the
`crispText/add.text(... t.name ..., { ... wordWrap ... })` at `y=h/2-16` with a
bottom plate band of height `24`:

```ts
addNamePlate(scene, c, t.name, {
  width: w,
  topY: h / 2 - 24,
  height: 24,
  radius: 6,
  accent: tint,
  color: hex(tint),
  basePx: 9,
  minPx: 7,
  maxLines: 2,
});
```

Use the same `tint`/color expression the file already computes for the tile
stroke (read in Step 1; reuse its existing rarity color variable rather than
introducing a new one).

- [ ] **Step 3: summonResultOverlay — replace the character-name `Text` with a plate**

Mirror Step 2 using that file's card width and rarity color, plate height `24`
anchored at the card's bottom. Keep the same text the card showed.

- [ ] **Step 4: Verify typecheck + tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/scenes/ExpeditionScene.ts src/scenes/summonResultOverlay.ts
git commit -m "fix(loot-ui): expedition + summon card names use the shared name plate

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: Align `rewardPanel.ts` styling

**Files:**

- Modify: `src/scenes/rewardPanel.ts:171-199`

- [ ] **Step 1: Adopt plate styling for the rarity-word label**

The post-battle loot panel intentionally shows the rarity word (not the full
name; names live in hover). Keep that, but render it through the shared plate so
it matches the rest. Tile is `56×56` inside `ROW_H=78` rows — draw the plate band
_below_ the tile box (in the existing label gap), not inside it.

Add `import { addNamePlate } from "./namePlate.ts";`. Replace the
`crispText(... spec.label ...)` line in `buildTile` with:

```ts
addNamePlate(scene, c, spec.label, {
  width: TILE + 4,
  topY: TILE / 2 - 2,
  height: 18,
  radius: 4,
  accent: spec.color,
  color: hex(spec.color),
  basePx: 10,
  minPx: 7,
  maxLines: 1,
});
```

(Single line — rarity words are short; the plate just standardises the look and
guarantees containment.)

- [ ] **Step 2: Verify typecheck + tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/scenes/rewardPanel.ts
git commit -m "style(loot-ui): post-battle reward labels match the name-plate look

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 9: Whole-system verify + playtest

**Files:** none (verification only)

- [ ] **Step 1: Full typecheck + tests + build**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: all PASS.

- [ ] **Step 2: Confirm no source file exceeds 500 lines**

Run: `wc -l src/scenes/namePlate.ts src/scenes/labelFit.ts src/scenes/boxOpenOverlay.ts src/scenes/spinReel.ts src/scenes/jewelOverlay.ts src/scenes/rewardPanel.ts src/scenes/ExpeditionScene.ts src/scenes/summonResultOverlay.ts`
Expected: every count < 500. If any exceeds, split before continuing.

- [ ] **Step 3: CDP self-playtest (montage)**

Drive the game via `window.__game` (per the playtest memory): open a boss chest,
trigger a lucky spin, open the jewel picker; screenshot each. Build an after
montage and send to chat with `[[send: /tmp/nameplate_after.png]]`.
Expected: every name sits fully inside its plate band; long names ellipsize, none
spill off the tile.

- [ ] **Step 4: Final state — clean tree**

Run: `git status`
Expected: clean (all changes committed across Tasks 1-8).

```

```
