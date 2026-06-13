# UI Smoothness Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the game UI feel smoother — crossfade battle transitions, animate modal exits, and standardize hover/press feedback — via shared helpers, render-layer only.

**Architecture:** One new pure module (`uiMotion.ts`, TDD'd) holds the stagger-delay math; `uiKit.ts` gains presenters (`popOut`/`closeModal`/`staggerIn`/`interactive`) that consume it; call sites adopt them. BattleScene **simulation is untouched**.

**Tech Stack:** Phaser 3.90, TypeScript, Vitest, ESLint (max-lines 500), Prettier, madge.

Spec: `docs/superpowers/specs/2026-06-13-ui-smoothness-pass-design.md`

---

### Task 1: Pure `uiMotion.ts` — stagger-delay math (TDD)

**Files:**
- Create: `src/scenes/uiMotion.ts`
- Test: `tests/uiMotion.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { staggerDelays, MOTION } from "../src/scenes/uiMotion.ts";

describe("staggerDelays", () => {
  it("returns [] for non-positive counts", () => {
    expect(staggerDelays(0)).toEqual([]);
    expect(staggerDelays(-3)).toEqual([]);
  });

  it("returns a single 'from' delay for count 1", () => {
    expect(staggerDelays(1, { from: 50 })).toEqual([50]);
  });

  it("uses exact i*step spacing when under the cap", () => {
    expect(staggerDelays(4, { step: 40, maxTotal: 360, from: 0 })).toEqual([0, 40, 80, 120]);
  });

  it("offsets every delay by 'from'", () => {
    expect(staggerDelays(3, { step: 20, from: 100 })).toEqual([100, 120, 140]);
  });

  it("is non-decreasing and clamps the last delay to from+maxTotal for large counts", () => {
    const d = staggerDelays(50, { step: 40, maxTotal: 360, from: 0 });
    expect(d).toHaveLength(50);
    expect(d[0]).toBe(0);
    for (let i = 1; i < d.length; i++) expect(d[i]).toBeGreaterThanOrEqual(d[i - 1]);
    expect(d[d.length - 1]).toBeLessThanOrEqual(360);
  });

  it("exposes motion-timing tokens", () => {
    expect(MOTION.popOut).toBeGreaterThan(0);
    expect(MOTION.stagger).toBeGreaterThan(0);
    expect(MOTION.staggerMax).toBeGreaterThanOrEqual(MOTION.stagger);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/uiMotion.test.ts`
Expected: FAIL — cannot find module `../src/scenes/uiMotion.ts`.

- [ ] **Step 3: Write minimal implementation**

```ts
/**
 * uiMotion — pure, Phaser-free motion math + shared timing tokens for the UI
 * smoothness layer. Kept dependency-free so it is unit-testable; the Phaser
 * presenters that consume it live in uiKit.ts.
 */

/** Shared motion-timing tokens (ms). */
export const MOTION = { popOut: 160, stagger: 40, staggerMax: 360 } as const;

export interface StaggerOpts {
  /** Ideal ms between consecutive items (default MOTION.stagger). */
  step?: number;
  /** Cap on the LAST item's delay (default MOTION.staggerMax). */
  maxTotal?: number;
  /** Delay before the first item (default 0). */
  from?: number;
}

/**
 * Per-index entrance delays (ms). When `(count-1)*step` would exceed `maxTotal`
 * the step is compressed so the last item still starts by `from + maxTotal`, so
 * a large grid assembles quickly instead of trickling in for seconds.
 */
export function staggerDelays(count: number, opts: StaggerOpts = {}): number[] {
  if (count <= 0) return [];
  const { step = MOTION.stagger, maxTotal = MOTION.staggerMax, from = 0 } = opts;
  if (count === 1) return [from];
  const span = (count - 1) * step;
  const effStep = span <= maxTotal ? step : maxTotal / (count - 1);
  return Array.from({ length: count }, (_, i) => from + i * effStep);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/uiMotion.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/scenes/uiMotion.ts tests/uiMotion.test.ts
git commit -m "feat(ui): pure staggerDelays motion math + timing tokens (TDD)"
```

---

### Task 2: `uiKit.ts` presenters — popOut / closeModal / staggerIn / interactive

**Files:**
- Modify: `src/scenes/uiKit.ts`

- [ ] **Step 1: Import the pure module**

At the top of `uiKit.ts`, after the `crispText` import, add:

```ts
import { MOTION, staggerDelays, type StaggerOpts } from "./uiMotion.ts";
```

- [ ] **Step 2: Add `interactive()` and refactor `button()` to use it**

Add this helper (place it just above `button`):

```ts
export interface InteractiveOpts {
  hoverScale?: number;
  pressScale?: number;
}

/**
 * Attach the standard 5-pointer-event feedback (hover-pop, press-dip, click on
 * release) to any transform-bearing object. The single source of UI button
 * feel. Object must already be setInteractive()-d by the caller, OR pass a Text
 * (button() does this for us). Returns the object.
 */
export function interactive<T extends Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform>(
  scene: Phaser.Scene,
  obj: T,
  onClick: () => void,
  opts: InteractiveOpts = {},
): T {
  const base = obj.scaleX || 1;
  const hover = base * (opts.hoverScale ?? 1.06);
  const press = base * (opts.pressScale ?? 0.94);
  obj.on("pointerover", () =>
    scene.tweens.add({ targets: obj, scale: hover, duration: DUR.btn, ease: "Back.easeOut" }),
  );
  obj.on("pointerout", () =>
    scene.tweens.add({ targets: obj, scale: base, duration: DUR.btn, ease: "Sine.easeOut" }),
  );
  obj.on("pointerdown", () =>
    scene.tweens.add({
      targets: obj,
      scale: press,
      duration: 70,
      yoyo: true,
      onComplete: () => onClick(),
    }),
  );
  return obj;
}
```

Then replace the body of `button()` (the three inline `t.on(...)` handlers) with a single delegation. The new `button()` reads:

```ts
export function button(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  opts: ButtonOpts = {},
): Phaser.GameObjects.Text {
  const t = crispText(scene, x, y, label, {
    fontSize: opts.fontSize ?? "18px",
    color: opts.color ?? "#ffffff",
    backgroundColor: opts.bg ?? "#223355",
    fixedWidth: opts.width ?? 260,
    align: "center",
  })
    .setOrigin(0.5)
    .setPadding(0, 11, 0, 11)
    .setInteractive({ useHandCursor: true });
  return interactive(scene, t, onClick);
}
```

- [ ] **Step 3: Add `popOut()` and `closeModal()`**

Add just below `popIn()`:

```ts
/** Pop a container/image OUT (reverse of popIn), then run onDone (e.g. destroy). */
export function popOut(
  scene: Phaser.Scene,
  obj: Phaser.GameObjects.Container | Phaser.GameObjects.Image,
  onDone?: () => void,
): void {
  scene.tweens.add({
    targets: obj,
    scale: (obj.scaleX || 1) * 0.9,
    alpha: 0,
    duration: MOTION.popOut,
    ease: "Quad.easeIn",
    onComplete: () => onDone?.(),
  });
}

/**
 * Standard modal close: animate the container out, then destroy it (idempotent —
 * a second call while closing is ignored). Runs onDone after destroy.
 */
export function closeModal(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  onDone?: () => void,
): void {
  const c = container as Phaser.GameObjects.Container & { _closing?: boolean };
  if (c._closing) return;
  c._closing = true;
  popOut(scene, container, () => {
    container.destroy();
    onDone?.();
  });
}
```

- [ ] **Step 4: Add `staggerIn()`**

Add below `closeModal()`:

```ts
/**
 * Entrance-stagger a set of already-placed objects: each slides up 8px + fades
 * in on a clamped schedule (see uiMotion.staggerDelays), so a list/grid
 * assembles smoothly without a long trickle. Objects keep their final y/alpha.
 */
export function staggerIn(
  scene: Phaser.Scene,
  objects: (Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform & Phaser.GameObjects.Components.Alpha)[],
  opts: StaggerOpts = {},
): void {
  const delays = staggerDelays(objects.length, opts);
  objects.forEach((o, i) => {
    const finalY = o.y;
    const finalA = o.alpha;
    o.y = finalY + 8;
    o.alpha = 0;
    scene.tweens.add({
      targets: o,
      y: finalY,
      alpha: finalA,
      delay: delays[i],
      duration: 220,
      ease: "Quad.easeOut",
    });
  });
}
```

- [ ] **Step 5: Typecheck + lint + format**

Run: `npx tsc --noEmit && npx eslint src/scenes/uiKit.ts src/scenes/uiMotion.ts && npx prettier --check src/scenes/uiKit.ts src/scenes/uiMotion.ts`
Expected: clean (0 errors; prettier may require `--write` — run it if so). Confirm `uiKit.ts` is still < 500 lines: `wc -l src/scenes/uiKit.ts`.

- [ ] **Step 6: Run the full suite (button refactor must not regress)**

Run: `npx vitest run`
Expected: all pass (1060 + 6 new = 1066).

- [ ] **Step 7: Commit**

```bash
git add src/scenes/uiKit.ts
git commit -m "feat(ui): popOut/closeModal/staggerIn + interactive() feedback helper"
```

---

### Task 3: Battle crossfades

**Files:**
- Modify: `src/scenes/StageSelectScene.ts:405`
- Modify: `src/scenes/battleSceneRender.ts` (import + line 117)
- Modify: `src/scenes/BattleScene.ts` (create(), ~line 143 + import)

- [ ] **Step 1: StageSelect → Battle crossfade**

In `StageSelectScene.ts`, `launchStage()` line 405, replace:

```ts
    this.scene.start("BattleScene");
```

with:

```ts
    fadeToScene(this, "BattleScene");
```

(`fadeToScene` is already imported in this file — confirm with `grep "fadeToScene" src/scenes/StageSelectScene.ts`.)

- [ ] **Step 2: Battle → Menu crossfade**

In `battleSceneRender.ts`, add `fadeToScene` to the `./ui.ts`-adjacent imports — insert after line 19 (`import { crispText } from "./ui.ts";`):

```ts
import { fadeToScene } from "./uiKit.ts";
```

Then at line 117 replace:

```ts
      this._menuBtn.on("pointerdown", () => this.scene.start("MainMenuScene"));
```

with:

```ts
      this._menuBtn.on("pointerdown", () => fadeToScene(this, "MainMenuScene"));
```

- [ ] **Step 3: Fade battle IN on entry**

In `BattleScene.ts`, add the import near the other `./ui`/scene imports:

```ts
import { fadeIn } from "./uiKit.ts";
```

(If a `from "./uiKit.ts"` import already exists, add `fadeIn` to it instead.) Then in `create()`, as the LAST statement of the method (after the scene is fully built), add:

```ts
    fadeIn(this);
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/scenes/StageSelectScene.ts src/scenes/battleSceneRender.ts src/scenes/BattleScene.ts
git commit -m "feat(ui): crossfade battle entry/exit (no more hard cuts)"
```

---

### Task 4: Bounded adoption — modal exits + un-animated scenes

**Files (modify):** `src/scenes/itemEnhanceDialog.ts`, `src/scenes/itemCompareDialog.ts`, the Smelt confirm in `shopScene*.ts`, `src/scenes/uiKit.ts` (dimBackdrop), `src/scenes/SettingsScene.ts`, `src/scenes/SquadScene.ts`, `src/scenes/HeroScene.ts`.

> Adoption is "where it is a direct substitution." For each file: find the modal-close path (a `container.destroy()` after a tap/cancel) and route it through `closeModal(scene, container)`. If a scene's hover/close is entangled with custom state that `interactive`/`closeModal` can't express cleanly, LEAVE IT and note it in the commit body. Do not force-fit.

- [ ] **Step 1: dimBackdrop note (no code change required)**

`dimBackdrop` only adds the dim+zone to a container; the caller owns dismissal. Leave `dimBackdrop` as-is; adopt `closeModal` in the callers' dismiss handlers (next steps). Confirm by reading each dialog's `onDismiss`.

- [ ] **Step 2: itemEnhanceDialog close → closeModal**

Read `src/scenes/itemEnhanceDialog.ts`. Find where the dialog container is destroyed on cancel/scrim/confirm-complete (e.g. `container.destroy()` or an `onClose()` that destroys). Replace the destroy with `closeModal(scene, container, onClose?)`. Import `closeModal` from `./uiKit.ts` if not already imported. Keep any post-close callback as the `onDone` arg.

- [ ] **Step 3: itemCompareDialog close → closeModal**

Same treatment as Step 2 for `src/scenes/itemCompareDialog.ts`.

- [ ] **Step 4: Smelt confirm dialog close → closeModal**

Locate the Smelt/auto-recycle confirm dialog (grep `openAutoRecycle\|Smelt\|confirm` under `src/scenes/shopScene*.ts` / `ShopScene.ts`). Route its cancel/confirm container teardown through `closeModal`.

- [ ] **Step 5: Settings / Squad / Hero entrance polish**

For each of `SettingsScene.ts`, `SquadScene.ts`, `HeroScene.ts`:
- Ensure `create()` calls `fadeIn(this)` (import from `./uiKit.ts`; add if missing).
- Collect the scene's primary row/tile objects into an array as they are built and call `staggerIn(this, rows)` once at the end of `create()`. Only include top-level rows/tiles (not deep children) to avoid layout fights.
- Where a button uses a hand-rolled `pointerover setAlpha` AND has a plain click, and it is a clean substitution, replace with `interactive(this, obj, onClick)`. Otherwise leave it.

> Keep each file < 500 lines (`wc -l`). If adding stagger collection pushes a file over, extract the row-build into a helper module instead.

- [ ] **Step 6: Typecheck + lint + format + full suite**

Run: `npx tsc --noEmit && npx eslint src && npx vitest run && npx prettier --check src`
Expected: clean; all tests pass. Run `npx prettier --write` on any file it flags.

- [ ] **Step 7: Commit**

```bash
git add -A src/scenes
git commit -m "feat(ui): animate modal exits + entrance stagger for settings/squad/hero"
```

---

### Task 5: Verify whole + playtest + memory

- [ ] **Step 1: Full gauntlet**

Run, expecting all green:
```bash
npx tsc --noEmit
npx vitest run
npx eslint src        # max-lines 500 included
npx prettier --check src
npx madge --circular --extensions ts src/main.ts   # 0 runtime cycles
npm run build
```

- [ ] **Step 2: CDP playtest — crossfades + modal**

Build, start `npx vite preview --port 4188 --strictPort &` and headless Chrome with WebGL (`--use-gl=angle --use-angle=vulkan --enable-unsafe-swiftshader`), verify `window.__game.renderer.type === 2`. Drive: MainMenu → StageSelect → Battle → Return to Menu, capturing a screenshot mid-fade and after. Open one modal (e.g. an inventory enhance/compare) and close it. Assert PAGE ERRORS is empty. Kill `vite preview` with the `[v]ite` bracket trick + Chrome.

- [ ] **Step 3: Update memory**

Add a `project` memory note (and MEMORY.md pointer) describing the shared smoothness layer: `uiMotion.ts` (pure staggerDelays + MOTION tokens) → `uiKit.ts` presenters (`popOut`/`closeModal`/`staggerIn`/`interactive`, `button()` delegates to `interactive`); battle entry/exit now crossfade; modal closes animate; BitmapText HUD migration deferred. Link `[[project_menu_backdrop]]`, `[[project_fixed_timestep]]`, `[[reference_playtest_and_art]]`.

- [ ] **Step 4: Final report** — summarize research → design → implementation, verification results, and the deferred BitmapText work. Attach a crossfade screenshot via `[[send: …]]`.

---

## Self-review

- **Spec coverage:** Goal 1 (battle crossfades) → T3; Goal 2 (modal exits) → T2 `closeModal` + T4 adoption; Goal 3 (reusable feedback) → T2 `interactive` + T4 adoption; Goal 4 (entrance stagger) → T1 math + T2 `staggerIn` + T4 adoption. Non-goals (no sim change, no BitmapText, file<500) are called out in T3/T4/T5. ✓
- **Placeholders:** none — every code step shows the code; T4 is intentionally discovery-driven but bounded with an explicit "direct substitution only, else leave it" rule. ✓
- **Type consistency:** `staggerDelays`/`StaggerOpts`/`MOTION` defined in T1 and consumed with matching names in T2; `interactive`/`popOut`/`closeModal`/`staggerIn` signatures defined in T2 and used in T3/T4. ✓
