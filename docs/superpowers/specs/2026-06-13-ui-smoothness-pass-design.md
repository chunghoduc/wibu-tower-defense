# UI Smoothness Pass — Design Spec

**Date:** 2026-06-13
**Status:** Approved (self-approved under standing FULL-AUTO delegation)
**Topic:** Make the game UI look/feel smoother and more polished, grounded in a
deep-research sweep of Phaser 3.90 best practices.

## Background / research grounding

A deep-research workflow (24 confirmed findings, 1 refuted) surveyed Phaser
3.60+ UI-smoothness techniques. Project is on **Phaser 3.90.0** with
`pixelArt: true`, which already forces `roundPixels: true` and
`antialias: false` — so the **foundational crispness levers are already
correct** (`crispText` supersamples per-Text via `setResolution(3–4)` +
LINEAR). The remaining wins are in **motion, transitions, and feedback**, not
render config. Confirmed, actionable findings we lean on:

- Drive scene transitions with `camera.fadeOut(d,r,g,b)` and start the next
  scene only inside `once(FADE_OUT_COMPLETE, …)` to avoid an abrupt cut. The
  shared `fadeToScene`/`fadeIn` in `uiKit.ts` already do exactly this.
- Sequence multi-step UI motion with named easings; `Back.easeOut` for
  pop/entrance, `Quad/Cubic.easeOut` for slides/exits, `Sine` for pulses.
- Wire button feedback through the five pointer events
  (`pointerover/out/down/up/move`) — only after `setInteractive()`.
- BitmapText is the "correct" choice for frequently-updating counters (a `Text`
  re-uploads its GPU texture on every content change). **Deferred** (see
  Non-goals): needs a bitmap-font asset and `tweenCount` already smooths the
  displayed value.
- Refuted and therefore NOT used as justification: "a 5ms GC pause causes a
  visible stutter." Pooling discipline still stands directionally (we keep the
  existing `FxPool`); no new pooling work in this pass.

## Goals

1. Eliminate the two remaining **hard-cut** scene transitions (into and out of
   battle) so the whole app crossfades consistently.
2. Give modals a graceful **exit** animation (today they `destroy()` instantly,
   which reads as a pop-out glitch after a smooth `popIn`).
3. Provide **one reusable interactive-feedback helper** so hover/press polish is
   consistent instead of hand-rolled per scene, and adopt it where cheap.
4. Add **entrance stagger** to the most un-animated scenes (Settings, Squad,
   Hero) so they assemble smoothly instead of snapping in.

## Non-goals / invariants

- **BattleScene simulation is untouched** — render layer only. The fixed
  timestep + render-lerp + FxPool stay exactly as they are.
- **No BitmapText migration this pass** — recorded as future work in this spec.
- **No 16-scene rewrite** — extend shared helpers (`uiKit.ts`, `ui.ts`); adopt
  in a bounded set of scenes/dialogs.
- **File-size law** — no source file over 500 lines. The one piece of pure
  logic goes in a new small module so `uiKit.ts` stays well under the cap.
- **No new dependencies, no asset/ASSET_VERSION changes** — pure code.

## Components

### 1. `src/scenes/uiMotion.ts` — pure, Phaser-free (TDD'd)

The only non-trivial logic, isolated so it is unit-testable without Phaser.

```ts
export interface StaggerOpts {
  step?: number;     // ideal ms between consecutive items (default 40)
  maxTotal?: number; // cap on the LAST item's delay (default 360)
  from?: number;     // delay before the first item (default 0)
}
/** Per-index entrance delays (ms). When count*step would exceed maxTotal the
 *  step is compressed so the last item still starts by `from + maxTotal`. */
export function staggerDelays(count: number, opts?: StaggerOpts): number[];
```

Behaviour pinned by tests:
- `count <= 0` → `[]`; `count === 1` → `[from]`.
- Delays are non-decreasing and start at `from`.
- Last delay ≤ `from + maxTotal` for any count (the clamp — a 50-tile grid does
  not take 2s to assemble).
- When uncompressed (`(count-1)*step <= maxTotal`), index `i` delay is
  `from + i*step` exactly.

Also re-exports shared motion-timing tokens used by both the presenters and any
future consumer: `MOTION = { popOut: 160, stagger: 40, staggerMax: 360 }`.

### 2. `src/scenes/uiKit.ts` — new presenters (consume uiMotion)

- `popOut(scene, obj, onDone?)` — reverse of `popIn`: tween `scale → 0.9`,
  `alpha → 0` over `MOTION.popOut` ms, `ease: "Quad.easeIn"`, then `onDone?.()`.
- `closeModal(scene, container, onDone?)` — `popOut` the container, then
  `container.destroy()` and `onDone?.()` on complete. The standard modal-close.
- `staggerIn(scene, objects, opts?)` — for each object apply an entrance
  (start `y += 8`, `alpha = 0` → settle to its own y/alpha) on the
  `staggerDelays(objects.length, opts)` schedule, `ease: "Quad.easeOut"`.
- `interactive(scene, obj, { onClick, hoverScale?, pressScale? })` — attach the
  5-pointer-event feedback (hover pop `Back.easeOut`, press dip yoyo, click on
  release) to ANY transform-bearing object. `button()` is refactored to delegate
  to it so there is a single feedback implementation.

uiKit.ts is ~189 lines today; these additions (~90 lines) keep it < 300.

### 3. Battle crossfades (call-site edits only)

- `StageSelectScene.ts:405` `this.scene.start("BattleScene", data)` →
  `fadeToScene(this, "BattleScene", data)`.
- `battleSceneRender.ts:117` `this.scene.start("MainMenuScene")` →
  `fadeToScene(this, "MainMenuScene")`.
- Ensure `BattleScene` calls `fadeIn(this)` on create so battle entry crossfades
  in (add if absent). Verify no double-fade with any existing camera effect.

### 4. Bounded adoption

- **Modals:** route the dismiss/close path of the shared dialogs
  (`itemEnhanceDialog`, `itemCompareDialog`, the Smelt confirm) and the
  `dimBackdrop` tap-to-dismiss through `closeModal` so they animate out.
- **Un-animated scenes:** `SettingsScene`, `SquadScene`, `HeroScene` — add
  `fadeIn` on entry if missing, `staggerIn` their primary row/tile group, and
  swap hand-rolled hover for `interactive()` where it is a direct substitution.

## Data flow

Pure `uiMotion.staggerDelays` → consumed by `uiKit.staggerIn` (presenter) →
called by scenes. Transitions stay within the existing `fadeToScene`/`fadeIn`
contract (no new transition machinery). No state, no persistence, no save-model
changes.

## Testing

- **Unit (TDD, Phaser-free):** `tests/uiMotion.test.ts` pins every
  `staggerDelays` behaviour above (empty/single, non-decreasing, start-at-from,
  clamp for large counts, exact spacing when uncompressed).
- **Type/lint/format/cycles:** `tsc`, ESLint (incl. max-lines 500), prettier,
  `madge` 0 runtime cycles.
- **Playtest (CDP):** menu→battle→menu round trip screenshots to confirm
  crossfades render and PAGE ERRORS is empty; a modal open/close to confirm the
  exit animation; verify `renderer.type === 2` (WebGL) for accurate capture.

## Risks

- **Double-fade / stuck-black camera** if a `fadeToScene` fires while a fade is
  already running — mitigated by the existing `fadeEffect?.isRunning` guard in
  `fadeToScene`; add the same guard discipline to battle entry.
- **`closeModal` double-destroy** if a dialog is dismissed twice mid-animation —
  guard with an `isClosing` flag / idempotent destroy check.
- **Adoption regressions** — keep `interactive()`/`staggerIn` swaps to direct
  substitutions; if a scene's hover is entangled with custom state, leave it.

## Future work (out of scope, recorded)

- Migrate per-frame HUD counters (gold/wave/timer) to `BitmapText` to remove the
  Text GPU-texture re-upload on every change (needs a bitmap-font asset).
- Consider `tweens.chain` for the multi-beat reward/box reveals if their
  fire-and-forget tweens ever desync.
