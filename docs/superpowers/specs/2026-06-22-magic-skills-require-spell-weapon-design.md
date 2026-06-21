# Magic skills require a dedicated spell weapon

Date: 2026-06-22

## Problem

Magic active skills must be cast with a **spell weapon** (tome / staff / scepter /
wand) — **never a gun or a bow**. The current weapon-class gate has a loophole that
breaks this rule.

`weaponClassMet("magic", weaponType, archetype)` currently returns true when:

```
MAGIC_WEAPONS.has(weaponType)   // Staff, Tome
  || archetype === "magic"      // ANY weapon built as a magic carry
```

The second clause is **weapon-type-agnostic**. A `Gun` or `Bow` item rolled with a
magic build archetype (skillPower / magicDamage primary) therefore satisfies the
magic gate today — directly violating "not gun or bow". It also lets an enchanted
"magic sword" cast spells, which the new rule disallows.

## Change

Magic class is satisfied **only by dedicated caster weapon types**: `Staff` and
`Tome`. The coarse `WeaponType` enum has exactly these two caster types, and
scepter/wand homages already map onto `Staff` (e.g. `eldwood-wand` →
`weaponType: "Staff"`). So "any spell weapon (tome / staff / scepter)" is fully
covered while `Gun`, `Bow`, and `Sword` — including magic-archetype ones — are all
excluded.

The `archetype` loophole is removed entirely. `weaponClassMet` no longer needs the
`archetype` argument (melee and ranged never used it, and magic no longer does), so
the parameter is dropped. Only `src/core/loadout.ts` calls it.

```ts
export function weaponClassMet(
  req: WeaponClass | undefined,
  weaponType: WeaponType | undefined,
): boolean {
  if (!req) return true;
  if (!weaponType) return false;
  switch (req) {
    case "magic":  return MAGIC_WEAPONS.has(weaponType); // Staff | Tome only
    case "melee":  return MELEE.has(weaponType);
    case "ranged": return RANGED.has(weaponType);
  }
}
```

## Scope

- **Hero active-skill weapon gate only** (`weaponClassMet` / `skillWeaponMet` in
  `loadout.ts`). Tower active skills are not weapon-gated (towers have no equipped
  weapon) and are untouched.
- Deliberately reverses the earlier "a magic sword counts as a magic weapon"
  allowance — the design now requires a real caster weapon.
- `loadout.ts` drops the now-unused `archetypeFor` import for the magic gate call.
- Player-facing label in `skillDescribe.ts`:
  `"Requires a magic weapon"` → `"Requires a spell weapon (staff/tome/scepter)"`.

## Tests (TDD)

- `tests/weaponClass.test.ts`: flip "magic is met by a magic-archetype sword" to
  assert it is **rejected**; add a guard that a magic-archetype **gun and bow** are
  rejected (the closed loophole). Update the existing call-sites to the 2-arg
  signature.
- `tests/skill-weapon-gate.test.ts`: replace "castable with a magic sword" with
  "NOT castable with a magic sword"; keep "castable with a staff".

## Non-goals

- No new `Scepter`/`Wand` `WeaponType` (YAGNI — they map to `Staff`; adding a coarse
  type would drag in art, manifests, hold poses, and ranges for zero behavioural
  gain).
- No save migration, no art, **no `ASSET_VERSION` bump** (pure gate logic + one
  display string).
