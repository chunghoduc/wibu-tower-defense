# Home Screen UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the throne-room home screen real visual hierarchy — a framed top resource bar (gold + diamonds), a prominent primary BATTLE call-to-action, and a tidier secondary nav grid — without touching the diorama, atmosphere, or art.

**Architecture:** Introduce one pure, Phaser-free layout module `src/scenes/homeLayout.ts` (geometry for the top bar + nav), unit-tested first. `MainMenuScene` becomes a thin presenter over it: `drawHeader`→`drawTopBar`, `drawMenu` gains a primary Battle button and renders the 11 secondary destinations through the existing `iconButton`. `menuLayout.ts`'s `dockLayout` is superseded by `homeNavLayout`; its test coverage is migrated.

**Tech Stack:** TypeScript, Phaser 3, Vitest. Pure geometry + thin Scene presenter (matches `menuLayout.ts` / `homeRoom.ts`). 960×540 canvas.

Spec: `docs/superpowers/specs/2026-06-13-home-screen-ux-redesign-design.md`

---

## File Structure

- **Create** `src/scenes/homeLayout.ts` — pure geometry: `homeTopBar(W,H)` (brand anchor + gold/diamond pills) and `homeNavLayout(secondaryCount,W,H)` (`{panel, primary, cells, rowDivider}`). Exports `Rect`, `Pill`, `TopBar`, `NavCell`, `NavLayout`.
- **Create** `tests/homeLayout.test.ts` — unit tests for both functions.
- **Modify** `src/scenes/MainMenuScene.ts` — split `MENU_ITEMS` into `PRIMARY`+`SECONDARY`; rewrite `drawHeader`→`drawTopBar`; rewrite `drawMenu` to draw the panel + primary Battle button + secondary grid; re-anchor the Set-Squad CTA. Keep under 500 code lines (extract `homeTopBarFx`/`primaryButton` helper into a sibling file if it approaches the limit).
- **Modify** `tests/menuLayout.test.ts` — migrate the grid invariants to `homeNavLayout`, OR delete once `homeLayout.test.ts` covers them. (`menuLayout.ts` may be deleted if nothing else imports `dockLayout`.)

---

## Task 1: Pure `homeTopBar` geometry (TDD)

**Files:**
- Create: `src/scenes/homeLayout.ts`
- Test: `tests/homeLayout.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { homeTopBar } from "../src/scenes/homeLayout.ts";

const W = 960, H = 540;

describe("homeTopBar", () => {
  it("places gold to the RIGHT of diamonds (gold outermost)", () => {
    const t = homeTopBar(W, H);
    expect(t.gold.x).toBeGreaterThan(t.diamonds.x);
  });
  it("keeps both pills inside the screen and in the top band", () => {
    const t = homeTopBar(W, H);
    for (const p of [t.gold, t.diamonds]) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x + p.w).toBeLessThanOrEqual(W);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y + p.h).toBeLessThanOrEqual(H * 0.18);
    }
  });
  it("pills do not overlap", () => {
    const t = homeTopBar(W, H);
    expect(t.diamonds.x + t.diamonds.w).toBeLessThanOrEqual(t.gold.x);
  });
  it("brand anchor sits in the top-left", () => {
    const t = homeTopBar(W, H);
    expect(t.brand.x).toBeLessThan(W * 0.4);
    expect(t.brand.y).toBeLessThan(H * 0.18);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/homeLayout.test.ts`
Expected: FAIL — `homeLayout.ts` does not exist / `homeTopBar is not a function`.

- [ ] **Step 3: Write minimal implementation**

Create `src/scenes/homeLayout.ts`:

```ts
/**
 * homeLayout — pure, Phaser-free geometry for the main-menu home screen:
 * a top resource bar (brand + gold/diamond pills) and the bottom navigation
 * (framed panel + primary BATTLE CTA + secondary destination grid).
 * Deterministic and unit-tested (tests/homeLayout.test.ts). MainMenuScene
 * is the presenter. See docs/superpowers/specs/2026-06-13-home-screen-ux-redesign-design.md.
 */
export interface Rect { x: number; y: number; w: number; h: number; }
export interface Pill extends Rect {}

export interface TopBar {
  brand: { x: number; y: number };
  gold: Pill;
  diamonds: Pill;
}

const PILL_H = 28;
const PILL_W = 116;       // reserved width; presenter may render content narrower
const TOP_MARGIN = 12;
const PILL_GAP = 10;

export function homeTopBar(W: number, _H: number): TopBar {
  const y = TOP_MARGIN;
  const gold: Pill = { x: W - TOP_MARGIN - PILL_W, y, w: PILL_W, h: PILL_H };
  const diamonds: Pill = { x: gold.x - PILL_GAP - PILL_W, y, w: PILL_W, h: PILL_H };
  const brand = { x: TOP_MARGIN, y: TOP_MARGIN };
  return { brand, gold, diamonds };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/homeLayout.test.ts`
Expected: PASS (4 passing).

- [ ] **Step 5: Commit**

```bash
git add src/scenes/homeLayout.ts tests/homeLayout.test.ts
git commit -m "feat(home): pure homeTopBar geometry — framed gold+diamond pills

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Pure `homeNavLayout` geometry (TDD)

**Files:**
- Modify: `src/scenes/homeLayout.ts`
- Test: `tests/homeLayout.test.ts`

- [ ] **Step 1: Write the failing test (append to the file)**

```ts
import { homeNavLayout } from "../src/scenes/homeLayout.ts";

describe("homeNavLayout", () => {
  const lay = () => homeNavLayout(11, W, H);

  it("produces exactly `secondaryCount` cells", () => {
    expect(lay().cells).toHaveLength(11);
  });
  it("primary CTA sits above every secondary cell and inside the panel", () => {
    const l = lay();
    expect(l.primary.x).toBeGreaterThanOrEqual(l.panel.x);
    expect(l.primary.x + l.primary.w).toBeLessThanOrEqual(l.panel.x + l.panel.w);
    for (const c of l.cells) expect(c.y).toBeGreaterThan(l.primary.y);
  });
  it("every cell sits inside the dock panel", () => {
    const l = lay();
    for (const c of l.cells) {
      expect(c.x).toBeGreaterThanOrEqual(l.panel.x);
      expect(c.x).toBeLessThanOrEqual(l.panel.x + l.panel.w);
      expect(c.y).toBeGreaterThanOrEqual(l.panel.y);
      expect(c.y).toBeLessThanOrEqual(l.panel.y + l.panel.h);
    }
  });
  it("rows are monotonic: row 2 below row 1, x ascends within a row", () => {
    const l = lay();
    const r0 = l.cells.slice(0, 6);
    const r1 = l.cells.slice(6);
    expect(new Set(r0.map((c) => c.y)).size).toBe(1);
    expect(r1[0].y).toBeGreaterThan(r0[0].y);
    const xs = r0.map((c) => c.x);
    for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeGreaterThan(xs[i - 1]);
  });
  it("the grid is horizontally centred on the screen", () => {
    const l = lay();
    const xs = l.cells.map((c) => c.x);
    const mid = (Math.min(...xs) + Math.max(...xs)) / 2;
    expect(Math.abs(mid - W / 2)).toBeLessThan(2);
  });
  it("the whole dock stays in the lower half of the screen", () => {
    const l = lay();
    expect(l.panel.y).toBeGreaterThan(H * 0.5);
    expect(l.panel.y + l.panel.h).toBeLessThanOrEqual(H);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/homeLayout.test.ts`
Expected: FAIL — `homeNavLayout is not a function`.

- [ ] **Step 3: Write minimal implementation (append to `homeLayout.ts`)**

```ts
export interface NavCell { x: number; y: number; w: number; h: number; }
export interface NavLayout {
  panel: Rect;
  primary: Rect;
  cells: NavCell[];
  rowDivider?: number;
}

const COLS = 6;
const MARGIN = 14;
const CELL_W = 140;
const CELL_H = 50;
const ROW_GAP = 12;
const PRIMARY_H = 46;
const PRIMARY_GAP = 12;

export function homeNavLayout(secondaryCount: number, W: number, H: number): NavLayout {
  const rows = Math.max(1, Math.ceil(secondaryCount / COLS));
  const cols = Math.min(COLS, secondaryCount);
  const gridW = cols * CELL_W;
  const gridH = rows * CELL_H + (rows - 1) * ROW_GAP;
  const innerW = gridW;
  const panelH = PRIMARY_H + PRIMARY_GAP + gridH + MARGIN * 2;
  const panel: Rect = {
    x: Math.round(W / 2 - innerW / 2 - MARGIN),
    y: Math.round(H - panelH - 8),
    w: innerW + MARGIN * 2,
    h: panelH,
  };
  const primary: Rect = {
    x: panel.x + MARGIN,
    y: panel.y + MARGIN,
    w: panel.w - MARGIN * 2,
    h: PRIMARY_H,
  };
  const x0 = W / 2 - gridW / 2 + CELL_W / 2;
  const y0 = primary.y + PRIMARY_H + PRIMARY_GAP + CELL_H / 2;
  const cells: NavCell[] = [];
  for (let i = 0; i < secondaryCount; i++) {
    const r = Math.floor(i / COLS);
    const c = i % COLS;
    const inRow = Math.min(COLS, secondaryCount - r * COLS);
    const rowOffset = ((COLS - inRow) * CELL_W) / 2;
    cells.push({
      x: Math.round(x0 + c * CELL_W + rowOffset),
      y: Math.round(y0 + r * (CELL_H + ROW_GAP)),
      w: CELL_W,
      h: CELL_H,
    });
  }
  const rowDivider = rows > 1 ? Math.round(y0 + CELL_H / 2 + ROW_GAP / 2) : undefined;
  return { panel, primary, cells, rowDivider };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/homeLayout.test.ts`
Expected: PASS (all `homeTopBar` + `homeNavLayout` tests green).

- [ ] **Step 5: Commit**

```bash
git add src/scenes/homeLayout.ts tests/homeLayout.test.ts
git commit -m "feat(home): pure homeNavLayout — primary CTA + secondary grid geometry

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Wire the top resource bar into MainMenuScene

**Files:**
- Modify: `src/scenes/MainMenuScene.ts`

- [ ] **Step 1: Add the import**

Add to the imports block:
```ts
import { homeTopBar, homeNavLayout } from "./homeLayout.ts";
```
(Remove the `dockLayout` import from `./menuLayout.ts`.)

- [ ] **Step 2: Replace `drawHeader` with `drawTopBar`**

Replace the whole `drawHeader(...)` method body with a top-bar renderer. It keeps the daily-login grant + bonus toast and the logo/wordmark, but as a compact top-left brand and two framed right-side pills:

```ts
// ── top resource bar (brand + framed gold/diamond pills) ────────────────────
private drawTopBar(mgr: SaveManager, save: ReturnType<SaveManager["getSave"]>, W: number, H: number): void {
  const today = new Date().toISOString().slice(0, 10);
  const granted = mgr.grantDailyLogin(today);
  const bar = homeTopBar(W, H);

  // Compact brand crest at top-left (falls back to a small wordmark).
  if (this.textures.exists("ui__logo")) {
    const logo = this.add.image(bar.brand.x, bar.brand.y, "ui__logo").setOrigin(0, 0).setDepth(5);
    logo.setScale(40 / logo.height);
  } else {
    crispText(this, bar.brand.x, bar.brand.y, "WIBU TD", {
      fontSize: "18px", color: "#ffe9a8", fontStyle: "bold", stroke: "#2a1c05", strokeThickness: 4,
    }).setOrigin(0, 0).setDepth(5);
  }

  this.drawPill(bar.diamonds, "💎", `${save.currency.diamonds}`, "#bfe0ff");
  this.drawPill(bar.gold, "🪙", `${save.currency.gold}`, "#ffe6a8");

  if (granted > 0) {
    const bonus = crispText(this, bar.gold.x + bar.gold.w / 2, bar.gold.y + bar.gold.h + 6,
      `+${granted} daily bonus!`, { fontSize: "13px", color: "#a5f0b0" })
      .setOrigin(0.5, 0).setDepth(6);
    this.tweens.add({ targets: bonus, y: bonus.y - 8, alpha: 0, delay: 1400, duration: 900,
      onComplete: () => bonus.destroy() });
  }
}

/** A framed resource pill: dark translucent plate + gold stroke + icon + value. */
private drawPill(p: { x: number; y: number; w: number; h: number }, icon: string, value: string, color: string): void {
  this.add.graphics().setDepth(5)
    .fillStyle(0x0c1120, 0.82).fillRoundedRect(p.x, p.y, p.w, p.h, p.h / 2)
    .lineStyle(1.5, 0xc9a85a, 0.9).strokeRoundedRect(p.x, p.y, p.w, p.h, p.h / 2);
  crispText(this, p.x + 14, p.y + p.h / 2, icon, { fontSize: "15px" }).setOrigin(0.5).setDepth(6);
  crispText(this, p.x + 28, p.y + p.h / 2, value, {
    fontSize: "15px", color, fontStyle: "bold", stroke: "#0a1420", strokeThickness: 3,
  }).setOrigin(0, 0.5).setDepth(6);
}
```

- [ ] **Step 3: Update the `create()` call site**

In `create()`, change `this.drawHeader(mgr, save, W);` to:
```ts
this.drawTopBar(mgr, save, W, H);
```

- [ ] **Step 4: Typecheck + tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS (no type errors; suite green). Remove any now-unused vars flagged by tsc (e.g. old `titleY`/`crystals`).

- [ ] **Step 5: Commit**

```bash
git add src/scenes/MainMenuScene.ts
git commit -m "feat(home): framed top resource bar (gold + diamonds) replaces colliding title

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Primary BATTLE CTA + secondary nav grid

**Files:**
- Modify: `src/scenes/MainMenuScene.ts`

- [ ] **Step 1: Split MENU_ITEMS into primary + secondary**

Replace the `MENU_ITEMS` constant with:
```ts
const PRIMARY_ITEM: MenuItem = { key: "battle", label: "BATTLE", scene: "StageSelectScene" };

// Secondary destinations (11) — row 1 core loop, row 2 meta.
const SECONDARY_ITEMS: MenuItem[] = [
  { key: "summon", label: "Summon", scene: "GachaScene" },
  { key: "squad", label: "Squad", scene: "SquadScene" },
  { key: "inventory", label: "Inventory", scene: "HeroScene" },
  { key: "forge", label: "Forge", scene: "ForgeScene" },
  { key: "shop", label: "Shop", scene: "ShopScene" },
  { key: "quests", label: "Quests", scene: "QuestScene" },
  { key: "activities", label: "Activities", scene: "ActivitiesScene" },
  { key: "skills", label: "Skills", scene: "SkillsScene" },
  { key: "passive", label: "Passives", scene: "PassiveGridScene" },
  { key: "collection", label: "Codex", scene: "CollectionScene" },
  { key: "settings", label: "Settings", scene: "SettingsScene" },
];
```

- [ ] **Step 2: Rewrite `drawMenu` to use `homeNavLayout`**

```ts
private drawMenu(W: number, H: number): void {
  const lay = homeNavLayout(SECONDARY_ITEMS.length, W, H);
  const p = lay.panel;
  this.add.graphics().setDepth(7)
    .fillStyle(0x0c1120, 0.82).fillRoundedRect(p.x, p.y, p.w, p.h, 16)
    .lineStyle(2, 0x3a567f, 0.9).strokeRoundedRect(p.x, p.y, p.w, p.h, 16);
  if (lay.rowDivider !== undefined) {
    this.add.graphics().setDepth(7)
      .lineStyle(1, 0x33507a, 0.5)
      .lineBetween(p.x + 20, lay.rowDivider, p.x + p.w - 20, lay.rowDivider);
  }
  this.drawPrimaryButton(PRIMARY_ITEM, lay.primary);
  SECONDARY_ITEMS.forEach((m, i) => {
    const c = lay.cells[i];
    this.iconButton(m, c.x, c.y);
  });
}

/** The wide, gold-accented hero call-to-action. */
private drawPrimaryButton(item: MenuItem, r: { x: number; y: number; w: number; h: number }): void {
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  const c = this.add.container(cx, cy).setDepth(9);
  const g = this.add.graphics();
  g.fillStyle(0x7a4b12, 1).fillRoundedRect(-r.w / 2, -r.h / 2, r.w, r.h, 12);
  g.fillStyle(0xe8a93a, 1).fillRoundedRect(-r.w / 2, -r.h / 2, r.w, r.h - 4, 12);
  g.lineStyle(2, 0xffe9a8, 1).strokeRoundedRect(-r.w / 2, -r.h / 2, r.w, r.h, 12);
  c.add(g);
  c.add(crispText(this, 0, 0, `▶  ${item.label}`, {
    fontSize: "22px", color: "#2a1804", fontStyle: "bold",
  }).setOrigin(0.5));
  const z = this.add.zone(0, 0, r.w, r.h).setInteractive({ useHandCursor: true });
  c.add(z);
  z.on("pointerover", () => this.tweens.add({ targets: c, scale: 1.04, duration: 130, ease: "Back.easeOut" }));
  z.on("pointerout", () => this.tweens.add({ targets: c, scale: 1, duration: 130, ease: "Sine.easeOut" }));
  z.on("pointerdown", () => this.tweens.add({ targets: c, scale: 0.96, duration: 80, yoyo: true,
    onComplete: () => fadeToScene(this, item.scene) }));
  // subtle idle pulse so the CTA reads as the hero action
  this.tweens.add({ targets: g, alpha: { from: 1, to: 0.86 }, duration: 1100, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
}
```

- [ ] **Step 3: Update `iconButton` label width tolerance**

No code change required to `iconButton` itself (the cell is still 140 wide). Confirm the label `fontSize` stays 12px. Leave the hit `zone` at `120,56`.

- [ ] **Step 4: Typecheck + tests + build**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: PASS. If `MainMenuScene.ts` exceeds 500 code lines (`npx eslint src/scenes/MainMenuScene.ts`), extract `drawPrimaryButton` + `drawPill` into a new `src/scenes/homeBarFx.ts` and import them.

- [ ] **Step 5: Commit**

```bash
git add src/scenes/MainMenuScene.ts
git commit -m "feat(home): prominent BATTLE CTA + tidier 11-tile secondary nav

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Re-anchor the Set-Squad CTA / squad so it stops floating

**Files:**
- Modify: `src/scenes/MainMenuScene.ts`

- [ ] **Step 1: Lower the Set-Squad CTA above the dock, not over the hero**

In `drawSquad`, the `showSetSquad` container is currently at `H * 0.74`. The new dock panel top is higher, so move the CTA to sit just above the dock and away from the hero. Change:
```ts
const c = this.add.container(W / 2, H * 0.74).setDepth(6);
```
to:
```ts
const navTop = homeNavLayout(SECONDARY_ITEMS.length, W, H).panel.y;
const c = this.add.container(W / 2, navTop - 28).setDepth(6);
```

- [ ] **Step 2: Nudge the squad stand up so it clears the taller dock**

In `homeRoom.ts` `squadStandPoints`, the y is `H * 0.74`. The taller dock now starts higher; pull the squad band up so sprites aren't occluded. Change the `y` term from `H * 0.74` to `H * 0.66` (keep the sine arc):
```ts
out.push({ x: W * 0.16 + tt * W * 0.68, y: H * 0.66 + Math.sin(tt * Math.PI) * -10 });
```

- [ ] **Step 3: Typecheck + tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS. (Existing `homeRoom` tests, if any assert exact y, must be updated to `0.66`.)

- [ ] **Step 4: Commit**

```bash
git add src/scenes/MainMenuScene.ts src/scenes/homeRoom.ts
git commit -m "fix(home): re-anchor Set-Squad CTA + squad band clear of the taller dock

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Retire `dockLayout`, migrate its test coverage

**Files:**
- Delete: `src/scenes/menuLayout.ts` (if no other importer)
- Modify/Delete: `tests/menuLayout.test.ts`

- [ ] **Step 1: Confirm no remaining importers**

Run: `rg -n "menuLayout|dockLayout" src tests`
Expected: only `tests/menuLayout.test.ts` references remain (MainMenuScene no longer imports it).

- [ ] **Step 2: Delete the dead module + its test**

```bash
git rm src/scenes/menuLayout.ts tests/menuLayout.test.ts
```
(Its grid invariants are now covered by `homeNavLayout` tests in `tests/homeLayout.test.ts`.)

- [ ] **Step 3: Full verification gate**

Run: `npx tsc --noEmit && npx vitest run && npm run build && npx eslint src/scenes/MainMenuScene.ts src/scenes/homeLayout.ts`
Expected: all PASS; no file over 500 lines; build clean.

- [ ] **Step 4: Headless visual confirm**

Run: `bash scripts/playtest/snap.sh --scene=MainMenuScene --out=/tmp/home_new.png --wait=16000`
Inspect `/tmp/home_new.png`: framed gold+diamond pills top-right, compact brand top-left (no collision/clipping), one prominent BATTLE button, tidy 11-tile nav with a row divider, hero/squad unobstructed.

- [ ] **Step 5: Commit**

```bash
git add -A src/scenes/menuLayout.ts tests/menuLayout.test.ts
git commit -m "refactor(home): retire dockLayout; homeNavLayout is the single nav geometry

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review Notes

- **Spec coverage:** top resource bar (T1,T3) ✓; gold+diamonds (T3) ✓; primary BATTLE CTA (T2,T4) ✓; tidy secondary grid + row divider (T2,T4) ✓; compact brand, no collision (T3) ✓; Set-Squad/squad re-anchor (T5) ✓; pure + tested (T1,T2) ✓; <500-line discipline (T4 guard) ✓; keep diorama/atmosphere/icons/badges (untouched) ✓.
- **Type consistency:** `homeTopBar`/`homeNavLayout` signatures and the `TopBar`/`NavLayout`/`Pill`/`NavCell`/`Rect` types are identical across tasks. `MenuItem` reused unchanged.
- **No placeholders:** every code step shows complete code; commands have expected output.
