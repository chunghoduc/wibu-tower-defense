# Difficulty Rebalance — Tougher Enemies, Less-Immortal Bosses

**Date:** 2026-06-15
**Status:** Approved (full-auto session)
**Author:** Claude (autonomous)

## Problem

Player feedback: *"the difficulty of the game is weird now — it's too easy to kill
the enemies, and the player only loses by some too-immortal bosses."*

This is **binary difficulty**: regular enemies are trivial to kill, so the only
loss condition is a handful of boss HP-sponges reaching the castle. The fight
in between carries no tension.

### Root cause (from a full system audit)

The combat-difficulty knobs (file → constant → current value):

- `src/data/schema.ts` → `DIFFICULTY_SCALING` — per-tier floor multipliers.
  - Normal: `hpMult 1.55`, `atkMult 1.25`, `bossHpMult 1.6`, `bossAtkMult 1`.
- `src/core/progressionScaling.ts` → `PROG_HP_PER_STAGE 0.08`, `PROG_HP_PER_CHAPTER 0.30`
  (cross-stage geometric curve, reaches ~×35 HP by stage 30). Applies to bosses too.
- `src/core/waveScaling.ts` → `WAVE_HP_RAMP 1.6` (intra-stage ramp; **boss-exempt**).
- `src/core/elite.ts` → `ELITE_BATTLE_CHANCE 0.25`, `ELITE_MULT.maxHp 5`.
- Boss base HP authored in `src/data/enemies.ts` + `src/data/enemiesAntiheroes.ts`
  (700 champion … 4200 ashghost), ranked in `stage.ts` `BOSS_HP_RANK`.

Effective enemy HP `= base × hpMult × bossHpMult? × prog.hpMult × ramp × …`.

Two structural facts produce the binary feel:

1. **The non-boss floor is low.** A Normal enemy is only `×1.55` over base. The
   player's damage (hero gear + passives + ★-star curve + 60% hero-share to
   towers) compounds faster than the early/mid enemy HP floor, so trash melts.
   The late-game progression slope (×35 at stage 30) is *fine* — the triviality
   is an early-to-mid-game **floor** problem, not a slope problem.

2. **Bosses pile two walls on top of each other.** `bossHpMult 1.6` *and* high
   authored base HP (up to 4200). Effective Normal boss HP factor is
   `1.55 × 1.6 = 2.48` over equal-base trash — and the apex bosses' base HP is
   so large they become un-killable in the time they take to cross the map.

The trash floor and the boss multiplier share the same `hpMult`, so naïvely
"making enemies tougher" by raising `hpMult` would make bosses **more** immortal —
the opposite of what's asked. The fix must move the two independently.

## Goals

- Regular + elite enemies are **meaningfully tankier and more threatening** — a
  weak defence leaks and the castle takes real damage. Combat has tension from
  wave one, not just at the boss.
- The **apex bosses stop being HP-sponge walls** — still the marquee threat, but
  killable with a competent defence rather than an automatic loss.
- Preserve the **difficulty monotonic law**: difficulty rises wave < stage <
  chapter, and tier Normal < Hard < Nightmare, at both trash and boss level.
- No new systems, no save migration, no art. Pure constant + small data tuning.

## Non-Goals

- Not touching the progression slope (`PROG_*`) or the wave ramp
  (`WAVE_*`) — they already enforce the long-game curve and are test-locked.
- Not nerfing player/tower power (towers, stars, hero share, BASE_POWER_SCALE).
- Not re-authoring per-archetype base stats — archetype identity (squishy runner
  vs armoured brute) is preserved; the global tier floor does the lifting.
- Not changing the economy (`BOUNTY_SCALE`, `bountyMult`). Tankier enemies
  already slow gold income slightly, which is acceptable/intended.

## Design

### 1. Lift the non-boss floor (enemies tougher)

`DIFFICULTY_SCALING`, per tier — raise `hpMult` and `atkMult`:

| Tier      | hpMult 1.55→ | atkMult →     |
| --------- | ------------ | ------------- |
| Normal    | **2.1**      | **1.5**       |
| Hard      | 7.8 → **8.8**| 2.5 → **2.8** |
| Nightmare | 14.8 → **16.5** | 3.3 → **3.6** |

Normal is lifted most (the tier most players live in): trash HP **+35%**, contact/
leak damage **+20%**. Stage-1 grunt goes 64→134 effective HP, atk 8→12 — a few
hits to kill, not one; a leak now chunks the castle. Higher tiers get a smaller
proportional bump (they are already very hard).

### 2. De-wall bosses (less immortal)

**a. Cut the boss multiplier** so the trash-floor lift above does not inflate
bosses — and pushes the apex down:

| Tier      | bossHpMult → |
| --------- | ------------ |
| Normal    | 1.6 → **1.1**  |
| Hard      | 2.0 → **1.5**  |
| Nightmare | 2.4 → **1.85** |

Effective Normal boss HP factor: `2.1 × 1.1 = 2.31` (was `2.48`) → bosses
**−7%** on the difficulty axis even as trash goes **+35%**. The gap between trash
and boss closes from *both* sides. `bossAtkMult` unchanged (boss damage was not
the complaint).

**b. Trim the apex base-HP sponges** — the specific "too immortal" bosses — in
`enemiesAntiheroes.ts`, preserving `BOSS_HP_RANK` ascending order:

| Boss        | base HP →       |
| ----------- | --------------- |
| fallenward  | 3100 → **2850** |
| meruon      | 3800 → **3200** |
| ashghost    | 4200 → **3500** |

Order after trim: madarok 2700 < fallenward 2850 < meruon 3200 < ashghost 3500 —
still the top three, still ascending, no rank reshuffle. Combined with (a) the
apex bosses get **−15 % to −24 %** total HP; mid/low bosses keep their feel.

### 3. More tanky variety

`ELITE_BATTLE_CHANCE 0.25 → 0.35` — roughly one battle in three now fields a
beefy elite (×5 HP, ×2.6 atk, +50 % damage-reduction). Adds a recurring
mini-wall threat without changing the elite's own tuning.

## Affected files

- `src/data/schema.ts` — `DIFFICULTY_SCALING` (hpMult / atkMult / bossHpMult ×3 tiers)
  and its doc comment.
- `src/data/enemiesAntiheroes.ts` — fallenward / meruon / ashghost `maxHp`.
- `src/data/stage.ts` — `BOSS_HP_RANK` doc-comment HP annotations (doc only).
- `src/core/elite.ts` — `ELITE_BATTLE_CHANCE`.
- `tests/bossTankiness.test.ts` — re-encode intent (see below).

## Testing

TDD. New/updated assertions against the constants (the design *is* the numbers):

1. **`tests/difficultyRebalance.test.ts` (new)** — locks the rebalance intent:
   - Non-boss floor lifted: `DIFFICULTY_SCALING.Normal.hpMult ≥ 2.0` and
     `> 1.55` (the old value); `atkMult ≥ 1.45`.
   - Boss gap closed: effective Normal boss factor
     `hpMult × bossHpMult ≤ 2.48` (no higher than the *old* boss wall) **and**
     non-boss factor `hpMult` strictly greater than old → trash rose while boss
     did not.
   - Apex base HP trimmed: ashghost/meruon/fallenward `maxHp` ≤ the new caps and
     `< ` their old values; `BOSS_HP_RANK` order still ascending by actual base HP.
   - `ELITE_BATTLE_CHANCE ≥ 0.30`.

2. **`tests/bossTankiness.test.ts` (update)** — the old test asserted Normal
   `bossHpMult ≥ 1.5` (encoding "the boss multiplier is the wall"). The design
   now shifts the wall onto base HP + mechanics, so that floor is lowered to
   `≥ 1.05` with a comment explaining the shift. The strictly-increasing-across-
   tiers tests (raw `bossHpMult` and effective `hpMult × bossHpMult`) stay and
   still pass.

3. **Regression** — `tests/progressionScaling.test.ts`, `tests/waveScaling.test.ts`
   must stay green (those knobs are untouched). Full suite + `tsc` + build.

4. **Live sanity** — CDP self-playtest (`window.__game`): start an early Normal
   stage, confirm trash takes multiple hits and a leak damages the castle; spawn
   /reach a boss, confirm it dies to a competent defence rather than walling.

## Risks & mitigations

- **Over-correction (now too hard).** Bumps are moderate (+35 % trash HP, not
  ×2) and Normal-focused; live playtest gates it. Knobs are single-line reversible.
- **`BOSS_HP_RANK` drift.** Only the top-3 trimmed, order asserted by a test that
  reads actual `maxHp`, so a future drift fails CI.
- **Concurrent session** also committing to `main` — re-check `git log` before
  committing; these files don't overlap the in-flight achievement-icon work.
