# Nerf Enemy Coin Gain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut in-battle gold income from enemy kills so players can no longer afford to buy and fully upgrade every tower.

**Architecture:** Three constant changes in `src/core/battleTypes.ts` (a new `BOUNTY_SCALE`, lower `COMBO_MAX_MULT`, lower `PERFECT_WAVE_BONUS_FRAC`), with `BOUNTY_SCALE` applied once to the per-kill reward in `BattleState.killEnemy`. `comboMult()` and the perfect-wave bonus already derive from their constants, so no logic rewrite — only the multiplier wiring in `killEnemy`.

**Tech Stack:** TypeScript, Vitest. Run tests with `npx vitest run`.

---

### Task 1: Lower the combo cap and perfect-wave bonus constants

**Files:**
- Modify: `src/core/battleTypes.ts:165-170`
- Test: `tests/combo-perfect.test.ts`

- [ ] **Step 1: Read the existing combo/perfect test to see what it asserts**

Run: `npx vitest run tests/combo-perfect.test.ts -v`
Expected: PASS (baseline before any change). Note which assertions use the literal `3` (combo max) and `0.25` (perfect fraction) vs. the exported constants.

- [ ] **Step 2: Update the test to assert against the NEW constant values**

In `tests/combo-perfect.test.ts`, ensure the combo-max assertion expects `COMBO_MAX_MULT` to be `2` and any perfect-wave assertion expects `PERFECT_WAVE_BONUS_FRAC` to be `0.15`. Import the constants from `../src/core/battleTypes` and assert against them rather than hard-coded magic numbers where the test allows. Concretely add/adjust:

```ts
import { COMBO_MAX_MULT, PERFECT_WAVE_BONUS_FRAC } from "../src/core/battleTypes";

it("combo multiplier caps at the configured max", () => {
  expect(COMBO_MAX_MULT).toBe(2);
});

it("perfect-wave bonus fraction is the configured value", () => {
  expect(PERFECT_WAVE_BONUS_FRAC).toBe(0.15);
});
```

If the file already ramps `comboMult()` to a literal `3`, change that expected peak to `COMBO_MAX_MULT` (i.e. `2`).

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run tests/combo-perfect.test.ts -v`
Expected: FAIL — `COMBO_MAX_MULT` is still `3` and `PERFECT_WAVE_BONUS_FRAC` is still `0.25`.

- [ ] **Step 4: Change the constants**

In `src/core/battleTypes.ts`, update:

```ts
/** F13 combo: gold multiplier caps at this value (×2 at full streak). */
export const COMBO_MAX_MULT = 2;
```

and

```ts
/** F14 perfect wave: bonus gold = this fraction of the gold earned that wave. */
export const PERFECT_WAVE_BONUS_FRAC = 0.15;
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/combo-perfect.test.ts -v`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/core/battleTypes.ts tests/combo-perfect.test.ts
git commit -m "balance(economy): cap combo gold at x2, perfect-wave bonus 25%->15%

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Add and apply BOUNTY_SCALE to the per-kill reward

**Files:**
- Modify: `src/core/battleTypes.ts` (add constant near the combo constants, ~line 162)
- Modify: `src/core/battleDamage.ts:393-405` (apply scale in `killEnemy`)
- Test: `tests/battle.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `tests/battle.test.ts`, inside the `describe("BattleState outcomes", ...)` block (after the existing "awards bounty gold" test). It asserts the FIRST kill credits exactly `round(bounty × BOUNTY_SCALE)` — combo is 1 on the first kill so `comboMult()` is 1, goldFind is 0 on `inertHero`, Normal difficulty `bountyMult` is 1, elite disabled.

```ts
it("scales kill bounty by BOUNTY_SCALE", () => {
  const { stage, catalog } = world(enemy({ bounty: 100 }), turret(), oneWave(1), 50, 0);
  const b = new BattleState(stage, catalog, { hero: inertHero, eliteChance: 0 });
  const before = b.gold;
  b.placeTower("turret", 0);
  runUntilDone(b);
  expect(b.outcome).toBe("won");
  // One enemy, one kill: first kill has combo=1 (mult 1), goldFind 0, Normal bountyMult 1.
  // Net gold gained from the kill = round(100 * BOUNTY_SCALE). Starting gold and any
  // perfect-wave bonus (15% of that one reward) sit on top, so assert the kill reward
  // is present and strictly below the un-scaled bounty.
  const gained = b.gold - before;
  expect(gained).toBeGreaterThanOrEqual(Math.round(100 * BOUNTY_SCALE));
  expect(gained).toBeLessThan(100); // proves the bounty was scaled down from 100
});
```

Add `BOUNTY_SCALE` to the existing import from `../src/core/battleTypes` at the top of the test file (create the import line if none exists):

```ts
import { BOUNTY_SCALE } from "../src/core/battleTypes";
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/battle.test.ts -v`
Expected: FAIL — `BOUNTY_SCALE` is not exported (compile/import error), or gained gold is `>= 100` because the bounty is currently un-scaled.

- [ ] **Step 3: Add the BOUNTY_SCALE constant**

In `src/core/battleTypes.ts`, near the combo constants (after `SKIP_COIN_PER_SEC`, ~line 162), add:

```ts
/**
 * Global in-battle kill-bounty multiplier. A flat economy knob: lower it to make
 * the player choose which towers to build/upgrade instead of affording them all.
 * Applied once to every enemy's per-kill reward in BattleState.killEnemy.
 */
export const BOUNTY_SCALE = 0.7;
```

- [ ] **Step 4: Apply it in killEnemy**

In `src/core/battleDamage.ts`, update the `baseReward` line in `killEnemy` (~line 398-399) to multiply by `BOUNTY_SCALE`, and update the stale comment on the next line:

```ts
    const baseReward =
      e.def.bounty * BOUNTY_SCALE * scale.bountyMult * eliteBonus * (1 + this.hero.stats.goldFind);
    // F13 combo: a rapid kill-streak multiplies gold (×1 → ×2) and resets its decay.
```

Add `BOUNTY_SCALE` to the import from `./battleTypes` at the top of `battleDamage.ts`. (Find the existing `import { ... } from "./battleTypes"` line and add `BOUNTY_SCALE` to it; if `COMBO_DECAY`/`ELITE_BOUNTY_MULT` etc. are imported there, append to that same list.)

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/battle.test.ts -v`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/core/battleTypes.ts src/core/battleDamage.ts tests/battle.test.ts
git commit -m "balance(economy): scale enemy kill bounties to 70% (BOUNTY_SCALE)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Reconcile existing economy tests and full verify

**Files:**
- Possibly modify: `tests/battle.test.ts` (the existing "awards bounty gold" lower bound)
- Possibly modify: `tests/combo-perfect.test.ts` (any remaining literal expectations)

- [ ] **Step 1: Run the full test suite to find any tests broken by the new economy**

Run: `npx vitest run`
Expected: Most pass. The likely failures are economy tests with literal gold expectations that assumed the old (higher) payout — e.g. `tests/battle.test.ts` "awards bounty gold" (`>= 50`) or combo-perfect ramp math.

- [ ] **Step 2: Re-derive each broken expectation from the new constants**

For every failing assertion, recompute the expected value using `bounty × BOUNTY_SCALE × comboMult() × ...` and `PERFECT_WAVE_BONUS_FRAC = 0.15`, `COMBO_MAX_MULT = 2`. Update the literal (prefer expressing it in terms of the imported constants so it can't drift again). Example for the "awards bounty gold" lower bound: with bounty 10 and `BOUNTY_SCALE` 0.7, the minimum per-kill is `round(10 * 0.7) = 7`, so over ≥5 kills the floor becomes `5 * Math.round(10 * BOUNTY_SCALE)` — replace `>= 50` with that expression:

```ts
expect(b.gold).toBeGreaterThanOrEqual(5 * Math.round(10 * BOUNTY_SCALE));
```

(Adjust to whatever the actual failing assertions are — the principle: derive from constants, never re-hard-code a magic number.)

- [ ] **Step 3: Run the full suite again to confirm green**

Run: `npx vitest run`
Expected: PASS (all files).

- [ ] **Step 4: Typecheck + build**

Run: `npm run build`
Expected: `tsc --noEmit` clean, `vite build` succeeds (the pre-existing chunk-size >500kB warning is benign).

- [ ] **Step 5: Lint (max-lines + cycles)**

Run: `npm run lint && npm run lint:cycles`
Expected: PASS — no file crosses 500 lines (this change adds only a few lines), 0 runtime cycles.

- [ ] **Step 6: Commit any reconciliation changes**

```bash
git add tests/
git commit -m "test(economy): re-derive gold expectations from nerfed constants

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

(If Steps 1-3 found nothing to change, skip this commit.)

---

## Self-Review Notes

- **Spec coverage:** Task 1 covers `COMBO_MAX_MULT` 3→2 and `PERFECT_WAVE_BONUS_FRAC` 0.25→0.15. Task 2 covers the new `BOUNTY_SCALE = 0.7` and its application in `killEnemy`. Task 3 covers the "existing tests to reconcile" line from the spec's Testing section plus the full verify (build/lint). All three spec design points and both spec test requirements have tasks.
- **No data-file edits:** confirmed — the flat scale lives in one constant; no enemy `bounty` values change.
- **Type/name consistency:** `BOUNTY_SCALE`, `COMBO_MAX_MULT`, `PERFECT_WAVE_BONUS_FRAC` used identically across all tasks and imported from `src/core/battleTypes`.
- **No save/version/asset impact:** no persisted-state or PNG change → no save migration, no `ASSET_VERSION` bump.
