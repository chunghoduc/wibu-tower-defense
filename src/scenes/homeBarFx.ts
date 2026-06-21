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
import { battleCtaPlan, battleCtaContent } from "./battleCta.ts";

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

/** The refined royal war-seal CTA: a gold-rimmed ember capsule with a breathing
 *  glow, slim gloss, flanking flourishes, and ONE centred [sword · BATTLE · ▸▸]
 *  unit. Static chrome from battleCtaPlan; the unit is centred from the
 *  runtime-measured label width via battleCtaContent. Launches `targetScene`. */
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
  // Plan coords are absolute; the container is centred, so children are placed
  // relative to that centre.
  const lx = (x: number) => x - cx;
  const ly = (y: number) => y - cy;

  // — Breathing glow halo (additive, alpha pulses) behind everything.
  const glow = scene.add
    .graphics()
    .fillStyle(0xff9a3c, 1)
    .fillRoundedRect(lx(p.glow.x), ly(p.glow.y), p.glow.w, p.glow.h, p.glow.h / 2);
  glow.setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.16);
  c.add(glow);
  scene.tweens.add({
    targets: glow,
    alpha: 0.42,
    duration: 1300,
    ease: "Sine.easeInOut",
    yoyo: true,
    repeat: -1,
  });

  // — Capsule chrome: drop shadow, dark-gold under-rim, ember gradient core.
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.3).fillRoundedRect(lx(r.x), ly(r.y) + 3, r.w, r.h, p.radius);
  g.fillStyle(0x6e4410, 1).fillRoundedRect(lx(r.x), ly(r.y), r.w, r.h, p.radius); // under-rim
  c.add(g);

  // Ember→garnet vertical gradient, clipped to the body capsule via a mask.
  const grad = scene.add.graphics();
  grad.fillGradientStyle(0xff9a4d, 0xff9a4d, 0xa01f10, 0xa01f10, 1);
  grad.fillRect(lx(p.body.x), ly(p.body.y), p.body.w, p.body.h);
  const bodyMask = scene.make
    .graphics({ x: 0, y: 0 })
    .fillStyle(0xffffff)
    .fillRoundedRect(p.body.x, p.body.y, p.body.w, p.body.h, p.body.h / 2);
  grad.setMask(bodyMask.createGeometryMask());
  c.add(grad);

  // Slim top gloss + bright gold rim stroke.
  const trim = scene.add.graphics();
  trim
    .fillStyle(0xffffff, 0.18)
    .fillRoundedRect(lx(p.gloss.x), ly(p.gloss.y), p.gloss.w, p.gloss.h, p.gloss.h / 2);
  trim.lineStyle(2, 0xffe6a8, 1).strokeRoundedRect(lx(r.x), ly(r.y), r.w, r.h, p.radius);
  c.add(trim);

  // — Centred content unit. Measure the label first, then place the unit.
  // A PLAIN text (not crispText) is used here on purpose: crispText supersamples
  // via setResolution, and inside this container the glyphs then rasterise
  // markedly larger than their nominal size AND below their measured box — so the
  // label both overflowed the capsule and threw off the icon/chevron centring.
  // Plain text keeps display metrics == rasterised pixels, so the geometry below
  // lands true. A 4px dark stroke keeps it legible over the ember body.
  const labelText = scene.add
    .text(0, 0, label, {
      fontFamily: UI_FONT_FAMILY,
      fontSize: "26px",
      color: "#fff6e2",
      fontStyle: "bold",
      stroke: "#46100a",
      strokeThickness: 4,
    })
    .setOrigin(0.5);
  if (typeof labelText.setLetterSpacing === "function") labelText.setLetterSpacing(2);
  labelText.setShadow(0, 2, "#2a0805", 3, true, true);

  const iconSize = Math.round(r.h * 0.42);
  const chevW = 16;
  const ct = battleCtaContent(r, {
    iconSize,
    iconGap: 9,
    textW: labelText.width,
    chevGap: 11,
    chevW,
  });

  // Flanking hairline flourishes (double gold lines) filling the leftover width.
  const flank = scene.add.graphics();
  const drawFlank = (x0: number, x1: number, y: number) => {
    if (x1 - x0 < 14) return; // too short → skip, keeps it from crowding the unit
    flank.lineStyle(1, 0xffe6a8, 0.34).beginPath();
    flank.moveTo(lx(x0), ly(y) - 2).lineTo(lx(x1), ly(y) - 2);
    flank.moveTo(lx(x0), ly(y) + 2).lineTo(lx(x1), ly(y) + 2);
    flank.strokePath();
    // A small diamond stud capping the inner end.
    const inner = x0 < cx ? x1 : x0;
    flank.fillStyle(0xffe6a8, 0.6);
    flank.fillPoints(
      [
        { x: lx(inner), y: ly(y) - 3 },
        { x: lx(inner) + 3, y: ly(y) },
        { x: lx(inner), y: ly(y) + 3 },
        { x: lx(inner) - 3, y: ly(y) },
      ],
      true,
    );
  };
  drawFlank(ct.leftFlank.x0, ct.leftFlank.x1, ct.leftFlank.y);
  drawFlank(ct.rightFlank.x0, ct.rightFlank.x1, ct.rightFlank.y);
  c.add(flank);

  // Sword mark (left of the label).
  const mark = scene.add.graphics();
  drawSwordMark(mark, lx(ct.iconCenter.x), ly(ct.iconCenter.y), iconSize);
  c.add(mark);

  // Label, centred on its row (plain text → metrics match the rasterisation).
  labelText.setPosition(lx(ct.labelCenter.x), ly(ct.labelCenter.y));
  c.add(labelText);

  // ▸▸ advance chevrons (right), with a small repeating nudge to signal "go".
  const chevrons = scene.add.graphics();
  const ch = (bx: number) => {
    chevrons
      .fillStyle(0xffe6a8, 1)
      .fillTriangle(bx, -6, bx, 6, bx + 7, 0)
      .lineStyle(1, 0x6e4410, 0.7)
      .strokeTriangle(bx, -6, bx, 6, bx + 7, 0);
  };
  ch(-chevW / 2);
  ch(-chevW / 2 + 8);
  chevrons.setPosition(lx(ct.chevCenter.x), ly(ct.chevCenter.y));
  c.add(chevrons);
  scene.tweens.add({
    targets: chevrons,
    x: lx(ct.chevCenter.x) + 4,
    duration: 620,
    ease: "Sine.easeInOut",
    yoyo: true,
    repeat: -1,
    repeatDelay: 900,
  });

  // — Interaction.
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
      scale: 0.95,
      duration: 80,
      yoyo: true,
      onComplete: () => fadeToScene(scene, targetScene),
    }),
  );
}
