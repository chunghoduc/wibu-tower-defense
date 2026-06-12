# Tankier Bosses Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every boss meaningfully tankier across all difficulty tiers by raising the single `bossHpMult` lever the engine already routes boss bulk through.

**Architecture:** `battleWaves.spawnEnemy()` already multiplies a boss's HP by `DIFFICULTY_SCALING[tier].bossHpMult`. On Normal that value is `1.0` (a no-op). Raising the three `bossHpMult` values — with the biggest relative lift on Normal — makes all 20 bosses tankier with one data edit, no new code path, and preserves the monotonic difficulty law. A pure-data unit test locks the new values and the ordering in.

**Tech Stack:** TypeScript, Vitest. Pure data change in `src/data/schema.ts`.

---

### Task 1: Lock the new boss-tankiness values with a test

**Files:**

- Test: `tests/bossTankiness.test.ts` (create)
- Source: `src/data/schema.ts` (read for import)

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { DIFFICULTIES, DIFFICULTY_SCALING } from "../src/data/schema.ts";

describe("boss tankiness", () => {
  it("bossHpMult is strictly increasing across tiers", () => {
    const mults = DIFFICULTIES.map((d) => DIFFICULTY_SCALING[d].bossHpMult);
    for (let i = 1; i < mults.length; i++) {
      expect(mults[i]).toBeGreaterThan(mults[i - 1]);
    }
  });

  it("Normal bossHpMult is no longer a no-op (bosses are tankier than equal-base trash)", () => {
    // Was 1.0 — the lever did nothing on the tier most players live in.
    expect(DIFFICULTY_SCALING.Normal.bossHpMult).toBeGreaterThanOrEqual(1.5);
  });

  it("effective boss HP factor (hpMult x bossHpMult) is strictly increasing — monotonic law holds at boss level", () => {
    const factor = (d: (typeof DIFFICULTIES)[number]) =>
      DIFFICULTY_SCALING[d].hpMult * DIFFICULTY_SCALING[d].bossHpMult;
    const factors = DIFFICULTIES.map(factor);
    for (let i = 1; i < factors.length; i++) {
      expect(factors[i]).toBeGreaterThan(factors[i - 1]);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/bossTankiness.test.ts`
Expected: the "no-op" test FAILS — `DIFFICULTY_SCALING.Normal.bossHpMult` is `1`, not `>= 1.5`. (The other two pass against current data.)

- [ ] **Step 3: Raise the `bossHpMult` values**

In `src/data/schema.ts`, in the `DIFFICULTY_SCALING` object, change the three `bossHpMult` values:

```ts
  Normal: { hpMult: 1.55, atkMult: 1.25, bountyMult: 1, bossHpMult: 1.6, bossAtkMult: 1 },
  Hard: { hpMult: 7.8, atkMult: 2.5, bountyMult: 3, bossHpMult: 2.0, bossAtkMult: 1.3 },
  Nightmare: { hpMult: 14.8, atkMult: 3.3, bountyMult: 5, bossHpMult: 2.4, bossAtkMult: 1.5 },
```

(Leave `bossAtkMult` and every other field untouched — this is a bulk-only change.)

- [ ] **Step 4: Update the doc-comment combat-power example so it stays accurate**

In the block comment above `DIFFICULTY_SCALING`, replace the BOSSES paragraph so the numbers match the new values:

```ts
 * BOSSES get a further multiplier (bossHpMult/bossAtkMult) on top, so a Normal
 * boss is ~2.48× HP over equal-base trash, a Hard boss ~15.6× HP / 3.25× ATK and
 * a Nightmare boss ~35.5× HP / 4.95× ATK over its Normal-tier self — the marquee
 * threat scales harder than the trash, and now reads as a real wall even on Normal.
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/bossTankiness.test.ts`
Expected: all 3 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add tests/bossTankiness.test.ts src/data/schema.ts
git commit -m "balance(bosses): raise bossHpMult so bosses read as a real wall (esp. Normal)"
```

---

### Task 2: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Full test suite**

Run: `npm test`
Expected: all tests green (the prior suite plus the 3 new boss-tankiness tests).

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Spot-check the math**

Confirm by hand: Normal boss factor = 1.55 × 1.6 = 2.48; Hard = 7.8 × 2.0 = 15.6; Nightmare = 14.8 × 2.4 = 35.52 — strictly increasing, ordering preserved.
