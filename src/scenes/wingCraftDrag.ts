/**
 * Phaser drag plumbing for the Craft Wings machine: make a tray tile follow the
 * pointer and snap home on release, draw a material socket, and hit-test whether
 * the pointer is over the machine drop zone. Kept apart from wingCraftDialog so
 * the presenter stays focused on layout + state.
 */
import type Phaser from "phaser";
import type { Rect } from "../core/wingCraftMachine.ts";

/** Filled, bordered material socket; brightens when `on`. */
export function drawSocket(g: Phaser.GameObjects.Graphics, r: Rect, on: boolean): void {
  g.fillStyle(on ? 0x3a2a55 : 0x201830, 0.95).fillRoundedRect(r.x, r.y, r.w, r.h, 8);
  g.lineStyle(2, on ? 0xffffff : 0x6a5a86, on ? 1 : 0.5).strokeRoundedRect(r.x, r.y, r.w, r.h, 8);
}

/** Is the pointer currently over a drop zone (the machine)? */
export function machineZoneHit(scene: Phaser.Scene): boolean {
  const zones = scene.input.hitTestPointer(scene.input.activePointer);
  return zones.some((z) => (z as Phaser.GameObjects.Zone).input?.dropZone === true);
}

/** Make an image draggable: it follows the pointer, then snaps home + fires onDrop. */
export function makeDraggable(
  scene: Phaser.Scene,
  img: Phaser.GameObjects.Image,
  homeX: number,
  homeY: number,
  onDrop: () => void,
): void {
  img.setInteractive({ useHandCursor: true, draggable: true });
  scene.input.setDraggable(img);
  img.on("drag", (_p: Phaser.Input.Pointer, dx: number, dy: number) => {
    img.setPosition(dx, dy).setDepth(400);
  });
  img.on("dragend", () => {
    img.setPosition(homeX, homeY).setDepth(0);
    onDrop();
  });
}
