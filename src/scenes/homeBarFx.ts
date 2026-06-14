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
import { battleCtaPlan } from "./battleCta.ts";
import { battleEmblemTex } from "../data/assetKeys.ts";

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

/** The wide crimson-ember war CTA: layered forged-metal button + combat emblem
 *  + sheen sweep that launches `targetScene`. Geometry from battleCtaPlan. */
export function drawBattleCta(
  scene: Phaser.Scene,
  label: string,
  targetScene: string,
  r: Rect,
): void {
  const cx = r.x + r.w / 2,
    cy = r.y + r.h / 2;
  const p = battleCtaPlan(r);
  const c = scene.add.container(cx, cy).setDepth(9);
  // Plan coords are absolute; the container is centered, so place children
  // relative to the center.
  const lx = (x: number) => x - cx;
  const ly = (y: number) => y - cy;

  const g = scene.add.graphics();
  // Drop shadow.
  g.fillStyle(0x000000, 0.35).fillRoundedRect(lx(r.x) + 2, ly(r.y) + 4, r.w, r.h, 12);
  // Forged-gold bevel frame.
  g.fillStyle(0x7a4b12, 1).fillRoundedRect(lx(r.x), ly(r.y), r.w, r.h, 12);
  g.lineStyle(2, 0xffe9a8, 1).strokeRoundedRect(lx(r.x), ly(r.y), r.w, r.h, 12);
  // Crimson→ember body (two stacked tones read as a vertical gradient).
  g.fillStyle(0x7a1410, 1).fillRoundedRect(lx(p.body.x), ly(p.body.y), p.body.w, p.body.h, 9);
  g.fillStyle(0xe0461f, 1).fillRoundedRect(lx(p.body.x), ly(p.body.y), p.body.w, p.body.h - 5, 9);
  // Top gloss band.
  g.fillStyle(0xffffff, 0.16).fillRoundedRect(lx(p.gloss.x), ly(p.gloss.y), p.gloss.w, p.gloss.h, 8);
  // Corner rivets.
  for (const rv of p.rivets) {
    g.fillStyle(0xffe9a8, 1).fillCircle(lx(rv.x), ly(rv.y), 2.4);
    g.fillStyle(0x7a4b12, 1).fillCircle(lx(rv.x), ly(rv.y), 1.1);
  }
  c.add(g);

  // SDXL combat emblem (left), gated so a missing PNG degrades gracefully.
  const ek = battleEmblemTex();
  if (scene.textures.exists(ek)) {
    const img = scene.add
      .image(lx(p.emblem.x), ly(p.emblem.y), ek)
      .setDisplaySize(p.emblem.size, p.emblem.size);
    c.add(img);
  }

  c.add(
    crispText(scene, lx(p.label.x), ly(p.label.y), label, {
      fontSize: "24px",
      color: "#fff4e0",
      fontStyle: "bold",
      stroke: "#3a0a06",
      strokeThickness: 4,
    }).setOrigin(0.5),
  );

  // Sheen sweep: a thin bright diagonal band travelling across the body, clipped
  // to the body rect via a geometry mask.
  const sheen = scene.add.graphics().setDepth(10);
  sheen.fillStyle(0xffffff, 0.22);
  sheen.fillRect(-p.sheen.w / 2, -r.h, p.sheen.w, r.h * 2);
  sheen.setRotation(-0.5);
  c.add(sheen);
  const maskG = scene.make
    .graphics({ x: 0, y: 0 })
    .fillStyle(0xffffff)
    .fillRoundedRect(p.body.x, p.body.y, p.body.w, p.body.h, 9);
  sheen.setMask(maskG.createGeometryMask());
  sheen.x = lx(p.sheen.x0);
  scene.tweens.add({
    targets: sheen,
    x: lx(p.sheen.x1),
    duration: 900,
    ease: "Sine.easeInOut",
    repeat: -1,
    repeatDelay: 1600,
  });

  const z = scene.add.zone(0, 0, r.w, r.h).setInteractive({ useHandCursor: true });
  c.add(z);
  z.on("pointerover", () =>
    scene.tweens.add({ targets: c, scale: 1.05, duration: 130, ease: "Back.easeOut" }),
  );
  z.on("pointerout", () =>
    scene.tweens.add({ targets: c, scale: 1, duration: 130, ease: "Sine.easeOut" }),
  );
  z.on("pointerdown", () =>
    scene.tweens.add({
      targets: c,
      scale: 0.95,
      duration: 80,
      yoyo: true,
      onComplete: () => fadeToScene(scene, targetScene),
    }),
  );
}
