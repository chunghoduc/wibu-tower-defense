// src/core/placementMode.ts
//
// Pure state machine for "tap-to-place": which build-bar tower avatar (if any)
// is armed for a follow-up field tap. No Phaser, no time, no DOM — the scene
// presenter owns the ghost visuals and calls battle.placeTowerAt. Keeping the
// decision here makes the tap-vs-place rules unit-testable.

export interface PlacementState {
  /** Tower def id armed for the next field tap, or null when nothing is armed. */
  armedId: string | null;
}

export function emptyPlacement(): PlacementState {
  return { armedId: null };
}

/** Arm `id`; tapping the already-armed id toggles back to unarmed. */
export function armPlacement(s: PlacementState, id: string): PlacementState {
  return { armedId: s.armedId === id ? null : id };
}

export function disarmPlacement(_s: PlacementState): PlacementState {
  return { armedId: null };
}

export function isArmed(s: PlacementState): boolean {
  return s.armedId !== null;
}

/** What a tap on the battlefield should do given board validity + affordability. */
export type PlaceDecision = "place" | "blocked" | "idle";

export function resolveFieldTap(
  s: PlacementState,
  opts: { canPlace: boolean; affordable: boolean },
): PlaceDecision {
  if (!isArmed(s)) return "idle";
  return opts.canPlace && opts.affordable ? "place" : "blocked";
}
