/**
 * rerollAffixRender — the two affix presenters for the Reroll dialog's detail
 * panel: a plain colour-coded list of the current affixes, and a Previous → New
 * two-column comparison shown right after a reroll. Kept separate so the dialog
 * file stays focused (and under the line limit). Each appends to the caller's
 * container and returns the next free y.
 */
import type Phaser from "phaser";
import { crispText } from "./ui.ts";
import { SOURCE_COLOR, QUALITY_COLOR, type ItemStatRow } from "../data/itemDisplay.ts";

type Layer = Phaser.GameObjects.Container;

/** One affix as an inline coloured sentence: prefix (source) + value (quality) + suffix. */
function affixSentence(
  scene: Phaser.Scene,
  layer: Layer,
  r: ItemStatRow,
  x: number,
  y: number,
  fs: string,
): void {
  let cx = x;
  const before = crispText(scene, cx, y, r.before, { fontSize: fs, color: SOURCE_COLOR.affix });
  layer.add(before);
  cx += before.width;
  const val = crispText(scene, cx, y, r.value, {
    fontSize: fs,
    color: QUALITY_COLOR[r.quality],
    fontStyle: "bold",
  });
  layer.add(val);
  cx += val.width;
  layer.add(crispText(scene, cx, y, r.after, { fontSize: fs, color: SOURCE_COLOR.affix }));
}

/** The current affixes as a simple coloured list. Returns the next free y. */
export function renderAffixRows(
  scene: Phaser.Scene,
  layer: Layer,
  rows: ItemStatRow[],
  x: number,
  y0: number,
): number {
  if (rows.length === 0) {
    layer.add(crispText(scene, x, y0, "—", { fontSize: "11px", color: "#7c8aa0" }));
    return y0 + 16;
  }
  let y = y0;
  for (const r of rows) {
    affixSentence(scene, layer, r, x, y, "11px");
    y += 17;
  }
  return y;
}

/** Two columns: faded Previous (left), bright New roll (right), with a divider. */
export function renderComparison(
  scene: Phaser.Scene,
  layer: Layer,
  detX: number,
  detW: number,
  y0: number,
  before: ItemStatRow[],
  after: ItemStatRow[],
): number {
  const colW = (detW - 18) / 2;
  const rightX = detX + colW + 18;
  layer.add(
    crispText(scene, detX, y0, "Previous", {
      fontSize: "11px",
      color: "#7c8aa0",
      fontStyle: "bold",
    }),
  );
  layer.add(
    crispText(scene, rightX, y0, "New roll", {
      fontSize: "11px",
      color: "#6ee06e",
      fontStyle: "bold",
    }),
  );
  const lines = Math.max(before.length, after.length);
  const div = scene.add.graphics();
  div
    .lineStyle(1, 0x2a3650, 0.9)
    .lineBetween(detX + colW + 9, y0 + 2, detX + colW + 9, y0 + 18 + lines * 17);
  layer.add(div);
  let y = y0 + 16;
  for (let i = 0; i < lines; i++) {
    if (before[i]) {
      const r = before[i];
      layer.add(
        crispText(scene, detX, y, `${r.before}${r.value}${r.after}`, {
          fontSize: "10px",
          color: "#67738a",
        }).setFixedSize(colW, 13),
      );
    }
    if (after[i]) affixSentence(scene, layer, after[i], rightX, y, "10px");
    y += 17;
  }
  return y;
}
