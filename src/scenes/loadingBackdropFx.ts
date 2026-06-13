/**
 * Loading-screen backdrop presenter. Paints the pure loadingBackdrop geometry
 * (dusk sky gradient, parallax hills, glowing tower silhouettes) once and animates
 * a drift of embers on update(). Uses only Graphics primitives — safe to draw
 * before any asset texture has loaded (PreloadScene runs this at frame zero).
 */
import Phaser from "phaser";
import {
  loadingHills,
  loadingTowers,
  loadingEmbers,
  emberAt,
  type Ember,
} from "../core/loadingBackdrop.ts";

export interface LoadingBackdrop {
  update(timeSec: number): void;
  destroy(): void;
}

/** Blend two 0xRRGGBB colors. */
function mix(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;
  return (
    (Math.round(ar + (br - ar) * t) << 16) |
    (Math.round(ag + (bg - ag) * t) << 8) |
    Math.round(ab + (bb - ab) * t)
  );
}

export function createLoadingBackdrop(scene: Phaser.Scene): LoadingBackdrop {
  const { width, height } = scene.scale;
  const towers = loadingTowers(width, height);
  const embers: Ember[] = loadingEmbers(width, height, 28);
  const glowBlobs: Phaser.GameObjects.Graphics[] = [];

  // --- static layer (sky + hills + towers), drawn once ---
  const stat = scene.add.graphics();
  stat.setDepth(-20);

  // dusk sky gradient via stacked horizontal bands (deep night -> ember horizon)
  const top = 0x0b0d16;
  const horizon = 0x3a2740;
  const skyH = height * 0.85;
  const BANDS = 24;
  for (let i = 0; i < BANDS; i++) {
    const t = i / (BANDS - 1);
    stat.fillStyle(mix(top, horizon, t), 1);
    stat.fillRect(0, (skyH * i) / BANDS, width, skyH / BANDS + 1);
  }
  // ground wash under the horizon
  stat.fillStyle(0x0b0d16, 1);
  stat.fillRect(0, skyH, width, height - skyH);

  // parallax hills (back -> front, darkening)
  for (const b of loadingHills(width, height)) {
    stat.fillStyle(b.color, 1);
    stat.beginPath();
    stat.moveTo(b.points[0].x, b.points[0].y);
    for (let i = 1; i < b.points.length; i++) stat.lineTo(b.points[i].x, b.points[i].y);
    stat.closePath();
    stat.fillPath();
  }

  // tower silhouettes with a lit window + glowing apex
  for (const tw of towers) {
    const left = tw.x - tw.width / 2;
    const topY = tw.baseY - tw.height;
    const shoulder = topY + tw.width * 0.5;
    stat.fillStyle(tw.body, 1);
    // body
    stat.fillRect(left, shoulder, tw.width, tw.baseY - shoulder);
    // roof (triangle)
    stat.beginPath();
    stat.moveTo(left - 3, shoulder);
    stat.lineTo(tw.x, topY - tw.width * 0.35);
    stat.lineTo(left + tw.width + 3, shoulder);
    stat.closePath();
    stat.fillPath();
    // lit window
    stat.fillStyle(tw.glow, 0.9);
    stat.fillRect(
      tw.x - tw.width * 0.14,
      topY + tw.height * 0.45,
      tw.width * 0.28,
      tw.height * 0.22,
    );
    // soft additive glow blob at the apex
    const blob = scene.add.graphics();
    blob.setDepth(-19);
    blob.fillStyle(tw.glow, 0.16);
    blob.fillCircle(tw.x, topY - tw.width * 0.1, tw.width * 0.7);
    blob.setBlendMode(Phaser.BlendModes.ADD);
    glowBlobs.push(blob);
  }

  // --- ember layer, repainted each update (additive) ---
  const fx = scene.add.graphics();
  fx.setDepth(-18);
  fx.setBlendMode(Phaser.BlendModes.ADD);

  return {
    update(timeSec: number) {
      fx.clear();
      for (const e of embers) {
        const p = emberAt(e, timeSec, height);
        const a = 0.2 + 0.3 * (0.5 + 0.5 * Math.sin(timeSec * 2 + e.phase));
        fx.fillStyle(0xffcf8a, a);
        fx.fillCircle(p.x, p.y, e.r);
      }
    },
    destroy() {
      stat.destroy();
      fx.destroy();
      for (const b of glowBlobs) b.destroy();
    },
  };
}
