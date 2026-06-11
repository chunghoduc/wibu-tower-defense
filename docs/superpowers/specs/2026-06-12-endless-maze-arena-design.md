# Endless Maze Arena — Design Spec

**Date:** 2026-06-12
**Status:** Approved (full-auto session — design decisions made by the implementing agent on the owner's behalf)
**Scope:** Endless mode only. Campaign stages 1–30 are untouched.

## 1. The request

> Design a much more complicated endless map so that enemies can come from more than one
> direction, the castle is in the middle of the map, and the roads are like mazed; the
> enemies can walk any way they want.

Today every battle (campaign **and** endless) runs on a single hand-authored polyline lane:
enemies enter at one edge, snake along one corridor, and leak at the **last** waypoint where
the castle sits. Endless just reuses the cleared stage's lane. The ask is to give **endless**
its own battlefield: a **central castle** besieged from **many directions** through a **maze**
of branching roads, with enemies taking **varied paths** to the core.

## 2. Key constraints discovered (these shape the design)

- **Movement is polyline-following, not pathfinding.** An enemy tracks `distanceAlong` a
  `Vec2[]` and `pointAtDistance(path, d)` returns its position; at `distanceAlong >= len` it
  `reachCastle()`s. (`battleEnemies.ts:218`, `path.ts:26`)
- **Castle = last path waypoint.** `battle.ts:163` hard-codes `castlePos = stage.path[last]`.
- **Towers can never block a corridor.** Free placement rejects any spot within
  `LANE_CLEARANCE` (30px) of the lane (`battle.ts:243`). So roads are *always* walkable —
  **runtime A\* is unnecessary.** The "maze" is a fixed road network; enemies don't need to
  re-route around towers because they can't be on the road.
- **Threat (tower target priority) = progress fraction** `distanceAlong / totalPathLen`
  (`battleEnemies.ts:232`). Furthest-along enemy is shot first.
- **Flyers beeline** `airStart → castlePos` ignoring the road (`battleEnemies.ts:220`).
- **Endless wiring** lives in `BattleScene.create()`: `endless: battleMode.kind === "endless"`
  with `selectedStage` = the cleared campaign stage (`BattleScene.ts:136,157`).

## 3. The core design decision: precomputed multi-route maze, not runtime nav

Because corridors are never blocked, "enemies can walk any way they want" is delivered by a
**braided maze with multiple precomputed routes**, **not** a per-frame pathfinder:

- A deterministic grid maze is carved over the world with the **castle at the center cell**.
- The maze is **braided** (some extra walls removed) so loops exist and there is **more than
  one corridor** from an edge to the center.
- Several **gates** are placed on **all four edges** (multi-direction siege).
- For each gate we precompute up to **2 distinct corridor routes** to the center.
- **Each ground enemy is assigned a random route** (seeded). With ~8 gates × up to 2 routes,
  enemies pour in from every side along many different winding paths — the requested feel —
  while every enemy is still just following a `Vec2[]`, so the **entire existing sim, the
  tests, and the perf profile are preserved.** No A\*, no nav-mesh, no per-frame search.

This is the central trade-off: we buy the visual/▶gameplay goal ("any way they want, from
everywhere, to a central core") at the cost of *true* free-roam pathing, which the game's own
build rules make pointless. Rejected alternatives in §7.

## 4. Data model

### 4.1 `ArenaDef` (new, in `src/data/schema.ts`)

```ts
export interface ArenaDef {
  center: Vec2;        // the castle — world middle
  gates: Vec2[];       // ground spawn points, just outside the edges (multi-direction)
  airSpawns: Vec2[];   // flyer spawn points (the gate mouths)
  routes: Vec2[][];    // precomputed corridor polylines, each runs gate → center
}
```

`StageDef` gains one optional field: `arena?: ArenaDef`. When present, the battle is an arena
battle; when absent (all campaign stages), nothing changes.

`routes` doubles as the **road network for rendering and build-clearance** — drawing every
route draws the maze; clearance is checked against every route segment.

### 4.2 Per-enemy route (the only `EnemyRuntime` / `SpawnRequest` change)

`EnemyRuntime` gains `route: Vec2[]` and `routeLen: number`. `SpawnRequest` gains an optional
`route?: Vec2[]`. For **campaign** spawns the route is simply `stage.path` (a shared reference)
and `routeLen = totalPathLen` — i.e. **identical behavior to today**. For **arena** spawns the
route is one of `stage.arena.routes`, chosen by the seeded RNG.

This is the minimal plumbing that lets different enemies walk different polylines without
touching the shared `stage.path` model.

## 5. Pure maze generator — `src/core/mazeArena.ts` (new, Phaser-free, tested)

`buildMazeArena(seed, opts?): ArenaDef` — fully deterministic from `seed`.

Algorithm:
1. **Grid.** `COLS×ROWS = 9×7` cells over the world interior (margin ~60px). Odd dims give a
   true center cell `(4,3)`; the castle sits at its pixel center (≈ world middle). Cell pitch
   ≈ 129×86px → corridors comfortably wider than the 30px clearance band.
2. **Carve** a perfect maze with a randomized depth-first backtracker seeded from `seed`
   (every cell reachable from the center).
3. **Braid.** Remove ~25% of remaining interior walls (seeded) to create loops, so multiple
   corridors reach the center.
4. **Gates.** Pick 8 boundary cells distributed **2 per edge** (N/E/S/W) → guaranteed
   ≥4-direction siege. Each gate's off-map spawn point is just beyond its edge, aligned to the
   cell (mirrors campaign spawns at `x=-20`).
5. **Routes.** For each gate, BFS the corridor graph to the center → route A. Run a second BFS
   that penalizes route A's interior edges → route B (kept only if it exists and differs). Each
   cell path becomes a `Vec2[]` of axis-aligned segments through cell centers, prefixed with
   the off-map gate point and suffixed with the exact `center`.

**Tested invariants** (`tests/mazeArena.test.ts`):
- Determinism: same seed → deep-equal `ArenaDef`.
- `center` is the world middle (±1 cell-rounding).
- Gates lie on **≥3 distinct edges** (multi-direction guarantee); ≥6 gates total.
- Every route **starts at its gate point** and **ends exactly at `center`**.
- Every interior route segment is **axis-aligned** and one cell-pitch long (no diagonal
  wall-cutting → corridors are real and walkable).
- All non-entry route points are within world bounds.
- At least one gate yields **2 distinct routes** (path variety exists).

## 6. Battle-sim integration (small, surgical edits)

- **`battle.ts`** — `castlePos = stage.arena ? stage.arena.center : stage.path[last]`.
  `canPlaceAt()` checks clearance against **every** road polyline
  (`stage.arena ? stage.arena.routes : [stage.path]`), so you can build in the maze's open
  cells but never on a corridor (and the center is protected as a route end).
- **`battleWaves.ts` `spawnEnemy()`** — ground enemies in an arena draw a route via a new
  `pickArenaRoute()` (uniform over `arena.routes`, via `this.rng`); flyers pick a random gate as
  `airStart`. Sets `route`, `routeLen = pathLength(route)`, `pos = pointAtDistance(route, 0)`.
  Non-arena path is unchanged (`route = stage.path`).
- **`battleEnemies.ts`** — `advanceEnemy()` and `updateEnemyThreat()` read `e.route` /
  `e.routeLen` instead of `this.stage.path` / `this.totalPathLen`. `queueSummon()` copies the
  parent's `route` so splits/summons keep their corridor. Threat stays the progress fraction
  `distanceAlong / routeLen` — unchanged semantics, now per-route.

**Tested** (`tests/battleArena.test.ts`): enemies spawn from ≥3 distinct gate positions across a
wave; an enemy advanced past `routeLen` calls `reachCastle` and damages the central castle; a
tower at the center targets the highest-progress enemy; campaign battles are byte-for-byte
unaffected (route falls back to `stage.path`).

## 7. The endless arena stage — `src/core/endlessArena.ts` (new)

`endlessArenaStage(base: StageDef, seed): StageDef` returns a clone of the cleared stage with:
`arena = buildMazeArena(seed)`, `path = arena.routes[0]` and `airSpawns = arena.gates` (safe
fallbacks for any incidental `stage.path` reader), `castleHp`/`startingGold` inherited,
`terrain: []` (the maze *is* the terrain — no scattered blockers cluttering corridors).
`waves` is irrelevant in endless (waves are generated by `endlessWave()`), so it's left as-is.

`BattleScene.create()` builds this when `battleMode.kind === "endless"`, replacing the reused
campaign stage. The endless **wave generator, scaling, rewards, best-wave record, and entry
cost are all unchanged** — only the battlefield changes.

## 8. Rendering — `BattleScene.drawStatic()`

Generalize the single lane stroke into a road loop: when `stage.arena`, stroke **every**
`arena.routes` polyline (36px dark road), draw a **gate marker** at each `arena.gates` point,
and draw the **castle at `center`** (existing 48px keep design). Non-arena stages keep the
exact current single-lane drawing. The camera, HUD, build bar, and input are all unchanged
(the world is still 1280×720). No new art — roads/castle/gates are `Graphics`, consistent with
the current lane.

## 9. Rejected alternatives

- **Runtime A\* / flow-field pathfinding.** Maximum fidelity to "walk any way they want," but
  pointless here: towers can't occupy roads, so there is nothing to dynamically route around.
  It adds a per-frame search, a grid nav model, and a large test surface for zero gameplay
  difference. Rejected (YAGNI).
- **One route per gate (perfect maze, no braid).** Simpler, but each gate has exactly one path
  — "many directions" yes, "any way they want" no. Braiding + 2 routes/gate is the cheap fix.
- **Multi-path for campaign too.** Out of scope; the request is the endless map. The model
  supports it later (any stage can set `arena`), but we don't author it now.

## 10. Files

| File | Change |
|---|---|
| `src/data/schema.ts` | + `ArenaDef`, `StageDef.arena?` |
| `src/core/mazeArena.ts` | **new** — deterministic braided-maze → `ArenaDef` |
| `src/core/endlessArena.ts` | **new** — `endlessArenaStage(base, seed)` |
| `src/core/battleTypes.ts` | `EnemyRuntime.route/routeLen`, `SpawnRequest.route?` |
| `src/core/battle.ts` | center castle, multi-road `canPlaceAt` |
| `src/core/battleWaves.ts` | `spawnEnemy` route assignment + `pickArenaRoute` |
| `src/core/battleEnemies.ts` | `advanceEnemy`/`threat`/`queueSummon` use `e.route` |
| `src/scenes/BattleScene.ts` | build arena stage for endless; draw roads + gates + center castle |
| `tests/mazeArena.test.ts` | **new** |
| `tests/battleArena.test.ts` | **new** |

All new/edited modules stay well under the 500-line cap. The whole change is **additive and
endless-gated**: with `stage.arena` absent, every code path is byte-for-byte the campaign path.
```
