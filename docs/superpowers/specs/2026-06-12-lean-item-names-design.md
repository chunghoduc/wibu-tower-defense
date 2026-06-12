# Spec — Lean item names (drop the rarity-prefix adjective)

**Date:** 2026-06-12
**Status:** Approved (FULL-AUTO self-approval)

## Problem

Generated item lines render their player-facing display name as
`${RarityPrefix} ${BaseName}`, where `RarityPrefix ∈ {Worn, Fine, Masterwork,
Heroic, Mythic}` (`RARITY_TIERS` in `src/data/items.ts`). The result reads
clunky and front-loads a dull adjective ahead of the iconic, famous-evoking
homage word:

- `Worn Kingsworn Brand`, `Fine Galewind Longbow`, `Masterwork Mithrilweave
Shirt`, `Heroic Beskar Plate`, `Mythic Hollowmoon Cleaver`, …

The base homage names (`Kingsworn Brand`, `Galewind Longbow`, …) are already
lean and _evoke_ famous gear from anime / film / myth / games. The leading
rarity adjective is redundant with information the UI already shows (rarity
color, border glow, required level, stat magnitude) and dilutes the name.

The user's request: _"remove dull words at the beginning such as worn, fine…
use the famous names from famous anime, movie, stories to make them leaner."_

## Non-goals / constraints

- **Legal constraint (load-bearing, do not break):** player-facing names must
  remain ORIGINAL HOMAGES — they _evoke_ a famous item without copying its real
  name/likeness. The real source stays in the designer-only `homage` field and
  `// homage:` comments. We are NOT inserting literal copyrighted names
  (Excalibur, Frostmourne, Buster Sword, …) into display names. "Use the famous
  names" is honored by _leading_ with the already-evocative homage base instead
  of burying it behind a rarity word.
- **Save / asset stability:** item `id`s stay `${prefix}-${lineId}`
  (`worn-kingsworn-brand`, …). IDs are save keys and PNG filename anchors
  (asset-key registry); changing them would orphan saves and art. Only the
  display `name` changes.

## Design

Drop the rarity-prefix adjective from the **display name** of every
procedurally generated item line. Each line shows its lean homage base name
alone, identical across all five rarity tiers:

- `worn-kingsworn-brand` … `mythic-kingsworn-brand` → all display **`Kingsworn
Brand`**.

Two code sites currently bake the prefix into the name; both change to use the
bare base:

1. **Generation loop** (`src/data/items.ts`): `name: \`${tier.prefix}
   ${line.base}\``→`name: line.base`.
2. **Lore-merge branch** (`src/data/items.ts`): for line items carrying a
   `lore.base`, `def.name = \`${cap(prefix)} ${lore.base}\``→`def.name =
   lore.base`.

Hand-authored base/signature items are unaffected — they carry an explicit
`lore.name` (the `worn-gloves`/`worn-boots` ids already display as `Trainee
Wraps` / `Wayfarer Boots`).

`RARITY_TIERS[*].prefix` is **retained** — it still builds the item `id`
(`tier.prefix.toLowerCase()`), which must not change.

### Accepted trade-off

The same display name now appears at up to five rarities (a player could hold a
Common and a Legendary `Kingsworn Brand`). This is standard ARPG behavior;
rarity color, border, required level, and stat magnitude disambiguate them. The
name is the _identity_ of the gear line; rarity is a separate quality axis.

## Testing

- RED: a test asserting that for a representative generated line, the display
  name of EVERY tier equals the bare base name (no `Worn`/`Fine`/`Masterwork`/
  `Heroic`/`Mythic` prefix), and is identical across all five tiers.
- A guard that no generated-line display name starts with any rarity-prefix word
  (catalog-wide), so the dull adjective can't creep back in.
- The existing `item-catalog.test.ts` contracts (40 lines × 5 tiers exist; each
  carries homage name + archetype + lore) must still pass; update the stale
  comment that says the name is "rarity-prefixed".

## Out of scope

- Renaming the homage base words themselves (they already read lean/iconic).
- Any change to ids, art, stats, balance, or rarity coloring.
