# Skill Jewels (PoE-style) — Design

Date: 2026-06-08

## Goal

Add 50 collectible **skill jewels** that the player sockets into jewel-socket
nodes on the passive tree. A socketed jewel's bonuses empower the hero (and
therefore towers, via the existing 60% hero→tower share). Players obtain jewels
as loot, choose where to socket them, and may **destroy** a jewel forever
(guarded by a confirm dialog).

## Why this shape

The passive tree already has a `jewel-socket` node type and the hero stat
pipeline already composes `flat` / `increased` / `more` bags from passive nodes.
A jewel is just another such bag. Modelling jewels as stat bags that pigg-back on
`heroStatPipeline` means **no new stat-resolution code** — the same formula
`(base + Σflat) × (1 + Σincreased%) × Π(1 + more%)` applies, and the
`addHeroShare` tower share carries jewel power to towers automatically.

## Data model

### JewelDef (`src/data/jewels.ts`)
```ts
interface JewelDef {
  id: string;
  name: string;
  rarity: Rarity;            // reuse existing Rarity union
  description: string;
  flat?: Partial<Stats>;
  increased?: Partial<Stats>;
  more?: Partial<Stats>;
  artRef: string;           // "placeholder" until SDXL art lands
}
```
Validated by `validateJewelDef` (id/name non-empty, valid rarity, at least one
stat bag present). `JEWEL_CATALOG` holds 50 defs; `JEWEL_CATALOG_MAP` indexes by id.

Jewels are **not** rolled with per-instance variance (unlike items) — a jewel's
mods are fixed by its def. This keeps them readable and discrete.

### Save (`src/core/save.ts`, v5 → v6)
`HeroProgressSave` gains:
```ts
jewels: JewelInstanceSave[];                 // owned, un-socketed + socketed both live here
socketedJewels: Record<string, string>;      // nodeId → jewel instance id
```
`JewelInstanceSave = { id: string; defId: string }`. Migration v6 backfills both
to `[]` / `{}`; the defensive backfill block also ensures they exist.

## Stat application (`src/core/battle.ts` + `src/core/jewels` helper)

A helper `socketedJewelBags(save)` returns the `{flat,increased,more}` bags of
every jewel whose socket node is **currently allocated** (in `unlockedNodes`).
A jewel in a socket the player hasn't allocated contributes nothing — same rule
as PoE. These bags are appended to the `passiveNodes` array fed to
`heroStatPipeline`, and their `more` bags are folded into `collectPassiveMore`.

## SaveManager API

- `socketJewel(nodeId, jewelInstanceId): boolean` — node must be an unlocked
  jewel-socket, jewel must be owned and not already socketed elsewhere. Sets the
  map entry. Persists.
- `unsocketJewel(nodeId): boolean` — clears the map entry (jewel returns to the
  owned pool but stays in `jewels`). Persists. *(internal helper; UI's "remove"
  uses discard, below.)*
- `discardJewel(jewelInstanceId): boolean` — **destroys** the jewel forever:
  removes it from `jewels` and from any socket. Persists. This backs the UI's
  "Remove / destroy" action.
- `grantJewel(defId): JewelInstanceSave` — add a new owned jewel (used by loot).

## Sockets on the tree

Only 2 jewel-sockets exist today. Add one per region lacking one → **8 total**,
so a 50-jewel collection yields real build choices. Each new socket attaches to
one existing node in its region (bidirectional neighbor edge added on both sides),
placed at a free grid cell. Sockets are normal passive nodes for unlock purposes
(cost 1 point to allocate) but carry no innate stats — their power is the jewel.

## Acquisition (loot)

A jewel drop is added to the post-battle drop flow (`src/core/drops.ts`) with a
modest chance, and a higher chance on boss kills. Rarity is weighted (commons
common, uniques rare). The dropped jewel lands in `save.hero.jewels`.

## UI (`PassiveGridScene` + jewel overlay)

Selecting a jewel-socket node:
- **Not allocated** → normal Unlock flow (it's a passive node).
- **Allocated + empty** → side panel shows "Empty socket" + a **Socket Jewel**
  button → opens an overlay listing owned, un-socketed jewels (icon, name, mods).
  Clicking one sockets it.
- **Allocated + filled** → panel shows the socketed jewel's name/mods + a
  **Remove** button → confirm dialog "Destroy <jewel> forever? This cannot be
  undone." → on confirm, `discardJewel`.

The overlay also lets the player **discard** an owned jewel from the bag (same
confirm), so a full bag can be managed.

## Art (SDXL)

`gen-jewels-full.mjs` in `/home/shyaken/Workplace/wibu-td-designer/` (modeled on
`gen-items-full.mjs`) renders a gem/crystal icon per jewel → 96×96 PNG in
`public/assets/sprites/jewel/<id>.png`, rarity-tinted. Generated **one at a time**
(the GPU is sequential; parallel image gen crashes the box). Loaded in
`PreloadScene` as `jewel__<id>`; a `jewelIconKey(id)` helper mirrors `skillIconKey`.

## The 50 jewels (effects)

Magnitudes sit a tier above ordinary passive nodes (a path node gives +3%; a
common jewel ~+6–8%). Uniques carry rare `more` multipliers (multiplicative,
build-defining). Roughly: 24 Common (one mod), 14 Magic (two), 7 Rare (three),
5 Unique (named, `more`-based). Themes span offense (ATK/crit), defense (HP/armor/
resist), tempo (attack speed/pen), utility (gold/mana), and generalist capstones
(e.g. **Worldsoul Diamond**: +5% more ATK / SkillPower / MaxHP).

## Testing

- `jewels.test.ts` — catalog has 50, unique ids, valid rarities, every jewel has
  ≥1 non-empty stat bag, rarity distribution sane.
- `passiveGrid.test.ts` — 8 jewel-socket nodes, bidirectional edges intact.
- `save-v6` migration test — old save backfills `jewels`/`socketedJewels`.
- `saveManager` — socket / discard / grant behaviors, allocation gating.
- stat pipeline — a socketed jewel on an allocated socket reaches hero stats;
  an un-allocated socket contributes nothing.

## Out of scope (YAGNI)

- Per-instance stat rolls / jewel variance.
- Radius/"threshold" jewels that transform nearby nodes (PoE's fanciest mechanic).
- Jewel trading / shop sale.
