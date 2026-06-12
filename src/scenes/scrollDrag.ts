// src/scenes/scrollDrag.ts
//
// Touch/drag scrolling for the row-windowed grids (inventory, sell shop). The
// wheel handlers in those scenes only fire on desktop; mobile needs to drag the
// list. This tracks a vertical pointer drag inside a viewport rect and converts
// the distance into a row offset, deferring to any in-progress object drag
// (e.g. dragging a tile to equip it) and flagging gestures that actually moved
// so callers can suppress the tap action (enhance / sell) on release.
import type Phaser from "phaser";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), hi);

/** Pure: clamped row-offset for a drag anchored at `startY`/`startOffset`. */
export function dragOffset(
  startOffset: number,
  startY: number,
  currentY: number,
  rowH: number,
  maxOffset: number,
): number {
  const rows = Math.round((startY - currentY) / rowH);
  return clamp(startOffset + rows, 0, maxOffset);
}

export interface DragScrollConfig {
  /** Viewport the gesture must start inside (re-read each gesture — grids relayout). */
  rect: () => Rect;
  /** Height of one content row in px. */
  rowH: number;
  maxOffset: () => number;
  getOffset: () => number;
  setOffset: (n: number) => void;
  /** Redraw the windowed grid after the offset changes. */
  onChange: () => void;
  /** Gesture is only tracked when this is true (default: always). */
  enabled?: () => boolean;
  /** Skip while another drag owns the pointer (e.g. a tile being equipped). */
  blocked?: () => boolean;
}

export interface DragScrollHandle {
  /** True once the in-flight (or just-ended) gesture moved the list — use to suppress tap actions. */
  didScroll: () => boolean;
}

/** Wire pointer-drag scrolling into `scene` for one grid. Coexists with wheel handlers. */
export function attachDragScroll(scene: Phaser.Scene, cfg: DragScrollConfig): DragScrollHandle {
  let tracking = false,
    startY = 0,
    startOffset = 0,
    scrolled = false;
  const inside = (px: number, py: number): boolean => {
    const r = cfg.rect();
    return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
  };

  scene.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
    scrolled = false;
    if (cfg.enabled && !cfg.enabled()) return;
    if (cfg.blocked && cfg.blocked()) return;
    if (cfg.maxOffset() <= 0 || !inside(p.x, p.y)) return;
    tracking = true;
    startY = p.y;
    startOffset = cfg.getOffset();
  });

  scene.input.on("pointermove", (p: Phaser.Input.Pointer) => {
    if (!tracking || !p.isDown) return;
    if (cfg.blocked && cfg.blocked()) {
      tracking = false;
      return;
    } // a tile-drag took over
    if (Math.abs(p.y - startY) > 4) scrolled = true;
    const next = dragOffset(startOffset, startY, p.y, cfg.rowH, cfg.maxOffset());
    if (next !== cfg.getOffset()) {
      cfg.setOffset(next);
      cfg.onChange();
    }
  });

  scene.input.on("pointerup", () => {
    tracking = false;
  });

  return { didScroll: () => scrolled };
}
