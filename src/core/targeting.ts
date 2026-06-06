/**
 * Target selection. Static towers (like Kingdom Rush) have no manual priority —
 * they fire at the enemy FURTHEST along toward the castle that is within range
 * and that they are allowed to hit (ground/air). The mobile hero is the player's
 * tool for re-allocating threat.
 */
import type { Vec2 } from "../data/schema.ts";
import { dist } from "./path.ts";

export interface Targetable {
  pos: Vec2;
  /** 0..1 progress toward the castle — higher = bigger threat. */
  threat: number;
  flying: boolean;
  alive: boolean;
  /** Stealthed enemies are invisible to towers (but not to the hero). */
  stealth: boolean;
}

export interface TargetFilter {
  canHitGround: boolean;
  canHitAir: boolean;
  /** The hero sees stealthed enemies; towers do not. */
  seeStealth: boolean;
}

/** Pick the highest-threat valid target within range, or null. */
export function selectTarget<T extends Targetable>(
  from: Vec2,
  range: number,
  candidates: readonly T[],
  filter: TargetFilter,
): T | null {
  let best: T | null = null;
  for (const c of candidates) {
    if (!c.alive) continue;
    if (c.stealth && !filter.seeStealth) continue;
    if (c.flying && !filter.canHitAir) continue;
    if (!c.flying && !filter.canHitGround) continue;
    if (dist(from, c.pos) > range) continue;
    if (best === null || c.threat > best.threat) best = c;
  }
  return best;
}
