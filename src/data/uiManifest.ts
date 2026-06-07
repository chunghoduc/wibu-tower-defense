/**
 * UI / icon / background art manifest (authored by the design team, see
 * public/assets/ui/README.md). Maps Phaser texture keys to files so PreloadScene
 * can preload them in one loop. SVGs rasterize at intrinsic size; PNGs load as
 * images. Keys follow the `category__name` convention (icon__gold, frame__rare,
 * bg__stage-1, ui__logo, …).
 *
 * The JSON is a build-time copy of public/assets/ui/uiManifest.json (the design
 * team's source) — kept in src/ because Vite forbids importing from public/.
 * Re-copy it if the design team updates the public manifest. The asset PATHS
 * inside stay as runtime URLs served from public/.
 */
import manifest from "./uiManifest.json";

export interface UiAsset {
  key: string;
  path: string;
  w: number;
  h: number;
}

/** SVG assets — loaded via load.svg with their intrinsic width/height. */
export const UI_SVGS: UiAsset[] = [
  ...manifest.icons, ...manifest.frames, ...manifest.buttons,
  ...manifest.panels, ...manifest.passive, ...manifest.badges,
];

/** Raster assets (logo + backgrounds) — loaded via load.image. */
export const UI_IMAGES: UiAsset[] = [...manifest.logo, ...manifest.backgrounds];

/** Texture key for a stage's hand-painted backdrop (stage id like "ch1-s7" → bg__stage-7). */
export function stageBgKey(stageId: string): string {
  const n = stageId.match(/(\d+)$/);
  return `bg__stage-${n ? n[1] : 1}`;
}

/** Rarity → card frame texture key. */
export function frameKey(rarity: string): string {
  return `frame__${rarity.toLowerCase()}`;
}
