# Hero Procedural Skeleton Rig — Design

**Status:** approved (autonomous session) — user chose "Option A, fully automated"
**Date:** 2026-06-20
**Author:** Claude (delegated session)
**Supersedes (battle hero only):** the Phase-C whole-body-tracking overlay rig in
`2026-06-20-hero-worn-dressed-doll-design.md`. The static doll/throne dressing
(Phase A/B) is untouched.

## Problem

The battle hero (`HeroLayeredSprite`) paints a fixed `hero__hero` spritesheet as
the body and hangs four worn-gear overlays on it via `heroBattleRig`. Because the
painted frames expose **no sub-frame joints**, gear can only track the body's
**overall** motion (position, vertical bob, facing) — not individual limbs. The
user's standing demand is: *"the equipments need to be placed exactly where they
should be, and when the hero moves the gear must follow the movement of body
parts."* Whole-body tracking does not satisfy "follow the body parts."

The user proposed the fix directly: *"just draw the worn visual, then calculate
the position of the worn outfit based on the motions, and you don't even need the
hero art."* i.e. build the character as a **procedural skeleton** whose bones are
animated in code, and **attach the worn art to the bones** so each piece inherits
its bone's per-frame transform — true per-limb tracking, no painted body sheet.

## Goal

Replace the battle hero's painted-body + whole-body-overlay approach with a
**procedural bone skeleton**:

- A bone hierarchy (pelvis → torso → head, two arms, two legs) animated by a pure
  function per state (idle / walk / attack / cast / hurt).
- A minimal procedural **base body** (drawn with Phaser `Graphics`: rounded
  capsule limbs + head) so an under-geared hero still reads as a body — no painted
  `hero__hero` dependency.
- Each **worn piece attaches to a bone** and inherits that bone's world transform
  (position, angle, scale, flip), so a helmet rides the head, a breastplate rides
  the torso, a gauntlet rides the hand, a boot rides the foot, the weapon rides
  the weapon hand — and they move with their limb through the walk/attack cycle.

Success = at battle scale the geared hero walks with swinging legs/arms, and every
worn piece visibly follows its own limb (boots step with the feet, weapon swings
with the arm), with the hero's *specific* equipped art shown — not a tier band.

## Chosen approach: procedural skeleton + per-limb worn art (Option A)

Front-facing 3/4 skeleton. Built in two independently-shippable phases.

### Considered alternatives (rejected)

- **Keep the painted hero, enrich overlays (status quo+).** Cannot track limbs —
  the exact limitation the user is asking to remove. Rejected.
- **Side-view true walk cycle.** Highest fidelity but demands a side-view art set
  and reads oddly for a top-down-ish TD camera; the existing front-facing worn art
  would all need re-shooting. Rejected as disproportionate.
- **Slice `hero-base.png` into limb sprites and rig those.** Real-art base, but
  rotating rectangular slices at joints produces cut-edge seams at 54px. Rejected
  in favour of clean procedural capsules (the worn art covers most of the body
  anyway, so the visible base is mostly neck/limbs/joints).

### Quality-at-scale note (accepted tradeoff)

The battle hero renders ~54px tall. A procedural capsule mannequin is less polished
than the painted SDXL hero, and per-limb articulation is subtle at that size. The
user explicitly chose this to get correct per-limb motion. **Mitigation:** a
single module-level switch (`USE_SKELETON_HERO` in `battleSceneSprites.ts`) selects
the skeleton vs. the retained `HeroLayeredSprite`, so reverting is one line and both
remain shippable.

## Phasing

### Phase 1 — Skeleton stands up, whole-piece art (ships independently)

Build the rig and animate it with the **existing** whole-piece worn art. Boots and
gloves are whole-piece ("a pair"), so in Phase 1 each attaches to **one
representative limb** (weapon-side hand / a foot midpoint) — head/torso/weapon/wings
get true per-bone tracking immediately; per-foot/per-hand splitting waits for Phase 2
art. No art regen, no `ASSET_VERSION` bump.

### Phase 2 — Per-limb worn art (fidelity upgrade, ships independently)

Regenerate **Gloves** and **Boots** as **single-limb** pieces (one gauntlet, one
boot) via the SDXL `worn` pipeline, mirrored L/R onto both hand bones / both foot
bones — so gear splits per-limb and steps with each foot. Helmet/BodyArmor/Weapon/
Wing keep their existing whole-piece art (already single-piece-correct). Bump
`ASSET_VERSION`, redeploy.

## Architecture

### Pure modules (Phaser-free, unit-tested)

| Module | Responsibility |
|--------|----------------|
| `src/data/heroSkeleton.ts` | Bone table (hierarchy + rest pose) + forward-kinematics `resolveSkeleton(boneAngles, size)` → per-bone world transforms |
| `src/data/heroSkeletonAnim.ts` | `poseSkeleton(state, phase, facing)` → per-bone **angle deltas** for idle/walk/attack/cast/hurt |
| `src/data/heroWornRig.ts` | `WORN_ATTACH` map (slot → bone + local offset/scale/flip) + `placeWorn(bones, size)` → per-slot placements; replaces `heroBattleRig.ts` |

#### Bone model

A `Bone = { id, parent, dx, dy, restAngle }`. `dx,dy` are the bone head's offset
from its parent's head **in fractions of body height H**, in the bone's parent
frame; `restAngle` is its rest rotation (deg, clockwise, y-down). Forward
kinematics: a bone's world position = parent world position + `rotate(parentWorld
Angle) · (dx,dy)·H`; world angle = parentWorldAngle + restAngle + animDelta. Origin
convention matches the container: local **y = 0 is 0.78 down the body** (so feet ≈
+0.22H, head-top ≈ −0.78H), and every bone is shifted by `hover` and mirrored by
`facing` exactly as `heroBattleRig` did.

Bone table (front-facing; `nx` = signed frac of width, `ny` = frac of height from
top, converted to local offsets in the module):

| id | parent | rest position (nx, ny) | notes |
|----|--------|------------------------|-------|
| `pelvis` | — (root) | (0, 0.52) | root; bobs with gait |
| `torso` | pelvis | (0, 0.34) | leans/breathes |
| `head` | torso | (0, 0.10) | helmet anchor |
| `armUpperL` | torso | (−0.13, 0.24) | hangs down |
| `armUpperR` | torso | (+0.13, 0.24) | weapon arm |
| `handL` | armUpperL | (−0.15, 0.50) | glove L anchor |
| `handR` | armUpperR | (+0.15, 0.50) | glove R + weapon anchor |
| `thighL` | pelvis | (−0.08, 0.52) | |
| `thighR` | pelvis | (+0.08, 0.52) | |
| `footL` | thighL | (−0.08, 0.92) | boot L anchor |
| `footR` | thighR | (+0.08, 0.92) | boot R anchor |

(Arms/legs are modelled as a single swing bone + a tip "hand"/"foot" node — two
joints per limb, enough for readable per-limb motion at 54px without an elbow/knee
IK solve.)

#### Animation (`poseSkeleton`)

Returns a `Partial<Record<BoneId, number>>` of **angle deltas** (deg) plus a root
`bob` (px-frac) per frame. Composed additively over rest:

- **idle**: torso breathing (tiny scale handled in presenter) + `bob = a·sin(t)`;
  arms/legs rest.
- **walk**: `thighL = A·sin(p)`, `thighR = A·sin(p+π)`; `footL/R` counter-bend so
  the lifted foot clears; `armUpperL = −B·sin(p)` (counter-swing), `armUpperR`
  counter-swings **unless** an attack one-shot owns the weapon arm; `bob =
  c·sin(2p)` (two falls per stride). `p` advances with **distance travelled**
  (like `enemyWalkTransform`) so a stopped hero stops stepping.
- **attack**: a normalized 0→1 timeline on the weapon arm (`armUpperR` + `handR`):
  wind-up then swing, per weapon family (reuse the family motion intent from
  `HeroLayeredSprite.REST_POSE`/`playAttack`); torso twists slightly.
- **cast**: weapon arm raises overhead + hold; torso rises.
- **hurt**: torso/pelvis recoil + small knock-back; one-shot.

One-shot priority is preserved (ATTACK < CAST < HURT over the locomotion base).

#### Worn attachment (`heroWornRig`)

`WORN_ATTACH: Record<slot, { bone, ox, oy, scale, baseAngle }>` — each worn piece's
local offset from its bone head, display scale (frac of H), and a base angle. Two
variants:

- **Phase 1 (whole-piece):** `Gloves → handR`, `Boots → footR` (single
  representative limb); `Helmet → head`, `BodyArmor → torso`, `Weapon → handR`,
  `Wing → torso (behind)`.
- **Phase 2 (per-limb):** `Gloves` splits to `handL` + `handR`, `Boots` to `footL`
  + `footR`, each mirrored (L flips X). Driven by a `perLimb` flag so Phase 2 is a
  data change, not a rewrite.

`placeWorn(boneWorldTransforms, size, facing) → WornPlacement[]` where
`WornPlacement = { slot, key?, x, y, displayH, angle, flipX, depth, behind }`.
Stable depth order: wings/behind → base body → boots → body armor → gloves →
helmet → weapon.

### Presenter

`src/scenes/HeroSkeletonSprite.ts` — a Phaser `Container`, **drop-in replacement**
for `HeroLayeredSprite` (identical public API so `battleSceneSprites` swaps the
class behind `USE_SKELETON_HERO`):

```
constructor(scene, x, y) · addToWorld(world) · play(animKey, ignoreIfPlaying?)
tick(now, moving, facingLeft?) · playAttack() · playCast() · playHurt()
syncEquipment(inventory: InventorySave) · scaleToHeight(px): this
setDepth · setPosition · setVisible · getBodySprite(): Sprite
get currentAnimKey · get wornGearVisible · readonly petSprite
```

Internals each frame:
1. Pick state (idle/walk via `moving`+`hasWings`; attack/cast/hurt one-shots with
   the existing priority/generation guard).
2. Advance `phase` from `now` + distance moved since last frame.
3. `delta = poseSkeleton(state, phase, facing)`; `bones = resolveSkeleton(delta,
   size, hover)`.
4. Draw the **base body**: a single pooled `Graphics` redrawn each frame as capsules
   between consecutive bone heads (torso, two arms, two legs) + a head circle, in a
   neutral cloth/skin tone with a soft outline. (Kept under the worn sprites.)
5. `placeWorn(bones, size, facing)` → position each worn `Sprite` (textured in
   `syncEquipment`, exists-gated `worn__<id>` → `item__<id>` fallback).
6. Weapon sprite at `handR`; wings behind torso (keep the existing flap tween);
   pet wander unchanged (reuse the existing routine).

`getBodySprite()` returns a small invisible anchor `Sprite` at the torso (battle
code flashes/recolours it on hit and reads it as the hero hit-target) so the
external `flash()` / hurt wiring keeps working.

File-size: the presenter stays < 500 lines by keeping ALL geometry/animation in the
three pure modules; if it approaches the cap, split the base-body drawing into
`heroSkeletonBody.ts`.

### Art (Phase 2)

`scripts/sdart/prompts.mjs`: add single-limb framings used when a `--limb=single`
(or per-slot `WORN_FRAMING_SINGLE`) variant is requested:

- `Gloves` → "shown alone as a **single** empty gauntlet/glove for one hand, no
  hand inside, three-quarter front view, centered, hollow".
- `Boots` → "shown alone as a **single** empty boot for one foot, no foot inside,
  three-quarter front view, centered, hollow".

`scripts/sdart/sdgen.mjs` `worn` kind: when generating Gloves/Boots, use the single
framing (output stays `worn/<id>.png`, 128×128, transparent-cut). Regenerate the 27
Gloves + 22 Boots; rebuild `wornManifest.ts`; bump `ASSET_VERSION`; redeploy.

## Data flow

`InventorySave.equipped` → `resolveHeroLayers` (gear keys, unchanged) →
`HeroSkeletonSprite.syncEquipment` textures the worn sprites → each `tick()`:
`poseSkeleton` → `resolveSkeleton` → `placeWorn` → sprites positioned on their
bones → the hero walks/attacks with gear following each limb.

## Testing

- **`tests/heroSkeleton.test.ts`** (pure): FK resolves the tree deterministically;
  child world position = parent + rotated offset; facing mirrors x and flips; root
  `hover` shifts all bones; head is above pelvis is above feet in local y.
- **`tests/heroSkeletonAnim.test.ts`** (pure): walk gives `thighL`/`thighR` opposite
  signs and they cross zero antiphase; a stopped phase (`p` constant) holds the
  pose; attack timeline starts and returns to rest (delta→0 at t=0 and t=1); state
  priority (hurt overrides attack).
- **`tests/heroWornRig.test.ts`** (pure): every body slot maps to a bone inside the
  body box; Phase-1 boots/gloves attach to one limb, Phase-2 split to two with one
  flipped; depth order behind→front; accessories excluded; worn-key with icon
  fallback shape preserved.
- **Guard:** `wornTex` built only via `assetKeys.ts` (existing discipline test).
- **CDP repro** (`scripts/playtest/repro_skeleton_hero.mjs`, adapted from
  `repro_worn_rig.mjs`): equip a full loadout, start battle, zoom hero, screenshot
  idle/walk/attack, assert `wornGearVisible` and that leg bones actually move
  between frames (capture two walk frames and diff a bone y).
- Full `tsc` + vitest + eslint (max-lines 500) + `lint:cycles` 0 + build before each
  deploy.

## Out of scope

- The static **doll** (`HeroScene`) and **throne** (`MainMenuScene`) dressing —
  unchanged (Phase A/B still own those fixed figures).
- Elbow/knee **IK** (two-joint solve). The single swing-bone + tip per limb is
  enough at battle scale; can add later if needed.
- Accessories (Ring/Amulet/Pet) worn art — keep icon/orbit treatment.
- Save schema changes (none — reads existing `equipped`).
- Deleting `HeroLayeredSprite.ts` — retained as the fallback behind the switch.

## Risks & mitigations

- *Procedural body looks worse than the painted hero at 54px.* → `USE_SKELETON_HERO`
  switch keeps the painted rig one line away; tune capsule shading/proportions; worn
  gear covers most of the body.
- *Walk/attack reads janky.* → couple gait phase to real distance (proven on
  enemies); reuse weapon-family attack motion intent; clamp swing amplitudes.
- *Presenter exceeds 500 lines.* → geometry/anim are external pure modules; split
  base-body drawing out if needed.
- *Phase-2 per-limb art mis-frames.* → exists-gated with icon fallback; per-slot
  single framing + per-bone scale handle alignment; partial batch ships safely.
- *Cache staleness.* → bump `ASSET_VERSION` in Phase 2 (busting already in place).
```

