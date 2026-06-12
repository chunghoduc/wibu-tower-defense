# Tower Aura Range Indicator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Draw an always-on, softly pulsing aquamarine ring at the _true_ aura radius of every tower that buffs nearby towers, so players can see aura coverage in battle.

**Architecture:** A pure Phaser-free helper (`src/core/auraIndicator.ts`) answers "does this tower have an active tower-buff aura and at what true radius" (mirroring the sim's `recomputeTowerBuffs` gate) plus a per-tower glow pulse. A thin render method `drawAuraRing` in `battleSceneRender.ts` consumes the helper and draws the ring/fill, called in a pre-pass under the existing tower bodies. Presentation-only: no gameplay, data, or art changes.

**Tech Stack:** TypeScript, Phaser 3, Vitest. ESM imports use explicit `.ts` extensions (project convention).

---

### Task 1: Pure aura-indicator helper

**Files:**

- Create: `src/core/auraIndicator.ts`
- Test: `tests/auraIndicator.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/auraIndicator.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { auraRadiusOf, auraPulse, AURA_RING_COLOR } from "../src/core/auraIndicator.ts";
import type { TowerRuntime } from "../src/core/battleTypes.ts";

// Minimal TowerRuntime stub — only the fields auraRadiusOf reads.
function tower(
  role: string,
  buffAura?: { radius: number; atkPct?: number; attackSpeedPct?: number },
): TowerRuntime {
  return {
    def: { role } as TowerRuntime["def"],
    behavior: { buffAura } as TowerRuntime["behavior"],
  } as TowerRuntime;
}

describe("auraRadiusOf", () => {
  it("returns the radius for a support tower with a positive-radius buffAura", () => {
    expect(auraRadiusOf(tower("support", { radius: 150, atkPct: 0.1 }))).toBe(150);
  });

  it("returns null for a non-support role even with a buffAura", () => {
    expect(auraRadiusOf(tower("damage", { radius: 150, atkPct: 0.1 }))).toBeNull();
  });

  it("returns null when there is no buffAura", () => {
    expect(auraRadiusOf(tower("support", undefined))).toBeNull();
  });

  it("returns null for a non-positive radius", () => {
    expect(auraRadiusOf(tower("support", { radius: 0 }))).toBeNull();
  });

  it("reads the live (upgrade-scaled) radius, not a constant", () => {
    const t = tower("support", { radius: 150 });
    t.behavior.buffAura!.radius = 162; // sim mutates this on upgrade
    expect(auraRadiusOf(t)).toBe(162);
  });
});

describe("auraPulse", () => {
  it("stays within [0, 1] across a time sweep", () => {
    for (let ms = 0; ms < 10000; ms += 137) {
      const p = auraPulse(ms, 3);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
  });

  it("de-syncs different towers (different uids differ at some time)", () => {
    const differs = [0, 500, 1000, 1500].some((ms) => auraPulse(ms, 1) !== auraPulse(ms, 7));
    expect(differs).toBe(true);
  });
});

describe("AURA_RING_COLOR", () => {
  it("is the aquamarine indicator color, distinct from gold 0xffd34d", () => {
    expect(AURA_RING_COLOR).toBe(0x66ffcc);
    expect(AURA_RING_COLOR).not.toBe(0xffd34d);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/auraIndicator.test.ts`
Expected: FAIL — cannot resolve `../src/core/auraIndicator.ts` (module does not exist).

- [ ] **Step 3: Write minimal implementation**

Create `src/core/auraIndicator.ts`:

```ts
// src/core/auraIndicator.ts
//
// Pure, Phaser-free helpers for the tower aura-range indicator. `auraRadiusOf`
// mirrors the gate in BattleState.recomputeTowerBuffs() (support role + a
// positive-radius buffAura) so the on-screen ring can never disagree with the
// simulation about which towers actually project a tower-buff aura. It reads the
// live runtime radius (behavior.buffAura.radius), which already includes in-battle
// upgrade scaling, so the ring stays truthful as a tower is upgraded.
import type { TowerRuntime } from "./battleTypes.ts";

/** Aura-indicator ring color — aquamarine, distinct from the gold attack/upgrade rings. */
export const AURA_RING_COLOR = 0x66ffcc;

/**
 * The true, current tower-buff aura radius for a tower, or null if it projects none.
 * (alive/disabled are the render layer's concern — they affect HOW the ring draws,
 * not whether the tower's def has an aura.)
 */
export function auraRadiusOf(t: TowerRuntime): number | null {
  if (t.def.role !== "support") return null;
  const a = t.behavior?.buffAura;
  if (!a || a.radius <= 0) return null;
  return a.radius;
}

/** Gentle 0..1 glow pulse, de-synced per tower via uid so rings don't blink in unison. */
export function auraPulse(timeMs: number, uid: number): number {
  return 0.5 + 0.5 * Math.sin(timeMs * 0.004 + uid);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/auraIndicator.test.ts`
Expected: PASS (9 assertions across the describe blocks).

- [ ] **Step 5: Commit**

```bash
git add src/core/auraIndicator.ts tests/auraIndicator.test.ts
git commit -m "feat(vfx): pure aura-radius/pulse helper for tower aura indicator

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Data-integrity guard — buffAura ⇒ support role

This catches authoring mistakes: a tower with a `buffAura` whose role is not
`support` would silently never apply its aura (the sim gate skips it) **and** never
show a ring. The test makes that contradiction loud.

**Files:**

- Modify (append a describe block): `tests/auraIndicator.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/auraIndicator.test.ts`:

```ts
import { TOWERS } from "../src/data/towers.ts";

describe("buffAura data integrity", () => {
  it("every tower def with a buffAura is role 'support' (else its aura never applies)", () => {
    const offenders = TOWERS.filter((d) => d.behavior?.buffAura && d.role !== "support").map(
      (d) => d.id,
    );
    expect(offenders).toEqual([]);
  });

  it("at least one tower actually projects a buffAura (the feature has subjects)", () => {
    expect(TOWERS.some((d) => d.behavior?.buffAura && d.role === "support")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it passes (or surfaces a real data bug)**

Run: `npx vitest run tests/auraIndicator.test.ts`
Expected: PASS. (If the first assertion FAILS, a tower has been mis-authored with a
`buffAura` on a non-support role — fix that tower's `role` in its data file before
continuing; do not weaken the test.)

- [ ] **Step 3: Commit**

```bash
git add tests/auraIndicator.test.ts
git commit -m "test(vfx): guard that every buffAura tower is role support

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Render the aura ring in the battle scene

**Files:**

- Modify: `src/scenes/battleSceneRender.ts` — add import, add `drawAuraRing` method, add pre-pass loop in `draw()`.

- [ ] **Step 1: Add the import**

In `src/scenes/battleSceneRender.ts`, after the existing import block (the line
`import type { BattleScene } from "./BattleScene.ts";` near the top), add:

```ts
import { auraRadiusOf, auraPulse, AURA_RING_COLOR } from "../core/auraIndicator.ts";
```

- [ ] **Step 2: Add the pre-pass loop in `draw()`**

In `draw()`, find this existing line:

```ts
for (const t of this.battle.towers) this.drawTower(g, t);
```

Insert the aura pre-pass immediately BEFORE it (so rings draw under tower bodies):

```ts
for (const t of this.battle.towers) this.drawAuraRing(g, t);
for (const t of this.battle.towers) this.drawTower(g, t);
```

- [ ] **Step 3: Add the `drawAuraRing` method**

In the same `renderMethods` object, add a new method directly after `drawTower`
(after its closing `},` near line 114):

```ts
  // Aura range indicator — a softly pulsing aquamarine ring + fill at the TRUE
  // tower-buff aura radius (behavior.buffAura.radius, already upgrade-scaled), drawn
  // under the tower bodies. Dimmed while the tower is disabled (its aura is inactive).
  drawAuraRing(this: BattleScene, g: Phaser.GameObjects.Graphics, t: TowerRuntime): void {
    if (!t.alive) return;
    const radius = auraRadiusOf(t);
    if (radius == null) return;
    const disabled = t.disabledTimer > 0;
    const pulse = auraPulse(this.time.now, t.uid);
    const fillA = (disabled ? 0.015 : 0.04) + pulse * (disabled ? 0.01 : 0.03);
    const ringA = (disabled ? 0.1 : 0.28) + pulse * (disabled ? 0.05 : 0.2);
    g.fillStyle(AURA_RING_COLOR, fillA).fillCircle(t.pos.x, t.pos.y, radius);
    g.lineStyle(1.5, AURA_RING_COLOR, ringA).strokeCircle(t.pos.x, t.pos.y, radius);
    g.lineStyle(1, AURA_RING_COLOR, ringA * 0.5).strokeCircle(t.pos.x, t.pos.y, radius - 4);
  },
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors (no new ones introduced).

- [ ] **Step 5: Verify the full test suite still passes**

Run: `npx vitest run`
Expected: PASS (all prior tests + the new `auraIndicator` tests).

- [ ] **Step 6: Commit**

```bash
git add src/scenes/battleSceneRender.ts
git commit -m "feat(vfx): draw pulsing aura range ring under support towers

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Verify whole — build, playtest, memory

**Files:**

- Modify (memory, outside repo): `memory/MEMORY.md`, `memory/project_skill_vfx_signatures.md` (or a new memory file).

- [ ] **Step 1: Build**

Run: `npm run build`
Expected: succeeds (pre-existing >500 kB chunk-size warning is fine).

- [ ] **Step 2: File-size check**

Confirm `src/scenes/battleSceneRender.ts` and `src/core/auraIndicator.ts` are each
under 500 lines (`wc -l`). `auraIndicator.ts` is ~25 lines; `battleSceneRender.ts`
gains ~12 lines (well under 500). If `battleSceneRender.ts` were over 500, that would
be a separate split task — it is not.

- [ ] **Step 3: CDP playtest smoke**

Run a playtest that places a support tower (one with a `buffAura`, e.g. Mira) next to
another tower and captures a frame, confirming no runtime errors and a visible ring:

```bash
bash scripts/playtest/snap.sh --out=/tmp/aura-indicator.png --wait=600 \
  --eval='(()=>{const bs=window.__game.scene.getScene("BattleScene");return {towers:bs?.battle?.towers?.length??-1};})()'
```

Expected: JSON prints with `towers >= 0` and **no thrown errors** in output. View
`/tmp/aura-indicator.png` and confirm an aquamarine ring is visible around the support
tower. (If no support tower is auto-placed in the default playtest, this is still a
no-error smoke; the unit tests already prove the radius logic.)

- [ ] **Step 4: Update memory**

Add a one-line pointer to `memory/MEMORY.md` and a short memory file (or extend
`project_skill_vfx_signatures.md`) recording: aura-buff towers now render an
always-on pulsing aquamarine ring at the true `behavior.buffAura.radius` (upgrade-
scaled); pure gate in `src/core/auraIndicator.ts` mirrors `recomputeTowerBuffs`;
`drawAuraRing` pre-pass in `battleSceneRender.ts`; color `0x66ffcc` chosen to avoid
the gold attack/upgrade rings.

- [ ] **Step 5: Final confirmation**

Run: `npx tsc --noEmit && npx vitest run`
Expected: typecheck clean, all tests pass. Report the final counts to the user.

---

## Self-Review

**Spec coverage:**

- "Glowing ring at true radius for aura towers" → Task 1 (`auraRadiusOf` reads live
  radius) + Task 3 (`drawAuraRing`). ✓
- "Glows (pulse), distinct color" → Task 1 (`auraPulse`, `AURA_RING_COLOR`) + Task 3. ✓
- "Honest about sim state (disabled dims)" → Task 3 disabled branch. ✓
- "No gameplay/data/art change" → only a new pure helper + a render method; no sim or
  data edits. ✓
- "Pure, unit-tested helper; thin render glue" → Task 1 tests; Task 3 glue. ✓
- Non-goals (no connectors, no per-type color, no enemy auras, always-on) → respected;
  nothing in the plan adds them. ✓
- Spec testing item 5 (data-integrity guard) → Task 2. ✓

**Placeholder scan:** No TBD/TODO; every code step shows full code; every command shows
expected output. ✓

**Type consistency:** `auraRadiusOf`, `auraPulse`, `AURA_RING_COLOR` names identical
across Tasks 1 and 3. `TowerRuntime` imported from `../core/battleTypes.ts` (test) and
referenced via the existing `battleSceneRender.ts` import. `behavior.buffAura.radius`
and `def.role` match the schema (`schema.ts` `TowerBehavior.buffAura`, `CharacterDef.role`).
`t.disabledTimer`, `t.uid`, `t.pos`, `t.alive` match `TowerRuntime`. ✓
