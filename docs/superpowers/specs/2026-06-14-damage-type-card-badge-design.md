# Damage-type badge on tower cards — design

**Date:** 2026-06-14
**Status:** approved (full-auto self-review)

## Problem

A tower's **role** is already shown on its card as an SDXL emblem in the upper-right
corner (`roleBadge.ts` / `roleBadgeOnCard`). But a card gives the player no way to
tell whether the tower deals **Physical** or **Magic** damage. Damage type matters
for team composition (armor vs. magic-resist enemies, on-hit interactions), yet it is
invisible at the moment the player is choosing what to build or squad.

Add a small **damage-type badge** to the tower card that distinguishes Physical from
Magic at a glance.

## Source of truth

Damage type is already derived and stored — no new data model:

- `src/data/weaponFamily.ts` → `deriveDamageType(spec)` returns `"Physical" | "Magic"`.
- `src/data/schemaEnums.ts` → `ATTACK_DAMAGE_TYPES = ["Physical", "Magic"]`,
  type `AttackDamageType`.
- `src/data/schema.ts` → `CharacterDef.damageType: AttackDamageType`.

The card reads `def.damageType` directly.

## Decision: procedural, not SDXL

Damage type has exactly **two** values. They are trivially distinguished by a single
glyph + color each, so an SDXL emblem set (with its art-regen, `ASSET_VERSION` bump,
and deploy cost) is overkill. The badge is drawn procedurally with Phaser `Graphics`,
matching the codebase's existing procedural-UI-badge convention (`drawTypeBadge`,
aura rings, mana bars). The SDXL "sole art pipeline" rule governs sprite **assets**
(PNG textures), not vector UI chrome — so **no new texture key, no `ASSET_VERSION`
bump, no deploy.**

## Visual encoding (dual-coded: shape + color)

| Damage type | Glyph            | Color (glyph + ring) |
| ----------- | ---------------- | -------------------- |
| Physical    | upright **blade**/sword | steel blue `0x9fb4cc` |
| Magic       | 4-point **sparkle** | arcane violet `0xc18cff` |

Both shape and color carry the signal, so it remains legible for colorblind players
and at small sizes. The colors are chosen to not clash with the role-badge tints
(which are role-specific cyan/orange/purple/etc.).

## Placement

The role emblem is pinned to the card's **upper-right** at `(cardWidth/2 - 9, -8)`.
The damage badge mirrors it to the **upper-left** at `(-(cardWidth/2) + 9, -8)`, the
same y, same diameter scaling (`round(cardWidth * 0.22)`). The card's cost text sits
bottom-center and the rarity glow frames the card — the upper-left corner is free.

On the field-tower body (in-battle world sprite) the damage badge is **not** added —
that surface already carries the role badge and HP/mana bars; adding a third marker
there is clutter. Scope is the **card** surfaces only.

## Architecture

Mirror the `roleBadge.ts` (pure) + presenter split.

### Pure module — `src/scenes/damageBadge.ts` (Phaser-free, unit-tested)

```ts
import type { AttackDamageType } from "../data/schema.ts";

export type Vec2 = { x: number; y: number };

/** Per-damage-type tint for the badge glyph + ring. */
export const DAMAGE_BADGE_COLOR: Record<AttackDamageType, number>; // Physical/Magic

/** Badge placement on a tower card (local coords, card centered at 0,0).
 *  Mirror of roleBadgeOnCard — pinned to the upper-LEFT. */
export function damageBadgeOnCard(cardWidth: number): { x: number; y: number; diameter: number };

/** Normalized glyph outline (points within [-1,1], unit-circle space) for the
 *  given damage type: an upright blade for Physical, a 4-point spark for Magic.
 *  The presenter scales by radius and translates to the badge center. */
export function damageGlyphPoints(dt: AttackDamageType): Vec2[];
```

Guarantees the tests lock:
- `damageBadgeOnCard` returns a point in the card's upper-left (`x < 0`, `y < 0`),
  inside the card half-width, with `diameter` scaling monotonically with `cardWidth`.
- `damageGlyphPoints` returns a non-empty point list for each type, all points
  within the `[-1, 1]` unit box, and the two types produce **different** outlines
  (so they are visually distinct).
- `DAMAGE_BADGE_COLOR` is total over `ATTACK_DAMAGE_TYPES` with two distinct colors.

### Presenter — `src/scenes/damageBadgeFx.ts` (thin Phaser)

One function, reused by all three card sites:

```ts
export function drawDamageBadgeOnCard(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  cardWidth: number,
  dt: AttackDamageType,
): void;
```

It computes geometry via `damageBadgeOnCard`, draws a small dark disc backing with a
colored ring, then fills the glyph polygon from `damageGlyphPoints` in the
damage color, and adds the `Graphics` to the container. Pure-draw, no state.

### Integration sites (presenters only)

1. `src/scenes/BattleScene.ts` `buildBuildBar()` — after the role emblem block, call
   `drawDamageBadgeOnCard(this, c, TW - 8, def.damageType)`.
2. `src/scenes/squadTiles.ts` — after its role-badge block, same call against the tile
   container + tile width.
3. `src/scenes/squadInfoPanel.ts` — same, against the panel's card container.

Each site already resolves `def`/`tower` with `role`; `damageType` is on the same
`CharacterDef`, so no new plumbing.

## Testing

- **Pure unit test** `tests/damageBadge.test.ts`: geometry (upper-left, in-bounds,
  monotonic diameter), glyph point validity + distinctness, color totality/distinctness.
- **Existing suite** stays green (presenters are additive; no behavior change to sim,
  save, or layout math elsewhere).
- **CDP repro**: extend / add a playtest that opens the build bar and asserts the
  damage badge graphics are present per card (best-effort, mirrors the role-icon repro
  style). The pure test is the authoritative gate.

## Out of scope / non-goals

- No SDXL art, no texture key in `assetKeys.ts`, no `ASSET_VERSION` bump, no deploy.
- No field-tower (world sprite) damage badge.
- No change to damage-type derivation, combat math, or save shape.
- CollectionScene already surfaces detailed stats in its detail panel; a card-grid
  badge there is a possible follow-up but not required by this request.

## Files

- **New:** `src/scenes/damageBadge.ts`, `src/scenes/damageBadgeFx.ts`,
  `tests/damageBadge.test.ts`.
- **Modified:** `src/scenes/BattleScene.ts`, `src/scenes/squadTiles.ts`,
  `src/scenes/squadInfoPanel.ts`.

All files stay well under the 500-line limit (the three pure/presenter files are
small; the integration edits add a few lines each).
