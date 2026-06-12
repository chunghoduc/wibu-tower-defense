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

/** The single UI font stack. Shared so canvas-measured layout (name plates)
 *  matches what crispText actually rasterises. */
export const UI_FONT_FAMILY = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';

const DEFAULT_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: UI_FONT_FAMILY,
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

/**
 * Text for an opaque dark panel or tooltip. The panel itself supplies contrast,
 * so the heavy battlefield outline (`strokeThickness: 3`) is the WRONG choice
 * here — at tooltip sizes (10–14px) that thick halo fattens every glyph, smears
 * the anti-aliasing, and makes adjacent lines' outlines collide into an
 * unreadable blur. Drop to a hairline 1px stroke (still helps colour text pop
 * against the panel) for crisp, legible small text. Callers may still override.
 */
export function panelText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string | string[],
  style: Phaser.Types.GameObjects.Text.TextStyle = {},
): Phaser.GameObjects.Text {
  return crispText(scene, x, y, text, { strokeThickness: 1, ...style });
}

/** Upgrade an already-created Text in place (for code paths that build the Text
 *  themselves). Safe to call once after creation. */
export function makeCrisp(t: Phaser.GameObjects.Text): Phaser.GameObjects.Text {
  t.setResolution(uiTextResolution());
  applyCrispFilter(t);
  keepCrispOnUpdate(t);
  return t;
}

type HoverParent = Phaser.GameObjects.Container | { add(obj: Phaser.GameObjects.GameObject): unknown; bringToTop?(obj: Phaser.GameObjects.GameObject): unknown } | null;

/**
 * Attach a hover glow to an item region: a bright rounded-rect outline + faint
 * fill that appears while `emitter` is hovered. `parent` (a container/layer)
 * owns the glow; if null it's a scene object at `depth`. Returns the graphics.
 */
export function hoverGlowRect(
  scene: Phaser.Scene,
  emitter: Phaser.GameObjects.GameObject,
  parent: HoverParent,
  x: number, y: number, w: number, h: number,
  opts: { radius?: number; color?: number; depth?: number } = {},
): Phaser.GameObjects.Graphics {
  const { radius = 6, color = 0xfff0bf, depth } = opts;
  const g = scene.add.graphics().setVisible(false);
  g.fillStyle(color, 0.10).fillRoundedRect(x, y, w, h, radius);
  g.lineStyle(2.5, color, 0.95).strokeRoundedRect(x, y, w, h, radius);
  if (parent) parent.add(g as unknown as Phaser.GameObjects.GameObject);
  else if (depth != null) g.setDepth(depth);
  emitter.on("pointerover", () => { g.setVisible(true); parent?.bringToTop?.(g as unknown as Phaser.GameObjects.GameObject); });
  emitter.on("pointerout", () => g.setVisible(false));
  return g;
}

/** Tween a display object's scale up while hovered (a little "pop"). */
export function hoverPop(
  scene: Phaser.Scene,
  emitter: Phaser.GameObjects.GameObject,
  target: Phaser.GameObjects.Components.Transform,
  up = 1.12,
): void {
  const sx = target.scaleX, sy = target.scaleY;
  emitter.on("pointerover", () => scene.tweens.add({ targets: target, scaleX: sx * up, scaleY: sy * up, duration: 90, ease: "Back.easeOut" }));
  emitter.on("pointerout", () => scene.tweens.add({ targets: target, scaleX: sx, scaleY: sy, duration: 120, ease: "Quad.easeOut" }));
}
