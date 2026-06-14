// src/scenes/wingCraftDrag.ts
//
// Socket drawing for the Craft Wings machine. (Drag-to-machine was removed in the
// 2026-06-14 redesign — the tray is now tap-to-load + scroll.)
import type Phaser from "phaser";
import type { Rect } from "../core/wingCraftMachine.ts";

/** Filled, bordered material socket; brightens when `on`. */
export function drawSocket(g: Phaser.GameObjects.Graphics, r: Rect, on: boolean): void {
  g.fillStyle(on ? 0x3a2a55 : 0x201830, 0.95).fillRoundedRect(r.x, r.y, r.w, r.h, 8);
  g.lineStyle(2, on ? 0xffffff : 0x6a5a86, on ? 1 : 0.5).strokeRoundedRect(r.x, r.y, r.w, r.h, 8);
}
