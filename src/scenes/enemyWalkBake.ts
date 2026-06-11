// Preload-time synthesis of a 4-frame walk/flap cycle for every enemy, baked from
// its single loaded SDXL sprite by warping horizontal bands (see enemyWalkWarp.ts).
// Produces a CanvasTexture under the same `enemy__<id>` key + a `<key>_walk` anim,
// so the existing data-driven runtime (animateEnemy) plays it with no further wiring.
import Phaser from "phaser";
import { ENEMIES } from "../data/enemies.ts";
import { bandWarp, type MotionProfile } from "./enemyWalkWarp.ts";

const FRAMES = 4;     // 4-frame loop: contact-L → passing → contact-R → passing
const BANDS = 24;     // horizontal slices per frame (quality/perf knob)

const FLYERS = new Set(ENEMIES.filter((e) => e.flying).map((e) => e.id));

/** Bake walk/flap frames for one enemy id. Idempotent (skips if anim exists). */
function bakeOne(scene: Phaser.Scene, id: string): void {
  const key = `enemy__${id}`;
  if (!scene.textures.exists(key)) return;
  if (scene.anims.exists(`${key}_walk`)) return; // already baked (re-entry safe)

  const src = scene.textures.get(key).getSourceImage() as CanvasImageSource & {
    width: number; height: number;
  };
  const w = src.width, h = src.height;
  if (!w || !h) return;

  const profile: MotionProfile = FLYERS.has(id) ? "flap" : "walk";
  const cx = w / 2;

  const canvas = document.createElement("canvas");
  canvas.width = w * FRAMES;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  for (let f = 0; f < FRAMES; f++) {
    const phase = (f / FRAMES) * Math.PI * 2;
    const baseX = f * w;
    for (let b = 0; b < BANDS; b++) {
      const sy = Math.floor((b / BANDS) * h);
      const sh = Math.ceil(h / BANDS) + 1;          // +1px overlap hides seams
      const yNorm = (sy + sh / 2) / h;
      // left and right halves shear oppositely (alternating legs)
      for (const side of [-1, 1] as const) {
        const sx = side < 0 ? 0 : Math.floor(cx);
        const sw = side < 0 ? Math.ceil(cx) : w - Math.floor(cx);
        const { dx, dy } = bandWarp(profile, yNorm, side, phase);
        ctx.drawImage(src, sx, sy, sw, sh, baseX + sx + dx, sy + dy, sw, sh);
      }
    }
  }

  // Re-key as enemy__<id> with FRAMES grid frames named walk1..walkN.
  scene.textures.remove(key);
  const tex = scene.textures.addCanvas(key, canvas);
  if (!tex) return;
  for (let f = 0; f < FRAMES; f++) tex.add(`walk${f + 1}`, 0, f * w, 0, w, h);

  scene.anims.create({
    key: `${key}_walk`,
    frames: Array.from({ length: FRAMES }, (_, f) => ({ key, frame: `walk${f + 1}` })),
    frameRate: 7,
    repeat: -1,
  });
}

/** Bake every enemy's walk cycle. Call once from PreloadScene.create(). */
export function bakeEnemyWalks(scene: Phaser.Scene): void {
  for (const e of ENEMIES) bakeOne(scene, e.id);
}
