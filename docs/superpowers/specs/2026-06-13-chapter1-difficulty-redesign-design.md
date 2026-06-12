# Chapter 1 Difficulty Redesign — Design Spec

**Date:** 2026-06-13
**Request:** "redesign chapter 1 stages to make the game more difficult"
**Scope:** `src/data/chapter1Waves.ts` (plans + generator) and its tests. Nothing else.

## Goal

Chapter 1 (stages 1–10) is the hand-tuned teaching chapter, but its back half clears too
comfortably. Redesign the authored waves so difficulty comes from **earlier mechanics, denser
composition, and spawn overlap** — not from touching the engine scaling layers.

## Non-goals / invariants

- `waveScaling.ts`, `progressionScaling.ts`, difficulty-tier multipliers, economy (`drops.ts`,
  startingGold), wave cadence constants (`WAVE_INTERVAL` 30s, skip bonus): all untouched.
- Structural invariants pinned by tests stay: exactly 10 waves/stage, bosses only on W5/W10,
  W1 pure rushers, 15-HP castle.
- **Monotonic law:** wave < stage < chapter. A harder ch1 stage 10 must still be below
  procedural stage 11 in trash threat (stage 11 also carries ×1.3 chapter HP wall + the
  Escalation Five debut).
- Stage 1 stays new-player fair: W1–W3 of stage 1 near-current (170g start).
- Ch2–5 procedural `buildWaves` untouched.

## Changes

### 1. CH1_PLANS rework (composition curve)

`Ch1Plan` gains `support2: string | null` (second aura-carrier for the chapter's final exam).

| Stage | feature     | wall     | wall2    | support  | support2 |
| ----- | ----------- | -------- | -------- | -------- | -------- |
| 1     | grunt       | –        | –        | –        | –        |
| 2     | gargoyle    | –        | –        | –        | –        |
| 3     | bulwark     | –        | –        | herald   | –        |
| 4     | slime       | –        | –        | mender   | –        |
| 5     | regenerator | golem    | –        | herald   | –        |
| 6     | sapper      | monolith | –        | mender   | –        |
| 7     | phantom     | monolith | –        | summoner | –        |
| 8     | stormflyer  | golem    | –        | hexer    | –        |
| 9     | regenerator | golem    | monolith | hexer    | summoner |
| 10    | phantom     | golem    | monolith | summoner | hexer    |

Rationale: walls are permanent from S5 on (was: only S5/S7/S9/S10), so every late stage forces a
second damage type; supports run S3→S10 unbroken; S9/S10 stack two supports so the gauntlet
punishes boards with no priority-kill answer.

### 2. Cadence knob (overlap pressure)

`cadence(n) = max(0.55, 1 − 0.05 × (n − 1))` multiplies every spawn interval (not delays).
Stage 1 ×1.0 (unchanged feel), stage 10 ×0.55 — waves flood ~45% faster into the same 30s
wave window, so later stages overlap spawns instead of trickling.

### 3. Density steepening

- W1: `4 + ⌊d/2⌋` → `4 + ⌈0.7d⌉` (stage 1: 5, stage 10: 11 — still trivial trash).
- W2: feature `2 + ⌊d/2⌋` → `2 + ⌈0.7d⌉`.
- W3: brute `1+⌊d/3⌋` → `1+⌊d/2⌋`; bulwark `1+⌊d/4⌋` → `1+⌊d/3⌋`.
- W4: runner `6+d` → `8+d`; gargoyle `2+⌊d/3⌋` → `2+⌊d/2⌋`; add `slime 1+⌊d/4⌋` from d≥4.
- W5 (mid-boss): escort gains the featured archetype `2+⌊d/3⌋`; brute `1+⌊d/4⌋` → `1+⌊d/3⌋`.
- W6: wall count 1 → 2 on d≥9; grunt `6+d` → `7+d`.
- W7: raider `1+⌊d/3⌋` → `1+⌊d/2⌋`; runner `8+d` → `9+d`; add `sapper 1+⌊d/3⌋` from d≥6.
- W8: stormflyer `1+⌊d/3⌋` → `1+⌊d/2⌋`; gargoyle `3+⌊d/2⌋` → `3+⌈0.7d⌉`.
- W9 (gauntlet): brute `3+⌊d/2⌋` → `4+⌈0.7d⌉`; regenerator `2+⌊d/3⌋` → `2+⌊d/2⌋`;
  bulwark `2+⌊d/4⌋` → `2+⌊d/3⌋`; feature `3+⌊d/2⌋` → `3+⌈0.7d⌉`; + support2 if set.
- W10 (finale): escort gains `regenerator 1+⌊d/3⌋` and `bulwark 1+⌊d/4⌋`; wall2 joins on
  S9–10; support joins from S7; brute `2+⌊d/4⌋` → `2+⌊d/3⌋`.

### 4. Guard test (monotonic law)

New pure threat estimator inside the test file:
`threat(wave, stageN) = Σ count × baseHp(enemy) × waveScaling.hpMult × progressionScaling.hpMult`,
bosses excluded. Asserts:

- Per-stage total trash threat strictly increases S1 → S10.
- S10's W9 threat < procedural stage 11's W9 threat (chapter ordering preserved).
- Existing assertions stay green (W9 ≥ 3× W1, dual walls on S9/S10, etc.).

### 5. Verification

Full gauntlet (tests, typecheck, lint, cycles, format) + CDP playtest of stage 1 (must remain
clearable) and a late stage (must feel pressured) at Normal.

## Risks

- Stage 9–10 might tip past stage 11 → guard test catches it; tune divisors down if red.
- Stage 1 over-hardened → only the ceil change touches it (+1 grunt on W1/W2); playtest confirms.
