// src/scenes/wingCraftTray.ts
//
// The Craft Wings gear tray: a rarity-filter chip row above a row-windowed,
// scrollable, tap-to-load grid. Every tile is a hit Zone (always tappable, even when
// the icon texture is missing — then a rarity-colored letter tile is drawn). Pure
// tray math lives in core/wingTray.ts; this only renders + wires scroll.
import type Phaser from "phaser";
import { crispText } from "./ui.ts";
import { itemTex } from "../data/assetKeys.ts";
import { RARITY_INT, idealTextColor } from "../data/rarityColors.ts";
import { attachDragScroll, type DragScrollHandle } from "./scrollDrag.ts";
import {
  wingRarityFilters,
  filterWingItems,
  trayWindow,
  type WingFilter,
} from "../core/wingTray.ts";
import type { MachineLayout } from "../core/wingCraftMachine.ts";
import type { WingCraftItem } from "./wingCraftDialog.ts";

const ACCENT = 0x9a59d6;

export interface WingTrayOpts {
  scene: Phaser.Scene;
  parent: Phaser.GameObjects.Container;
  layout: MachineLayout;
  items: WingCraftItem[];
  isLoaded: (id: string) => boolean;
  onLoad: (id: string) => void; // load one gear item into the machine
}

export interface WingTrayHandle {
  render: () => void;
  destroy: () => void;
}

export function createWingTray(opts: WingTrayOpts): WingTrayHandle {
  const { scene, parent, layout: L, items } = opts;
  let filter: WingFilter = "all";
  let offset = 0;

  const chipLayer = scene.add.container(0, 0);
  const gridLayer = scene.add.container(0, 0);
  parent.add([chipLayer, gridLayer]);

  const visible = (): WingCraftItem[] => filterWingItems(items, filter);

  const drawChips = (): void => {
    chipLayer.removeAll(true);
    const rarities = wingRarityFilters(items);
    const chips: { key: WingFilter; label: string; col: number }[] = [
      { key: "all", label: "All", col: ACCENT },
      ...rarities.map((r) => ({ key: r as WingFilter, label: r[0], col: RARITY_INT[r] })),
    ];
    const chipW = Math.min(
      46,
      Math.floor((L.filterRow.w - (chips.length - 1) * 4) / Math.max(1, chips.length)),
    );
    let cx = L.filterRow.x;
    for (const o of chips) {
      const on = filter === o.key;
      const g = scene.add.graphics();
      g.fillStyle(o.col, on ? 0.95 : 0.18).fillRoundedRect(
        cx,
        L.filterRow.y,
        chipW,
        L.filterRow.h,
        6,
      );
      g.lineStyle(1, o.col, on ? 1 : 0.5).strokeRoundedRect(
        cx,
        L.filterRow.y,
        chipW,
        L.filterRow.h,
        6,
      );
      const t = crispText(scene, cx + chipW / 2, L.filterRow.y + L.filterRow.h / 2, o.label, {
        fontSize: "12px",
        color: on ? idealTextColor(o.col) : "#cdb8e6",
        fontStyle: "bold",
      }).setOrigin(0.5);
      const cap = o.key;
      const z = scene.add
        .zone(cx + chipW / 2, L.filterRow.y + L.filterRow.h / 2, chipW, L.filterRow.h)
        .setInteractive({ useHandCursor: true })
        .on("pointerup", () => {
          filter = cap;
          offset = 0;
          render();
        });
      chipLayer.add([g, t, z]);
      cx += chipW + 4;
    }
  };

  const drawGrid = (): void => {
    gridLayer.removeAll(true);
    const list = visible();
    const win = trayWindow(list.length, L.cols, L.rowsVisible, offset);
    offset = win.startRow; // keep state clamped
    const start = win.startRow * L.cols;
    for (let i = 0; i < win.visibleCount; i++) {
      const it = list[start + i];
      if (!it) continue;
      const cx = L.tray.x + (i % L.cols) * L.cell;
      const cy = L.tray.y + Math.floor(i / L.cols) * L.cell;
      const cxc = cx + L.cell / 2;
      const cyc = cy + L.cell / 2;
      const loaded = opts.isLoaded(it.id);
      const col = RARITY_INT[it.rarity];

      const ring = scene.add.graphics();
      ring
        .lineStyle(1, col, loaded ? 0.25 : 0.7)
        .strokeRoundedRect(cx + 2, cy + 2, L.cell - 6, L.cell - 6, 6);
      gridLayer.add(ring);

      const texKey = itemTex(it.defId);
      if (scene.textures.exists(texKey)) {
        const img = scene.add
          .image(cxc, cyc, texKey)
          .setDisplaySize(38, 38)
          .setAlpha(loaded ? 0.32 : 1);
        gridLayer.add(img);
      } else {
        // Fallback: rarity-colored letter tile so the item is visible + tappable.
        const g = scene.add.graphics();
        g.fillStyle(col, loaded ? 0.18 : 0.55).fillRoundedRect(
          cx + 5,
          cy + 5,
          L.cell - 12,
          L.cell - 12,
          6,
        );
        const letter = crispText(scene, cxc, cyc, (it.name[0] ?? "?").toUpperCase(), {
          fontSize: "16px",
          color: idealTextColor(col),
          fontStyle: "bold",
        })
          .setOrigin(0.5)
          .setAlpha(loaded ? 0.4 : 1);
        gridLayer.add([g, letter]);
      }

      const id = it.id;
      const z = scene.add
        .zone(cxc, cyc, L.cell, L.cell)
        .setInteractive({ useHandCursor: true })
        .on("pointerup", () => {
          if (scroll.didScroll()) return; // a scroll gesture, not a tap
          if (!opts.isLoaded(id)) opts.onLoad(id);
          render();
        });
      gridLayer.add(z);
    }
  };

  const maxOffset = (): number =>
    trayWindow(visible().length, L.cols, L.rowsVisible, offset).maxOffset;

  const scroll: DragScrollHandle = attachDragScroll(scene, {
    rect: () => L.tray,
    rowH: L.cell,
    maxOffset,
    getOffset: () => offset,
    setOffset: (n) => {
      offset = n;
    },
    onChange: () => drawGrid(),
  });

  function render(): void {
    drawChips();
    drawGrid();
  }

  render();

  return {
    render,
    destroy: () => {
      chipLayer.destroy();
      gridLayer.destroy();
    },
  };
}
