/**
 * squadEdit — the single pure source of truth for squad-array mutation. Both the
 * drag controller (squadDrag.ts) and the new tap paths in SquadScene call these,
 * so add/remove/place can never diverge between input methods. Phaser-free and
 * fully unit-tested. Every function returns a NEW slots array (never mutates).
 */
import type { Rarity } from "../data/schema.ts";

export const SQUAD_MAX = 7;

export type SquadReason = "added" | "removed" | "placed" | "full" | "noop" | "cleared";

export interface SquadEditResult {
  slots: (string | null)[];
  changed: boolean;
  filled?: number;
  reason: SquadReason;
}

const RARITY_ORDER: Record<Rarity, number> = {
  Common: 0,
  Magic: 1,
  Rare: 2,
  Legendary: 3,
  Unique: 4,
};

/** Deterministic ranking score for auto-fill: rarity dominates, stars break ties. */
export function charSquadScore(rarity: Rarity, stars: number): number {
  return RARITY_ORDER[rarity] * 1000 + stars;
}

/** Add id to the first empty slot. No-op if already present or squad full. */
export function squadAdd(slots: (string | null)[], id: string): SquadEditResult {
  if (slots.includes(id)) return { slots: slots.slice(), changed: false, reason: "noop" };
  const i = slots.indexOf(null);
  if (i < 0) return { slots: slots.slice(), changed: false, reason: "full" };
  const next = slots.slice();
  next[i] = id;
  return { slots: next, changed: true, reason: "added" };
}

/** Remove id from wherever it sits. No-op if absent. */
export function squadRemove(slots: (string | null)[], id: string): SquadEditResult {
  const i = slots.indexOf(id);
  if (i < 0) return { slots: slots.slice(), changed: false, reason: "noop" };
  const next = slots.slice();
  next[i] = null;
  return { slots: next, changed: true, reason: "removed" };
}

/** Place id at a specific slot; if already slotted elsewhere, move it (no dupes). */
export function squadPlaceAt(
  slots: (string | null)[],
  id: string,
  slot: number,
): SquadEditResult {
  const next = slots.slice();
  const cur = next.indexOf(id);
  if (cur >= 0) next[cur] = null; // move, never duplicate
  next[slot] = id;
  return { slots: next, changed: true, reason: "placed" };
}

/** Fill empty slots in order from candidates (already power-sorted desc),
 *  skipping any already in the squad. Never disturbs filled slots. */
export function autoFillSquad(
  slots: (string | null)[],
  candidates: string[],
): SquadEditResult {
  const next = slots.slice();
  let filled = 0;
  for (const id of candidates) {
    if (next.includes(id)) continue;
    const i = next.indexOf(null);
    if (i < 0) break;
    next[i] = id;
    filled++;
  }
  return { slots: next, changed: filled > 0, filled, reason: filled > 0 ? "added" : "noop" };
}

/** Empty every slot. No-op (changed=false) when already empty. */
export function clearSquad(slots: (string | null)[]): SquadEditResult {
  const had = slots.some(Boolean);
  return {
    slots: Array.from({ length: slots.length }, () => null),
    changed: had,
    reason: "cleared",
  };
}
