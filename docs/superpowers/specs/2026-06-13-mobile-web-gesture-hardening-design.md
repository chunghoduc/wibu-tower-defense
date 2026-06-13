# Mobile-Web Gesture Hardening — Design

**Date:** 2026-06-13
**Status:** Approved (full-auto session)
**Follows:** `2026-06-13-web-gesture-feel-design.md`, `2026-06-13-battle-touch-placement-design.md`

## Problem

The battle scene already implements the right *gestures* — pinch-to-zoom,
drag-to-pan (when zoomed), double-tap-to-zoom, and tap-to-place. But on mobile
web the **browser still co-owns those gestures**, because nothing in the app
sets the `touch-action` CSS property. The only current defense is the viewport
meta `user-scalable=no, maximum-scale=1.0` — which iOS Safari 10+ deliberately
ignores. Consequences on a phone:

- A two-finger pinch can zoom the *page* (or do nothing useful) instead of the game.
- A drag can scroll the document / trigger overscroll bounce / pull-to-refresh.
- A double-tap can fire the browser's native double-tap-to-zoom.

Phaser's default `input.touch.capture = true` calls `preventDefault()` on touch
events reaching its canvas, which helps — but it is **not** the same as declaring
`touch-action: none`, and Phaser does not set that property itself. The
deep-research pass (2026-06-13) ranked `touch-action: none` on the game canvas as
the single highest-confidence, primary-sourced fix (MDN `touch-action`, Chrome
"scrolling intervention" dev blog).

A secondary gap: the existing pinch handler only *zooms* around the finger
midpoint — it does not *pan* with the midpoint. The natural mobile gesture is
"put two fingers down and drag the battlefield around (while optionally zooming)."
And the ＋/− zoom buttons are ~40×30px, below the 44px touch-target minimum, and
stacked so tightly they nearly overlap.

## Research basis (high-confidence findings)

1. Apply `touch-action: none` to the game canvas to fully suppress native
   scroll / pinch / double-tap-zoom and own all custom gestures. (MDN, Chrome — 3-0)
2. Build input on the Pointer Events API (device-agnostic). Phaser already does
   this; no change needed. (MDN — 2-0)
3. Since Chrome 56, `touchstart`/`touchmove` on `window`/`document`/`body` are
   passive by default, so any `preventDefault()` fallback needs `{passive:false}`.
   We rely on canvas-level capture + `touch-action`, so we add no window-level
   `preventDefault`. (Chrome — 3-0)
4. `touch-action: manipulation` removes the legacy ~300ms tap delay; `none`
   (used for a full-gameplay canvas) also removes it. (MDN — 3-0)
5. iOS Safari fires no double-tap event — reconstruct from tap timing. Already
   handled by `isDoubleTap` in `gesture.ts`. (Apple — 1-1, framing split only)
6. Tap-vs-drag needs a small hit-slop (~7–10px). Already `TAP_SLOP_PX = 8`. (Apple — 2-0)

Findings 2, 5, 6 are already satisfied. This spec implements 1, 3, 4, plus the
pinch-pan and touch-target improvements.

## Goals

- The game canvas owns 100% of touch gestures on mobile web; the browser never
  scrolls, bounces, or zooms underneath it.
- Two fingers can pan the battlefield (translate by midpoint) while pinching.
- ＋/− zoom buttons meet the 44px touch-target minimum and don't overlap.

## Non-goals

- Momentum/inertia panning of the battle camera (deliberately out of scope, as in
  the prior web-gesture-feel spec).
- Changing the existing tap-to-place / double-tap-zoom / single-finger-pan logic.
- Touching the viewport meta tag (harmless; left as-is). `touch-action` is the
  effective fix.
- Any change to list scrolling (`scrollDrag.ts`) — those views *should* keep
  vertical scroll; this spec is battle-canvas-only.

## Design

### Milestone 1 — Gesture ownership (CSS + live canvas)

**`index.html`** — declare touch ownership at the document level so it holds even
before Phaser boots and regardless of how the canvas is created:

```css
html, body { touch-action: none; overscroll-behavior: none; }
#game, #game canvas { touch-action: none; }
```

`overscroll-behavior: none` kills pull-to-refresh and scroll-chaining/bounce.

**`src/core/touchInput.ts`** (new, pure-seam util — no Phaser):

```ts
/** Minimal element shape we mutate — keeps this unit testable with a stub. */
export interface StyleHost { style: { touchAction?: string; overscrollBehavior?: string } }

/** Declare that this element owns all touch gestures: no native scroll, pinch,
 *  double-tap-zoom, or overscroll bounce. Idempotent. */
export function hardenTouchInput(el: StyleHost): void {
  el.style.touchAction = "none";
  el.style.overscrollBehavior = "none";
}
```

**`main.ts`** — Phaser creates its canvas during boot, so harden it on the
`READY` event (and the canvas is also covered by the CSS rule as belt-and-braces):

```ts
game.events.once(Phaser.Core.Events.READY, () => {
  if (game.canvas) hardenTouchInput(game.canvas);
});
```

*Testable seam:* `hardenTouchInput` is verified against a `{ style: {} }` stub —
asserts both properties are set. The CSS and the `main.ts` wiring are validated
by the real-pointer playtest (no page scroll/zoom under a canvas gesture).

### Milestone 2 — Two-finger pinch-pan

**`src/core/gesture.ts`** — add a pure reducer over two pinch samples:

```ts
/** A two-finger pinch sample: finger distance + midpoint (screen px). */
export interface PinchSample { dist: number; cx: number; cy: number }

/** Per-frame pinch delta: how much to zoom (multiplicative) and how far the
 *  midpoint translated (screen px). zoomFactor is 1 when prev.dist is 0/invalid
 *  (first frame of a pinch — establish the baseline, don't jump). */
export function pinchUpdate(prev: PinchSample, cur: PinchSample): {
  zoomFactor: number; panDx: number; panDy: number;
} {
  const zoomFactor = prev.dist > 0 ? cur.dist / prev.dist : 1;
  return { zoomFactor, panDx: cur.cx - prev.cx, panDy: cur.cy - prev.cy };
}
```

**`src/scenes/battleCamera.ts`** — in `handleMove`, when both pointers are down,
feed the previous and current `PinchSample` to `pinchUpdate`, apply `zoomToward`
with the zoom factor around the midpoint, then additionally `setScroll` by
`-panDx/zoom, -panDy/zoom` so two fingers translate the view. Track the last
midpoint in fields (`pinchMx`, `pinchMy`) alongside the existing `pinchDist`.
The first pinch frame establishes the baseline (zoomFactor 1, no pan) — matching
the current behavior where `pinching` is false until a baseline distance exists.

Edge cases:
- Single-finger pan path unchanged (still gated on `isZoomedIn`).
- Bounds clamping is whatever the camera already enforces; pinch-pan reuses the
  same `setScroll`, so it inherits the clamp (no new clamp logic).
- `onUp` already resets `pinching`/`pinchDist`; also reset the midpoint fields.

### Milestone 3 — Touch-target sizing

In `addZoomButtons` (`battleSceneInput.ts`), give each ＋/− button an explicit
≥44×44px interactive hit area (via padding and/or `setInteractive` with a
`Phaser.Geom.Rectangle` hit area sized to the target) and increase the vertical
spacing between them so the two hit rects don't overlap. Keep them on the HUD
camera (fixed while the view pans), keep the existing visuals; only the hit
geometry and spacing grow.

### Milestone 4 — Verify + playtest + commit

- Extend `scripts/playtest/repro_input.mjs` with a two-finger pinch-pan check:
  drive two synthetic pointers, assert both `zoom` changes and the camera
  `scroll` translates with the midpoint; assert the document does not scroll
  under a canvas gesture (`window.scrollY` stays 0).
- Run: `tsc` typecheck, `eslint` (0 errors), `lint:cycles` (0 cycles), `vitest`,
  `vite build`.
- Commit per milestone with the standard trailer.

## Testing strategy

| Unit | Test |
|---|---|
| `hardenTouchInput` | sets `touchAction='none'` + `overscrollBehavior='none'` on a stub; idempotent |
| `pinchUpdate` | zoomFactor = cur/prev dist; zoomFactor=1 when prev.dist≤0; panDx/Dy = midpoint delta; zero delta when identical samples |
| canvas/CSS + camera wiring | real-pointer `repro_input.mjs` (pinch-pan translates + zooms; no document scroll) |

Pure modules stay Phaser-free and deterministic (no `Date.now`/`Math.random`).

## File-size / constraints check

- `src/core/touchInput.ts` — new, ~15 lines.
- `gesture.ts` gains ~12 lines (well under 500).
- `battleCamera.ts` gains ~10 lines (currently ~160; stays under 500).
- `battleSceneInput.ts` zoom-button change is in-place (no growth of note).
- No protected files touched (no tower sprites, `gacha.ts`, `spriteManifest.ts`,
  `sdart/` scripts, or the scheduled-tasks lock).
- No deploy; `ASSET_VERSION` untouched (no art change).
