# Chapter 1 Branching Maps — Design Spec

**Date:** 2026-06-13
**Status:** Approved (full-auto session — author holds standing approval)
**Topic:** Redesign all 10 Chapter 1 stage maps to be more sophisticated — multi-lane / branching paths in the Kingdom Rush tradition — within the existing rendering architecture.

## Problem

Chapter 1's ten maps (`src/data/stage.ts` `LAYOUTS`) are each a **single 5–7 point zig-zag polyline**. Every ground enemy walks the same lane in single file. The maps read as flat and same-y; there is no split-attention pressure, no real chokepoint design, and no visual variety beyond the bend pattern. The request: make them "more sophisticated… may have multiple branches… learn from Kingdom Rush."

## What we learned (Kingdom Rush map design)

- **One sinuous primary path** with switchbacks; bends create natural chokepoints and open "build pockets" between them.
- **Occasional lane splits** force the player to defend two fronts at once — the core tension lever beyond raw enemy stats.
- **Lanes re-merge before the keep**, so there is always a final shared chokepoint where last-ditch defense concentrates.
- **Entrances at the map edges, the keep as the single exit.** Terrain (blocking + decorative) frames the lanes and shapes the buildable space.

## On "Phaser 3 tilemap" (considered, rejected)

The request mentioned searching for a Phaser 3 **tilemap**. Investigation (`battleSceneRender.ts`) confirms this game does **not** use Phaser tilemaps: terrain is an SDXL painted backdrop + vector `Graphics` roads + sprite overlays, and the art pipeline is SDXL-only (see project memory `project_art_pipeline_sdxl`). Converting to a `Tilemap`/`Tileset` renderer would be a large rewrite that fights the existing backdrop pipeline and the free-placement collision model, delivering no player-facing benefit the vector roads don't already give. **Decision:** deliver the actual goal — sophisticated, branching maps — inside the current vector/polyline architecture. This is the lower-risk, higher-value path.

## Approach (chosen)

**Add an optional `lanes: Vec2[][]` to the stage data model** — a stage may declare several complete polylines (each from a map edge to the shared keep) instead of one. This is deliberately the *minimal* extension because the three runtime seams that consume "the road(s)" **already iterate a list of polylines** for the endless maze arena:

| Seam | Today | Change |
| --- | --- | --- |
| Enemy route pick (`battleWaves.ts:283`) | `arena ? random(arena.routes) : stage.path` | `random(groundLanes(stage))` (rng only when >1 lane) |
| Placement block (`battlePlacement.ts:60`) | `arena ? arena.routes : [stage.path]` | `groundLanes(stage)` |
| Road render (`battleSceneRender.ts:511`) | `arena ? arena.routes : [stage.path]` | `groundLanes(stage)` |

A single pure helper centralizes the precedence:

```ts
// src/core/path.ts
export function groundLanes(stage: {
  path: Vec2[]; lanes?: Vec2[][]; arena?: { routes: Vec2[][] } | undefined;
}): Vec2[][] {
  if (stage.arena) return stage.arena.routes; // maze arena wins
  if (stage.lanes && stage.lanes.length > 0) return stage.lanes;
  return [stage.path]; // legacy single-lane stages
}
```

### Why not a true path graph (fork/merge nodes)?

A real branching graph (enemies choosing at fork nodes, shared segments that split) would require rewriting `path.ts` traversal (currently pure distance-along-one-polyline), the hot enemy-movement loop, and per-enemy branch memory — high risk in the sim core for no extra player-visible value. Kingdom Rush's "two-lane" maps are, mechanically, **two complete polylines that visually share an entrance and a keep approach**. We get the same feel by authoring lanes whose geometry overlaps at the fork and merge points. **YAGNI on the graph.**

### Determinism guard

Today single-lane campaign stages consume **no** RNG for route selection (they hardcode `stage.path`); the arena consumes one `rng.next()`. To preserve existing seeded battle determinism for stages that remain single-lane, route selection only draws from the RNG when `lanes.length > 1`:

```ts
const lanes = groundLanes(this.stage);
const route = req.route ?? (lanes.length > 1
  ? lanes[Math.floor(this.rng.next() * lanes.length)]
  : lanes[0]);
```

Multi-lane stages advance their own RNG stream (exactly as the arena does); this only affects those stages.

## Map redesign — all 10 Chapter 1 stages

Authored at 960×540 (scaled to the 1280×720 world by the existing `scaleV`). **Every lane ends at the same keep point** `castle` (so `castlePos = stage.path[last]` stays correct and `stage.path` is set to `lanes[0]`). Two-lane stages **merge into a shared tail** before the keep (the final chokepoint). Air spawns and the legacy `slots` are kept/refreshed per stage.

Path complexity ramps **monotonically** (respects the difficulty-monotonic law — `feedback_difficulty_monotonic_law`): single-lane tutorial → two fronts → climactic three-entrance finale. Branching is a difficulty lever, so it only ever increases with stage number.

| # | Name | Lanes | Shape / intent |
| --- | --- | --- | --- |
| 1 | Greywood Trailhead | 1 | Gentle multi-switchback S — teach placement & chokepoints. |
| 2 | Switchback Gully | 1 | Tighter serpentine, more bends, narrow build pockets. |
| 3 | Twin Fords | **2** | First split: two edge entrances converge to a shared keep approach — gentle, lanes merge early. |
| 4 | Hollow Stair | **2** | Descending staircase doubled — upper & lower stair, late merge. |
| 5 | Serpent Bend | **2** | Long sweeping double serpentine; lanes interleave vertically. |
| 6 | Quarry Descent | **2** | Two ramps down opposite sides into one quarry-floor merge. |
| 7 | Cinder Crossroads | **2** | Lanes **cross** mid-map (an X) then merge — split focus, then a pivot point both lanes pass. |
| 8 | Mistgrove Loop | **2** | A fork that bulges into a loop and rejoins — encircling pressure. |
| 9 | Broken Aqueduct | **2** | Elevated aqueduct lane (high) + collapsed ground lane (low), merge at the breach. |
| 10 | Wardens' Gate | **3** | Climactic: three edge entrances funnel through two corridors into one final gate chokepoint. |

(Exact coordinates are authored in the implementation plan.)

## Components / files touched

- **`src/core/path.ts`** — add pure `groundLanes(stage)` helper.
- **`src/data/schema.ts`** — add `lanes?: Vec2[][]` to `StageDef`.
- **`src/data/stage.ts`** — add `lanes?: Vec2[][]` to `Layout`; rewrite all 10 `LAYOUTS`; in the `STAGES` builder scale `lanes` and set `path = lanes[0]` for multi-lane stages; generalize `generateTerrain` to keep **all** lanes clear (accept `Vec2[][]`).
- **`src/core/battleWaves.ts`** — route pick via `groundLanes` + determinism guard.
- **`src/core/battlePlacement.ts`** — `canPlaceAt` roads via `groundLanes`.
- **`src/scenes/battleSceneRender.ts`** — road render via `groundLanes` (arena gate drawing unchanged).

No file should exceed the 500-line cap; `stage.ts` is at 597 lines today **but** the `LAYOUTS` array is data — if the rewrite pushes total code lines near the cap, the layout data moves to a sibling `chapter1Layouts.ts` (ESLint counts code lines; large data arrays are the usual reason `stage.ts` is shielded — confirm with `npx eslint` and split if it errors).

## Data flow

`STAGES` builder → `StageDef.lanes` (scaled) → `groundLanes()` → consumed identically by route selection (per-enemy lane pick), placement validation (block near any lane), and rendering (draw every lane). Air enemies are unchanged (beeline the keep from `airSpawns`). The maze arena path is **untouched** — `groundLanes` returns `arena.routes` first, so endless behavior is byte-for-byte identical.

## Error handling / edge cases

- A stage with `lanes` but where `lanes[0] !== path` would desync the castle. The builder **derives** `path` from `lanes[0]`, so they cannot diverge.
- Lanes that don't share the keep endpoint would create two castles visually. A test asserts every lane's last point equals `path[last]`.
- Empty `lanes: []` falls through to `[stage.path]` (guard: `lanes.length > 0`).
- Determinism: single-lane stages draw no RNG (guarded), preserving existing seeded tests.

## Testing strategy (TDD)

1. **`groundLanes` unit** (`tests/path.test.ts` or new): precedence arena > lanes > path; empty lanes → `[path]`; single → `[path]`.
2. **Stage data invariants** (`tests/stage.test.ts`, likely new): for every Chapter 1 stage — at least the table's lane count; every lane has ≥2 points, starts off/at the edge, ends exactly at `path[last]` (the keep); all lanes in-bounds of the world; `path === lanes[0]` when multi-lane; generated terrain blocks none of the lanes.
3. **Route distribution** (extend `tests/battle*.test.ts`): on a 2-lane stage, a burst of ground enemies populates **both** lanes' first points (≥2 distinct route starts), and every route ends at the keep.
4. **Placement** still blocks on every lane (extend free-placement test for a 2-lane stage).
5. **Regression:** full suite green — especially `battleArena`, `path`, `waveStructure`, `chapter1Waves`, `free-placement`, `placementMode`.

## Out of scope

- Phaser tilemap rendering (rejected above).
- True fork/merge path-graph traversal (YAGNI).
- New SDXL backdrop art (lanes are vector roads over the existing per-chapter backdrop).
- Chapter 2–5 layouts (`stagesExpansion.ts`) — untouched.
- Wave/enemy tuning — `chapter1Waves.ts` is untouched; this is a *map geometry* change only.
