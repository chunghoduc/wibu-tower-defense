/**
 * PreloadScene — first scene in boot order. Loads every pixel-art sprite sheet
 * from the generated manifest and builds Phaser animations from each sheet's
 * frame names. Missing files are non-fatal (loaderror swallowed); renderers fall
 * back to placeholder shapes via hasSprite().
 */
import Phaser from "phaser";
import { SPRITE_MANIFEST, SPRITE_BY_KEY } from "../data/spriteManifest.ts";
import { TERRAIN_ASSETS, TERRAIN_TEX_SIZE } from "../data/terrainManifest.ts";
import { SKILL_ICON_IDS } from "../data/skillIconManifest.ts";
import { BG_IMAGES, bgKey } from "../data/bgManifest.ts";
import { UI_SVGS, UI_IMAGES } from "../data/uiManifest.ts";

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super("PreloadScene");
  }

  preload(): void {
    this.load.on("loaderror", (file: Phaser.Loader.File) => void file);
    for (const e of SPRITE_MANIFEST) {
      this.load.spritesheet(e.key, e.path, { frameWidth: e.frameWidth, frameHeight: e.frameHeight });
    }
    // Terrain map art (T13): Phaser rasterizes the .svg to a texture in-browser.
    for (const t of TERRAIN_ASSETS) {
      this.load.svg(t.key, t.path, { width: TERRAIN_TEX_SIZE, height: TERRAIN_TEX_SIZE });
    }
    // Painted skill ability icons (96×96). Skip ids already in the manifest so a
    // future `gen.mjs --only=manifest` that folds them in won't double-load.
    for (const id of SKILL_ICON_IDS) {
      const key = `skill__${id}`;
      if (SPRITE_BY_KEY.has(key)) continue;
      this.load.spritesheet(key, `assets/sprites/skill/${id}.png`, { frameWidth: 96, frameHeight: 96 });
    }
    // Scene backgrounds: main-menu hall + per-chapter battlefield backdrops.
    for (const id of BG_IMAGES) {
      this.load.image(bgKey(id), `assets/bg/${id}.png`);
    }
    // Design-team UI art set (icons, frames, buttons, badges, per-stage
    // backdrops, logo) — catalogued in public/assets/ui/uiManifest.json.
    for (const e of UI_SVGS) this.load.svg(e.key, e.path, { width: e.w, height: e.h });
    for (const e of UI_IMAGES) this.load.image(e.key, e.path);
    // Painted main-menu button icons (SDXL).
    for (const id of ["battle", "summon", "collection", "inventory", "squad", "passive", "shop", "skills", "settings"]) {
      this.load.image(`menu__${id}`, `assets/ui/menu/${id}.png`);
    }
  }

  create(): void {
    for (const e of SPRITE_MANIFEST) {
      if (!this.textures.exists(e.key) || e.frames <= 1) continue;
      const idx = (re: RegExp) => e.names.map((n, i) => ({ n, i })).filter((x) => re.test(x.n)).map((x) => x.i);
      const mk = (suffix: string, frames: number[], frameRate: number, repeat: number) => {
        if (!frames.length) return;
        const key = `${e.key}_${suffix}`;
        if (this.anims.exists(key)) return;
        this.anims.create({ key, frames: frames.map((f) => ({ key: e.key, frame: f })), frameRate, repeat });
      };
      mk("idle", idx(/idle/), 3, -1);
      mk("walk", idx(/walk/), 6, -1);
      mk("attack", idx(/atk|cast/), 9, 0);
      mk("cast", idx(/skill/), 10, 0);  // skill-cast frames (hero + skill-having towers)
      mk("hurt", idx(/hurt/), 6, 0);
    }
    this.scene.start("MainMenuScene");
  }
}

/** True when a generated sprite texture is loaded for `key` (e.g. "tower__karu-sunfist"). */
export function hasSprite(scene: Phaser.Scene, key: string): boolean {
  return scene.textures.exists(key);
}

/** Frame count for a sprite key (1 if static / unknown). */
export function spriteFrames(key: string): number {
  return SPRITE_BY_KEY.get(key)?.frames ?? 1;
}
