# Nerf Enemy Coin Gain — Design Spec

**Date:** 2026-06-14
**Status:** Approved (full-auto session)

## Problem

In-battle kill bounties pay out so much gold that the player can buy *and* fully
upgrade every tower in a stage. There is no economic tension — no "which towers do
I invest in?" decision. The over-supply comes from three stacked amplifiers on the
per-kill reward:

```
killGold = round(
  bounty
  × DIFFICULTY_SCALING[difficulty].bountyMult   // Normal 1, Hard 3, Nightmare 5
  × (elite ? 1.5 : 1)
  × (1 + hero.goldFind)
  × comboMult()                                  // ×1 → ×3 over a 20-kill streak
)
```

…plus a perfect-wave bonus of **25%** of the wave's kill gold when no enemy leaks.

The runaway is dominated by the **combo multiplier** (peaks at ×3) and compounded by
the perfect-wave kicker. A fast-clearing player earns far more than the tower-cost
sink can absorb.

## Goals

- Reduce **in-battle** gold income from enemy kills so the player must choose which
  towers to build/upgrade rather than affording all of them.
- Keep the nerf **graduated by skill**: hit the runaway combo income hardest, leave
  the baseline (low-combo) economy still playable.
- Single, tunable source of truth for the flat cut so future re-balancing is one line.

## Non-Goals (deliberately untouched)

- **Meta / post-battle gold** — `GOLD_REWARD`, `goldDepthMultiplier`, first-clear bonus.
  The complaint is about affording towers *during* a battle, not the meta economy.
- **Difficulty `bountyMult`** — Hard/Nightmare's 3×/5× are a difficulty-reward contract.
- **Starting gold, tower placement/upgrade costs, sell refund** — the spend side stays.
- **Pet passive gold, skip-reward gold** — minor, not the source of the over-supply.

## Design

Three constant changes, all in `src/core/battleTypes.ts`, consumed by existing seams:

1. **`BOUNTY_SCALE = 0.7`** — NEW constant. A flat 30% cut applied once to the
   per-kill `baseReward` in `BattleState.killEnemy` (`src/core/battleDamage.ts`).
   This is the single tunable knob for the overall bounty economy.

2. **`COMBO_MAX_MULT` 3 → 2** — the combo gold multiplier now caps at ×2 instead of
   ×3. This is the largest amplifier; halving its headroom removes most of the
   runaway. `comboMult()` already derives from this constant — no logic change.

3. **`PERFECT_WAVE_BONUS_FRAC` 0.25 → 0.15** — the flawless-clear kicker drops from
   25% to 15% of the wave's kill gold. `BattleState` already reads this constant.

### Net effect

| Combo state | Old factor (bounty×) | New factor (bounty×) | Change |
|---|---|---|---|
| No combo (×1)   | 1.00 | 0.70 | −30% |
| Mid combo (×2)  | 2.00 | 1.10 | −45% |
| Full combo (max)| 3.00 | 1.40 | −53% |

Plus the perfect-wave bonus shrinks from 25% → 15% on top. The cut deepens exactly
where the over-supply was worst (high streaks), which is the intent.

## Affected Code

- `src/core/battleTypes.ts` — add `BOUNTY_SCALE`; change `COMBO_MAX_MULT`,
  `PERFECT_WAVE_BONUS_FRAC` values (and update their doc comments).
- `src/core/battleDamage.ts` — multiply `baseReward` by `BOUNTY_SCALE` in `killEnemy`,
  and import the constant. Update the `// F13 combo (×1 → ×3)` comment to `×2`.

No data-file (enemy bounty) edits — the flat scale keeps every enemy's *relative*
value intact while cutting the absolute supply.

## Testing (TDD)

New/updated tests, RED first:

1. **`BOUNTY_SCALE` is applied** — a single kill with a known bounty, zero goldFind,
   zero combo decay window, Normal difficulty, no elite → credited gold equals
   `round(bounty × BOUNTY_SCALE)` for the first kill (combo = 1 ⇒ comboMult 1).
2. **Combo caps at ×2** — `comboMult()` at/above `COMBO_KILLS_FOR_MAX` returns 2, not 3
   (assert against `COMBO_MAX_MULT` so the test tracks the constant).
3. **Perfect-wave bonus uses 0.15** — assert the constant and/or the bonus math in the
   existing combo-perfect test reflects 15%.

Existing tests to reconcile (their literal expectations change):
- `tests/battle.test.ts` "awards bounty gold" — lower-bound assertion; re-derive.
- `tests/combo-perfect.test.ts` — combo ramp + perfect-wave expectations.

All values asserted **against the exported constants**, not hard-coded magic numbers,
so the suite stays green through future tuning.

## Risks

- **Too harsh?** If 0.7 / ×2 / 0.15 over-corrects (player starved), the single
  `BOUNTY_SCALE` knob makes a follow-up tune trivial. Conservative-leaning values
  chosen so a follow-up nudge upward is the likely worst case, not a re-architecture.
- No save-version impact (no persisted-state change). No asset/`ASSET_VERSION` impact.
