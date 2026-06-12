# Castle Visual Redesign (SDXL) — Design Spec

**Date:** 2026-06-12
**Status:** Approved (full-auto session — author's engineering judgment is the approval gate)

## Problem

The castle — the structure the player defends — is the visual focal point of every
battle's end-of-lane, yet it renders as a flat 48×48 blue rectangle drawn with raw
Phaser graphics (`BattleScene.ts:345-348`). It has never been part of the SDXL art
pipeline. It reads as a placeholder, not a fortress worth defending, and gives no
visual feedback as it takes damage.

## Goal

Replace the rectangle with a hand-art-quality SDXL-generated fortress sprite that
(a) looks cool and matches the game's cel-shaded anime art direction, and (b) reads
its own health at a glance by swapping to a **battle-damaged** variant when low.

## Non-Goals (YAGNI)

- No castle health-bar redesign — the HUD `Castle N` readout stays.
- No per-chapter castle variants — one castle, two HP states, for all stages.
- No new sprite-manifest churn — the castle loads as two plain static images
  (like the main-menu icons / hero-doll), not animated spritesheets.
- No damage-flash/tint polish, no idle animation (it is a static building).

## Approach

A new SDXL **`structure`** sprite kind with one id (`castle`) producing two state
files: `castle.png` (intact) and `castle__damaged.png` (battle-worn). The render
layer swaps between them on a pure HP→state threshold, and falls back to the legacy
rectangle whenever the texture is absent (keeps build/tests green before art is
generated and survives a GPU-less environment).

### 1. Art generation (`scripts/sdart/`)

`prompts.mjs` gains:

```js
export const STRUCTURE_VISUAL = {
  castle: "a heroic fantasy stronghold keep, a tall central tower flanked by two
    turrets, crenellated stone battlements, a grand arched gate, blue conical
    rooftops, proud blue-and-gold banners, a glowing magical core over the gate,
    three-quarter front view, grounded",
};
// state suffixes applied to the base look
export const STRUCTURE_STATE = {
  intact: "pristine and proud, banners flying, warm glowing windows, magical core
    shining bright",
  damaged: "battle-damaged, cracked and crumbling walls, rubble, torn banners,
    rising smoke and embers, the magical core dim and flickering",
};
```

`sdgen.mjs buildJobs()` emits two jobs:

```js
for (const [id, v] of Object.entries(STRUCTURE_VISUAL)) {
  const sd = seedOf(id);
  jobs.push({
    kind: "structure",
    id,
    file: `${id}.png`,
    prompt: style(`${v}, ${STRUCTURE_STATE.intact}`),
    seed: sd,
    w: 768,
    h: 768,
    size: 256,
  });
  jobs.push({
    kind: "structure",
    id,
    file: `${id}__damaged.png`,
    prompt: style(`${v}, ${STRUCTURE_STATE.damaged}`),
    seed: sd,
    w: 768,
    h: 768,
    size: 256,
  });
}
```

768×768 (a square building, not a tall character) → 256px cutout. Same seed for both
states so the two share silhouette/identity. Output:
`public/assets/sprites/structure/castle.png` + `…/castle__damaged.png`.
`--only=structure` filters to just these.

### 2. Asset-key registry (`src/data/assetKeys.ts`)

```ts
/** Battle-world structure sprite (castle, …). */
export const structureTex = (id: string): string => `structure__${id}`;
export const CASTLE_TEX = structureTex("castle");
export const CASTLE_DAMAGED_TEX = structureTex("castle__damaged");
```

`tests/assetKeyDiscipline.test.ts` regex extends to include `structure` so no other
file may inline a `structure__${...}` key.

### 3. Pure HP→state seam (`src/scenes/castleArt.ts`) — TDD target

Phaser-free, unit-tested:

```ts
export type CastleState = "intact" | "damaged";
/** Damaged once castle is at or below half health (and still standing). */
export function castleArtState(hp: number, maxHp: number): CastleState;
export function castleTexForState(state: CastleState): string; // → CASTLE_TEX / CASTLE_DAMAGED_TEX
```

Rules:

- `maxHp <= 0` → treat as intact (degenerate guard, no divide-by-zero).
- `hp / maxHp <= 0.5` → `"damaged"`, else `"intact"`.
- `hp` clamped: negative HP still reports `"damaged"` (castle is rubble at 0).

### 4. Battle state (`src/core/battle.ts`)

Add `readonly castleMax: number` set to `stage.castleHp` at construction, so the
render layer can compute the HP fraction without re-reading stage data.

### 5. Render (`src/scenes/BattleScene.ts`)

- Remove the rectangle from the static terrain draw; instead add a persistent
  castle `Phaser.GameObjects.Image` once (in scene setup) at `battle.castlePos`,
  depth just below units, scaled so its widest side reads at ~110px in-world.
- If `CASTLE_TEX` does not exist in the texture manager, keep the old rectangle
  (graceful fallback — drawn into the existing terrain graphics).
- Each render tick, compute `castleArtState(battle.castleHp, battle.castleMax)` and
  set the image texture to `castleTexForState(state)` only when it changes (avoid
  redundant `setTexture` churn).

### 6. Preload (`src/scenes/PreloadScene.ts`)

Load both images directly (guard-free; a missing file degrades to the rectangle
fallback, Phaser does not crash):

```ts
this.load.image(CASTLE_TEX, "assets/sprites/structure/castle.png");
this.load.image(CASTLE_DAMAGED_TEX, "assets/sprites/structure/castle__damaged.png");
```

### 7. Generate the art

Run `npm run gen:sprites -- --only=structure` (the real SDXL flow on the local GPU).
If the SD server (`127.0.0.1:8765`) is unreachable, all code still builds and tests
pass via the rectangle fallback; the art is then a one-command regen.

## Testing

- `tests/castleArt.test.ts` — `castleArtState` across the boundary (full, 51%, 50%,
  49%, 0, negative HP, `maxHp=0` guard) and `castleTexForState` key mapping.
- `tests/assetKeys.test.ts` — `structureTex` shape + `CASTLE_TEX`/`CASTLE_DAMAGED_TEX`
  constants.
- `tests/assetKeyDiscipline.test.ts` — already-existing guard now covers `structure`.
- Full suite + `tsc --noEmit` + `vite build` green.
- CDP self-playtest: enter a battle, confirm the castle sprite renders and swaps to
  the damaged art after leaks drop it below half.

## Files Touched

| File                                                          | Change                                               |
| ------------------------------------------------------------- | ---------------------------------------------------- |
| `scripts/sdart/prompts.mjs`                                   | + `STRUCTURE_VISUAL`, `STRUCTURE_STATE`              |
| `scripts/sdart/sdgen.mjs`                                     | import + `buildJobs()` structure jobs                |
| `src/data/assetKeys.ts`                                       | + `structureTex`, `CASTLE_TEX`, `CASTLE_DAMAGED_TEX` |
| `src/scenes/castleArt.ts`                                     | **new** pure state module                            |
| `src/core/battle.ts`                                          | + `readonly castleMax`                               |
| `src/scenes/BattleScene.ts`                                   | rectangle → image + per-tick state swap + fallback   |
| `src/scenes/PreloadScene.ts`                                  | load the two structure images                        |
| `tests/castleArt.test.ts`                                     | **new**                                              |
| `tests/assetKeys.test.ts`, `tests/assetKeyDiscipline.test.ts` | extend coverage                                      |
| `public/assets/sprites/structure/castle*.png`                 | **new** generated art                                |
