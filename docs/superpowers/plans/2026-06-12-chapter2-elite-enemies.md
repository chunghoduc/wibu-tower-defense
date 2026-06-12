# Chapter 2+ Elite Enemies ("The Escalation Five") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add five powerful new enemies that debut from Chapter 2 (campaign stages 11+), each introducing a distinct, fair counter-play, via four new pure-core mechanics plus one reuse-only enemy.

**Architecture:** New behaviours are optional `EnemySpecial` fields; per-enemy mutable state is new `EnemyRuntime` fields initialised in `spawnEnemy`. Each mechanic mirrors a proven seam (boss `enrage`/`towerDisable`, `splitInto`, `isImmune`) and its math is extracted into a pure, unit-tested helper before any sim wiring. The five enemies enter only through the procedural `buildWaves(n)` (only ever called with `n ≥ 11`), so Chapter 1's hand-tuned waves are byte-for-byte untouched.

**Tech Stack:** TypeScript (strict), Vitest, Phaser 3 (rendering only — no scene changes required for the mechanics). Pure-core/presenter split is the house pattern.

**Spec:** `docs/superpowers/specs/2026-06-12-chapter2-elite-enemies-design.md`

---

## File Structure

**Create:**

- `src/core/enemyFrenzy.ts` — pure frenzy latch + multiplier helpers.
- `src/core/enemyAdaptive.ts` — pure adaptive-immunity phase + current-immune-type helpers.
- `tests/enemyFrenzy.test.ts`, `tests/enemyAdaptive.test.ts` — pure helper tests.
- `tests/chapter2Enemies.test.ts` — integration (`world()`) tests for all four mechanics + catalog + wave-gating.

**Modify:**

- `src/data/schemaEnums.ts` — add 5 archetype keys.
- `src/data/schema.ts:248-282` — add 4 optional `EnemySpecial` fields.
- `src/data/enemyInfo.ts` — add `ARCHETYPE_INFO` entries + `enemyTags` cases.
- `src/data/enemies.ts` — add 5 `EnemyDef` entries.
- `src/core/battleTypes.ts:144-183` — add 4 `EnemyRuntime` fields.
- `src/core/battleWaves.ts:285-315` — initialise the 4 new runtime fields.
- `src/core/battleEnemies.ts` — frenzy latch + fold into `enemySpeed`/`enemyAtk`; adaptive phase tick; disable-pulse loop.
- `src/core/battleDamage.ts` — adaptive immunity in `isImmune`; death-nova in `killEnemy`.
- `src/data/stage.ts:167-252` — gate the 5 enemies into `buildWaves`.
- `src/data/spriteManifest.ts` (+ generated PNGs) — sprite entries + art for the 5.

---

## Task 1: Schema foundations (archetypes, special fields, intel)

Pure type + data additions. After this the catalog compiles with the new vocabulary; no behaviour yet.

**Files:**

- Modify: `src/data/schemaEnums.ts:38-57`
- Modify: `src/data/schema.ts:248-282`
- Modify: `src/data/enemyInfo.ts:8-53`
- Test: `tests/enemy-info.test.ts`

- [ ] **Step 1: Add a failing intel test**

Append to `tests/enemy-info.test.ts` (inside the existing top-level `describe`, or as a new `describe`):

```ts
import { ARCHETYPE_INFO } from "../src/data/enemyInfo.ts";
import { ENEMY_ARCHETYPES } from "../src/data/schemaEnums.ts";

describe("chapter-2 archetypes", () => {
  it("registers the five new elite archetypes with intel blurbs", () => {
    for (const a of ["Berserker", "Adapter", "Burster", "Dreadnought", "Disruptor"] as const) {
      expect(ENEMY_ARCHETYPES).toContain(a);
      expect(ARCHETYPE_INFO[a]).toBeTruthy();
      expect(ARCHETYPE_INFO[a].length).toBeGreaterThan(10);
    }
  });
});
```

- [ ] **Step 2: Run it — expect FAIL**

Run: `npx vitest run tests/enemy-info.test.ts`
Expected: FAIL (type error / `ARCHETYPE_INFO` missing keys, or `ENEMY_ARCHETYPES` lacks the keys).

- [ ] **Step 3: Add the archetype keys**

In `src/data/schemaEnums.ts`, extend `ENEMY_ARCHETYPES` (insert before `"Boss"`):

```ts
  "Herald",
  "Hexer",
  "Berserker",
  "Adapter",
  "Burster",
  "Dreadnought",
  "Disruptor",
  "Boss",
] as const;
```

- [ ] **Step 4: Add the EnemySpecial fields**

In `src/data/schema.ts`, inside `interface EnemySpecial` (after the `supportAura` block, before the closing `}` at line 282), add:

```ts
  /** Berserker: latches into a frenzy (faster + harder hits) once HP drops below the threshold. One-way, like boss enrage. */
  frenzy?: { belowHpPct: number; speedMult: number; atkMult: number };
  /** Adapter: rotates its immune damage type through `types` every `switchIntervalSec`. True damage and the off-type always land. */
  adaptiveImmunity?: { types: DamageType[]; switchIntervalSec: number };
  /** Burster: on death, deals one burst of `damage` (`type`) to towers within `radius`. */
  deathNova?: { radius: number; damage: number; type: DamageType };
  /** Disruptor: every `interval`s, disables towers within `radius` for `duration`s (a normal-enemy tower-disable). */
  towerDisablePulse?: { radius: number; duration: number; interval: number };
```

(`DamageType` is already imported/used in this file — it's the type of `EnemyDef.damageType`.)

- [ ] **Step 5: Add ARCHETYPE_INFO + enemyTags cases**

In `src/data/enemyInfo.ts`, add to the `ARCHETYPE_INFO` record (before `Boss:`):

```ts
  Berserker: "Frenzies when wounded — gets faster and deadlier; burst it down before it snaps.",
  Adapter: "Alternates immunity between Physical and Magic — bring both types, True damage, or penetration.",
  Burster: "Detonates on death, damaging nearby towers — kill it at range or spread your towers.",
  Dreadnought: "Armored flyer that bombards your towers — needs heavy, dedicated anti-air.",
  Disruptor: "Periodically silences nearby towers — kill it first or spread your defenses.",
```

And in `enemyTags`, before `return tags;`, add:

```ts
if (def.special?.frenzy) tags.push("Frenzies");
if (def.special?.adaptiveImmunity) tags.push("Adaptive immunity");
if (def.special?.deathNova) tags.push("Death nova");
if (def.special?.towerDisablePulse) tags.push("Disables towers");
```

- [ ] **Step 6: Run it — expect PASS + typecheck**

Run: `npx vitest run tests/enemy-info.test.ts && npx tsc --noEmit`
Expected: test PASS; tsc clean.

- [ ] **Step 7: Commit**

```bash
git add src/data/schemaEnums.ts src/data/schema.ts src/data/enemyInfo.ts tests/enemy-info.test.ts
git commit -m "feat(enemies): schema foundations for chapter-2 elite archetypes + specials

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Frenzy mechanic (Bloodmad Reaver)

**Files:**

- Create: `src/core/enemyFrenzy.ts`
- Create: `tests/enemyFrenzy.test.ts`
- Modify: `src/core/battleTypes.ts:144-183` (add `frenzied`), `src/core/battleWaves.ts:285-315` (init)
- Modify: `src/core/battleEnemies.ts` (latch + `enemySpeed`/`enemyAtk`)

- [ ] **Step 1: Write the failing pure-helper test**

Create `tests/enemyFrenzy.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { shouldFrenzy, frenzyMods } from "../src/core/enemyFrenzy.ts";
import type { EnemySpecial } from "../src/data/schema.ts";

const FR: EnemySpecial = { frenzy: { belowHpPct: 0.5, speedMult: 1.8, atkMult: 1.6 } };

describe("enemyFrenzy", () => {
  it("latches only below the threshold and only once", () => {
    expect(shouldFrenzy(FR, 0.6, false)).toBe(false);
    expect(shouldFrenzy(FR, 0.5, false)).toBe(true);
    expect(shouldFrenzy(FR, 0.2, true)).toBe(false); // already frenzied
    expect(shouldFrenzy(undefined, 0.1, false)).toBe(false);
    expect(shouldFrenzy({}, 0.1, false)).toBe(false);
  });

  it("multipliers are neutral until frenzied, then the configured values", () => {
    expect(frenzyMods(FR, false)).toEqual({ speedMult: 1, atkMult: 1 });
    expect(frenzyMods(FR, true)).toEqual({ speedMult: 1.8, atkMult: 1.6 });
    expect(frenzyMods(undefined, true)).toEqual({ speedMult: 1, atkMult: 1 });
  });
});
```

- [ ] **Step 2: Run it — expect FAIL**

Run: `npx vitest run tests/enemyFrenzy.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the pure helper**

Create `src/core/enemyFrenzy.ts`:

```ts
/**
 * Pure frenzy math for Berserker enemies (e.g. the Bloodmad Reaver). A frenzy is
 * a one-way latch — once HP falls below the threshold the enemy stays frenzied
 * (mirrors boss enrage), gaining move-speed and attack multipliers.
 */
import type { EnemySpecial } from "../data/schema.ts";

/** True when a frenzy-capable enemy should latch into frenzy at this HP fraction. */
export function shouldFrenzy(
  special: EnemySpecial | undefined,
  hpFrac: number,
  already: boolean,
): boolean {
  const f = special?.frenzy;
  if (!f || already) return false;
  return hpFrac <= f.belowHpPct;
}

/** Speed/atk multipliers from an active frenzy; neutral {1,1} when inactive or absent. */
export function frenzyMods(
  special: EnemySpecial | undefined,
  frenzied: boolean,
): { speedMult: number; atkMult: number } {
  const f = special?.frenzy;
  if (!f || !frenzied) return { speedMult: 1, atkMult: 1 };
  return { speedMult: f.speedMult, atkMult: f.atkMult };
}
```

- [ ] **Step 4: Run it — expect PASS**

Run: `npx vitest run tests/enemyFrenzy.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the runtime field + init**

In `src/core/battleTypes.ts`, in `interface EnemyRuntime`, after `enraged: boolean;` (line ~174) add:

```ts
/** Berserker: latched into frenzy (one-way, like `enraged`). */
frenzied: boolean;
```

In `src/core/battleWaves.ts`, in the `this.enemies.push({ ... })` literal, after `enraged: false,` (line ~310) add:

```ts
      frenzied: false,
```

- [ ] **Step 6: Wire the latch + multipliers**

In `src/core/battleEnemies.ts`, add the import at the top (alongside the other `./` imports):

```ts
import { shouldFrenzy, frenzyMods } from "./enemyFrenzy.ts";
```

In `updateEnemies`, right after the `if (e.def.boss) this.updateBoss(e, dt);` line (line ~30), add:

```ts
if (shouldFrenzy(e.def.special, e.hp / e.stats.maxHp, e.frenzied)) e.frenzied = true;
```

Replace `enemySpeed` (lines ~209-212) with:

```ts
  enemySpeed(this: BattleState, e: EnemyRuntime): number {
    const base = slowedSpeed(e.stats.moveSpeed, e.slowPct) * e.aura.moveMult;
    const enrage = e.enraged && e.def.boss?.enrage ? e.def.boss.enrage.speedMult : 1;
    return base * enrage * frenzyMods(e.def.special, e.frenzied).speedMult;
  },
```

Replace `enemyAtk` (lines ~214-216) with:

```ts
  enemyAtk(this: BattleState, e: EnemyRuntime): number {
    const enrage = e.enraged && e.def.boss?.enrage ? e.def.boss.enrage.atkMult : 1;
    return e.stats.atk * enrage * frenzyMods(e.def.special, e.frenzied).atkMult;
  },
```

- [ ] **Step 7: Write the failing integration test**

Create `tests/chapter2Enemies.test.ts` with this first block:

```ts
import { describe, expect, it } from "vitest";
import { world, mkEnemy, mkTower, mkStage, runFor } from "./fixtures.ts";

describe("Bloodmad Reaver — frenzy", () => {
  it("latches into frenzy once HP drops below 50% and speeds up", () => {
    const reaver = mkEnemy({
      id: "reaver",
      name: "Bloodmad Reaver",
      archetype: "Berserker",
      baseStats: { ...mkEnemy().baseStats, maxHp: 100, moveSpeed: 60, atk: 30 },
      special: { frenzy: { belowHpPct: 0.5, speedMult: 1.8, atkMult: 1.6 } },
    });
    // A weak tower so the enemy survives and crosses the 50% threshold slowly.
    const tower = mkTower({
      baseStats: { ...mkTower().baseStats, atk: 6, attackSpeed: 2, range: 600 },
    });
    const stage = mkStage([{ spawns: [{ enemyId: "reaver", count: 1, interval: 1, delay: 0 }] }], {
      slots: [{ x: 150, y: -30 }],
      path: [
        { x: 0, y: 0 },
        { x: 4000, y: 0 },
      ],
    });
    const b = world([reaver], [tower], stage, { seed: 1 });
    runFor(b, 8);
    const e = b.enemies[0];
    expect(e).toBeDefined();
    if (e.alive) {
      expect(e.hp / e.stats.maxHp).toBeLessThan(0.5);
      expect(e.frenzied).toBe(true);
      expect(b.enemySpeed(e)).toBeGreaterThan(60 * 1.5); // ~1.8× base
    } else {
      // If it died, it must have frenzied first — assert the latch fired this run.
      expect(e.frenzied).toBe(true);
    }
  });
});
```

- [ ] **Step 8: Run it — expect PASS**

Run: `npx vitest run tests/chapter2Enemies.test.ts tests/enemyFrenzy.test.ts && npx tsc --noEmit`
Expected: PASS; tsc clean.

- [ ] **Step 9: Commit**

```bash
git add src/core/enemyFrenzy.ts tests/enemyFrenzy.test.ts tests/chapter2Enemies.test.ts src/core/battleTypes.ts src/core/battleWaves.ts src/core/battleEnemies.ts
git commit -m "feat(enemies): frenzy mechanic (Bloodmad Reaver)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Adaptive immunity (Prism Behemoth)

**Files:**

- Create: `src/core/enemyAdaptive.ts`
- Create: `tests/enemyAdaptive.test.ts`
- Modify: `src/core/battleTypes.ts` (add `adaptPhaseTimer`, `adaptPhaseIndex`), `src/core/battleWaves.ts` (init)
- Modify: `src/core/battleEnemies.ts` (`tickEnemyStatus` phase advance), `src/core/battleDamage.ts` (`isImmune`)

- [ ] **Step 1: Write the failing pure-helper test**

Create `tests/enemyAdaptive.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { adaptiveImmuneType, advanceAdaptivePhase } from "../src/core/enemyAdaptive.ts";
import type { EnemySpecial } from "../src/data/schema.ts";

const AD: EnemySpecial = {
  adaptiveImmunity: { types: ["Physical", "Magic"], switchIntervalSec: 3.5 },
};

describe("enemyAdaptive", () => {
  it("reports the current immune type by phase index, wrapping", () => {
    expect(adaptiveImmuneType(AD, 0)).toBe("Physical");
    expect(adaptiveImmuneType(AD, 1)).toBe("Magic");
    expect(adaptiveImmuneType(AD, 2)).toBe("Physical");
    expect(adaptiveImmuneType(undefined, 0)).toBeNull();
    expect(adaptiveImmuneType({}, 0)).toBeNull();
  });

  it("advances the phase only when the timer expires", () => {
    const a = advanceAdaptivePhase(AD, 3.5, 0, 1);
    expect(a).toEqual({ timer: 2.5, index: 0, switched: false });
    const b = advanceAdaptivePhase(AD, 0.5, 0, 1);
    expect(b.index).toBe(1);
    expect(b.switched).toBe(true);
    expect(b.timer).toBeCloseTo(3.0, 5);
  });

  it("handles a long dt that crosses multiple intervals", () => {
    const r = advanceAdaptivePhase(AD, 1, 0, 8); // 1 - 8 = -7 → +3.5 ×3 = +3.5 (2 switches: -7→-3.5→0... )
    expect(r.switched).toBe(true);
    expect(r.timer).toBeGreaterThan(0);
    expect(r.index).toBe(0); // two switches from index 0 → back to 0
  });
});
```

- [ ] **Step 2: Run it — expect FAIL**

Run: `npx vitest run tests/enemyAdaptive.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the pure helper**

Create `src/core/enemyAdaptive.ts`:

```ts
/**
 * Pure adaptive-immunity math for Adapter enemies (e.g. the Prism Behemoth). The
 * enemy rotates which damage type it is immune to through `types`, switching every
 * `switchIntervalSec`. True damage and the off-type always land — never a hard
 * lock-and-key.
 */
import type { DamageType, EnemySpecial } from "../data/schema.ts";

/** The damage type the enemy is currently immune to for this phase index (null if not an Adapter). */
export function adaptiveImmuneType(
  special: EnemySpecial | undefined,
  phaseIndex: number,
): DamageType | null {
  const a = special?.adaptiveImmunity;
  if (!a || a.types.length === 0) return null;
  return a.types[phaseIndex % a.types.length];
}

/**
 * Advance the phase countdown by `dt`. Returns the new timer/index and whether a
 * switch occurred this step (so the caller can emit a telegraph). Crossing several
 * intervals in one big `dt` advances the index that many times.
 */
export function advanceAdaptivePhase(
  special: EnemySpecial | undefined,
  timer: number,
  index: number,
  dt: number,
): { timer: number; index: number; switched: boolean } {
  const a = special?.adaptiveImmunity;
  if (!a || a.types.length === 0) return { timer, index, switched: false };
  let t = timer - dt;
  let i = index;
  let switched = false;
  while (t <= 0) {
    t += a.switchIntervalSec;
    i = (i + 1) % a.types.length;
    switched = true;
  }
  return { timer: t, index: i, switched };
}
```

- [ ] **Step 4: Run it — expect PASS**

Run: `npx vitest run tests/enemyAdaptive.test.ts`
Expected: PASS.

- [ ] **Step 5: Add runtime fields + init**

In `src/core/battleTypes.ts`, in `EnemyRuntime`, after the `frenzied: boolean;` line add:

```ts
/** Adapter: countdown to the next immunity switch, and the current phase index. */
adaptPhaseTimer: number;
adaptPhaseIndex: number;
```

In `src/core/battleWaves.ts`, after `frenzied: false,` add:

```ts
      adaptPhaseTimer: def.special?.adaptiveImmunity?.switchIntervalSec ?? 0,
      adaptPhaseIndex: 0,
```

- [ ] **Step 6: Tick the phase + emit a telegraph**

In `src/core/battleEnemies.ts`, add to the top imports:

```ts
import { advanceAdaptivePhase, adaptiveImmuneType } from "./enemyAdaptive.ts";
```

In `tickEnemyStatus`, after the `if (e.stunTimer > 0) e.stunTimer -= dt;` line (line ~65), add:

```ts
if (e.def.special?.adaptiveImmunity) {
  const r = advanceAdaptivePhase(e.def.special, e.adaptPhaseTimer, e.adaptPhaseIndex, dt);
  e.adaptPhaseTimer = r.timer;
  e.adaptPhaseIndex = r.index;
  if (r.switched) {
    const imm = adaptiveImmuneType(e.def.special, e.adaptPhaseIndex) ?? "Physical";
    this.emit({ type: "splash", at: { x: e.pos.x, y: e.pos.y }, radius: 28, damageType: imm });
  }
}
```

- [ ] **Step 7: Wire isImmune**

In `src/core/battleDamage.ts`, add the import at the top:

```ts
import { adaptiveImmuneType } from "./enemyAdaptive.ts";
```

In `isImmune`, immediately before `return false;` (line ~142), add:

```ts
if (adaptiveImmuneType(target.def.special, target.adaptPhaseIndex) === damageType) return true;
```

- [ ] **Step 8: Write the failing integration test**

Append to `tests/chapter2Enemies.test.ts`:

```ts
import { adaptiveImmuneType } from "../src/core/enemyAdaptive.ts";

describe("Prism Behemoth — adaptive immunity", () => {
  function prismWorld(towerType: "Physical" | "Magic") {
    const prism = mkEnemy({
      id: "prism",
      name: "Prism Behemoth",
      archetype: "Adapter",
      baseStats: { ...mkEnemy().baseStats, maxHp: 100000, moveSpeed: 0, atk: 0 },
      special: { adaptiveImmunity: { types: ["Physical", "Magic"], switchIntervalSec: 3.5 } },
    });
    const tower = mkTower({
      damageType: towerType,
      baseStats: { ...mkTower().baseStats, atk: 1000, attackSpeed: 10, range: 9999 },
    });
    const stage = mkStage([{ spawns: [{ enemyId: "prism", count: 1, interval: 1, delay: 0 }] }], {
      slots: [{ x: 10, y: 0 }],
      path: [
        { x: 0, y: 0 },
        { x: 50, y: 0 },
      ],
    });
    return world([prism], [tower], stage, { seed: 1 });
  }

  it("starts immune to Physical at spawn", () => {
    const b = prismWorld("Physical");
    runFor(b, 0.3); // let it spawn
    const e = b.enemies[0];
    expect(adaptiveImmuneType(e.def.special, e.adaptPhaseIndex)).toBe("Physical");
  });

  it("a Physical-only tower stalls during the Physical phase but lands during the Magic phase", () => {
    const b = prismWorld("Physical");
    runFor(b, 0.3);
    const e = b.enemies[0];
    const hp0 = e.hp;
    runFor(b, 1.0); // still Physical phase → no damage
    expect(e.hp).toBe(hp0);
    runFor(b, 3.0); // crosses into Magic phase → Physical now lands
    expect(e.hp).toBeLessThan(hp0);
  });

  it("is always killable by True damage regardless of phase", () => {
    const prism = mkEnemy({
      id: "prism2",
      archetype: "Adapter",
      baseStats: { ...mkEnemy().baseStats, maxHp: 500, moveSpeed: 0 },
      special: { adaptiveImmunity: { types: ["Physical", "Magic"], switchIntervalSec: 3.5 } },
    });
    const tower = mkTower({
      damageType: "True",
      baseStats: { ...mkTower().baseStats, atk: 1000, attackSpeed: 10, range: 9999 },
    });
    const stage = mkStage([{ spawns: [{ enemyId: "prism2", count: 1, interval: 1, delay: 0 }] }], {
      slots: [{ x: 10, y: 0 }],
      path: [
        { x: 0, y: 0 },
        { x: 50, y: 0 },
      ],
    });
    const b = world([prism], [tower], stage, { seed: 1 });
    runFor(b, 2);
    expect(b.enemies[0].alive).toBe(false);
  });
});
```

> Note: towers auto-attack only in Physical/Magic; the True-damage test sets `damageType: "True"` directly on the tower def to exercise the `isImmune` path for True (the engine's `isImmune` returns false for True, which is what we verify).

- [ ] **Step 9: Run it — expect PASS**

Run: `npx vitest run tests/chapter2Enemies.test.ts tests/enemyAdaptive.test.ts && npx tsc --noEmit`
Expected: PASS; tsc clean.

- [ ] **Step 10: Commit**

```bash
git add src/core/enemyAdaptive.ts tests/enemyAdaptive.test.ts tests/chapter2Enemies.test.ts src/core/battleTypes.ts src/core/battleWaves.ts src/core/battleEnemies.ts src/core/battleDamage.ts
git commit -m "feat(enemies): adaptive Physical/Magic immunity (Prism Behemoth)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Death nova (Bloomrot Carrier)

**Files:**

- Modify: `src/core/battleDamage.ts` (`killEnemy` + imports)
- Test: `tests/chapter2Enemies.test.ts`

- [ ] **Step 1: Write the failing integration test**

Append to `tests/chapter2Enemies.test.ts`:

```ts
describe("Bloomrot Carrier — death nova", () => {
  it("damages towers within the nova radius when it dies", () => {
    const carrier = mkEnemy({
      id: "carrier",
      name: "Bloomrot Carrier",
      archetype: "Burster",
      baseStats: { ...mkEnemy().baseStats, maxHp: 30, moveSpeed: 0, atk: 0 },
      special: { deathNova: { radius: 110, damage: 45, type: "Magic" } },
    });
    // Tower with low HP and no mitigation so the nova is observable; high range/atk to kill the carrier fast.
    const near = mkTower({
      id: "near",
      baseStats: {
        ...mkTower().baseStats,
        atk: 1000,
        attackSpeed: 10,
        range: 9999,
        maxHp: 100,
        magicResist: 0,
      },
    });
    const stage = mkStage([{ spawns: [{ enemyId: "carrier", count: 1, interval: 1, delay: 0 }] }], {
      slots: [{ x: 20, y: 0 }],
      path: [
        { x: 0, y: 0 },
        { x: 50, y: 0 },
      ],
    });
    const b = world([carrier], [near], stage, { seed: 1 });
    const tower = b.towers[0];
    const hp0 = tower.hp;
    runFor(b, 1.5);
    expect(b.enemies[0].alive).toBe(false); // carrier dead
    expect(tower.hp).toBeLessThan(hp0); // nova hit the nearby tower
    expect(b.fx.some((f) => f.type === "splash")).toBe(true); // telegraph emitted at some point
  });

  it("spares towers outside the nova radius", () => {
    const carrier = mkEnemy({
      id: "carrier2",
      archetype: "Burster",
      baseStats: { ...mkEnemy().baseStats, maxHp: 30, moveSpeed: 0, atk: 0 },
      special: { deathNova: { radius: 50, damage: 45, type: "Magic" } },
    });
    const far = mkTower({
      id: "far",
      baseStats: {
        ...mkTower().baseStats,
        atk: 1000,
        attackSpeed: 10,
        range: 9999,
        maxHp: 100,
        magicResist: 0,
      },
    });
    const stage = mkStage(
      [{ spawns: [{ enemyId: "carrier2", count: 1, interval: 1, delay: 0 }] }],
      {
        slots: [{ x: 400, y: 0 }],
        path: [
          { x: 0, y: 0 },
          { x: 50, y: 0 },
        ],
      },
    ); // tower 400u away (> radius 50)
    const b = world([carrier], [far], stage, { seed: 1 });
    const tower = b.towers[0];
    const hp0 = tower.hp;
    runFor(b, 1.5);
    expect(b.enemies[0].alive).toBe(false);
    expect(tower.hp).toBe(hp0); // untouched
  });
});
```

- [ ] **Step 2: Run it — expect FAIL**

Run: `npx vitest run tests/chapter2Enemies.test.ts -t "death nova"`
Expected: FAIL (tower HP unchanged — nova not implemented).

- [ ] **Step 3: Confirm imports in battleDamage.ts**

`killEnemy` will call `dist` and `mitigatedDamage`. Check the top of `src/core/battleDamage.ts` for existing imports. Ensure these are present (add to existing import lines if missing):

```ts
import { mitigatedDamage, type DamagePacket } from "./damage.ts";
import { dist } from "./path.ts";
```

(If `battleDamage.ts` already imports some of these, extend the existing import rather than duplicating.)

- [ ] **Step 4: Implement the nova in killEnemy**

In `src/core/battleDamage.ts`, in `killEnemy`, after the `splitInto` block (after its closing `}` at line ~320, before the method's closing `}`), add:

```ts
const nova = e.def.special?.deathNova;
if (nova) {
  this.emit({
    type: "splash",
    at: { x: e.pos.x, y: e.pos.y },
    radius: nova.radius,
    damageType: nova.type,
  });
  const packet: DamagePacket = { amount: nova.damage, type: nova.type, armorPen: 0, magicPen: 0 };
  for (const t of this.towers) {
    if (t.alive && dist(e.pos, t.pos) <= nova.radius) {
      t.hp -= mitigatedDamage(packet, t.stats);
      if (t.hp <= 0) t.alive = false;
    }
  }
}
```

- [ ] **Step 5: Run it — expect PASS**

Run: `npx vitest run tests/chapter2Enemies.test.ts -t "death nova" && npx tsc --noEmit`
Expected: PASS; tsc clean.

- [ ] **Step 6: Commit**

```bash
git add src/core/battleDamage.ts tests/chapter2Enemies.test.ts
git commit -m "feat(enemies): on-death tower nova (Bloomrot Carrier)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Tower-disable pulse (Gravewail Cantor) + the five enemy defs

**Files:**

- Modify: `src/core/battleTypes.ts` (add `disablePulseTimer`), `src/core/battleWaves.ts` (init)
- Modify: `src/core/battleEnemies.ts` (`updateEnemies` pulse loop)
- Modify: `src/data/enemies.ts` (add 5 `EnemyDef`)
- Test: `tests/chapter2Enemies.test.ts`

- [ ] **Step 1: Add runtime field + init**

In `src/core/battleTypes.ts`, in `EnemyRuntime`, after `adaptPhaseIndex: number;` add:

```ts
/** Disruptor: countdown to the next tower-disable pulse. */
disablePulseTimer: number;
```

In `src/core/battleWaves.ts`, after `adaptPhaseIndex: 0,` add:

```ts
      disablePulseTimer: def.special?.towerDisablePulse?.interval ?? 0,
```

- [ ] **Step 2: Implement the pulse loop**

In `src/core/battleEnemies.ts`, in `updateEnemies`, after the `summon` block (after line ~37, before the `if (e.stunTimer > 0)` block), add:

```ts
if (e.def.special?.towerDisablePulse) {
  const p = e.def.special.towerDisablePulse;
  e.disablePulseTimer -= dt;
  if (e.disablePulseTimer <= 0) {
    let hit = false;
    for (const t of this.towers) {
      if (t.alive && dist(e.pos, t.pos) <= p.radius) {
        t.disabledTimer = Math.max(t.disabledTimer, p.duration);
        hit = true;
      }
    }
    if (hit)
      this.emit({
        type: "splash",
        at: { x: e.pos.x, y: e.pos.y },
        radius: p.radius,
        damageType: "Magic",
      });
    e.disablePulseTimer = p.interval;
  }
}
```

(`dist` is already imported in `battleEnemies.ts`.)

- [ ] **Step 3: Write the failing integration test**

Append to `tests/chapter2Enemies.test.ts`:

```ts
describe("Gravewail Cantor — tower-disable pulse", () => {
  it("periodically disables towers within its radius", () => {
    const cantor = mkEnemy({
      id: "cantor",
      name: "Gravewail Cantor",
      archetype: "Disruptor",
      baseStats: { ...mkEnemy().baseStats, maxHp: 1e9, moveSpeed: 0, atk: 0 },
      special: { towerDisablePulse: { radius: 120, duration: 1.6, interval: 7 } },
    });
    const tower = mkTower({
      baseStats: { ...mkTower().baseStats, atk: 1, attackSpeed: 1, range: 9999, maxHp: 1e9 },
    });
    const stage = mkStage([{ spawns: [{ enemyId: "cantor", count: 1, interval: 1, delay: 0 }] }], {
      slots: [{ x: 30, y: 0 }],
      path: [
        { x: 0, y: 0 },
        { x: 50, y: 0 },
      ],
    });
    const b = world([cantor], [tower], stage, { seed: 1 });
    runFor(b, 0.3); // spawn; first pulse fires when timer (7) hits 0 — but timer starts at interval, so...
    // Drive until just after the first pulse (timer init = interval = 7s).
    runFor(b, 7.1);
    expect(b.towers[0].disabledTimer).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 4: Run it — expect PASS**

Run: `npx vitest run tests/chapter2Enemies.test.ts -t "disable pulse" && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Add the five enemy defs**

In `src/data/enemies.ts`, after the Hexer entry (the `hexer` object ending at line ~281) and before the `// --- Mid-boss` comment, insert:

```ts
  // --- Chapter 2+ elites ("The Escalation Five") — debut from stages 11+ via buildWaves.
  //     Authored at the Chapter-1 power tier; the progression curve scales them per chapter.
  {
    // Berserker: a tower-smasher that turns lethal once wounded — burst it, don't chip it.
    id: "reaver",
    name: "Bloodmad Reaver",
    archetype: "Berserker",
    flying: false,
    immunity: null,
    damageType: "Physical",
    bounty: 22,
    castleDamage: 3,
    baseStats: makeStats({ maxHp: 170, armor: 10, moveSpeed: 60, atk: 30, attackSpeed: 1 }),
    special: { attacksTowers: { range: 95 }, frenzy: { belowHpPct: 0.5, speedMult: 1.8, atkMult: 1.6 } },
    artRef: "placeholder",
  },
  {
    // Adapter: alternates Physical/Magic immunity — needs both damage types, True, or penetration.
    id: "prism",
    name: "Prism Behemoth",
    archetype: "Adapter",
    flying: false,
    immunity: null,
    damageType: "Physical",
    bounty: 40,
    castleDamage: 5,
    baseStats: makeStats({ maxHp: 360, armor: 35, magicResist: 35, damageReduction: 0.4, moveSpeed: 16, atk: 22, attackSpeed: 0.6 }),
    special: { adaptiveImmunity: { types: ["Physical", "Magic"], switchIntervalSec: 3.5 } },
    artRef: "placeholder",
  },
  {
    // Burster: detonates on death, splashing your towers — kill at range or space your line.
    id: "carrier",
    name: "Bloomrot Carrier",
    archetype: "Burster",
    flying: false,
    immunity: null,
    damageType: "Magic",
    bounty: 14,
    castleDamage: 2,
    baseStats: makeStats({ maxHp: 130, moveSpeed: 40, atk: 6, attackSpeed: 0.8 }),
    special: { deathNova: { radius: 110, damage: 45, type: "Magic" } },
    artRef: "placeholder",
  },
  {
    // Dreadnought: an armored flyer that bombards towers — demands heavy anti-air.
    id: "dreadwing",
    name: "Iron Dreadwing",
    archetype: "Dreadnought",
    flying: true,
    immunity: null,
    damageType: "Physical",
    bounty: 22,
    castleDamage: 3,
    baseStats: makeStats({ maxHp: 220, armor: 30, moveSpeed: 40, atk: 18, attackSpeed: 0.7 }),
    special: { attacksTowers: { range: 130 } },
    artRef: "placeholder",
  },
  {
    // Disruptor: a keening cantor that periodically silences nearby towers — priority-kill it.
    id: "cantor",
    name: "Gravewail Cantor",
    archetype: "Disruptor",
    flying: false,
    immunity: null,
    damageType: "Magic",
    bounty: 24,
    castleDamage: 2,
    baseStats: makeStats({ maxHp: 130, magicResist: 30, moveSpeed: 30, atk: 6, attackSpeed: 0.8 }),
    special: { towerDisablePulse: { radius: 120, duration: 1.6, interval: 7 } },
    artRef: "placeholder",
  },
```

- [ ] **Step 6: Write the failing catalog test**

Append to `tests/chapter2Enemies.test.ts`:

```ts
import { ENEMIES } from "../src/data/enemies.ts";
import { enemyTags } from "../src/data/enemyInfo.ts";

describe("Escalation Five — catalog integrity", () => {
  const ids = ["reaver", "prism", "carrier", "dreadwing", "cantor"];
  it("all five are present with unique ids and their signature special", () => {
    for (const id of ids) {
      const def = ENEMIES.find((e) => e.id === id);
      expect(def, id).toBeDefined();
    }
    expect(ENEMIES.find((e) => e.id === "reaver")!.special?.frenzy).toBeDefined();
    expect(ENEMIES.find((e) => e.id === "prism")!.special?.adaptiveImmunity).toBeDefined();
    expect(ENEMIES.find((e) => e.id === "carrier")!.special?.deathNova).toBeDefined();
    expect(ENEMIES.find((e) => e.id === "dreadwing")!.flying).toBe(true);
    expect(ENEMIES.find((e) => e.id === "cantor")!.special?.towerDisablePulse).toBeDefined();
  });
  it("none are bosses (they must never trigger boss-only wave/castle logic)", () => {
    for (const id of ids) expect(ENEMIES.find((e) => e.id === id)!.archetype).not.toBe("Boss");
  });
  it("surfaces player-facing tags", () => {
    expect(enemyTags(ENEMIES.find((e) => e.id === "reaver")!)).toContain("Frenzies");
    expect(enemyTags(ENEMIES.find((e) => e.id === "dreadwing")!)).toContain("Flying");
  });
});
```

- [ ] **Step 7: Run it — expect PASS**

Run: `npx vitest run tests/chapter2Enemies.test.ts && npx tsc --noEmit`
Expected: PASS; tsc clean.

- [ ] **Step 8: Commit**

```bash
git add src/core/battleTypes.ts src/core/battleWaves.ts src/core/battleEnemies.ts src/data/enemies.ts tests/chapter2Enemies.test.ts
git commit -m "feat(enemies): tower-disable pulse (Gravewail Cantor) + the five enemy defs

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Gate the five into Chapter 2+ waves

`buildWaves(n)` is only ever called with `n ≥ 11` (Chapter 1 uses `buildChapter1Waves`), so adding gated spawns here means the five appear **only from Chapter 2 onward**, staggered across stages 11–14.

**Files:**

- Modify: `src/data/stage.ts:167-252`
- Test: `tests/chapter2Enemies.test.ts`

- [ ] **Step 1: Write the failing wave-gating test**

Append to `tests/chapter2Enemies.test.ts`:

```ts
import { STAGES } from "../src/data/stage.ts";

/** All enemy ids spawned anywhere in a stage's waves. */
function stageEnemyIds(stageIndex: number): Set<string> {
  const s = STAGES[stageIndex]; // 0-based: index 10 = stage 11
  const ids = new Set<string>();
  for (const w of s.waves) for (const sp of w.spawns) ids.add(sp.enemyId);
  return ids;
}

describe("Escalation Five — chapter-2 gating", () => {
  it("never appears in any Chapter 1 stage (stages 1-10)", () => {
    const five = ["reaver", "prism", "carrier", "dreadwing", "cantor"];
    for (let i = 0; i < 10; i++) {
      const ids = stageEnemyIds(i);
      for (const f of five) expect(ids.has(f), `stage ${i + 1} should not have ${f}`).toBe(false);
    }
  });
  it("introduces Reaver + Dreadwing from stage 11", () => {
    const ids = stageEnemyIds(10); // stage 11
    expect(ids.has("reaver")).toBe(true);
    expect(ids.has("dreadwing")).toBe(true);
  });
  it("introduces Carrier by stage 12, Cantor by 13, Prism by 14", () => {
    expect(stageEnemyIds(11).has("carrier")).toBe(true); // stage 12
    expect(stageEnemyIds(12).has("cantor")).toBe(true); // stage 13
    expect(stageEnemyIds(13).has("prism")).toBe(true); // stage 14
  });
  it("by Chapter 3 (stage 16) all five are in rotation", () => {
    const ids = stageEnemyIds(15); // stage 16
    for (const f of ["reaver", "prism", "carrier", "dreadwing", "cantor"])
      expect(ids.has(f), f).toBe(true);
  });
});
```

- [ ] **Step 2: Run it — expect FAIL**

Run: `npx vitest run tests/chapter2Enemies.test.ts -t "gating"`
Expected: FAIL (ids absent).

- [ ] **Step 3: Gate the spawns in buildWaves**

In `src/data/stage.ts`, inside `buildWaves(n)`:

In the **wave 6** block, after the existing `if (n >= 6) w6.push(spawn("monolith", 1, 2.5, 5));` line and before `w.push({ spawns: w6 });`, add:

```ts
if (n >= 12) w6.push(spawn("carrier", 1 + Math.floor(n / 5), 1.5, 4)); // Bloomrot Carrier — space your towers
if (n >= 14) w6.push(spawn("prism", 1, 2.5, 6)); // Prism Behemoth — dual-type wall
```

In the **wave 7** block, after `if (n >= 6) w7.push(spawn("courier", 1, 1, 3));` and before `w.push({ spawns: w7 });`, add:

```ts
if (n >= 11) w7.push(spawn("reaver", 1 + Math.floor(n / 4), 2, 4)); // Bloodmad Reaver — burst it
```

In the **wave 8** block, after `if (n >= 6) w8.push(spawn("hexer", 1, 1, 5));` and before `w.push({ spawns: w8 });`, add:

```ts
if (n >= 11) w8.push(spawn("dreadwing", 1 + Math.floor(n / 5), 1.5, 3)); // Iron Dreadwing — heavy anti-air
if (n >= 13) w8.push(spawn("cantor", 1, 1, 6)); // Gravewail Cantor — priority kill
```

In the **wave 9** block, after `if (heavy) w9.push(spawn("golem", 1, 2.5, 4), spawn("monolith", 1, 2.5, 5));` and before `w.push({ spawns: w9 });`, add:

```ts
if (n >= 14) w9.push(spawn("prism", 1, 2.5, 6)); // capstone gauntlet wall
```

- [ ] **Step 4: Run the gating + existing wave tests — expect PASS**

Run: `npx vitest run tests/chapter2Enemies.test.ts tests/waveStructure.test.ts tests/chapter1Waves.test.ts tests/campaign.test.ts && npx tsc --noEmit`
Expected: all PASS (bosses still only on W5/W10; Chapter 1 untouched).

- [ ] **Step 5: Commit**

```bash
git add src/data/stage.ts tests/chapter2Enemies.test.ts
git commit -m "feat(enemies): stagger the Escalation Five into chapter 2+ waves

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Sprite art + manifest entries

The five must render. Match exactly how existing enemies declare art (single SDXL sprite → preload walk-bake), then generate art via the SDXL flow.

**Files:**

- Modify: `src/data/spriteManifest.ts`
- Create: PNGs under the enemy sprite asset directory.

- [ ] **Step 1: Inspect the existing enemy sprite contract**

Read `src/data/spriteManifest.ts` and find an existing `enemy__<id>` entry (e.g. `enemy__grunt`). Note: `path`, `frameWidth`, `frameHeight`, `frames`, `names`, and the on-disk asset location. Also read `src/scenes/enemyWalkBake.ts` to confirm the expected single-source-frame dimensions.

Run: `git ls-files public/assets | grep -i enem | head` to find where enemy PNGs live and their size.

- [ ] **Step 2: Decide art approach (match existing)**

- If existing enemies use a real generated PNG per enemy: generate a sprite for each of the five via the SDXL flow (`scripts/sdart/` — the z-image-turbo HTTP API at `127.0.0.1:8765/generate`), output at the SAME dimensions as existing enemy sprites, save to the same directory, then add a manifest entry per enemy mirroring the existing shape.
- If existing enemies all use a shared placeholder/coloured-shape render (no per-enemy PNG): add manifest entries that mirror that placeholder convention — do NOT invent a new art path. The five will render via the same fallback as the other 28.

Prompts (one per enemy, top-down readable game sprite, transparent/neutral background, consistent with roster):

- **reaver** — "frenzied armored berserker warrior, blood-red war paint, twin cleavers, hunched aggressive charge, dark fantasy game enemy sprite, top-down 3/4 view"
- **prism** — "massive crystalline golem behemoth, faceted prism armor shifting between blue and red light, slow and immense, dark fantasy enemy sprite, top-down 3/4 view"
- **carrier** — "bloated rotting plague-carrier, swollen sac of spores about to burst, sickly green, dark fantasy enemy sprite, top-down 3/4 view"
- **dreadwing** — "armored iron-plated winged drake gunship, heavy bomber wings, riveted metal, menacing, dark fantasy flying enemy sprite, top-down 3/4 view"
- **cantor** — "robed skeletal cantor priest wailing a dirge, ghostly sonic aura, tattered grave vestments, dark fantasy enemy sprite, top-down 3/4 view"

- [ ] **Step 3: Add manifest entries**

For each of the five, add a `SpriteEntry` to `BG`-style array in `src/data/spriteManifest.ts` mirroring the existing `enemy__<id>` entries exactly (same `kind: "enemy"`, frame dims, `frames`, `names`). Use `key: "enemy__reaver"`, etc., and set each enemy def's `artRef` accordingly **only if** existing enemies set a non-placeholder `artRef` (otherwise leave `artRef: "placeholder"` to match).

- [ ] **Step 4: Verify render in-engine**

Run: `npx tsc --noEmit && npm run build`
Expected: clean build. (Visual confirmation happens in Task 8's CDP playtest.)

- [ ] **Step 5: Commit**

```bash
git add src/data/spriteManifest.ts public/assets
git commit -m "feat(enemies): sprite art + manifest entries for the Escalation Five

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: Full verification, balance playtest, document

**Files:** none (verification) + memory update.

- [ ] **Step 1: Full typecheck + suite + build**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: tsc clean; ALL tests pass (the pre-existing count + the new files); build succeeds.

- [ ] **Step 2: File-size guard**

Run: `wc -l src/core/enemyFrenzy.ts src/core/enemyAdaptive.ts src/core/battleEnemies.ts src/core/battleDamage.ts src/data/enemies.ts src/data/stage.ts`
Expected: every file < 500 lines. If `battleEnemies.ts`, `battleDamage.ts`, `enemies.ts`, or `stage.ts` crossed 500, split per the house pattern before proceeding.

- [ ] **Step 3: CDP balance playtest (the spec's risk experiments)**

Launch the dev server (`setsid npm run dev > /tmp/dev.log 2>&1 < /dev/null &`), open the game with `?debug`, and via `window.__game` start a Chapter-2 stage (e.g. stage 14, which has all five). Verify the spec §8 risks:

1. **Prism is killable by a mono-type loadout** — it dies during off-phase windows (not a soft-lock).
2. **Carrier nova threatens but does not delete a fresh tower** — place a tower, kill a Carrier on it, read tower HP (should survive at lower HP). Tune `deathNova.damage` in `enemies.ts` if it one-shots.
3. **Cantor pulse is a window, not a lockout** — towers recover between pulses.
4. **Reaver frenzy is visible** — observe the speed spike when it drops below 50%.
5. **Stage 11 and 14 are clearable** by an intended roster (no impossible spike).

Capture a screenshot to `/tmp/chapter2-enemies.png`. Record findings; apply at most one tuning knob per issue (Numbers Policy §5: one knob at a time), re-run `npx vitest run`, and commit any tuning with a `balance(enemies):` message.

- [ ] **Step 4: Update memory**

Append a paragraph to `~/.claude/projects/-home-shyaken-Workplace-wibu-tower-defense/memory/project_enemy_tower_attack_rules.md` (or create `project_chapter2_elite_enemies.md` + an index line in `MEMORY.md`) recording: the five new enemies, their four new `EnemySpecial` mechanics + pure helpers (`enemyFrenzy.ts`, `enemyAdaptive.ts`), that they're gated into `buildWaves` at `n≥11..14` (campaign-only; endless untouched), and the CDP-verified balance findings. Link `[[project_chapter1_wave_design]]`, `[[project_wave_difficulty_ramp]]`, `[[feedback_difficulty_monotonic_law]]`.

- [ ] **Step 5: Final commit (if any tuning/docs changed)**

```bash
git add -A
git commit -m "docs(enemies): record Escalation Five + balance playtest findings

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:** §3.1 Reaver → Task 2+5; §3.2 Prism → Task 3+5; §3.3 Carrier → Task 4+5; §3.4 Dreadwing → Task 5 (reuse) ; §3.5 Cantor → Task 5; §5 staggered gating + monotonic law → Task 6 (+ guard tests for Chapter 1 untouched); §7 data contracts → Task 1; §8 risk experiments → Task 8 playtest; art/clarity → Task 1 (intel) + Task 7 (sprites). All covered.

**Placeholder scan:** No TBD/"handle edge cases"/"similar to" — every code step shows complete code. Task 7 has a documented conditional (match existing art convention) because the on-disk art state must be observed first; both branches are spelled out.

**Type consistency:** `EnemySpecial` fields (`frenzy`/`adaptiveImmunity`/`deathNova`/`towerDisablePulse`), runtime fields (`frenzied`/`adaptPhaseTimer`/`adaptPhaseIndex`/`disablePulseTimer`), and helper signatures (`shouldFrenzy`/`frenzyMods`/`adaptiveImmuneType`/`advanceAdaptivePhase`) are used identically across Tasks 1–6. Archetype keys (`Berserker`/`Adapter`/`Burster`/`Dreadnought`/`Disruptor`) match between enum, `ARCHETYPE_INFO`, and the enemy defs. `splash` FX event reused for all telegraphs (exists in `FxEvent`).
