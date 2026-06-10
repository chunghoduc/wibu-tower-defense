# Item Data Model & Art Flow

The hard rules and shapes a new item must satisfy. Keep this open while authoring.

## Files

| File | Role |
|------|------|
| `src/data/schema.ts` | `ItemDef` + `ItemAppearance` interfaces. |
| `src/data/items.ts` | `ITEM_CATALOG` (base + signature `i({...})` literals), `ITEM_LINES` (5-rarity lines), `RARITY_TIERS`, the lore-merge pass. |
| `src/data/itemLore.ts` | **Single source of truth** for homage name + `appearance` + `homage` + `specialty` + `lore`. Keyed by item id (base) or line id. |
| `scripts/genItemVisual.ts` | `npm run gen:item-visual` → dumps `scripts/sdart/itemVisual.json`. |
| `scripts/sdart/sdgen.mjs` + `prompts.mjs` | SDXL runner; `itemStyleFor(look, rarity)` builds the prompt. |

## `ItemDef` (the catalog entry)

```ts
{ id, name, slot, weaponType?, rarity, requiredLevel,
  baseStats, primaryAffix: { type, baseValue }, affixPool,
  petUtility?, wingPassive?, appearanceRef?, artRef,
  // attached by the lore-merge pass — author these in itemLore.ts, not here:
  appearance?, homage?, specialty?, lore? }
```

`ItemAppearance = { family, material: { tint, accent }, look }`.

## The id-stability rule (CRITICAL)

`id` is the **save key** AND the **PNG filename** (`public/assets/sprites/item/<id>.png`).
- Never rename or reuse an existing id.
- Change the player-facing **`name`** freely (it's just display text); the homage
  rename system overrides `name` via `itemLore.ts` while ids stay put.
- Generated line ids are `${rarityPrefix}-${lineId}` (e.g. `mythic-warblade`).
  `loreFor()` strips the prefix to find the line's lore entry.

## Silhouette families (icon shape + worn template)

Reuse one of these; add a new family only if none reads at 16–24px:

`greatblade` · `bow` · `staff` · `firearm` · `tome` · `gauntlet` (weapons) ·
`helm` · `chestplate` · `robe` (body) · `gloves` · `boots` · `amulet` · `ring` ·
`familiar` (pet) · `wings`.

Granularity is **per family (~15)**, not per item — at small sizes recognition
rides on silhouette first, value contrast second, hue a distant third.

## Material vs rarity (the ~6-color budget)

- **`material.{tint, accent}`** = the item's body colors, curated by hand. Constant
  across all rarity tiers of a line. Reused by the icon AND the worn overlay —
  **never** sampled from a finished PNG (no robust auto-extraction exists).
- **Rarity** = a separable **rim-glow** layer, added by `itemStyleFor()` /
  `RARITY_RIM`, NOT a body re-tint. So a Worn and a Mythic of the same line share
  one body and differ only by glow. Do not bake rarity color into `look`.

`RARITY_TIERS` (in `items.ts`): Common/Worn (lvl 1) · Magic/Fine (10) ·
Rare/Masterwork (22) · Legendary/Heroic (40) · Unique/Mythic (60).

## Art flow (one source → both icon and worn art)

```
itemLore.ts (appearance.look)
      │  npm run gen:item-visual
      ▼
scripts/sdart/itemVisual.json   ← {id, look, rarity, family, slot}
      │  node scripts/sdart/sdgen.mjs --only=item   (SD server @ :8765)
      ▼
public/assets/sprites/item/<id>.png   ← icon AND worn overlay (reused on hero)
```

`--force` regenerates every item (overwrites); omit it for a resumable run that
skips existing icons (use this when adding one item). The worn overlay is the
same icon body-anchored on the battle hero (`src/scenes/heroEquipVisuals.ts` →
`item__<id>`), so regenerating the icon refreshes the worn look for free.

## What the content tests enforce

`tests/item-catalog.test.ts`, `tests/catalogs.test.ts`, `tests/artPrompts.test.ts`:
unique ids · every slot covered · weapons have a valid `weaponType` · primary
`baseValue > 0` · `requiredLevel >= 1` · crit stays under caps · each line spans
all 5 rarities. Run `npm run typecheck && npm test` after editing.
