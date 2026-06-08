# Weapon-type range & attack identity — design

**Date:** 2026-06-09

## Goal

The hero's equipped weapon should completely define how the hero fights:

- **Range comes from the weapon family.** Melee weapons (Sword, Fist) reach a short
  distance; ranged weapons (Bow, Gun) reach far; magic weapons (Staff, Tome) sit in
  between. With no weapon equipped the hero fights bare-fisted (boxing) at the
  shortest range.
- **The attack animation & projectile read by weapon type.** No weapon = boxing
  punches, Sword = a slash, Gun = firing a bullet, Bow = loosing an arrow,
  Staff/Tome = firing a magic bolt.

## Current state (what already exists)

- `range` is a first-class `Stats` field; the hero's base is `130` (`stage.ts`
  `defaultHeroStats`). Targeting uses it (`battle.ts` `updateHero` →
  `selectTarget(h.pos, h.stats.range, …)`).
- `HeroLayeredSprite.playAttack()` already tweens the *held weapon* per family
  (bow draws, gun recoils, staff raises, sword swings).
- `fx.ts attackFx(style, …)` already dispatches projectile visuals per style string
  (arrow, arcane orb, cannon, slash, …).
- `heroAttackStyle(damageType, range)` picks the hero's style — but only from damage
  type + range, so weapon family is ignored. Every weapon reaches the same `130`.

The only gaps: **range is not weapon-driven**, and **style is not weapon-driven**.

## Design

### 1. `src/data/weaponRange.ts` (new)

A single source of truth mapping weapon family → characteristic reach. Values
straddle the existing `RANGED_MELEE = 120` threshold so families read correctly as
melee vs. ranged:

| Family       | Range |
|--------------|-------|
| Fist         | 90    |
| Sword        | 115   |
| Bow          | 240   |
| Gun          | 260   |
| Staff        | 210   |
| Tome         | 195   |
| Any          | 150   |
| (unarmed)    | 90    |

`heroRangeForWeapon(weaponType: WeaponType | null): number` returns the unarmed
(Fist) value for `null`.

### 2. `heroStats.ts`

`resolveHeroBattleStats` already iterates equipped items. It will also read the
equipped Weapon's `weaponType`, set the **base** `range` to `heroRangeForWeapon(...)`
before running `heroStatPipeline` (so `% range` affixes — e.g. Elven Bow — scale on
top of the family base), and return `weaponType` in `ResolvedHeroStats`.

### 3. `attackStyle.ts`

New union members `"punch"` and `"gunshot"`. `heroAttackStyle` takes the weapon type:

```
heroAttackStyle(weaponType, damageType, range):
  Fist | null  -> "punch"
  Sword        -> "slash"
  Bow          -> "arrow"
  Gun          -> "gunshot"
  Staff | Tome -> "arcane"
  Any | default-> legacy (Magic ? "arcane" : range >= 120 ? "arrow" : "slash")
```

### 4. `fx.ts`

- `"punch"`: a short forward fist streak from the hero into the target + a small
  impact burst (melee, no flying projectile).
- `"gunshot"`: a fast thin bullet tracer from hero to target + a muzzle spark
  (faster/straighter than the lobbed `cannon` orb).

### 5. `battle.ts`

`HeroRuntime` gains `weaponType: WeaponType | null`. Both hero-construction paths
set it (from `resolveHeroBattleStats` when a save exists, else `null`). `updateHero`
passes it to `heroAttackStyle`.

### 6. `HeroLayeredSprite.ts`

Add an explicit `Fist` case to `playAttack()` — a quick forward jab (rather than the
sword swing it currently falls through to).

## Testing

- `weaponRange.test.ts`: every `WeaponType` resolves to a positive range; melee
  families < 120 < ranged families; `null` → Fist range.
- `attack-style.test.ts`: update the hero block — `heroAttackStyle("Gun", "Physical",
  260) === "gunshot"`, `("Sword", …) === "slash"`, `(null, …) === "punch"`,
  `("Staff", …) === "arcane"`, `("Bow", …) === "arrow"`; "known styles" set gains
  `punch`/`gunshot`.
- Existing battle/hero tests stay green (range numbers change but assertions are on
  behaviour, not the literal 130).

## Out of scope

- Tower attack styles (already handled by `attackStyleFor`).
- The base hero rig art baking a sword into every frame (separate art task).
