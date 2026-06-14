# Endless In-Battle Wave Counter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the in-battle wave HUD in endless mode read `Wave {current}/{highest-wave-achieved}` (identical numbers once the current wave surpasses the stored best), while leaving campaign HUD and all reward/storage logic unchanged.

**Architecture:** A pure, Phaser-free `waveCounterLabel()` formatter in `src/core/waveCounter.ts` owns the string. `battleSceneRender.ts` calls it, sourcing the historical best live from `saveManager.bestEndlessWave(stage.id)`. No save-schema change, no live writes (settle-time `claimEndlessRun` still owns persistence).

**Tech Stack:** TypeScript, Vitest, Phaser 3.

---

### Task 1: Pure wave-counter formatter

**Files:**
- Create: `src/core/waveCounter.ts`
- Test: `tests/waveCounter.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/waveCounter.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { waveCounterLabel } from "../src/core/waveCounter.ts";

describe("waveCounterLabel", () => {
  it("campaign shows current/total and ignores best", () => {
    expect(waveCounterLabel({ endless: false, current: 5, total: 20, best: 99 })).toBe(
      "Wave 5/20",
    );
  });

  it("endless below best shows current/best", () => {
    expect(waveCounterLabel({ endless: true, current: 5, total: 20, best: 22 })).toBe(
      "Wave 5/22",
    );
  });

  it("endless at best shows identical numbers", () => {
    expect(waveCounterLabel({ endless: true, current: 22, total: 20, best: 22 })).toBe(
      "Wave 22/22",
    );
  });

  it("endless surpassing best shows two identical numbers", () => {
    expect(waveCounterLabel({ endless: true, current: 30, total: 20, best: 22 })).toBe(
      "Wave 30/30",
    );
  });

  it("endless fresh run (best 0) shows current/current", () => {
    expect(waveCounterLabel({ endless: true, current: 1, total: 20, best: 0 })).toBe(
      "Wave 1/1",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/waveCounter.test.ts`
Expected: FAIL — cannot find module `../src/core/waveCounter.ts`.

- [ ] **Step 3: Write minimal implementation**

Create `src/core/waveCounter.ts`:

```ts
/**
 * Formats the in-battle wave readout. Campaign stages have a fixed wave count, so
 * the denominator is `total`. Endless is infinite — there is no fixed target — so
 * the denominator is the player's highest wave achieved on this stage; once the
 * current wave passes that record the two numbers are identical (e.g. "Wave 23/23").
 */
export interface WaveCounterInput {
  /** True for endless survival; false for campaign / other modes. */
  endless: boolean;
  /** 1-based current wave, i.e. `Math.max(0, waveIndex + 1)`. */
  current: number;
  /** Campaign denominator (`stage.waves.length`); ignored in endless. */
  total: number;
  /** Stored historical best endless wave for this stage; ignored in campaign. */
  best: number;
}

export function waveCounterLabel(i: WaveCounterInput): string {
  const denom = i.endless ? Math.max(i.best, i.current) : i.total;
  return `Wave ${i.current}/${denom}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/waveCounter.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/waveCounter.ts tests/waveCounter.test.ts
git commit -m "feat(endless): pure waveCounterLabel (current/best) (TDD)"
```

---

### Task 2: Wire the formatter into the battle HUD

**Files:**
- Modify: `src/scenes/battleSceneRender.ts` (the `Wave ${...}/${this.stage.waves.length}` line, ~85, inside the `draw()` HUD `setText` block)

- [ ] **Step 1: Add the import**

At the top of `src/scenes/battleSceneRender.ts`, add alongside the other `../core` imports:

```ts
import { waveCounterLabel } from "../core/waveCounter.ts";
```

- [ ] **Step 2: Replace the inline wave string**

Find this block (around line 80-86):

```ts
    const b = this.battle;
    this.hud.setText(
      `${this.stage.name} [${b.difficulty}]   Gold ${b.gold}   ` +
        `Castle ${Math.max(0, Math.ceil(b.castleHp))}   ` +
        `Hero ${Math.max(0, Math.ceil(b.hero.hp))}/${b.hero.stats.maxHp}   ` +
        `Wave ${Math.max(0, b.waveIndex + 1)}/${this.stage.waves.length}`,
    );
```

Replace with:

```ts
    const b = this.battle;
    const endless = this.battleMode.kind === "endless";
    const best = endless ? this.saveManager.bestEndlessWave(this.stage.id) : 0;
    this.hud.setText(
      `${this.stage.name} [${b.difficulty}]   Gold ${b.gold}   ` +
        `Castle ${Math.max(0, Math.ceil(b.castleHp))}   ` +
        `Hero ${Math.max(0, Math.ceil(b.hero.hp))}/${b.hero.stats.maxHp}   ` +
        waveCounterLabel({
          endless,
          current: Math.max(0, b.waveIndex + 1),
          total: this.stage.waves.length,
          best,
        }),
    );
```

(`this.battleMode`, `this.saveManager`, and `this.stage` are all BattleScene fields available
in this merged-prototype module — see `BattleScene.ts:74` / `:194` and existing `this.saveManager`
usage in `battleSceneInput.ts`.)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean (no errors).

- [ ] **Step 4: Run the focused + neighbouring tests**

Run: `npx vitest run tests/waveCounter.test.ts tests/endless-bossrush.test.ts tests/waveTimer.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/scenes/battleSceneRender.ts
git commit -m "feat(endless): HUD shows wave/best via waveCounterLabel"
```

---

### Task 3: Full verification + playtest + memory

**Files:**
- Modify (memory): `/home/shyaken/.claude/projects/-home-shyaken-Workplace-wibu-tower-defense/memory/MEMORY.md` and a new project memory file (optional — only if a non-obvious gotcha emerges).

- [ ] **Step 1: Full test suite**

Run: `npm test`
Expected: all tests pass (prior baseline 1312 + 5 new = 1317).

- [ ] **Step 2: Lint + build**

Run: `npm run lint && npm run build`
Expected: 0 lint errors (pre-existing `any` warnings OK); build succeeds.

- [ ] **Step 3: Live CDP playtest**

Build a preview, launch headless Chrome, drive an endless run via `window.__game`, and assert
the HUD text. Concretely: start `npx vite preview --port 4188` + headless chrome on 9222, open
`/?debug`, set `battleMode` to endless and launch a cleared stage, advance `battle.waveIndex`
past the stored best, and read `scene.hud.text` — expect it to contain `Wave {n}/{n}` with
identical numbers once surpassed, and `Wave {n}/{best}` while below. Capture one screenshot.
Kill the preview + chrome afterward (use the `[v]ite` pkill trick).
Expected: HUD denominator equals the best while below it and equals current once surpassed; no
runtime errors.

- [ ] **Step 4: Update memory (only if warranted)**

If the playtest surfaced a non-obvious gotcha, add a one-line entry to `MEMORY.md` and a
project memory file linking `[[project_endless_wave_credit_nonfix]]`. Otherwise skip — the
existing endless memories already cover the mode.

- [ ] **Step 5: Confirm clean tree**

Run: `git status --porcelain`
Expected: empty.

---

## Self-Review

- **Spec coverage:** Task 1 implements the `waveCounterLabel` seam + the 5 spec test cases; Task 2 wires it into the HUD exactly as the spec's "Scene wiring" section prescribes; Task 3 verifies. No "live write" task exists — correct, the spec explicitly forbids it (reward-band regression). ✓
- **Placeholder scan:** No TBD/TODO; every code step shows complete code. ✓
- **Type consistency:** `WaveCounterInput` fields (`endless`, `current`, `total`, `best`) are used identically in the test, the implementation, and the scene call site. ✓
