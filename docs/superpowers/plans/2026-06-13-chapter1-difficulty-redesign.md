# Chapter 1 Difficulty Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework chapter 1's authored wave plans + generator so the chapter is meaningfully harder (earlier walls, stacked supports, faster cadence, denser waves) without touching any engine scaling layer, and add guard tests proving the monotonic difficulty law still holds.

**Architecture:** All gameplay change lives in `src/data/chapter1Waves.ts` (the hand-authored layer). `CH1_PLANS` gains a `support2` slot and a meaner composition curve; the generator gains a per-stage cadence multiplier and steeper density formulas. Tests gain a feature-neutral "chassis threat" monotonicity guard plus a chapter-ordering guard against procedural stage 11 (via exported `STAGES` + `progressionScaling`). Spec: `docs/superpowers/specs/2026-06-13-chapter1-difficulty-redesign-design.md`.

**Tech Stack:** TypeScript, Vitest. Verification: `npm test`, `npm run typecheck`, `npm run lint`, `npm run lint:cycles`, `npm run format:check`, CDP playtest.

---

### Task 1: Guard tests first (TDD red)

**Files:**

- Modify: `tests/chapter1Waves.test.ts`

- [ ] **Step 1: Add the new failing tests**

Append imports at the top of `tests/chapter1Waves.test.ts`:

```ts
import { progressionScaling } from "../src/core/progressionScaling.ts";
import { CH1_PLANS } from "../src/data/chapter1Waves.ts";
import { STAGES as STAGE_DEFS } from "../src/data/stage.ts";
```

Add below `trashThreat`:

```ts
/** Trash threat excluding the stage's featured archetype — the stage "chassis".
 *  Features rotate (gargoyle 58 ehp vs bulwark 250 ehp), so raw threat zig-zags
 *  by design; the chassis is what must grow strictly stage over stage. */
const chassisThreat = (waves: WaveDef[], feature: string) =>
  waves.reduce(
    (t, w) =>
      t +
      w.spawns
        .filter((s) => !isBoss(s.enemyId) && s.enemyId !== feature)
        .reduce((u, s) => u + s.count * ehp(s.enemyId), 0),
    0,
  );

const stageThreat = (waves: WaveDef[]) => waves.reduce((t, w) => t + trashThreat(w), 0);
```

Add new `it` blocks inside the existing `describe`:

```ts
it("walls are permanent from stage 5 and supports from stage 3 (composition curve)", () => {
  for (const n of STAGES) {
    const p = CH1_PLANS[n - 1];
    expect(p.wall !== null, `stage ${n} wall`).toBe(n >= 5);
    expect(p.support !== null, `stage ${n} support`).toBe(n >= 3);
    expect(p.support2 !== null, `stage ${n} support2`).toBe(n >= 9);
  }
});

it("scaled chassis threat strictly increases stage over stage (monotonic law)", () => {
  const scaled = STAGES.map(
    (n) => chassisThreat(wavesFor(n), CH1_PLANS[n - 1].feature) * progressionScaling(n).hpMult,
  );
  for (let i = 1; i < scaled.length; i++) {
    expect(scaled[i], `stage ${i + 1} vs ${i}`).toBeGreaterThan(scaled[i - 1]);
  }
});

it("a harder stage 10 still sits below procedural stage 11 (chapter ordering)", () => {
  const s10 = stageThreat(wavesFor(10)) * progressionScaling(10).hpMult;
  const s11 = stageThreat(STAGE_DEFS[10].waves) * progressionScaling(11).hpMult;
  expect(s10).toBeLessThan(s11);
});

it("later stages spawn faster (cadence pressure), stage 1 keeps the tutorial pace", () => {
  const i1 = wavesFor(1)[0].spawns[0].interval ?? 1;
  const i10 = wavesFor(10)[0].spawns[0].interval ?? 1;
  expect(i1).toBeCloseTo(1.0, 5);
  expect(i10).toBeLessThanOrEqual(0.56);
});
```

- [ ] **Step 2: Run, verify the new tests fail** (no `CH1_PLANS` export, no `support2`, no cadence): `npx vitest run tests/chapter1Waves.test.ts` → FAIL.

### Task 2: Redesigned plans + generator (TDD green)

**Files:**

- Modify: `src/data/chapter1Waves.ts`

- [ ] **Step 1: Rework `Ch1Plan`/`CH1_PLANS` and the generator**

`Ch1Plan` gains `support2: string | null`; `CH1_PLANS` becomes exported with the spec's table (walls golem/monolith/monolith/golem on S5–8, both + dual supports on S9–10; supports herald/mender/herald/mender/summoner/hexer per spec). Add the cadence helper and apply the spec's density formulas (full code in the spec §1–3; the generator below is authoritative):

```ts
export const CH1_PLANS: Ch1Plan[] = [
  { feature: "grunt", wall: null, wall2: null, support: null, support2: null }, // 1
  { feature: "gargoyle", wall: null, wall2: null, support: null, support2: null }, // 2
  { feature: "bulwark", wall: null, wall2: null, support: "herald", support2: null }, // 3
  { feature: "slime", wall: null, wall2: null, support: "mender", support2: null }, // 4
  { feature: "regenerator", wall: "golem", wall2: null, support: "herald", support2: null }, // 5
  { feature: "sapper", wall: "monolith", wall2: null, support: "mender", support2: null }, // 6
  { feature: "phantom", wall: "monolith", wall2: null, support: "summoner", support2: null }, // 7
  { feature: "stormflyer", wall: "golem", wall2: null, support: "hexer", support2: null }, // 8
  {
    feature: "regenerator",
    wall: "golem",
    wall2: "monolith",
    support: "hexer",
    support2: "summoner",
  }, // 9
  { feature: "phantom", wall: "golem", wall2: "monolith", support: "summoner", support2: "hexer" }, // 10
];

/** Spawn-interval multiplier: ×1.0 on stage 1 → ×0.55 on stage 10 (overlap pressure). */
const cadence = (n: number) => Math.max(0.55, 1 - 0.05 * (n - 1));
```

Generator waves (W1–W10), with `const c = cadence(n)` and every interval multiplied by `c` (delays untouched):

- W1 `spawn("grunt", 4 + Math.ceil(0.7 * d), 1.0 * c)`
- W2 grunt `4+⌊d/2⌋ @0.9c`, feature `2+⌈0.7d⌉ @1.2c d3`
- W3 brute `1+⌊d/2⌋`, bulwark `1+⌊d/3⌋`, feature `2+⌊d/2⌋`
- W4 runner `8+d @0.5c`, gargoyle `2+⌊d/2⌋`, plus slime `1+⌊d/4⌋ @1.3c d3` when `d>=4`
- W5 grunt 5, brute `1+⌊d/3⌋`, feature `2+⌊d/3⌋ @1.1c d3`, midBoss
- W6 grunt `7+d`, feature `2+⌊d/2⌋`, wall count `d>=9 ? 2 : 1`
- W7 runner `9+d`, raider `1+⌊d/2⌋`, feature `2+⌊d/2⌋`, plus sapper `1+⌊d/3⌋ @1.5c d4` when `d>=6`
- W8 gargoyle `3+⌈0.7d⌉`, stormflyer `1+⌊d/2⌋`, feature `2+⌊d/2⌋`, support
- W9 brute `4+⌈0.7d⌉`, regenerator `2+⌊d/2⌋`, bulwark `2+⌊d/3⌋`, feature `3+⌈0.7d⌉`, wall, wall2, support, support2 `@1 d5`
- W10 grunt 6, brute `2+⌊d/3⌋`, feature `2+⌊d/2⌋`, regenerator `1+⌊d/3⌋ @1.4c d3`, bulwark `1+⌊d/4⌋ @1.5c d4`, wall, wall2 `@2.5 d7`, support when `n>=7 @1 d6`, finalBoss `d12`

Update the header comment to describe the meaner curve (walls permanent from S5, dual supports S9–10, cadence knob).

- [ ] **Step 2: Run the chapter-1 suite** `npx vitest run tests/chapter1Waves.test.ts tests/waveStructure.test.ts` → PASS (incl. pre-existing W1-min/W9-max, 3× gauntlet, dual-wall checks). If the chapter-ordering guard is red, lower W9 growth (`4+⌈0.7d⌉` → `4+⌊d/2⌋` brutes) until green — record the final numbers.
- [ ] **Step 3: Full gauntlet** `npm test && npm run typecheck && npm run lint && npm run lint:cycles && npm run format:check`.
- [ ] **Step 4: Commit** `feat(data): chapter-1 difficulty redesign — earlier walls, dual supports, cadence + density`

### Task 3: Playtest + memory

- [ ] **Step 1: CDP playtest** stage 1 (must stay clearable on Normal) and stage 9/10 (visible overlap pressure, dual walls + supports present). Screenshot evidence; PAGE ERRORS [].
- [ ] **Step 2: Update memory** `project_chapter1_wave_design.md` to describe the redesigned curve (support2, cadence knob, permanent walls from S5).
- [ ] **Step 3: Commit any remaining docs/memory deltas; final `git log` check.**
