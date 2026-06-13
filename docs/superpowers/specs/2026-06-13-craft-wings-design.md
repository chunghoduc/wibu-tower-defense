# Craft Wings — Design Spec

**Date:** 2026-06-13
**Status:** Approved (full-auto session — author self-approved)

## Summary

Add a **Craft Wings** feature to the Forge. The player sacrifices surplus gear plus
two new materials — **Jewel of Chaos** and **Feather** — for a *chance* to forge a
pair of Wings. Success is a gamble; the resulting wing's rarity is random and biased
toward the average rarity of the sacrificed gear. This is a high-stakes gear sink that
gives the otherwise drop-locked Wing slot a path to upgrade.

This is the feature the earlier "Jewel of Chaos → Jewel of Entropy" rename freed the
name for: the smelt material is now **Jewel of Entropy** (id `chaos-jewel`), and this
spec introduces a brand-new **Jewel of Chaos** with its own id `jewel-of-chaos`.

## Goals

- A Forge crafting station that consumes gear + materials for a random Wing.
- Two new materials with their own painted 96×96 icons (Jewel of Chaos, Feather).
- A transparent, previewable success-chance formula.
- A random outcome-rarity distribution biased below the component average.
- A real source for both materials so the loop is playable.

## Non-Goals

- No new Wing art. The existing **skywings** item line already ships 5 rarity-tiered
  wings with full art (`worn-/fine-/masterwork-/heroic-/mythic-skywings`). Crafting
  mints one of those at the rolled rarity via `rollItem`.
- No save migration. New materials are additive keys in `HeroSave.materials`.
- No change to the existing smelt/reforge (Entropy) loop.

## The Two New Materials

Both are added to `src/data/materials.ts`. Because their `kind !== "box"`, they
auto-join `MATERIAL_ICON_IDS` and load as `material__<id>` (96×96 PNG under
`public/assets/sprites/material/<id>.png`).

| id | name | kind | icon key | art direction |
|----|------|------|----------|---------------|
| `jewel-of-chaos` | Jewel of Chaos | `jewel` | `jewel-of-chaos` | a volatile **violet-and-black** faceted gem wreathed in chaotic purple energy with small orbiting shards — visually distinct from the crimson **Jewel of Entropy** (`chaos-jewel`) so the two never read as the same item |
| `feather` | Feather | `consumable` | `feather` | a single luminous **white-gold angelic flight feather**, softly glowing, slight curve, on transparent background |

**Hard constraint:** the new Jewel of Chaos id is `jewel-of-chaos`, NOT `chaos-jewel`
(that id belongs to the Jewel of Entropy and must stay untouched).

## Material Sources

Both materials drop from **Boss Chests** via the existing tier-scaled `bonusMaterials`
faucet in `src/core/boxes.ts` (the established "materials come from bosses" channel;
the box tooltip already lists `bonusMaterials`, so it documents itself).

- **Feather** — frequent, all tiers (you need 1 per craft, plus gear to burn):
  T1 0.25 · T2 0.35 · T3 0.45 · T4 0.55 · T5 0.70
- **Jewel of Chaos** — rarer, weighted to higher tiers (the gate on craft volume):
  T1 0.06 · T2 0.10 · T3 0.16 · T4 0.24 · T5 0.35

(One independent roll each per chest open, same mechanism as soul/scroll/orb.)

## Crafting Formula

A new pure module `src/core/wingCraft.ts` owns all the math (Phaser-free, fully tested).

### Inputs & validation

- **Component items:** at least `MIN_ITEMS = 5` non-equipped inventory items. More are
  allowed (each adds success — see below).
- **Jewel of Chaos:** between 1 and `MAX_JEWELS = 4`. One is mandatory; extras raise
  success.
- **Feather:** exactly 1 (mandatory).

A craft is invalid (and the button disabled) unless: `items ≥ 5`, `1 ≤ jewels ≤ 4`,
`feathers ≥ 1`, and the player actually owns the jewels/feather and all selected items
exist and are non-equipped.

### Success chance

```
success = clamp(
  BASE_SUCCESS
  + Σ itemRaritySuccess(item)         // over ALL component items
  + JEWEL_BONUS × (jewels − 1),       // extra jewels beyond the mandatory 1
  0,
  SUCCESS_CAP
)
```

Constants:

| name | value |
|------|-------|
| `BASE_SUCCESS` | 0.20 |
| `JEWEL_BONUS` | 0.10 per extra jewel (jewels 1→4 ⇒ +0.00 / +0.10 / +0.20 / +0.30) |
| `MAX_JEWELS` | 4 |
| `SUCCESS_CAP` | 0.80 |
| `MIN_ITEMS` | 5 |

Per-item success by rarity:

| rarity | success contribution |
|--------|----------------------|
| Common (Normal) | 0.01 |
| Magic | 0.02 |
| Rare | 0.04 |
| Legendary | 0.07 |
| Unique | 0.10 |

Worked examples (5 components, exactly):
- 5× Common, 1 jewel → 0.20 + 0.05 + 0.00 = **0.25**
- 5× Common, 4 jewels → 0.20 + 0.05 + 0.30 = **0.55**
- 5× Unique, 4 jewels → 0.20 + 0.50 + 0.30 = 1.00 → capped **0.80**

### Outcome rarity (success only)

The wing's rarity is rolled from a 3-point distribution centred on the **rounded
average** of the component rarities, biased one tier DOWN (crafting usually yields a
lesser wing; rarely a better one). This reuses the exact clamp-and-fold pattern already
proven in `boxRarityOdds`:

```
avg = round( mean( rarityIndex(item) ) )      // Common=0 … Unique=4
weights on { avg−1, avg, avg+1 } = { 0.60, 0.35, 0.05 }
off-ladder weight folds onto the nearest valid tier (clamp inward)
```

This matches the requested example exactly: average **Magic** (index 1) →
**60% Common · 35% Magic · 5% Rare**. Boundary behaviour:
- average **Common** (0): the 0.60 "below" folds onto Common → **95% Common · 5% Magic**.
- average **Unique** (4): the 0.05 "above" folds onto Unique → **60% Legendary · 40% Unique**.

`wingOutcomeOdds(items)` returns `[{rarity, chance}]` — it drives BOTH the live preview
and the actual roll, so they can never drift (same discipline as `boxRarityOdds`).

### Minting the wing

Rolled rarity → skywings def id via a fixed map:

| rarity | def id |
|--------|--------|
| Common | `worn-skywings` |
| Magic | `fine-skywings` |
| Rare | `masterwork-skywings` |
| Legendary | `heroic-skywings` |
| Unique | `mythic-skywings` |

`rollItem(def, heroLevel, seed, heroLevel, {ignoreFloor:true})` mints the instance at
the hero's level (so a low-level player who gambles into a Unique gets a level-appropriate
one, exactly like a Unique box drop). A guard test asserts all five def ids exist.

### Craft resolution

`craftWings(save, { itemIds, jewels }, rng)` (pure, mutates `save`):

1. Validate. On failure return `{ ok:false, reason }` and mutate nothing.
2. **Consume inputs unconditionally:** remove the selected items, spend `jewels`×
   Jewel of Chaos, spend 1 Feather. (Gambling — the stake is paid whether or not it
   succeeds.)
3. Roll success: `rng.next() < successChance(items, jewels)`.
   - **Success:** roll outcome rarity from `wingOutcomeOdds`, `rollItem` the matching
     skywings, push to inventory → `{ ok:true, success:true, item, rarity }`.
   - **Failure:** mint nothing → `{ ok:true, success:false }`.

`SaveManager.craftWings(...)` wraps this with persistence + a change event (mirrors
`smeltItem`/`reforgeItem`).

## UI

A new **Craft Wings** panel in `ForgeScene` (a titled section + a "Craft Wings…"
button) opens a dedicated overlay `src/scenes/wingCraftDialog.ts` (its own file to keep
ForgeScene under 500 lines). The dialog shows:

- Owned **Jewel of Chaos** and **Feather** counts (with icons).
- An inventory **item picker** grid — tap to select/deselect components; equipped items
  excluded; selection count shown ("3 / 5 minimum").
- A **jewel stepper** (1–4, clamped to owned).
- A live readout: **success %** and the **outcome odds** line (e.g.
  "60% Common · 35% Magic · 5% Rare").
- A **Craft** button, enabled only when the craft is valid.
- Result feedback: success → "✦ Forged <Rarity> Skywings!"; failure → a "the wings
  dissolved into chaos…" flash. Either way the dialog refreshes counts.

## Files

**New**
- `src/core/wingCraft.ts` — constants, `wingSuccessChance`, `wingOutcomeOdds`,
  `skywingsDefId`, `craftWings`, result types. Pure.
- `src/scenes/wingCraftDialog.ts` — the overlay presenter.
- `tests/wingCraft.test.ts` — formula, validation, distribution, mint, consume.
- `public/assets/sprites/material/jewel-of-chaos.png`, `feather.png` — 96×96 icons.

**Changed**
- `src/data/materials.ts` — add `JEWEL_OF_CHAOS` + `FEATHER` exports and defs.
- `src/core/boxes.ts` — add feather + jewel-of-chaos `bonusMaterials` per tier.
- `src/core/saveManager.ts` (or core subclass) — `craftWings` wrapper.
- `src/scenes/ForgeScene.ts` — Craft Wings section + open-dialog button.
- `src/data/assetVersion.ts` — bump `ASSET_VERSION` (new art shipped).
- Possibly a guard test extension in `tests/materialIcons.test.ts` for the 2 new ids.

## Testing Strategy (TDD)

RED-first unit tests in `tests/wingCraft.test.ts`:
- `wingSuccessChance`: base, per-rarity item sums, jewel bonus, the 0.80 cap.
- validation: `<5` items, jewels out of `[1,4]`, missing feather, unowned inputs.
- `wingOutcomeOdds`: the Magic example is exactly 60/35/5; Common & Unique fold
  correctly; weights always sum to 1.
- `skywingsDefId`: all five map to defs present in `ITEM_CATALOG_MAP`.
- `craftWings`: consumes items+jewels+feather on BOTH outcomes; success pushes a wing
  of the rolled rarity whose `defId` is the right skywings; failure pushes nothing;
  invalid input mutates nothing.

Plus the existing `materialIcons`/`materialName` guard style for the 2 new materials.

Verification: `tsc --noEmit`, full `vitest`, `eslint` on touched files (each <500
lines), and a CDP self-playtest of the Forge craft flow.

## Risks / Decisions

- **Inputs consumed on failure** is intentional (it's the sink + the gamble). The 0.80
  cap guarantees the player can always reach a strong-but-not-certain craft.
- **Outcome biased downward** (60% one tier below average) keeps Wings from becoming a
  cheap rarity-laundering exploit — you generally feed better gear than you get back,
  with a thin 5% upside that creates the chase.
- **Materials sourced only from boss chests** for now (minimal blast radius). A thematic
  battle-drop feather from flying enemies is a possible later extension, noted but out
  of scope.
