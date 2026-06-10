// src/scenes/scrollbar.ts
import Phaser from "phaser";

export interface ScrollbarSpec {
  /** Left edge x of the 6px-wide track. */
  x: number;
  /** Top y of the track. */
  y: number;
  /** Track height in px. */
  h: number;
  /** Total number of rows of content. */
  total: number;
  /** Number of rows that fit in the viewport. */
  visible: number;
  /** Current scroll offset, in rows (0 = top). */
  offset: number;
}

/**
 * Draw a non-interactive vertical scrollbar indicator into `layer`, sized by the
 * ratio of visible rows to total rows. Nothing is drawn when everything fits
 * (`total <= visible`), so callers can always invoke it unconditionally.
 *
 * Scrolling itself is row-windowed by the caller (only on-screen tiles are
 * created), so this is purely a "there's more below/above" affordance.
 */
export function drawScrollbar(scene: Phaser.Scene, layer: Phaser.GameObjects.Container, o: ScrollbarSpec): void {
  if (o.total <= o.visible) return;
  const g = scene.add.graphics();
  g.fillStyle(0x0c121c, 0.6).fillRoundedRect(o.x, o.y, 6, o.h, 3);
  const thumbH = Math.max(24, (o.visible / o.total) * o.h);
  const maxOff = o.total - o.visible;
  const thumbY = o.y + (maxOff > 0 ? o.offset / maxOff : 0) * (o.h - thumbH);
  g.fillStyle(0x6f8bb0, 0.95).fillRoundedRect(o.x, thumbY, 6, thumbH, 3);
  layer.add(g);
}
