// src/scenes/battleCamera.ts
import Phaser from "phaser";
import { TAP_SLOP_PX, isDoubleTap, pinchUpdate, type TapPoint } from "../core/gesture.ts";

/**
 * Pan & zoom controller for the battle camera.
 *
 * The battlefield is rendered by `cam` (the main camera) at a fit-to-screen base
 * zoom; the HUD lives on a separate camera and is untouched. Zooming past native
 * scale reveals the sprites and combat VFX at full resolution (`pixelArt` keeps
 * them crisp). Inputs: mouse wheel + on-screen ＋/－ buttons + two-finger pinch
 * to zoom; drag the battlefield to pan once zoomed in (bounds-clamped).
 *
 * The controller deliberately owns NO tap/command logic. It exposes
 * `consumedGesture` so the scene's tap handler can tell a pan/pinch from a tap
 * and avoid walking the hero when the player was just moving the view.
 */
export interface BattleCameraOpts {
  worldW: number;
  worldH: number;
  minZoom: number;
  maxZoom: number;
  /** True when the pointer is over UI (panel / build bar) — don't start a pan there. */
  blockAt: (p: Phaser.Input.Pointer) => boolean;
  /** True while another drag owns the pointer (e.g. placing a tower). */
  isBusy: () => boolean;
}

export class BattleCameraController {
  /** True if the just-finished (or in-progress) gesture moved the view. */
  consumedGesture = false;

  private panning = false;
  private pinching = false;
  private lastX = 0;
  private lastY = 0;
  private pinchDist = 0;
  private pinchMx = 0;
  private pinchMy = 0;
  private lastTap: TapPoint | null = null;

  private readonly onWheel: (p: Phaser.Input.Pointer, o: unknown, dx: number, dy: number) => void;
  private readonly onDown: (p: Phaser.Input.Pointer) => void;
  private readonly onMove: (p: Phaser.Input.Pointer) => void;
  private readonly onUp: () => void;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly cam: Phaser.Cameras.Scene2D.Camera,
    private readonly opts: BattleCameraOpts,
  ) {
    scene.input.addPointer(1); // allow a 2nd touch pointer for pinch

    this.onWheel = (p, _o, _dx, dy) => this.zoomToward(dy < 0 ? 1.12 : 1 / 1.12, p.x, p.y);
    this.onDown = (p) => {
      this.consumedGesture = false;
      this.panning = false;
      // A quick second tap near the first zooms toward it — a discoverable way
      // to get closer, which makes drag-to-pan meaningful. zoomToward marks the
      // gesture consumed so the scene's tap handler won't also walk the hero.
      const cur: TapPoint = { t: this.scene.time.now, x: p?.x ?? 0, y: p?.y ?? 0 };
      if (p && isDoubleTap(this.lastTap, cur)) {
        this.zoomToward(1.3, p.x, p.y);
        this.lastTap = null; // consume so a third tap doesn't re-fire
      } else {
        this.lastTap = cur;
      }
    };
    this.onMove = (p) => this.handleMove(p);
    this.onUp = () => {
      this.panning = false;
      this.pinching = false;
      this.pinchDist = 0;
      this.pinchMx = 0;
      this.pinchMy = 0;
    };

    scene.input.on("wheel", this.onWheel);
    scene.input.on("pointerdown", this.onDown);
    scene.input.on("pointermove", this.onMove);
    scene.input.on("pointerup", this.onUp);
    scene.input.on("pointercancel", this.onUp);
  }

  get isZoomedIn(): boolean {
    return this.cam.zoom > this.opts.minZoom * 1.003;
  }

  /** Step the zoom (used by the ＋/－ buttons), keeping the view centre fixed. */
  zoomStep(inward: boolean): void {
    this.zoomToward(inward ? 1.3 : 1 / 1.3, this.cam.width / 2, this.cam.height / 2);
  }

  /** Snap back to the fit-to-screen view. */
  reset(): void {
    this.cam.setZoom(this.opts.minZoom);
    this.cam.centerOn(this.opts.worldW / 2, this.opts.worldH / 2);
  }

  private zoomToward(factor: number, sx: number, sy: number): void {
    const { minZoom, maxZoom } = this.opts;
    const nz = Phaser.Math.Clamp(this.cam.zoom * factor, minZoom, maxZoom);
    if (Math.abs(nz - this.cam.zoom) < 1e-4) return;
    const before = this.cam.getWorldPoint(sx, sy);
    this.cam.setZoom(nz);
    const after = this.cam.getWorldPoint(sx, sy);
    // Keep the world point under the cursor steady; bounds clamp the scroll.
    this.cam.setScroll(
      this.cam.scrollX + (before.x - after.x),
      this.cam.scrollY + (before.y - after.y),
    );
    this.consumedGesture = true;
  }

  private handleMove(p: Phaser.Input.Pointer): void {
    if (this.opts.isBusy()) return;
    const p1 = this.scene.input.pointer1;
    const p2 = this.scene.input.pointer2;

    // Two fingers down → pinch to zoom around the midpoint AND pan by the
    // midpoint translation (grab-and-move-the-battlefield, the natural mobile
    // navigation gesture). The first frame just seeds the baseline.
    if (p1?.isDown && p2?.isDown) {
      const dist = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
      const mx = (p1.x + p2.x) / 2,
        my = (p1.y + p2.y) / 2;
      if (this.pinching && this.pinchDist > 0) {
        const { zoomFactor, panDx, panDy } = pinchUpdate(
          { dist: this.pinchDist, cx: this.pinchMx, cy: this.pinchMy },
          { dist, cx: mx, cy: my },
        );
        this.zoomToward(zoomFactor, mx, my);
        if (panDx !== 0 || panDy !== 0) {
          this.cam.setScroll(
            this.cam.scrollX - panDx / this.cam.zoom,
            this.cam.scrollY - panDy / this.cam.zoom,
          );
          this.consumedGesture = true;
        }
      }
      this.pinchDist = dist;
      this.pinchMx = mx;
      this.pinchMy = my;
      this.pinching = true;
      this.panning = false;
      return;
    }
    this.pinching = false;
    this.pinchDist = 0;
    this.pinchMx = 0;
    this.pinchMy = 0;

    // One finger / mouse drag → pan, but only when zoomed in past the fit view.
    if (!p.isDown || !this.isZoomedIn || this.opts.blockAt(p)) {
      this.lastX = p.x;
      this.lastY = p.y;
      return;
    }
    const dx = p.x - this.lastX,
      dy = p.y - this.lastY;
    this.lastX = p.x;
    this.lastY = p.y;
    if (!this.panning && Math.hypot(p.x - p.downX, p.y - p.downY) < TAP_SLOP_PX) return;
    this.panning = true;
    this.consumedGesture = true;
    this.cam.setScroll(
      this.cam.scrollX - dx / this.cam.zoom,
      this.cam.scrollY - dy / this.cam.zoom,
    );
  }

  destroy(): void {
    this.scene.input.off("wheel", this.onWheel);
    this.scene.input.off("pointerdown", this.onDown);
    this.scene.input.off("pointermove", this.onMove);
    this.scene.input.off("pointerup", this.onUp);
    this.scene.input.off("pointercancel", this.onUp);
  }
}
