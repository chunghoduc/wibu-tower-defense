// src/scenes/scrollDrag.ts
//
// Touch/drag scrolling for the row-windowed grids (inventory, sell shop). The
// wheel handlers in those scenes only fire on desktop; mobile needs to drag the
// list. This tracks a vertical pointer drag inside a viewport rect and converts
// the distance into a row offset, deferring to any in-progress object drag
// (e.g. dragging a tile to equip it) and flagging gestures that actually moved
// so callers can suppress the tap action (enhance / sell) on release.
import type Phaser from "phaser";
import {
  TAP_SLOP_PX,
  flickVelocity,
  decayVelocity,
  isFlick,
  type FlickSample,
  FLICK_SAMPLE_WINDOW_MS,
} from "../core/gesture.ts";

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

/** Pure: clamped row-offset after `px` of content scroll (positive = content moves
 *  up, revealing lower rows) from `startOffset`. Used by the momentum fling. */
export function offsetFromPixels(
  startOffset: number,
  px: number,
  rowH: number,
  maxOffset: number,
): number {
  return clamp(startOffset + Math.round(px / rowH), 0, maxOffset);
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
  let samples: FlickSample[] = [];

  // Momentum fling state.
  let flinging = false;
  let flingVel = 0; // px/ms
  let flingPx = 0; // accumulated content-pixel travel since the fling began
  let flingStartOffset = 0;

  const inside = (px: number, py: number): boolean => {
    const r = cfg.rect();
    return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
  };

  function onFlingStep(_time: number, delta: number): void {
    if (!flinging) return;
    flingVel = decayVelocity(flingVel, delta);
    // A drag up (finger up) yields a negative velocity but should INCREASE the
    // offset (reveal lower rows) — same sign convention as dragOffset, so negate.
    flingPx += -flingVel * delta;
    const next = offsetFromPixels(flingStartOffset, flingPx, cfg.rowH, cfg.maxOffset());
    if (next !== cfg.getOffset()) {
      cfg.setOffset(next);
      cfg.onChange();
    }
    if (flingVel === 0 || next <= 0 || next >= cfg.maxOffset()) stopFling();
  }

  function stopFling(): void {
    if (!flinging) return;
    flinging = false;
    flingVel = 0;
    scene.events.off("update", onFlingStep);
  }

  scene.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
    stopFling(); // touching the list halts momentum, like native scroll
    scrolled = false;
    if (cfg.enabled && !cfg.enabled()) return;
    if (cfg.blocked && cfg.blocked()) return;
    if (cfg.maxOffset() <= 0 || !inside(p.x, p.y)) return;
    tracking = true;
    startY = p.y;
    startOffset = cfg.getOffset();
    samples = [{ pos: p.y, t: scene.time.now }];
  });

  scene.input.on("pointermove", (p: Phaser.Input.Pointer) => {
    if (!tracking || !p.isDown) return;
    if (cfg.blocked && cfg.blocked()) {
      tracking = false;
      return;
    } // a tile-drag took over
    if (Math.abs(p.y - startY) > TAP_SLOP_PX) scrolled = true;
    samples.push({ pos: p.y, t: scene.time.now });
    // Keep only the recent window (plus the immediately-preceding sample).
    const cutoff = scene.time.now - FLICK_SAMPLE_WINDOW_MS;
    while (samples.length > 2 && samples[1].t < cutoff) samples.shift();
    const next = dragOffset(startOffset, startY, p.y, cfg.rowH, cfg.maxOffset());
    if (next !== cfg.getOffset()) {
      cfg.setOffset(next);
      cfg.onChange();
    }
  });

  const endGesture = (): void => {
    if (!tracking) return;
    tracking = false;
    const vel = flickVelocity(samples);
    samples = [];
    if (!isFlick(vel) || cfg.maxOffset() <= 0) return;
    flinging = true;
    flingVel = vel;
    flingPx = 0;
    flingStartOffset = cfg.getOffset();
    scene.events.on("update", onFlingStep);
  };

  scene.input.on("pointerup", endGesture);
  scene.input.on("pointercancel", () => {
    tracking = false;
    samples = [];
    stopFling();
  });
  // Defensive: tear down the fling loop when the scene shuts down / restarts.
  scene.events.once("shutdown", stopFling);
  scene.events.once("destroy", stopFling);

  return { didScroll: () => scrolled };
}
