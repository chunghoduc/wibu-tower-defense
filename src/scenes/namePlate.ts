// src/scenes/namePlate.ts
//
// Draws a tile "name plate": a darker rounded band at the bottom of a loot/reward
// tile holding the item/material name, auto-fitted (shrink-then-ellipsis) so the
// text is ALWAYS contained. One component for every loot tile, so the overflow
// bug cannot recur per call site. The line geometry + fit math are pure exports
// in labelFit.ts (tested there); this presenter only draws and places. Width
// measurement uses a cached canvas context matching the UI font.

import Phaser from "phaser";
import { crispText, UI_FONT_FAMILY } from "./ui.ts";
import { fitLabel, plateLineLayout, type Measure } from "./labelFit.ts";

export interface PlateOpts {
  width: number;        // tile width
  topY: number;         // y of the plate band's top edge (local to the tile container)
  height: number;       // band height
  radius: number;       // bottom-corner radius (matches the tile)
  accent: number;       // rarity / reward color for the top divider
  color: string;        // text color
  basePx?: number;
  minPx?: number;
  maxLines?: number;
  pad?: number;         // horizontal inset for text width
  corner?: "top" | "bottom"; // which tile edge the band hugs (default bottom)
}

let measureCtx: CanvasRenderingContext2D | null = null;
function canvasMeasure(): Measure {
  if (!measureCtx && typeof document !== "undefined") {
    measureCtx = document.createElement("canvas").getContext("2d");
  }
  return (text, px) => {
    if (!measureCtx) return text.length * px * 0.6; // headless fallback
    measureCtx.font = `bold ${px}px ${UI_FONT_FAMILY}`;
    return measureCtx.measureText(text).width;
  };
}

/** Draw the plate band + the fitted name into `container`. */
export function addNamePlate(
  scene: Phaser.Scene, container: Phaser.GameObjects.Container,
  text: string, opts: PlateOpts,
): void {
  const { width, topY, height, radius, accent, color } = opts;
  const basePx = opts.basePx ?? 10, minPx = opts.minPx ?? 7;
  const maxLines = opts.maxLines ?? 2, pad = opts.pad ?? 6;
  const corner = opts.corner ?? "bottom";

  // Band fill hugging the named tile edge (outer corners rounded), plus a thin
  // accent divider on the INNER edge so the name region reads as a "plate".
  const g = scene.add.graphics();
  g.fillStyle(0x0b1119, 1);
  const corners = corner === "bottom"
    ? { tl: 0, tr: 0, bl: radius, br: radius }
    : { tl: radius, tr: radius, bl: 0, br: 0 };
  g.fillRoundedRect(-width / 2, topY, width, height, corners);
  const dividerY = corner === "bottom" ? topY + 0.5 : topY + height - 0.5;
  g.lineStyle(1, accent, 0.5).beginPath();
  g.moveTo(-width / 2 + 1, dividerY);
  g.lineTo(width / 2 - 1, dividerY);
  g.strokePath();
  container.add(g);

  const plan = fitLabel(text, { maxWidth: width - pad * 2, maxLines, basePx, minPx }, canvasMeasure());
  const ys = plateLineLayout(topY, height, plan.lines.length, plan.fontPx);
  plan.lines.forEach((line, i) => {
    container.add(
      crispText(scene, 0, ys[i], line, {
        fontSize: `${plan.fontPx}px`, color, fontStyle: "bold", align: "center",
      }).setOrigin(0.5),
    );
  });
}
