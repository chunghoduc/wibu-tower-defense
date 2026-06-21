/**
 * homeBarFx — thin Phaser presenters for the home-screen chrome: a framed
 * resource pill and the wide primary BATTLE call-to-action. Extracted from
 * MainMenuScene to keep that scene under the 500-line cap. Geometry comes from
 * homeLayout.ts; these only paint it. See
 * docs/superpowers/specs/2026-06-13-home-screen-ux-redesign-design.md.
 */
import Phaser from "phaser";
import { crispText, UI_FONT_FAMILY } from "./ui.ts";
import { fadeToScene } from "./uiKit.ts";
import type { Rect } from "./homeLayout.ts";
import { battleSquarePlan } from "./battleSquare.ts";
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

/** Paint a small upright gold longsword mark (blade up) centred on the origin
 *  of `g`'s local space, fitting a box of side `s`. Crisp vector — no SDXL. */
function drawSwordMark(g: Phaser.GameObjects.Graphics, ox: number, oy: number, s: number): void {
  const bladeW = s * 0.17;
  const top = oy - s * 0.46; // blade tip
  const guardY = oy + s * 0.16; // crossguard row
  const gripBot = oy + s * 0.46; // pommel
  const GOLD = 0xffe6a8,
    EDGE = 0x6e4410,
    STEEL = 0xfff6d8;
  // Blade (tapered diamond from tip down to the guard).
  g.fillStyle(STEEL, 1).fillTriangle(ox, top, ox - bladeW, guardY, ox + bladeW, guardY);
  g.lineStyle(1, EDGE, 0.9).strokeTriangle(ox, top, ox - bladeW, guardY, ox + bladeW, guardY);
  // Crossguard.
  g.fillStyle(GOLD, 1).fillRect(ox - s * 0.34, guardY, s * 0.68, s * 0.1);
  // Grip + pommel.
  g.fillStyle(0x7a4b12, 1).fillRect(ox - bladeW * 0.7, guardY + s * 0.1, bladeW * 1.4, s * 0.2);
  g.fillStyle(GOLD, 1).fillCircle(ox, gripBot - s * 0.02, s * 0.07);
}

/** The big square BATTLE CTA: a gold-rimmed crimson tile carrying the SDXL war
 *  crest (twin crossed swords over a powerful shield) with a "BATTLE" ribbon
 *  along the bottom and a breathing glow that marks it as the one main action.
 *  Static chrome from battleSquarePlan; the emblem degrades to a vector sword
 *  mark when its texture is missing. Launches `targetScene`. */
export function drawBattleSquare(
  scene: Phaser.Scene,
  label: string,
  targetScene: string,
  r: Rect,
): void {
  const cx = r.x + r.w / 2,
    cy = r.y + r.h / 2;
  const p = battleSquarePlan(r);
  const c = scene.add.container(cx, cy).setDepth(9);
  // Plan coords are absolute; the container is centred, so children are placed
  // relative to that centre.
  const lx = (x: number) => x - cx;
  const ly = (y: number) => y - cy;

  // — Breathing glow halo (additive, alpha pulses) behind everything.
  const glow = scene.add
    .graphics()
    .fillStyle(0xff7a2c, 1)
    .fillRoundedRect(lx(p.glow.x), ly(p.glow.y), p.glow.w, p.glow.h, p.radius + 6);
  glow.setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.18);
  c.add(glow);
  scene.tweens.add({
    targets: glow,
    alpha: 0.5,
    duration: 1200,
    ease: "Sine.easeInOut",
    yoyo: true,
    repeat: -1,
  });

  // — Tile chrome: drop shadow, dark-gold under-rim, crimson gradient face.
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.34).fillRoundedRect(lx(r.x), ly(r.y) + 4, r.w, r.h, p.radius);
  g.fillStyle(0x6e4410, 1).fillRoundedRect(lx(r.x), ly(r.y), r.w, r.h, p.radius); // under-rim
  c.add(g);

  // Ember→garnet vertical gradient, clipped to the rounded face via a mask.
  const grad = scene.add.graphics();
  grad.fillGradientStyle(0xb52a17, 0xb52a17, 0x6e1208, 0x6e1208, 1);
  grad.fillRect(lx(p.inner.x), ly(p.inner.y), p.inner.w, p.inner.h);
  const faceMask = scene.make
    .graphics({ x: 0, y: 0 })
    .fillStyle(0xffffff)
    .fillRoundedRect(p.inner.x, p.inner.y, p.inner.w, p.inner.h, p.radius * 0.7);
  grad.setMask(faceMask.createGeometryMask());
  c.add(grad);

  // Bright gold rim stroke framing the tile.
  const trim = scene.add.graphics();
  trim.lineStyle(p.rim, 0xffe6a8, 1).strokeRoundedRect(lx(r.x), ly(r.y), r.w, r.h, p.radius);
  c.add(trim);

  // — War-crest emblem (SDXL). Falls back to a vector sword mark if missing.
  const emKey = battleEmblemTex();
  if (scene.textures.exists(emKey)) {
    const img = scene.add.image(lx(p.emblem.x), ly(p.emblem.y), emKey).setOrigin(0.5);
    img.setScale(p.emblem.size / Math.max(img.width, img.height));
    c.add(img);
  } else {
    const mark = scene.add.graphics();
    drawSwordMark(mark, lx(p.emblem.x), ly(p.emblem.y), p.emblem.size * 0.8);
    c.add(mark);
  }

  // — BATTLE ribbon along the bottom: dark plate + gold trim + gold label.
  const ribbon = scene.add.graphics();
  const rad = Math.min(6, p.ribbon.h / 2);
  ribbon
    .fillStyle(0x1a0e08, 0.86)
    .fillRoundedRect(lx(p.ribbon.x), ly(p.ribbon.y), p.ribbon.w, p.ribbon.h, rad)
    .lineStyle(1.5, 0xffe6a8, 0.95)
    .strokeRoundedRect(lx(p.ribbon.x), ly(p.ribbon.y), p.ribbon.w, p.ribbon.h, rad);
  c.add(ribbon);
  const labelText = scene.add
    .text(lx(p.ribbon.x + p.ribbon.w / 2), ly(p.ribbon.y + p.ribbon.h / 2), label, {
      fontFamily: UI_FONT_FAMILY,
      fontSize: `${Math.round(p.ribbon.h * 0.62)}px`,
      color: "#ffe6a8",
      fontStyle: "bold",
      stroke: "#2a0805",
      strokeThickness: 3,
    })
    .setOrigin(0.5);
  if (typeof labelText.setLetterSpacing === "function") labelText.setLetterSpacing(1);
  c.add(labelText);

  // — A gentle idle breathing pulse so the corner button keeps drawing the eye.
  scene.tweens.add({
    targets: c,
    scale: 1.035,
    duration: 1100,
    ease: "Sine.easeInOut",
    yoyo: true,
    repeat: -1,
  });

  // — Interaction.
  const z = scene.add.zone(0, 0, r.w, r.h).setInteractive({ useHandCursor: true });
  c.add(z);
  z.on("pointerover", () =>
    scene.tweens.add({ targets: c, scale: 1.1, duration: 130, ease: "Back.easeOut" }),
  );
  z.on("pointerout", () =>
    scene.tweens.add({ targets: c, scale: 1, duration: 130, ease: "Sine.easeOut" }),
  );
  z.on("pointerdown", () =>
    scene.tweens.add({
      targets: c,
      scale: 0.92,
      duration: 80,
      yoyo: true,
      onComplete: () => fadeToScene(scene, targetScene),
    }),
  );
}
