/**
 * BattleScene tower-placement: the drag-to-place flow, the placement ghost
 * (preview sprite + coverage/footprint ring), and the tap-to-place arm/cancel
 * methods. Merged onto the BattleScene prototype in `BattleScene.ts`; `this` is
 * the scene. The pure arm/disarm decisions live in `core/placementMode.ts`.
 */
import type Phaser from "phaser";
import { towerTex } from "../data/assetKeys.ts";
import { armPlacement, disarmPlacement, isArmed } from "../core/placementMode.ts";
import { armedTileVisual, ghostAnchor, armHintText } from "../core/placementHud.ts";
import { crispText } from "./ui.ts";
import type { Vec2 } from "../data/schema.ts";
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
    const wp = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    this.ghostAt(towerId, { x: wp.x, y: wp.y }, pointer.y);
  },

  /**
   * Draw the placement ghost (coverage + footprint ring) at a world-point.
   * `screenY` gates the bottom build-bar strip (default on-field) so a touch
   * preview parked at the camera centre still reads as valid.
   */
  ghostAt(this: BattleScene, towerId: string, world: Vec2, screenY = 0): void {
    if (!this.placeGhost) return;
    this.placeGhost.setPosition(world.x, world.y);
    const def = this.buildOrder.find((d) => d.id === towerId);
    const ok =
      screenY < 500 && this.battle.canPlaceAt(world) && !!def && this.battle.gold >= def.cost;
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
      // On touch the active pointer is still on the just-tapped card (inside the
      // build-bar strip); anchor the preview at the camera centre so the ghost
      // shows on the FIELD instead of a red blob over the bar. Desktop hover
      // (pointermove) keeps tracking the cursor afterwards.
      const p = this.input.activePointer;
      const view = this.cameras.main.worldView;
      const camCenter = { x: view.centerX, y: view.centerY };
      const anchor = ghostAnchor({
        pointerScreenY: p ? p.y : this.scale.height,
        pointerWorld: p ? this.cameras.main.getWorldPoint(p.x, p.y) : camCenter,
        camCenter,
      });
      this.ghostAt(id, anchor, anchor === camCenter ? 0 : (p?.y ?? 0));
    } else {
      this.clearGhost();
    }
  },

  /** Drop any armed tap-to-place state and its ghost. */
  cancelPlacement(this: BattleScene): void {
    this.placement = disarmPlacement(this.placement);
    this.clearGhost();
  },

  /**
   * Per-frame: reflect the armed/affordable state on every build-bar card (lift
   * + accent the armed one, dim the rest) and show/hide the arm hint. Called
   * from refreshBuildBar so the highlight always matches placement state.
   */
  refreshArmedBar(this: BattleScene): void {
    const armedId = this.placement.armedId;
    for (const c of this.avatarTiles) {
      const id = c.getData("towerId") as string;
      const def = this.buildOrder.find((d) => d.id === id);
      const v = armedTileVisual({
        anyArmed: armedId !== null,
        isArmedTile: id === armedId,
        affordable: !!def && this.battle.gold >= def.cost,
      });
      c.setAlpha(v.alpha);
      c.setScale(v.scale);
      let hl = c.getData("selGlow") as Phaser.GameObjects.Graphics | undefined;
      if (v.selected && !hl) {
        hl = this.add.graphics();
        hl.lineStyle(2.5, 0xffe27a, 1).strokeRoundedRect(-35, -22, 70, 56, 8);
        c.addAt(hl, 0);
        c.setData("selGlow", hl);
      } else if (!v.selected && hl) {
        hl.destroy();
        c.setData("selGlow", undefined);
      }
    }
    const name = armedId
      ? (this.buildOrder.find((d) => d.id === armedId)?.name ?? null)
      : null;
    this.updateArmHint(armHintText(name));
  },

  /** Lazily build / show / hide the single reused arm-hint banner (tap = cancel). */
  updateArmHint(this: BattleScene, text: string): void {
    if (!text) {
      this.armHint?.setVisible(false);
      return;
    }
    if (!this.armHint) {
      this.armHint = crispText(this, this.scale.width / 2, 478, "", {
        fontSize: "13px",
        color: "#ffe27a",
        backgroundColor: "#1a2230cc",
        fontStyle: "bold",
        align: "center",
      })
        .setOrigin(0.5, 1)
        .setPadding(8, 4, 8, 4)
        .setDepth(46)
        .setInteractive({ useHandCursor: true });
      this.armHint.on("pointerup", () => this.cancelPlacement());
      this.ui.add(this.armHint);
    }
    this.armHint.setText(text).setVisible(true);
  },
};

export type PlacementMethods = typeof placementMethods;
