# Design — Tower Stat Rebalance: lower base, reward star-up (flat + %)

**Date:** 2026-06-14
**Status:** Approved (full-auto self-approval)

## Problem

Towers in battle share **60%** of the commanding hero's resolved stats (`addHeroShare`,
`HERO_TOWER_SHARE = 0.6`). As a hero levels and gears up, that share dominates a tower's
own numbers — so a tower's *intrinsic* base stats matter most in the early game, and the
**collection star tier** (the persistent duplicate-fusion progression, ★1…★5) contributes
only a modest, percentage-only bonus.

Current star scaling (`STAR_STEP` in `core/stats.ts`):

```
STAR_STEP = [0, 0, 0.08, 0.14, 0.20, 0.26]   // increased% added by REACHING ★2..★5
cumulative: ★1 0% · ★2 8% · ★3 22% · ★4 42% · ★5 68%
```

It is applied as `increased%` to **all** stats in `towerStatPipeline`. There is **no flat
component**, so on a tower whose base is small the early stars feel marginal, and the loop
"collect duplicates → ascend" reads as low-value.

## Goal (from the request)

> Rebalance all towers. Because towers share hero stat, the **base stat of all towers needs
> to be lower**, but the stat should be **increased more based on star-up (a flat amount +
> percentage)** — so towers may be **weak at first** but are **all worth starring up**.

Net intent: shift power budget **out of** the flat base and **into** the collection-star
progression, and make each star a *flat amount **plus** a percentage* so star-up is clearly
worth it — even when a strong hero share would otherwise dilute a pure percentage.

## Approach

Two coordinated levers, both in the **pure, unit-tested** stat layer. No engine/sim changes,
no per-tower data edits (the role×rarity baseline owns the core budget for every tower — see
the `towerBuilder overwrites core stats` memory — so one table edit rebalances the whole
roster coherently).

### Lever 1 — Lower the base power budget

In `data/towerStats.ts → towerBaseline`, scale the two **power** stats (`atk`, `maxHp`) by a
single constant:

```
BASE_POWER_SCALE = 0.7   // every tower's intrinsic atk & maxHp drop to 70%
```

- `attackSpeed`, `manaOnHit`, the defensive layer (`augmentTowerStats`) and the damage-type
  archetype (`applyDamageArchetype`) are **unchanged** — the ask is about raw stat *power*
  (atk/hp), and cutting cadence or defense would feel bad and muddy the rebalance.
- **Placement cost is unchanged.** Towers cost the same but start weaker, which sharpens the
  incentive to invest in stars and keeps the in-battle gold economy stable.

A freshly-collected ★1 tower is therefore ~70% of its old power: deliberately weak at first.

### Lever 2 — Star-up = flat **+** percentage (both grow per star)

In `core/stats.ts`, the star layer of `towerStatPipeline` gains a **flat** component
alongside a **bumped percentage**. The flat is **rarity-scaled and absolute** (not a fraction
of base), so it stays a meaningful jump even though the base was lowered, and it is largest in
relative terms exactly when the hero share is small (early/mid game) — which is when the
collection loop should feel rewarding.

**Percentage** (`increased%`, applied to all stats, as today — but bigger):

```
STAR_STEP = [0, 0, 0.10, 0.15, 0.20, 0.25]
cumulative: ★1 0% · ★2 10% · ★3 25% · ★4 45% · ★5 70%
```

**Flat** (absolute, added to `atk` & `maxHp` only, in the pipeline's flat bucket so it
compounds with the percentage: `(base + flat) × (1 + inc%)`). Per **step** (per star reached),
scaled by rarity tier `t` (Common 0 … Unique 4):

```
flat atk  per step = 4  + 2  · t      // Common +4,  Unique +12 per star
flat maxHp per step = 18 + 10 · t     // Common +18, Unique +58 per star
starFlat(stars, rarity) = (clamp(stars,1..5) − 1) × perStep
```

This requires threading the tower's **rarity** into `towerStatPipeline` (added as a trailing
optional `rarity = "Common"` param; all call sites pass `def.rarity` / `t.def.rarity`).

### Resulting curve (damage role, Physical, illustrative)

| | base atk (old → new) | ★1 atk | ★3 atk | ★5 atk | old ★5 atk |
|---|---|---|---|---|---|
| Common | 18 → 13 | 13 | (13+8)×1.25 ≈ **26** | (13+16)×1.70 ≈ **49** | 30 |
| Unique | 61 → 43 | 43 | (43+24)×1.25 ≈ **84** | (43+48)×1.70 ≈ **155** | 102 |

(Numbers before hero share / mastery / battle-star upgrades, which all still stack on top.)

- **★1 is weaker** than before (~70%) → "weak at first". ✅
- An **invested** tower (★3+) already **exceeds** its old self, and a fully-ascended ★5
  (gated behind 1+3+7+15 = 26 duplicate copies + crystals) is a standout ~1.5–1.6× its old
  power → "all worth starring up". ✅

The early/mid game gets slightly harder (weaker ★1–★2 towers); the deep collection grind gets
a much bigger payoff. This respects the difficulty-monotonic law (it changes *player power*,
not wave/stage/chapter ordering).

## Components touched

| File | Change |
|---|---|
| `src/data/towerStats.ts` | `BASE_POWER_SCALE = 0.7` applied to `atk` & `maxHp` in `towerBaseline`. |
| `src/core/stats.ts` | New `STAR_STEP`; new `STAR_FLAT_*` constants + `starFlat(stars, rarity)` + `starUpStepFlat(stars, rarity)` helpers; `towerStatPipeline` gains a trailing `rarity` param and adds the star flat to the flat bucket. |
| `src/core/battlePlacement.ts` | 4 `towerStatPipeline(...)` call sites pass `def.rarity` / `t.def.rarity`. |
| `src/scenes/squadInfoPanel.ts` | Pass `def.rarity`; the "Next ★ →" line shows the flat **and** % the next star adds. |
| `tests/stats.test.ts` | Update star expectations; add flat + rarity cases. |
| `tests/tower-stats-baseline.test.ts` (new) | Lock the lowered baseline (atk/maxHp ×0.7, cost unchanged). |

Existing battle/mechanics tests build synthetic towers via `makeStats({...})` (bypassing
`towerBaseline`) and assert *relative* (greater-than) star/level scaling, so they remain green.

## Data flow (unchanged shape)

```
def.baseStats ──towerStatPipeline(level, stars, role, battleLevel, RARITY)──► resolved
   (lowered base)        │ +level flat                                          │
                         │ +STAR FLAT (atk,hp, rarity-scaled)  ← NEW            │
                         │ ×(1 + STAR % + role-upgrade %)                       │
                         ▼                                                      ▼
                    addHeroShare(+60% hero) → ×mastery×awakening×synergy → ×battleLevelAtk
```

## Testing

- **Unit (pure):** `starFlat`/`starUpStepFlat` (zero at ★1, rarity scaling, cap at ★5,
  no mutation); `starIncreasedPct` new cumulative values; `towerStatPipeline` produces
  `(base+flat)×(1+pct)` for atk/maxHp and percentage-only for other stats; `towerBaseline`
  lowered atk/maxHp with unchanged cost/attackSpeed.
- **Integration:** existing `phase3b` / `tower-upgrade` relative assertions stay green; full
  suite must pass.
- **Verify:** tsc + eslint (no file over 500 lines) + full vitest + `npm run build`.
- Code-only (no art/audio) → **no `ASSET_VERSION` bump**.

## Risks / mitigations

- *Global difficulty shift.* Mitigated: hero share, mastery, awakening, synergy and in-battle
  battle-star upgrades are untouched and still stack, so a leveled account barely notices the
  base cut; the change mostly reshapes early-game and the star-collection payoff.
- *Call-site drift from the new `rarity` param.* Mitigated: param is optional (`"Common"`
  default) so no call site breaks at compile time; all real call sites are updated explicitly.
