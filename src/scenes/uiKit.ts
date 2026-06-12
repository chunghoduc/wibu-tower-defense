/**
 * uiKit — a tiny shared UI layer for consistent, smoother menus (T3). Built on
 * the existing crispText (supersampled, LINEAR-filtered) so text stays crisp.
 * Provides design tokens, camera-fade scene transitions, an animated button, and
 * a tweened number counter. Adopt incrementally across scenes.
 */
import Phaser from "phaser";
import { crispText } from "./ui.ts";

export const COLORS = {
  gold: "#ffe9a8",
  text: "#dfe7f2",
  sub: "#9fb0c4",
  accent: "#8fd0ff",
  panel: 0x101826,
  panelBorder: 0x3a567f,
  good: "#a5f0b0",
  bad: "#ff9a9a",
} as const;

export const DUR = { fade: 220, btn: 130, pop: 240, count: 350 } as const;

/** Fade the camera out, start the next scene, which should fadeIn() on create. */
export function fadeToScene(scene: Phaser.Scene, key: string, data?: object): void {
  const cam = scene.cameras.main;
  if (cam.fadeEffect?.isRunning) return; // ignore double taps mid-fade
  cam.fadeOut(DUR.fade, 6, 9, 15);
  cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => scene.scene.start(key, data));
}

/** Fade the scene in on entry (call from create). */
export function fadeIn(scene: Phaser.Scene): void {
  scene.cameras.main.fadeIn(DUR.fade, 6, 9, 15);
}

export interface ButtonOpts {
  width?: number;
  fontSize?: string;
  bg?: string;
  color?: string;
}

/**
 * A text button with hover-scale and press-dip feedback. Returns the Text object
 * (already interactive); pass onClick for the action.
 */
export function button(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  opts: ButtonOpts = {},
): Phaser.GameObjects.Text {
  const t = crispText(scene, x, y, label, {
    fontSize: opts.fontSize ?? "18px",
    color: opts.color ?? "#ffffff",
    backgroundColor: opts.bg ?? "#223355",
    fixedWidth: opts.width ?? 260,
    align: "center",
  })
    .setOrigin(0.5)
    .setPadding(0, 11, 0, 11)
    .setInteractive({ useHandCursor: true });

  t.on("pointerover", () =>
    scene.tweens.add({ targets: t, scale: 1.06, duration: DUR.btn, ease: "Back.easeOut" }),
  );
  t.on("pointerout", () =>
    scene.tweens.add({ targets: t, scale: 1, duration: DUR.btn, ease: "Sine.easeOut" }),
  );
  t.on("pointerdown", () =>
    scene.tweens.add({
      targets: t,
      scale: 0.94,
      duration: 70,
      yoyo: true,
      onComplete: () => onClick(),
    }),
  );
  return t;
}

/** Animate a numeric label from its current value to `to` over ~350ms. */
export function tweenCount(
  scene: Phaser.Scene,
  text: Phaser.GameObjects.Text,
  from: number,
  to: number,
  fmt: (v: number) => string = (v) => `${Math.round(v)}`,
): void {
  const ref = { v: from };
  scene.tweens.add({
    targets: ref,
    v: to,
    duration: DUR.count,
    ease: "Cubic.easeOut",
    onUpdate: () => text.setText(fmt(ref.v)),
    onComplete: () => text.setText(fmt(to)),
  });
}

/** Pop a container in with a scale+fade (use for modals/panels on open). */
export function popIn(
  scene: Phaser.Scene,
  obj: Phaser.GameObjects.Container | Phaser.GameObjects.Image,
): void {
  obj.setScale(0.86).setAlpha(0);
  scene.tweens.add({ targets: obj, scale: 1, alpha: 1, duration: DUR.pop, ease: "Back.easeOut" });
}

/**
 * Accent panel — the rounded card used by the Activities/Forge-style menus:
 * dark body, 2px accent border; `hot` swaps to the warm "ready to claim" look.
 */
export function accentPanel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  accent: number,
  hot = false,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillStyle(hot ? 0x22180c : 0x141b26, 1).fillRoundedRect(x, y, w, h, 12);
  g.lineStyle(2, hot ? 0xffc94d : accent, 1).strokeRoundedRect(x, y, w, h, 12);
  return g;
}

export interface ActionChipOpts {
  fontSize?: string;
  padX?: number;
  padY?: number;
  disabledFontSize?: string;
}

/**
 * Compact right-aligned action chip (claim/run/forge buttons on list rows).
 * Disabled renders as a muted plain label. Returns the Text either way.
 */
export function actionChip(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  color: string,
  enabled: boolean,
  cb: () => void,
  opts: ActionChipOpts = {},
): Phaser.GameObjects.Text {
  if (!enabled) {
    return crispText(scene, x, y, label, {
      fontSize: opts.disabledFontSize ?? "13px",
      color: "#6b7a8d",
    }).setOrigin(1, 0.5);
  }
  const btn = crispText(scene, x, y, label, {
    fontSize: opts.fontSize ?? "14px",
    color: "#ffffff",
    backgroundColor: color,
    fontStyle: "bold",
  })
    .setOrigin(1, 0.5)
    .setPadding(opts.padX ?? 14, opts.padY ?? 6, opts.padX ?? 14, opts.padY ?? 6)
    .setInteractive({ useHandCursor: true });
  btn.on("pointerup", cb);
  return btn;
}

/**
 * Full-screen dim layer + tap-to-dismiss zone for modal dialogs. Adds both to
 * `container` so they die with it.
 */
export function dimBackdrop(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  onDismiss?: () => void,
  alpha = 0.55,
): void {
  const W = scene.scale.width,
    H = scene.scale.height;
  const dim = scene.add.graphics();
  dim.fillStyle(0x000000, alpha).fillRect(0, 0, W, H);
  const zone = scene.add.zone(W / 2, H / 2, W, H).setInteractive();
  if (onDismiss) zone.on("pointerup", onDismiss);
  container.add([dim, zone]);
}
