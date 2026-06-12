/**
 * One shared rule for drawing a reward/item icon so the SAME `item__<id>` (or
 * material/jewel) texture looks identical everywhere — inventory, shop, the
 * loot-box reveal and the post-battle reward panel.
 *
 * Before this, each surface hand-rolled its own size: the bag and shop scaled
 * the icon to FILL its tile, but the loot popups used a tiny fixed
 * `setDisplaySize(34)`, so a freshly-looted item looked smaller and softer than
 * the very same item in the bag ("old art"). `iconFitScale` is the single
 * sizing rule (scale the longer edge to `fit`, preserve aspect) and `addFitIcon`
 * is the one-liner the scenes call.
 */
import type Phaser from "phaser";

/**
 * Scale factor so an icon whose native size is `nativeW × nativeH` fits inside a
 * `fit × fit` box with its aspect ratio preserved (longer edge == fit). Guards a
 * zero/unknown native size (texture not ready) so it never returns NaN/Infinity.
 */
export function iconFitScale(nativeW: number, nativeH: number, fit: number): number {
  const longest = Math.max(nativeW, nativeH);
  if (longest <= 0) return 1;
  return fit / longest;
}

/**
 * Make an icon scaled to a `fit`-px box (aspect preserved), or the `fallback`
 * emoji/glyph when the texture isn't loaded. Always returns the GameObject so
 * the caller reparents it (`container.add(makeFitIcon(...))`); check
 * `obj.type === "Image"` when an icon-only effect (e.g. hover-pop) is wanted.
 */
export function makeFitIcon(
  scene: Phaser.Scene,
  x: number,
  y: number,
  key: string,
  fit: number,
  fallback: string,
): Phaser.GameObjects.Image | Phaser.GameObjects.Text {
  if (key && scene.textures.exists(key)) {
    const img = scene.add.image(x, y, key).setOrigin(0.5);
    img.setScale(iconFitScale(img.width, img.height, fit));
    return img;
  }
  return scene.add.text(x, y, fallback, { fontSize: `${Math.round(fit * 0.6)}px` }).setOrigin(0.5);
}
