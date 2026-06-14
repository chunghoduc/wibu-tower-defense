// src/core/wingTray.ts
//
// Pure tray math for the Craft Wings dialog: which rarity chips to show, filtering
// the gear list, the cheapest valid Auto-fill selection, and the row-window for the
// scrollable grid. No Phaser. The presenter (wingCraftTray.ts) renders these.
import { RARITIES, type Rarity } from "../data/schemaEnums.ts";

export interface WingItemLike {
  id: string;
  rarity: Rarity;
}

export type WingFilter = Rarity | "all";

const rank = (r: Rarity): number => RARITIES.indexOf(r);

/** Distinct rarities present in `items`, in ladder order (for the chip row). */
export function wingRarityFilters(items: WingItemLike[]): Rarity[] {
  const present = new Set(items.map((i) => i.rarity));
  return RARITIES.filter((r) => present.has(r));
}

/** Items matching `filter` ("all" -> every item), original order preserved. */
export function filterWingItems<T extends WingItemLike>(items: T[], filter: WingFilter): T[] {
  return filter === "all" ? items.slice() : items.filter((i) => i.rarity === filter);
}

/** Cheapest valid auto-fill: lowest-rarity `need` unselected items + 1 jewel + feather. */
export function autoWingSelection(
  items: WingItemLike[],
  opts: { need: number; jewelCap: number; feathersOwned: number; selected: Set<string> },
): { ids: string[]; jewels: number; feather: boolean } {
  const pool = items
    .map((it, i) => ({ it, i }))
    .filter(({ it }) => !opts.selected.has(it.id))
    .sort((a, b) => rank(a.it.rarity) - rank(b.it.rarity) || a.i - b.i);
  const ids = pool.slice(0, Math.max(0, opts.need)).map((p) => p.it.id);
  return {
    ids,
    jewels: Math.min(1, Math.max(0, opts.jewelCap)),
    feather: opts.feathersOwned >= 1,
  };
}

export interface TrayWindow {
  startRow: number; // first visible row (clamped offset)
  visibleCount: number; // number of tiles in the window
  maxOffset: number; // max scroll offset in rows
  rows: number; // total rows
}

/** Row-window over a `cols`-wide grid showing `rowsVisible` rows from `offset`. */
export function trayWindow(
  count: number,
  cols: number,
  rowsVisible: number,
  offset: number,
): TrayWindow {
  const c = Math.max(1, cols);
  const rv = Math.max(1, rowsVisible);
  const rows = Math.ceil(count / c);
  const maxOffset = Math.max(0, rows - rv);
  const startRow = Math.min(Math.max(0, Math.round(offset)), maxOffset);
  const start = startRow * c;
  const end = Math.min(count, start + rv * c);
  return { startRow, visibleCount: Math.max(0, end - start), maxOffset, rows };
}
