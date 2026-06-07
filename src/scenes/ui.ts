import Phaser from "phaser";

/**
 * Crisp UI text helpers.
 *
 * The game renders at a fixed 960×540 backing buffer with `pixelArt: true`
 * (NEAREST filtering) and is then upscaled to the display by Scale.FIT — so
 * naively-drawn text is rasterised at low resolution and stretched blocky,
 * especially on hi-DPI screens. `crispText` fixes that by supersampling the
 * glyph canvas (`setResolution`) and switching that text's texture to LINEAR
 * filtering so it scales smoothly, plus a dark stroke so small text stays
 * legible over the busy battlefield.
 */

/** Supersample factor for UI text. The 960×540 buffer is upscaled to the display,
 *  so text needs extra internal resolution to stay sharp — at least 3×, more on
 *  hi-DPI screens. */
export function uiTextResolution(): number {
  const dpr = (typeof window !== "undefined" && window.devicePixelRatio) || 1;
  return Math.min(4, Math.max(3, Math.round(dpr * 2)));
}

const DEFAULT_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: '"Trebuchet MS", "Segoe UI", system-ui, sans-serif',
  stroke: "#0a0d14",
  strokeThickness: 3,
};

/** Keep a Text's glyph texture on LINEAR filtering so it scales smoothly. */
function applyCrispFilter(t: Phaser.GameObjects.Text): void {
  (t.texture as Phaser.Textures.Texture | undefined)?.setFilter(Phaser.Textures.FilterMode.LINEAR);
}

/**
 * Updating a Text (setText) re-rasterises its canvas, and under `pixelArt: true`
 * the rebuilt texture inherits NEAREST filtering — so dynamic text (tooltips,
 * HP/MP, HUD counters) turns blocky and hard to read. Patch setText to re-apply
 * LINEAR after every update so it stays crisp.
 */
function keepCrispOnUpdate(t: Phaser.GameObjects.Text): void {
  const original = t.setText.bind(t);
  t.setText = (value: string | string[]) => {
    const r = original(value);
    applyCrispFilter(t);
    return r;
  };
}

/** Add a high-resolution, smoothly-filtered, outlined Text. Drop-in for add.text. */
export function crispText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string | string[],
  style: Phaser.Types.GameObjects.Text.TextStyle = {},
): Phaser.GameObjects.Text {
  const t = scene.add.text(x, y, text, { ...DEFAULT_STYLE, ...style });
  t.setResolution(uiTextResolution());
  applyCrispFilter(t);
  keepCrispOnUpdate(t);
  return t;
}

/** Upgrade an already-created Text in place (for code paths that build the Text
 *  themselves). Safe to call once after creation. */
export function makeCrisp(t: Phaser.GameObjects.Text): Phaser.GameObjects.Text {
  t.setResolution(uiTextResolution());
  applyCrispFilter(t);
  keepCrispOnUpdate(t);
  return t;
}
