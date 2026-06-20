# Attack-Speed Rebalance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hard-cap effective attack speed at 5 atk/sec and nerf every attack-speed item source so reaching 5 is super hard.

**Architecture:** A pure `attackSpeedCap.ts` helper clamps the final effective attack speed at the three battle-sim consumption sites (towers, hero, enemies). Separately, data-only edits cut item attack-speed magnitudes (random-affix roll band, primary affix base values, item base stats, jewels). A data-driven guard test locks the nerfed thresholds.

**Tech Stack:** TypeScript, Vitest, Phaser (battle sim is Phaser-free pure modules merged onto `BattleState`).

---

### Task 1: Pure attack-speed cap helper

**Files:**
- Create: `src/core/attackSpeedCap.ts`
- Test: `src/core/attackSpeedCap.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { ATTACK_SPEED_CAP, cappedAttackSpeed } from "./attackSpeedCap.ts";

describe("attack-speed cap", () => {
  it("caps at 5 attacks per second", () => {
    expect(ATTACK_SPEED_CAP).toBe(5);
  });
  it("clamps values above the cap down to 5", () => {
    expect(cappedAttackSpeed(10)).toBe(5);
    expect(cappedAttackSpeed(5.0001)).toBe(5);
  });
  it("passes through values at or below the cap unchanged", () => {
    expect(cappedAttackSpeed(5)).toBe(5);
    expect(cappedAttackSpeed(2.3)).toBe(2.3);
    expect(cappedAttackSpeed(0)).toBe(0);
  });
  it("preserves non-positive values (the sim's <=0 guard still works)", () => {
    expect(cappedAttackSpeed(-1)).toBe(-1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/attackSpeedCap.test.ts`
Expected: FAIL — cannot find module `./attackSpeedCap.ts`.

- [ ] **Step 3: Write minimal implementation**

```ts
/**
 * Hard ceiling on effective attack speed (attacks/second). Towers and the hero
 * can otherwise stack gear/stars/auras into double-digit attack speed, which
 * trivialises combat. The cap is applied to the FINAL effective value (after
 * buffAsPct) at each battle-sim consumption site, just before `cooldown = 1/x`.
 * Pure / Phaser-free.
 */
export const ATTACK_SPEED_CAP = 5; // attacks per second → min cooldown 0.2s

/** Clamp an effective attack speed to the cap. Only reduces; never raises a
 *  value (so the sim's existing `<= 0` guards keep working). */
export function cappedAttackSpeed(raw: number): number {
  return raw > ATTACK_SPEED_CAP ? ATTACK_SPEED_CAP : raw;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/attackSpeedCap.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/attackSpeedCap.ts src/core/attackSpeedCap.test.ts
git commit -m "feat(combat): pure attack-speed cap helper (5 atk/sec)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Wire the cap into the three sim consumption sites

**Files:**
- Modify: `src/core/battleTowers.ts` (import + `updateTowers` effAs line ~67)
- Modify: `src/core/battleHero.ts` (import + `updateHero` ~line 35-36, 81)
- Modify: `src/core/battleEnemies.ts` (import + `enemyAttack` ~line 144-150)

- [ ] **Step 1: battleTowers.ts — import the helper**

Add to the imports block (near the top, after the existing `./targeting.ts` import):

```ts
import { cappedAttackSpeed } from "./attackSpeedCap.ts";
```

- [ ] **Step 2: battleTowers.ts — clamp effAs**

Replace this line in `updateTowers`:

```ts
      const effAs = t.stats.attackSpeed * (1 + t.buffAsPct);
```

with:

```ts
      const effAs = cappedAttackSpeed(t.stats.attackSpeed * (1 + t.buffAsPct));
```

- [ ] **Step 3: battleHero.ts — import the helper**

Add after the existing `./hero.ts` import:

```ts
import { cappedAttackSpeed } from "./attackSpeedCap.ts";
```

- [ ] **Step 4: battleHero.ts — clamp the hero's effective attack speed**

Replace these lines in `updateHero`:

```ts
    h.attackCd -= dt;
    if (h.attackCd > 0 || h.stats.attackSpeed <= 0) return;
```

with:

```ts
    const heroAs = cappedAttackSpeed(h.stats.attackSpeed);
    h.attackCd -= dt;
    if (h.attackCd > 0 || heroAs <= 0) return;
```

And replace the cooldown reset at the end of `updateHero`:

```ts
    h.attackCd = 1 / h.stats.attackSpeed;
```

with:

```ts
    h.attackCd = 1 / heroAs;
```

- [ ] **Step 5: battleEnemies.ts — import + clamp enemy attack speed**

Add the import near the other `./` imports at the top of `battleEnemies.ts`:

```ts
import { cappedAttackSpeed } from "./attackSpeedCap.ts";
```

Replace the body of `enemyAttack`:

```ts
  enemyAttack(this: BattleState, e: EnemyRuntime, dt: number, hit: () => void): void {
    e.attackCd -= dt;
    if (e.attackCd <= 0 && e.stats.attackSpeed > 0) {
      hit();
      e.attackCd = 1 / e.stats.attackSpeed;
    }
  },
```

with (clamp the rate; enemies never exceed 5 today, so this is a no-op but keeps the rule universal):

```ts
  enemyAttack(this: BattleState, e: EnemyRuntime, dt: number, hit: () => void): void {
    const as = cappedAttackSpeed(e.stats.attackSpeed);
    e.attackCd -= dt;
    if (e.attackCd <= 0 && as > 0) {
      hit();
      e.attackCd = 1 / as;
    }
  },
```

> Note: the exact line text for `enemyAttack` must be confirmed by reading
> `src/core/battleEnemies.ts` first (the surrounding method may differ slightly);
> the transformation is "clamp `e.stats.attackSpeed` once via `cappedAttackSpeed`
> and use that local for both the `> 0` gate and the `1 / x` reset."

- [ ] **Step 6: Typecheck + run the full suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS, no type errors (clamp is additive; no existing test asserts >5 atk/sec).

- [ ] **Step 7: Commit**

```bash
git add src/core/battleTowers.ts src/core/battleHero.ts src/core/battleEnemies.ts
git commit -m "feat(combat): clamp effective attack speed to 5 at all sim sites

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Guard test for the item nerf (RED)

**Files:**
- Create: `src/data/attackSpeedItems.test.ts`

- [ ] **Step 1: Write the failing guard test**

```ts
import { describe, it, expect } from "vitest";
import { ITEM_CATALOG } from "./items.ts";
import { JEWEL_CATALOG } from "./jewels.ts";

// The nerfed ceilings (see docs/superpowers/specs/2026-06-20-attack-speed-rebalance-design.md).
const MAX_PRIMARY_BASEVALUE = 0.06; // attackSpeed primary affix
const MAX_BASE_ATTACKSPEED_STAT = 0.12; // item base attackSpeed stat
const MAX_JEWEL_INCREASED = 0.04; // jewel increased.attackSpeed

describe("attack-speed item nerf", () => {
  it("no item's attackSpeed primary affix exceeds the nerfed base value", () => {
    const offenders = ITEM_CATALOG.filter(
      (d) => d.primaryAffix.type === "attackSpeed" && d.primaryAffix.baseValue > MAX_PRIMARY_BASEVALUE,
    ).map((d) => `${d.id}:${d.primaryAffix.baseValue}`);
    expect(offenders).toEqual([]);
  });

  it("no item's base attackSpeed stat exceeds the nerfed ceiling", () => {
    const offenders = ITEM_CATALOG.filter(
      (d) => (d.baseStats.attackSpeed ?? 0) > MAX_BASE_ATTACKSPEED_STAT,
    ).map((d) => `${d.id}:${d.baseStats.attackSpeed}`);
    expect(offenders).toEqual([]);
  });

  it("no jewel grants more than the nerfed increased attackSpeed", () => {
    const offenders = JEWEL_CATALOG.filter(
      (j) => (j.increased?.attackSpeed ?? 0) > MAX_JEWEL_INCREASED,
    ).map((j) => `${j.id}:${j.increased?.attackSpeed}`);
    expect(offenders).toEqual([]);
  });
});
```

- [ ] **Step 2: Confirm the export names**

Run: `npx vitest run src/data/attackSpeedItems.test.ts`
If it errors on `JEWEL_CATALOG` / `ITEM_CATALOG` import names, read `src/data/jewels.ts`
and `src/data/items.ts` to find the actual exported catalog array name and the jewel
def shape (the `increased` field). Adjust the import/property accordingly. Then re-run.
Expected once imports resolve: FAIL — current items/jewels still carry the un-nerfed values.

- [ ] **Step 3: Commit the failing test**

```bash
git add src/data/attackSpeedItems.test.ts
git commit -m "test(items): guard nerfed attack-speed item ceilings (red)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Apply the item nerf (GREEN)

**Files:**
- Modify: `src/data/items.ts` (`AFFIX_RANGE` ~line 22-25; Dagger of Swiftness ~line 73-74)
- Modify: `src/data/itemLines.ts` (longbow ~27-29; swift-gloves ~133-135; duelist-band ~323-325)
- Modify: `src/data/itemsExpansion.ts` (galewind-longbow ~86-88; valkyrie-pinions ~305-307)
- Modify: `src/data/jewels.ts` (attackSpeed `increased` entries)

- [ ] **Step 1: items.ts — add nerfed attackSpeed roll band**

In `AFFIX_RANGE`, add an `attackSpeed` entry (random affixes now +2–6%, was the default +5–20%):

```ts
const AFFIX_RANGE: Partial<Record<string, [number, number]>> = {
  critRate: [0.02, 0.05], // +2–5% crit chance per affix
  critDamage: [0.05, 0.15], // +5–15% crit damage per affix
  attackSpeed: [0.02, 0.06], // +2–6% atk speed per affix (nerfed from 5–20%)
};
```

- [ ] **Step 2: items.ts — nerf Dagger of Swiftness**

Change its `baseStats.attackSpeed` 0.3 → 0.12 and `primaryAffix.baseValue` 0.12 → 0.06:

```ts
    baseStats: { atk: 22, attackSpeed: 0.12 },
    primaryAffix: { type: "attackSpeed", baseValue: 0.06 },
```

- [ ] **Step 3: itemLines.ts — nerf the three attackSpeed lines**

`longbow` (~27-29):

```ts
    primary: "attackSpeed",
    primaryBase: 0.06,
    stats: { atk: 13, attackSpeed: 0.1 },
```

`swift-gloves` (~133-135):

```ts
    primary: "attackSpeed",
    primaryBase: 0.04,
    stats: { attackSpeed: 0.05 },
```

`duelist-band` (~323-325):

```ts
    primary: "attackSpeed",
    primaryBase: 0.04,
    stats: { attackSpeed: 0.04, atk: 4 },
```

- [ ] **Step 4: itemsExpansion.ts — nerf the two attackSpeed lines**

`galewind-longbow` (~86-88):

```ts
    primary: "attackSpeed",
    primaryBase: 0.06,
    stats: { atk: 13, attackSpeed: 0.1 },
```

`valkyrie-pinions` (~305-307):

```ts
    primary: "attackSpeed",
    primaryBase: 0.04,
    stats: { moveSpeed: 24, attackSpeed: 0.04 },
```

- [ ] **Step 5: jewels.ts — halve the attackSpeed grants**

Read `src/data/jewels.ts` first to confirm exact lines, then change every
`increased: { attackSpeed: 0.06 }` → `0.03` and the `attackSpeed: 0.08` entry → `0.04`
(e.g. line ~382 `{ attackSpeed: 0.08, atk: 0.06 }` → `{ attackSpeed: 0.04, atk: 0.06 }`).
Use `replace_all` for the bare `attackSpeed: 0.06` jewel occurrences, verifying each is
inside a jewel `increased` block (not an item base stat).

- [ ] **Step 6: Run the guard test — now GREEN**

Run: `npx vitest run src/data/attackSpeedItems.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add src/data/items.ts src/data/itemLines.ts src/data/itemsExpansion.ts src/data/jewels.ts
git commit -m "balance(items): nerf all attack-speed item sources

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Full verification + deploy

**Files:** none (verification only)

- [ ] **Step 1: Full suite + typecheck + lint + build**

Run:
```bash
npx tsc --noEmit && npx vitest run && npx eslint . && npm run build
```
Expected: all green (no new lint errors; build succeeds). Note any pre-existing
`any` warnings are unchanged.

- [ ] **Step 2: (Optional) CDP playtest**

If time permits, run a battle via `window.__game`, place towers, and confirm no
tower's `1 / effAs` cooldown drops below 0.2s. Combat-timing only — not required for
correctness (covered by unit tests).

- [ ] **Step 3: Push + deploy (standing rule)**

```bash
git push
npm run build && npx firebase-tools deploy --only hosting
```

> No ASSET_VERSION bump: this change touches no generated art/audio, only logic + data.
