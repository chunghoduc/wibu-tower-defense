/**
 * forgeFxPlayer — renders the Forge's per-function forging effects. Reads a pure
 * ForgeFxSpec (forgeFx.ts) and plays the matching signature at a point with Graphics
 * + scene tweens, then destroys itself. Menu-scene tweens (not the battle fixed-step
 * sim), so no FxPool/pendingFx plumbing. One container per call; nothing persists.
 */
import Phaser from "phaser";
import type { ForgeFxSpec } from "../core/forgeFx.ts";

const DEPTH = 360; // above the forge dialog (320) + its content

function hex(int: number): string {
  return "#" + int.toString(16).padStart(6, "0");
}

/** A glyph mote tweened from (sx,sy) to (ex,ey); auto-destroyed at the end. */
function mote(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  glyph: string,
  color: number,
  sx: number,
  sy: number,
  ex: number,
  ey: number,
  size: number,
  delay: number,
  duration: number,
): void {
  const t = scene.add
    .text(sx, sy, glyph, { fontFamily: "sans-serif", fontSize: `${size}px`, color: hex(color) })
    .setOrigin(0.5)
    .setAlpha(0);
  parent.add(t);
  scene.tweens.add({
    targets: t,
    x: ex,
    y: ey,
    alpha: { from: 0.95, to: 0 },
    scale: { from: 1, to: 0.4 },
    delay,
    duration,
    ease: "Cubic.easeOut",
  });
}

/** Expanding stroked ring that fades out. */
function ring(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  x: number,
  y: number,
  color: number,
  r0: number,
  r1: number,
  duration: number,
  delay = 0,
): void {
  const g = scene.add.graphics().setPosition(x, y);
  parent.add(g);
  const state = { r: r0, a: 0.9 };
  scene.tweens.add({
    targets: state,
    r: r1,
    a: 0,
    delay,
    duration,
    ease: "Quad.easeOut",
    onUpdate: () => {
      g.clear();
      g.lineStyle(3, color, state.a).strokeCircle(0, 0, state.r);
    },
  });
}

/** Vertical beam/pillar that grows then fades. */
function pillar(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  x: number,
  y: number,
  color: number,
  height: number,
  duration: number,
): void {
  const g = scene.add.graphics().setPosition(x, y);
  parent.add(g);
  const state = { h: 0, a: 0.85 };
  scene.tweens.add({
    targets: state,
    h: height,
    duration: duration * 0.45,
    ease: "Quad.easeOut",
    onUpdate: () => {
      g.clear();
      g.fillStyle(color, state.a).fillRect(-7, -state.h, 14, state.h);
      g.fillStyle(0xffffff, state.a * 0.5).fillRect(-2, -state.h, 4, state.h);
    },
    onComplete: () => {
      scene.tweens.add({
        targets: state,
        a: 0,
        duration: duration * 0.55,
        onUpdate: () => {
          g.clear();
          g.fillStyle(color, state.a).fillRect(-7, -state.h, 14, state.h);
        },
      });
    },
  });
}

function playSignature(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  spec: ForgeFxSpec,
): void {
  const D = spec.durationMs;
  const N = spec.particles;
  const TAU = Math.PI * 2;

  switch (spec.kind) {
    case "ascension": {
      pillar(scene, c, x, y, spec.primary, 120, D);
      ring(scene, c, x, y, spec.accent, 16, 60, D * 0.7);
      for (let i = 0; i < N; i++) {
        const ang = (i / N) * TAU;
        const r = 52;
        mote(scene, c, spec.glyph, spec.accent, x + Math.cos(ang) * r, y + Math.sin(ang) * r - 10, x, y - 70, 20, i * 50, D - 100);
      }
      break;
    }
    case "transmute": {
      ring(scene, c, x, y, spec.primary, 50, 8, D * 0.8);
      for (let i = 0; i < N; i++) {
        const ang = (i / N) * TAU;
        const r = 60;
        mote(scene, c, spec.glyph, i % 2 ? spec.primary : spec.accent, x + Math.cos(ang) * r, y + Math.sin(ang) * r, x, y, 16, i * 40, D * 0.7);
      }
      ring(scene, c, x, y, spec.accent, 6, 54, D * 0.5, D * 0.5);
      break;
    }
    case "fusion": {
      for (let i = 0; i < N; i++) {
        const side = i % 2 ? 1 : -1;
        const sx = x + side * (70 + (i % 3) * 18);
        const sy = y + ((i % 2) - 0.5) * 30;
        mote(scene, c, spec.glyph, spec.primary, sx, sy, x, y, 18, i * 30, D * 0.55);
      }
      ring(scene, c, x, y, spec.accent, 10, 70, D * 0.5, D * 0.5);
      break;
    }
    case "featherstorm": {
      for (let i = 0; i < N; i++) {
        const side = i % 2 ? 1 : -1;
        const ang = (i / N) * TAU;
        mote(scene, c, spec.glyph, i % 3 ? spec.primary : spec.accent, x + Math.cos(ang) * 24, y + 14, x + side * (40 + i * 6), y - 70 - i * 4, 18, i * 45, D - 120);
      }
      ring(scene, c, x, y - 10, spec.accent, 14, 64, D * 0.6);
      break;
    }
    case "ashfall": {
      for (let i = 0; i < N; i++) {
        const side = i % 2 ? 1 : -1;
        mote(scene, c, spec.glyph, spec.primary, x, y - 10, x + side * (30 + i * 10), y + 50 + i * 6, 16, i * 40, D - 60);
      }
      ring(scene, c, x, y, spec.accent, 30, 4, D * 0.5);
      break;
    }
    case "starfall": {
      const beam = scene.add.graphics();
      c.add(beam);
      const bs = { a: 0.0 };
      scene.tweens.add({
        targets: bs,
        a: 0.7,
        duration: D * 0.35,
        yoyo: true,
        onUpdate: () => {
          beam.clear();
          beam.fillStyle(spec.accent, bs.a * 0.5).fillRect(x - 4, y - 150, 8, 150);
        },
      });
      mote(scene, c, spec.glyph, spec.primary, x, y - 150, x, y, 28, 0, D * 0.45);
      ring(scene, c, x, y, spec.accent, 8, 70, D * 0.5, D * 0.45);
      for (let i = 0; i < N; i++) {
        const ang = (i / N) * TAU;
        mote(scene, c, "✦", spec.accent, x, y, x + Math.cos(ang) * 60, y + Math.sin(ang) * 60, 14, D * 0.45 + i * 20, D * 0.4);
      }
      break;
    }
  }
}

export function playForgeFx(
  scene: Phaser.Scene,
  x: number,
  y: number,
  spec: ForgeFxSpec,
  onDone?: () => void,
): void {
  const c = scene.add.container(0, 0).setDepth(DEPTH);

  // A central flash common to every signature (the "strike").
  const flash = scene.add.circle(x, y, 26, spec.accent, 0.9).setBlendMode(Phaser.BlendModes.ADD);
  c.add(flash);
  scene.tweens.add({
    targets: flash,
    scale: { from: 0.3, to: 1.6 },
    alpha: 0,
    duration: spec.durationMs * 0.4,
  });

  playSignature(scene, c, x, y, spec);

  scene.time.delayedCall(spec.durationMs + 120, () => {
    c.destroy();
    onDone?.();
  });
}
