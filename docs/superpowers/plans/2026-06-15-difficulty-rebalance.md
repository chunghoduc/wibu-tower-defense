# Difficulty Rebalance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make regular + elite enemies meaningfully tankier/threatening and the apex bosses less of an immortal HP-sponge, preserving the difficulty monotonic law.

**Architecture:** Pure constant + data tuning. Raise the non-boss tier floor (`DIFFICULTY_SCALING.hpMult/atkMult`), cut the boss-specific multiplier (`bossHpMult`) and trim the three apex bosses' authored base HP, and raise `ELITE_BATTLE_CHANCE`. No new modules, no save migration, no art. TDD: assertions encode the new numbers; existing monotonic tests stay green.

**Tech Stack:** TypeScript, Vitest, Vite. Edits in `src/data/` + `src/core/elite.ts`; tests in `tests/`.

---

## File map

- `src/data/schema.ts` — `DIFFICULTY_SCALING` object (lines ~408–416) + its doc comment. The single per-tier floor/boss-multiplier table.
- `src/data/enemiesBosses.ts:223` — `meruon` `maxHp`.
- `src/data/enemiesAntiheroes.ts:305,344` — `fallenward` + `ashghost` `maxHp`.
- `src/data/stage.ts` — `BOSS_HP_RANK` doc-comment HP annotations (doc only; order unchanged).
- `src/core/elite.ts` — `ELITE_BATTLE_CHANCE`.
- `tests/difficultyRebalance.test.ts` — NEW, locks the rebalance intent.
- `tests/bossTankiness.test.ts` — UPDATE the Normal `bossHpMult` floor.

---

### Task 1: Failing test — lock the rebalance intent

**Files:**
- Test: `tests/difficultyRebalance.test.ts` (create)

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { DIFFICULTIES, DIFFICULTY_SCALING } from "../src/data/schema.ts";
import { ELITE_BATTLE_CHANCE } from "../src/core/elite.ts";
import { ENEMIES } from "../src/data/enemies.ts";

// The OLD values these assertions replace (for reference):
//   Normal hpMult 1.55, atkMult 1.25, bossHpMult 1.6
//   effective Normal boss factor (hpMult*bossHpMult) = 2.48
//   ELITE_BATTLE_CHANCE 0.25; apex base HP fallenward 3100 / meruon 3800 / ashghost 4200
const OLD_NORMAL_BOSS_FACTOR = 2.48;

const bossMaxHp = (id: string): number => {
  const def = ENEMIES.find((e) => e.id === id);
  if (!def) throw new Error(`boss ${id} not found`);
  return def.baseStats.maxHp;
};

describe("difficulty rebalance — tougher trash, less-immortal bosses", () => {
  it("lifts the non-boss HP/atk floor (enemies harder to kill)", () => {
    const n = DIFFICULTY_SCALING.Normal;
    expect(n.hpMult).toBeGreaterThanOrEqual(2.0); // was 1.55
    expect(n.hpMult).toBeGreaterThan(1.55);
    expect(n.atkMult).toBeGreaterThanOrEqual(1.45); // was 1.25
  });

  it("closes the trash↔boss gap: effective Normal boss factor does not exceed the old wall", () => {
    const n = DIFFICULTY_SCALING.Normal;
    const effectiveBoss = n.hpMult * n.bossHpMult;
    // Trash rose (>1.55) while the boss factor did NOT rise above the old 2.48.
    expect(effectiveBoss).toBeLessThanOrEqual(OLD_NORMAL_BOSS_FACTOR);
  });

  it("trims the three apex boss HP-sponges", () => {
    expect(bossMaxHp("fallenward")).toBeLessThanOrEqual(2850);
    expect(bossMaxHp("fallenward")).toBeLessThan(3100);
    expect(bossMaxHp("meruon")).toBeLessThanOrEqual(3200);
    expect(bossMaxHp("meruon")).toBeLessThan(3800);
    expect(bossMaxHp("ashghost")).toBeLessThanOrEqual(3500);
    expect(bossMaxHp("ashghost")).toBeLessThan(4200);
  });

  it("keeps the apex bosses ascending by base HP (BOSS_HP_RANK order intact)", () => {
    expect(bossMaxHp("madarok")).toBeLessThan(bossMaxHp("fallenward"));
    expect(bossMaxHp("fallenward")).toBeLessThan(bossMaxHp("meruon"));
    expect(bossMaxHp("meruon")).toBeLessThan(bossMaxHp("ashghost"));
  });

  it("fields tanky elites more often", () => {
    expect(ELITE_BATTLE_CHANCE).toBeGreaterThanOrEqual(0.3); // was 0.25
  });

  it("preserves the tier monotonic law for hpMult and atkMult", () => {
    const hp = DIFFICULTIES.map((d) => DIFFICULTY_SCALING[d].hpMult);
    const atk = DIFFICULTIES.map((d) => DIFFICULTY_SCALING[d].atkMult);
    for (let i = 1; i < DIFFICULTIES.length; i++) {
      expect(hp[i]).toBeGreaterThan(hp[i - 1]);
      expect(atk[i]).toBeGreaterThan(atk[i - 1]);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/difficultyRebalance.test.ts`
Expected: FAIL — current `hpMult 1.55`, `bossHpMult 1.6` (effective 2.48 — the `≤2.48` passes but `hpMult≥2.0` fails), base HP 3100/3800/4200, `ELITE_BATTLE_CHANCE 0.25` all violate the new assertions.

> NOTE: confirm `ENEMIES` is the exported aggregate array in `src/data/enemies.ts` that includes boss + antihero defs. If bosses live in a separate export, import the combined catalog instead (e.g. `ALL_ENEMIES`) — grep `export const` in `src/data/enemies.ts` first and use whichever array contains `id: "ashghost"`.

---

### Task 2: Lift the non-boss floor + cut the boss multiplier

**Files:**
- Modify: `src/data/schema.ts` (the `DIFFICULTY_SCALING` object + doc comment)

- [ ] **Step 1: Replace the three tier rows**

Find:

```typescript
  Normal: { hpMult: 1.55, atkMult: 1.25, bountyMult: 1, bossHpMult: 1.6, bossAtkMult: 1 },
  Hard: { hpMult: 7.8, atkMult: 2.5, bountyMult: 3, bossHpMult: 2.0, bossAtkMult: 1.3 },
  Nightmare: { hpMult: 14.8, atkMult: 3.3, bountyMult: 5, bossHpMult: 2.4, bossAtkMult: 1.5 },
```

Replace with:

```typescript
  Normal: { hpMult: 2.1, atkMult: 1.5, bountyMult: 1, bossHpMult: 1.1, bossAtkMult: 1 },
  Hard: { hpMult: 8.8, atkMult: 2.8, bountyMult: 3, bossHpMult: 1.5, bossAtkMult: 1.3 },
  Nightmare: { hpMult: 16.5, atkMult: 3.6, bountyMult: 5, bossHpMult: 1.85, bossAtkMult: 1.5 },
```

- [ ] **Step 2: Update the doc comment above the object**

Replace the existing block comment lines that describe the old numbers (the
`Normal floor lifted (1.3→1.55 …)` / `bossHpMult lifted off 1.0 …` paragraph and
the `~2.48× / ~15.6× / ~35.5×` line) with text describing the new intent:

```typescript
  // Rebalance 2026-06-15 — combat was "trash trivial, only lose to immortal
  // bosses". The non-boss floor is lifted (hpMult 1.55→2.1, atkMult 1.25→1.5 on
  // Normal) so trash is ~+35% HP and leaks actually chunk the castle. bossHpMult
  // is CUT (1.6→1.1 Normal) so the trash lift doesn't inflate bosses — the boss
  // wall now leans on authored base HP + mechanics, not a big multiplier.
  // Effective Normal boss HP factor (hpMult*bossHpMult) drops 2.48→2.31 even as
  // trash rises. Monotonic law preserved: hp/atk/bossHp all increase across tiers.
```

- [ ] **Step 3: Run the rebalance test**

Run: `npx vitest run tests/difficultyRebalance.test.ts`
Expected: PASS for the floor / boss-factor / monotonic / elite-pending cases; the
two apex-HP cases still FAIL (base HP not yet trimmed) and the elite case still
FAILs until Task 4. (Partial green is expected here.)

---

### Task 3: Trim the three apex boss HP-sponges

**Files:**
- Modify: `src/data/enemiesBosses.ts:223` (meruon)
- Modify: `src/data/enemiesAntiheroes.ts:305` (fallenward), `:344` (ashghost)
- Modify: `src/data/stage.ts` — `BOSS_HP_RANK` doc annotations (doc only)

- [ ] **Step 1: Trim meruon**

In `src/data/enemiesBosses.ts`, in the `id: "meruon"` def, change `maxHp: 3800,` → `maxHp: 3200,`.

- [ ] **Step 2: Trim fallenward + ashghost**

In `src/data/enemiesAntiheroes.ts`:
- `id: "fallenward"` def: `maxHp: 3100,` → `maxHp: 2850,`.
- `id: "ashghost"` def: `maxHp: 4200,` → `maxHp: 3500,`.

- [ ] **Step 3: Update BOSS_HP_RANK doc comments (order unchanged)**

In `src/data/stage.ts` `BOSS_HP_RANK`, update the trailing `// HP` annotations so
docs don't drift (values only — keep the same list order):
- `"fallenward", // 3100` → `// 2850`
- `"meruon", // 3800` → `// 3200`
- `"ashghost", // 4200` → `// 3500`

(madarok stays 2700 < fallenward 2850 < meruon 3200 < ashghost 3500 — still ascending.)

- [ ] **Step 4: Run the rebalance test**

Run: `npx vitest run tests/difficultyRebalance.test.ts`
Expected: the apex-HP and ascending-order cases now PASS; only the elite case
remains red.

---

### Task 4: Field tanky elites more often

**Files:**
- Modify: `src/core/elite.ts`

- [ ] **Step 1: Raise the elite chance**

Find: `export const ELITE_BATTLE_CHANCE = 0.25;`
Replace: `export const ELITE_BATTLE_CHANCE = 0.35;`
Update the line's doc comment if it cites 0.25.

- [ ] **Step 2: Run the rebalance test (now fully green)**

Run: `npx vitest run tests/difficultyRebalance.test.ts`
Expected: PASS (all cases).

---

### Task 5: Re-encode the boss-tankiness invariant

**Files:**
- Modify: `tests/bossTankiness.test.ts`

- [ ] **Step 1: Lower the Normal floor assertion to match the new design**

The old test asserted `DIFFICULTY_SCALING.Normal.bossHpMult >= 1.5` (encoding "the
multiplier is the wall"). The wall now lives in base HP + mechanics. Find:

```typescript
  it("Normal bossHpMult is no longer a no-op (bosses are tankier than equal-base trash)", () => {
    // Was 1.0 — the lever did nothing on the tier most players live in.
    expect(DIFFICULTY_SCALING.Normal.bossHpMult).toBeGreaterThanOrEqual(1.5);
  });
```

Replace with:

```typescript
  it("Normal bossHpMult stays a real lever, but no longer the whole wall", () => {
    // 2026-06-15 rebalance: cut 1.6→1.1 so the lifted trash floor (hpMult 2.1)
    // doesn't inflate bosses. Bosses still scale >1x on the difficulty axis and
    // lean on authored base HP + mechanics for the wall, not this multiplier.
    expect(DIFFICULTY_SCALING.Normal.bossHpMult).toBeGreaterThanOrEqual(1.05);
  });
```

The other two tests in this file (raw `bossHpMult` strictly increasing: 1.1<1.5<1.85;
effective `hpMult*bossHpMult` strictly increasing: 2.31<13.2<30.5) are unchanged and
still pass.

- [ ] **Step 2: Run the boss-tankiness test**

Run: `npx vitest run tests/bossTankiness.test.ts`
Expected: PASS (all 3).

---

### Task 6: Full verify + commit

- [ ] **Step 1: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Full test suite (regression — progression/wave untouched)**

Run: `npx vitest run`
Expected: PASS, including `tests/progressionScaling.test.ts` and `tests/waveScaling.test.ts`.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/data/schema.ts src/data/enemiesBosses.ts src/data/enemiesAntiheroes.ts \
        src/data/stage.ts src/core/elite.ts \
        tests/difficultyRebalance.test.ts tests/bossTankiness.test.ts
git commit -m "feat(balance): tougher enemies + less-immortal bosses

- DIFFICULTY_SCALING: lift non-boss floor (Normal hpMult 1.55→2.1, atkMult
  1.25→1.5; Hard/Nightmare proportional) so trash is ~+35% HP and leaks threaten
  the castle from wave one.
- Cut bossHpMult (Normal 1.6→1.1, Hard 2.0→1.5, NM 2.4→1.85) so the trash lift
  doesn't inflate bosses; effective Normal boss factor 2.48→2.31.
- Trim apex HP-sponges: fallenward 3100→2850, meruon 3800→3200, ashghost
  4200→3500 (BOSS_HP_RANK order intact).
- ELITE_BATTLE_CHANCE 0.25→0.35 for more tanky mini-wall variety.
- Tests: new difficultyRebalance.test.ts; bossTankiness floor re-encoded.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Live playtest (CDP self-playtest)

- [ ] **Step 1: Sanity-check the feel in a real battle**

Use the CDP self-playtest harness (`window.__game`) per the project's playtest
reference. Start an early Normal stage; confirm:
- Trash takes multiple hits (not one-shot) and an unguarded lane leaks and
  visibly damages the castle.
- Reaching a boss: it dies to a competent defence within its map crossing rather
  than walling indefinitely.

If it over-corrects (now too hard), the knobs in Task 2/3/4 are single-line
reversible — nudge `Normal.hpMult` and `ELITE_BATTLE_CHANCE` down and re-run
Task 6.

---

## Self-Review

- **Spec coverage:** floor lift (Task 2) ✓, boss-multiplier cut (Task 2) ✓, apex
  base-HP trim (Task 3) ✓, more elites (Task 4) ✓, monotonic law preserved
  (Task 1 monotonic test + untouched PROG/WAVE) ✓, tests-first TDD (Task 1, 5) ✓,
  live playtest (Task 7) ✓. No spec requirement left unassigned.
- **Placeholder scan:** none — every step shows the exact find/replace text or
  command. The one NOTE (Task 1 Step 2) is a guard to confirm the `ENEMIES`
  export name, with a concrete grep fallback.
- **Type consistency:** `DIFFICULTY_SCALING`, `DIFFICULTIES`, `ELITE_BATTLE_CHANCE`,
  `baseStats.maxHp` all match existing exports verified during planning. Boss ids
  (`fallenward`/`meruon`/`ashghost`/`madarok`) match `BOSS_HP_RANK`.
