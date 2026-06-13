# Home Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat-procedural foreground of the main menu (cardboard throne, 3 missing icons, edge-scatter nav, procedural hangers) with a painted-diorama + bottom-dock design that matches the SDXL cathedral background.

**Architecture:** A new pure `menuLayout.ts` computes a 6×2 bottom nav-dock geometry (TDD). The throne is baked into a regenerated SDXL `menu-hall.png` and the procedural `drawThrone()` is deleted. The 3 missing menu icons are generated via the Z-Image API to match the existing painted set. `MainMenuScene` is rewired to the dock and softened hangers.

**Tech Stack:** TypeScript, Phaser 3, Vitest, local Z-Image-Turbo HTTP API (`scripts/sdart/genBackgrounds.mjs` + direct curl), Python/PIL for downscale.

---

### Task 1: Pure `menuLayout.ts` (TDD)

**Files:**
- Create: `src/scenes/menuLayout.ts`
- Test: `tests/menuLayout.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/menuLayout.test.ts
import { describe, it, expect } from "vitest";
import { dockLayout, type DockCell } from "../src/scenes/menuLayout.ts";

const W = 960,
  H = 540;

describe("dockLayout", () => {
  it("produces one cell per item (12 = 6x2)", () => {
    const lay = dockLayout(12, W, H);
    expect(lay.cells).toHaveLength(12);
  });

  it("lays items out in row-major 6-wide rows", () => {
    const lay = dockLayout(12, W, H);
    // first 6 share the top row y, next 6 share the bottom row y
    const r0 = lay.cells.slice(0, 6).map((c) => c.y);
    const r1 = lay.cells.slice(6).map((c) => c.y);
    expect(new Set(r0).size).toBe(1);
    expect(new Set(r1).size).toBe(1);
    expect(r1[0]).toBeGreaterThan(r0[0]);
  });

  it("every cell sits inside the dock panel", () => {
    const lay = dockLayout(12, W, H);
    for (const c of lay.cells) {
      expect(c.x).toBeGreaterThanOrEqual(lay.panel.x);
      expect(c.x).toBeLessThanOrEqual(lay.panel.x + lay.panel.w);
      expect(c.y).toBeGreaterThanOrEqual(lay.panel.y);
      expect(c.y).toBeLessThanOrEqual(lay.panel.y + lay.panel.h);
    }
  });

  it("cells in a row do not overlap and are left-to-right", () => {
    const lay = dockLayout(12, W, H);
    const xs = lay.cells.slice(0, 6).map((c) => c.x);
    for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeGreaterThan(xs[i - 1]);
  });

  it("the grid is horizontally centred on the screen", () => {
    const lay = dockLayout(12, W, H);
    const xs = lay.cells.map((c) => c.x);
    const mid = (Math.min(...xs) + Math.max(...xs)) / 2;
    expect(Math.abs(mid - W / 2)).toBeLessThan(1);
  });

  it("docks in the lower portion, within bounds", () => {
    const lay = dockLayout(12, W, H);
    expect(lay.panel.y).toBeGreaterThan(H * 0.6);
    expect(lay.panel.x).toBeGreaterThanOrEqual(0);
    expect(lay.panel.x + lay.panel.w).toBeLessThanOrEqual(W);
    expect(lay.panel.y + lay.panel.h).toBeLessThanOrEqual(H);
  });

  it("is pure (same input → identical output)", () => {
    expect(dockLayout(12, W, H)).toEqual(dockLayout(12, W, H));
  });

  it("handles a non-multiple-of-6 count without crashing", () => {
    const lay = dockLayout(10, W, H);
    expect(lay.cells).toHaveLength(10);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/menuLayout.test.ts`
Expected: FAIL — cannot find module `../src/scenes/menuLayout.ts`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/scenes/menuLayout.ts
/**
 * Pure, Phaser-free geometry for the main-menu bottom navigation dock: a framed
 * panel holding the destination buttons in a centred row-major grid. Deterministic
 * and unit-tested (see tests/menuLayout.test.ts). MainMenuScene is the presenter.
 */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface DockCell {
  x: number; // cell centre
  y: number;
  w: number; // cell box
  h: number;
}
export interface DockLayout {
  panel: Rect;
  cells: DockCell[];
}

const COLS = 6;
const MARGIN = 14; // gap from screen edge / panel inner padding
const CELL_W = 140;
const CELL_H = 50;
const ROW_GAP = 8;

/** Lay `count` items into a centred COLS-wide row-major grid inside a bottom dock panel. */
export function dockLayout(count: number, W: number, H: number): DockLayout {
  const rows = Math.max(1, Math.ceil(count / COLS));
  const cols = Math.min(COLS, count);
  const gridW = cols * CELL_W;
  const gridH = rows * CELL_H + (rows - 1) * ROW_GAP;
  const panel: Rect = {
    x: Math.round(W / 2 - gridW / 2 - MARGIN),
    y: Math.round(H - gridH - MARGIN * 2 - 8),
    w: gridW + MARGIN * 2,
    h: gridH + MARGIN * 2,
  };
  const x0 = W / 2 - gridW / 2 + CELL_W / 2;
  const y0 = panel.y + MARGIN + CELL_H / 2;
  const cells: DockCell[] = [];
  for (let i = 0; i < count; i++) {
    const r = Math.floor(i / COLS);
    const c = i % COLS;
    // centre the final (possibly short) row
    const inRow = Math.min(COLS, count - r * COLS);
    const rowOffset = ((COLS - inRow) * CELL_W) / 2;
    cells.push({
      x: Math.round(x0 + c * CELL_W + rowOffset),
      y: Math.round(y0 + r * (CELL_H + ROW_GAP)),
      w: CELL_W,
      h: CELL_H,
    });
  }
  return { panel, cells };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/menuLayout.test.ts`
Expected: PASS (8 tests).

Note: the "horizontally centred" test uses a full 12 (two full rows), so the
`rowOffset` is 0 there; the partial-row centring is exercised by the count=10 test.

- [ ] **Step 5: Commit**

```bash
git add src/scenes/menuLayout.ts tests/menuLayout.test.ts
git commit -m "feat(menu): pure bottom-dock layout geometry (TDD)"
```

---

### Task 2: Regenerate the SDXL background with a baked throne

**Files:**
- Modify: `scripts/sdart/genBackgrounds.mjs` (prompt only)
- Replace: `public/assets/bg/menu-hall.png`

- [ ] **Step 1: Update the prompt to bake in a centred throne + dais**

In `scripts/sdart/genBackgrounds.mjs`, replace the `PROMPT` and `NEG` constants:

```js
const PROMPT =
  "epic grand cathedral throne room interior, deep symmetrical one-point " +
  "perspective, a single ornate golden royal throne on a wide raised stone dais " +
  "with broad steps at the centre, the throne empty, seat around mid height, " +
  "towering stained-glass windows casting dramatic volumetric god-ray light " +
  "shafts, rows of lit golden braziers along both walls, tall stone pillars, " +
  "long red royal banners, marble floor with subtle reflections, warm amber " +
  "key light and deep cool shadows, cinematic, atmospheric, fantasy anime game " +
  "background art, highly detailed, painterly";
const NEG =
  "two thrones, multiple thrones, king on throne, character sitting, person, " +
  "people, hero, knight, anime girl, anime boy, face, crowd, user interface, " +
  "UI, hud, text, words, watermark, logo, signature, frame, border, blurry, " +
  "lowres, jpeg artifacts, deformed, tiling seams";
```

- [ ] **Step 2: Confirm the Z-Image service is up**

Run: `curl -s http://127.0.0.1:8765/health`
Expected: `{"status":"ok","model":"z-image-turbo","ready":true}`. If `ready:false`, wait and retry; do not loop tightly.

- [ ] **Step 3: Generate candidates**

Run: `npx vite-node scripts/sdart/genBackgrounds.mjs --n 4`
Expected: writes `public/assets/bg/menu-hall-cand-*.png` (960×540).

- [ ] **Step 4: Review candidates and pick the best**

Read each `public/assets/bg/menu-hall-cand-*.png`. Pick the one with a clearly
centred ornate throne on a dais whose seat sits around mid-height and whose steps
fall in the lower third (so the standing hero reads as "before the throne" and the
squad stands on the steps). Copy it over the live file, then clean up:

```bash
cp public/assets/bg/menu-hall-cand-<SEED>.png public/assets/bg/menu-hall.png
rm -f public/assets/bg/menu-hall-cand-*.png
```

- [ ] **Step 5: Commit**

```bash
git add scripts/sdart/genBackgrounds.mjs public/assets/bg/menu-hall.png
git commit -m "feat(art): bake ornate throne + dais into the menu-hall background"
```

---

### Task 3: Generate the 3 missing painted menu icons

**Files:**
- Create: `public/assets/ui/menu/quests.png`, `activities.png`, `forge.png` (128×128)

- [ ] **Step 1: Confirm the Z-Image service is up**

Run: `curl -s http://127.0.0.1:8765/health`
Expected: `ready:true`.

- [ ] **Step 2: Generate each icon at 512 then downscale to 128**

The existing icons are gold-framed painterly emblems isolated on a soft
background. Generate at 512×512 (native-ish) and downscale with PIL. Run:

```bash
cd /home/shyaken/Workplace/wibu-tower-defense
gen() {
  curl -s -X POST http://127.0.0.1:8765/generate -H 'content-type: application/json' \
    -d "{\"prompt\":\"$1\",\"steps\":30,\"width\":512,\"height\":512,\"seed\":$2}" \
    -o "/tmp/icon_$3.png"
  python3 -c "from PIL import Image;Image.open('/tmp/icon_$3.png').convert('RGBA').resize((128,128),Image.LANCZOS).save('public/assets/ui/menu/$3.png')"
}
COMMON="ornate game UI icon, single centred emblem, thick polished gold rounded frame, painterly 3D render, glossy, vibrant, soft studio lighting, clean plain background, highly detailed, no text"
gen "an unfurled parchment quest scroll with a red wax seal and a green check mark, $COMMON" 81001 quests
gen "a glowing fantasy blacksmith anvil with a hammer and bright orange sparks, $COMMON" 81002 forge
gen "an open almanac calendar page with a radiant golden star burst, $COMMON" 81003 activities
```

- [ ] **Step 3: Verify the three files are 128×128**

Run:
```bash
python3 -c "from PIL import Image;[print(f,Image.open('public/assets/ui/menu/'+f).size) for f in ['quests.png','forge.png','activities.png']]"
```
Expected: each `(128, 128)`.

- [ ] **Step 4: Read the three icons and confirm they match the painted set**

Read `public/assets/ui/menu/{quests,forge,activities}.png`. They must be gold-framed
painterly emblems consistent with `battle.png`/`shop.png`/`passive.png`. If any is
off-style (e.g. flat, no gold frame, has text), bump its seed by 1 and regenerate
that one until it matches.

- [ ] **Step 5: Commit**

```bash
git add public/assets/ui/menu/quests.png public/assets/ui/menu/forge.png public/assets/ui/menu/activities.png
git commit -m "feat(art): painted quests/forge/activities menu icons"
```

---

### Task 4: Load the new icons in PreloadScene

**Files:**
- Modify: `src/scenes/PreloadScene.ts` (menu-icon load list, ~line 82)

- [ ] **Step 1: Add the 3 ids to the load list**

In `src/scenes/PreloadScene.ts`, extend the menu-icon id array to include the
three new icons:

```ts
    for (const id of [
      "battle",
      "summon",
      "collection",
      "inventory",
      "squad",
      "passive",
      "shop",
      "skills",
      "settings",
      "quests",
      "activities",
      "forge",
    ]) {
      this.load.image(menuTex(id), versioned(`assets/ui/menu/${id}.png`));
    }
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/scenes/PreloadScene.ts
git commit -m "feat(menu): preload painted quests/activities/forge icons"
```

---

### Task 5: Rewire MainMenuScene — delete throne, dock nav, soften hangers

**Files:**
- Modify: `src/scenes/MainMenuScene.ts`

- [ ] **Step 1: Delete `drawThrone` and its call**

Remove the `drawThrone(W, H)` call in `create()` and delete the entire
`private drawThrone(...)` method (the procedural chair now lives in the painted
background).

- [ ] **Step 2: Reorder `MENU_ITEMS` into dock order; drop the `side` field**

Replace the `MenuItem` interface and `MENU_ITEMS` with row-major dock order:

```ts
interface MenuItem {
  key: string; // painted icon id + glyph fallback id
  label: string;
  scene: string;
}

// Row-major: row 1 = core loop, row 2 = meta. Order drives the 6x2 dock.
const MENU_ITEMS: MenuItem[] = [
  { key: "battle", label: "Battle", scene: "StageSelectScene" },
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

- [ ] **Step 3: Rewrite `drawMenu` to use the dock layout**

Replace `drawMenu` with a dock-panel + grid version. Add the import at the top:
`import { dockLayout } from "./menuLayout.ts";`

```ts
  private drawMenu(W: number, H: number): void {
    const lay = dockLayout(MENU_ITEMS.length, W, H);
    // Framed dock panel behind the buttons.
    const p = lay.panel;
    this.add
      .graphics()
      .setDepth(7)
      .fillStyle(0x0c1120, 0.82)
      .fillRoundedRect(p.x, p.y, p.w, p.h, 16)
      .lineStyle(2, 0x3a567f, 0.9)
      .strokeRoundedRect(p.x, p.y, p.w, p.h, 16);
    MENU_ITEMS.forEach((m, i) => {
      const c = lay.cells[i];
      this.iconButton(m, c.x, c.y);
    });
  }
```

- [ ] **Step 4: Simplify `iconButton` (no more per-side; icon above label)**

Keep `iconButton(item, x, y)` but ensure the icon sits above a readable label and
the hit-zone covers the cell. Replace the body's sizing block:

```ts
  private iconButton(item: MenuItem, x: number, y: number): void {
    const c = this.add.container(x, y).setDepth(8);
    const iconKey = menuTex(item.key);
    if (this.textures.exists(iconKey)) {
      const img = this.add.image(0, -8, iconKey).setOrigin(0.5);
      img.setScale(Math.min(44 / img.width, 44 / img.height));
      c.add(img);
    } else {
      const g = this.add.graphics();
      g.fillStyle(0x101826, 0.92).fillRoundedRect(-22, -30, 44, 44, 10);
      g.lineStyle(2, 0x3a567f, 1).strokeRoundedRect(-22, -30, 44, 44, 10);
      drawMenuGlyph(g, item.key, 0, -8, 13);
      c.add(g);
    }
    c.add(
      crispText(this, 0, 18, item.label, {
        fontSize: "12px",
        color: "#ffe9c0",
        fontStyle: "bold",
        stroke: "#1a1206",
        strokeThickness: 3,
      }).setOrigin(0.5),
    );

    const badge = this.badges[item.key] ?? 0;
    if (badge > 0) {
      const bx = 20,
        by = -28;
      const bg = this.add.graphics();
      bg.fillStyle(0xe6312b, 1).fillCircle(bx, by, 9);
      bg.lineStyle(1.5, 0xffd9c0, 0.9).strokeCircle(bx, by, 9);
      c.add(bg);
      c.add(
        crispText(this, bx, by, `${badge}`, {
          fontSize: "10px",
          color: "#ffffff",
          fontStyle: "bold",
        }).setOrigin(0.5),
      );
    }

    const z = this.add.zone(0, -4, 120, 56).setInteractive({ useHandCursor: true });
    c.add(z);
    z.on("pointerover", () =>
      this.tweens.add({ targets: c, scale: 1.12, duration: 130, ease: "Back.easeOut" }),
    );
    z.on("pointerout", () =>
      this.tweens.add({ targets: c, scale: 1, duration: 130, ease: "Sine.easeOut" }),
    );
    z.on("pointerdown", () => {
      this.tweens.add({
        targets: c,
        scale: 0.9,
        duration: 80,
        yoyo: true,
        onComplete: () => fadeToScene(this, item.scene),
      });
    });
  }
```

Remove the now-unused `BTN` constant if it is no longer referenced.

- [ ] **Step 5: Soften `drawHangers` — drop the brown bar + rope**

In `drawHangers`, remove the wall-bar rectangle, the hook circle, and the rope
`lineBetween`. Keep the swaying item icon but give it a soft drop shadow:

```ts
  private drawHangers(save: ReturnType<SaveManager["getSave"]>, W: number, H: number): void {
    const cells = hangerLayout(W, H);
    const items = equippedHangers(save.inventory);
    cells.forEach((cell, i) => {
      const it = items[i];
      if (!it || !this.textures.exists(it.iconKey)) return; // empty peg
      const shadow = this.add
        .image(cell.x, cell.y + 16, it.iconKey)
        .setOrigin(0.5, 0)
        .setDepth(3)
        .setTint(0x000000)
        .setAlpha(0.3);
      shadow.setScale(Math.min(34 / shadow.width, 34 / shadow.height));
      const img = this.add
        .image(cell.x, cell.y + 14, it.iconKey)
        .setOrigin(0.5, 0)
        .setDepth(4);
      img.setScale(Math.min(34 / img.width, 34 / img.height));
      this.tweens.add({
        targets: [img, shadow],
        angle: { from: -4, to: 4 },
        duration: 1600 + i * 90,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    });
  }
```

- [ ] **Step 6: Typecheck and confirm file size**

Run: `npm run typecheck && npx eslint src/scenes/MainMenuScene.ts`
Expected: no type errors; no `max-lines` error (file < 500 code lines). If eslint
flags `max-lines`, move `drawMenuGlyph` + `star4` + `P` into a new
`src/scenes/menuGlyphs.ts` and import them.

- [ ] **Step 7: Commit**

```bash
git add src/scenes/MainMenuScene.ts
git commit -m "feat(menu): painted-diorama home — drop procedural throne, bottom nav dock, soft hangers"
```

---

### Task 6: Bump ASSET_VERSION

**Files:**
- Modify: `src/data/assetVersion.ts`

- [ ] **Step 1: Bump the token**

Change `ASSET_VERSION` from `"2026-06-13b"` to `"2026-06-13c"`.

- [ ] **Step 2: Commit**

```bash
git add src/data/assetVersion.ts
git commit -m "chore(assets): bump ASSET_VERSION for menu-hall + icon regen"
```

---

### Task 7: Verify whole + visual check

- [ ] **Step 1: Full verification**

Run: `npm run typecheck && npx vitest run && npm run build`
Expected: typecheck clean, all tests pass (incl. `menuLayout.test.ts`), build succeeds.

- [ ] **Step 2: Lint the changed files**

Run: `npx eslint src/scenes/MainMenuScene.ts src/scenes/menuLayout.ts`
Expected: no errors (esp. no `max-lines`).

- [ ] **Step 3: Headless screenshot of the new home page**

Run: `bash scripts/playtest/snap.sh --out=/tmp/home_after.png --scene=MainMenuScene --wait=6000`
Read `/tmp/home_after.png`. Confirm: painted throne (no cardboard prop), all 12
icons painted and consistent, framed bottom dock, hero before the throne, squad on
the steps, no procedural clutter. If the dock overlaps the squad badly, nudge the
`dockLayout` panel `y`/`CELL_H` constants and re-verify.

- [ ] **Step 4: Final report**

Summarise the changes and deliver the after-screenshot to the chat.
