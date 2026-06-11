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
