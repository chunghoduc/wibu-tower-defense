/**
 * homeBarFx — thin Phaser presenters for the home-screen chrome: a framed
 * resource pill and the wide primary BATTLE call-to-action. Extracted from
 * MainMenuScene to keep that scene under the 500-line cap. Geometry comes from
 * homeLayout.ts; these only paint it. See
 * docs/superpowers/specs/2026-06-13-home-screen-ux-redesign-design.md.
 */
import type Phaser from "phaser";
import { crispText } from "./ui.ts";
import { fadeToScene } from "./uiKit.ts";
import type { Rect } from "./homeLayout.ts";

/** A framed resource pill: dark translucent plate + gold stroke + icon + value. */
export function drawPill(
  scene: Phaser.Scene,
  p: Rect,
  icon: string,
  value: string,
  color: string,
): void {
  scene.add
    .graphics()
    .setDepth(5)
    .fillStyle(0x0c1120, 0.82)
    .fillRoundedRect(p.x, p.y, p.w, p.h, p.h / 2)
    .lineStyle(1.5, 0xc9a85a, 0.9)
    .strokeRoundedRect(p.x, p.y, p.w, p.h, p.h / 2);
  // Icon pinned to the left cap; value right-aligned to the right cap so any
  // digit count fits without overflowing into the icon or past the frame.
  crispText(scene, p.x + p.h / 2 + 2, p.y + p.h / 2, icon, { fontSize: "14px" })
    .setOrigin(0.5)
    .setDepth(6);
  crispText(scene, p.x + p.w - 12, p.y + p.h / 2, value, {
    fontSize: "15px",
    color,
    fontStyle: "bold",
    stroke: "#0a1420",
    strokeThickness: 3,
  })
    .setOrigin(1, 0.5)
    .setDepth(6);
}

/** The wide, gold-accented hero call-to-action that launches `targetScene`. */
export function drawPrimaryButton(
  scene: Phaser.Scene,
  label: string,
  targetScene: string,
  r: Rect,
): void {
  const cx = r.x + r.w / 2,
    cy = r.y + r.h / 2;
  const c = scene.add.container(cx, cy).setDepth(9);
  const g = scene.add.graphics();
  g.fillStyle(0x7a4b12, 1).fillRoundedRect(-r.w / 2, -r.h / 2, r.w, r.h, 12);
  g.fillStyle(0xe8a93a, 1).fillRoundedRect(-r.w / 2, -r.h / 2, r.w, r.h - 4, 12);
  g.lineStyle(2, 0xffe9a8, 1).strokeRoundedRect(-r.w / 2, -r.h / 2, r.w, r.h, 12);
  c.add(g);
  c.add(
    crispText(scene, 0, 0, `▶  ${label}`, {
      fontSize: "22px",
      color: "#2a1804",
      fontStyle: "bold",
    }).setOrigin(0.5),
  );
  const z = scene.add.zone(0, 0, r.w, r.h).setInteractive({ useHandCursor: true });
  c.add(z);
  z.on("pointerover", () =>
    scene.tweens.add({ targets: c, scale: 1.04, duration: 130, ease: "Back.easeOut" }),
  );
  z.on("pointerout", () =>
    scene.tweens.add({ targets: c, scale: 1, duration: 130, ease: "Sine.easeOut" }),
  );
  z.on("pointerdown", () =>
    scene.tweens.add({
      targets: c,
      scale: 0.96,
      duration: 80,
      yoyo: true,
      onComplete: () => fadeToScene(scene, targetScene),
    }),
  );
  // Subtle idle pulse so the CTA reads as the hero action.
  scene.tweens.add({
    targets: g,
    alpha: { from: 1, to: 0.86 },
    duration: 1100,
    yoyo: true,
    repeat: -1,
    ease: "Sine.easeInOut",
  });
}
