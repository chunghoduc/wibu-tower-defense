# Design: Make Bosses More Tanky

Date: 2026-06-12
Status: Approved (full-auto session — design decisions made by the agent on the owner's behalf)

## Problem

Bosses die too quickly relative to their billing as the marquee threat of a stage.
The root cause is structural, not per-boss:

`battleWaves.spawnEnemy()` computes boss HP as

```
maxHp = baseStats.maxHp × difficulty.hpMult × bossHpMult × hpMul
```

where `bossHpMult` is the ONLY multiplier that distinguishes a boss's bulk from
trash scaling. Its current values (`src/data/schema.ts` `DIFFICULTY_SCALING`):

| Tier      | hpMult | bossHpMult | effective boss HP factor |
| --------- | ------ | ---------: | ------------------------ |
| Normal    | 1.55   |    **1.0** | 1.55× base               |
| Hard      | 7.8    |        1.5 | 11.7× base               |
| Nightmare | 14.8   |        1.8 | 26.6× base               |

On **Normal** `bossHpMult` is a no-op: a boss is exactly as tanky as scaled trash
of equal base HP. That is the tier most players spend the most time in, and it is
where bosses feel flimsiest.

## Goal

Make bosses tankier across all tiers, with the largest _relative_ lift on Normal
(where the lever is currently dead), without:

- breaking the monotonic difficulty law (Normal < Hard < Nightmare must hold —
  see the `difficulty_monotonic_law` memory),
- touching trash/elite HP (this is a boss-bulk change only),
- changing boss ATK (kept separate; bumping HP alone makes the fight _longer_,
  not _swingier_ — the intended "more tanky" feel).

## Approach (chosen)

Raise `bossHpMult` for every tier in `DIFFICULTY_SCALING`. This is the single
authored constant the whole engine already routes boss bulk through, so one edit
propagates to all 20 bosses, campaign + endless + boss-rush, with zero new code
paths and no risk of per-boss drift.

| Tier      | bossHpMult old → new | new effective boss HP factor | boss bulk change |
| --------- | -------------------- | ---------------------------- | ---------------- |
| Normal    | 1.0 → **1.6**        | 2.48× base                   | +60%             |
| Hard      | 1.5 → **2.0**        | 15.6× base                   | +33%             |
| Nightmare | 1.8 → **2.4**        | 35.5× base                   | +33%             |

Rationale for the numbers:

- **Normal +60%**: the lever was dead here; 1.6 gives bosses a clear "this is the
  wall" moment without making early campaign a slog (trash is untouched, and the
  bump only lands on the one boss per stage).
- **Hard / Nightmare +33%**: already tanky; a proportional lift keeps the marquee
  threat ahead of the rising trash floor without runaway bullet-sponginess.
- Ordering preserved: 1.6 < 2.0 < 2.4, and combined factors 2.48 < 15.6 < 35.5
  stay strictly increasing — monotonic law intact.

### Alternatives considered

1. **Bump each boss's `baseStats.maxHp` in `enemiesBosses.ts` / antiheroes.**
   Rejected: edits ~20 definitions, invites per-boss drift, and doesn't fix the
   structural "Normal lever is dead" issue. The relative ranking (`BOSS_HP_RANK`)
   would also need re-checking.
2. **Add boss flat damage reduction (like elites' 50% DR).** Rejected: changes
   _how_ bosses tank (favours chip/true damage, nerfs burst) — a balance shift
   beyond "more tanky", and a new code path in the damage pipeline.
3. **Raise `bossHpMult` (chosen).** One constant, no new code, preserves all
   existing intent and ordering.

## Components touched

- `src/data/schema.ts` — `DIFFICULTY_SCALING` `bossHpMult` values + the doc-comment
  combat-power example (kept accurate).

No engine/code changes: `spawnEnemy` already multiplies by `bossHpMult`.

## Testing

Pure-data, Phaser-free unit test (`tests/bossTankiness.test.ts`):

1. `bossHpMult` is strictly increasing across Normal → Hard → Nightmare.
2. Normal `bossHpMult` ≥ 1.5 (the lever is no longer a no-op — bosses are
   meaningfully tankier than equal-base trash on the base tier).
3. Effective boss HP factor (`hpMult × bossHpMult`) is strictly increasing across
   tiers — the monotonic difficulty law holds at the boss level.

Plus the existing suite (`npm test`) and `npm run build` stay green.

## Out of scope

- Per-boss HP authoring, boss ATK, trash/elite scaling, the wave/progression
  curves, and any damage-reduction mechanic.
