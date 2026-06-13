/**
 * homeLayout — pure, Phaser-free geometry for the main-menu home screen:
 * a top resource bar (brand + gold/diamond pills) and the bottom navigation
 * (framed panel + primary BATTLE CTA + secondary destination grid).
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
  cells: NavCell[];
  rowDivider?: number;
}

const COLS = 6;
const MARGIN = 12;
const CELL_W = 140;
const CELL_H = 46;
const ROW_GAP = 8;
const PRIMARY_H = 42;
const PRIMARY_GAP = 10;

/**
 * Bottom navigation: a framed dock panel holding a wide primary BATTLE CTA above
 * a centred, row-major grid of `secondaryCount` destination cells.
 */
export function homeNavLayout(secondaryCount: number, W: number, H: number): NavLayout {
  const rows = Math.max(1, Math.ceil(secondaryCount / COLS));
  const cols = Math.min(COLS, secondaryCount);
  const gridW = cols * CELL_W;
  const gridH = rows * CELL_H + (rows - 1) * ROW_GAP;
  const innerW = gridW;
  const panelH = PRIMARY_H + PRIMARY_GAP + gridH + MARGIN * 2;
  const panel: Rect = {
    x: Math.round(W / 2 - innerW / 2 - MARGIN),
    y: Math.round(H - panelH - 8),
    w: innerW + MARGIN * 2,
    h: panelH,
  };
  const primary: Rect = {
    x: panel.x + MARGIN,
    y: panel.y + MARGIN,
    w: panel.w - MARGIN * 2,
    h: PRIMARY_H,
  };
  const x0 = W / 2 - gridW / 2 + CELL_W / 2;
  const y0 = primary.y + PRIMARY_H + PRIMARY_GAP + CELL_H / 2;
  const cells: NavCell[] = [];
  for (let i = 0; i < secondaryCount; i++) {
    const r = Math.floor(i / COLS);
    const c = i % COLS;
    const inRow = Math.min(COLS, secondaryCount - r * COLS);
    const rowOffset = ((COLS - inRow) * CELL_W) / 2;
    cells.push({
      x: Math.round(x0 + c * CELL_W + rowOffset),
      y: Math.round(y0 + r * (CELL_H + ROW_GAP)),
      w: CELL_W,
      h: CELL_H,
    });
  }
  const rowDivider = rows > 1 ? Math.round(y0 + CELL_H / 2 + ROW_GAP / 2) : undefined;
  return { panel, primary, cells, rowDivider };
}
