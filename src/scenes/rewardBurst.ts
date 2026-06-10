/**
 * rewardBurst — a self-contained celebration VFX for claiming a reward.
 *
 * Plays at a screen point: an expanding flash ring, a shower of emoji "coins"
 * launched on real projectile arcs (gravity), and a reward label that pops and
 * floats up. Everything is added to the scene root at a high depth and tears
 * itself down (<1s), so callers fire-and-forget — it survives a redraw() that
 * rebuilds the underlying panel layer.
 *
 * The codebase has no particle system; this stays in the established tween +
 * graphics + crispText idiom so it matches every other animation in the game.
 */
import Phaser from "phaser";
import { crispText } from "./ui.ts";
import type { Reward } from "../core/rewards.ts";

const DEPTH = 200;

export interface BurstOpts {
  /** Glyphs flung outward. Defaults to a sparkle shower. */
  emojis?: string[];
  /** Ring / label accent colour (hex int). Defaults to gold. */
  accent?: number;
  /** Particle count. Defaults to 18. */
  count?: number;
  /** Big rising headline (e.g. the reward summary). Optional. */
  label?: string;
}

/** Pick fitting particle glyphs for a reward bundle (gold/diamond/material). */
export function rewardEmojis(reward: Reward): string[] {
  const e: string[] = [];
  if (reward.gold) e.push("🪙", "🪙", "🪙");
  if (reward.diamonds) e.push("💎", "💎");
  if (reward.materials && Object.values(reward.materials).some((n) => n > 0)) e.push("✨", "🔮");
  return e.length ? e : ["✨"];
}

/** Fire the celebration at (x, y) in screen space. Fire-and-forget. */
export function rewardBurst(scene: Phaser.Scene, x: number, y: number, opts: BurstOpts = {}): void {
  const emojis = opts.emojis ?? ["✨"];
  const accent = opts.accent ?? 0xffd24d;
  const count = opts.count ?? 18;

  // ── Flash ring: a stroke circle that expands and fades. ──
  const ring = scene.add.graphics().setDepth(DEPTH);
  const flash = { r: 6, a: 0.9 };
  scene.tweens.add({
    targets: flash, r: 64, a: 0, duration: 420, ease: "Cubic.easeOut",
    onUpdate: () => {
      ring.clear();
      ring.lineStyle(3, accent, flash.a).strokeCircle(x, y, flash.r);
      ring.fillStyle(accent, flash.a * 0.18).fillCircle(x, y, flash.r * 0.7);
    },
    onComplete: () => ring.destroy(),
  });

  // ── Particle shower: emoji glyphs on projectile arcs. ──
  const g = 560; // px/s² downward
  for (let i = 0; i < count; i++) {
    const glyph = emojis[i % emojis.length];
    const p = scene.add.text(x, y, glyph, { fontSize: "20px" }).setOrigin(0.5).setDepth(DEPTH);
    // Mostly-upward launch with a wide horizontal spread.
    const ang = -Math.PI / 2 + (Math.random() - 0.5) * 2.0;
    const speed = 110 + Math.random() * 180;
    const vx = Math.cos(ang) * speed;
    const vy = Math.sin(ang) * speed;
    const dur = 620 + Math.random() * 320;
    const spin = (Math.random() - 0.5) * 360;
    const proxy = { t: 0 };
    p.setScale(0.6 + Math.random() * 0.5);
    scene.tweens.add({
      targets: proxy, t: dur / 1000, duration: dur, ease: "Linear",
      onUpdate: () => {
        const s = proxy.t;
        p.x = x + vx * s;
        p.y = y + vy * s + 0.5 * g * s * s;
        p.rotation = (spin * s * Math.PI) / 180;
        const k = proxy.t / (dur / 1000);
        p.alpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1; // fade out in the last 30%
      },
      onComplete: () => p.destroy(),
    });
  }

  // ── Rising headline label. ──
  if (opts.label) {
    const t = crispText(scene, x, y - 18, opts.label, {
      fontSize: "16px", color: "#fff4d0", fontStyle: "bold", stroke: "#3a2606", strokeThickness: 5,
    }).setOrigin(0.5).setDepth(DEPTH + 1).setScale(0.5);
    scene.tweens.add({ targets: t, scale: 1.08, duration: 220, ease: "Back.easeOut", yoyo: false });
    scene.tweens.add({
      targets: t, y: y - 64, alpha: 0, duration: 1100, delay: 260, ease: "Cubic.easeIn",
      onComplete: () => t.destroy(),
    });
  }
}
