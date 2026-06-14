# Mobile Visible-Viewport Fit — Implementation Plan

**Spec:** `docs/superpowers/specs/2026-06-14-mobile-visible-viewport-fit-design.md`
**Mode:** full-auto, TDD (RED → GREEN → REFACTOR), incremental commit.

## Root cause (established by systematic-debugging)

Input layer + Phaser scaling are sound (proven via CDP mobile-touch repros). The
defect is host sizing: `html/#game` use static `100vh`/`100vw` (= layout
viewport), which on mobile browsers exceeds the **visible** viewport when the
toolbar shows, pushing the bottom-anchored BATTLE CTA / build bar behind the
browser chrome — untappable, and unscrollable due to `touch-action:none`.

## Milestone 1 — Pure `viewportFit` module (TDD)

1. **RED** `src/core/viewportFit.test.ts`:
   - `viewportChanged({w,h}, {w,h})` returns `false` for identical sizes.
   - returns `false` for sub-epsilon jitter (e.g. 0.4px).
   - returns `true` when width or height moves past epsilon.
   - `visibleSize(src)` reads `{width,height}` from a `visualViewport`-like object,
     and falls back to `innerWidth/innerHeight` when `visualViewport` is null.
2. **GREEN** `src/core/viewportFit.ts`: implement both (pure, no Phaser/DOM globals;
   source injected). Keep < 60 lines.

Commit: `test(viewport): RED pure viewportFit` folded with GREEN into one
`feat(mobile): pure viewportFit (visible-size + change predicate)`.

## Milestone 2 — CSS dynamic viewport + presenter wiring

3. `index.html`: `html, body, #game` get `height: 100vh; height: 100dvh;`
   (`#game` also `width: 100vw; width: 100dvw;`), plus an `@supports
   (-webkit-touch-callout: none)` block setting `-webkit-fill-available` for
   pre-`dvh` iOS. Static unit stays first as the universal fallback.
4. `src/core/viewportFit.ts` presenter `installViewportFit(game)`:
   - read initial visible size; on `visualViewport` `resize`/`scroll` and window
     `orientationchange`, if `viewportChanged(last, cur)` → `game.scale.refresh()`
     and store `last = cur`.
   - guard when `visualViewport` is undefined (older engines) — fall back to a
     window `resize` listener (Phaser already handles that, so this is a no-op
     safety net).
5. `src/main.ts`: `installViewportFit(game)` after `installMobileLandscape(game)`.
   Unconditional (safe on desktop — only ever re-fits to current visible size).

Commit: `fix(mobile): fit canvas to the visible viewport (dvh + visualViewport refit)`.

## Milestone 3 — Verify

6. `scripts/playtest/repro_viewport.mjs`: emulate a phone, shrink the emulated
   height (toolbar proxy), fire `visualViewport`/window resize, assert
   `game.scale.refresh()` ran (canvas height tracks the new visible size) and a
   touch on the BATTLE button still navigates.
7. `npx tsc --noEmit`; `npx eslint` on changed files; `npx vitest run`;
   `npm run build`.
8. Memory note (mobile viewport trap). Commit only own files — leave protected
   WIP (`gacha.ts`, `spriteManifest.ts`, tower sprites, scripts/sdart) unstaged.

## Risks / mitigations

- `dvh` unsupported on very old engines → static `vh` first + `-webkit-fill-available`
  fallback covers them.
- Over-refreshing on scroll jitter → `viewportChanged` epsilon filter.
- Desktop regression → presenter only calls `scale.refresh()`, which is idempotent
  and already what window-resize does; no behavioural change when size is stable.
