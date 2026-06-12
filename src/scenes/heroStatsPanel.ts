/**
 * heroStatsPanel — renders the hero's fully-resolved total stats beneath the
 * equipment paper-doll on the Inventory screen. The pure selection+formatting
 * core lives in `heroStatRows.ts`; this is the Phaser presenter.
 */
import Phaser from "phaser";
import { crispText } from "./ui.ts";
import type { HeroSave } from "../core/save.ts";
import { resolveHeroBattleStats } from "../core/heroStats.ts";
import { defaultHeroStats } from "../data/stage.ts";
import { heroStatRows } from "./heroStatRows.ts";

export interface PanelBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Render the hero's resolved total stats into `container` within `box`.
 * The caller owns `container`'s lifecycle (clear-and-rebuild on refresh); this
 * only appends the header + a 2-column stat grid (frame is drawn by the caller).
 */
export function renderHeroStats(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  box: PanelBox,
  save: HeroSave,
): void {
  const stats = resolveHeroBattleStats(save, defaultHeroStats()).stats;
  const rows = heroStatRows(stats);

  const px = box.x + 10,
    py = box.y + 8;
  container.add(
    crispText(scene, px, py, "Total Stats", {
      fontSize: "11px",
      color: "#ffd86a",
      fontStyle: "bold",
    }),
  );

  const gridTop = py + 18;
  const colW = (box.w - 20) / 2;
  const perCol = Math.ceil(rows.length / 2);
  rows.forEach(({ label, value }, i) => {
    const col = Math.floor(i / perCol),
      row = i % perCol;
    const cx = px + col * colW,
      cy = gridTop + row * 16;
    container.add(crispText(scene, cx, cy, label, { fontSize: "9px", color: "#8fa0b4" }));
    container.add(
      crispText(scene, cx + colW - 12, cy, value, {
        fontSize: "9px",
        color: "#e8eef6",
        fontStyle: "bold",
      }).setOrigin(1, 0),
    );
  });
}
