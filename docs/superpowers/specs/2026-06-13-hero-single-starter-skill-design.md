# Hero starts with a single equipped active skill

**Date:** 2026-06-13
**Status:** Approved (full-auto, self-approved)

## Problem

A brand-new hero is created with **both** weapon-free starter skills equipped:

```ts
// src/core/saveManagerCore.ts  freshWithStarters()
save.hero.equippedSkillIds = [...STARTER_SKILL_IDS]; // ["valiant-strike", "spirit-bolt"]
```

This violates the game's own invariant `MAX_ACTIVE_SKILLS = 1` (`src/data/skills.ts`). A
hero may only *cast* one active at a time (`heroActiveBurst` reads
`equippedSkillIds[0]`), so the second equipped id is dead state that is also
internally inconsistent: the save-migration path already clamps loaded saves down to a
single equipped slot (`src/core/save.ts`), seeding `[STARTER_SKILL_IDS[0]]`, but the
fresh-save path does not. Fresh saves and migrated saves therefore start in different
states.

## Goal

At the beginning, a hero **picks/has exactly one** active skill equipped — consistent
with `MAX_ACTIVE_SKILLS` and with the migration path.

## Design

Change `freshWithStarters()` so the hero still **owns** both weapon-free starters (they
remain in `obtainedSkills`, so the collection UI and drop dedupe logic are unaffected),
but **equips only the first** one:

```ts
save.hero.equippedSkillIds = [STARTER_SKILL_IDS[0]]; // just "valiant-strike"
```

### Why "own both, equip one"

- Owning both keeps the starter-grant intent (one Physical, one Magic available to swap
  to immediately) and keeps `drops.ts` from re-dropping a starter.
- Equipping one satisfies `MAX_ACTIVE_SKILLS = 1` and matches the migration path exactly,
  so fresh and migrated saves converge on the same shape.

### Scope / non-goals

- `MAX_ACTIVE_SKILLS` stays `1`. No loadout/UI change — `equipSkill` already enforces the
  cap, and `SkillsScene` already toggles a single equipped slot.
- The comment on line 77 ("starts with two weapon-free active skills") stays accurate for
  *ownership*; clarify it to note only one is *equipped*.

## Testing (TDD)

Add a test asserting the fresh-save invariant:

- `freshWithStarters()` (exercised via a `SaveManagerCore` over an empty in-memory
  provider, or the existing test entry point) yields `equippedSkillIds.length === 1`.
- The single equipped id is `STARTER_SKILL_IDS[0]`.
- `obtainedSkills` still contains **both** starter ids (ownership preserved).
- Guard against regression of the cap generally: `equippedSkillIds.length <= MAX_ACTIVE_SKILLS`.

RED first (current code equips two → length 2 fails), then the one-line GREEN change.
