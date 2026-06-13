# Loading Screen Backdrop — Design Spec

Date: 2026-06-13
Status: Approved (full-auto)

## Problem

The loading screen (`PreloadScene`) is a flat `#0d0f14` void with a gold progress
bar and the game title. It is the first thing every player sees and it looks
unfinished. We want it to feel like the game: an impressive, atmospheric
tower-defense scene behind the progress bar.

## Hard constraint that shapes the whole design

`PreloadScene.preload()` is where the loading UI is built, and it runs **before any
sprite texture has finished downloading** — tower/castle/background PNGs are the
very payload being loaded. Therefore the backdrop **cannot use any loaded
texture**. It must be drawn entirely with `Phaser.GameObjects.Graphics` primitives,
available from frame zero with zero asset dependency. This also makes it crash-proof
(no missing-texture risk) and dovetails with the existing pure-core / Phaser-presenter
+ TDD pattern in this codebase.

## Approach (chosen)

A **procedural painted skyline**: a dusk gradient sky, layered parallax hill bands,
and a row of stylized **tower silhouettes** with glowing crystal tops standing on a
ridge, plus a thin drift of rising embers/motes for life. The existing gold progress
bar, title, and "Loading…" label sit on top, unchanged in behavior.

Two pieces, following the house pattern:

- **Pure geometry module** `src/core/loadingBackdrop.ts` — Phaser-free, fully unit
  tested. Computes the layout from the canvas size: hill polygons, tower silhouette
  placements, and ember spawn specs. Deterministic (seeded by index, no RNG) so the
  scene is reproducible and testable.
- **Presenter** `src/scenes/loadingBackdropFx.ts` — consumes the pure layout and
  paints it with `Graphics`, runs the ember drift on an update tick, and exposes
  `destroy()`. Wired into `PreloadScene._setupLoadingBar()` underneath the bar, and
  torn down in the `load.on("complete")` handler alongside the bar.

### Alternatives considered (rejected)

- **Load a few real tower sprites first, then show them.** Adds a second loader pass
  and ordering fragility, depends on art that may be mid-regeneration, and risks a
  blank flash. Procedural is instant and robust. Rejected.
- **A single pre-baked background PNG for the loader.** Still a texture → same
  before-load-completes problem, plus new art to generate/maintain and an
  ASSET_VERSION bump. Rejected.

## Pure module API (`src/core/loadingBackdrop.ts`)

```ts
export interface Vec2 { x: number; y: number }

export interface HillBand {
  points: Vec2[];   // closed polygon spanning full width, anchored to bottom
  color: number;    // fill color (back bands darker)
  depth: number;    // 0 = farthest, 1 = nearest
}

export interface TowerSil {
  x: number;        // center x of the tower base
  baseY: number;    // y of the ground contact (on the front ridge)
  width: number;    // base width
  height: number;   // total height (base to top of roof)
  body: number;     // body fill color
  glow: number;     // crystal/beacon glow color
  depth: number;    // parallax band the tower stands on
}

export interface Ember {
  x: number; y: number;   // spawn position
  r: number;              // radius
  speed: number;          // upward px/sec
  drift: number;          // horizontal sway amplitude
  phase: number;          // sway phase offset (radians)
}

export function loadingHills(width: number, height: number): HillBand[];
export function loadingTowers(width: number, height: number): TowerSil[];
export function loadingEmbers(width: number, height: number, count: number): Ember[];

// Pure per-frame ember position (wraps to bottom when it rises off-screen).
export function emberAt(e: Ember, t: number, height: number): Vec2;
```

### Behavior contracts (these become the tests)

- `loadingHills`: returns ≥2 bands ordered back→front (ascending `depth`); each
  band's polygon spans `x: 0..width` and is anchored to `y: height` (closed shape);
  nearer bands sit lower on screen / cover more; colors get lighter toward the back
  (atmospheric haze) — back band lightest sky-adjacent, front band darkest.
- `loadingTowers`: returns 5–8 silhouettes; every tower is fully within
  `0..width` horizontally (`x - width/2 >= 0`, `x + width/2 <= width`); towers are
  ordered left→right and spaced without overlap; heights vary (not all equal);
  each `baseY` sits on the front ridge line; deterministic for a given canvas size.
- `loadingEmbers`: returns exactly `count` embers, all within bounds, with varied
  speed/drift; deterministic.
- `emberAt`: rises over time (`y` decreases as `t` increases for small `t`); wraps
  back to near `height` once it passes the top so the field never empties; `x` stays
  within `0..width` across the sway.

## Presenter (`src/scenes/loadingBackdropFx.ts`)

```ts
export interface LoadingBackdrop { update(timeSec: number): void; destroy(): void }
export function createLoadingBackdrop(scene: Phaser.Scene): LoadingBackdrop;
```

- On create: one `Graphics` for the static scene (sky gradient via stacked
  horizontal bands, hills, tower silhouettes with a lit crystal/window glow and a
  soft additive glow blob at each tower top), drawn once; one `Graphics` for embers
  redrawn each `update`. All added at depth below the bar/title.
- `update(t)`: repaint embers using `emberAt`; optionally a gentle pulse on the tower
  glows (cheap sine on alpha). No sim, no allocations per frame beyond `clear()`.
- `destroy()`: destroy both graphics objects.

## Integration into `PreloadScene`

- In `_setupLoadingBar()`, call `createLoadingBackdrop(this)` **first** (so it renders
  behind the track/bar/title), store the handle, and drive `update()` from a
  `this.time.addEvent` repeating tick (or `scene.events.on('update')`) using
  `this.time.now / 1000`.
- In the `load.on("complete")` handler, call `backdrop.destroy()` alongside the
  existing `bar/track/label/title.destroy()`.
- Title/label/bar styling and the DOM-splash mirror are unchanged. The DOM splash
  (pre-canvas) keeps its current flat look — out of scope.

## Testing

`tests/loadingBackdrop.test.ts` (Vitest, pure, no Phaser):

- hills: count, ordering by depth, full-width span, bottom anchor, color gradient.
- towers: count range, in-bounds horizontally, non-overlap left→right ordering,
  height variation, base on ridge, determinism (two calls equal).
- embers: exact count, in-bounds, determinism.
- emberAt: rises with t, wraps near bottom after passing top, x within bounds.

Presenter is thin and Phaser-bound → not unit tested (consistent with other
`*Fx.ts` presenters in the repo).

## Scope / YAGNI

- No new art assets, no manifest change, no ASSET_VERSION bump (pure Graphics).
- No change to the DOM splash, the title text, or the progress-bar mechanics.
- No parallax-on-pointer or scene interactivity — it's a loading screen.

## Files

- add `src/core/loadingBackdrop.ts` (pure, < 200 lines)
- add `src/scenes/loadingBackdropFx.ts` (presenter, < 200 lines)
- add `tests/loadingBackdrop.test.ts`
- edit `src/scenes/PreloadScene.ts` (wire create + destroy + update tick)
