/**
 * BattleScene tower-placement: the drag-to-place flow, the placement ghost
 * (preview sprite + coverage/footprint ring), and the tap-to-place arm/cancel
 * methods. Merged onto the BattleScene prototype in `BattleScene.ts`; `this` is
 * the scene. The pure arm/disarm decisions live in `core/placementMode.ts`.
 */
import type Phaser from "phaser";
import { towerTex } from "../data/assetKeys.ts";
import { armPlacement, disarmPlacement, isArmed } from "../core/placementMode.ts";
import type { BattleScene } from "./BattleScene.ts";

export const placementMethods = {
  /** Drag an avatar onto the field to place its tower at a free spot (T12 + T14). */
  setupPlacementDrag(this: BattleScene): void {
    this.input.on("dragstart", (_p: Phaser.Input.Pointer, obj: Phaser.GameObjects.Container) => {
      if (!obj.getData || !obj.getData("towerId")) return;
      this.placement = disarmPlacement(this.placement); // a drag-place supersedes tap-to-place
      this.makeGhost(obj.getData("towerId"));
    });
    this.input.on(
      "drag",
      (p: Phaser.Input.Pointer, obj: Phaser.GameObjects.Container, x: number, y: number) => {
        if (!obj.getData || !obj.getData("towerId")) return;
        obj.x = x;
        obj.y = y;
        this.updateGhost(obj.getData("towerId"), p);
      },
    );
    this.input.on("dragend", (p: Phaser.Input.Pointer, obj: Phaser.GameObjects.Container) => {
      const id = obj.getData && obj.getData("towerId");
      if (!id) return;
      this.clearGhost();
      const wp = this.cameras.main.getWorldPoint(p.x, p.y);
      if (!this.panel.hitsPanel(p.x) && p.y < 500 && this.battle.outcome === "ongoing") {
        if (this.battle.placeTowerAt(id, { x: wp.x, y: wp.y })) this.sfx.place();
      }
      this.rebuildAvatarTiles(); // snap the dragged tile home (drag handlers stay registered)
    });
  },

  makeGhost(this: BattleScene, towerId: string): void {
    this.clearGhost();
    const g = this.add.container(0, 0).setDepth(7).setAlpha(0.7);
    const ring = this.add.graphics();
    g.add(ring);
    g.setData("ring", ring);
    const key = towerTex(towerId);
    if (this.textures.exists(key)) {
      const img = this.add.image(0, 0, key, 0).setOrigin(0.5, 0.78);
      img.setScale(50 / img.height);
      g.add(img);
    }
    this.world.add(g);
    this.placeGhost = g;
  },

  updateGhost(this: BattleScene, towerId: string, pointer: Phaser.Input.Pointer): void {
    if (!this.placeGhost) return;
    const wp = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    this.placeGhost.setPosition(wp.x, wp.y);
    const def = this.buildOrder.find((d) => d.id === towerId);
    const ok =
      pointer.y < 500 &&
      this.battle.canPlaceAt({ x: wp.x, y: wp.y }) &&
      !!def &&
      this.battle.gold >= def.cost;
    const range = def ? this.battle.previewPlaceRange(def.id) : 130;
    const ring = this.placeGhost.getData("ring") as Phaser.GameObjects.Graphics;
    ring.clear();
    ring.lineStyle(1.5, ok ? 0x66ff88 : 0xff5a5a, 0.4).strokeCircle(0, 0, range); // coverage preview
    ring.fillStyle(ok ? 0x66ff88 : 0xff5a5a, 0.06).fillCircle(0, 0, range);
    ring.lineStyle(2, ok ? 0x66ff88 : 0xff5a5a, 0.95).strokeCircle(0, 0, 16); // footprint
  },

  clearGhost(this: BattleScene): void {
    this.placeGhost?.destroy(true);
    this.placeGhost = null;
  },

  /** Toggle a build-bar card armed for tap-to-place; shows/clears its ghost. */
  toggleArm(this: BattleScene, id: string): void {
    if (this.battle.outcome !== "ongoing") return;
    this.placement = armPlacement(this.placement, id);
    if (isArmed(this.placement)) {
      this.makeGhost(id);
      const p = this.input.activePointer;
      if (p) this.updateGhost(id, p);
    } else {
      this.clearGhost();
    }
  },

  /** Drop any armed tap-to-place state and its ghost. */
  cancelPlacement(this: BattleScene): void {
    this.placement = disarmPlacement(this.placement);
    this.clearGhost();
  },
};

export type PlacementMethods = typeof placementMethods;
