/**
 * Pure, Phaser-free geometry for the main-menu bottom navigation dock: a framed
 * panel holding the destination buttons in a centred row-major grid. Deterministic
 * and unit-tested (see tests/menuLayout.test.ts). MainMenuScene is the presenter.
 */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface DockCell {
  x: number; // cell centre
  y: number;
  w: number; // cell box
  h: number;
}
export interface DockLayout {
  panel: Rect;
  cells: DockCell[];
}

const COLS = 6;
const MARGIN = 14; // panel inner padding / gap from screen edge
const CELL_W = 140;
const CELL_H = 50;
const ROW_GAP = 8;

/** Lay `count` items into a centred COLS-wide row-major grid inside a bottom dock panel. */
export function dockLayout(count: number, W: number, H: number): DockLayout {
  const rows = Math.max(1, Math.ceil(count / COLS));
  const cols = Math.min(COLS, count);
  const gridW = cols * CELL_W;
  const gridH = rows * CELL_H + (rows - 1) * ROW_GAP;
  const panel: Rect = {
    x: Math.round(W / 2 - gridW / 2 - MARGIN),
    y: Math.round(H - gridH - MARGIN * 2 - 8),
    w: gridW + MARGIN * 2,
    h: gridH + MARGIN * 2,
  };
  const x0 = W / 2 - gridW / 2 + CELL_W / 2;
  const y0 = panel.y + MARGIN + CELL_H / 2;
  const cells: DockCell[] = [];
  for (let i = 0; i < count; i++) {
    const r = Math.floor(i / COLS);
    const c = i % COLS;
    // centre a final, possibly-short row under the full rows above it
    const inRow = Math.min(COLS, count - r * COLS);
    const rowOffset = ((COLS - inRow) * CELL_W) / 2;
    cells.push({
      x: Math.round(x0 + c * CELL_W + rowOffset),
      y: Math.round(y0 + r * (CELL_H + ROW_GAP)),
      w: CELL_W,
      h: CELL_H,
    });
  }
  return { panel, cells };
}
