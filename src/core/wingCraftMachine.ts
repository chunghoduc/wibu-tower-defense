/**
 * Pure geometry + gating for the Craft Wings machine UI. No Phaser. The craft
 * engine (success %, outcome odds, the actual craft) lives in wingCraft.ts; this
 * module only decides "can the player craft yet?" and where every piece is drawn.
 */
import { MIN_ITEMS, MAX_JEWELS } from "./wingCraft.ts";
import type { Rarity } from "../data/schema.ts";

export interface MachineGate {
  canCraft: boolean;
  needItems: number; // how many MORE items are required (0 when satisfied)
  hasJewel: boolean; // ≥1 jewel loaded AND that many owned
  hasFeather: boolean; // feather loaded AND ≥1 owned
}

export function wingCraftGate(input: {
  itemCount: number;
  jewels: number;
  feather: boolean;
  jewelsOwned: number;
  feathersOwned: number;
}): MachineGate {
  const needItems = Math.max(0, MIN_ITEMS - input.itemCount);
  const hasJewel =
    input.jewels >= 1 && input.jewels <= MAX_JEWELS && input.jewelsOwned >= input.jewels;
  const hasFeather = input.feather && input.feathersOwned >= 1;
  return { canCraft: needItems === 0 && hasJewel && hasFeather, needItems, hasJewel, hasFeather };
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface MachineLayout {
  panel: Rect;
  machine: Rect; // the cauldron / drop zone
  jewelSocket: Rect;
  featherSocket: Rect;
  readout: Rect;
  oddsBar: Rect;
  filterRow: Rect; // rarity chip strip (left of the control row)
  autoBtn: Rect; // Auto-fill button (control row)
  clearBtn: Rect; // Clear button (control row)
  craftBtn: Rect;
  tray: Rect; // scrollable gear grid viewport
  cell: number; // tile pitch (px)
  cols: number; // tiles per tray row
  rowsVisible: number; // tray rows shown at once
}

const PAD = 16;

/** Centered modal: machine (with material sockets) on top, readout, control row, tray. */
export function wingMachineLayout(W: number, H: number): MachineLayout {
  const bw = 600;
  const bh = 500;
  const bx = (W - bw) / 2;
  const by = (H - bh) / 2;
  const panel: Rect = { x: bx, y: by, w: bw, h: bh };

  const innerX = bx + PAD;
  const innerW = bw - PAD * 2;

  const machine: Rect = { x: innerX, y: by + 40, w: innerW, h: 120 };

  // Material sockets hug the machine's right edge (top: jewel, below: feather).
  const sock = 44;
  const jewelSocket: Rect = {
    x: machine.x + machine.w - sock - 10,
    y: machine.y + 10,
    w: sock,
    h: sock,
  };
  const featherSocket: Rect = { x: jewelSocket.x, y: jewelSocket.y + sock + 8, w: sock, h: sock };

  const readout: Rect = { x: innerX, y: machine.y + machine.h + 8, w: innerW, h: 80 };
  const oddsBar: Rect = { x: readout.x + 8, y: readout.y + 56, w: readout.w - 16, h: 18 };

  // Control row: filter chips on the left, Auto + Clear on the right.
  const ctrlY = readout.y + readout.h + 6;
  const ctrlH = 28;
  const btnW = 58;
  const clearBtn: Rect = { x: innerX + innerW - btnW, y: ctrlY, w: btnW, h: ctrlH };
  const autoBtn: Rect = { x: clearBtn.x - 6 - btnW, y: ctrlY, w: btnW, h: ctrlH };
  const filterRow: Rect = { x: innerX, y: ctrlY, w: autoBtn.x - 6 - innerX, h: ctrlH };

  const craftBtn: Rect = { x: innerX, y: by + bh - 46, w: innerW - 96, h: 36 };

  const trayY = ctrlY + ctrlH + 6;
  const tray: Rect = { x: innerX, y: trayY, w: innerW, h: craftBtn.y - trayY - 8 };

  const cell = 46;
  const cols = Math.max(1, Math.floor(tray.w / cell));
  const rowsVisible = Math.max(1, Math.floor(tray.h / cell));

  return {
    panel,
    machine,
    jewelSocket,
    featherSocket,
    readout,
    oddsBar,
    filterRow,
    autoBtn,
    clearBtn,
    craftBtn,
    tray,
    cell,
    cols,
    rowsVisible,
  };
}

/** Centered, wrapping grid of up to `count` loaded item icons inside `machine`. */
export function loadedSlotLayout(
  count: number,
  machine: Rect,
  cell = 34,
): { x: number; y: number }[] {
  if (count <= 0) return [];
  const pad = 12;
  const usableW = machine.w - pad * 2 - 60; // leave room for the right-edge sockets
  const perRow = Math.max(1, Math.floor(usableW / cell));
  const rows = Math.max(1, Math.ceil(count / perRow));
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) {
    const r = Math.floor(i / perRow);
    const col = i % perRow;
    const rowCount = Math.min(perRow, count - r * perRow);
    const rowW = rowCount * cell;
    const startX = machine.x + pad + (usableW - rowW) / 2 + cell / 2;
    const startY = machine.y + pad + cell / 2 + (machine.h - pad * 2 - rows * cell) / 2;
    pts.push({ x: startX + col * cell, y: startY + r * cell });
  }
  return pts;
}

export interface OddsSegment {
  rarity: Rarity;
  x: number;
  w: number;
  chance: number;
}

/** Contiguous colored segments tiling `bar.w`; last absorbs rounding. */
export function oddsBarSegments(
  odds: { rarity: Rarity; chance: number }[],
  bar: Rect,
): OddsSegment[] {
  const total = odds.reduce((s, o) => s + o.chance, 0) || 1;
  const segs: OddsSegment[] = [];
  let x = bar.x;
  odds.forEach((o, i) => {
    const w = i === odds.length - 1 ? bar.x + bar.w - x : (o.chance / total) * bar.w;
    segs.push({ rarity: o.rarity, x, w, chance: o.chance });
    x += w;
  });
  return segs;
}
