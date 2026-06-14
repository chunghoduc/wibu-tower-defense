// src/scenes/tooltipLayer.ts
//
// Single source of truth for the "always on top" tooltip layer. Stat/info
// tooltips (renderItemTooltip / renderInfoTooltip) must draw above every other
// UI element — buttons, dialogs, overlays — so the player can always read the
// stats they hovered to see. The highest dialog/overlay depth in the codebase
// is 320 (wingCraftDialog); TOOLTIP_DEPTH sits far above that with headroom.
// Nothing else may use this depth.

/** Reserved render depth for stat/info tooltips — above all other UI. */
export const TOOLTIP_DEPTH = 10_000;

/** Minimal structural view of a Phaser container, for testability. */
interface FloatableContainer {
  setDepth(value: number): unknown;
  parentContainer?: { bringToTop(child: unknown): unknown } | null;
}

/**
 * Raise a tooltip container to the always-on-top layer. Sets its scene depth to
 * TOOLTIP_DEPTH and, if it is nested inside another container, also brings it to
 * the top of that parent's local z-order (depth only sorts within a parent).
 */
export function floatTooltip(c: FloatableContainer): void {
  c.setDepth(TOOLTIP_DEPTH);
  c.parentContainer?.bringToTop(c);
}
