# Battle CTA Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat amber main-menu BATTLE button with a tactile, layered crimson-ember war CTA carrying an SDXL combat emblem and a living sheen sweep.

**Architecture:** A new pure module `battleCta.ts` computes all layered geometry from the button rect (TDD seam). A thin presenter `drawBattleCta` in `homeBarFx.ts` paints it and wires motion. A single new SDXL emblem is generated through the existing art pipeline (`scripts/sdart/`) and loaded in `PreloadScene`. `homeLayout.ts` bumps the primary CTA height for prominence. `MainMenuScene` swaps one call.

**Tech Stack:** TypeScript, Phaser 3, Vite, vitest. SDXL/Z-Image-Turbo art pipeline (`scripts/sdart/sdgen.mjs`). Pure-module + thin-presenter pattern.

---

## Task 1: Pure layered geometry `battleCta.ts` (TDD)

**Files:**
- Create: `src/scenes/battleCta.ts`
- Test: `tests/battleCta.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { battleCtaPlan } from "../src/scenes/battleCta.ts";

const R = { x: 100, y: 400, w: 300, h: 52 };

describe("battleCtaPlan", () => {
  it("body sits inside the rect, inset by the bevel on every side", () => {
    const p = battleCtaPlan(R);
    expect(p.body.x).toBeGreaterThanOrEqual(R.x);
    expect(p.body.y).toBeGreaterThanOrEqual(R.y);
    expect(p.body.x + p.body.w).toBeLessThanOrEqual(R.x + R.w);
    expect(p.body.y + p.body.h).toBeLessThanOrEqual(R.y + R.h);
    expect(p.bevel).toBeGreaterThan(0);
  });

  it("gloss band hugs the TOP of the body and is at most half its height", () => {
    const p = battleCtaPlan(R);
    expect(p.gloss.x).toBeGreaterThanOrEqual(p.body.x);
    expect(p.gloss.x + p.gloss.w).toBeLessThanOrEqual(p.body.x + p.body.w);
    expect(p.gloss.y).toBeCloseTo(p.body.y, 0);
    expect(p.gloss.h).toBeLessThanOrEqual(p.body.h / 2);
  });

  it("emblem is anchored LEFT and the label is centered to its RIGHT", () => {
    const p = battleCtaPlan(R);
    expect(p.emblem.x).toBeLessThan(R.x + R.w / 2);
    expect(p.label.x).toBeGreaterThan(p.emblem.x);
    expect(p.emblem.size).toBeGreaterThan(0);
    expect(p.emblem.size).toBeLessThanOrEqual(R.h);
  });

  it("has four rivets, one inset into each corner of the body", () => {
    const p = battleCtaPlan(R);
    expect(p.rivets).toHaveLength(4);
    for (const rv of p.rivets) {
      expect(rv.x).toBeGreaterThan(p.body.x);
      expect(rv.x).toBeLessThan(p.body.x + p.body.w);
      expect(rv.y).toBeGreaterThan(p.body.y);
      expect(rv.y).toBeLessThan(p.body.y + p.body.h);
    }
    const xs = new Set(p.rivets.map((r) => Math.round(r.x)));
    const ys = new Set(p.rivets.map((r) => Math.round(r.y)));
    expect(xs.size).toBe(2); // two distinct columns
    expect(ys.size).toBe(2); // two distinct rows
  });

  it("sheen travel spans across (and slightly beyond) the full body width", () => {
    const p = battleCtaPlan(R);
    expect(p.sheen.x0).toBeLessThanOrEqual(p.body.x);
    expect(p.sheen.x1).toBeGreaterThanOrEqual(p.body.x + p.body.w);
    expect(p.sheen.w).toBeGreaterThan(0);
  });

  it("scales linearly with the rect (twice as wide ⇒ body twice as wide)", () => {
    const a = battleCtaPlan(R);
    const b = battleCtaPlan({ ...R, w: R.w * 2 });
    expect(b.body.w).toBeCloseTo(a.body.w + R.w, 0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/battleCta.test.ts`
Expected: FAIL — "battleCtaPlan is not a function" / cannot find module.

- [ ] **Step 3: Write minimal implementation**

```ts
/**
 * battleCta — pure, Phaser-free layered geometry for the home-screen BATTLE
 * hero call-to-action. Given the button rect, computes the body face (inset by
 * a forged-gold bevel), the top gloss band, four corner rivets, the left-anchored
 * combat emblem, the centered label anchor, and the diagonal sheen sweep travel.
 * Deterministic; the presenter (drawBattleCta in homeBarFx.ts) only paints this.
 * Unit-tested in tests/battleCta.test.ts. See
 * docs/superpowers/specs/2026-06-14-battle-cta-redesign-design.md.
 */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Pt {
  x: number;
  y: number;
}
export interface BattleCtaPlan {
  /** Thickness of the gold bevel lip framing the crimson body. */
  bevel: number;
  /** The crimson face, inset from the rect by `bevel`. */
  body: Rect;
  /** Soft white gloss band along the top of the body. */
  gloss: Rect;
  /** Four gold stud centers, inset into the body corners. */
  rivets: Pt[];
  /** Combat emblem box, anchored to the left of the body. */
  emblem: { x: number; y: number; size: number };
  /** Center anchor for the BATTLE label (text column right of the emblem). */
  label: Pt;
  /** Diagonal sheen sweep: a band of width `w` travelling x0→x1 at row `y`. */
  sheen: { x0: number; x1: number; y: number; w: number };
}

const BEVEL = 3;
const RIVET_INSET = 9;
const EMBLEM_PAD = 8;

/** Compute the full layered geometry of the BATTLE CTA from its outer rect. */
export function battleCtaPlan(r: Rect): BattleCtaPlan {
  const bevel = BEVEL;
  const body: Rect = {
    x: r.x + bevel,
    y: r.y + bevel,
    w: r.w - bevel * 2,
    h: r.h - bevel * 2,
  };
  const gloss: Rect = {
    x: body.x + 4,
    y: body.y,
    w: body.w - 8,
    h: Math.round(body.h * 0.42),
  };
  const rivets: Pt[] = [
    { x: body.x + RIVET_INSET, y: body.y + RIVET_INSET },
    { x: body.x + body.w - RIVET_INSET, y: body.y + RIVET_INSET },
    { x: body.x + RIVET_INSET, y: body.y + body.h - RIVET_INSET },
    { x: body.x + body.w - RIVET_INSET, y: body.y + body.h - RIVET_INSET },
  ];
  const size = Math.round(r.h * 0.78);
  const emblem = { x: body.x + EMBLEM_PAD + size / 2, y: r.y + r.h / 2, size };
  // Label is centered in the space to the RIGHT of the emblem column.
  const textLeft = emblem.x + size / 2;
  const label = { x: (textLeft + (body.x + body.w)) / 2, y: r.y + r.h / 2 };
  const sheen = { x0: body.x - body.h, x1: body.x + body.w + body.h, y: r.y + r.h / 2, w: body.h };
  return { bevel, body, gloss, rivets, emblem, label, sheen };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/battleCta.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/scenes/battleCta.ts tests/battleCta.test.ts
git commit -m "feat(home): pure layered geometry for BATTLE CTA (TDD)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Taller primary CTA in `homeLayout.ts` (prominence)

**Files:**
- Modify: `src/scenes/homeLayout.ts:59` (`PRIMARY_H`)
- Test: `tests/homeLayout.test.ts` (add a block)

- [ ] **Step 1: Write the failing test** — append to `tests/homeLayout.test.ts`

```ts
describe("homeNavLayout primary CTA prominence", () => {
  it("makes the primary CTA taller than the secondary bottom cells", () => {
    const l = homeNavLayout({ left: 4, right: 4, bottom: 3 }, W, H);
    const bottomH = l.bottom[0].h;
    expect(l.primary.h).toBeGreaterThan(bottomH);
    expect(l.primary.h).toBe(52);
  });
  it("grows the dock panel to fully contain the taller primary + the row", () => {
    const l = homeNavLayout({ left: 4, right: 4, bottom: 3 }, W, H);
    expect(l.primary.y).toBeGreaterThanOrEqual(l.panel.y);
    const lastBottom = l.bottom[l.bottom.length - 1];
    expect(lastBottom.y + lastBottom.h / 2).toBeLessThanOrEqual(l.panel.y + l.panel.h);
    expect(l.panel.y + l.panel.h).toBeLessThanOrEqual(H);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/homeLayout.test.ts`
Expected: FAIL — `expect(l.primary.h).toBe(52)` receives 42.

- [ ] **Step 3: Implement** — in `src/scenes/homeLayout.ts` change the constant:

```ts
const PRIMARY_H = 52;
```

(`panelH` already derives from `PRIMARY_H`, so the dock auto-grows. No other edit.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/homeLayout.test.ts`
Expected: PASS (all existing + 2 new).

- [ ] **Step 5: Commit**

```bash
git add src/scenes/homeLayout.ts tests/homeLayout.test.ts
git commit -m "feat(home): taller primary BATTLE CTA (42->52) for prominence

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: SDXL battle-emblem prompt + key + drift guard (TDD)

**Files:**
- Modify: `scripts/sdart/prompts.mjs` (after the achievement block, before `// ---- ITEMS`)
- Modify: `scripts/sdart/prompts.d.mts`
- Modify: `src/data/assetKeys.ts` (after `achievementTex`)
- Test: `tests/battleEmblemPrompt.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { battleEmblemTex } from "../src/data/assetKeys.ts";
import { BATTLE_EMBLEM_VISUAL, battleEmblemStyle } from "../scripts/sdart/prompts.mjs";

describe("battle-emblem prompt", () => {
  it("has a non-empty visual description", () => {
    expect(typeof BATTLE_EMBLEM_VISUAL).toBe("string");
    expect(BATTLE_EMBLEM_VISUAL.trim().length).toBeGreaterThan(0);
  });
  it("injects the visual into the style template", () => {
    const s = battleEmblemStyle(BATTLE_EMBLEM_VISUAL);
    expect(s).toContain(BATTLE_EMBLEM_VISUAL);
    expect(s.toLowerCase()).toContain("white background");
  });
});

describe("battleEmblemTex key builder", () => {
  it("namespaces the emblem under ui__", () => {
    expect(battleEmblemTex()).toBe("ui__battle-emblem");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/battleEmblemPrompt.test.ts`
Expected: FAIL — `battleEmblemTex` / `BATTLE_EMBLEM_VISUAL` not exported.

- [ ] **Step 3a: Implement the key builder** — in `src/data/assetKeys.ts` after the `achievementTex` line:

```ts
/** Combat emblem rendered on the home-screen BATTLE call-to-action (single icon). */
export const battleEmblemTex = (): string => `ui__battle-emblem`;
```

- [ ] **Step 3b: Implement the prompt** — in `scripts/sdart/prompts.mjs`, insert after the `achievementIconStyle` function (line ~332), before `// ---- ITEMS (icon style) ----`:

```js
// ---- BATTLE CTA EMBLEM (home-screen hero call-to-action) ----
// One bold combat sigil rendered on the BATTLE button. Full-colour, NOT tinted.
export const BATTLE_EMBLEM_VISUAL =
  "two crossed steel longswords over a small round war shield, a single upright orange flame rising behind the blades";
const BATTLE_EMBLEM_STYLE =
  "a single bold flat vector game UI emblem icon of {V}, ONE compact heraldic crest, very thick uniform clean gold outline, fiery crimson and ember orange with steel accents, high contrast, flat cel-shaded, centered, instantly readable at 24 pixels, isolated on a pure plain flat white background, empty background, no text";
const BATTLE_EMBLEM_NEG =
  "character, person, creature, hero, knight figure, full body, anime girl, realistic, 3d render, photo, complex scene, landscape, multiple objects, busy, gradient background, drop shadow, watermark, text, letters, signature, frame, border";
export const BATTLE_EMBLEM_NEGATIVE = BATTLE_EMBLEM_NEG;
/** Combat-emblem prompt from a visual description. */
export function battleEmblemStyle(visual) {
  return BATTLE_EMBLEM_STYLE.replace("{V}", visual);
}
```

- [ ] **Step 3c: Declare the exports** — in `scripts/sdart/prompts.d.mts`, after the `achievementIconStyle` declaration:

```ts
export const BATTLE_EMBLEM_VISUAL: string;
export const BATTLE_EMBLEM_NEGATIVE: string;
export function battleEmblemStyle(visual: string): string;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/battleEmblemPrompt.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/sdart/prompts.mjs scripts/sdart/prompts.d.mts src/data/assetKeys.ts tests/battleEmblemPrompt.test.ts
git commit -m "feat(art): SDXL battle-emblem prompt + ui__battle-emblem key (TDD)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Wire the emblem into the SDXL generator + PreloadScene

**Files:**
- Modify: `scripts/sdart/sdgen.mjs` (imports + a job in `buildJobs`)
- Modify: `src/scenes/PreloadScene.ts` (import + one `load.image`)

- [ ] **Step 1: Add the import** — in `scripts/sdart/sdgen.mjs`, find the existing import of prompt helpers (the line importing `ACHIEVEMENT_VISUAL, achievementIconStyle, ACHIEVEMENT_NEGATIVE`) and add the three new names:

```js
  BATTLE_EMBLEM_VISUAL,
  battleEmblemStyle,
  BATTLE_EMBLEM_NEGATIVE,
```

- [ ] **Step 2: Add the job** — in `buildJobs()`, immediately AFTER the achievement-medallion `for` loop (ends ~line 224) and before the items loop, add:

```js
  // battle CTA emblem — one bold combat crest, transparent-cut to 96px, in ui/.
  jobs.push({
    kind: "ui",
    id: "battle-emblem",
    file: `battle-emblem.png`,
    prompt: battleEmblemStyle(BATTLE_EMBLEM_VISUAL),
    seed: seedOf("battle-emblem"),
    w: 768,
    h: 768,
    size: 96,
    neg: BATTLE_EMBLEM_NEGATIVE,
  });
```

- [ ] **Step 3: Load it in PreloadScene** — in `src/scenes/PreloadScene.ts`, add `battleEmblemTex` to the existing `assetKeys` import (next to `roleTex, achievementTex`), then immediately AFTER the `for (const a of ACHIEVEMENTS)` load loop (ends ~line 116) add:

```ts
    this.load.image(battleEmblemTex(), versioned(`assets/sprites/ui/battle-emblem.png`));
```

- [ ] **Step 4: Typecheck (no runtime test — generation happens in Task 6)**

Run: `npx tsc --noEmit`
Expected: PASS (no type errors).

- [ ] **Step 5: Commit**

```bash
git add scripts/sdart/sdgen.mjs src/scenes/PreloadScene.ts
git commit -m "feat(art): wire battle emblem into sdgen + PreloadScene load

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Presenter `drawBattleCta` + swap call-site

**Files:**
- Modify: `src/scenes/homeBarFx.ts` (replace `drawPrimaryButton` with `drawBattleCta`)
- Modify: `src/scenes/MainMenuScene.ts:16-17,286` (import + call-site)

> Note: keep `homeBarFx.ts` under the 500-line ESLint cap. The current file is ~92 lines; the new presenter (~70 lines) keeps it well under. If it ever approaches the cap, move the presenter to a new `battleCtaFx.ts`.

- [ ] **Step 1: Replace the presenter** — in `src/scenes/homeBarFx.ts`, update the import line and replace the whole `drawPrimaryButton` function with `drawBattleCta`:

Add to the imports at the top:

```ts
import { battleCtaPlan } from "./battleCta.ts";
import { battleEmblemTex } from "../data/assetKeys.ts";
```

Replace `drawPrimaryButton` (the entire function) with:

```ts
/** The wide crimson-ember war CTA: layered forged-metal button + combat emblem
 *  + sheen sweep that launches `targetScene`. Geometry from battleCtaPlan. */
export function drawBattleCta(
  scene: Phaser.Scene,
  label: string,
  targetScene: string,
  r: Rect,
): void {
  const cx = r.x + r.w / 2,
    cy = r.y + r.h / 2;
  const p = battleCtaPlan(r);
  const c = scene.add.container(cx, cy).setDepth(9);
  // Local-space helper: plan coords are absolute; the container is centered, so
  // subtract the center to place children.
  const lx = (x: number) => x - cx;
  const ly = (y: number) => y - cy;

  const g = scene.add.graphics();
  // Drop shadow.
  g.fillStyle(0x000000, 0.35).fillRoundedRect(lx(r.x) + 2, ly(r.y) + 4, r.w, r.h, 12);
  // Forged-gold bevel frame.
  g.fillStyle(0x7a4b12, 1).fillRoundedRect(lx(r.x), ly(r.y), r.w, r.h, 12);
  g.lineStyle(2, 0xffe9a8, 1).strokeRoundedRect(lx(r.x), ly(r.y), r.w, r.h, 12);
  // Crimson→ember body (two stacked tones read as a vertical gradient).
  g.fillStyle(0x7a1410, 1).fillRoundedRect(lx(p.body.x), ly(p.body.y), p.body.w, p.body.h, 9);
  g.fillStyle(0xe0461f, 1).fillRoundedRect(
    lx(p.body.x),
    ly(p.body.y),
    p.body.w,
    p.body.h - 5,
    9,
  );
  // Top gloss band.
  g.fillStyle(0xffffff, 0.16).fillRoundedRect(lx(p.gloss.x), ly(p.gloss.y), p.gloss.w, p.gloss.h, 8);
  // Corner rivets.
  for (const rv of p.rivets) {
    g.fillStyle(0xffe9a8, 1).fillCircle(lx(rv.x), ly(rv.y), 2.4);
    g.fillStyle(0x7a4b12, 1).fillCircle(lx(rv.x), ly(rv.y), 1.1);
  }
  c.add(g);

  // SDXL combat emblem (left), gated so a missing PNG degrades gracefully.
  const ek = battleEmblemTex();
  if (scene.textures.exists(ek)) {
    const img = scene.add.image(lx(p.emblem.x), ly(p.emblem.y), ek).setDisplaySize(
      p.emblem.size,
      p.emblem.size,
    );
    c.add(img);
  }

  c.add(
    crispText(scene, lx(p.label.x), ly(p.label.y), label, {
      fontSize: "24px",
      color: "#fff4e0",
      fontStyle: "bold",
      stroke: "#3a0a06",
      strokeThickness: 4,
    }).setOrigin(0.5),
  );

  // Sheen sweep: a thin bright diagonal band travelling across the body, clipped
  // to the body rect via a geometry mask.
  const sheen = scene.add.graphics().setDepth(10);
  sheen.fillStyle(0xffffff, 0.22);
  sheen.fillRect(-p.sheen.w / 2, -r.h, p.sheen.w, r.h * 2);
  sheen.setRotation(-0.5);
  c.add(sheen);
  const maskG = scene.make
    .graphics({ x: 0, y: 0 })
    .fillStyle(0xffffff)
    .fillRoundedRect(p.body.x, p.body.y, p.body.w, p.body.h, 9);
  sheen.setMask(maskG.createGeometryMask());
  sheen.x = lx(p.sheen.x0);
  scene.tweens.add({
    targets: sheen,
    x: lx(p.sheen.x1),
    duration: 900,
    ease: "Sine.easeInOut",
    repeat: -1,
    repeatDelay: 1600,
  });

  const z = scene.add.zone(0, 0, r.w, r.h).setInteractive({ useHandCursor: true });
  c.add(z);
  z.on("pointerover", () =>
    scene.tweens.add({ targets: c, scale: 1.05, duration: 130, ease: "Back.easeOut" }),
  );
  z.on("pointerout", () =>
    scene.tweens.add({ targets: c, scale: 1, duration: 130, ease: "Sine.easeOut" }),
  );
  z.on("pointerdown", () =>
    scene.tweens.add({
      targets: c,
      scale: 0.95,
      duration: 80,
      yoyo: true,
      onComplete: () => fadeToScene(scene, targetScene),
    }),
  );
}
```

- [ ] **Step 2: Swap the call-site** — in `src/scenes/MainMenuScene.ts`:

Line 17 import — change:

```ts
import { drawPill, drawPrimaryButton } from "./homeBarFx.ts";
```

to:

```ts
import { drawPill, drawBattleCta } from "./homeBarFx.ts";
```

Line 286 — change:

```ts
    drawPrimaryButton(this, PRIMARY_ITEM.label, PRIMARY_ITEM.scene, lay.primary);
```

to:

```ts
    drawBattleCta(this, PRIMARY_ITEM.label, PRIMARY_ITEM.scene, lay.primary);
```

- [ ] **Step 3: Verify compile + no dangling references**

Run: `npx tsc --noEmit && grep -rn "drawPrimaryButton" src/`
Expected: tsc PASS; grep returns NOTHING (no stale references).

- [ ] **Step 4: Run the full suite + lint**

Run: `npx vitest run && npx eslint src/scenes/homeBarFx.ts src/scenes/battleCta.ts`
Expected: all tests PASS; eslint clean (file under 500 lines).

- [ ] **Step 5: Commit**

```bash
git add src/scenes/homeBarFx.ts src/scenes/MainMenuScene.ts
git commit -m "feat(home): paint crimson-ember BATTLE CTA with emblem + sheen

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Generate the emblem art + bump ASSET_VERSION

**Files:**
- Create: `public/assets/sprites/ui/battle-emblem.png` (generated)
- Modify: `src/data/assetVersion.ts` (`ASSET_VERSION`)

- [ ] **Step 1: Generate the emblem** (SD server on :8765 must be up)

Run: `npm run gen:sprites -- --only=ui`
Expected: console prints `[1/1] ui/battle-emblem.png`, `done`. A 96×96 transparent PNG appears at `public/assets/sprites/ui/battle-emblem.png`.

- [ ] **Step 2: Verify the PNG exists and is 96×96**

Run: `node -e "const{PNG}=require('pngjs');const fs=require('fs');const p=PNG.sync.read(fs.readFileSync('public/assets/sprites/ui/battle-emblem.png'));console.log(p.width+'x'+p.height)"` (or `file public/assets/sprites/ui/battle-emblem.png`)
Expected: `96x96`.

- [ ] **Step 3: Bump ASSET_VERSION** — in `src/data/assetVersion.ts` change the token (art was regenerated):

```ts
export const ASSET_VERSION = "2026-06-14h";
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: build succeeds; the new PNG is copied into `dist/`.

- [ ] **Step 5: Commit**

```bash
git add public/assets/sprites/ui/battle-emblem.png src/data/assetVersion.ts
git commit -m "feat(art): generate battle-emblem PNG + bump ASSET_VERSION

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Live CDP repro + verify whole + ship

**Files:**
- Create: `scripts/playtest/repro_battle_cta.mjs`

- [ ] **Step 1: Write the repro** (mirror `scripts/playtest/repro_achievement_icons.mjs`)

```js
// Battle-CTA repro: opens MainMenuScene, asserts the emblem texture loaded and
// the CTA container carries the layered button parts, then screenshots it.
//   node scripts/playtest/repro_battle_cta.mjs [--port=4188] [--shot=/tmp/x.png]
const arg = (n, d) => {
  const h = process.argv.find((a) => a.startsWith(`--${n}=`));
  return h ? h.split("=").slice(1).join("=") : d;
};
const PORT = arg("port", "4188");
const SHOT = arg("shot", "/tmp/battle_cta.png");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const t = await (
    await fetch(`http://localhost:9222/json/new?${encodeURIComponent(`http://localhost:${PORT}/?debug`)}`, {
      method: "PUT",
    })
  ).json();
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  let id = 0;
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = rej;
  });
  const rpc = (method, params = {}) =>
    new Promise((res) => {
      const myId = ++id;
      const onMsg = (ev) => {
        const m = JSON.parse(ev.data);
        if (m.id === myId) {
          ws.removeEventListener("message", onMsg);
          res(m.result);
        }
      };
      ws.addEventListener("message", onMsg);
      ws.send(JSON.stringify({ id: myId, method, params }));
    });
  const evalJs = async (expr) => {
    const r = await rpc("Runtime.evaluate", {
      expression: `(async()=>{${expr}})()`,
      returnByValue: true,
      awaitPromise: true,
    });
    if (r.exceptionDetails) console.log("  EXC:", r.exceptionDetails.text, r.result?.description || "");
    return r.result?.value;
  };
  await rpc("Page.enable");
  await rpc("Runtime.enable");
  await rpc("Emulation.setDeviceMetricsOverride", { width: 960, height: 540, deviceScaleFactor: 2, mobile: false });
  await rpc("Page.navigate", { url: `http://localhost:${PORT}/?debug` });
  await wait(500);
  let ready = false;
  for (let i = 0; i < 40; i++) {
    ready = await evalJs(`return !!(window.__game && window.__game.scene);`);
    if (ready) break;
    await wait(500);
  }
  console.log("game ready:", ready);

  let texLoaded = false;
  for (let i = 0; i < 30; i++) {
    texLoaded = await evalJs(`return window.__game.textures.exists('ui__battle-emblem');`);
    if (texLoaded) break;
    await wait(500);
  }
  console.log("battle-emblem texture loaded:", texLoaded);

  await evalJs(`window.__game.scene.start("MainMenuScene"); return "started";`);
  await wait(1200);

  const report = JSON.parse(
    await evalJs(`const s=window.__game.scene.getScene("MainMenuScene");
      // The CTA is the only container holding the ui__battle-emblem image.
      const conts=s.children.list.filter(o=>o.type==='Container');
      let hit=null;
      for(const c of conts){
        const hasEmblem=c.list && c.list.some(o=>o.texture && o.texture.key==='ui__battle-emblem');
        if(hasEmblem){ hit=c; break; }
      }
      const parts = hit ? hit.list.map(o=>o.type) : [];
      return JSON.stringify({
        foundCta: !!hit,
        hasGraphics: parts.includes('Graphics'),
        hasImage: parts.includes('Image'),
        hasText: parts.includes('Text'),
        hasZone: parts.includes('Zone'),
      });`),
  );
  console.log("CTA report:", report);

  const shot = await rpc("Page.captureScreenshot", { format: "png" });
  if (shot?.data) {
    const { writeFileSync } = await import("node:fs");
    writeFileSync(SHOT, Buffer.from(shot.data, "base64"));
    console.log("shot:", SHOT);
  }

  const ok = texLoaded && report.foundCta && report.hasGraphics && report.hasImage && report.hasText && report.hasZone;
  console.log(ok ? "VERDICT: PASS" : "VERDICT: FAIL");
  ws.close();
  process.exit(ok ? 0 : 1);
}
main().catch((e) => {
  console.error(e);
  process.exit(2);
});
```

- [ ] **Step 2: Run the repro** (start a dev server + headless Chrome as separate background processes, then run)

```bash
# dev server (imports /src) on 4188 + headless chrome on 9222, both backgrounded
npx vite --port 4188 &   # run_in_background
"$(command -v google-chrome || command -v chromium)" --headless=new --remote-debugging-port=9222 --no-sandbox about:blank &  # run_in_background
sleep 3
node scripts/playtest/repro_battle_cta.mjs --shot=/tmp/battle_cta.png
```

Expected: `battle-emblem texture loaded: true`, `foundCta:true` with Graphics+Image+Text+Zone all true, `VERDICT: PASS`.

- [ ] **Step 3: Eyeball the screenshot** — Read `/tmp/battle_cta.png`. Confirm the BATTLE button is a crimson-ember forged button with the gold bevel, corner rivets, the combat emblem on the left, the ivory BATTLE label, and that it stands out from the gold pills/backdrop. If it looks wrong, fix the presenter and re-run.

- [ ] **Step 4: Full verification gate**

Run: `npx tsc --noEmit && npx vitest run && npx eslint src/ && npm run build`
Expected: all PASS (tsc clean, full suite green, eslint clean, build succeeds).

- [ ] **Step 5: Commit the repro, then deploy + push**

```bash
git add scripts/playtest/repro_battle_cta.mjs
git commit -m "test(home): live CDP repro for redesigned BATTLE CTA

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
git push origin main
npx firebase-tools deploy --only hosting
```

Expected: push succeeds; `Deploy complete!` printed; live at https://wibu-tower-defense-d8b1c.web.app.

- [ ] **Step 6: Update memory** — write `memory/project_battle_cta.md` (the redesigned hero CTA) and add one index line to `memory/MEMORY.md`. Send before/after screenshots to chat via `[[send: /tmp/battle_cta.png]]`.

---

## Self-Review Notes

- **Spec coverage:** hue shift + layered depth (Task 1 geometry + Task 5 paint), SDXL emblem (Tasks 3/4/6), sheen sweep (Task 5), prominence height bump (Task 2), tests/drift/repro (Tasks 1/2/3/7), ASSET_VERSION bump + deploy (Tasks 6/7). All spec sections map to a task.
- **Type consistency:** `battleCtaPlan`/`BattleCtaPlan` (Task 1) consumed in Task 5; `battleEmblemTex()` (Task 3) used in Tasks 4 & 5; `battleEmblemStyle`/`BATTLE_EMBLEM_VISUAL`/`BATTLE_EMBLEM_NEGATIVE` (Task 3) imported in Task 4; `kind:"ui"` dir ↔ `ui__battle-emblem` key ↔ `assets/sprites/ui/battle-emblem.png` path all agree.
- **No placeholders:** every code step shows complete code.
