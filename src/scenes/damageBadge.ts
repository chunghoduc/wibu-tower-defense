/**
 * Pure (Phaser-free) helpers for the per-tower DAMAGE-TYPE badge. The badge tells
 * Physical from Magic at a glance on a tower card: a steel blade glyph vs a violet
 * sparkle. This module is the single source for the damage->color map, the badge
 * placement geometry (mirror of roleBadge's, but upper-LEFT), and the normalized
 * glyph outlines, so the presenter (damageBadgeFx) and tests agree.
 */
import type { AttackDamageType } from "../data/schema.ts";

export type Vec2 = { x: number; y: number };

/** Tint for each damage type's badge glyph + ring. Steel blue vs arcane violet,
 *  chosen to not clash with the role-badge tints. Dual-coded with the glyph shape. */
export const DAMAGE_BADGE_COLOR: Record<AttackDamageType, number> = {
  Physical: 0x9fb4cc,
  Magic: 0xc18cff,
};

/** Badge placement on a tower card (local coords, card centered at 0,0). Mirror of
 *  roleBadgeOnCard — pinned to the card's upper-LEFT so it never overlaps the role
 *  emblem on the upper-right. */
export function damageBadgeOnCard(cardWidth: number): { x: number; y: number; diameter: number } {
  const diameter = Math.round(cardWidth * 0.22); // ~15px on the 66px build-bar card
  return { x: -(cardWidth / 2) + 9, y: -8, diameter };
}

/** Normalized glyph outline (points in unit space, |x|<=1 and |y|<=1) for the given
 *  damage type. Physical = an upright sword silhouette; Magic = a 4-point sparkle.
 *  The presenter scales by the badge radius and translates to the badge center. */
export function damageGlyphPoints(dt: AttackDamageType): Vec2[] {
  if (dt === "Magic") {
    // 4-point sparkle: alternating outer tips / inner waist.
    return [
      { x: 0, y: -1 },
      { x: 0.22, y: -0.22 },
      { x: 1, y: 0 },
      { x: 0.22, y: 0.22 },
      { x: 0, y: 1 },
      { x: -0.22, y: 0.22 },
      { x: -1, y: 0 },
      { x: -0.22, y: -0.22 },
    ];
  }
  // Physical: upright sword (tip up, crossguard, handle).
  return [
    { x: 0, y: -1 },
    { x: 0.18, y: -0.55 },
    { x: 0.18, y: 0.15 },
    { x: 0.5, y: 0.15 },
    { x: 0.5, y: 0.32 },
    { x: 0.12, y: 0.32 },
    { x: 0.12, y: 1 },
    { x: -0.12, y: 1 },
    { x: -0.12, y: 0.32 },
    { x: -0.5, y: 0.32 },
    { x: -0.5, y: 0.15 },
    { x: -0.18, y: 0.15 },
    { x: -0.18, y: -0.55 },
  ];
}
