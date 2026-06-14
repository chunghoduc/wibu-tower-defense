/**
 * Pure (Phaser-free) helpers for the per-tower role badge. The badge shows a
 * tower's TowerRole as an SDXL emblem in its upper-right corner. This module is
 * the single source for the role→texture-key mapping, the badge geometry, and
 * the per-role tint, so the renderer (battleSceneSprites) and tests agree.
 */
import type { TowerRole } from "../data/schema.ts";
import { roleTex } from "../data/assetKeys.ts";

/** Texture key for a role's emblem (e.g. "roleicon__splash"). */
export function roleBadgeTex(role: TowerRole): string {
  return roleTex(role);
}

/** Badge placement + size, relative to the tower body center, in world px. */
export const ROLE_BADGE = {
  diameter: 15, // rendered emblem diameter
  offsetX: 13, // right of center (matches the legacy badge x)
  offsetY: -16, // above center (matches the legacy badge y)
} as const;

/** Emblem placement on a build-bar tower card (local coords, card centered at 0,0).
 *  Pins the role emblem to the card's upper-right — over the type-badge disc that
 *  buildBuildBar draws at (cardWidth/2 - 9, -8) — so the role reads on the card too. */
export function roleBadgeOnCard(cardWidth: number): { x: number; y: number; diameter: number } {
  const diameter = Math.round(cardWidth * 0.24); // ~16px on the 66px build-bar card
  return { x: cardWidth / 2 - 9, y: -8, diameter };
}

/** Tint applied to each role's badge emblem — mirrors battleSceneHelpers
 *  ROLE_COLOR, but Phaser-free and total over every TowerRole. */
export const ROLE_BADGE_COLOR: Record<TowerRole, number> = {
  damage: 0x4fc3f7,
  splash: 0xff8a65,
  chain: 0xba68c8,
  dot: 0x9ccc65,
  support: 0xfff176,
  debuff: 0x4db6ac,
  tanker: 0x90a4ae,
};
