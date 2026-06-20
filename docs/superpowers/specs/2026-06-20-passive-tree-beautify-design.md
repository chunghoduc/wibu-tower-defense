# Passive Tree Beautify — Cosmic Atmosphere + Node Glow

**Date:** 2026-06-20
**Status:** Approved (full-auto session)

## Problem

The newly-expanded ~936-node passive tree renders as flat vector `Graphics`:
thin lines + plain circles + a per-region fill color over a solid `#0a0e14`
backdrop. It's functional but visually dead — no depth, no atmosphere, no sense
that allocating a path *lights it up*. The user wants it to look beautiful,
PoE-style: an atmospheric backdrop, glowing nodes, themed connections, and
region/rarity radiance.

## Constraints

- Tree is **vector-drawn**, not SDXL sprites → beauty is procedural. **No PNG
  regeneration, no `ASSET_VERSION` bump.**
- Pure logic must be deterministic & testable: seeded `Rng` (core/rng.ts),
  **no `Math.random` / `Date.now`** (repo law — they throw in tests).
- Every source file < 500 code lines (ESLint max-lines). `PassiveGridScene.ts`
  is ~330 lines — new work goes into new modules, not the scene.
- `assetKeys.ts` is the sole texture-key builder (N/A here — no textures).
- Mirror the existing `menuAtmosphere.ts` (pure spec) + `menuBackdropFx.ts`
  (presenter) pattern already proven in the codebase.

## Architecture

Two new modules + light scene wiring. The backdrop lives in **tree world space**
(scrolls with the tree on the main camera), so it's built over the tree's pixel
bounds, not the screen.

### 1. `src/scenes/passiveTreeAtmosphere.ts` — pure, seeded, tested

Builds a `PassiveTreeAtmosphere` spec over the tree's world bounds:

- **Gradient bands:** a handful of horizontal deep-space bands (top→bottom,
  dark indigo → near-black) to give the void depth. Plain `{y, h, color, alpha}`.
- **Stars:** ~140 scattered points across the bounds, each `{x, y, r, baseAlpha,
  phase}` for a slow twinkle. Seeded.
- **Nebulae:** **one tinted cloud per region**, centered at that region's node
  centroid (passed in from the scene as `regionCenters: {region,x,y}[]`), tinted
  with the region color, built as a few stacked soft discs `{x, y, r, color,
  alpha, phase}`. This makes each of the 8 lobes sit in its own colored nebula.

Pure helpers:
- `starTwinkle(star, tSec): number` — alpha in [0,1], layered sines.
- `nebulaPulse(neb, tSec): number` — gentle breathing alpha multiplier.

`buildPassiveTreeAtmosphere(bounds, regionCenters, seed)` returns the spec.

### 2. `src/scenes/passiveTreeFx.ts` — presenter

Owns three `Graphics` objects on the **main** camera:
- `backdrop` (static, normal blend, deepest depth): gradient bands.
- `nebulae` (static-ish, ADD blend): stacked nebula discs + the static star field.
- `glow` (ADD blend, redrawn on allocation change): per **unlocked** node a soft
  additive halo in its region color; along each fully-unlocked **connection** a
  glowing region-colored line; **keystones** get an extra radiant ring.
- `twinkle` (ADD blend, per-frame): star twinkle + nebula pulse + a slow pulse on
  the keystone auras.

API:
- `constructor(scene, spec)` — draws static layers, sets depths below the node
  graphics.
- `drawGlow(nodes, unlockedSet, toPixel, regionColor)` — rebuilds the glow layer.
- `update(timeMs)` — animates twinkle/pulse.
- `objects` getter (for camera partitioning) + `destroy()`.

### 3. `PassiveGridScene` wiring (small)

- Compute `regionCenters` (centroid of each region's nodes in pixels) + build the
  atmosphere over `treeBounds`.
- `new PassiveTreeFx(...)`; add its objects to the **main**-only set; `uiCam`
  ignores them (they scroll with the tree).
- In `redraw()` call `fx.drawGlow(...)` before drawing nodes.
- Add `update(time)` → `fx.update(time)`.
- Remove the flat `setBackgroundColor("#0a0e14")` reliance for *look* (keep a dark
  clear so off-bounds is black); the gradient/nebulae now provide the backdrop.

## Depth ordering (main camera)

`backdrop` (-30) < `nebulae`/stars (-25) < `glow` (-20) < connections+nodes
(scene `gfx`, default 0) < panel (UI camera).

## Testing

`tests/passiveTreeAtmosphere.test.ts` (pure):
- deterministic (same seed → identical spec).
- one nebula per region center; nebula color matches its region center's color.
- stars/nebulae fall within bounds.
- `starTwinkle` / `nebulaPulse` stay in [0,1] across a time sweep.

Presenter + scene verified via the existing CDP repro
(`repro_passive_tree.mjs`) — assert the Fx layers exist + screenshot for a visual
check.

## Out of scope

- No change to node *data*, layout, costs, or the generator.
- No SDXL art, no new textures, no save changes.
- No change to pan/zoom camera math.
