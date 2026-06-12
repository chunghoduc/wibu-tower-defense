# Enemy Art → SDXL + Procedural Walk (retire SVG genart)

**Date:** 2026-06-12
**Status:** Approved (full-auto session — author is the approver)
**Supersedes:** `2026-06-12-enemy-walk-articulation-design.md` (the articulated-SVG approach this reverses)

## Problem

The game has **three** art-generation pipelines, only one of which we actually want:

1. **`scripts/sdart/` (SDXL / z-image-turbo)** — the local GPU image API at
   `http://127.0.0.1:8765/generate` (model `z-image-turbo`). This produced the
   current **tower**, **hero**, **boss**, **item** and **skill** art: clean
   cel-shaded anime, high quality, stylistically consistent. This is the flow we keep.
2. **`scripts/svgart/` + `scripts/pixelart/` (SVG / pixel-art composer)** —
   deterministic vector/pixel art. Its only remaining product is the **enemy**
   sprite sheets (`composeEnemyFrames` / `reposeFrame` / `ENEMY_POSES`), including
   the articulated 4-frame walk shipped earlier today.
3. **`scripts/genSprites.ts` + `src/art/*` (Ollama pixel-grid)** — a dormant
   LLM-grid generator wired to `npm run gen:sprites`. No runtime code imports it
   (verified by grep); it is generation-only and unused.

The result is a visible **style clash**: towers/hero/bosses are polished z-image
anime, while enemies are flat pixel art from a different pipeline. The owner's
instruction: _stop using SVG genart, remove it, and use the SDXL flow for all art_ —
starting by redoing the enemy walk with SDXL.

### Evidence (probe generations, this session)

- A single z-image **base sprite** of an enemy (undead grunt, 768×1024 → cutout
  300×300) is excellent and matches the tower/hero art style exactly. ~26s/sprite.
- A z-image **animation sheet** (1536×640) yields 12 recognizable poses of the same
  character, but at **variable scale, with overlap, and no controlled walk order** —
  the slicer (`sliceanim.py`) classifies whatever full-body blobs it finds as
  `idle/atk/skill`, never a clean `walk1..walk4` loop. Diffusion cannot author a
  reliable walk cycle.

**Conclusion:** the dependable, best-looking SDXL approach to "lively enemy
walking" is a **single clean base sprite + an enhanced procedural walk driver**,
not authored diffusion frames. This is the same two-layer model the engine already
uses (`animateEnemy` transform motion over a static sprite) — it just gets better art.

## Goal

1. Enemies render in the **same z-image-turbo art style** as the rest of the game.
2. Their walk reads as **lively** — carried by an improved procedural locomotion
   driver, since legs are no longer authored per-frame.
3. **SVG genart is removed** (scripts + memory), and the non-SDXL Ollama generator
   with it. `npm run gen:sprites` points at the SDXL pipeline. SDXL is the single
   art flow going forward.
4. No regressions: typecheck, full test suite, and build stay green; enemies load,
   move, attack, die, and survive scene re-entry without crashing on the now-missing
   `walk/atk/hurt` sprite-sheet frames.

## Non-goals

- **Not** regenerating towers/hero/bosses/items — they are already SDXL art and look
  good. (Future regen uses the SDXL flow; that's the standing rule, not this task.)
- **Not** attempting authored diffusion walk frames (proven unreliable above).
- **Not** changing enemy gameplay, stats, spawn logic, or combat rules.

## Design

### A. Art: enemies become single z-image base sprites

- Use the existing `scripts/sdart/sdgen.mjs --only=enemy --force` path. It already
  enumerates `ENEMY_VISUAL` (20 enemies), generates at 768×1024, and cuts out to a
  300px transparent PNG via `cutout.py`. Seeds are deterministic (hash of id), so
  regeneration is reproducible.
- Output: `public/assets/sprites/enemy/<id>.png` — a **single-frame** sprite
  (300×300), replacing the 8-frame 1024×128 pixel sheets.
- `src/data/spriteManifest.ts` enemy entries become
  `{frameWidth:300,frameHeight:300,frames:1,names:["idle"]}` for each enemy. This is
  produced by the manifest builder reading the new `.json` sidecars (or written
  directly); the contract is "one idle frame".

### B. Runtime: enhanced procedural walk

The walk liveliness moves entirely into `animateEnemy` (in
`src/scenes/battleSceneSprites.ts`). To keep it testable and within the file-size
rule, extract the math into a **pure, Phaser-free module**:

- **`src/scenes/enemyWalkTransform.ts`** — `enemyWalkTransform(phase, opts)` returns
  `{ yOff, xOff, angle, scaleX, scaleY, shadow }` from a 0..1 locomotion phase.
  Pure function, no engine deps, fully unit-tested.
  - **Step bounce**: vertical bob `yOff` on a `sin` of the stride (restored to a
    fuller amplitude than the trimmed articulated version, since no authored legs now
    carry the step).
  - **Squash & stretch**: `scaleY`/`scaleX` vary inversely around 1.0, peaking at
    ground-contact (bottom of the bob) — gives weight without legs.
  - **Waddle & lean**: small `xOff` sway and `angle` rock, phase-shifted from the bob.
  - **Contact shadow**: `shadow` scalar (0..1) that widens/darkens at ground contact,
    reinforcing the step.
  - Amplitudes scale by a caller-supplied factor `A` (speed/boss aware), matching the
    current `animateEnemy` contract.
- `animateEnemy` calls `enemyWalkTransform`, applies the offsets to the sprite
  transform and the existing ground-shadow object, and is otherwise unchanged.

### C. Single-frame safety in the sprite/anim layer

Removing `walk/atk/hurt` frames must not crash the runtime:

- **`PreloadScene`** builds anims by regex over each manifest entry's frame names.
  With only `idle`, only an idle anim is created — already its behavior; verify it
  produces no empty/invalid anim for enemies.
- **`playSpriteOneShot`** (in `battleSceneSprites.ts`) tries a list of anim names with
  fallback and returns enemies to a `walk` base. Update the enemy base fallback to
  `idle`, and make the helper a no-op when none of the requested anims exist (so
  enemy attack/hurt FX calls degrade gracefully to the existing particle/flash FX and
  procedural lunge, rather than throwing).

### D. Remove SVG genart + Ollama generator

- Delete `scripts/svgart/` and `scripts/pixelart/` in full.
- Delete `scripts/genSprites.ts` and the generation-only Ollama modules under
  `src/art/` **that nothing else imports** (precise consumer scan in the plan; keep
  any pure module still referenced by kept tests/runtime, delete the rest with their
  tests).
- Delete `tests/enemy-walk.test.ts` (it asserts the removed `composeEnemyFrames`
  articulation) and any pixelart/Ollama-only tests rendered dead by the deletions.
- **`package.json`**: repoint `gen:sprites` to the SDXL base-sprite generator
  (`vite-node scripts/sdart/sdgen.mjs`); drop `gen:art-prompts` if it only served the
  Ollama path. Keep `gen:item-visual` / `gen:skill-visual` (they feed SDXL).

### E. Memory / docs

- Rewrite `reference_playtest_and_art.md`: regenerate art via the SDXL flow
  (`npm run gen:sprites` → `scripts/sdart/sdgen.mjs`), not `scripts/svgart/gen.mjs`.
- Rewrite `project_procedural_sprite_animation.md`: drop the 2026-06-12 "articulated
  SVG walk" EXCEPTION; the rule that **procedural transform carries enemy motion** is
  reinforced — enemies are now single SDXL frames + procedural walk.
- Add a memory establishing **SDXL (`scripts/sdart/`) as the single art pipeline**;
  SVG/pixel-art and Ollama generators are removed.

## Testing

- **Unit (TDD, RED first)**: `tests/enemy-walk-transform.test.ts` for
  `enemyWalkTransform` — phase 0 vs 0.5 differ; bob is bounded; squash/stretch is
  inverse around 1.0 and peaks at contact; amplitude scales with `A`; output is
  finite for all phases.
- **Integration/regression**: full `vitest run` stays green after deletions
  (no dangling imports); `tsc --noEmit` clean; `vite build` succeeds.
- **Manifest**: a check that every enemy manifest entry is `frames:1 / names:["idle"]`
  and points at an existing PNG.
- **Playtest (CDP, `window.__game`)**: start a battle, confirm enemies spawn in the
  new art style, bob/squash while walking, take hits, and die without console errors;
  re-enter the scene (re-entry reset rule) without crashing.

## Files touched

- **Add**: `src/scenes/enemyWalkTransform.ts`,
  `tests/enemy-walk-transform.test.ts`, this spec, the plan.
- **Edit**: `src/scenes/battleSceneSprites.ts` (animateEnemy + playSpriteOneShot
  fallback), `src/data/spriteManifest.ts` (enemy entries), `package.json` (scripts),
  memory files.
- **Regenerate**: `public/assets/sprites/enemy/*.png` + `.json` (20 enemies, SDXL).
- **Remove**: `scripts/svgart/`, `scripts/pixelart/`, `scripts/genSprites.ts`,
  unused `src/art/*` + their tests, `tests/enemy-walk.test.ts`.
