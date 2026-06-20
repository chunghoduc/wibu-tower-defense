# Hero "Worn Look" — Dressed Paper-Doll Design

**Status:** approved (autonomous session)
**Date:** 2026-06-20
**Author:** Claude (delegated session)

## Problem

Players cannot see their equipped gear *worn on the hero*. The "worn look" has
never actually worked. Deep research found three hero representations, none of
which dress the hero:

1. **Throne hero** (`MainMenuScene`) — swaps to a full-body weapon-family pose
   (`hero__bow/fist/gun/staff`) but reflects **nothing else**; armor/accessories
   are parked on wall hangers. `dressHero.ts` exists but is **dead code**.
2. **Battle hero** (`HeroLayeredSprite`) — animated rig + a small weapon **icon**
   in hand + wing icon + pet. Worn armor is deliberately **not** composited (a
   code comment notes flat inventory icons "read as stickers").
3. **Equipment paper-doll** (`HeroScene`) — a **fixed mannequin** (`hero-base.png`)
   with equipped item icons placed at body anchors as **uniform 40px square
   tiles**. Reads as an inventory grid laid over a silhouette, not a dressed body.

The proper fix designed earlier (`2026-06-09-hero-rig-equipment-plan-b.md`,
socket-tracked worn art) was **never executed**, and its pixel-rig substrate
(`scripts/svgart`, `scripts/pixelart`) was **deleted** when the project went
SDXL-only. So today there is no worn-art pipeline and no compositing layer.

**Why prior attempts failed:** they reused **inventory icons** (framed for tiles —
padding, occasional 3/4 angle, square chrome) as body overlays, and tried to do it
on the **animated** battle rig where overlays swim frame-to-frame without joint
sockets. Both problems vanish on a **fixed** hero figure with **purpose-framed**
worn art.

## Goal

Make equipped gear **visibly worn** on the hero on the two **fixed** hero figures
where compositing is reliable:

- the **equipment paper-doll** (`HeroScene`) — the literal "your gear" screen, and
- the **home throne hero** (`MainMenuScene`) — the marquee place the hero is shown.

The **animated battle hero is explicitly out of scope** this round (no joint
sockets → unreliable; keep its current weapon/wing/pet behaviour).

Success = on both fixed figures, a geared hero shows a helmet on its head, a
breastplate on its torso, a weapon in hand, boots at the feet, wings behind,
etc. — integrated onto the body, not square tiles and not a bare knight.

## Approach (chosen)

**A shared, pure "dress the hero" compositing system** feeding two presenters
(doll + throne), backed by **purpose-built SDXL worn-overlay art generated per
gear item**, composited at **body-region anchors** over a clean full-body hero
base. One source of truth replaces the two divergent ad-hoc layouts
(`DOLL_SLOTS` tiles and dead `dressHero` anchors).

### Considered alternatives (rejected)

- **Pre-composed hero per (weapon × armor-tier).** Reliable (full art, no
  compositing) but does **not** show your *specific* gear — only a tier band — and
  needs full animated sheets for battle. Rejected: it's "appearance tiers," not a
  worn look.
- **Per-item worn art on the animated battle rig (Plan B revived).** Requires
  per-frame joint sockets the SDXL rig doesn't have; the substrate was deleted.
  Rejected as unreliable/out-of-scope.
- **Keep reusing inventory icons, just composite them better.** This is exactly
  Phase A below — kept as the de-risking first step, but **not** the end state,
  because icons-as-worn are what previously read as stickers.

## Phasing (each phase independently shippable)

### Phase A — Dressed compositing with existing icons (makes it *work*, low-risk)

Turn both fixed figures into a dressed paper-doll using the **existing** item
icons composited as worn gear — no new art yet. This alone converts "square tiles
/ bare hero" into "a hero wearing gear" and is fully verifiable.

- **`src/data/heroDressLayout.ts`** (PURE, Phaser-free, unit-tested): the single
  source of truth. Given the equipped map + a body box `{x,y,w,h}`, returns an
  ordered list of worn-layer placements:
  `{ slot, textureKey, cx, cy, scale, depth, behind }`.
  - Body-region anchors per slot (head / neck / torso / hand / hands / feet / back
    / orbit) with per-slot **scale** sized to the body part (helmet ≈ head width,
    body ≈ torso, etc.) — NOT a uniform tile size.
  - Correct back→front **depth** order (wings/pet behind → body → armor → weapon).
  - Resolves the worn texture key via `wornTex(id)` **with icon fallback**
    (`itemTex(id)`), so Phase B art swaps in transparently, exists-gated.
  - Subsumes `DOLL_SLOTS` (the doll keeps its drop-zone anchors from the same
    table) and replaces the dead `dressHero.ts` `OUTFIT` table.
- **`src/data/assetKeys.ts`**: add `wornTex = (id) => `worn__${id}`` (sole key
  builder rule preserved).
- **`HeroScene` doll presenter**: render worn layers from `heroDressLayout` over
  the mannequin (drop the square tile chrome for equipped gear; keep empty-slot
  ghost markers + the existing drag/equip **Zones** unchanged so equipping still
  works). A soft contact shadow per layer to kill the "sticker" flatness.
- **`MainMenuScene` throne presenter**: revive dressing — compose worn layers over
  the throne hero (which already shows the weapon-family pose). Wings/pet keep
  their existing treatment; helmet/body/gloves/boots become worn layers.
- No art change, **no ASSET_VERSION bump** in Phase A.

### Phase B — Purpose-built worn art ("tons of art", fidelity upgrade)

Generate front-facing, transparent, slot-framed worn overlays per gear item so
the composited gear reads as worn armor rather than a repurposed icon.

- **`scripts/sdart/sdgen.mjs`**: add a `worn` job kind that, for each **body-slot**
  item (Weapon, Helmet, BodyArmor, Gloves, Boots, Wing — accessories excluded),
  emits `public/assets/sprites/worn/<id>.png` from a **slot-specific worn prompt**
  built from the item's existing `appearance.look` (reuse `itemVisual.json`):
  e.g. *"the <look>, worn/held front-facing and centered, filling the frame, plain
  flat lighting, transparent background, no character, no body"*. Transparent-cut
  like other kinds.
  - Rollout order by silhouette impact: **BodyArmor (48) → Helmet (37) →
    Weapon (106) → Gloves (27) → Boots (22) → Wing**. Exists-gating means partial
    batches ship safely; un-generated items keep the icon fallback.
- **Loader**: worn art is loaded **catalog-driven** in `PreloadScene` (one
  `load.spritesheet(wornTex(id), …/worn/<id>.png, 128×128)` per body-slot
  catalog item, gated by the exported `WORN_SLOTS`, `loaderror`-swallowed) —
  mirroring how item icons load. This was chosen over the planned
  `spriteManifest`/`sync_manifest` rewrite because items themselves never went
  through the manifest; a partial batch ships safely (missing file → icon
  fallback via `wornTex`→`itemTex`). No manifest churn.
- **`assetVersion.ts`**: bump `ASSET_VERSION` (new PNGs shipped) + redeploy.

## Components & boundaries

| Unit | Responsibility | Pure? |
|------|----------------|-------|
| `heroDressLayout.ts` | equipped + body box → ordered worn placements | ✅ pure, tested |
| `assetKeys.wornTex` | the `worn__<id>` key (sole builder) | ✅ |
| `heroDoll.ts` | drop-zone anchors (kept; may re-export from layout) | ✅ |
| HeroScene doll presenter | draw worn layers + keep drag zones | Phaser |
| MainMenuScene throne presenter | draw worn layers on throne hero | Phaser |
| `sdgen.mjs` worn kind | emit per-item worn PNG from `appearance.look` | offline |

## Data flow

`InventorySave.equipped` → `heroDressLayout(equipped, bodyBox)` →
`{slot,textureKey,cx,cy,scale,depth,behind}[]` →
presenter creates/updates Images (exists-gated `wornTex` → `itemTex` fallback) →
hero appears dressed. Re-runs on equip/unequip (both scenes already rebuild).

## Testing

- **Pure** (`tests/heroDressLayout.test.ts`): deterministic ordering by depth;
  every body slot maps to an anchor inside the body box; scale is slot-sized (not
  uniform); `behind` layers sort before the body; worn-key chosen with icon
  fallback; accessories excluded from worn body layers.
- **Guard**: `wornTex` is built only via `assetKeys.ts` (asset-key discipline
  test already enforces this pattern).
- **CDP repro** (`scripts/playtest/repro_hero_worn.mjs`, already drafted): equip a
  full loadout; screenshot throne + doll (+ battle for the record); assert worn
  layers exist on the doll and the throne hero is dressed.
- Full `tsc` + vitest + eslint (max-lines 500) + `lint:cycles` 0 + build.

## Phase C — dressed BATTLE hero (shipped 2026-06-20)

Player feedback: "equipment must be placed exactly where it should be, and when
the hero moves the gear must follow the body parts." Phase A/B dressed the static
equipment-screen doll; the demand for motion-following points at the **battle**
hero — the only one that walks/attacks. Delivered without the deferred per-joint
skeleton by reusing the proven weapon+wings compositing in `HeroLayeredSprite`:

- **`src/data/heroBattleRig.ts`** (pure, tested) — maps the hero's per-frame
  animation state `{bodyH, bodyW, hover, facing}` to LOCAL placements for the four
  worn-armour overlays (Helmet/BodyArmor/Gloves/Boots). y is measured from the
  body-sprite origin (0.5, 0.78) and every layer is shifted by `hover` and
  mirrored by `facing`, so the gear tracks the body's bob/float/turn each frame.
- **`heroEquipVisuals.resolveHeroLayers`** now also returns a `gear` map
  (`worn__<id>` preferred, `item__<id>` icon fallback) for those four slots.
- **`HeroLayeredSprite`** composites four extra child sprites between the body and
  the held weapon, textured in `syncEquipment` (exists-gated) and positioned every
  `tick()` via `heroBattleRig` → the hero visibly WEARS its full kit and the gear
  follows it through idle/walk/attack. Held weapon + wings keep their bespoke
  motion. CDP proof: `scripts/playtest/repro_worn_rig.mjs`.
- **`src/data/wornManifest.ts`** (generated by `scripts/sdart/buildWornManifest.mjs`)
  gates the PreloadScene worn loader to art that exists — kills the 217
  "Failed to process file" 404s from the partial worn batch.

Fidelity note: the painted `hero__hero` sheet exposes no sub-frame joints, so gear
tracks the body's OVERALL motion (position/bob/facing), not individual feet within
a walk frame — acceptable at the 54px battle scale; a true per-joint socket rig
remains a future option.

## Out of scope

- Per-JOINT socket rig on the battle hero (individual limb tracking within a
  painted frame) — Phase C tracks whole-body motion instead; deferred.
- Accessories (Ring/Amulet/Pet) worn art — they don't read on a body; keep
  icon/orbit treatment.
- Save schema changes (none — reads existing `equipped`).

## Risks & mitigations

- *Per-item worn art lands inconsistently.* → consistent per-slot framing prompt +
  per-slot anchor/scale handle gross alignment; exists-gating + icon fallback mean
  a bad/missing piece degrades gracefully, never breaks the screen.
- *GPU cost of ~240 gens.* → z-image-turbo is fast; phased by slot; each batch
  ships independently.
- *File-size 500-line cap.* → presenters stay thin (layout is pure & external);
  split if a scene approaches the cap.
- *Cache staleness on redeploy.* → bump `ASSET_VERSION` in Phase B (hashed
  manifest + `?v=` busting already in place).
