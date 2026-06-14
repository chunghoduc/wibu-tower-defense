# Mobile Visible-Viewport Fit — Design

**Date:** 2026-06-14
**Status:** Approved (full-auto session)
**Follows:** `2026-06-13-mobile-web-gesture-hardening-design.md`

## Problem

Bug report: *"the UI on mobile web is super buggy — can't click on BATTLE and
can't drag the screen on the home screen."*

### Investigation (systematic-debugging)

The input layer was the obvious suspect, so it was exercised first under **mobile
device + touch emulation** via CDP (`scripts/playtest/repro_mobile.mjs`,
`repro_mobile2.mjs`, `repro_battle_touch.mjs`). All four scenarios passed:

| Scenario (real touch events, `mobile:true`, `pointer:coarse`) | Result |
| --- | --- |
| Tap BATTLE on the menu (landscape) | navigates; pointer map exact (480,270→480,270) |
| Tap BATTLE after a portrait→landscape rotation | works; remap exact |
| Battle: arm + tap-to-place a tower | tower placed |
| Battle: one-finger drag-to-pan (zoomed) | camera scrolls 212px |

**Conclusion: the Phaser input plumbing and pointer mapping are sound.** Headless
Chrome re-fits the canvas on every viewport change, so nothing breaks there.

### Root cause

The one thing headless Chrome does **not** reproduce is real mobile-browser
viewport behavior. `index.html` sizes the game host with **static** viewport
units:

```css
html, body { height: 100%; }
#game      { width: 100vw; height: 100vh; }
```

`100vh`/`100vw` equal the **layout viewport**. On mobile browsers — iOS Safari
in particular — the layout viewport is **taller** than the **visual viewport**
whenever the dynamic browser toolbar / URL bar is showing. The game canvas is
`960×540` (16:9) fit-scaled (`Phaser.Scale.FIT` + `CENTER_BOTH`) into that
over-tall host, so its **bottom band renders behind the browser chrome**.

That bottom band is exactly where the bottom-anchored controls live:

- Home: the wide **BATTLE** call-to-action (`homeNavLayout` primary, game y≈443/540).
- Battle: the avatar **build bar**.

So the BATTLE button is physically off the visible area → "can't click battle".
And because the previous hardening pass correctly set `touch-action: none;
overscroll-behavior: none; overflow: hidden`, the user **cannot scroll/drag** the
hidden band into view → "can't drag the screen." Both symptoms, one cause.

`installMobileLandscape` is meant to dodge this by going fullscreen + locking
landscape on the first gesture, but that is unavailable on iOS Safari (no
element fullscreen, `orientation.lock` rejects) and may be declined elsewhere —
so the static-`vh` host is the fallback reality for a large share of mobile web.

A compounding factor: when the toolbar later hides/shows or the visual viewport
otherwise changes, iOS does **not** reliably fire a window `resize`, so Phaser's
ScaleManager (which listens to `resize`) never re-fits. The `visualViewport`
API *does* fire for these changes and is not currently wired.

## Goals

- The entire `960×540` canvas — including the bottom BATTLE CTA / build bar — is
  always within the **visible** viewport on mobile web, with no fullscreen required.
- When the visual viewport changes (toolbar show/hide, rotation, keyboard), the
  Phaser canvas re-fits promptly.
- Zero behavioural change on desktop and in the (already-correct) fullscreen path.

## Non-goals

- Re-architecting the scale mode (FIT + letterboxing stays).
- Touch gesture ownership — already handled by the 2026-06-13 hardening pass.
- Removing the rotate overlay or the landscape/fullscreen attempt.

## Approach

Two complementary, low-risk changes:

### 1. Size the host to the *dynamic* viewport (CSS)

Replace static `vh`/`vw` on `html, body, #game` with the **dynamic** viewport so
the host tracks the visible area:

```css
html, body { height: 100dvh; }
#game      { width: 100dvw; height: 100dvh; }
```

with a `-webkit-fill-available` fallback under `@supports` for pre-`dvh` iOS, and
the static `vh`/`vw` kept as the first declaration so non-supporting engines fall
back gracefully. With the host now equal to the visible area, `FIT` keeps the
whole canvas — bottom band included — on screen.

### 2. Re-fit Phaser on visual-viewport changes (JS)

A small presenter listens to `window.visualViewport` `resize`/`scroll` (and
`orientationchange`) and calls `game.scale.refresh()` when the visible size has
actually changed. The change decision is a **pure, unit-tested** predicate so the
churn-filtering logic is covered without a browser:

```
viewportChanged(prev, cur, epsilonPx=1): boolean   // ignores sub-pixel jitter
```

The presenter (`installViewportFit`) is the thin Phaser/DOM adapter: read the
visible size from `visualViewport` (falling back to `innerWidth/innerHeight`),
compare via `viewportChanged`, and `scale.refresh()` on a real change. Safe for
all platforms; it only ever re-fits to the current visible size.

## Files

- `index.html` — dynamic-viewport heights + `@supports` fallback.
- `src/core/viewportFit.ts` (new, pure) — `viewportChanged` + `visibleSize` reader.
- `src/scenes/viewportFitFx.ts` *or* fold the presenter into `mobileLandscape.ts`
  — wire `visualViewport` → `scale.refresh()`. (Decision: a standalone
  `installViewportFit(game)` in `viewportFit.ts`'s presenter sibling keeps
  mobileLandscape focused; called from `main.ts` unconditionally.)
- `src/core/viewportFit.test.ts` (new) — RED→GREEN for `viewportChanged`.

## Verification

- `viewportFit.test.ts` green (jitter filtered, real change detected).
- New `scripts/playtest/repro_viewport.mjs`: shrink the emulated visual viewport,
  fire `visualViewport` resize, assert `scale.refresh()` re-fits and a touch on
  the BATTLE button still lands. (Proves the wiring end-to-end.)
- tsc + eslint (changed files) + full vitest + `npm run build` all green.
- Protected WIP (gacha.ts, spriteManifest.ts, tower sprites, etc.) left unstaged.
```
