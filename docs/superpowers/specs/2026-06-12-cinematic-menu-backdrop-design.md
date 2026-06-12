# Cinematic Living Throne-Hall — Main-Menu Backdrop Redesign

**Date:** 2026-06-12
**Status:** Approved (full-auto, self-approved)
**Author:** Claude (Opus 4.8)

## Problem

The main menu (`MainMenuScene`) reads as flat and unimpressive. Two concrete
defects:

1. **Double-throne clash.** The SDXL backdrop `bg__menu-hall` already bakes a
   large gold throne into the centre of the image, but `drawThrone()` paints a
   _second_ procedural king's-chair directly on top of it. The two thrones
   fight each other — different scale, perspective and colour — and the result
   looks cluttered and amateurish.
2. **Dead static.** The backdrop never moves. The only "atmosphere" is two flat
   `0x05070c` darkening bars across the top and bottom (`drawBackdrop`). There
   are no light shafts, no drifting dust, no ember glow, no depth — nothing that
   makes a throne hall feel grand or alive.

The home diorama (hero on the procedural chair, equipped gear on wall hangers,
squad on the dais, pet in flight — see [[project_home_throne_room]]) is good and
stays. The job is to give it a **cinematic stage** to stand on.

## Goals

- A grand, _moody, alive_ throne hall that makes the menu feel premium.
- Resolve the double-throne so there is exactly **one** focal throne (the
  engine-controlled procedural chair the hero sits on).
- Add living atmosphere: volumetric god-ray shafts, floating dust motes, rising
  brazier embers, a warm key-light behind the throne, gentle torch flicker, and
  a true radial vignette that pulls focus to the hero.
- Pure, deterministic, unit-testable layout maths (same discipline as
  [[project_endless_maze_arena]] / `endlessBackdrop.ts`).
- No gameplay change. Presentation only. No file over 500 lines.

## Non-Goals

- No change to the menu buttons, header, hangers, squad, or pet logic.
- No new menu destinations or navigation.
- Not touching battle/chapter backdrops.
- No dependency on the SDXL art landing: the engine atmosphere layer must look
  great even on the missing-texture fallback fill.

## Design

Two pillars: **(A)** a regenerated, throne-less grand-hall backdrop, and **(B)**
an engine "living atmosphere" layer composited over it.

### Pillar A — regenerated backdrop art (`bg__menu-hall`)

Regenerate `public/assets/bg/menu-hall.png` (960×540) via the live Z-Image API
(`127.0.0.1:8765/generate`, the same SDXL flow this project uses for all art —
[[project_art_pipeline_sdxl]]). The new prompt asks for an **empty** cathedral-
scale throne hall: deep symmetrical perspective, a raised central dais (but **no
throne chair** — that's the procedural one), tall stained-glass windows throwing
god-rays, lit braziers down both walls, hanging banners, warm-amber key light
with cool shadow, cinematic and atmospheric. Removing the baked throne is what
kills the double-throne clash.

A small, reproducible one-off generator `scripts/sdart/genBackgrounds.mjs`
(re-created — the old `wibu-td-designer/gen-backgrounds.mjs` was deleted) renders
N candidates so the best can be picked, then writes the winner to the bg folder.
`bgManifest.ts` is unchanged (the id `menu-hall` already exists). This task is
_best-effort_: if generation fails, Pillar B still ships and the hall simply
keeps the old (or fallback) image.

### Pillar B — living atmosphere layer

**Pure module `src/scenes/menuAtmosphere.ts`** (Phaser-free, seeded, tested).
`buildMenuAtmosphere(W, H, seed)` returns a plain-data `MenuAtmosphereSpec`:

- `vignette` — radial focus `{cx, cy, innerR, outerR, edgeAlpha}` centred a bit
  above middle (on the hero), replacing the flat bars.
- `keyLight` — warm radial glow `{x, y, r, color}` behind the throne so the
  procedural chair + hero read as the lit subject and the painted hall recedes.
- `rays` — N god-ray shafts descending from the top: `{x, topW, botW, len,
tilt, color, baseAlpha, phase}` (drawn as translucent additive quads).
- `motes` — drifting dust `{x, y, r, drift, rise, phase, alpha}`.
- `embers` — warm motes rising from brazier anchors `{x, y, r, speed, drift,
phase, alpha}`.
- `torches` — flicker light points `{x, y, r, color, phase}`.

Plus pure deterministic animation helpers (no Phaser, no `Date.now`):
`motePos(m, t, dims)`, `emberPos(e, t, dims)`, `rayAlpha(r, t)`,
`flicker(t, phase)`. Randomness is seeded via the existing `Rng` (`core/rng.ts`)
so layouts are reproducible and assertable.

**Presenter `src/scenes/menuBackdropFx.ts`** (`MenuBackdropFx`), mirroring
`EndlessBackdropFx`:

- Constructed with `(scene, spec)`. Owns a small set of Graphics objects at
  depths **between** the backdrop (`-10`) and the diorama (throne is depth `1`):
  background darken + vignette + key-light + static ray cones on a `-8` layer;
  animated motes/embers/ray-shimmer/torch-flicker on a `-7` layer.
- `drawStatic()` once; `update(timeMs)` each frame redraws only the animated
  graphics (clear + redraw, exactly like `EndlessBackdropFx.update`).
- Additive blend (`Phaser.BlendModes.ADD`) for rays/embers/glow so they bloom.

### Wiring (`MainMenuScene`)

- `drawBackdrop()`: keep the painted base image (or fallback fill), then add a
  whole-screen **darken** (~0.35 black) so the busy hall recedes and the lit
  diorama pops — this is the second half of the double-throne fix (the painted
  content becomes dim ambient hall). Drop the two flat bars.
- Construct `MenuBackdropFx` right after the base image, before `drawThrone`.
- `update()` already runs for the pet — also call `this.backdropFx.update(t)`.
- `drawThrone` is **kept** (the single, engine-controlled focal throne). The
  `keyLight` glow sits behind it.
- Seed the atmosphere from a fixed constant (stable look each entry); the scene
  is reused, so the FX is rebuilt in `create()` and torn down implicitly with
  the scene's display list (no persistent handles to leak — but null the field
  on re-entry, per [[project_scene_reentry_reset]]).

## Data Flow

```
buildMenuAtmosphere(W,H,seed)  ->  MenuAtmosphereSpec  (pure, tested)
                                          |
MainMenuScene.create() --> new MenuBackdropFx(scene, spec) --> drawStatic()
MainMenuScene.update(t) --> backdropFx.update(t) --> motePos/emberPos/rayAlpha/flicker
```

## Testing

- **Pure unit tests** (`tests/menuAtmosphere.test.ts`):
  - spec is deterministic for a fixed seed (two builds deep-equal);
  - counts are in expected ranges; every mote/ember/ray sits within the canvas
    bounds at t=0;
  - `motePos`/`emberPos` stay finite and in-bounds across a sweep of `t`;
  - embers rise (y decreases) and wrap; `rayAlpha`/`flicker` are bounded in
    `[0,1]` and vary with `t`;
  - vignette is centred above mid-screen; keyLight sits near the throne y.
- **Phaser presenter**: verified via the headless CDP playtest
  (`scripts/playtest/snap.sh`) — enter the menu, capture a frame, assert no
  exception and that the hall now shows rays/vignette/embers with a single
  throne.
- Full suite + `tsc --noEmit` + production build stay green.

## Risks

- **SD art quality variance** — mitigated by generating several candidates and
  by Pillar B not depending on the art.
- **Over-busy atmosphere** — keep particle counts and alphas low; the layer must
  _frame_ the diorama, not bury it. Tunable constants at the top of the module.

```

```
