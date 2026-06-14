# Role-Icon Clarity — Design Spec

**Date:** 2026-06-14
**Status:** Approved (full-auto session)

## Problem

A tower's **role** (damage / splash / chain / dot / support / debuff / tanker) is the
single most important thing a player reads when picking what to build, yet it is
currently **unclear or missing** in the UI:

1. **In-battle build bar ("squad list") shows an empty colored dot.**
   `buildBuildBar()` draws each card's role badge via `drawTypeBadge()`. That
   function early-returns the moment a `roleicon__<role>` SDXL texture exists
   (`battleSceneRender.ts:216`) — but the build-bar card **never adds the emblem
   image** (only field towers get it, in `manageSprites`). Net result: the card
   shows a bare role-tinted disc with no glyph. The role is not readable.

2. **The emblem art is too detailed to read at badge size.** The field badge is
   ~15px and the build-bar disc ~12px, but several icons are busy (damage =
   crosshair pierced by an arrow; debuff = downward arrow over a *cracked
   hourglass*; support = chevrons inside a *halo ring*). Scaled down from a 768px
   render they turn to mush.

3. **The home "Squad" screen and tower info panels show role as text only.** The
   role label exists but there is no glyph, so the role doesn't "pop" anywhere
   outside the field.

The icons are **not** alpha-buggy — corners are transparent (verified). The bug is
(a) the missing build-bar emblem and (b) low small-size legibility.

## Goals

- Regenerate **all 7 role icons** via the SDXL flow (the sole art pipeline) with
  **bolder, simpler, single-silhouette iconography** that stays readable at ≤16px.
- Make the role **clear everywhere it appears**: in-battle build-bar cards, placed
  field towers (already wired), the tower info panel, and the home Squad roster +
  info panel.

## Non-Goals

- No change to the role *taxonomy*, role colors, balance, or any gameplay.
- No new texture-key scheme — keep `roleicon__<role>` via `assetKeys.roleTex`.
- No change to drag/tap placement, the field-badge geometry, or `manageSprites`.

## Approach

Three small, independent pieces. The art regen and the UI wiring are decoupled:
the UI reads `roleicon__<role>` whether or not the art was refreshed, and the
no-texture fallback (legacy sword/arrow glyph) is preserved everywhere.

### A. Regenerate role icons (SDXL)

Edit the `ROLE_VISUAL` descriptors and tighten `ROLEICON_STYLE` in
`scripts/sdart/prompts.mjs` toward **one bold solid shape, thick uniform outline,
no fine interior detail, legible at 16px**. Simplifications:

| role    | new descriptor (gist)                                            |
|---------|------------------------------------------------------------------|
| damage  | one bold solid downward strike arrowhead/chevron, sky blue       |
| splash  | one bold solid 8-point explosion burst star, coral orange        |
| chain   | one bold solid zigzag lightning bolt, violet                     |
| dot     | one bold solid venom teardrop, toxic green                       |
| support | one bold solid upward double-chevron (up arrow), warm gold       |
| debuff  | one bold solid downward arrow with a minus bar, teal cyan        |
| tanker  | one bold solid heater shield with a center stud, steel grey      |

Regenerate with `npm run gen:sprites -- --only=roleicon --force`. Output stays
64px transparent PNGs in `public/assets/sprites/roleicon/`. **Bump `ASSET_VERSION`**
(art redeploy rule). No manifest edit (PreloadScene loads roles by enumerating
`TOWER_ROLES`, not via `spriteManifest`).

### B. Wire the emblem into the in-battle build-bar card (the core fix)

Extract a tiny **pure** helper `roleBadgeOnCard()` (in `roleBadge.ts`) that returns
the emblem's local x/y + diameter for a card of a given width — so the geometry is
testable and not a magic literal in the scene. In `buildBuildBar()`, after the
type-badge disc, if `textures.exists(roleBadgeTex(def.role))` add a small
`Image` of the emblem on top of the disc (mirrors the field-tower treatment).
The legacy `drawTypeBadge` glyph remains the no-texture fallback.

### C. Make the role glyph appear in Squad roster + info panels

Add a small role-emblem `Image` next to the existing role **text** in:
- `squadInfoPanel.ts` (the `{rarity} · {role}` line),
- the home `SquadScene` roster tiles (beside the role label),

guarded by `textures.exists` so headless/no-art runs degrade to text-only. Reuse
the `roleBadgeTex` resolver — no new keys.

## Components / Interfaces

- `core`/`scenes/roleBadge.ts` (pure): add `roleBadgeOnCard(cardWidth: number)
  → { x, y, diameter }`. Single source for card-emblem geometry; unit-tested.
- `BattleScene.buildBuildBar` (presenter): consumes the helper, adds the Image.
- `squadInfoPanel.ts` / `SquadScene.ts` (presenters): add guarded emblem Image.
- `scripts/sdart/prompts.mjs` (data): refreshed `ROLE_VISUAL` + style string.

## Data Flow

`TowerRole` → `roleTex(role)` = `roleicon__<role>` (assetKeys, sole key builder) →
PreloadScene loads PNG → any presenter checks `textures.exists` → draws emblem
Image, else legacy glyph. Unchanged path; we only add two more consumers.

## Testing

- **Pure unit test** for `roleBadgeOnCard` (geometry: centered-right, inside the
  card, positive diameter scaling with card width) — TDD red→green.
- Existing `roleBadge.test.ts` (key + color totality over `TOWER_ROLES`) stays green.
- `tsc --noEmit`, full vitest suite, eslint (max-lines 500), `npm run build`.
- **Live CDP playtest**: start BattleScene, assert each build-bar card has an
  emblem child Image whose texture is `roleicon__<role>`; screenshot for the eye.
- Visual spot-check of the 7 regenerated PNGs (Read tool) for small-size clarity.

## Risks

- SDXL may render text or extra objects — mitigated by the existing
  `ROLEICON_NEGATIVE` and a visual spot-check; re-roll seed if a glyph is unclear.
- Build-bar card is tight (44px tall); emblem must not overlap the cost text —
  the geometry helper pins it to the upper-right, matching the disc position.
