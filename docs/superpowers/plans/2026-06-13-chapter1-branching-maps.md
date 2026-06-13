# Chapter 1 Branching Maps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign all 10 Chapter 1 stage maps as sophisticated, Kingdom-Rush-style multi-lane / branching layouts, driven by an optional `StageDef.lanes` consumed through one pure `groundLanes()` helper.

**Architecture:** A stage may declare several complete polylines (`lanes: Vec2[][]`) instead of one. A pure `groundLanes(stage)` returns the lane list with precedence `arena.routes > lanes > [path]`. The three runtime seams (enemy route pick, placement blocking, road render) already iterate a list of polylines for the maze arena; they switch to `groundLanes`. Chapter 1 layout data moves to a sibling `chapter1Layouts.ts` (mirrors `stagesExpansion.ts`) to keep `stage.ts` under the 500-line cap.

**Tech Stack:** TypeScript, Phaser 3, Vitest. Pure geometry modules + thin presenters. ESLint `max-lines 500` (skips blanks/comments). `npm run lint:cycles` (madge) must stay at 0 runtime cycles.

**Reference:** Design spec `docs/superpowers/specs/2026-06-13-chapter1-branching-maps-design.md`.

---

## Task 1: Pure `groundLanes()` helper

**Files:**
- Modify: `src/core/path.ts` (append helper)
- Test: `tests/path.test.ts` (append cases)

- [ ] **Step 1: Write the failing test**

Append to `tests/path.test.ts`:

```ts
import { dist, pathLength, pointAtDistance, groundLanes } from "../src/core/path.ts";

describe("groundLanes", () => {
  const path = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
  ];
  const lanes = [
    [{ x: 0, y: 0 }, { x: 5, y: 5 }],
    [{ x: 0, y: 9 }, { x: 5, y: 5 }],
  ];
  const routes = [[{ x: 1, y: 1 }, { x: 2, y: 2 }]];

  it("returns [path] for a single-lane stage", () => {
    expect(groundLanes({ path })).toEqual([path]);
  });

  it("returns lanes when present", () => {
    expect(groundLanes({ path, lanes })).toBe(lanes);
  });

  it("falls back to [path] for empty lanes", () => {
    expect(groundLanes({ path, lanes: [] })).toEqual([path]);
  });

  it("prefers arena routes over lanes and path", () => {
    expect(groundLanes({ path, lanes, arena: { routes } })).toBe(routes);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/path.test.ts`
Expected: FAIL — `groundLanes is not exported` / not a function.

- [ ] **Step 3: Write minimal implementation**

Append to `src/core/path.ts`:

```ts
/**
 * The ground lane(s) a stage's enemies walk and towers must avoid. Precedence:
 * the maze arena's corridors, else authored multi-lanes, else the single legacy
 * `path`. Pure — the three runtime seams (route pick, placement, render) share it.
 */
export function groundLanes(stage: {
  path: Vec2[];
  lanes?: Vec2[][];
  arena?: { routes: Vec2[][] } | undefined;
}): Vec2[][] {
  if (stage.arena) return stage.arena.routes;
  if (stage.lanes && stage.lanes.length > 0) return stage.lanes;
  return [stage.path];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/path.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/core/path.ts tests/path.test.ts
git commit -m "feat(maps): pure groundLanes() lane resolver

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Add `lanes` to the data model (types)

**Files:**
- Modify: `src/data/schema.ts` (`StageDef`)
- Modify: `src/data/stage.ts` (`Layout` interface)

No standalone test — these are type additions exercised by Task 3's data tests and `tsc`.

- [ ] **Step 1: Add `lanes` to `StageDef`**

In `src/data/schema.ts`, inside `interface StageDef`, immediately after the `path: Vec2[];` line, add:

```ts
  /**
   * Optional multi-lane / branching ground paths. When present, enemies are
   * distributed across these complete polylines (each edge→keep) instead of the
   * single `path`. `path` is kept equal to `lanes[0]` so the keep (last point)
   * and `castlePos` stay correct. Undefined for single-lane and arena stages.
   */
  lanes?: Vec2[][];
```

- [ ] **Step 2: Add `lanes` to `Layout`**

In `src/data/stage.ts`, inside `export interface Layout`, after `path: Vec2[];`, add:

```ts
  /** Optional extra ground lanes (each authored edge→keep). `path` mirrors lanes[0]. */
  lanes?: Vec2[][];
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (no new errors).

- [ ] **Step 4: Commit**

```bash
git add src/data/schema.ts src/data/stage.ts
git commit -m "feat(maps): StageDef.lanes + Layout.lanes fields

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Author the 10 redesigned Chapter 1 layouts + wire the builder

**Files:**
- Create: `src/data/chapter1Layouts.ts`
- Modify: `src/data/stage.ts` (replace inline `LAYOUTS`, scale `lanes`, set `path = lanes[0]`, terrain over all lanes)
- Test: `tests/stage.test.ts` (new)

- [ ] **Step 1: Write the failing data-invariant test**

Create `tests/stage.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { STAGES, WORLD_WIDTH, WORLD_HEIGHT } from "../src/data/stage.ts";
import { groundLanes } from "../src/core/path.ts";

// Lane count we expect per Chapter 1 stage (1-indexed). Matches the design table.
const CH1_LANE_COUNT = [1, 1, 2, 2, 2, 2, 2, 2, 2, 3];

function ch1(): typeof STAGES {
  return STAGES.slice(0, 10);
}

describe("Chapter 1 branching maps", () => {
  it("each stage exposes the designed number of ground lanes", () => {
    ch1().forEach((s, i) => {
      expect(groundLanes(s).length).toBe(CH1_LANE_COUNT[i]);
    });
  });

  it("path mirrors lanes[0] on multi-lane stages", () => {
    ch1().forEach((s) => {
      if (s.lanes && s.lanes.length > 0) expect(s.path).toEqual(s.lanes[0]);
    });
  });

  it("every lane has >=2 points and ends at the shared keep", () => {
    ch1().forEach((s) => {
      const keep = s.path[s.path.length - 1];
      for (const lane of groundLanes(s)) {
        expect(lane.length).toBeGreaterThanOrEqual(2);
        expect(lane[lane.length - 1]).toEqual(keep);
      }
    });
  });

  it("keeps every lane in-bounds of the world (allowing an off-screen entrance)", () => {
    ch1().forEach((s) => {
      for (const lane of groundLanes(s)) {
        for (const p of lane) {
          expect(p.x).toBeGreaterThanOrEqual(-60);
          expect(p.x).toBeLessThanOrEqual(WORLD_WIDTH + 60);
          expect(p.y).toBeGreaterThanOrEqual(-60);
          expect(p.y).toBeLessThanOrEqual(WORLD_HEIGHT + 60);
        }
      }
    });
  });

  it("generated terrain blocks none of the lanes", () => {
    function segDist(p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) {
      const dx = b.x - a.x, dy = b.y - a.y;
      const l2 = dx * dx + dy * dy || 1;
      let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2;
      t = Math.max(0, Math.min(1, t));
      return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
    }
    ch1().forEach((s) => {
      for (const f of s.terrain ?? []) {
        if (!f.blocks) continue;
        for (const lane of groundLanes(s)) {
          for (let i = 1; i < lane.length; i++) {
            expect(segDist(f, lane[i - 1], lane[i])).toBeGreaterThan(f.r);
          }
        }
      }
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/stage.test.ts`
Expected: FAIL — first assertion fails (stages 3–10 currently have 1 lane, not 2/3).

- [ ] **Step 3: Create `src/data/chapter1Layouts.ts` with the redesigned layouts**

All coordinates authored in the 960×540 logical space. Entrances at/near `x=-20`; **every lane ends at that stage's keep** (the last point of lane 0). Multi-lane stages merge into a shared tail before the keep.

```ts
/**
 * Chapter 1 — "Greywood Pass" — the ten redesigned, Kingdom-Rush-inspired map
 * layouts. Path complexity ramps monotonically: single-lane tutorials (1–2), a
 * first split (3), two-front lanes (4–9), and a three-entrance finale (10). Every
 * `lanes` entry is a complete edge→keep polyline; multi-lane stages share a tail
 * chokepoint before the keep. `path` is derived from `lanes[0]` by the stage
 * builder, so the keep / castlePos stay correct. Authored at 960×540 (scaled to
 * the world by stage.ts). Lives apart from stage.ts to respect the 500-line cap
 * (mirrors stagesExpansion.ts). See
 * docs/superpowers/specs/2026-06-13-chapter1-branching-maps-design.md.
 */
import type { Layout } from "./stage.ts";

export const CH1_LAYOUTS: Layout[] = [
  // 1 — Greywood Trailhead — single sinuous S, gentle switchbacks (tutorial).
  {
    name: "Greywood Trailhead",
    path: [
      { x: -20, y: 140 }, { x: 230, y: 140 }, { x: 230, y: 300 }, { x: 430, y: 300 },
      { x: 430, y: 150 }, { x: 640, y: 150 }, { x: 640, y: 400 }, { x: 780, y: 400 },
      { x: 780, y: 300 }, { x: 920, y: 300 },
    ],
    air: [{ x: -20, y: 70 }, { x: -20, y: 470 }],
    slots: [
      { x: 330, y: 220 }, { x: 540, y: 230 }, { x: 540, y: 380 }, { x: 700, y: 280 },
      { x: 160, y: 240 }, { x: 860, y: 200 },
    ],
  },
  // 2 — Switchback Gully — tighter serpentine, narrow build pockets (single).
  {
    name: "Switchback Gully",
    path: [
      { x: -20, y: 80 }, { x: 720, y: 80 }, { x: 720, y: 180 }, { x: 160, y: 180 },
      { x: 160, y: 290 }, { x: 740, y: 290 }, { x: 740, y: 400 }, { x: 360, y: 400 },
      { x: 360, y: 470 }, { x: 920, y: 470 },
    ],
    air: [{ x: -20, y: 260 }, { x: -20, y: 500 }],
    slots: [
      { x: 400, y: 130 }, { x: 440, y: 235 }, { x: 540, y: 345 }, { x: 600, y: 435 },
      { x: 240, y: 235 }, { x: 820, y: 360 },
    ],
  },
  // 3 — Twin Fords — FIRST split: two edge entrances ford to a shared keep.
  {
    name: "Twin Fords",
    path: [
      { x: -20, y: 110 }, { x: 250, y: 110 }, { x: 250, y: 250 }, { x: 520, y: 250 },
      { x: 700, y: 250 }, { x: 760, y: 290 }, { x: 920, y: 290 },
    ],
    lanes: [
      [
        { x: -20, y: 110 }, { x: 250, y: 110 }, { x: 250, y: 250 }, { x: 520, y: 250 },
        { x: 700, y: 250 }, { x: 760, y: 290 }, { x: 920, y: 290 },
      ],
      [
        { x: -20, y: 470 }, { x: 250, y: 470 }, { x: 250, y: 330 }, { x: 520, y: 330 },
        { x: 700, y: 330 }, { x: 760, y: 290 }, { x: 920, y: 290 },
      ],
    ],
    air: [{ x: -20, y: 290 }, { x: -20, y: 60 }],
    slots: [
      { x: 380, y: 200 }, { x: 380, y: 380 }, { x: 600, y: 200 }, { x: 600, y: 380 },
      { x: 150, y: 290 }, { x: 860, y: 230 },
    ],
  },
  // 4 — Hollow Stair — doubled descending staircase, late merge.
  {
    name: "Hollow Stair",
    path: [
      { x: -20, y: 60 }, { x: 180, y: 60 }, { x: 180, y: 160 }, { x: 380, y: 160 },
      { x: 380, y: 260 }, { x: 580, y: 260 }, { x: 580, y: 360 }, { x: 760, y: 360 },
      { x: 760, y: 440 }, { x: 920, y: 440 },
    ],
    lanes: [
      [
        { x: -20, y: 60 }, { x: 180, y: 60 }, { x: 180, y: 160 }, { x: 380, y: 160 },
        { x: 380, y: 260 }, { x: 580, y: 260 }, { x: 580, y: 360 }, { x: 760, y: 360 },
        { x: 760, y: 440 }, { x: 920, y: 440 },
      ],
      [
        { x: -20, y: 500 }, { x: 300, y: 500 }, { x: 300, y: 420 }, { x: 620, y: 420 },
        { x: 620, y: 440 }, { x: 760, y: 440 }, { x: 920, y: 440 },
      ],
    ],
    air: [{ x: -20, y: 280 }, { x: -20, y: 460 }],
    slots: [
      { x: 280, y: 110 }, { x: 480, y: 210 }, { x: 680, y: 310 }, { x: 460, y: 470 },
      { x: 120, y: 320 }, { x: 860, y: 380 },
    ],
  },
  // 5 — Serpent Bend — long double serpentine, lanes merge at the low bend.
  {
    name: "Serpent Bend",
    path: [
      { x: -20, y: 110 }, { x: 680, y: 110 }, { x: 680, y: 230 }, { x: 160, y: 230 },
      { x: 160, y: 300 }, { x: 780, y: 300 }, { x: 920, y: 300 },
    ],
    lanes: [
      [
        { x: -20, y: 110 }, { x: 680, y: 110 }, { x: 680, y: 230 }, { x: 160, y: 230 },
        { x: 160, y: 300 }, { x: 780, y: 300 }, { x: 920, y: 300 },
      ],
      [
        { x: -20, y: 470 }, { x: 680, y: 470 }, { x: 680, y: 360 }, { x: 160, y: 360 },
        { x: 160, y: 300 }, { x: 780, y: 300 }, { x: 920, y: 300 },
      ],
    ],
    air: [{ x: -20, y: 290 }, { x: -20, y: 60 }],
    slots: [
      { x: 360, y: 160 }, { x: 540, y: 160 }, { x: 360, y: 415 }, { x: 540, y: 415 },
      { x: 400, y: 265 }, { x: 860, y: 250 },
    ],
  },
  // 6 — Quarry Descent — two ramps down opposite sides into one quarry floor.
  {
    name: "Quarry Descent",
    path: [
      { x: -20, y: 90 }, { x: 220, y: 90 }, { x: 220, y: 300 }, { x: 460, y: 300 },
      { x: 460, y: 430 }, { x: 920, y: 430 },
    ],
    lanes: [
      [
        { x: -20, y: 90 }, { x: 220, y: 90 }, { x: 220, y: 300 }, { x: 460, y: 300 },
        { x: 460, y: 430 }, { x: 920, y: 430 },
      ],
      [
        { x: -20, y: 200 }, { x: 120, y: 200 }, { x: 120, y: 430 }, { x: 460, y: 430 },
        { x: 920, y: 430 },
      ],
    ],
    air: [{ x: -20, y: 470 }, { x: -20, y: 320 }],
    slots: [
      { x: 340, y: 200 }, { x: 600, y: 360 }, { x: 740, y: 360 }, { x: 600, y: 500 },
      { x: 320, y: 380 }, { x: 860, y: 360 },
    ],
  },
  // 7 — Cinder Crossroads — the lanes literally cross (an X) then merge.
  {
    name: "Cinder Crossroads",
    path: [
      { x: -20, y: 120 }, { x: 360, y: 120 }, { x: 600, y: 420 }, { x: 780, y: 300 },
      { x: 920, y: 270 },
    ],
    lanes: [
      [
        { x: -20, y: 120 }, { x: 360, y: 120 }, { x: 600, y: 420 }, { x: 780, y: 300 },
        { x: 920, y: 270 },
      ],
      [
        { x: -20, y: 420 }, { x: 360, y: 420 }, { x: 600, y: 120 }, { x: 780, y: 300 },
        { x: 920, y: 270 },
      ],
    ],
    air: [{ x: -20, y: 270 }, { x: -20, y: 500 }],
    slots: [
      { x: 300, y: 250 }, { x: 660, y: 250 }, { x: 480, y: 160 }, { x: 480, y: 380 },
      { x: 200, y: 280 }, { x: 860, y: 240 },
    ],
  },
  // 8 — Mistgrove Loop — shared head forks into a loop, then rejoins.
  {
    name: "Mistgrove Loop",
    path: [
      { x: -20, y: 280 }, { x: 200, y: 280 }, { x: 200, y: 110 }, { x: 620, y: 110 },
      { x: 620, y: 280 }, { x: 780, y: 280 }, { x: 920, y: 280 },
    ],
    lanes: [
      [
        { x: -20, y: 280 }, { x: 200, y: 280 }, { x: 200, y: 110 }, { x: 620, y: 110 },
        { x: 620, y: 280 }, { x: 780, y: 280 }, { x: 920, y: 280 },
      ],
      [
        { x: -20, y: 280 }, { x: 200, y: 280 }, { x: 200, y: 450 }, { x: 620, y: 450 },
        { x: 620, y: 280 }, { x: 780, y: 280 }, { x: 920, y: 280 },
      ],
    ],
    air: [{ x: -20, y: 100 }, { x: -20, y: 460 }],
    slots: [
      { x: 410, y: 200 }, { x: 410, y: 360 }, { x: 410, y: 280 }, { x: 700, y: 200 },
      { x: 700, y: 360 }, { x: 860, y: 240 },
    ],
  },
  // 9 — Broken Aqueduct — high straight aqueduct + low winding collapse, merge.
  {
    name: "Broken Aqueduct",
    path: [
      { x: -20, y: 90 }, { x: 760, y: 90 }, { x: 760, y: 250 }, { x: 920, y: 250 },
    ],
    lanes: [
      [
        { x: -20, y: 90 }, { x: 760, y: 90 }, { x: 760, y: 250 }, { x: 920, y: 250 },
      ],
      [
        { x: -20, y: 460 }, { x: 180, y: 460 }, { x: 180, y: 330 }, { x: 420, y: 330 },
        { x: 420, y: 460 }, { x: 660, y: 460 }, { x: 660, y: 250 }, { x: 760, y: 250 },
        { x: 920, y: 250 },
      ],
    ],
    air: [{ x: -20, y: 260 }, { x: -20, y: 500 }],
    slots: [
      { x: 300, y: 180 }, { x: 520, y: 180 }, { x: 300, y: 400 }, { x: 540, y: 390 },
      { x: 120, y: 230 }, { x: 860, y: 200 },
    ],
  },
  // 10 — Wardens' Gate — three entrances funnel through to one final gate.
  {
    name: "Wardens' Gate",
    path: [
      { x: -20, y: 90 }, { x: 300, y: 90 }, { x: 300, y: 200 }, { x: 640, y: 200 },
      { x: 640, y: 270 }, { x: 780, y: 270 }, { x: 920, y: 270 },
    ],
    lanes: [
      [
        { x: -20, y: 90 }, { x: 300, y: 90 }, { x: 300, y: 200 }, { x: 640, y: 200 },
        { x: 640, y: 270 }, { x: 780, y: 270 }, { x: 920, y: 270 },
      ],
      [
        { x: -20, y: 270 }, { x: 300, y: 270 }, { x: 640, y: 270 }, { x: 780, y: 270 },
        { x: 920, y: 270 },
      ],
      [
        { x: -20, y: 450 }, { x: 300, y: 450 }, { x: 300, y: 340 }, { x: 640, y: 340 },
        { x: 640, y: 270 }, { x: 780, y: 270 }, { x: 920, y: 270 },
      ],
    ],
    air: [{ x: -20, y: 160 }, { x: -20, y: 380 }],
    slots: [
      { x: 460, y: 140 }, { x: 460, y: 400 }, { x: 200, y: 200 }, { x: 200, y: 340 },
      { x: 720, y: 200 }, { x: 720, y: 340 },
    ],
  },
];
```

- [ ] **Step 4: Wire `stage.ts` to the extracted layouts, scale lanes, derive `path`, terrain over all lanes**

In `src/data/stage.ts`:

(a) Add the import near the other data imports (after the `buildChapter1Waves` import):

```ts
import { CH1_LAYOUTS } from "./chapter1Layouts.ts";
```

(b) Delete the entire inline `const LAYOUTS: Layout[] = [ ... ];` array (the ~255-line block from `const LAYOUTS` through its closing `];`) and replace it with:

```ts
const LAYOUTS: Layout[] = CH1_LAYOUTS;
```

(c) Change `generateTerrain` to keep **all** lanes clear. Replace its signature line and the `nearPath` call:

Old:
```ts
function generateTerrain(
  path: Vec2[],
  seed: number,
  block: TerrainType[],
  decor: TerrainType[],
): TerrainFeature[] {
```
New:
```ts
function generateTerrain(
  lanes: Vec2[][],
  seed: number,
  block: TerrainType[],
  decor: TerrainType[],
): TerrainFeature[] {
```

Old (inside the while loop):
```ts
    if (nearPath({ x, y }, path, r + 30)) continue; // keep the lane walkable + buildable beside it
```
New:
```ts
    // keep every lane walkable + buildable beside it
    if (lanes.some((lane) => nearPath({ x, y }, lane, r + 30))) continue;
```

(d) In the `STAGES` builder, scale lanes, derive `path` from `lanes[0]`, and pass all lanes to terrain. Replace the builder body:

Old:
```ts
export const STAGES: StageDef[] = ALL_LAYOUTS.map((l, i) => {
  const id = stageIdFor(i + 1);
  const path = l.path.map(scaleV);
  const theme = stageThemeForStage(id);
  return {
    id,
    name: l.name,
    path,
    airSpawns: l.air.map(scaleV),
    castleHp: 15,
    startingGold: 170 + i * 10,
    towerSlots: l.slots.map(scaleV),
    terrain: generateTerrain(path, i + 1, theme.block, theme.decor),
    // Chapter 1 (stages 1–10) uses the hand-tuned per-stage arc; chapters 2–5
    // keep the procedural builder.
    waves:
      i < 10
        ? buildChapter1Waves(i + 1, BOSS_BY_STAGE[i] ?? "overlord", midBossFor(i + 1))
        : buildWaves(i + 1),
  };
});
```
New:
```ts
export const STAGES: StageDef[] = ALL_LAYOUTS.map((l, i) => {
  const id = stageIdFor(i + 1);
  // Scale authored lanes (if any) to world units; `path` mirrors lanes[0] so the
  // keep (last point) and castlePos stay correct. Single-lane stages keep `path`
  // and omit `lanes`.
  const lanes = l.lanes?.map((lane) => lane.map(scaleV));
  const path = lanes ? lanes[0] : l.path.map(scaleV);
  const theme = stageThemeForStage(id);
  return {
    id,
    name: l.name,
    path,
    lanes,
    airSpawns: l.air.map(scaleV),
    castleHp: 15,
    startingGold: 170 + i * 10,
    towerSlots: l.slots.map(scaleV),
    terrain: generateTerrain(lanes ?? [path], i + 1, theme.block, theme.decor),
    // Chapter 1 (stages 1–10) uses the hand-tuned per-stage arc; chapters 2–5
    // keep the procedural builder.
    waves:
      i < 10
        ? buildChapter1Waves(i + 1, BOSS_BY_STAGE[i] ?? "overlord", midBossFor(i + 1))
        : buildWaves(i + 1),
  };
});
```

- [ ] **Step 5: Run the data test to verify it passes**

Run: `npx vitest run tests/stage.test.ts`
Expected: PASS (all 5 cases). If "terrain blocks a lane" fails for a stage, the generator already pads by `r + 30`; a failure means a lane point is off — re-check that stage's coordinates against the keep.

- [ ] **Step 6: Typecheck + lint the touched files**

Run: `npx tsc --noEmit && npx eslint src/data/stage.ts src/data/chapter1Layouts.ts && npx prettier --check src/data/stage.ts src/data/chapter1Layouts.ts`
Expected: PASS. (If `stage.ts` trips `max-lines`, the layout extraction already removed ~255 lines — it will be well under.) If Prettier reports formatting, run `npx prettier --write` on the two files and re-stage.

- [ ] **Step 7: Commit**

```bash
git add src/data/chapter1Layouts.ts src/data/stage.ts tests/stage.test.ts
git commit -m "feat(maps): redesigned multi-lane Chapter 1 layouts

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Distribute enemies across lanes (route selection)

**Files:**
- Modify: `src/core/battleWaves.ts:280-285`
- Test: `tests/battleArena.test.ts` (append a campaign-lanes case; it already has the harness)

- [ ] **Step 1: Write the failing test**

Append to `tests/battleArena.test.ts` (it already imports `BattleState`, `makeStats`, `enemy`, `turret`, `inertHero`, `cat`). Add a helper stage + test inside the existing file, after the `arenaStage` helper:

```ts
function twoLaneStage(waves: WaveDef[]): StageDef {
  const laneA = [
    { x: 0, y: 100 },
    { x: 600, y: 100 },
    { x: 600, y: 360 },
  ];
  const laneB = [
    { x: 0, y: 620 },
    { x: 600, y: 620 },
    { x: 600, y: 360 },
  ];
  return {
    id: "ch1-s3",
    name: "TwoLane",
    path: laneA,
    lanes: [laneA, laneB],
    airSpawns: [{ x: 0, y: 360 }],
    castleHp: 1000,
    startingGold: 0,
    towerSlots: [],
    terrain: [],
    waves,
  };
}
```

And the test:

```ts
describe("campaign multi-lane routing", () => {
  it("spreads ground enemies across both authored lanes", () => {
    const stage = twoLaneStage([
      { spawns: [{ enemyId: "grunt", count: 40, interval: 0.05, delay: 0 }] },
    ]);
    const b = new BattleState(stage, cat(enemy(), turret()), { hero: inertHero, seed: 7 });
    for (let i = 0; i < 160; i++) b.tick(0.05);
    const starts = new Set(b.enemies.map((e) => `${e.route[0].x},${e.route[0].y}`));
    expect(starts.size).toBe(2); // both lane entrances used
    for (const e of b.enemies) {
      const end = e.route[e.route.length - 1];
      expect(end).toEqual({ x: 600, y: 360 }); // every lane ends at the shared keep
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/battleArena.test.ts -t "spreads ground enemies"`
Expected: FAIL — `starts.size` is 1 (all enemies use `stage.path`, lanes ignored).

- [ ] **Step 3: Implement lane-aware route selection with the determinism guard**

In `src/core/battleWaves.ts`, add the import (extend the existing import from `../core/path` / `./path`):

Find the existing path import (it already imports `pathLength`, `pointAtDistance`, `lerp`) and add `groundLanes`:

```ts
import { groundLanes, lerp, pathLength, pointAtDistance } from "./path.ts";
```
(Match the existing relative path and keep the other named imports; only add `groundLanes`.)

Then replace the `route` selection block:

Old:
```ts
    const flying = def.flying;
    const arena = this.stage.arena;
    // Arena: ground enemies pick a random precomputed corridor; flyers beeline the
    // center from a random gate. Campaign: the single shared lane / round-robin air.
    const route =
      req.route ??
      (arena ? arena.routes[Math.floor(this.rng.next() * arena.routes.length)] : this.stage.path);
```
New:
```ts
    const flying = def.flying;
    const arena = this.stage.arena;
    // Ground enemies pick a lane: a maze corridor, an authored campaign lane, or
    // the single legacy path. Only draw from the RNG when there's a real choice,
    // so single-lane stages stay byte-for-byte deterministic. Flyers beeline the
    // keep from a random gate (arena) or round-robin air spawn (campaign).
    const lanes = groundLanes(this.stage);
    const route =
      req.route ??
      (lanes.length > 1 ? lanes[Math.floor(this.rng.next() * lanes.length)] : lanes[0]);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/battleArena.test.ts`
Expected: PASS (new case + the existing maze-arena cases still pass, since `groundLanes` returns `arena.routes` and the RNG draw is unchanged for arenas).

- [ ] **Step 5: Commit**

```bash
git add src/core/battleWaves.ts tests/battleArena.test.ts
git commit -m "feat(maps): distribute campaign enemies across authored lanes

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Block tower placement on every lane

**Files:**
- Modify: `src/core/battlePlacement.ts:59-65`
- Test: `tests/free-placement.test.ts` (append a 2-lane case) — confirm import surface first

- [ ] **Step 1: Write the failing test**

Open `tests/free-placement.test.ts` and look at the top to reuse its existing stage-builder / imports. Append a focused test. If the file builds stages inline, add:

```ts
import { groundLanes } from "../src/core/path.ts";

describe("placement blocks all campaign lanes", () => {
  it("rejects a spot sitting on the second lane", () => {
    // Minimal 2-lane stage; second lane runs along y=620.
    const laneA = [
      { x: 0, y: 100 },
      { x: 600, y: 100 },
      { x: 600, y: 360 },
    ];
    const laneB = [
      { x: 0, y: 620 },
      { x: 600, y: 620 },
      { x: 600, y: 360 },
    ];
    const stage = {
      id: "ch1-s3",
      name: "TwoLane",
      path: laneA,
      lanes: [laneA, laneB],
      airSpawns: [{ x: 0, y: 360 }],
      castleHp: 1000,
      startingGold: 999,
      towerSlots: [],
      terrain: [],
      waves: [{ spawns: [] }],
    } as unknown as import("../src/data/schema.ts").StageDef;
    const b = new BattleState(stage, cat(enemy(), turret()), { hero: inertHero });
    expect(groundLanes(stage).length).toBe(2);
    // A point dead on lane B (y=620) must be blocked.
    expect(b.canPlaceAt({ x: 300, y: 620 })).toBe(false);
    // A point clear of both lanes is allowed.
    expect(b.canPlaceAt({ x: 300, y: 360 })).toBe(true);
  });
});
```

> NOTE: reuse the file's existing `enemy`, `turret`, `cat`, `inertHero` fixtures. If `tests/free-placement.test.ts` does not export/define them, copy the small fixtures from `tests/battleArena.test.ts` (lines 13–66) into this describe block instead. Verify the exact fixture names in the file before running.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/free-placement.test.ts -t "rejects a spot sitting on the second lane"`
Expected: FAIL — lane B is not blocked (placement only checks `stage.path` = lane A), so `canPlaceAt({x:300,y:620})` returns `true`.

- [ ] **Step 3: Implement lane-aware placement blocking**

In `src/core/battlePlacement.ts`, add `groundLanes` to the existing path import (it imports `dist`, maybe `segDist` locally). Find the import line from `./path.ts` (or the local `segDist`) and ensure `groundLanes` is imported from `../core/path.ts`/`./path.ts`:

```ts
import { groundLanes } from "../core/path.ts";
```
(Use the same relative path style as the file's other `../core/...` imports.)

Then replace the roads line in `canPlaceAt`:

Old:
```ts
    // Block placement on ANY road: the single campaign lane, or every arena corridor.
    const roads = this.stage.arena ? this.stage.arena.routes : [this.stage.path];
```
New:
```ts
    // Block placement on ANY road: every authored lane / arena corridor (or the
    // single legacy path). One source of truth shared with routing + rendering.
    const roads = groundLanes(this.stage);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/free-placement.test.ts`
Expected: PASS (new case + all existing placement cases).

- [ ] **Step 5: Commit**

```bash
git add src/core/battlePlacement.ts tests/free-placement.test.ts
git commit -m "feat(maps): block tower placement on every lane

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Render every lane

**Files:**
- Modify: `src/scenes/battleSceneRender.ts:510-519`

No unit test — this is Phaser draw code, covered by the build + the headless playtest in Task 7.

- [ ] **Step 1: Use `groundLanes` for the road list**

In `src/scenes/battleSceneRender.ts`, add `groundLanes` to the existing import from `../core/path.ts` (the file already imports path helpers; if not, add the import). Then replace:

Old:
```ts
    // roads: the single campaign lane, or every corridor of the maze arena.
    const roads = this.stage.arena ? this.stage.arena.routes : [this.stage.path];
```
New:
```ts
    // roads: every authored lane / arena corridor (or the single legacy path).
    const roads = groundLanes(this.stage);
```

Leave the arena-gates block below it unchanged (still gated on `this.stage.arena`).

- [ ] **Step 2: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS (clean build).

- [ ] **Step 3: Commit**

```bash
git add src/scenes/battleSceneRender.ts
git commit -m "feat(maps): render every authored lane

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Full verification, playtest, memory

**Files:**
- Modify: memory (`memory/project_chapter1_wave_design.md` cross-link or a new `memory/project_chapter1_branching_maps.md` + `MEMORY.md` index line)

- [ ] **Step 1: Full verification gate**

Run each and confirm output:
```bash
npx tsc --noEmit
npx vitest run
npx eslint src/ tests/
npx prettier --check "src/**/*.ts" "tests/**/*.ts"
npm run lint:cycles
npm run build
```
Expected: `tsc` clean; vitest all green **except** the known pre-existing unrelated `firebaseCachePolicy` failure (confirm it is the ONLY failure and is unrelated to maps); ESLint clean; Prettier clean; madge 0 runtime cycles; build clean.

- [ ] **Step 2: Headless playtest of a branching stage**

Render the in-battle view of a 2-lane and the 3-lane stage to confirm the roads draw and merge visually:
```bash
bash scripts/playtest/snap.sh --scene=BattleScene --stage=ch1-s7 --out=/tmp/map_s7.png --wait=16000 || \
bash scripts/playtest/snap.sh --scene=MainMenuScene --out=/tmp/home.png --wait=16000
```
(If `BattleScene` can't be deep-linked with a stage arg, fall back to driving via `window.__game` as in `reference_playtest_and_art`, or snap `StageSelectScene`. Confirm the PNG is a real render, not the blank loader, by file size > 100KB.) Visually verify: multiple lanes drawn, lanes merge into one keep approach, no tower-blocked-everywhere artifact.

- [ ] **Step 3: Write memory**

Create `memory/project_chapter1_branching_maps.md`:
```markdown
---
name: project_chapter1_branching_maps
description: Chapter 1 maps are multi-lane/branching via StageDef.lanes resolved through pure groundLanes()
metadata:
  type: project
---

Chapter 1's 10 maps were redesigned 2026-06-13 into Kingdom-Rush-style multi-lane
layouts. A stage may declare `lanes: Vec2[][]` (each a complete edge→keep
polyline); `path` is derived from `lanes[0]` by the STAGES builder so castlePos
stays correct. Lane complexity ramps monotonically: single (1–2), two-lane
(3–9), three-entrance finale (10). Multi-lane stages merge into a shared tail
before the keep.

- **One resolver:** `groundLanes(stage)` in `src/core/path.ts` — precedence
  `arena.routes > lanes > [path]`. The THREE seams consume it: route pick
  (`battleWaves.ts`), placement block (`battlePlacement.ts`), road render
  (`battleSceneRender.ts`). Don't reintroduce inline `arena ? routes : [path]`.
- **Determinism guard:** route pick only draws RNG when `lanes.length > 1`, so
  single-lane stages stay byte-for-byte deterministic (don't remove the guard).
- Layout DATA lives in `src/data/chapter1Layouts.ts` (CH1_LAYOUTS) — extracted
  from stage.ts to respect the 500-line cap (mirrors stagesExpansion.ts).
- NOT a path graph: lanes are independent polylines; "forks/merges" are authored
  by overlapping geometry. Endless maze arena is untouched. See
  [[project_endless_maze_arena]], [[project_chapter1_wave_design]].
Spec/plan: docs/superpowers/{specs,plans}/2026-06-13-chapter1-branching-maps*.
```

Add to `memory/MEMORY.md`:
```
- [Chapter 1 branching maps](project_chapter1_branching_maps.md) — ch1 maps are multi-lane/branching via StageDef.lanes resolved through ONE pure groundLanes() (arena.routes>lanes>[path]); 3 seams consume it; RNG-guarded for single-lane determinism; data in chapter1Layouts.ts; NOT a path graph
```

- [ ] **Step 4: Commit**

```bash
git add memory/project_chapter1_branching_maps.md memory/MEMORY.md
git commit -m "docs(memory): chapter 1 branching maps

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review Notes

- **Spec coverage:** groundLanes (T1) ✓; schema/Layout fields (T2) ✓; 10 redesigned layouts + builder + terrain-over-all-lanes (T3) ✓; route distribution + determinism guard (T4) ✓; placement over all lanes (T5) ✓; render all lanes (T6) ✓; verify/playtest/memory (T7) ✓. Rejected Phaser-tilemap & path-graph noted in spec, intentionally no task.
- **No placeholders:** every code step shows full code; commands have expected output.
- **Type consistency:** `groundLanes(stage)` signature identical across T1/T4/T5/T6; `lanes?: Vec2[][]` on both `StageDef` and `Layout`; `path = lanes[0]` invariant enforced in the builder and asserted in T3.
- **Cap risk:** T3 extracts ~255 lines of layout data out of `stage.ts` into `chapter1Layouts.ts`, so `stage.ts` shrinks well under 500; new file is data (ESLint skips blanks/comments).
- **Determinism:** guard keeps single-lane stages RNG-neutral (no existing seeded test breaks); arena path unchanged (returns `arena.routes` first).
