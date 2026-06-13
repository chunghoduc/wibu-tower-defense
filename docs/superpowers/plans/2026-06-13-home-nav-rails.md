# Home Nav Rails Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-arrange the 11 main-menu secondary icons from a single 6×2 bottom grid into a left rail + right rail + bottom row that frames the central diorama.

**Architecture:** Rewrite the pure `homeNavLayout` (src/scenes/homeLayout.ts) to return three regioned cell lists (`left`, `right`, `bottom`) plus the dock `panel` and `primary` CTA, instead of one flat `cells` grid. `MainMenuScene` partitions `SECONDARY_ITEMS` into three constant arrays and renders each region with the existing `iconButton`.

**Tech Stack:** TypeScript, Phaser 3, Vitest. Pure geometry module is Phaser-free and unit-tested.

---

### Task 1: Regioned `homeNavLayout` (pure geometry, TDD)

**Files:**
- Modify: `src/scenes/homeLayout.ts` (replace `NavLayout`, `NavCell`, `homeNavLayout`)
- Test: `tests/homeLayout.test.ts` (replace the `homeNavLayout` describe block)

- [ ] **Step 1: Replace the `homeNavLayout` describe block in tests/homeLayout.test.ts**

```ts
describe("homeNavLayout (rails + bottom row)", () => {
  const lay = () => homeNavLayout({ left: 4, right: 4, bottom: 3 }, W, H);

  it("produces exactly the requested per-region counts", () => {
    const l = lay();
    expect(l.left).toHaveLength(4);
    expect(l.right).toHaveLength(4);
    expect(l.bottom).toHaveLength(3);
  });

  it("left rail hugs the left edge, right rail hugs the right edge", () => {
    const l = lay();
    for (const c of l.left) expect(c.x).toBeLessThan(W * 0.15);
    for (const c of l.right) expect(c.x).toBeGreaterThan(W * 0.85);
  });

  it("each rail has a constant x and ascends in y (top to bottom)", () => {
    const l = lay();
    for (const rail of [l.left, l.right]) {
      const xs = new Set(rail.map((c) => c.x));
      expect(xs.size).toBe(1);
      for (let i = 1; i < rail.length; i++) expect(rail[i].y).toBeGreaterThan(rail[i - 1].y);
    }
  });

  it("rails are vertically centered and clear of the top band and the dock", () => {
    const l = lay();
    for (const rail of [l.left, l.right]) {
      const ys = rail.map((c) => c.y);
      const mid = (Math.min(...ys) + Math.max(...ys)) / 2;
      expect(Math.abs(mid - H * 0.46)).toBeLessThan(2);
      for (const c of rail) {
        expect(c.y - c.h / 2).toBeGreaterThan(H * 0.18);
        expect(c.y + c.h / 2).toBeLessThan(l.panel.y);
      }
    }
  });

  it("primary CTA sits above every bottom cell and inside the panel", () => {
    const l = lay();
    expect(l.primary.x).toBeGreaterThanOrEqual(l.panel.x);
    expect(l.primary.x + l.primary.w).toBeLessThanOrEqual(l.panel.x + l.panel.w);
    for (const c of l.bottom) expect(c.y).toBeGreaterThan(l.primary.y);
  });

  it("bottom row sits inside the dock, ascends in x, centered on W/2", () => {
    const l = lay();
    for (const c of l.bottom) {
      expect(c.x).toBeGreaterThanOrEqual(l.panel.x);
      expect(c.x).toBeLessThanOrEqual(l.panel.x + l.panel.w);
      expect(c.y).toBeGreaterThanOrEqual(l.panel.y);
      expect(c.y).toBeLessThanOrEqual(l.panel.y + l.panel.h);
    }
    const xs = l.bottom.map((c) => c.x);
    for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeGreaterThan(xs[i - 1]);
    const mid = (Math.min(...xs) + Math.max(...xs)) / 2;
    expect(Math.abs(mid - W / 2)).toBeLessThan(2);
  });

  it("the whole dock stays in the lower half and on-screen", () => {
    const l = lay();
    expect(l.panel.y).toBeGreaterThan(H * 0.5);
    expect(l.panel.y + l.panel.h).toBeLessThanOrEqual(H);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/homeLayout.test.ts`
Expected: FAIL — `homeNavLayout` still takes a number / returns `cells`, so the new calls/props are undefined.

- [ ] **Step 3: Rewrite the NavLayout block in src/scenes/homeLayout.ts**

Replace everything from `export interface NavCell {` through the end of `homeNavLayout` (the current `const COLS … return { panel, primary, cells, rowDivider };` block) with:

```ts
export interface NavCell {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface NavLayout {
  panel: Rect;
  primary: Rect;
  left: NavCell[];
  right: NavCell[];
  bottom: NavCell[];
}

const MARGIN = 12;
const RAIL_W = 60;
const RAIL_H = 52;
const RAIL_GAP = 14;
const RAIL_CENTER_Y = 0.46; // fraction of H — vertical midpoint of each rail stack
const BOTTOM_CELL_W = 132;
const BOTTOM_CELL_H = 46;
const PRIMARY_H = 42;
const PRIMARY_GAP = 10;

/** A vertically centered rail of `n` cells at a fixed x. */
function rail(n: number, x: number, H: number): NavCell[] {
  const step = RAIL_H + RAIL_GAP;
  const cy = H * RAIL_CENTER_Y;
  const cells: NavCell[] = [];
  for (let i = 0; i < n; i++) {
    cells.push({ x, y: Math.round(cy + (i - (n - 1) / 2) * step), w: RAIL_W, h: RAIL_H });
  }
  return cells;
}

/**
 * Home navigation framed around the diorama: a left rail + right rail of icon
 * buttons at the screen edges, and a bottom dock holding the wide primary
 * BATTLE CTA above a single centered row of `counts.bottom` cells.
 */
export function homeNavLayout(
  counts: { left: number; right: number; bottom: number },
  W: number,
  H: number,
): NavLayout {
  const left = rail(counts.left, MARGIN + RAIL_W / 2, H);
  const right = rail(counts.right, W - MARGIN - RAIL_W / 2, H);

  const rowW = counts.bottom * BOTTOM_CELL_W;
  const panelH = PRIMARY_H + PRIMARY_GAP + BOTTOM_CELL_H + MARGIN * 2;
  const panel: Rect = {
    x: Math.round(W / 2 - rowW / 2 - MARGIN),
    y: Math.round(H - panelH - 8),
    w: rowW + MARGIN * 2,
    h: panelH,
  };
  const primary: Rect = {
    x: panel.x + MARGIN,
    y: panel.y + MARGIN,
    w: panel.w - MARGIN * 2,
    h: PRIMARY_H,
  };
  const y0 = primary.y + PRIMARY_H + PRIMARY_GAP + BOTTOM_CELL_H / 2;
  const x0 = W / 2 - rowW / 2 + BOTTOM_CELL_W / 2;
  const bottom: NavCell[] = [];
  for (let i = 0; i < counts.bottom; i++) {
    bottom.push({
      x: Math.round(x0 + i * BOTTOM_CELL_W),
      y: Math.round(y0),
      w: BOTTOM_CELL_W,
      h: BOTTOM_CELL_H,
    });
  }
  return { panel, primary, left, right, bottom };
}
```

Also update the file's top doc comment to describe rails + bottom row (replace "the bottom navigation (framed panel + primary BATTLE CTA + secondary destination grid)" with "the bottom navigation (left/right icon rails framing the diorama + a bottom dock with the primary BATTLE CTA and a centered system row)").

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/homeLayout.test.ts`
Expected: PASS (all homeTopBar + new homeNavLayout cases).

- [ ] **Step 5: Commit**

```bash
git add src/scenes/homeLayout.ts tests/homeLayout.test.ts
git commit -m "feat(home): regioned nav layout (left/right rails + bottom row)"
```

---

### Task 2: Wire MainMenuScene to the regioned layout

**Files:**
- Modify: `src/scenes/MainMenuScene.ts` (`SECONDARY_ITEMS` → partition arrays; `drawMenu`)

- [ ] **Step 1: Replace the `SECONDARY_ITEMS` constant (and its comment) with three partition arrays**

```ts
// BATTLE is the hero call-to-action — a wide primary button in the bottom dock.
// The rest frame the diorama: a loadout rail on the left, an economy rail on the
// right, and a daily/system row across the bottom. Order within each list is the
// render order (rails top→bottom, bottom row left→right).
const PRIMARY_ITEM: MenuItem = { key: "battle", label: "BATTLE", scene: "StageSelectScene" };
const LEFT_ITEMS: MenuItem[] = [
  { key: "squad", label: "Squad", scene: "SquadScene" },
  { key: "inventory", label: "Inventory", scene: "HeroScene" },
  { key: "skills", label: "Skills", scene: "SkillsScene" },
  { key: "passive", label: "Passives", scene: "PassiveGridScene" },
];
const RIGHT_ITEMS: MenuItem[] = [
  { key: "summon", label: "Summon", scene: "GachaScene" },
  { key: "shop", label: "Shop", scene: "ShopScene" },
  { key: "forge", label: "Forge", scene: "ForgeScene" },
  { key: "collection", label: "Codex", scene: "CollectionScene" },
];
const BOTTOM_ITEMS: MenuItem[] = [
  { key: "quests", label: "Quests", scene: "QuestScene" },
  { key: "activities", label: "Activities", scene: "ActivitiesScene" },
  { key: "settings", label: "Settings", scene: "SettingsScene" },
];
```

- [ ] **Step 2: Rewrite `drawMenu` to consume the regioned layout**

Replace the whole `drawMenu` method body with:

```ts
  // ── nav: side rails framing the diorama + bottom dock (primary + system row) ──
  private drawMenu(W: number, H: number): void {
    const lay = homeNavLayout(
      { left: LEFT_ITEMS.length, right: RIGHT_ITEMS.length, bottom: BOTTOM_ITEMS.length },
      W,
      H,
    );
    const p = lay.panel;
    this.add
      .graphics()
      .setDepth(7)
      .fillStyle(0x0c1120, 0.82)
      .fillRoundedRect(p.x, p.y, p.w, p.h, 16)
      .lineStyle(2, 0x3a567f, 0.9)
      .strokeRoundedRect(p.x, p.y, p.w, p.h, 16);
    drawPrimaryButton(this, PRIMARY_ITEM.label, PRIMARY_ITEM.scene, lay.primary);
    LEFT_ITEMS.forEach((m, i) => this.iconButton(m, lay.left[i].x, lay.left[i].y));
    RIGHT_ITEMS.forEach((m, i) => this.iconButton(m, lay.right[i].x, lay.right[i].y));
    BOTTOM_ITEMS.forEach((m, i) => this.iconButton(m, lay.bottom[i].x, lay.bottom[i].y));
  }
```

(This removes the now-dead `rowDivider` rendering — `homeNavLayout` no longer returns it.)

- [ ] **Step 3: Typecheck + full test suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc clean; all tests pass (1 pre-existing unrelated `firebaseCachePolicy` failure is acceptable).

- [ ] **Step 4: Lint + cycles + build**

Run: `npx eslint src/scenes/homeLayout.ts src/scenes/MainMenuScene.ts && npm run lint:cycles && npm run build`
Expected: 0 eslint errors, 0 cycles, build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/scenes/MainMenuScene.ts
git commit -m "feat(home): render nav as left/right rails + bottom system row"
```

---

### Task 3: Visual verification + memory

- [ ] **Step 1: Render the actual layout to an SVG/PNG schematic**

Reuse the verified-offline approach (headless GPU is OOM-flaky here): a temp vitest that calls `homeNavLayout({left:4,right:4,bottom:3}, 960, 540)` + `homeTopBar` and draws panel/primary/left/right/bottom rects (with labels) plus diorama anchor markers (hero W/2, hangers 0.13W/0.87W, squad band) to an SVG, then rasterize with one-shot `google-chrome --headless --screenshot`. Confirm rails hug the edges outside the hangers, bottom row is centered under BATTLE, nothing overlaps the center. Delete the temp test after.

- [ ] **Step 2: Update memory**

Update `memory/project_home_screen_layout.md`: note the nav is now left/right rails + bottom row via `homeNavLayout({left,right,bottom})` (the 6×2 grid + `rowDivider` are retired); partition lives in MainMenuScene `LEFT_ITEMS`/`RIGHT_ITEMS`/`BOTTOM_ITEMS`. Keep the MEMORY.md index hook accurate.

- [ ] **Step 3: Commit**

```bash
git add memory/ docs/superpowers
git commit -m "docs(home): nav-rails spec, plan, memory"
```
