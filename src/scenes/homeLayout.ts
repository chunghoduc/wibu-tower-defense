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
  /** Big square primary BATTLE call-to-action, anchored in the bottom-right
   *  corner — larger than every menu icon so it reads as the one main action. */
  battle: Rect;
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
const BATTLE_SIZE = 112; // square side — clearly bigger than the 44–52px menu icons
const BATTLE_MARGIN = 14; // gap from the screen corner

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
 * buttons at the screen edges, a centered bottom dock holding the system row of
 * `counts.bottom` cells, and the big square BATTLE CTA in the bottom-right
 * corner (the one primary action, larger than every menu icon).
 */
export function homeNavLayout(
  counts: { left: number; right: number; bottom: number },
  W: number,
  H: number,
): NavLayout {
  const left = rail(counts.left, MARGIN + RAIL_W / 2, H);
  const right = rail(counts.right, W - MARGIN - RAIL_W / 2, H);

  // Centered dock: just the secondary system row now that BATTLE has moved out.
  const rowW = counts.bottom * BOTTOM_CELL_W;
  const panelH = BOTTOM_CELL_H + MARGIN * 2;
  const panel: Rect = {
    x: Math.round(W / 2 - rowW / 2 - MARGIN),
    y: Math.round(H - panelH - 8),
    w: rowW + MARGIN * 2,
    h: panelH,
  };
  const y0 = panel.y + MARGIN + BOTTOM_CELL_H / 2;
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

  // Big square BATTLE button hugging the bottom-right corner.
  const battle: Rect = {
    x: W - BATTLE_MARGIN - BATTLE_SIZE,
    y: H - BATTLE_MARGIN - BATTLE_SIZE,
    w: BATTLE_SIZE,
    h: BATTLE_SIZE,
  };
  return { panel, battle, left, right, bottom };
}
