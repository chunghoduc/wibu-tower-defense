/**
 * PreloadScene — first scene in the boot order.
 *
 * Attempts to load every sprite named by the art manifest. Missing files are
 * NOT fatal: Phaser emits a load error per missing file, we swallow it, and
 * renderers fall back to placeholder shapes via hasSprite(). This lets the game
 * run with zero art today and light up automatically as PNGs are dropped into
 * /public/assets/sprites/ — no code change required.
 */
import Phaser from "phaser";
import { allArtPrompts } from "../data/artPrompts.ts";

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super("PreloadScene");
  }

  preload(): void {
    // Swallow missing-file errors — absent art is expected until generated.
    this.load.on("loaderror", (file: Phaser.Loader.File) => {
      // Intentionally silent: hasSprite() will report false for this key.
      void file;
    });

    for (const entry of allArtPrompts()) {
      // entry.path is relative to /public; Phaser resolves it from the base URL.
      this.load.image(entry.key, entry.path);
    }
  }

  create(): void {
    this.scene.start("MainMenuScene");
  }
}

/** True when a generated sprite texture is loaded and usable for `key`. */
export function hasSprite(scene: Phaser.Scene, key: string): boolean {
  return scene.textures.exists(key);
}
