/**
 * homeLayout — pure, Phaser-free geometry for the main-menu home screen:
 * a top resource bar (brand + gold/diamond pills) and the navigation:
 * left/right icon rails framing the diorama plus a bottom dock with the
 * primary BATTLE CTA and a centered system row.
 * Deterministic and unit-tested (tests/homeLayout.test.ts). MainMenuScene
 * is the presenter. See
 * docs/superpowers/specs/2026-06-13-home-screen-ux-redesign-design.md.
 */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export type Pill = Rect;

export interface TopBar {
  brand: { x: number; y: number };
  gold: Pill;
  diamonds: Pill;
}

const PILL_H = 28;
const PILL_W = 130; // wide enough for "💎 99999" with a right-aligned value
const TOP_MARGIN = 12;
const PILL_GAP = 10;

/** Brand anchor (top-left) + two framed resource pills anchored to the top-right. */
export function homeTopBar(W: number, _H: number): TopBar {
  const y = TOP_MARGIN;
  const gold: Pill = { x: W - TOP_MARGIN - PILL_W, y, w: PILL_W, h: PILL_H };
  const diamonds: Pill = { x: gold.x - PILL_GAP - PILL_W, y, w: PILL_W, h: PILL_H };
  const brand = { x: TOP_MARGIN, y: TOP_MARGIN };
  return { brand, gold, diamonds };
}

export interface NavCell {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface NavLayout {
  panel: Rect;
  primary: Rect;
  left: NavCell[];
  right: NavCell[];
  bottom: NavCell[];
}

const MARGIN = 12;
const RAIL_W = 60;
const RAIL_H = 52;
const RAIL_GAP = 14;
const RAIL_CENTER_Y = 0.46; // fraction of H — vertical midpoint of each rail stack
const BOTTOM_CELL_W = 132;
const BOTTOM_CELL_H = 46;
const PRIMARY_H = 42;
const PRIMARY_GAP = 10;

/** A vertically centered rail of `n` cells at a fixed x. */
function rail(n: number, x: number, H: number): NavCell[] {
  const step = RAIL_H + RAIL_GAP;
  const cy = H * RAIL_CENTER_Y;
  const cells: NavCell[] = [];
  for (let i = 0; i < n; i++) {
    cells.push({ x, y: Math.round(cy + (i - (n - 1) / 2) * step), w: RAIL_W, h: RAIL_H });
  }
  return cells;
}

/**
 * Home navigation framed around the diorama: a left rail + right rail of icon
 * buttons at the screen edges, and a bottom dock holding the wide primary
 * BATTLE CTA above a single centered row of `counts.bottom` cells.
 */
export function homeNavLayout(
  counts: { left: number; right: number; bottom: number },
  W: number,
  H: number,
): NavLayout {
  const left = rail(counts.left, MARGIN + RAIL_W / 2, H);
  const right = rail(counts.right, W - MARGIN - RAIL_W / 2, H);

  const rowW = counts.bottom * BOTTOM_CELL_W;
  const panelH = PRIMARY_H + PRIMARY_GAP + BOTTOM_CELL_H + MARGIN * 2;
  const panel: Rect = {
    x: Math.round(W / 2 - rowW / 2 - MARGIN),
    y: Math.round(H - panelH - 8),
    w: rowW + MARGIN * 2,
    h: panelH,
  };
  const primary: Rect = {
    x: panel.x + MARGIN,
    y: panel.y + MARGIN,
    w: panel.w - MARGIN * 2,
    h: PRIMARY_H,
  };
  const y0 = primary.y + PRIMARY_H + PRIMARY_GAP + BOTTOM_CELL_H / 2;
  const x0 = W / 2 - rowW / 2 + BOTTOM_CELL_W / 2;
  const bottom: NavCell[] = [];
  for (let i = 0; i < counts.bottom; i++) {
    bottom.push({
      x: Math.round(x0 + i * BOTTOM_CELL_W),
      y: Math.round(y0),
      w: BOTTOM_CELL_W,
      h: BOTTOM_CELL_H,
    });
  }
  return { panel, primary, left, right, bottom };
}
