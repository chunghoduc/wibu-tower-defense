# Fix & Redesign Broken Tower Art — Design Spec

Date: 2026-06-12
Status: Approved (full-auto; decisions made by implementer per standing delegation)

## Problem

The user reports "some towers' art are broken (lack of frame, look bad)" and asks to
verify all towers, redesign the broken ones, and "make them super cool and impressive."

## Verification (all 53 towers audited)

I parsed `src/data/spriteManifest.ts`, compared every tower entry's declared
`frameWidth × frames` against the real PNG pixel dimensions, and rendered montages of
every tower's frames (`/tmp/tower_montage_all.png`, `/tmp/tower_broken_frames.png`,
`/tmp/tower_ok_A.png`, `/tmp/tower_ok_B.png`).

Findings:

- **Dimensions are internally consistent** for all 53 (no manifest↔PNG width/height
  mismatch, so the 96×96-style silent-crop bug is NOT present here).
- **46 towers are good**: full 8-frame sheets, consistent character across frames,
  vibrant, clean silhouettes. No redesign needed.
- **7 towers are broken** — they have FEWER than the standard 8 frames, and the
  visible frames carry real defects:

  | id                       | frames | observed defect                                                                              |
  | ------------------------ | -----: | -------------------------------------------------------------------------------------------- |
  | seren-skyfall            |      1 | single static muddy frame, no atk/skill poses                                                |
  | auriel-wardlight         |      2 | idle is a blonde queen-cleric, atk1 is a _different_ orange figure (character inconsistency) |
  | lyran-ricochet           |      2 | dark / low-contrast / muddy                                                                  |
  | vesska-venombolt         |      3 | skill frame is a faded semi-transparent ghost                                                |
  | rivka-rebound            |      4 | atk/skill frames ghosted (failed background cutout)                                          |
  | aya-dawnshot             |      5 | consistent & decent, but missing 3 frames                                                    |
  | garron-unbreaking-pillar |      7 | consistent & good, missing 1 frame                                                           |

## Root cause

The anim pipeline (`scripts/sdart/animgen.mjs` → `sliceanim.py`) generates all of a
character's frames in ONE txt2img pass (z-image-turbo) as a horizontal strip, then
`sliceanim.py` background-removes (rembg), finds connected components, keeps
"portrait full-body figures," and packs them into a uniform sheet.

For these 7, that single pass produced figures that either:

- **merged** (touching/overlapping) → counted as one wide blob and dropped by the
  portrait filter (`height ≥ 1.05 × width`), or
- were **too faint / low-contrast** → fell below the min-pixel area, or survived with
  partial alpha and packed as a **ghost** frame.

So the slicer yielded < 8 frames. The 46 good towers prove the pipeline is sound; the
7 got unlucky seeds. The homage descriptors in `prompts.mjs` are already detailed and
correct — this is a generation/slicing robustness problem, not a prompt-content problem.

## Goal

Bring all 7 broken towers up to a clean, consistent, vibrant **8-frame** sheet
(2 idle + 3 atk + 3 skill), matching the 46 good towers, with no ghost/merged/
inconsistent frames — i.e. "super cool and impressive" and at parity with the roster.

## Approach (chosen)

**Regenerate full 8-frame animation sheets** for the 7, through the existing SDXL anim
pipeline, hardened so each tower reliably yields exactly 8 clean, fully-opaque,
consistent frames.

Considered and rejected:

- _Single crisp static pose per tower (enemy-style) + procedural `animateTower`_:
  reliable, but drops the atk/skill frame swap the other 46 towers have → breaks
  roster parity and doesn't literally answer "lack of frame." Rejected for parity.
- _Hand-fix the prompts only_: the descriptors are already good; re-running the same
  deterministic seed would reproduce the same merge/ghost. Insufficient alone.

### Mechanism

1. **Ghost-frame guard in `sliceanim.py`** — after component detection, reject any
   kept figure whose mean alpha over its bounding box is below a threshold (the faded
   cutouts). This removes the rivka/vesska ghost frames at the source. Pure addition;
   existing 46 sheets are not re-run, so they are unaffected.

2. **Seed-retry harness** (a small standalone regen script, `scripts/sdart/regen_towers.mjs`,
   or a `--retry`/`--ids` mode on animgen) — for each target tower, try a sequence of
   seeds; accept the FIRST sheet that slices to exactly 8 frames all passing the ghost
   guard. Bounded attempts (e.g. up to ~10 seeds). Record the winning seed per tower in
   an override map so the result is reproducible.

3. **Manifest sync** — `spriteManifest.ts` is hand-maintained (per project memory), so
   after regen, patch the 7 tower entries to match their regenerated `<id>.json`
   (`frames: 8`, canonical `names`). A small sync step reads the JSON sidecars and
   rewrites just those 7 entries.

### Quality / "impressive" bar

Identity is preserved (same homage descriptor → same character). "Impressive" is met by
(a) full 8-pose animation restored, (b) zero ghost/merge/inconsistency, (c) vibrant
cel-shaded output at parity with the best of the existing roster. Descriptors may be
lightly enriched only where doing so does not change character identity; primary lever
is accepting a clean seed.

## Testable contract (TDD)

`tests/towerSpriteManifest.test.ts` (Vitest, Phaser-free) asserts, for every
`kind === "tower"` entry in `SPRITE_MANIFEST`:

- `frames === 8`
- `names.length === frames`
- `names` follow the canonical idle/atk/skill pattern (2 idle, 3 atk, 3 skill).

This is RED today (the 7 fail) and GREEN after regen + manifest sync. It locks the fix
and prevents any future tower from shipping with missing frames.

## Out of scope

- The 46 good towers (verified fine — untouched).
- Enemy/boss/item art.
- Any engine/render change — towers keep `towerTex(id)` + the existing
  idle/attack/skill anim build in `PreloadScene` and procedural `animateTower`.

## Risks

- Generation is stochastic and GPU-bound. The seed-retry harness bounds attempts;
  z-image-turbo produces clean 8-figure sheets for 46/53 towers, so a clean seed within
  a handful of tries is expected. SD server confirmed up (`/health` → ready).
- If a tower cannot reach a clean 8 within the attempt budget, fall back to the best
  sheet obtained (never worse than current) and flag it; the Vitest contract surfaces
  any shortfall rather than letting it pass silently.

## Deliverables

- Hardened `sliceanim.py` (ghost-frame guard).
- Regen harness producing 8-frame sheets for the 7 towers + recorded seeds.
- 7 regenerated `public/assets/sprites/tower/<id>.png` + `<id>.json`.
- Patched `spriteManifest.ts` (7 entries).
- `tests/towerSpriteManifest.test.ts` (RED→GREEN).
- Before/after montage sent to chat.
