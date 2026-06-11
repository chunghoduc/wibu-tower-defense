# Hero Total-Stats Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the hero's fully-resolved total stats in a panel beneath the equipment paper-doll on the Inventory (HeroScene) screen, updating live as gear is equipped.

**Architecture:** A new presentation module `src/scenes/heroStatsPanel.ts` exposes a pure, tested `heroStatRows(stats)` (stat selection + formatting) and a `renderHeroStats(...)` presenter that resolves totals via the existing `resolveHeroBattleStats`. `HeroScene` shrinks the doll panel to free left-column room, draws the stat-panel frame, and re-renders the stats into a dedicated container inside its existing `refresh()` so totals stay live.

**Tech Stack:** TypeScript, Phaser 3.80, Vitest.

---

### Task 1: Pure `heroStatRows` formatter (TDD)

**Files:**
- Create: `src/scenes/heroStatsPanel.ts`
- Test: `tests/heroStatsPanel.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/heroStatsPanel.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { heroStatRows } from "../src/scenes/heroStatsPanel.ts";
import { makeStats } from "../src/data/schema.ts";

describe("heroStatRows", () => {
  it("returns the 12 hero stats in display order with correct labels", () => {
    const rows = heroStatRows(makeStats({}));
    expect(rows.map((r) => r.label)).toEqual([
      "ATK", "Atk Spd", "Range", "Crit", "Crit Dmg", "HP",
      "HP Regen", "Armor", "M.Resist", "Skill Pwr", "Omnivamp", "Move Spd",
    ]);
  });

  it("formats scalar, percent and multiplier stats correctly", () => {
    const rows = heroStatRows(makeStats({
      atk: 142.7, attackSpeed: 1.14, range: 130.6, critRate: 0.25,
      critDamage: 1.5, maxHp: 812.3, hpRegen: 8.2, armor: 30.6,
      magicResist: 12, skillPower: 1.5, omnivamp: 0.08, moveSpeed: 160.4,
    }));
    const by = (l: string) => rows.find((r) => r.label === l)!.value;
    expect(by("ATK")).toBe("143");
    expect(by("Atk Spd")).toBe("1.1");
    expect(by("Range")).toBe("131");
    expect(by("Crit")).toBe("25%");
    expect(by("Crit Dmg")).toBe("1.5×");
    expect(by("HP")).toBe("812");
    expect(by("HP Regen")).toBe("8.2");
    expect(by("Skill Pwr")).toBe("1.5×");
    expect(by("Omnivamp")).toBe("8%");
    expect(by("Move Spd")).toBe("160");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/heroStatsPanel.test.ts`
Expected: FAIL — cannot resolve `heroStatRows` from `../src/scenes/heroStatsPanel.ts`.

- [ ] **Step 3: Write minimal implementation**

Create `src/scenes/heroStatsPanel.ts`:

```typescript
/**
 * heroStatsPanel — renders the hero's fully-resolved total stats beneath the
 * equipment paper-doll on the Inventory screen. `heroStatRows` is the pure,
 * tested selection+formatting core; `renderHeroStats` is the Phaser presenter.
 */
import type { Stats } from "../data/schema.ts";

const n0 = (v: number) => `${Math.round(v)}`;
const n1 = (v: number) => v.toFixed(1);
const pct = (v: number) => `${Math.round(v * 100)}%`;
const mult = (v: number) => `${v.toFixed(1)}×`;

// The hero stats worth surfacing, in display order, with a formatter.
const HERO_STAT_ROWS: [keyof Stats, string, (v: number) => string][] = [
  ["atk", "ATK", n0], ["attackSpeed", "Atk Spd", n1], ["range", "Range", n0],
  ["critRate", "Crit", pct], ["critDamage", "Crit Dmg", mult], ["maxHp", "HP", n0],
  ["hpRegen", "HP Regen", n1], ["armor", "Armor", n0], ["magicResist", "M.Resist", n0],
  ["skillPower", "Skill Pwr", mult], ["omnivamp", "Omnivamp", pct], ["moveSpeed", "Move Spd", n0],
];

/** Selected hero stats as display-ready { label, value } rows. Pure. */
export function heroStatRows(stats: Stats): { label: string; value: string }[] {
  return HERO_STAT_ROWS.map(([k, label, fmt]) => ({ label, value: fmt(stats[k] ?? 0) }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/heroStatsPanel.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/scenes/heroStatsPanel.ts tests/heroStatsPanel.test.ts
git commit -m "feat: heroStatRows pure stat formatter for inventory panel

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: `renderHeroStats` presenter

**Files:**
- Modify: `src/scenes/heroStatsPanel.ts`

- [ ] **Step 1: Add the presenter**

Append to `src/scenes/heroStatsPanel.ts` (and add imports at the top):

```typescript
import Phaser from "phaser";
import { crispText } from "./ui.ts";
import type { HeroSave } from "../core/save.ts";
import { resolveHeroBattleStats } from "../core/heroStats.ts";
import { defaultHeroStats } from "../data/stage.ts";
```

```typescript
export interface PanelBox { x: number; y: number; w: number; h: number }

/**
 * Render the hero's resolved total stats into `container` within `box`.
 * The caller owns `container`'s lifecycle (clear-and-rebuild on refresh); this
 * only appends the header + a 2-column stat grid (frame is drawn by the caller).
 */
export function renderHeroStats(
  scene: Phaser.Scene, container: Phaser.GameObjects.Container, box: PanelBox, save: HeroSave,
): void {
  const stats = resolveHeroBattleStats(save, defaultHeroStats()).stats;
  const rows = heroStatRows(stats);

  const px = box.x + 10, py = box.y + 8;
  container.add(crispText(scene, px, py, "Total Stats",
    { fontSize: "11px", color: "#ffd86a", fontStyle: "bold" }));

  const gridTop = py + 18;
  const colW = (box.w - 20) / 2;
  const perCol = Math.ceil(rows.length / 2);
  rows.forEach(({ label, value }, i) => {
    const col = Math.floor(i / perCol), row = i % perCol;
    const cx = px + col * colW, cy = gridTop + row * 16;
    container.add(crispText(scene, cx, cy, label, { fontSize: "9px", color: "#8fa0b4" }));
    container.add(crispText(scene, cx + colW - 12, cy, value,
      { fontSize: "9px", color: "#e8eef6", fontStyle: "bold" }).setOrigin(1, 0));
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors from `heroStatsPanel.ts`.

- [ ] **Step 3: Re-run the unit test (still green)**

Run: `npx vitest run tests/heroStatsPanel.test.ts`
Expected: PASS (2 tests) — presenter addition doesn't break the pure tests.

- [ ] **Step 4: Commit**

```bash
git add src/scenes/heroStatsPanel.ts
git commit -m "feat: renderHeroStats presenter for total-stats panel

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Shrink the doll panel to free left-column room

**Files:**
- Modify: `src/data/heroDoll.ts:32`

- [ ] **Step 1: Reduce the panel height**

In `src/data/heroDoll.ts`, change `DOLL_PANEL`:

```typescript
/** Panel box (scene coordinates) the doll fills — left side of the loadout screen. */
export const DOLL_PANEL = { x: 26, y: 94, w: 300, h: 300 };
```

(Was `h: 418`. Slots are normalized so they reflow; the freed strip y398..534
hosts the stats panel.)

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/data/heroDoll.ts
git commit -m "refactor: shrink inventory doll panel to make room for stats

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Wire the stats panel into HeroScene

**Files:**
- Modify: `src/scenes/HeroScene.ts` (imports, a new `statsBox` field, `create()`, `refresh()`)

- [ ] **Step 1: Add the import**

Near the other scene imports in `src/scenes/HeroScene.ts` (e.g. after the
`heroDoll.ts` import on line 13), add:

```typescript
import { renderHeroStats } from "./heroStatsPanel.ts";
```

- [ ] **Step 2: Add the `statsBox` field**

Beside the other private container fields (near `slotZones`/`slotPos` around
line 42), add:

```typescript
  private statsBox!: Phaser.GameObjects.Container;
  private static readonly STATS_PANEL = { x: 26, y: 398, w: 300, h: 136 };
```

- [ ] **Step 3: Draw the frame + create the container in `create()`**

In `create()`, immediately after the inventory background drop-zone block (the
`invZone.setData("inv", true);` line, ~line 127) and before
`this.tiles = this.add.container(...)`, add:

```typescript
    // Hero total-stats panel — sits directly under the paper-doll (left column).
    const sp = HeroScene.STATS_PANEL;
    const spG = this.add.graphics();
    spG.fillStyle(0x0e1622, 0.92).fillRoundedRect(sp.x, sp.y, sp.w, sp.h, 10);
    spG.lineStyle(2, 0x2a3a56, 1).strokeRoundedRect(sp.x, sp.y, sp.w, sp.h, 10);
    this.statsBox = this.add.container(0, 0).setDepth(6);
```

- [ ] **Step 4: Re-render the stats in `refresh()`**

In `refresh()`, after `const save = this.mgr.getSave();` (line 206), add:

```typescript
    this.statsBox.removeAll(true);
    renderHeroStats(this, this.statsBox, HeroScene.STATS_PANEL, save);
```

- [ ] **Step 5: Typecheck + file-size guard**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `wc -l src/scenes/HeroScene.ts`
Expected: under 500 (was 478; ~+8 lines).

- [ ] **Step 6: Full test suite**

Run: `npx vitest run`
Expected: all tests pass (the new file's 2 tests included; no regressions).

- [ ] **Step 7: Build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 8: Commit**

```bash
git add src/scenes/HeroScene.ts
git commit -m "feat: show hero total stats under the inventory doll

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Visual verification (playtest)

**Files:** none (verification only)

- [ ] **Step 1: Launch + screenshot the Hero/Inventory scene**

Use the CDP playtest harness (`scripts/playtest/snap.sh` + `window.__game`,
`/?debug`) to navigate to `HeroScene` and capture a screenshot.

- [ ] **Step 2: Confirm**

Verify: the doll renders un-cramped at the new height; the "Total Stats" panel
sits directly beneath it inside the canvas (bottom y534 < 540); all 12 stat rows
are legible in 2 columns; equipping/unequipping an item updates the totals.

- [ ] **Step 3: Send the screenshot to the chat** via a `[[send: path]]` line.

---

## Self-Review

**Spec coverage:**
- Shrink doll panel (418→300) → Task 3. ✓
- New `heroStatsPanel.ts` with pure `heroStatRows` + `renderHeroStats` → Tasks 1–2. ✓
- Stat table (12 stats, labels, formatters) → Task 1 (matches spec table). ✓
- Resolve via `resolveHeroBattleStats(save, defaultHeroStats())` → Task 2. ✓
- New STATS panel box `{x:26,y:398,w:300,h:136}` → Task 4 Step 2. ✓
- Draw frame once + live re-render in `refresh()` → Task 4 Steps 3–4. ✓
- HeroScene stays < 500 lines → Task 4 Step 5. ✓
- TDD test file → Task 1. ✓

**Placeholder scan:** none — every code step shows full code.

**Type consistency:** `heroStatRows(stats: Stats)` and `renderHeroStats(scene, container, box, save)` signatures are consistent across Tasks 1, 2, 4. `STATS_PANEL` box reused by name in Task 4. `PanelBox` shape matches `{x,y,w,h}` used by the static `STATS_PANEL`.
