# Unique Item Powers — Design

**Date:** 2026-06-21
**Status:** Approved (full-auto delegated session)

## Problem

Unique-rarity items are mechanically identical to Legendary items. The only
differences today are scalar: a higher stat multiplier (×3.0 base / ×3.7 primary
vs Legendary ×2.4 / ×2.9), a level-60 floor, the same 3 random affixes, and a
higher crystal price. A Unique looks and plays like "a slightly bigger
Legendary". Players (correctly) feel Uniques have no identity.

## Goal

Give every Unique item a **Unique Power**: a named, always-on signature effect
that Legendary items can never have. It must:

- Apply to **all** Unique items — the 3 hand-authored ones (`dawnbreaker`,
  `aegis-of-dawn`, `midas-paw`) **and** every procedural `mythic-*` Unique
  (~66 of them), with no per-item hand authoring required for the procedural set.
- Cover **existing/old item copies** players already own — with **zero save
  migration**.
- Read as a distinct, highlighted line in the item tooltip.
- Be balanced, deterministic, and fully unit-tested.

## Approach

### 1. Powers are derived from the ItemDef, never stored on the instance

A `ItemInstance` only stores `defId` + rolled values. The Unique Power belongs
to the item's *identity*, exactly like `petUtility` / `wingPassive`. So we
resolve it from the def at read time via a pure function:

```ts
uniquePowerFor(def: ItemDef): UniquePowerDef | null   // null unless rarity === "Unique"
```

Because nothing is written to the save, **every existing copy of a Unique —
already in players' inventories — gains its power automatically** the moment the
code ships. This is the cleanest way to satisfy "make sure old unique items also
have these affixes."

### 2. Powers resolve through the existing hero stat pipeline

`resolveHeroBattleStats` (heroStats.ts) already folds three kinds of
contribution into `heroStatPipeline`:

- **flat** — added to the base (e.g. fractional affixes like crit/omnivamp)
- **increased%** — additive `(1 + Σi)` (scalar affixes, passive nodes)
- **more%** — multiplicative `Π(1 + m)` (keystones, Unique jewels)

A Unique Power produces a `{ flat?, increased?, more? }` contribution that folds
into the **same three buckets**. No new battle-event plumbing, no per-hit hooks,
no instance recompute. This is the lowest-risk seam in the codebase and is
already covered by the stat-pipeline tests.

**The `more` bucket is the categorical distinction.** Legendary affixes only ever
roll into `flat` / `increased`. Only Unique Powers (alongside keystones / Unique
jewels) contribute multiplicative `more%`. Several powers also grant stats no
item affix can roll (e.g. `omnivamp` lifesteal). So a Unique is not "a bigger
Legendary" — it does something a Legendary structurally cannot.

### 3. The power catalog

`src/data/uniquePowers.ts` (pure, Phaser-free):

```ts
interface UniquePowerContext { uniqueCount: number; } // # of equipped Unique items
interface UniquePowerContribution { flat?: Partial<Stats>; increased?: Partial<Stats>; more?: Partial<Stats>; }
interface UniquePowerDef {
  id: string;
  name: string;
  /** Player-facing one-liner; magnitudes embedded. ctx lets count-scaled powers describe accurately. */
  describe(ctx: UniquePowerContext): string;
  contribution(ctx: UniquePowerContext): UniquePowerContribution;
}
```

Catalog (magnitudes chosen conservatively — `more` stacks multiplicatively on
top of everything, and 60% of hero stats are shared to towers):

| id | name | effect |
|----|------|--------|
| `sunflare` | Sunflare | +18% **more** Attack, +25% Crit Damage *(signature: dawnbreaker)* |
| `bulwark` | Aegis Bulwark | +20% **more** Max HP, +8% Damage Reduction *(signature: aegis-of-dawn)* |
| `midas` | Midas Touch | +50% **more** Gold Found *(signature: midas-paw)* |
| `bloodthirst` | Bloodthirst | Heals 12% of damage dealt (omnivamp) |
| `deadeye` | Deadeye | +30% Crit Damage, ignores 15% Armor |
| `warlord` | Warlord's Aura | +8% **more** Attack per Unique equipped (incl. this) |
| `juggernaut` | Juggernaut | +20% **more** Max HP, +15% Tenacity |
| `arcane_overflow` | Arcane Overflow | +25% **more** Skill Power, +6 Mana on Hit |
| `tempest` | Tempest | +6% Attack Speed, +30% **more** Move Speed |
| `colossus` | Colossus | +12% **more** Attack, +12% **more** Max HP |
| `fortune` | Fortune's Favor | +40% **more** Gold Found |

### 4. Assignment

`uniquePowerFor(def)`:

1. `def.rarity !== "Unique"` → `null`.
2. `SIGNATURE[def.id]` present → that power (the 3 named items).
3. Otherwise pick from `ARCHETYPE_POWERS[archetype]` where
   `archetype = def.archetype ?? archetypeFor(def)`, indexed by a deterministic
   hash of `def.id` (stable, varied across the line). Archetype pools:
   - physical → `[deadeye, bloodthirst, warlord]`
   - magic → `[arcane_overflow]`
   - defense → `[juggernaut, bulwark]`
   - utility → `[tempest, fortune]`
   - hybrid → `[colossus, warlord]`

Every Unique therefore resolves to exactly one power, deterministically.

### 5. Stat resolution

`src/core/uniquePowerStats.ts` (pure):

```ts
buildUniquePowerStats(save): { flat: Partial<Stats>[]; increased: Partial<Stats>[]; more: Partial<Stats>[] }
```

- Count equipped Unique items → `ctx.uniqueCount`.
- For each equipped item with a power, accumulate its `contribution(ctx)`.

In `resolveHeroBattleStats`: append `more` maps to the existing `keystoneMore`
array, `flat` maps to `affix.flat`, and wrap `increased` maps as increased-only
synthetic nodes (mirroring `affixNodes`). One small, localized edit.

### 6. Display

`itemDisplay.ts` gains `uniquePowerLine(def): { name: string; desc: string } | null`
(uses `describe({ uniqueCount: 1 })` for the static tooltip). The item tooltip
presenters (`itemCompareDialog.ts` and any inventory detail) render it as a gold
`◆ <name> — <desc>` line, visually distinct from the white/blue/purple stat rows.

## Out of scope (YAGNI)

- Per-hit / on-kill / threshold procs (would require new battle seams + recompute).
- Conditional-on-live-HP powers (battle hero stats resolve once at start).
- New art / icons (procedural gold line only → **no ASSET_VERSION bump**).
- Rebalancing Legendary or the rarity multipliers.

## Testing

- `tests/uniquePowers.test.ts`: every Unique item → a power; non-Unique → null;
  signatures map correctly; assignment deterministic; all archetypes covered;
  magnitudes positive; warlord scales with `uniqueCount`.
- `tests/uniquePowerStats.test.ts`: equipping a Unique yields the expected
  flat/increased/more; count-scaled powers scale; empty/no-unique → empty.
- Extend `tests/heroStats.test.ts`: a hero with a Unique equipped resolves to
  strictly higher stats than the same hero without it.

## Files

- **new** `src/data/uniquePowers.ts`, `src/core/uniquePowerStats.ts`
- **edit** `src/core/heroStats.ts` (fold contributions), `src/data/itemDisplay.ts`
  (display line), `src/scenes/itemCompareDialog.ts` (+ inventory detail) render.
- **new tests** as above.
