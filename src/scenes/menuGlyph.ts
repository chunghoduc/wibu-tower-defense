/**
 * menuGlyph — procedural white line/fill glyphs drawn into a Phaser Graphics as
 * the FALLBACK for a main-menu icon button when its painted SDXL texture
 * (menu__<key>) is missing. Extracted from MainMenuScene to keep that scene
 * under the 500-line cap. The standing art rule is "always SDXL"; this is only a
 * safety net so the menu is never blank while art loads or regenerates.
 */
import Phaser from "phaser";

const P = (x: number, y: number): Phaser.Geom.Point => new Phaser.Geom.Point(x, y);

function star4(x: number, y: number, outer: number, inner: number): Phaser.Geom.Point[] {
  const pts: Phaser.Geom.Point[] = [];
  for (let i = 0; i < 8; i++) {
    const r = i % 2 ? inner : outer;
    const a = (Math.PI / 4) * i - Math.PI / 2;
    pts.push(P(x + Math.cos(a) * r, y + Math.sin(a) * r));
  }
  return pts;
}

/** Paint the procedural glyph for menu `key` centred at (x,y) at scale `s`. */
export function drawMenuGlyph(
  g: Phaser.GameObjects.Graphics,
  key: string,
  x: number,
  y: number,
  s: number,
): void {
  const W = 0xffe9a8,
    A = 0x8fd0ff;
  switch (key) {
    case "battle": // crossed swords
      g.lineStyle(2.4, W, 1)
        .lineBetween(x - s, y + s, x + s, y - s)
        .lineBetween(x + s, y + s, x - s, y - s);
      g.fillStyle(W, 1)
        .fillCircle(x - s, y + s, 2)
        .fillCircle(x + s, y + s, 2);
      break;
    case "summon": // gacha orb + sparkle
      g.fillStyle(A, 1).fillCircle(x, y, s * 0.8);
      g.fillStyle(0xffffff, 0.9).fillCircle(x - s * 0.3, y - s * 0.3, s * 0.22);
      g.fillStyle(W, 1).fillPoints(star4(x + s * 0.7, y - s * 0.7, s * 0.4, s * 0.16), true);
      break;
    case "collection": // open book
      g.fillStyle(0xcfe0f5, 1)
        .fillRect(x - s, y - s * 0.7, s * 0.95, s * 1.4)
        .fillRect(x + s * 0.05, y - s * 0.7, s * 0.95, s * 1.4);
      g.lineStyle(1.5, 0x44607f, 1).lineBetween(x, y - s * 0.7, x, y + s * 0.7);
      break;
    case "shop": // cart / bag
      g.fillStyle(W, 1).fillRoundedRect(x - s * 0.8, y - s * 0.4, s * 1.6, s * 1.1, 3);
      g.lineStyle(2, W, 1).beginPath();
      g.arc(x, y - s * 0.4, s * 0.5, Math.PI, 0);
      g.strokePath();
      break;
    case "passive": // node tree
      g.lineStyle(2, A, 1)
        .lineBetween(x, y - s, x - s * 0.7, y + s * 0.6)
        .lineBetween(x, y - s, x + s * 0.7, y + s * 0.6);
      g.fillStyle(W, 1)
        .fillCircle(x, y - s, 3)
        .fillCircle(x - s * 0.7, y + s * 0.6, 3)
        .fillCircle(x + s * 0.7, y + s * 0.6, 3);
      break;
    case "hero": // helmet
      g.fillStyle(0xd6dded, 1).fillPoints(
        [
          P(x - s * 0.8, y - s * 0.2),
          P(x - s * 0.5, y - s),
          P(x + s * 0.5, y - s),
          P(x + s * 0.8, y - s * 0.2),
          P(x + s * 0.8, y + s * 0.6),
          P(x - s * 0.8, y + s * 0.6),
        ],
        true,
      );
      g.fillStyle(0x101826, 1).fillRect(x - s * 0.15, y - s * 0.2, s * 0.3, s * 0.8);
      break;
    case "squad": // three figures
      for (const ox of [-s * 0.7, 0, s * 0.7]) {
        g.fillStyle(ox === 0 ? W : A, 1).fillCircle(x + ox, y - s * 0.4, s * 0.28);
        g.fillRect(x + ox - s * 0.26, y - s * 0.1, s * 0.52, s * 0.7);
      }
      break;
    case "quests": // scroll with a checkmark
      g.fillStyle(0xf2e2b8, 1).fillRoundedRect(x - s * 0.7, y - s * 0.9, s * 1.4, s * 1.8, 3);
      g.lineStyle(1.5, 0xb89a5e, 1).strokeRoundedRect(x - s * 0.7, y - s * 0.9, s * 1.4, s * 1.8, 3);
      for (let i = -1; i <= 1; i++)
        g.lineStyle(1.4, 0x9a7d4a, 1).lineBetween(
          x - s * 0.45,
          y + i * s * 0.4,
          x + s * 0.45,
          y + i * s * 0.4,
        );
      g.lineStyle(2.6, 0x3fae5a, 1).beginPath();
      g.moveTo(x - s * 0.35, y + s * 0.05);
      g.lineTo(x - s * 0.05, y + s * 0.4);
      g.lineTo(x + s * 0.5, y - s * 0.45);
      g.strokePath();
      break;
    case "activities": // calendar/star burst
      g.fillStyle(0xf2e2b8, 1).fillRoundedRect(x - s * 0.8, y - s * 0.7, s * 1.6, s * 1.4, 3);
      g.lineStyle(1.4, 0xb89a5e, 1).strokeRoundedRect(x - s * 0.8, y - s * 0.7, s * 1.6, s * 1.4, 3);
      g.fillStyle(W, 1).fillPoints(star4(x, y, s * 0.5, s * 0.2), true);
      g.lineStyle(1.4, 0x9a7d4a, 1).lineBetween(x - s * 0.8, y - s * 0.35, x + s * 0.8, y - s * 0.35);
      break;
    case "endless": // infinity loop — eternal waves
      g.lineStyle(2.4, 0xc9a8ff, 1).strokeCircle(x - s * 0.5, y, s * 0.5);
      g.strokeCircle(x + s * 0.5, y, s * 0.5);
      g.fillStyle(0xffffff, 0.95).fillCircle(x, y, s * 0.14);
      break;
    case "forge": // anvil + spark
      g.fillStyle(0x9aa0ac, 1).fillRect(x - s * 0.7, y + s * 0.2, s * 1.4, s * 0.4);
      g.fillStyle(0x6a7079, 1).fillRect(x - s * 0.3, y + s * 0.55, s * 0.6, s * 0.35);
      g.fillStyle(W, 1).fillPoints(star4(x + s * 0.3, y - s * 0.4, s * 0.4, s * 0.16), true);
      break;
    case "achievements": { // trophy cup
      g.fillStyle(W, 1).fillRoundedRect(x - s * 0.55, y - s * 0.7, s * 1.1, s * 0.8, 3);
      g.lineStyle(2, W, 1).beginPath();
      g.arc(x - s * 0.75, y - s * 0.35, s * 0.32, Math.PI * 0.5, Math.PI * 1.5);
      g.strokePath();
      g.beginPath();
      g.arc(x + s * 0.75, y - s * 0.35, s * 0.32, Math.PI * 1.5, Math.PI * 0.5);
      g.strokePath();
      g.fillStyle(0xd6dded, 1).fillRect(x - s * 0.18, y + s * 0.1, s * 0.36, s * 0.5);
      g.fillStyle(W, 1).fillRect(x - s * 0.5, y + s * 0.6, s * 1.0, s * 0.22);
      break;
    }
    case "settings": // gear
      g.lineStyle(3.4, 0xd6dded, 1).strokeCircle(x, y, s * 0.55);
      for (let i = 0; i < 8; i++) {
        const a = (Math.PI / 4) * i;
        g.lineBetween(
          x + Math.cos(a) * s * 0.55,
          y + Math.sin(a) * s * 0.55,
          x + Math.cos(a) * s,
          y + Math.sin(a) * s,
        );
      }
      break;
    default:
      g.fillStyle(W, 1).fillCircle(x, y, s * 0.6);
  }
}
