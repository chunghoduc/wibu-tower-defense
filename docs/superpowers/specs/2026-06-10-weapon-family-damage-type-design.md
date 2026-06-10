# Weapon-Family → Damage-Type Rework (Approach 3)

**Date:** 2026-06-10
**Status:** Design approved — ready for `writing-plans`

## Problem

Ranged attack towers should be diversified by weapon family, with a *canonical*
rule mapping weapon → damage type: bow / gun / crossbow users are **physical**;
staff / tome / scepter users are **magic**; etc. Today `meta.weapon` is a free-text
flavour string, `damageType` is hand-authored per tower (so it can silently
contradict the weapon), and the 37-tower roster contains **zero** genuine
bows / guns / crossbows / tomes / scepters — it is almost entirely
fists / ki / swords / katana plus thematic implements.

## Decisions (locked)

- **Direction A** — establish a canonical weapon-family → damage-type ruleset,
  audit the roster, fix only violations/redundancies, preserve homage identities,
  **and add ≥15 new towers** to fill the empty weapon families.
- **Option (ii) Elemental Enchant** — weapon family decides damage type by
  default, BUT elemental/spirit energy can "enchant" a physical weapon into Magic
  (e.g. magma fists, frost katana). This is the per-tower escape hatch from the
  otherwise-deterministic mapping.
- **Approach 3 (Structured weapon field)** — replace the free-text `meta.weapon`
  string with a structured `WeaponSpec` object and **derive** `damageType`, attack
  style, and range band from it. Weapon in → everything else out. An inconsistent
  tower becomes impossible to author.

## Section 1 — Weapon-family taxonomy (single source of truth)

New module `src/data/weaponFamily.ts` holds one canonical table every system reads.
Each family maps to a damage-type *class*, a default attack style, and a base range
band:

| Class | Families | Default dmgType | Range band |
|---|---|---|---|
| **Physical melee** | `fist`, `sword`, `spear`, `blunt` | Physical | 85–115 (cleaves) |
| **Physical ranged** | `bow`, `crossbow`, `gun`, `thrown` | Physical | 200–260 |
| **Magic implement** | `staff`, `tome`, `scepter`, `wand`, `rod`, `orb` | Magic | 170–210 |
| **Conduit** (bodily/elemental energy, no held weapon) | `ki`, `aura`, `curse`, `nature`, `shadow`, `sand`, `talisman`, `instrument`, `banner` | by element/force | varies |

- **Enchant rule:** a Physical family with `enchanted: true` (elemental/spirit energy
  infusing it) derives as **Magic**. Plain `sword` = Physical; `sword + enchanted` = Magic.
- **Conduit families:** derive type from whether the energy is physical force
  (`ki`, `sand` → Physical) or mystic (`curse`, `nature` foxfire → Magic),
  again overridable by `enchanted`. Support-oriented conduits (`banner`,
  `instrument`) resolve via role, not weapon.
- `damageType`, attack style, and base range are **derived**, never authored
  independently.

## Section 2 — Structured `weapon` field (Approach 3 data model)

`CharacterMeta.weapon` changes from `string` to:

```ts
interface WeaponSpec {
  family: WeaponFamily;       // drives class → damageType, style, range
  element?: Element;          // fire|ice|lightning|poison|holy|none — VFX sub-style
  enchanted?: boolean;        // option-ii: makes a physical family read as Magic
  display: string;            // player-facing text (what CollectionScene shows today)
}
```

Wiring:
- `attackStyleFor()` is **rewritten** to read `weapon.family` + `weapon.element`
  directly — deletes the brittle keyword-matching against prose.
- `towerBuilder.t()` **derives `damageType` from the weapon**; the hand-authored
  `damageType` field on each `t({...})` def is removed (computed instead).
- `CollectionScene.ts:183` reads `weapon.display` (one-line change).
- `weaponRange.ts` / `WEAPON_RANGE` folds into the family table; hero `WeaponType`
  (Sword/Bow/Staff/Gun/Tome/Fist/Any) becomes a **subset alias** mapping onto
  families, so hero equipment + `heroAttackStyle` keep working unchanged.
- Schema + validators (`schema.ts`, `schemaValidators.ts`) updated for the new shape.

## Section 3 — Audit of all 37 existing towers

Under Option (ii), almost every current `damageType` is **preservable** by tagging
energy/elemental weapons as `enchanted` rather than flipping stats. This is a
low-risk re-tag, not a rebalance. Each existing tower gets a `WeaponSpec` whose
derived `damageType` **must equal its current one** — a migration test asserts this
(zero stat drift).

- **Clean physical melee** (family only): yamo `fist`, zoran `sword`, sota `fist`,
  prince-vael `fist`, tobi `thrown`, bram `nature`, garan `sand`, riku/joro/reinhart/garron
  `fist`, senna `fist`.
- **Physical ranged (existing)**: iron-bo `gun` (forearm cannons), pip `gun`/`thrown`
  (gunpowder).
- **Enchanted (physical family → Magic via element)**: kazu `sword`+spirit,
  karu `fist`+ki, akagan `fist`+fire, kanae `sword`+petal, zeni `sword`+lightning,
  hyo `sword`+ice, kilo `fist`+lightning, sasu `sword`+lightning, garrek `fist`+iron,
  yuki `sword`+ice.
- **Conduit-magic** (energy, Magic by nature): jugo `curse`, kona `nature` (foxfire),
  shion `talisman`+poison, roan `aura`+fire, morren `curse` (decay; True via dot),
  doro `nature` (mire), shika `shadow`, glace `aura`+ice, megu `staff`.
- **Support conduits (role-resolved)**: aldric `banner`, mochi `staff`/pom-poms,
  lyra `instrument`, orin `staff`.

**Display-string touch-ups only** (no mechanical change): glace ("ice-make" →
"ice conjurer's focus"), doro ("tar/mud" → "mire conduit"). No `damageType` flips,
no stat changes anywhere in the existing 37.

## Section 4 — The 16 new towers (filling empty families)

All created via the `create-character` skill (story → stats → art → animation).
Distribution weighted toward the ranged/magic gap:

**Physical ranged:**
1. Bow — `damage` Common (rapid archer)
2. Bow — `chain` Rare (ricochet volley)
3. Bow — `splash` Legendary (arrow-rain)
4. Crossbow — `damage` Magic (heavy-bolt sniper)
5. Crossbow — `dot` Rare (poison-bolt)
6. Gun — `damage` Rare (gunslinger)
7. Gun — `splash` Legendary (grenadier)
8. Gun — `chain` Unique (ricochet pistolero)
9. Thrown — `debuff` Magic (kunai/bola — slows)

**Magic implement:**
10. Tome — `dot` Magic (curse-scribe)
11. Tome — `debuff` Rare (hex-scholar)
12. Scepter — `support` Legendary (royal warding)
13. Scepter — `chain` Rare (arc-scepter)
14. Wand — `splash` Common (spark-wand)
15. Wand — `damage` Legendary (arcane-missile)
16. Orb — `support` Unique (oracle's orb)

Every empty family is covered. Roles stay roughly balanced; tanker stays
melee-only by design. Each new tower's `damageType` is *derived* from its family,
so by construction it cannot violate the ruleset.

## Section 5 — Enforcement & process

- **Vitest derivation-stability test**: for every tower, recomputing `damageType`
  from its `WeaponSpec` yields the value the build actually used.
- **Migration-parity test**: each of the 37 existing towers' derived `damageType`
  equals its pre-rework value (zero drift).
- **Family-coverage test**: asserts ≥1 tower exists in each previously-empty family.
- **<500-line rule**: taxonomy lives in its own `weaponFamily.ts`; if `towers.ts` /
  `towersB.ts` exceed 500 lines after additions, split into focused modules
  (e.g. a third `towersC.ts` for new ranged/magic towers).

## Build order

1. `weaponFamily.ts` taxonomy + derivation helpers.
2. `WeaponSpec` schema + validators; `towerBuilder.t()` derives `damageType`.
3. Rewrite `attackStyleFor`; fold `WEAPON_RANGE` into the family table; map hero
   `WeaponType` → family; `CollectionScene` display.
4. Re-tag the 37 existing towers (migration test = zero drift).
5. Add the 16 new towers via `create-character`.
6. Enforcement tests + module split; full suite green.
