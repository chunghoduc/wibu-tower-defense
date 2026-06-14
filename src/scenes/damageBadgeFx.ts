/**
 * Thin presenter for the damage-type badge. Draws a small dark disc with a colored
 * ring and the damage-type glyph filled in the damage color, returning the Graphics
 * so the caller can add it to its own container at the chosen center. Pure draw, no
 * state — geometry/color/glyph all come from the pure damageBadge module.
 */
import Phaser from "phaser";
import type { AttackDamageType } from "../data/schema.ts";
import { DAMAGE_BADGE_COLOR, damageGlyphPoints } from "./damageBadge.ts";

/** Draw a damage badge centered at (cx, cy) with the given diameter. */
export function drawDamageBadge(
  scene: Phaser.Scene,
  cx: number,
  cy: number,
  diameter: number,
  dt: AttackDamageType,
): Phaser.GameObjects.Graphics {
  const r = diameter / 2;
  const color = DAMAGE_BADGE_COLOR[dt];
  const g = scene.add.graphics();
  // Disc backing + colored ring.
  g.fillStyle(0x141b28, 1).fillCircle(cx, cy, r);
  g.lineStyle(Math.max(1, r * 0.18), color, 1).strokeCircle(cx, cy, r);
  // Glyph: scale the normalized outline to ~62% of the radius, translate to center.
  const s = r * 0.62;
  const pts = damageGlyphPoints(dt).map((p) => new Phaser.Geom.Point(cx + p.x * s, cy + p.y * s));
  g.fillStyle(color, 1).fillPoints(pts, true);
  return g;
}
