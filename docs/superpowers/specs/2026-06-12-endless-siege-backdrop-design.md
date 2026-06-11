# Endless Siege Backdrop — Design Spec

**Date:** 2026-06-12
**Mode:** Endless only (campaign untouched)
**Status:** Approved (full-auto self-review)

## Problem

Endless mode now fights on a generated braided-maze arena with a central castle
besieged from eight gates (see `project_endless_maze_arena`). But the battlefield
*background* is still just the cleared campaign stage's painted backdrop — a flat
greenwood/desert/etc. panorama that has nothing to do with "a citadel at the heart
of the world under siege from every direction." The endless mode deserves a
distinctive, impressive backdrop that sells its fantasy.

## Goal

Give endless mode a dedicated, impressive backdrop that reads as **"the last
castle at the heart of the world, besieged from all directions through a maze of
war-roads."** It must:

- Center visual focus on the central castle (640, 360 world).
- Reinforce the multi-gate siege — danger pressing in from every edge.
- Feel alive (motion), not a static plate.
- Be deterministic per stage (seeded), and unit-testable per the codebase's
  pure-core/presenter convention.
- Stay entirely opt-in: campaign stages render exactly as before.
- Keep every source file < 500 lines.

## Approach — Hybrid: SDXL painted base + procedural siege-atmosphere layer

Two layers, composited:

### 1. SDXL painted base — `bg__endless-siege`

One new 960×540 backdrop generated through the existing SDXL flow (z-image-turbo
at `127.0.0.1:8765/generate`, the project's sole art generator). Prompt targets a
dark, epic, war-torn panorama with a **central radial focal glow** so the central
castle naturally sits on a hotspot and the corners fall to shadow. Saved to
`public/assets/bg/endless-siege.png`; registered in `BG_IMAGES`; loaded by
`PreloadScene` as texture `bg__endless-siege`.

Prompt (style-layered per the generating-images guidance):

> *epic dark fantasy battlefield seen from directly above, a scorched circular
> plain with a faint glowing arcane focal point at the very center, cracked earth
> and ash, embers and smoke drifting, blood-red and ember-orange light radiating
> from the middle fading to deep shadow at the edges, ominous siege atmosphere,
> ground-level war ruins around the rim, cinematic top-down concept art, highly
> detailed, dramatic volumetric light, dark moody palette with warm core glow*

960×540, steps 9, fixed seed for reproducibility.

### 2. Procedural siege-atmosphere layer

A pure geometry module computes the overlay; an animated presenter draws it. This
is what makes the scene *specifically* an endless siege and guarantees an
impressive result even if the texture is absent (graceful: layer 2 alone over the
chapter/flat ground still looks like a siege arena).

**Pure module — `src/core/endlessBackdrop.ts`** (Phaser-free, seeded, tested):

`buildEndlessBackdrop(arena, dims, seed): EndlessBackdropSpec` returns:

- `vignette` — radial focus: `{ cx, cy, innerR, outerR, edgeAlpha }`. Darkens the
  corners, leaves the castle bright (focus pull to center).
- `scars: Scar[]` — glowing **ley-line battle-scars**, one per gate, each a
  slightly jittered polyline from the central castle out toward that gate's mouth,
  with `width` and `glowColor`. Reinforces "roads of war converging on the heart."
  Derived from `arena.gates` so they always point at real siege directions.
- `castleRing` — `{ cx, cy, baseR, color }` the pulsing heart-aura under the
  castle.
- `embers: Ember[]` — N drifting motes with `{ x, y, r, speed, drift, alpha,
  phase }`; the presenter advances them each frame (rise + sine sway, wrap at
  top). Seeded layout → deterministic initial field.

All numbers are plain data (no Phaser types), so the module is fully unit-testable
and the geometry invariants (scar count = gate count, scars start at center & head
toward each gate, embers within bounds, determinism) are asserted in Vitest.

**Presenter — `src/scenes/fx/EndlessBackdropFx.ts`** (Phaser):

- Built once in `BattleScene.create()` only when `stage.arena` is present.
- Draws the static pieces (vignette gradient via stacked translucent rings, scars
  as glowing strokes, gate auras as soft red radial blobs) at depth just above the
  base image and below roads/units.
- `update(timeMs)` animates: embers rise/sway/wrap, the castle ring + gate auras
  breathe (sine pulse). Cheap — a handful of graphics redraws per frame, throttled
  like existing FX; the headless sim is never touched.
- Self-contained; destroyed/rebuilt with the scene like other FX.

### Why hybrid (rejected alternatives)

- **SDXL image only:** can't center focus on a *procedural* castle position, can't
  show siege lines toward *generated* gates, and is static. Misses "alive" and
  "from every direction toward this exact center."
- **Procedural only:** loses painted richness; the SDXL base adds texture depth a
  few Phaser primitives can't. Cheap to keep both.
- **Per-frame heavy particle system (Phaser particle emitters):** overkill;
  a fixed seeded ember field advanced arithmetically is deterministic, testable,
  and lighter. Matches the project's procedural-FX convention (MeleeFx, LootFlyFx).

## Integration points

- `src/data/bgManifest.ts` — add `"endless-siege"` to `BG_IMAGES`.
- `public/assets/bg/endless-siege.png` — generated art.
- `src/scenes/PreloadScene.ts` — already loops `BG_IMAGES`; no change needed
  beyond the manifest entry.
- `src/scenes/BattleScene.ts`:
  - `drawStatic()` — when `stage.arena` exists, prefer `bg__endless-siege` as the
    base image (over stageBg/chapter bg); build/refresh `EndlessBackdropFx`.
  - `update()` — call `endlessBackdropFx?.update(time)`.
  - Roads/gates/castle keep drawing on top exactly as today.
- New: `src/core/endlessBackdrop.ts`, `src/scenes/fx/EndlessBackdropFx.ts`,
  `tests/endlessBackdrop.test.ts`.

## Data flow

`endlessArenaStage` (existing) attaches `arena` →  `BattleScene.drawStatic` sees
`stage.arena`, swaps in the `bg__endless-siege` base and constructs
`EndlessBackdropFx(scene, buildEndlessBackdrop(arena, dims, seed))` → presenter
draws static siege geometry now and animates embers/pulses each `update`.

Seed = same stage-number seed used for the maze (`stageNumber(stage.id) || 1`), so
the scar/ember layout is stable and matches the arena it overlays.

## Testing

`tests/endlessBackdrop.test.ts` (pure module):
- Determinism: same `(arena, dims, seed)` → deep-equal spec.
- Vignette centered on `arena.center`.
- One scar per gate; each scar starts at the castle center and its far end lies
  toward the corresponding gate (dot-product / proximity check).
- Embers: count > 0, all within `dims`, alphas in (0,1].
- Castle ring centered on `arena.center`.

Plus: full existing suite stays green (campaign path has no `arena`, so the FX is
never constructed). CDP playtest confirms the backdrop renders, animates, and is
0-error; screenshot delivered.

## Out of scope

- Campaign backdrops (unchanged).
- Endless wave generation / scaling / rewards / economy (unchanged).
- New SDXL infrastructure (reuses the existing flow).
