# Item Stat-Archetype System + 200-Item Homage Expansion

**Date:** 2026-06-10
**Status:** Approved (autonomous session — owner delegates design decisions)
**Scope:** Two coupled deliverables — (1) a build-archetype layer that gives the
item system deliberate stat identity (so accessories split into physical / magic /
defense / utility builds), and (2) ~200 new items homaging famous games, films,
fiction, and myth, distributed to populate that archetype matrix.

---

## 1. Problem & Intent

The catalog (~150 items) already varies primary affixes, but the *build identity*
is implicit and uneven:

- **Pets are monotone** — almost every pet rolls `goldFind`/gold-per-sec. There is
  no combat pet, guardian pet, or mystic pet.
- **Accessories lack legible archetypes** — a player can't reason "I want a
  physical ring vs a magic ring"; the split exists by accident, not design.
- The drop pool is anime-only in its homages and modest in volume.

**Owner request, verbatim:**
1. "update item stat design system. make the game more diversity such as there are
   rings focus on physical damage, rings focus on utility, rings focus on magic
   power etc.., apply to amulet, pet systems as well. brainstorm and make sure all
   are well designed."
2. "brainstorm, deep research to pull 200 more items to add to the game. call use
   items from famous games, famous fictions, movies and stories."

These reinforce each other: the archetype layer is the *design system*; the 200
items are the *content* that fills it out.

---

## 2. Design Overview

### 2.1 Build archetypes (the stat-design system)

Introduce a first-class **archetype** for items — the build a piece pushes you
toward. Five values:

| Archetype | Identity | Signature stats |
|-----------|----------|-----------------|
| `physical` | Crit/attack carry | atk, physicalDamage, critRate, critDamage, armorPen, attackSpeed, omnivamp |
| `magic` | Caster / skill burst | skillPower, magicDamage, magicPen, manaOnHit, manaOnKill |
| `defense` | Survive / tank | maxHp, armor, magicResist, damageReduction, critDefense, tenacity, hpRegen |
| `utility` | Economy / mobility | goldFind, moveSpeed, range |
| `hybrid` | Intentionally mixed signature pieces | (no single bucket) |

**Derivation, not duplication.** Archetype is computed from an item's *primary
affix* by default (`PRIMARY_ARCHETYPE` map), with an optional authored override on
the def/line for deliberate hybrids. No stat is re-modelled; the 24-stat system and
affix resolution are untouched. Archetype is a *label over existing stats*.

This mirrors the existing `itemCategory.ts` pattern exactly: a **Phaser-free,
unit-tested** pure module (`src/data/itemArchetype.ts`) so the bucketing logic is
testable without dragging Phaser's device init into node.

```ts
// src/data/itemArchetype.ts  (pure, no Phaser)
export type ItemArchetype = "physical" | "magic" | "defense" | "utility" | "hybrid";
export const ARCHETYPES: { id: ItemArchetype; label: string; color: string }[] = [...];
const PRIMARY_ARCHETYPE: Record<string, ItemArchetype> = {
  physicalDamage: "physical", critRate: "physical", critDamage: "physical",
  armorPen: "physical", attackSpeed: "physical", omnivamp: "physical", atk: "physical",
  magicDamage: "magic", skillPower: "magic", magicPen: "magic",
  manaOnHit: "magic", manaOnKill: "magic",
  maxHp: "defense", armor: "defense", magicResist: "defense",
  damageReduction: "defense", critDefense: "defense", tenacity: "defense", hpRegen: "defense",
  goldFind: "utility", moveSpeed: "utility", range: "utility",
};
export function archetypeFor(def: { primaryAffix: { type: string }; archetype?: ItemArchetype }): ItemArchetype {
  return def.archetype ?? PRIMARY_ARCHETYPE[def.primaryAffix.type] ?? "hybrid";
}
```

**Schema change:** add `archetype?: ItemArchetype` to `ItemDef` (optional, so
validators and existing items are unaffected) and to the `ItemLine` shape so a
generated line can stamp every rarity tier with its archetype.

**Where it surfaces (player-visible, so the diversity is felt, not just internal):**
- **Tooltip:** a small colored archetype tag at the top of the item card
  (`itemDisplay.ts` gains one archetype row; colors from `ARCHETYPES`).
- **No new filter facet** (YAGNI). The just-shipped slot-category filter stays; an
  archetype filter is deferred unless the tag proves it's wanted. The tag alone
  makes builds legible.

### 2.2 Accessory build matrix (the heart of request #1)

Guarantee that **each accessory slot offers every combat archetype**, so a player
can assemble a coherent build:

| Slot | physical | magic | defense | utility |
|------|----------|-------|---------|---------|
| Ring | `juggernaut-signet` | `archmage-loop` | `bulwark-band` | `wayfarer-ring` |
| Amulet | `warpriest-talisman` | `archon-amulet` | `wardstone-amulet` | `midas-locket` |
| Pet | `direwolf-cub` | `arcane-wisp` | `iron-sentinel-chibi` | `lucky-tanuki` |

(Existing accessory lines — blood-ring, precision-ring, vital-ring, focus-gem,
pierce-pendant, aegis-charm, etc. — remain and slot into this matrix by their
derived archetype.) **Pets gain three brand-new non-gold archetypes** (combat /
mystic / guardian) — pets contribute baseStats + primary + rolled affixes through
`buildAffixStats` already, so a combat pet needs *no* engine change; `petUtility`
stays optional and gold-only.

### 2.3 200-item homage expansion (request #2)

Delivered as **40 new 5-rarity lines** (`ITEM_LINES` mechanism → 40 × 5 = 200
items). Rationale for lines over 200 hand-authored signatures:

- Matches the dominant existing mechanism; auto-balanced by `RARITY_TIERS`.
- One line = one famous-item homage spanning Worn→Mythic (the game's established
  convention; the rarity prefix conveys *this copy's* tier, the homage conveys the
  *design*).
- 40 line literals + 40 lore entries are maintainable and stay under the 500-line
  file cap (split across themed modules); 200 literals would not.
- Identical art cost (200 PNGs either way) but far less data churn.

**Legal safety (hard rule, unchanged):** every name is an *original homage* — it
evokes a famous item without copying its real name or likeness. The real source
lives ONLY in the designer-only `homage: { source, original }` field and `//
homage:` comments, never in any player-facing field. Broadens beyond anime to
games/films/fiction/myth, but the rule is identical.

---

## 3. The 40 Homage Lines

Each line: `id` (kebab, unique, never collides with an existing id or a
`worn-<existing-base-id>`), homage `base` name (original), slot/weaponType,
archetype, primary affix + Common-tier base value, and the designer homage note.
Stat magnitudes start from the nearest existing line of the same slot/primary and
nudge — never leap (per `references/balancing.md`).

### Weapons (12)

| id | base (homage name) | type | archetype | primary | source → original (designer-only) |
|----|--------------------|------|-----------|---------|-----------------------------------|
| kingsworn-brand | Kingsworn Brand | Sword | physical | physicalDamage 0.09 | Arthurian → Excalibur |
| moonlit-greatblade | Moonlit Greatblade | Sword | magic | magicDamage 0.16 | Dark Souls → Moonlight Greatsword |
| rimewill-runeblade | Rimewill Runeblade | Sword | physical | omnivamp 0.04 | Warcraft → Frostmourne |
| busterfell-cleaver | Busterfell Cleaver | Sword | physical | physicalDamage 0.10 | Final Fantasy VII → Buster Sword |
| emberlight-saber | Emberlight Saber | Sword | magic | magicDamage 0.14 | Star Wars → lightsaber |
| galewind-longbow | Galewind Longbow | Bow | physical | attackSpeed 0.12 | Diablo II → Windforce |
| dawnsong-bow | Dawnsong Bow | Bow | magic | magicDamage 0.13 | Greek myth → Bow of Apollo |
| peacekeeper-revolver | Peacekeeper Revolver | Gun | physical | armorPen 0.12 | The Dark Tower → the gunslinger's revolver |
| starhunter-cannon | Starhunter Cannon | Gun | physical | physicalDamage 0.11 | Metroid → the arm cannon |
| eldwood-wand | Eldwood Wand | Staff | magic | skillPower 0.15 | Harry Potter → the Elder Wand |
| dreadpage-codex | Dreadpage Codex | Tome | magic | magicPen 0.09 | Lovecraft → the Necronomicon |
| titangrip-knuckles | Titangrip Knuckles | Fist | physical | critDamage 0.12 | Capcom → Power Stone gauntlets |

### Body / Helm (9)

| id | base | slot | archetype | primary | source → original |
|----|------|------|-----------|---------|-------------------|
| mithrilweave-shirt | Mithrilweave Shirt | BodyArmor | defense | damageReduction 0.05 | LOTR → the mithril shirt |
| beskar-plate | Beskar Plate | BodyArmor | defense | armor 0.10 | Star Wars → beskar armor |
| havelthane-plate | Havelthane Plate | BodyArmor | defense | maxHp 0.09 | Dark Souls → Havel's armor |
| dragonscale-mail | Dragonscale Mail | BodyArmor | defense | magicResist 0.09 | Skyrim → dragonscale armor |
| sentinel-bulwark | Sentinel Bulwark | BodyArmor | defense | damageReduction 0.05 | Marvel → the vibranium shield |
| ribbon-circlet | Ribbon Circlet | Helmet | defense | tenacity 0.08 | Final Fantasy → the Ribbon |
| hadeshood-cowl | Hadeshood Cowl | Helmet | utility | moveSpeed 0.10 | Greek myth → the Helm of Hades |
| valor-greathelm | Valor Greathelm | Helmet | defense | maxHp 0.07 | generic knightly homage |
| seerlight-circlet | Seerlight Circlet | Helmet | magic | skillPower 0.09 | Dr. Strange → the Eye of Agamotto |

### Gloves / Boots / Wings (5)

| id | base | slot | archetype | primary | source → original |
|----|------|------|-----------|---------|-------------------|
| titanhold-gauntlets | Titanhold Gauntlets | Gloves | physical | critDamage 0.13 | Marvel → the Infinity Gauntlet |
| trickster-grips | Trickster Grips | Gloves | physical | critRate 0.05 | generic rogue homage |
| mistwalk-treads | Mistwalk Treads | Boots | utility | moveSpeed 0.11 | folklore → seven-league boots |
| valkyrie-pinions | Valkyrie Pinions | Wing | physical | attackSpeed 0.08 | Norse myth → valkyrie wings |
| phoenix-pinions | Phoenix Pinions | Wing | magic | skillPower 0.09 | myth → the phoenix |

### Rings (4 — completes the ring archetype matrix)

| id | base | archetype | primary | source → original |
|----|------|-----------|---------|-------------------|
| juggernaut-signet | Juggernaut Signet | physical | physicalDamage 0.08 | Diablo II → Stone of Jordan |
| archmage-loop | Archmage Loop | magic | skillPower 0.10 | DC → a power ring |
| bulwark-band | Bulwark Band | defense | maxHp 0.07 | generic ring of protection |
| wayfarer-ring | Wayfarer Ring | utility | goldFind 0.08 | LOTR → the One Ring (stealth+fortune) |

### Amulets (5)

| id | base | archetype | primary | source → original |
|----|------|-----------|---------|-------------------|
| warpriest-talisman | Warpriest Talisman | physical | critDamage 0.11 | generic war-charm |
| archon-amulet | Archon Amulet | magic | magicPen 0.08 | Elder Scrolls → the Amulet of Kings |
| wardstone-amulet | Wardstone Amulet | defense | magicResist 0.08 | generic ward |
| midas-locket | Midas Locket | utility | goldFind 0.09 | Greek myth → the touch of Midas |
| heartforge-pendant | Heartforge Pendant | defense | hpRegen 0.10 | Marvel → the arc reactor |

### Pets (5 — adds combat / mystic / guardian pets)

| id | base | archetype | primary | petUtility | source → original |
|----|------|-----------|---------|-----------|-------------------|
| direwolf-cub | Direwolf Cub | physical | critRate 0.05 | none | A Song of Ice and Fire → a direwolf |
| arcane-wisp | Arcane Wisp | magic | skillPower 0.10 | none | Zelda → the fairy companion |
| iron-sentinel-chibi | Iron Sentinel | defense | maxHp 0.08 | none | folklore → the iron golem |
| lucky-tanuki | Lucky Tanuki | utility | goldFind 0.12 | gold engine | Japanese folklore → the tanuki |
| emberfox-kit | Emberfox Kit | magic | manaOnHit 4 | none | myth → the nine-tailed fox |

**Total: 12 + 9 + 5 + 4 + 5 + 5 = 40 lines → 200 items.** All ids verified
unique vs the current catalog and vs the `worn-/fine-/masterwork-/heroic-/mythic-`
generated namespace.

---

## 4. Architecture & File Plan (respect the 500-line cap)

| File | Change |
|------|--------|
| `src/data/schemaStats.ts` *(or schema.ts)* | `ItemArchetype` type lives in the new pure module; `ItemDef` gains `archetype?`. |
| `src/data/itemArchetype.ts` *(new, pure)* | `ItemArchetype`, `ARCHETYPES`, `PRIMARY_ARCHETYPE`, `archetypeFor()`. Phaser-free, unit-tested. |
| `src/data/items.ts` | Export the `ItemLine` interface; add `archetype?` to it; import + concat `EXPANSION_LINES`; stamp `archetype` onto each generated `ItemDef`; back-fill `archetype` on hand-authored defs (or rely on `archetypeFor` at read time). |
| `src/data/itemsExpansion.ts` *(new)* | `EXPANSION_LINES: ItemLine[]` — the 40 lines. Split into two themed files if it nears 500 lines. |
| `src/data/itemLoreExpansion.ts` *(new)* | 40 `ItemLoreEntry` records (base name, appearance, homage, specialty, lore), merged in `itemLore.ts`. Split if near cap. |
| `src/data/itemLore.ts` | Spread `ITEM_LORE_EXPANSION` into `ITEM_LORE`. |
| `src/data/itemDisplay.ts` | Prepend an archetype tag row (label + `ARCHETYPES` color). |
| `tests/itemArchetype.test.ts` *(new)* | Pure bucketing: every primary maps; each accessory slot covers all 4 combat archetypes; override beats derivation. |
| `tests/item-catalog.test.ts` | Extend: catalog ≥ 349; the 40 new lines each span 5 rarities; new ids present & unique. |

**Art:** `npm run gen:item-visual` then `node scripts/sdart/sdgen.mjs --only=item`
(resumable; skips existing) regenerates only the 200 new ids from each line's
`appearance.look`. SD server confirmed up at `:8765`. Art is the final phase — data,
wiring, and tests land and go green *first*; art renders sequentially after (single
GPU process, never parallel).

---

## 5. Balancing

- New lines inherit `RARITY_TIERS` scaling — Common base values above are nudged
  from the nearest existing same-slot/same-primary line, never invented.
- Crit primaries/bases stay modest (`critRate ≤ 0.05`, `critDamage ≤ 0.13` at
  Common) so the `AFFIX_RANGE`/`critDamp` caps keep total crit < 30% (enforced by
  `item-catalog.test.ts`).
- Fractional stats (crit/pen/%/omnivamp/skillPower) add flat & don't level-scale;
  scalar stats (atk/hp) scale with required level — same as today.
- Economy (`itemValue`/sell) is rarity-driven and applies automatically.

---

## 6. Test Plan

1. `tests/itemArchetype.test.ts` — pure logic (derivation, override, accessory
   matrix completeness).
2. Extended `tests/item-catalog.test.ts` — count, 5-rarity span per new line,
   unique ids, crit caps still hold across the bigger pool.
3. `npm run typecheck && npx vitest run` green; `npm run build` green.
4. Art: confirm a sample of new PNGs land at exactly 96×96 under
   `public/assets/sprites/item/<id>.png`.

---

## 7. Out of Scope (YAGNI)

- No archetype *filter facet* (tag in tooltip only).
- No new stat keys / no affix-resolution changes / no `petUtility` extension.
- No rework of existing lines beyond stamping derived archetypes.
- No new signature (single-rarity) base items — all 200 are lines.

---

## 8. Risks

- **Art runtime** — 200 sequential SDXL renders is the long pole. Mitigation: data
  ships and verifies independently; items show the placeholder icon until their
  PNG renders, so the feature is fully playable before art completes.
- **File-size cap** — expansion data/lore could approach 500 lines; split into
  themed sub-modules pre-emptively.
- **Homage legal safety** — every player-facing name must be original; real names
  confined to `homage`/comments. Enforced by review during authoring.
</content>
</invoke>
