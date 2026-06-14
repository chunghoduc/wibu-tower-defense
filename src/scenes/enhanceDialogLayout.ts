// src/scenes/enhanceDialogLayout.ts
//
// Pure geometry for the item-enhance modal (itemEnhanceDialog.ts). Kept Phaser-
// free and tested so the panel height, the two info lines and the Enhance button
// can never overlap again: the historical bug sized the panel for the base-stat
// count while the body actually rendered one extra row (the primary affix), so
// the button landed on the "Success %" line. Sizing everything from one row count
// here makes the layout self-consistent.

/** Y of the first stat row, relative to the panel top. */
export const STATS_TOP = 44;
/** Vertical step between stat rows. */
export const ROW_H = 20;

// Gaps below, each measured from the previous element's top.
const INFO_GAP = 12; // last stat row → "Needs …" line
const SUCCESS_GAP = 22; // "Needs …" → "Success %" line
const BUTTON_GAP = 30; // "Success %" → Enhance button
/** Rendered height of the Enhance button (font + vertical padding). */
const BUTTON_H = 32;
const BOTTOM_PAD = 16; // button bottom → panel bottom

export interface EnhanceLayout {
  /** Total panel height. */
  H: number;
  /** Y of the first stat row. */
  statsTop: number;
  /** Vertical step between stat rows. */
  rowH: number;
  /** Y of the "Needs <jewel>" line. */
  needsY: number;
  /** Y of the "Success %" line. */
  successY: number;
  /** Y (top, origin 0.5,0) of the Enhance/Equip buttons. */
  buttonY: number;
  /** Height of the Enhance button. */
  buttonH: number;
}

/**
 * Compute the enhance-dialog geometry for `rowCount` rendered stat rows (base
 * stats + the primary-affix row, i.e. `enhancePreviewRows(...).length`). An empty
 * list still reserves one row for the "No scaling stats." placeholder.
 */
export function enhanceDialogLayout(rowCount: number): EnhanceLayout {
  const n = Math.max(1, rowCount);
  const statsBottom = STATS_TOP + n * ROW_H;
  const needsY = statsBottom + INFO_GAP;
  const successY = needsY + SUCCESS_GAP;
  const buttonY = successY + BUTTON_GAP;
  const H = buttonY + BUTTON_H + BOTTOM_PAD;
  return { H, statsTop: STATS_TOP, rowH: ROW_H, needsY, successY, buttonY, buttonH: BUTTON_H };
}
