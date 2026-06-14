// src/core/placementHud.ts
//
// Pure presentation logic for the "tap-to-place" mobile flow: how a build-bar
// card looks when a tower is armed, where the placement ghost should preview,
// and the instruction text. No Phaser, no DOM — the BattleScene presenter reads
// these and applies them. Keeps the select/hint rules unit-testable. The arm
// STATE machine itself lives in placementMode.ts.

import type { Vec2 } from "../data/schema.ts";

/** Screen-y where the bottom build-bar strip begins (mirrors bindInput's y>=500). */
export const BUILD_BAR_TOP = 500;

export interface TileVisual {
  alpha: number;
  scale: number;
  selected: boolean;
}

/** Per-frame visual for one build-bar card given the armed/affordable state. */
export function armedTileVisual(o: {
  anyArmed: boolean;
  isArmedTile: boolean;
  affordable: boolean;
}): TileVisual {
  if (o.isArmedTile) return { alpha: 1, scale: 1.12, selected: true };
  if (!o.affordable) return { alpha: 0.45, scale: 1, selected: false };
  return { alpha: o.anyArmed ? 0.6 : 1, scale: 1, selected: false };
}

/**
 * World-point to anchor the placement ghost when arming. On touch the active
 * pointer is still on the just-tapped card (inside the build-bar strip), which
 * would park a red "blocked" ghost on the bar; in that case preview at the
 * camera-view center instead. On a desktop hover the pointer is over the field,
 * so follow it.
 */
export function ghostAnchor(o: {
  pointerScreenY: number;
  pointerWorld: Vec2;
  camCenter: Vec2;
}): Vec2 {
  return o.pointerScreenY >= BUILD_BAR_TOP ? o.camCenter : o.pointerWorld;
}

/** Instruction shown while a card is armed (empty string when nothing is armed). */
export function armHintText(name: string | null): string {
  return name ? `Tap the map to place ${name}  ·  tap card to cancel` : "";
}
