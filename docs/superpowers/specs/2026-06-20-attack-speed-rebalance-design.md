# Attack-Speed Rebalance — Design Spec

Date: 2026-06-20
Branch: wip/sprite-art-restyle

## Problem

Attack speed (attacks/second) has **no ceiling**. Stacking gear pushes towers and
the hero to **10+ atk/sec**, which trivialises combat. Two compounding causes:

1. **Hero-share explosion.** `addHeroShare` (src/core/stats.ts) adds
   `0.6 × heroAttackSpeed` *flat* onto every tower (attackSpeed baseline is 0).
   A hero who stacks attack-speed gear dumps a large flat bonus onto the whole army.
2. **Unbounded item rolls.** Item base `attackSpeed` stats are added flat to the
   hero, and random `attackSpeed` affixes roll the generic `[0.05, 0.20]` increased%
   band — up to 3 per Legendary/Unique — with no cap anywhere downstream.

The combat sim consumes the final value with no clamp:
`effAs = attackSpeed × (1 + buffAsPct)`, then `cooldown = 1 / effAs`.

## Goals

- **Hard cap attack speed at 5 atk/sec** (min cooldown 0.2s) — a guaranteed ceiling
  regardless of how stats are stacked.
- **Nerf every attack-speed ITEM source** so that reaching 5 is *super hard* —
  attainable only by saturating many sources at once, not by casual gearing.
- No regression to enemy difficulty, no save migration, no UI rework.

## Non-Goals

- Touching non-item attack-speed sources: tower **star scaling**, **passive grid**
  nodes, squad **synergies**, support **auras**. These are not "items"; the hard cap
  already contains their combined contribution.
- A save migration. Already-rolled item instances keep their stored values; the
  runtime cap still protects combat, and re-rolls (Reforge/new drops) use the
  nerfed ranges.
- Tooltip / stat-panel changes to surface the cap (possible future polish).

## Design

### Lever 1 — Hard cap (the guarantee)

New pure module **`src/core/attackSpeedCap.ts`**:

```ts
export const ATTACK_SPEED_CAP = 5; // attacks per second
export function cappedAttackSpeed(raw: number): number {
  return raw > ATTACK_SPEED_CAP ? ATTACK_SPEED_CAP : raw;
}
```

Applied at every consumption site on the **final effective** attack speed (after
`buffAsPct`), immediately before the `1 / x` cooldown reset:

- **`src/core/battleTowers.ts`** `updateTowers`:
  `const effAs = cappedAttackSpeed(t.stats.attackSpeed * (1 + t.buffAsPct));`
- **`src/core/battleHero.ts`** `updateHero`: clamp `h.stats.attackSpeed` via the
  helper before the `> 0` gate / cooldown reset.
- **`src/core/battleEnemies.ts`** `enemyAttack`: clamp `e.stats.attackSpeed`.
  Enemies never approach 5, so this is a no-op today — included only to make the
  "5 atk/sec" rule universal and future-proof.

The helper preserves the existing `<= 0` guards (a clamped value is always ≥ the
raw value's sign; we only reduce when above the cap).

### Lever 2 — Nerf attack-speed items (makes 5 hard)

All edits are to **data** files; no logic change beyond the new range entry.

**A. Random affix roll band** — `src/data/items.ts` `AFFIX_RANGE`:
add `attackSpeed: [0.02, 0.06]` (was the default `[0.05, 0.20]`). This is the
single biggest stacking lever: Legendary/Unique roll up to 3 affixes from their
pool, and `attackSpeed` appears in ~14 item pools.

**B. Primary affix `baseValue` (type `attackSpeed`)** — halve, rounded to clean values:
| File | Item | Before | After |
|------|------|--------|-------|
| items.ts | Dagger of Swiftness | 0.12 | 0.06 |
| itemLines.ts | (primary attackSpeed lines) | 0.20 / 0.08 / 0.06 | 0.10 / 0.05 / 0.04 |
| itemsExpansion.ts | (primary attackSpeed line) | per-line | ~halved |

**C. Item base `attackSpeed` stats** (flat → fuels the hero-share path):
0.3→0.12, 0.2→0.10, 0.08→0.05, 0.06→0.04 across items.ts / itemLines.ts /
itemsExpansion.ts.

**D. Jewels** (socketed gear, item-class) — `src/data/jewels.ts`
`increased.attackSpeed`: 0.06→0.03, 0.08→0.04.

### Guard test

A data-driven test scans `ITEM_CATALOG` (and the jewel catalog) and asserts that
**no** item's primary-`attackSpeed` `baseValue`, base `attackSpeed` stat, or jewel
`increased.attackSpeed` exceeds the nerfed thresholds, and that `AFFIX_RANGE.attackSpeed`
is the nerfed band. Any future attack-speed item that re-inflates the value fails CI.

## Expected post-change numbers (illustrative)

- Base tower aspd ≈ 0.7–1.4. Maxed non-item sources (★5 +70%, synergy ×1.15,
  aura ×1.18, passives +0.25) land a tower around **~3** atk/sec with *zero* gear.
- Heavy nerfed-item investment + full hero-share pushes a fully-optimised tower
  toward **4–5**, hitting the **5** cap only at saturation.
- A casual mid-game tower sits around **2–3** — the intended band.

## Testing strategy (TDD)

1. **RED** `attackSpeedCap.test.ts`: cap constant is 5; `cappedAttackSpeed`
   clamps above 5, passes through ≤ 5, preserves 0 / negatives.
2. **RED** `attackSpeedItems.test.ts` (guard): `AFFIX_RANGE.attackSpeed` band;
   no item/jewel attack-speed source exceeds thresholds.
3. **GREEN**: create the helper, wire the three sim sites, apply the data nerfs.
4. Full `npm test`, lint, build green. CDP playtest optional (combat-timing only).

## Risk / rollback

- Pure additive guard + a single `Math.min`; isolated and reversible.
- No save shape change → safe for returning players.
- If 5 still feels reachable too easily, tighten Lever-2 magnitudes further; the
  cap constant is a one-line tune.
