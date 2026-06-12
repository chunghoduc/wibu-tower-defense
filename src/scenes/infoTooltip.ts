// src/scenes/infoTooltip.ts
//
// A small, self-sizing tooltip card for rewards that aren't full equipment
// (currency, jewels, skills, characters, materials). Equipment keeps using the
// richer renderItemTooltip; everything else renders here as a titled card with
// an optional subtitle line and a wrapped body. Pure presentation: clears the
// given container, builds the card near (x, y) clamped on-screen, and shows it.
import Phaser from "phaser";
import { panelText } from "./ui.ts";

export interface InfoTooltipData {
  title: string;
  /** Hex colour for the title (e.g. rarity colour). */
  titleColor?: string;
  /** A short qualifier line under the title (e.g. "Rare Jewel"). */
  subtitle?: string;
  /** The description / detail paragraph. */
  body?: string;
  /** Border colour (int) — usually the rarity colour. */
  borderColor?: number;
}

const PAD = 10;
const W = 224;

/** Render a titled info card into `c` near (x, y) and show it. */
export function renderInfoTooltip(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  data: InfoTooltipData,
  x: number,
  y: number,
): void {
  // Drawn at absolute coordinates (container left at the origin) so this card can
  // share a tooltip container with renderItemTooltip without a double offset.
  c.removeAll(true);
  c.setPosition(0, 0);
  const innerW = W - PAD * 2;

  // Lay the text out from a local y=0 first to measure the card height, then
  // offset every line by (tx, ty) once the clamped position is known.
  const lines: { t: Phaser.GameObjects.Text; dy: number }[] = [];
  let cy = PAD;

  const title = panelText(scene, 0, 0, data.title, {
    fontSize: "14px",
    color: data.titleColor ?? "#ffe9b0",
    fontStyle: "bold",
    wordWrap: { width: innerW },
  });
  lines.push({ t: title, dy: cy });
  cy += title.height + 3;

  if (data.subtitle) {
    const sub = panelText(scene, 0, 0, data.subtitle, { fontSize: "11px", color: "#aebfd4" });
    lines.push({ t: sub, dy: cy });
    cy += sub.height + 5;
  }
  if (data.body) {
    const body = panelText(scene, 0, 0, data.body, {
      fontSize: "11px",
      color: "#cdd6e6",
      wordWrap: { width: innerW },
      lineSpacing: 3,
    });
    lines.push({ t: body, dy: cy });
    cy += body.height;
  }
  const h = cy + PAD;

  const tx = Phaser.Math.Clamp(x + 28, 4, scene.scale.width - W - 4);
  const ty = Phaser.Math.Clamp(y - 10, 4, scene.scale.height - h - 4);

  const g = scene.add.graphics();
  g.fillStyle(0x10141c, 0.97).fillRoundedRect(tx, ty, W, h, 6);
  g.lineStyle(1.5, data.borderColor ?? 0x33405a, 1).strokeRoundedRect(tx, ty, W, h, 6);
  c.add(g);
  for (const { t, dy } of lines) {
    t.setPosition(tx + PAD, ty + dy);
    c.add(t);
  }
  c.setVisible(true);
}
