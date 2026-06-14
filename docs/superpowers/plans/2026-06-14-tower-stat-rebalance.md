# Tower Stat Rebalance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lower every tower's intrinsic base atk/maxHp to 70% and move that power into the collection-star progression, which now grants a rarity-scaled **flat** atk/hp bonus **plus** a bigger **percentage** per star — so towers are weak at ★1 but clearly worth ascending.

**Architecture:** Two edits in the pure stat layer (`data/towerStats.ts` baseline; `core/stats.ts` star scaling) plus call-site/display wiring. No engine/sim/data-file changes — the role×rarity baseline owns every tower's core budget, so one table edit rebalances the whole roster.

**Tech Stack:** TypeScript, Vitest, ESLint (max-lines 500), Vite.

---

### Task 1: Lower the tower base power budget

**Files:**
- Modify: `src/data/towerStats.ts` (`towerBaseline`, ~line 69-87)
- Test: `tests/tower-stats-baseline.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `tests/tower-stats-baseline.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { towerBaseline } from "../src/data/towerStats.ts";

describe("towerBaseline — lowered base power (BASE_POWER_SCALE 0.7)", () => {
  it("damage/Common: atk & maxHp cut to 70%, cost & attackSpeed unchanged", () => {
    const { core, cost } = towerBaseline("damage", "Common");
    expect(core.atk).toBe(11); // round(16 * 1.0 * 0.7)
    expect(core.maxHp).toBe(91); // round(130 * 1.0 * 0.7)
    expect(core.attackSpeed).toBeCloseTo(1.2, 5); // unchanged (1.2 * (1 + 0))
    expect(cost).toBe(45); // round5(45 * 1.0) — unchanged
  });

  it("damage/Unique: scales with rarity power, still 70%", () => {
    const { core, cost } = towerBaseline("damage", "Unique");
    expect(core.atk).toBe(37); // round(16 * 3.3 * 0.7)
    expect(core.maxHp).toBe(196); // round(130 * 2.15 * 0.7)
    expect(cost).toBe(150); // round5(45 * 3.3) — unchanged
  });

  it("support keeps manaOnHit 0 and tanker stays the tankiest", () => {
    expect(towerBaseline("support", "Common").core.manaOnHit).toBe(0);
    const tanker = towerBaseline("tanker", "Common").core.maxHp ?? 0;
    const dmg = towerBaseline("damage", "Common").core.maxHp ?? 0;
    expect(tanker).toBeGreaterThan(dmg);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/tower-stats-baseline.test.ts`
Expected: FAIL — `core.atk` is 16 (not 11), `core.maxHp` is 130 (not 91).

- [ ] **Step 3: Implement the lowered baseline**

In `src/data/towerStats.ts`, add the constant just above `towerBaseline` (after `RARITY_POWER`):

```ts
/**
 * Towers SHARE 60% of the commanding hero's resolved stats, so as the hero grows
 * the share dominates and a tower's intrinsic numbers matter most early. We cut
 * the raw power stats (atk/maxHp) to 70% and push that budget into the collection-
 * star scaling (see core/stats.ts) — a fresh ★1 tower is weak, an ascended one is
 * strong. Cost and cadence are deliberately untouched.
 */
const BASE_POWER_SCALE = 0.7;
```

Then in `towerBaseline`, change the `atk` and `maxHp` lines inside `core`:

```ts
  const core: Partial<Stats> = {
    atk: Math.round(b.atk * p * BASE_POWER_SCALE),
    attackSpeed: r2(b.aspd * (1 + 0.04 * tier)),
    maxHp: Math.round(b.hp * (0.5 + 0.5 * p) * BASE_POWER_SCALE),
    // Mana is a fixed 0..100 bar (see MANA_MAX). Supports are aura-only and never
    // cast, so they gain no on-hit mana; everyone else fills faster by tier (capped
    // at the +15 on-hit ceiling): Common 7 → Unique 15.
    manaOnHit: isSupport ? 0 : Math.min(15, 7 + 2 * tier),
  };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/tower-stats-baseline.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/data/towerStats.ts tests/tower-stats-baseline.test.ts
git commit -m "balance(towers): lower base atk/maxHp to 70% (BASE_POWER_SCALE)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Star-up = flat + percentage (core/stats.ts)

**Files:**
- Modify: `src/core/stats.ts` (`STAR_STEP` ~line 209; `towerStatPipeline` ~line 229-261; add helpers)
- Test: `tests/stats.test.ts` (replace the `towerStatPipeline` star block, ~line 221-236)

- [ ] **Step 1: Write the failing tests**

In `tests/stats.test.ts`, the import list at the top already pulls from `../src/core/stats.ts`.
Add `starFlat`, `starUpStepFlat`, `starIncreasedPct` to that import (alongside `towerStatPipeline`).
Then REPLACE the existing `describe("towerStatPipeline", ...)` block (lines ~221-236) with:

```ts
describe("towerStatPipeline — star-up: flat + percentage", () => {
  it("percentage grows per tier (new STAR_STEP): atk=100 Common", () => {
    const base = makeStats({ atk: 100 });
    // Common flat/step atk = 4; cumulative % = ★2 .10, ★3 .25, ★5 .70
    expect(towerStatPipeline(base, 1, 1, undefined, 0, "Common").atk).toBeCloseTo(100, 5);
    expect(towerStatPipeline(base, 1, 2, undefined, 0, "Common").atk).toBeCloseTo(114.4, 5); // (100+4)*1.10
    expect(towerStatPipeline(base, 1, 3, undefined, 0, "Common").atk).toBeCloseTo(135, 5); //   (100+8)*1.25
    expect(towerStatPipeline(base, 1, 5, undefined, 0, "Common").atk).toBeCloseTo(197.2, 5); // (100+16)*1.70
  });

  it("rarity scales the flat: Unique flat/step atk = 12", () => {
    const base = makeStats({ atk: 100 });
    expect(towerStatPipeline(base, 1, 3, undefined, 0, "Unique").atk).toBeCloseTo(155, 5); // (100+24)*1.25
  });

  it("flat lands on maxHp too, but NOT on other stats (percentage-only there)", () => {
    const base = makeStats({ maxHp: 100, armor: 10 });
    const t = towerStatPipeline(base, 1, 3, undefined, 0, "Common");
    expect(t.maxHp).toBeCloseTo(170, 5); // (100 + 2*18) * 1.25
    expect(t.armor).toBeCloseTo(12.5, 5); // 10 * 1.25 — percentage only, no flat
  });

  it("defaults to Common rarity and stars<=1 add nothing", () => {
    const base = makeStats({ atk: 100 });
    expect(towerStatPipeline(base, 1, 1).atk).toBeCloseTo(100, 5); // ★1, no rarity arg
  });

  it("tower level 20 scaling unchanged (stars 0): atk=100 → 128.5", () => {
    const base = makeStats({ atk: 100 });
    expect(towerStatPipeline(base, 20, 0).atk).toBeCloseTo(128.5, 5);
  });

  it("starIncreasedPct cumulative: ★3 = .25, ★5 = .70", () => {
    expect(starIncreasedPct(3)).toBeCloseTo(0.25, 5);
    expect(starIncreasedPct(5)).toBeCloseTo(0.7, 5);
  });

  it("starFlat: zero at ★1, rarity-scaled, capped at ★5, never mutates", () => {
    expect(starFlat(1, "Common")).toEqual({ atk: 0, hp: 0 });
    expect(starFlat(5, "Common")).toEqual({ atk: 16, hp: 72 }); // 4*4, 4*18
    expect(starFlat(5, "Unique")).toEqual({ atk: 48, hp: 232 }); // 4*12, 4*58
    expect(starFlat(99, "Common")).toEqual(starFlat(5, "Common")); // capped
  });

  it("starUpStepFlat: the flat the NEXT star adds (0 at max)", () => {
    expect(starUpStepFlat(1, "Common")).toEqual({ atk: 4, hp: 18 });
    expect(starUpStepFlat(5, "Common")).toEqual({ atk: 0, hp: 0 }); // already max
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/stats.test.ts`
Expected: FAIL — `starFlat`/`starUpStepFlat` are not exported; `towerStatPipeline` ignores the 6th arg.

- [ ] **Step 3: Implement the star flat + new percentage**

In `src/core/stats.ts`:

(a) Add `Rarity` to the type import from schema:

```ts
import {
  defaultStats,
  FRACTIONAL_STAT_KEYS,
  type PassiveNodeDef,
  type Rarity,
  type Stats,
  type TowerRole,
} from "../data/schema.ts";
```

(b) Replace the `STAR_STEP` constant and its doc comment (lines ~205-209) with:

```ts
// Star ascension scaling. Each collection star grants BOTH a flat atk/maxHp bump
// AND an increased% to all stats — and each star gives more than the last, so the
// higher a tower's star, the bigger the jump. The base was lowered (towerStats.ts
// BASE_POWER_SCALE) and that budget moved here: a ★1 tower is weak, an ascended one
// is strong. STAR_STEP[s] = the increased% added by REACHING star s.
// Cumulative: ★1 0% · ★2 10% · ★3 25% · ★4 45% · ★5 70%.
const STAR_STEP = [0, 0, 0.1, 0.15, 0.2, 0.25];
const STAR_MAX = STAR_STEP.length - 1; // 5

// Flat atk/maxHp granted PER STAR reached, scaled by rarity tier (Common 0 …
// Unique 4). Absolute (not a fraction of base) so it stays a meaningful jump even
// though the base was cut, and so it reads big early when the hero share is small.
const STAR_FLAT_ATK_BASE = 4;
const STAR_FLAT_ATK_TIER = 2; // per-step atk: Common 4 … Unique 12
const STAR_FLAT_HP_BASE = 18;
const STAR_FLAT_HP_TIER = 10; // per-step hp: Common 18 … Unique 58

const STAR_RARITY_TIER: Record<Rarity, number> = {
  Common: 0,
  Magic: 1,
  Rare: 2,
  Legendary: 3,
  Unique: 4,
};
```

(c) Keep `starIncreasedPct` and `starUpStepPct` as-is (they already read `STAR_STEP`).
Add, right after `starUpStepPct` (~line 221):

```ts
/** Total flat atk/maxHp a tower has accrued at the given star tier (rarity-scaled). */
export function starFlat(stars: number, rarity: Rarity): { atk: number; hp: number } {
  const steps = Math.max(0, Math.min(stars, STAR_MAX) - 1);
  const tier = STAR_RARITY_TIER[rarity];
  return {
    atk: steps * (STAR_FLAT_ATK_BASE + STAR_FLAT_ATK_TIER * tier),
    hp: steps * (STAR_FLAT_HP_BASE + STAR_FLAT_HP_TIER * tier),
  };
}

/** The flat atk/maxHp the NEXT star-up will add ({0,0} if already maxed). */
export function starUpStepFlat(stars: number, rarity: Rarity): { atk: number; hp: number } {
  if (stars >= STAR_MAX) return { atk: 0, hp: 0 };
  const cur = starFlat(stars, rarity);
  const next = starFlat(stars + 1, rarity);
  return { atk: next.atk - cur.atk, hp: next.hp - cur.hp };
}
```

(d) Update `towerStatPipeline`'s signature and the star layer. Replace the function
header and Layer 2 (lines ~229-253) with:

```ts
export function towerStatPipeline(
  base: Stats,
  towerLevel: number,
  stars: number,
  role?: TowerRole,
  battleLevel = 0,
  rarity: Rarity = "Common",
): Stats {
  let acc = makeAcc();

  // Layer 1 — level scaling (flat)
  const levelFlat: Partial<Stats> = {};
  for (const [k, v] of Object.entries(TOWER_LEVEL_FLAT_PER_LEVEL) as [keyof Stats, number][]) {
    levelFlat[k] = v * (towerLevel - 1);
  }
  acc = addFlat(acc, levelFlat);

  // Layer 2 — star bonus: a rarity-scaled FLAT (atk/maxHp) plus an increased% to
  // all stats, each growing per star (see STAR_STEP / starFlat).
  const sf = starFlat(stars, rarity);
  if (sf.atk || sf.hp) acc = addFlat(acc, { atk: sf.atk, maxHp: sf.hp });
  const starPct = starIncreasedPct(stars);
  if (starPct > 0) {
    const starInc: Partial<Stats> = {};
    for (const k of Object.keys(base) as (keyof Stats)[]) {
      starInc[k] = starPct;
    }
    acc = addIncreased(acc, starInc);
  }
```

(Leave Layer 3 — the `role && battleLevel` block — and the trailing `resolveAcc` unchanged.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/stats.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/stats.ts tests/stats.test.ts
git commit -m "balance(towers): star-up grants flat atk/hp + bigger % per star

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Wire the rarity param at call sites + show flat in the panel

**Files:**
- Modify: `src/core/battlePlacement.ts` (4 `towerStatPipeline` calls: lines ~103, 161, 179, 201)
- Modify: `src/scenes/squadInfoPanel.ts` (call ~line 119; "Next ★" line ~199-205)

- [ ] **Step 1: Pass rarity in battlePlacement**

In `src/core/battlePlacement.ts`, append the rarity argument to each call:

- `spawnTower` (~line 103):
```ts
      towerStatPipeline(def.baseStats, towerLevel, towerStars, def.role, 0, def.rarity),
```
- `previewUpgradeRange` (~line 161):
```ts
      towerStatPipeline(t.def.baseStats, t.baseLevel, t.stars, t.def.role, t.battleLevel + 1, t.def.rarity),
```
- `previewPlaceRange` (~line 179):
```ts
    return towerStatPipeline(def.baseStats, towerLevel, towerStars, def.role, 0, def.rarity).range;
```
- `upgradeTower` (~line 201):
```ts
      towerStatPipeline(t.def.baseStats, t.baseLevel, t.stars, t.def.role, t.battleLevel, t.def.rarity),
```

- [ ] **Step 2: Pass rarity + show the flat in squadInfoPanel**

In `src/scenes/squadInfoPanel.ts`:

(a) Extend the import (line 13) to add `starUpStepFlat`:
```ts
import { towerStatPipeline, starUpStepPct, starUpStepFlat } from "../core/stats.ts";
```

(b) The current-star preview call (~line 119) — pass rarity:
```ts
  const cur = towerStatPipeline(def.baseStats, 1, stars, def.role, 0, def.rarity);
```

(c) `renderAscension` builds the "Next ★ →" line (~199-205). It already has `rarity`,
`stars` in scope. Replace that `add(...)` line with one that shows flat + %:
```ts
  const stepPct = Math.round(starUpStepPct(stars) * 100);
  const stepFlat = starUpStepFlat(stars, rarity);
  add(
    c,
    crispText(
      scene,
      x,
      sy,
      `Next ★ → +${stepPct}% all · +${stepFlat.atk} atk · +${stepFlat.hp} hp`,
      { fontSize: "9px", color: "#ffd86a" },
    ),
  );
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/core/battlePlacement.ts src/scenes/squadInfoPanel.ts
git commit -m "balance(towers): thread rarity into tower stat pipeline + panel shows star flat

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Full test suite**

Run: `npx vitest run`
Expected: all tests pass (the synthetic-tower battle/mechanics tests assert relative
scaling and are unaffected; `stats` + `tower-stats-baseline` reflect the new numbers).
If any test encoded an old absolute base-stat value, update it to the new value (×0.7)
and note it in the commit.

- [ ] **Step 2: Lint (incl. max-lines 500)**

Run: `npx eslint src/data/towerStats.ts src/core/stats.ts src/core/battlePlacement.ts src/scenes/squadInfoPanel.ts`
Expected: clean. (`stats.ts` gains ~25 lines — confirm it stays under 500.)

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: succeeds (pre-existing chunk-size warning only).

- [ ] **Step 4: Commit any incidental test fixes**

```bash
git add -A
git commit -m "test(towers): align stats with rebalanced base + star scaling

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```
(Skip if Step 1 needed no changes.)

---

## Self-Review

**1. Spec coverage:**
- "Lower base stats" → Task 1 (`BASE_POWER_SCALE` 0.7 on atk/maxHp; cost/cadence untouched). ✅
- "Star-up = flat + percentage, both grow per star" → Task 2 (`starFlat` rarity-scaled flat + new `STAR_STEP`). ✅
- "Rarity-scaled flat, absolute" → Task 2 `STAR_FLAT_*` + `STAR_RARITY_TIER`. ✅
- "Thread rarity through pipeline + call sites" → Task 3. ✅
- "Panel shows the new flat" → Task 3 Step 2c. ✅
- "No ASSET_VERSION bump (code-only)" → not touched. ✅
- "Verify tsc/eslint/suite/build" → Task 3 Step 3 + Task 4. ✅

**2. Placeholder scan:** No TBD/TODO; every code step shows full code. ✅

**3. Type consistency:** `starFlat(stars, rarity)` / `starUpStepFlat(stars, rarity)` return `{atk,hp}` — used consistently in Task 2 tests and Task 3 panel. `towerStatPipeline` 6th param `rarity: Rarity = "Common"` — every Task 3 call passes a `Rarity` (`def.rarity` / `t.def.rarity`). `STAR_MAX = 5`. ✅
