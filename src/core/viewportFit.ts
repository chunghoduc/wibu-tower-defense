// src/core/viewportFit.ts
//
// Keep the Phaser canvas matched to the VISIBLE viewport on mobile web.
//
// The bug this addresses: index.html sizes the game host with static `100vh`/
// `100vw`, which equal the LAYOUT viewport. On mobile browsers (iOS Safari
// especially) the layout viewport is TALLER than the VISUAL viewport whenever
// the dynamic toolbar / URL bar is showing, so the bottom band of the 960×540
// FIT-scaled canvas — exactly where the BATTLE call-to-action and the battle
// build bar live — renders behind the browser chrome: untappable, and (because
// `touch-action: none` correctly owns gestures) unscrollable. The CSS fix sizes
// the host to the dynamic viewport; this module re-fits Phaser whenever the
// VISUAL viewport changes (toolbar show/hide, rotation, soft keyboard), which
// `window.resize` does not reliably report on iOS but `visualViewport` does.
//
// The decision logic is pure (no Phaser, no DOM globals — the source is
// injected) so it is unit-tested without a browser. See
// docs/superpowers/specs/2026-06-14-mobile-visible-viewport-fit-design.md.

export interface Size {
  width: number;
  height: number;
}

/** A minimal `window`-like source: the visual viewport if the engine exposes it,
 *  plus the layout-viewport fallback dimensions. */
export interface ViewportSource {
  visualViewport: { width: number; height: number } | null | undefined;
  innerWidth: number;
  innerHeight: number;
}

/** The VISIBLE viewport size: `visualViewport` when present (the area not behind
 *  the browser chrome), else the layout viewport (`innerWidth/innerHeight`). */
export function visibleSize(src: ViewportSource): Size {
  const vv = src.visualViewport;
  if (vv) return { width: vv.width, height: vv.height };
  return { width: src.innerWidth, height: src.innerHeight };
}

/** Has the visible viewport moved enough since the last fit to warrant a
 *  `scale.refresh()`? `epsilonPx` filters sub-pixel / scroll jitter. */
export function viewportChanged(prev: Size, cur: Size, epsilonPx = 1): boolean {
  return (
    Math.abs(prev.width - cur.width) > epsilonPx || Math.abs(prev.height - cur.height) > epsilonPx
  );
}

/** Minimal Phaser surface we touch — keeps this importable without dragging in
 *  the whole Game type and lets the presenter be exercised with a stub. */
interface ScaleRefreshable {
  scale: { refresh: () => void };
}

type Listenable = {
  addEventListener?: (t: string, cb: () => void) => void;
  removeEventListener?: (t: string, cb: () => void) => void;
};

/** The `window`-ish surface the presenter binds to (real `window` satisfies it). */
export type ViewportWindow = ViewportSource &
  Required<Pick<Listenable, "addEventListener" | "removeEventListener">> & {
    visualViewport: (ViewportSource["visualViewport"] & Listenable) | null | undefined;
  };

/** Run `fn` after the browser has applied a pending relayout. A DOUBLE rAF is
 *  required: one frame for the dynamic-viewport (`dvh`) host resize to flush,
 *  the next for Phaser to read the settled parent bounds. Falls back to a
 *  macrotask where rAF is unavailable (tests / SSR). */
const afterRelayout = (fn: () => void): void => {
  const raf = (globalThis as { requestAnimationFrame?: (cb: () => void) => void })
    .requestAnimationFrame;
  if (raf) raf(() => raf(fn));
  else setTimeout(fn, 0);
};

/**
 * Wire visual-viewport changes to `game.scale.refresh()` so the canvas re-fits
 * the visible area when the mobile toolbar shows/hides or the device rotates.
 *
 * The refresh is DEFERRED via `schedule` (default: double requestAnimationFrame),
 * because the host is sized in `dvh` and refreshing synchronously on the resize
 * event fits Phaser to the STALE parent bounds before the `dvh` relayout flushes
 * — leaving the canvas (and its bottom BATTLE CTA / build bar) the wrong size.
 *
 * Safe on every platform: it only ever re-fits to the current visible size, and
 * a stable viewport produces no calls. Returns a disposer.
 */
export function installViewportFit(
  game: ScaleRefreshable,
  win: ViewportWindow = window,
  schedule: (fn: () => void) => void = afterRelayout,
): () => void {
  let last = visibleSize(win);
  const onChange = (): void => {
    const cur = visibleSize(win);
    if (!viewportChanged(last, cur)) return;
    last = cur;
    schedule(() => game.scale.refresh());
  };

  const vv = win.visualViewport;
  if (vv?.addEventListener) {
    vv.addEventListener("resize", onChange);
    vv.addEventListener("scroll", onChange);
  }
  // orientationchange + a window-resize safety net cover engines without a
  // `visualViewport` (Phaser already handles resize, so this is belt-and-braces).
  win.addEventListener("orientationchange", onChange);
  win.addEventListener("resize", onChange);

  return () => {
    if (vv?.removeEventListener) {
      vv.removeEventListener("resize", onChange);
      vv.removeEventListener("scroll", onChange);
    }
    win.removeEventListener("orientationchange", onChange);
    win.removeEventListener("resize", onChange);
  };
}
