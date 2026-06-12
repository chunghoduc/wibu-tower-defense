// Preload-time synthesis of a heavy 4-frame "stomp" walk cycle for every BOSS,
// baked from the FIRST frame of its loaded SDXL sprite by warping horizontal
// bands (see enemyWalkWarp.ts, "stomp" profile). This writes to a SEPARATE
// texture key (`boss__<id>__walk`) and never removes the
// original texture, so the sliced atk*/skill* one-shot frames + their anims
// (built earlier in PreloadScene.create) survive for the boss cast pose.
import Phaser from "phaser";
import { ENEMIES } from "../data/enemies.ts";
import { bandWarp } from "./enemyWalkWarp.ts";

const FRAMES = 4;   // contact-L → passing → contact-R → passing
const BANDS = 24;   // horizontal slices per frame

const BOSS_IDS = ENEMIES.filter((e) => e.archetype === "Boss").map((e) => e.id);

/** Bake one boss's stomp cycle. Idempotent (skips if the walk texture exists). */
function bakeOne(scene: Phaser.Scene, id: string): void {
  const key = `boss__${id}`;
  const walkKey = `${key}__walk`;
  if (!scene.textures.exists(key)) return;
  if (scene.textures.exists(walkKey)) return; // re-entry safe

  // Bake from the FIRST frame only (the sheet may hold atk/skill frames too).
  const frame0 = scene.textures.getFrame(key, 0);
  if (!frame0) return;
  const fw = frame0.cutWidth, fh = frame0.cutHeight;
  const ox = frame0.cutX, oy = frame0.cutY;
  if (!fw || !fh) return;

  const src = scene.textures.get(key).getSourceImage() as CanvasImageSource;
  const cx = fw / 2;

  const canvas = document.createElement("canvas");
  canvas.width = fw * FRAMES;
  canvas.height = fh;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  for (let f = 0; f < FRAMES; f++) {
    const phase = (f / FRAMES) * Math.PI * 2;
    const baseX = f * fw;
    for (let b = 0; b < BANDS; b++) {
      const sy = Math.floor((b / BANDS) * fh);
      const sh = Math.ceil(fh / BANDS) + 1;            // +1px overlap hides seams
      const yNorm = (sy + sh / 2) / fh;
      for (const side of [-1, 1] as const) {
        const sx = side < 0 ? 0 : Math.floor(cx);
        const sw = side < 0 ? Math.ceil(cx) : fw - Math.floor(cx);
        const { dx, dy } = bandWarp("stomp", yNorm, side, phase);
        ctx.drawImage(src, ox + sx, oy + sy, sw, sh, baseX + sx + dx, sy + dy, sw, sh);
      }
    }
  }

  const tex = scene.textures.addCanvas(walkKey, canvas);
  if (!tex) return;
  for (let f = 0; f < FRAMES; f++) tex.add(`walk${f + 1}`, 0, f * fw, 0, fw, fh);

  // Replace the preload-built 2-frame fake walk with the real baked stride.
  if (scene.anims.exists(`${key}_walk`)) scene.anims.remove(`${key}_walk`);
  scene.anims.create({
    key: `${key}_walk`,
    frames: Array.from({ length: FRAMES }, (_, f) => ({ key: walkKey, frame: `walk${f + 1}` })),
    frameRate: 6,   // a touch slower than enemies (7) — bosses are heavy
    repeat: -1,
  });
}

/** Bake every boss's stomp cycle. Call once from PreloadScene.create(). */
export function bakeBossWalks(scene: Phaser.Scene): void {
  for (const id of BOSS_IDS) bakeOne(scene, id);
}
