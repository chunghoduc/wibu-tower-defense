// src/scenes/itemFilter.ts
// Chip-row UI for the shared item "category" sub-filter (Hero inventory + Shop
// sell). The pure category taxonomy (slotInCategory / ItemCategory) lives in
// itemCategory.ts so it stays unit-testable; this file only builds the Phaser
// chips and re-exports the taxonomy for the scenes that consume both together.
import Phaser from "phaser";
import { crispText } from "./ui.ts";
import { CATS, type ItemCategory } from "./itemCategory.ts";

export { slotInCategory } from "./itemCategory.ts";
export type { ItemCategory } from "./itemCategory.ts";

export interface CategoryChips {
  chips: Phaser.GameObjects.Text[];
  /** Show/hide the whole row (e.g. only on the Items / Sell view). */
  setVisible(v: boolean): void;
  /** Repaint the active-state highlight for the currently selected category. */
  update(active: ItemCategory): void;
}

/**
 * A compact left-aligned row of category filter chips starting at (x, y).
 * `onPick` fires with the chosen category; the caller owns the selected state
 * and should call `update()` to repaint highlights after handling the pick.
 */
export function buildCategoryChips(
  scene: Phaser.Scene,
  x: number,
  y: number,
  onPick: (c: ItemCategory) => void,
): CategoryChips {
  const chips: Phaser.GameObjects.Text[] = [];
  let cx = x;
  for (const cat of CATS) {
    const t = crispText(scene, cx, y, cat.label, {
      fontSize: "11px",
      color: "#fff",
      backgroundColor: "#16222f",
    })
      .setOrigin(0, 0)
      .setPadding(8, 3, 8, 3)
      .setInteractive({ useHandCursor: true });
    t.setData("cat", cat.id);
    t.on("pointerup", () => onPick(cat.id));
    chips.push(t);
    cx += t.width + 6;
  }
  return {
    chips,
    setVisible(v) {
      for (const c of chips) c.setVisible(v);
    },
    update(active) {
      for (const c of chips) {
        const on = c.getData("cat") === active;
        c.setBackgroundColor(on ? "#2a4a6a" : "#16222f").setAlpha(on ? 1 : 0.6);
      }
    },
  };
}
