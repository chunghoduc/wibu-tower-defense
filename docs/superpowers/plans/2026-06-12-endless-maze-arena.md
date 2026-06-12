# Endless Maze Arena Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give endless mode its own battlefield — a central castle besieged from multiple directions through a braided maze of roads, with enemies taking varied precomputed paths to the core. Campaign stages are untouched.

**Architecture:** A deterministic pure module (`mazeArena.ts`) carves a braided grid maze with the castle at the center cell and computes multiple gate→center corridor routes. A new optional `StageDef.arena` field carries this. Each enemy gets a per-enemy `route`/`routeLen` (campaign enemies use `stage.path`, byte-for-byte unchanged); arena enemies pick a random corridor. The castle moves to the arena center, build-clearance is checked against every road, and the renderer draws the road network + gates + center castle. No runtime pathfinding — corridors are never blocked, so it is unnecessary.

**Tech Stack:** TypeScript, Phaser 3 (rendering only), Vitest. Pure sim logic stays Phaser-free.

---

### Task 1: `ArenaDef` type + optional `StageDef.arena`

**Files:**

- Modify: `src/data/schema.ts:415-429` (StageDef block)

- [ ] **Step 1: Add the `ArenaDef` interface and the optional field**

In `src/data/schema.ts`, immediately ABOVE `export interface StageDef {`, insert:

```ts
/**
 * A maze-arena battlefield (endless mode): a central castle besieged from many
 * directions through a braided road network. When a stage carries this, the
 * battle uses the arena's center as the castle and `routes` as the roads enemies
 * walk; campaign stages leave it undefined and use the single `path` lane.
 */
export interface ArenaDef {
  /** The castle — the world middle. */
  center: Vec2;
  /** Ground spawn points just outside the map edges (multi-direction siege). */
  gates: Vec2[];
  /** Flyer spawn points (the gate mouths); flyers beeline the center from here. */
  airSpawns: Vec2[];
  /** Precomputed corridor polylines, each running from a gate to the center. */
  routes: Vec2[][];
}
```

Then add one field inside `StageDef`, right after the `terrain?` line:

```ts
  /** Endless maze arena (center castle, multi-gate roads). Campaign stages omit it. */
  arena?: ArenaDef;
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (no new errors — purely additive).

- [ ] **Step 3: Commit**

```bash
git add src/data/schema.ts
git commit -m "feat(schema): ArenaDef + optional StageDef.arena for maze arenas

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Pure maze generator `mazeArena.ts` (TDD)

**Files:**

- Create: `src/core/mazeArena.ts`
- Test: `tests/mazeArena.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/mazeArena.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildMazeArena } from "../src/core/mazeArena.ts";
import { WORLD_WIDTH, WORLD_HEIGHT } from "../src/data/stage.ts";

const eq = (a: { x: number; y: number }, b: { x: number; y: number }) => a.x === b.x && a.y === b.y;

describe("buildMazeArena", () => {
  it("is deterministic for a given seed", () => {
    expect(buildMazeArena(7)).toEqual(buildMazeArena(7));
  });

  it("differs across seeds", () => {
    expect(buildMazeArena(1)).not.toEqual(buildMazeArena(2));
  });

  it("puts the castle at the world middle", () => {
    const a = buildMazeArena(3);
    expect(Math.abs(a.center.x - WORLD_WIDTH / 2)).toBeLessThanOrEqual(2);
    expect(Math.abs(a.center.y - WORLD_HEIGHT / 2)).toBeLessThanOrEqual(2);
  });

  it("opens gates on at least 3 distinct edges (multi-direction)", () => {
    const a = buildMazeArena(5);
    expect(a.gates.length).toBeGreaterThanOrEqual(6);
    const edge = (g: { x: number; y: number }) =>
      g.x < 0 ? "L" : g.x > WORLD_WIDTH ? "R" : g.y < 0 ? "T" : g.y > WORLD_HEIGHT ? "B" : "?";
    const edges = new Set(a.gates.map(edge));
    expect(edges.has("?")).toBe(false); // every gate is off an edge
    expect(edges.size).toBeGreaterThanOrEqual(3);
  });

  it("every route starts at a gate and ends exactly at the center", () => {
    const a = buildMazeArena(9);
    expect(a.routes.length).toBeGreaterThanOrEqual(a.gates.length);
    for (const r of a.routes) {
      expect(r.length).toBeGreaterThanOrEqual(2);
      expect(a.gates.some((g) => eq(g, r[0]))).toBe(true); // starts at some gate
      expect(eq(r[r.length - 1], a.center)).toBe(true); // ends at the castle
    }
  });

  it("every route segment is axis-aligned (corridors, no diagonal wall-cutting)", () => {
    const a = buildMazeArena(11);
    for (const r of a.routes) {
      for (let i = 1; i < r.length; i++) {
        const dx = Math.abs(r[i].x - r[i - 1].x),
          dy = Math.abs(r[i].y - r[i - 1].y);
        expect(dx === 0 || dy === 0).toBe(true);
      }
    }
  });

  it("provides path variety — at least one gate yields two distinct routes", () => {
    const a = buildMazeArena(4);
    const fromGate = new Map<string, string[]>();
    for (const r of a.routes) {
      const key = `${r[0].x},${r[0].y}`;
      const sig = r.map((p) => `${p.x}:${p.y}`).join("|");
      (fromGate.get(key) ?? fromGate.set(key, []).get(key)!).push(sig);
    }
    const hasTwo = [...fromGate.values()].some((sigs) => new Set(sigs).size >= 2);
    expect(hasTwo).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/mazeArena.test.ts`
Expected: FAIL — `Failed to load url ../src/core/mazeArena.ts`.

- [ ] **Step 3: Write the implementation**

Create `src/core/mazeArena.ts`:

```ts
/**
 * Deterministic braided-maze arena generator (endless mode). Carves a grid maze
 * with the castle at the center cell, opens gates on all four edges, and computes
 * multiple gate→center corridor routes. Pure (Phaser-free) and seeded, so an
 * arena is fully reproducible and unit-testable. See
 * docs/superpowers/specs/2026-06-12-endless-maze-arena-design.md.
 */
import type { ArenaDef, Vec2 } from "../data/schema.ts";
import { WORLD_WIDTH, WORLD_HEIGHT } from "../data/stage.ts";
import { Rng } from "./rng.ts";

export interface MazeOpts {
  cols: number;
  rows: number;
  margin: number;
  braid: number;
  gatesPerEdge: number;
}
const DEFAULTS: MazeOpts = { cols: 9, rows: 7, margin: 60, braid: 0.25, gatesPerEdge: 2 };

/** Sorted-pair key for the undirected passage between two cell indices. */
const edgeKey = (a: number, b: number): string => (a < b ? `${a}:${b}` : `${b}:${a}`);

/** `count` evenly-spaced distinct indices in [0, n). */
function spaced(n: number, count: number): number[] {
  const out: number[] = [];
  for (let k = 0; k < count; k++) out.push(Math.round(((k + 1) * n) / (count + 1)));
  return out;
}

/** Breadth-first shortest path of cell indices from `start` to `goal`, or null. */
function bfs(
  start: number,
  goal: number,
  cols: number,
  rows: number,
  linked: Set<string>,
): number[] | null {
  const prev = new Map<number, number>();
  const seen = new Set<number>([start]);
  const q: number[] = [start];
  while (q.length) {
    const cur = q.shift()!;
    if (cur === goal) {
      const path = [cur];
      let c = cur;
      while (prev.has(c)) {
        c = prev.get(c)!;
        path.push(c);
      }
      return path.reverse();
    }
    const cx = cur % cols,
      cy = (cur / cols) | 0;
    for (const [nx, ny] of [
      [cx, cy - 1],
      [cx, cy + 1],
      [cx - 1, cy],
      [cx + 1, cy],
    ]) {
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const ni = ny * cols + nx;
      if (seen.has(ni) || !linked.has(edgeKey(cur, ni))) continue;
      seen.add(ni);
      prev.set(ni, cur);
      q.push(ni);
    }
  }
  return null;
}

export function buildMazeArena(seed: number, opts: Partial<MazeOpts> = {}): ArenaDef {
  const { cols, rows, margin, braid, gatesPerEdge } = { ...DEFAULTS, ...opts };
  const rng = new Rng(seed * 2654435761 + 1);
  const cellW = (WORLD_WIDTH - 2 * margin) / cols;
  const cellH = (WORLD_HEIGHT - 2 * margin) / rows;
  const center = (cx: number, cy: number): Vec2 => ({
    x: Math.round(margin + cellW * (cx + 0.5)),
    y: Math.round(margin + cellH * (cy + 0.5)),
  });
  const startCx = (cols - 1) >> 1,
    startCy = (rows - 1) >> 1;
  const centerCell = startCy * cols + startCx;

  // Carve a perfect maze with a randomized depth-first backtracker from the center.
  const linked = new Set<string>();
  const visited = new Array(cols * rows).fill(false);
  const stack = [centerCell];
  visited[centerCell] = true;
  while (stack.length) {
    const cur = stack[stack.length - 1];
    const cx = cur % cols,
      cy = (cur / cols) | 0;
    const nbrs: number[] = [];
    for (const [nx, ny] of [
      [cx, cy - 1],
      [cx, cy + 1],
      [cx - 1, cy],
      [cx + 1, cy],
    ]) {
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const ni = ny * cols + nx;
      if (!visited[ni]) nbrs.push(ni);
    }
    if (nbrs.length === 0) {
      stack.pop();
      continue;
    }
    const next = nbrs[Math.floor(rng.next() * nbrs.length)];
    linked.add(edgeKey(cur, next));
    visited[next] = true;
    stack.push(next);
  }

  // Braid: knock out extra walls to create loops (multiple routes to the center).
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      const cur = cy * cols + cx;
      for (const [nx, ny] of [
        [cx + 1, cy],
        [cx, cy + 1],
      ]) {
        if (nx >= cols || ny >= rows) continue;
        const ni = ny * cols + nx;
        if (!linked.has(edgeKey(cur, ni)) && rng.next() < braid) linked.add(edgeKey(cur, ni));
      }
    }
  }

  // Gates on all four edges, with off-map spawn points aligned to their cells.
  const gateCells: { cell: number; point: Vec2 }[] = [];
  for (const cx of spaced(cols, gatesPerEdge)) {
    gateCells.push({ cell: 0 * cols + cx, point: { x: center(cx, 0).x, y: -20 } });
    gateCells.push({
      cell: (rows - 1) * cols + cx,
      point: { x: center(cx, rows - 1).x, y: WORLD_HEIGHT + 20 },
    });
  }
  for (const cy of spaced(rows, gatesPerEdge)) {
    gateCells.push({ cell: cy * cols + 0, point: { x: -20, y: center(0, cy).y } });
    gateCells.push({
      cell: cy * cols + (cols - 1),
      point: { x: WORLD_WIDTH + 20, y: center(cols - 1, cy).y },
    });
  }

  const toPolyline = (point: Vec2, cells: number[]): Vec2[] => [
    point,
    ...cells.map((c) => center(c % cols, (c / cols) | 0)),
  ];

  const routes: Vec2[][] = [];
  for (const g of gateCells) {
    const cellsA = bfs(g.cell, centerCell, cols, rows, linked);
    if (!cellsA) continue;
    routes.push(toPolyline(g.point, cellsA));
    // A second, distinct route: BFS again with route A's interior edges removed.
    const edgesA = new Set<string>();
    for (let i = 1; i < cellsA.length; i++) edgesA.add(edgeKey(cellsA[i - 1], cellsA[i]));
    const linkedB = new Set([...linked].filter((e) => !edgesA.has(e)));
    const cellsB = bfs(g.cell, centerCell, cols, rows, linkedB);
    if (cellsB) routes.push(toPolyline(g.point, cellsB));
  }

  const gates = gateCells.map((g) => g.point);
  return { center: center(startCx, startCy), gates, airSpawns: gates, routes };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/mazeArena.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/core/mazeArena.ts tests/mazeArena.test.ts
git commit -m "feat(arena): deterministic braided-maze generator (center castle, multi-gate routes)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Per-enemy route plumbing through the sim (TDD)

This makes the whole sim route-aware. Campaign enemies fall back to `stage.path`, so existing battle tests stay green; arena enemies walk a chosen corridor. Touches types + 3 sim modules together (they must compile as a unit), verified by a new integration test.

**Files:**

- Modify: `src/core/battleTypes.ts:144-179` (EnemyRuntime), `:257-264` (SpawnRequest)
- Modify: `src/core/battle.ts:163` (castlePos), `:243-256` (canPlaceAt)
- Modify: `src/core/battleWaves.ts:7` (import), `:267-305` (spawnEnemy)
- Modify: `src/core/battleEnemies.ts:218-236` (advance/threat), `:289-297` (queueSummon)
- Test: `tests/battleArena.test.ts`

- [ ] **Step 1: Write the failing integration test**

Create `tests/battleArena.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { BattleState } from "../src/core/battle.ts";
import { buildMazeArena } from "../src/core/mazeArena.ts";
import {
  makeStats,
  type CharacterDef,
  type EnemyDef,
  type StageDef,
  type WaveDef,
} from "../src/data/schema.ts";
import { WORLD_WIDTH, WORLD_HEIGHT } from "../src/data/stage.ts";

function enemy(over: Partial<EnemyDef> = {}): EnemyDef {
  return {
    id: "grunt",
    name: "Grunt",
    archetype: "Rusher",
    flying: false,
    immunity: null,
    damageType: "Physical",
    bounty: 10,
    castleDamage: 1,
    baseStats: makeStats({ maxHp: 100, moveSpeed: 50, atk: 5, attackSpeed: 1 }),
    artRef: "placeholder",
    ...over,
  };
}
function turret(): CharacterDef {
  return {
    id: "turret",
    name: "Turret",
    rarity: "Common",
    role: "damage",
    damageType: "Physical",
    target: "Both",
    cost: 0,
    description: "t",
    passives: ["p"],
    active: null,
    baseStats: makeStats({ atk: 1, attackSpeed: 1, range: 100, maxHp: 100 }),
    artRef: "placeholder",
  };
}
function arenaStage(waves: WaveDef[]): StageDef {
  const arena = buildMazeArena(42);
  return {
    id: "ch1-s1",
    name: "Arena",
    path: arena.routes[0],
    airSpawns: arena.gates,
    castleHp: 1000,
    startingGold: 0,
    towerSlots: [],
    terrain: [],
    waves,
    arena,
  };
}
const inertHero = {
  stats: makeStats({ maxHp: 1e9, attackSpeed: 0, range: 0, moveSpeed: 0 }),
  startPos: { x: -500, y: -500 },
};
const cat = (e: EnemyDef, c: CharacterDef) => ({
  enemies: new Map([[e.id, e]]),
  characters: new Map([[c.id, c]]),
});

describe("maze-arena battle", () => {
  it("places the castle at the arena center, not a path end", () => {
    const stage = arenaStage([{ spawns: [] }]);
    const b = new BattleState(stage, cat(enemy(), turret()), { hero: inertHero });
    expect(b.castlePos).toEqual(stage.arena!.center);
    expect(Math.abs(b.castlePos.x - WORLD_WIDTH / 2)).toBeLessThanOrEqual(2);
    expect(Math.abs(b.castlePos.y - WORLD_HEIGHT / 2)).toBeLessThanOrEqual(2);
  });

  it("spawns ground enemies from multiple distinct gate directions", () => {
    const stage = arenaStage([
      { spawns: [{ enemyId: "grunt", count: 30, interval: 0.05, delay: 0 }] },
    ]);
    const b = new BattleState(stage, cat(enemy(), turret()), { hero: inertHero, seed: 99 });
    for (let i = 0; i < 40; i++) b.tick(0.05);
    const starts = new Set(b.enemies.map((e) => `${e.route[0].x},${e.route[0].y}`));
    expect(starts.size).toBeGreaterThanOrEqual(3); // enemies arrive from ≥3 directions
    // every enemy's route ends at the castle center
    for (const e of b.enemies) {
      const end = e.route[e.route.length - 1];
      expect(end).toEqual(stage.arena!.center);
    }
  });

  it("an enemy that walks its whole route leaks into the central castle", () => {
    const stage = arenaStage([{ spawns: [{ enemyId: "grunt", count: 1, interval: 1, delay: 0 }] }]);
    const fast = enemy({
      baseStats: makeStats({ maxHp: 100, moveSpeed: 9999, atk: 5, attackSpeed: 1 }),
    });
    const b = new BattleState(stage, cat(fast, turret()), { hero: inertHero });
    const hp0 = b.castleHp;
    for (let i = 0; i < 200 && b.castleHp === hp0; i++) b.tick(0.1);
    expect(b.castleHp).toBeLessThan(hp0); // reached the center and dealt leak damage
  });

  it("blocks tower placement on a road but allows it in open cells", () => {
    const stage = arenaStage([{ spawns: [] }]);
    const b = new BattleState(stage, cat(enemy(), turret()), { hero: inertHero });
    const onRoad = stage.arena!.routes[0][1]; // a corridor cell center
    expect(b.canPlaceAt({ x: onRoad.x, y: onRoad.y })).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/battleArena.test.ts`
Expected: FAIL — `e.route` is undefined / `castlePos` is a path end.

- [ ] **Step 3a: Add the route fields to the runtime types**

In `src/core/battleTypes.ts`, inside `EnemyRuntime`, right after the `distanceAlong: number;` line add:

```ts
  /** The polyline this enemy walks (campaign: stage.path; arena: a chosen corridor). */
  route: Vec2[];
  /** Cached length of `route` (== totalPathLen for campaign). */
  routeLen: number;
```

In the same file, inside `SpawnRequest`, after `distanceAlong?: number;` add:

```ts
  /** Override the polyline this spawn walks (summons inherit the parent's route). */
  route?: Vec2[];
```

- [ ] **Step 3b: Center castle + multi-road clearance in `battle.ts`**

Replace line 163:

```ts
this.castlePos = stage.path[stage.path.length - 1];
```

with:

```ts
this.castlePos = stage.arena ? stage.arena.center : stage.path[stage.path.length - 1];
```

Then in `canPlaceAt` (lines 245-248), replace:

```ts
const path = this.stage.path;
for (let i = 1; i < path.length; i++) {
  if (segDist(pos, path[i - 1], path[i]) < LANE_CLEARANCE) return false;
}
```

with:

```ts
// Block placement on ANY road: the single campaign lane, or every arena corridor.
const roads = this.stage.arena ? this.stage.arena.routes : [this.stage.path];
for (const road of roads) {
  for (let i = 1; i < road.length; i++) {
    if (segDist(pos, road[i - 1], road[i]) < LANE_CLEARANCE) return false;
  }
}
```

- [ ] **Step 3c: Route assignment in `battleWaves.ts` `spawnEnemy`**

Change the import on line 7 from:

```ts
import { lerp, pointAtDistance } from "./path.ts";
```

to:

```ts
import { lerp, pathLength, pointAtDistance } from "./path.ts";
```

Then replace the block at lines 267-275 (from `const flying = def.flying;` through the `const pos = ...` line):

```ts
const flying = def.flying;
const airStart =
  req.airStart ??
  (this.stage.airSpawns.length > 0
    ? this.stage.airSpawns[this.nextUid % this.stage.airSpawns.length]
    : this.stage.path[0]);
const distanceAlong = req.distanceAlong ?? 0;
const airProgress = req.airProgress ?? 0;
const pos = flying
  ? lerp(airStart, this.castlePos, airProgress)
  : pointAtDistance(this.stage.path, distanceAlong);
```

with:

```ts
const flying = def.flying;
const arena = this.stage.arena;
// Arena: ground enemies pick a random precomputed corridor; flyers beeline the
// center from a random gate. Campaign: the single shared lane / round-robin air.
const route =
  req.route ??
  (arena ? arena.routes[Math.floor(this.rng.next() * arena.routes.length)] : this.stage.path);
const airStart =
  req.airStart ??
  (arena
    ? arena.gates[Math.floor(this.rng.next() * arena.gates.length)]
    : this.stage.airSpawns.length > 0
      ? this.stage.airSpawns[this.nextUid % this.stage.airSpawns.length]
      : this.stage.path[0]);
const routeLen = pathLength(route);
const distanceAlong = req.distanceAlong ?? 0;
const airProgress = req.airProgress ?? 0;
const pos = flying
  ? lerp(airStart, this.castlePos, airProgress)
  : pointAtDistance(route, distanceAlong);
```

Then in the `this.enemies.push({ ... })` object (lines 277-305), add the two fields right after `distanceAlong,`:

```ts
      route,
      routeLen,
```

- [ ] **Step 3d: Walk + threat + summon along the per-enemy route in `battleEnemies.ts`**

Replace the ground branch in `advanceEnemy` (lines 225-229):

```ts
    } else {
      e.distanceAlong += step;
      if (e.distanceAlong >= this.totalPathLen) return this.reachCastle(e);
      e.pos = pointAtDistance(this.stage.path, e.distanceAlong);
    }
```

with:

```ts
    } else {
      e.distanceAlong += step;
      if (e.distanceAlong >= e.routeLen) return this.reachCastle(e);
      e.pos = pointAtDistance(e.route, e.distanceAlong);
    }
```

Replace `updateEnemyThreat` (lines 232-236):

```ts
  updateEnemyThreat(this: BattleState, e: EnemyRuntime): void {
    e.threat = e.flying
      ? Math.min(1, e.airProgress)
      : Math.min(1, this.totalPathLen === 0 ? 1 : e.distanceAlong / this.totalPathLen);
  },
```

with:

```ts
  updateEnemyThreat(this: BattleState, e: EnemyRuntime): void {
    e.threat = e.flying
      ? Math.min(1, e.airProgress)
      : Math.min(1, e.routeLen === 0 ? 1 : e.distanceAlong / e.routeLen);
  },
```

In `queueSummon` (lines 289-297), make a ground summon inherit the parent's route:

```ts
        parent.flying
          ? { enemyId, airProgress: parent.airProgress, airStart: parent.airStart }
          : { enemyId, distanceAlong: parent.distanceAlong, route: parent.route },
```

- [ ] **Step 4: Run the new test + the full suite**

Run: `npx vitest run tests/battleArena.test.ts`
Expected: PASS (4 tests).

Run: `npx vitest run`
Expected: PASS — all existing battle tests stay green (campaign route falls back to `stage.path`; no extra RNG draws on the non-arena path).

- [ ] **Step 5: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/core/battleTypes.ts src/core/battle.ts src/core/battleWaves.ts src/core/battleEnemies.ts tests/battleArena.test.ts
git commit -m "feat(arena): per-enemy routes — center castle, multi-corridor walk, road clearance

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: `endlessArenaStage` builder (TDD)

**Files:**

- Create: `src/core/endlessArena.ts`
- Test: `tests/endlessArena.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/endlessArena.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { endlessArenaStage } from "../src/core/endlessArena.ts";
import { STAGE_1 } from "../src/data/stage.ts";

describe("endlessArenaStage", () => {
  it("attaches a maze arena and centers the castle, inheriting base economy", () => {
    const s = endlessArenaStage(STAGE_1, 5);
    expect(s.arena).toBeDefined();
    expect(s.arena!.routes.length).toBeGreaterThan(0);
    expect(s.castleHp).toBe(STAGE_1.castleHp);
    expect(s.startingGold).toBe(STAGE_1.startingGold);
    expect(s.terrain).toEqual([]); // the maze IS the terrain
    // fallbacks for incidental stage.path readers point into the arena
    expect(s.path).toEqual(s.arena!.routes[0]);
    expect(s.airSpawns).toEqual(s.arena!.gates);
  });

  it("is deterministic per seed and does not mutate the base stage", () => {
    expect(endlessArenaStage(STAGE_1, 8)).toEqual(endlessArenaStage(STAGE_1, 8));
    expect(STAGE_1.arena).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/endlessArena.test.ts`
Expected: FAIL — `Failed to load url ../src/core/endlessArena.ts`.

- [ ] **Step 3: Write the implementation**

Create `src/core/endlessArena.ts`:

```ts
/**
 * Builds the endless-mode battlefield: a clone of the cleared campaign stage with
 * a braided maze arena bolted on (center castle, multi-gate roads). The endless
 * wave generator / scaling / rewards are unchanged — only the map differs. `path`
 * and `airSpawns` are set to arena fallbacks so any incidental `stage.path` reader
 * still resolves into the arena. See mazeArena.ts.
 */
import type { StageDef } from "../data/schema.ts";
import { buildMazeArena } from "./mazeArena.ts";

export function endlessArenaStage(base: StageDef, seed: number): StageDef {
  const arena = buildMazeArena(seed);
  return {
    ...base,
    arena,
    path: arena.routes[0],
    airSpawns: arena.gates,
    terrain: [],
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/endlessArena.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
npx tsc --noEmit
git add src/core/endlessArena.ts tests/endlessArena.test.ts
git commit -m "feat(arena): endlessArenaStage builder (maze arena over the cleared stage)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Wire endless mode to the arena + render the roads/gates/center castle

**Files:**

- Modify: `src/scenes/BattleScene.ts:136-159` (use arena stage in endless), `:296-307` (drawStatic roads/gates/castle)

- [ ] **Step 1: Build the arena stage for endless runs**

In `BattleScene.create()`, find (around line 140-141):

```ts
this.battleMode = (this.registry.get("battleMode") as BattleMode | undefined) ?? { kind: "normal" };
this.registry.set("battleMode", undefined);
```

Immediately AFTER those two lines, insert:

```ts
// Endless mode fights on a generated maze arena (central castle, multi-gate
// roads) instead of reusing the cleared stage's single lane. Seeded by stage
// number so each endless stage has a stable, learnable battlefield.
if (this.battleMode.kind === "endless") {
  this.stage = endlessArenaStage(this.stage, stageNumber(this.stage.id) || 1);
}
```

Add the imports near the other `../data/stage.ts` / `../core` imports at the top of the file:

```ts
import { endlessArenaStage } from "../core/endlessArena.ts";
import { stageNumber } from "../data/stage.ts";
```

(If `stageNumber` is already imported from `../data/stage.ts`, just add it to that import list instead of duplicating.)

- [ ] **Step 2: Render the road network, gates, and center castle**

In `drawStatic()`, replace the `// lane` block (lines 296-302):

```ts
// lane
g.lineStyle(36, 0x3a4458, 1);
const p = this.stage.path;
g.beginPath();
g.moveTo(p[0].x, p[0].y);
for (let i = 1; i < p.length; i++) g.lineTo(p[i].x, p[i].y);
g.strokePath();
```

with:

```ts
// roads: the single campaign lane, or every corridor of the maze arena.
const roads = this.stage.arena ? this.stage.arena.routes : [this.stage.path];
g.lineStyle(36, 0x3a4458, 1);
for (const road of roads) {
  if (road.length < 2) continue;
  g.beginPath();
  g.moveTo(road[0].x, road[0].y);
  for (let i = 1; i < road.length; i++) g.lineTo(road[i].x, road[i].y);
  g.strokePath();
}
// arena gates: red mouths where each siege column enters the map.
if (this.stage.arena) {
  g.fillStyle(0x7a2a2a, 1);
  g.lineStyle(2, 0xd06060, 1);
  for (const gp of this.stage.arena.gates) {
    const x = Math.max(10, Math.min(WORLD_WIDTH - 10, gp.x));
    const y = Math.max(10, Math.min(WORLD_HEIGHT - 10, gp.y));
    g.fillCircle(x, y, 13);
    g.strokeCircle(x, y, 13);
  }
}
```

The existing `// castle` block right below already draws at `this.battle.castlePos`, which is now the arena center — no change needed there.

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/scenes/BattleScene.ts
git commit -m "feat(arena): endless uses the maze arena; draw roads, gates, center castle

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Full verification + CDP playtest

**Files:** none (verification only)

- [ ] **Step 1: Full test suite + typecheck + build**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: ALL PASS. Confirm no source file exceeds 500 lines:
Run: `wc -l src/core/mazeArena.ts src/core/endlessArena.ts src/scenes/BattleScene.ts`
Expected: each < 500.

- [ ] **Step 2: CDP self-playtest**

Start the dev server, open the game with `?debug`, and via `window.__game`:

1. Set `battleMode = { kind: "endless" }` and `selectedStage` to a cleared stage, start `BattleScene` (stop other scenes first so they don't bleed through).
2. Read `sc.stage.arena` — confirm it is defined, `castlePos` ≈ (640, 360).
3. Tick a few seconds; confirm `sc.battle.enemies` have ≥3 distinct `route[0]` start points and every `route` ends at the center.
4. Capture a screenshot `/tmp/maze-arena.png`; confirm 0 console errors.

Expected: central castle with roads radiating to gates on multiple edges; enemies streaming inward from several directions.

- [ ] **Step 3: Final commit (if any playtest tweaks were needed)**

```bash
git add -A
git commit -m "polish(arena): playtest fixes

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

(Skip if the tree is already clean.)

---

## Self-Review

**Spec coverage:**

- §3 precomputed multi-route maze → Task 2. ✅
- §4 ArenaDef + per-enemy route → Task 1, Task 3. ✅
- §5 deterministic generator + invariants → Task 2 (tests mirror every listed invariant). ✅
- §6 sim integration (castle, clearance, spawn, advance, threat, summon) → Task 3. ✅
- §7 endless arena stage + BattleScene wiring → Task 4, Task 5. ✅
- §8 rendering roads/gates/castle → Task 5. ✅

**Placeholder scan:** none — every code step shows full code and exact commands.

**Type consistency:** `ArenaDef { center, gates, airSpawns, routes }` used identically in Tasks 1–5; `EnemyRuntime.route/routeLen` and `SpawnRequest.route` defined in Task 3a and consumed in 3c/3d; `buildMazeArena(seed, opts?)` and `endlessArenaStage(base, seed)` signatures consistent across tasks and tests.

**Note on threat semantics:** threat stays the progress fraction `distanceAlong / routeLen` (unchanged from today, now per-route) — deliberately not changed to remaining-distance, to avoid regressing campaign targeting. Recorded as a possible future refinement in the spec (§6).

```

```
