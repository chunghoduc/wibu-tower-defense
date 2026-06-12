/**
 * battleInfoGlyphs — procedural icon glyph drawers for the battle info panel.
 * Pure Graphics-painting helpers: stat glyphs (atk/range/crit/…) and skill
 * glyphs (keyword-themed fallbacks when no painted icon texture exists).
 * Extracted verbatim from battleInfoPanel.ts.
 */
import Phaser from "phaser";

export function drawStatGlyph(
  g: Phaser.GameObjects.Graphics,
  key: string,
  x: number,
  y: number,
  s: number,
): void {
  const W = 0xffffff;
  switch (key) {
    case "atk": // sword
      g.fillStyle(0xd6dded, 1).fillRect(x - 1.4, y - s, 2.8, s * 1.5);
      g.fillStyle(0x9aa6bb, 1).fillRect(x - s * 0.55, y + s * 0.2, s * 1.1, 2.4);
      break;
    case "range": // target
      g.lineStyle(1.6, 0x66d0ff, 1)
        .strokeCircle(x, y, s)
        .strokeCircle(x, y, s * 0.5);
      g.fillStyle(0x66d0ff, 1).fillCircle(x, y, 1.4);
      break;
    case "attackSpeed": // bolt
      g.fillStyle(0xffe07a, 1).fillPoints(
        [
          P(x - 1, y - s),
          P(x + s * 0.5, y - s * 0.1),
          P(x - 0.5, y - s * 0.1),
          P(x + 1, y + s),
          P(x - s * 0.6, y + s * 0.1),
          P(x + 0.5, y + s * 0.1),
        ],
        true,
      );
      break;
    case "critRate": // crosshair
      g.lineStyle(1.5, 0xff8a5a, 1).strokeCircle(x, y, s * 0.85);
      g.lineBetween(x - s, y, x + s, y).lineBetween(x, y - s, x, y + s);
      break;
    case "critDamage": // burst star
      g.fillStyle(0xffb066, 1).fillPoints(star4(x, y, s, s * 0.4), true);
      break;
    case "armor": // shield
      g.fillStyle(0x8fd0a0, 1).fillPoints(
        [
          P(x - s * 0.7, y - s),
          P(x + s * 0.7, y - s),
          P(x + s * 0.7, y + s * 0.2),
          P(x, y + s),
          P(x - s * 0.7, y + s * 0.2),
        ],
        true,
      );
      break;
    case "magicResist": // shield + gem
      g.fillStyle(0x6fa8ff, 1).fillPoints(
        [
          P(x - s * 0.7, y - s),
          P(x + s * 0.7, y - s),
          P(x + s * 0.7, y + s * 0.2),
          P(x, y + s),
          P(x - s * 0.7, y + s * 0.2),
        ],
        true,
      );
      g.fillStyle(W, 0.7).fillPoints(diamond(x, y - s * 0.1, s * 0.4), true);
      break;
    case "moveSpeed": // chevrons
      g.lineStyle(1.8, 0x9be0a0, 1);
      for (const o of [-s * 0.5, s * 0.3]) {
        g.beginPath();
        g.moveTo(x + o - 2, y - s * 0.6);
        g.lineTo(x + o + 2, y);
        g.lineTo(x + o - 2, y + s * 0.6);
        g.strokePath();
      }
      break;
    case "hpRegen": // heart
      g.fillStyle(0xef7a8a, 1)
        .fillCircle(x - s * 0.35, y - s * 0.2, s * 0.45)
        .fillCircle(x + s * 0.35, y - s * 0.2, s * 0.45);
      g.fillTriangle(x - s * 0.75, y - s * 0.05, x + s * 0.75, y - s * 0.05, x, y + s * 0.8);
      break;
    case "skillPower": // wand star
      g.lineStyle(2, 0xcaa0ff, 1).lineBetween(x - s * 0.6, y + s * 0.6, x + s * 0.2, y - s * 0.2);
      g.fillStyle(0xe0c0ff, 1).fillPoints(star4(x + s * 0.4, y - s * 0.4, s * 0.6, s * 0.25), true);
      break;
    case "omnivamp": // droplet
      g.fillStyle(0xff6a6a, 1).fillCircle(x, y + s * 0.25, s * 0.6);
      g.fillTriangle(x - s * 0.5, y, x + s * 0.5, y, x, y - s * 0.85);
      break;
    case "goldFind": // coin
      g.fillStyle(0xffd34d, 1).fillCircle(x, y, s * 0.85);
      g.lineStyle(1.4, 0x9a6a1a, 1).strokeCircle(x, y, s * 0.85);
      g.fillStyle(0x9a6a1a, 1).fillRect(x - s * 0.1, y - s * 0.4, s * 0.2, s * 0.8);
      break;
    case "armorPen": // pierce arrow
      g.lineStyle(1.8, 0xffc04a, 1).lineBetween(x, y - s, x, y + s);
      g.fillStyle(0xffc04a, 1).fillTriangle(
        x - s * 0.5,
        y + s * 0.3,
        x + s * 0.5,
        y + s * 0.3,
        x,
        y + s,
      );
      break;
    case "magicPen": // pierce arrow (arcane)
      g.lineStyle(1.8, 0xc792ff, 1).lineBetween(x, y - s, x, y + s);
      g.fillStyle(0xc792ff, 1).fillTriangle(
        x - s * 0.5,
        y + s * 0.3,
        x + s * 0.5,
        y + s * 0.3,
        x,
        y + s,
      );
      break;
    case "damageReduction": // shield with bar
      g.fillStyle(0x7fa8d8, 1).fillPoints(
        [
          P(x - s * 0.7, y - s),
          P(x + s * 0.7, y - s),
          P(x + s * 0.7, y + s * 0.2),
          P(x, y + s),
          P(x - s * 0.7, y + s * 0.2),
        ],
        true,
      );
      g.fillStyle(0x12203a, 1).fillRect(x - s * 0.45, y - s * 0.2, s * 0.9, 1.8);
      break;
    case "critDefense": // shield + crosshair
      g.fillStyle(0xff9aa0, 1).fillPoints(
        [
          P(x - s * 0.7, y - s),
          P(x + s * 0.7, y - s),
          P(x + s * 0.7, y + s * 0.2),
          P(x, y + s),
          P(x - s * 0.7, y + s * 0.2),
        ],
        true,
      );
      g.lineStyle(1.2, 0x3a1414, 1).strokeCircle(x, y - s * 0.1, s * 0.4);
      break;
    case "tenacity": // unbroken ring
      g.lineStyle(2, 0xd8c46a, 1).strokeCircle(x, y, s * 0.75);
      g.fillStyle(0xd8c46a, 1).fillCircle(x, y - s * 0.75, 1.6);
      break;
    default:
      g.fillStyle(0x9fb0c4, 1).fillCircle(x, y, 2);
  }
}

export function drawSkillGlyph(
  g: Phaser.GameObjects.Graphics,
  label: string,
  desc: string,
  x: number,
  y: number,
  s: number,
  col: number,
): void {
  const t = (label + " " + desc).toLowerCase();
  if (label.startsWith("▲")) {
    // upgrade → up chevron
    g.lineStyle(2, col, 1);
    g.beginPath();
    g.moveTo(x - s * 0.6, y + s * 0.4);
    g.lineTo(x, y - s * 0.5);
    g.lineTo(x + s * 0.6, y + s * 0.4);
    g.strokePath();
    return;
  }
  if (has(t, "fire", "flame", "ember", "inferno", "eruption", "magma", "burn", "wild", "ignit")) {
    // flame
    g.fillStyle(0xff6a2a, 1).fillCircle(x, y + s * 0.3, s * 0.55);
    g.fillTriangle(x - s * 0.5, y + s * 0.1, x + s * 0.5, y + s * 0.1, x, y - s * 0.8);
    g.fillStyle(0xffd24d, 1).fillCircle(x, y + s * 0.35, s * 0.25);
    return;
  }
  if (has(t, "ice", "frost", "glaci", "blizzard", "geyser", "freez", "chill", "snow")) {
    // snowflake
    g.lineStyle(1.6, 0x9fe6ff, 1);
    for (let i = 0; i < 3; i++) {
      const a = (Math.PI / 3) * i;
      g.lineBetween(
        x - Math.cos(a) * s,
        y - Math.sin(a) * s,
        x + Math.cos(a) * s,
        y + Math.sin(a) * s,
      );
    }
    return;
  }
  if (has(t, "thunder", "lightning", "chain", "bolt", "spark", "kirin", "storm")) {
    // bolt
    g.fillStyle(0x9fe6ff, 1).fillPoints(
      [
        P(x - 1, y - s),
        P(x + s * 0.5, y - s * 0.1),
        P(x - 0.5, y - s * 0.1),
        P(x + 1, y + s),
        P(x - s * 0.6, y + s * 0.1),
        P(x + 0.5, y + s * 0.1),
      ],
      true,
    );
    return;
  }
  if (
    has(
      t,
      "heal",
      "rally",
      "rebirth",
      "reject",
      "blessing",
      "pep",
      "cheer",
      "shield",
      "ward",
      "bulwark",
    )
  ) {
    // plus
    g.fillStyle(0x8be06a, 1)
      .fillRect(x - s * 0.25, y - s, s * 0.5, s * 2)
      .fillRect(x - s, y - s * 0.25, s * 2, s * 0.5);
    return;
  }
  if (has(t, "poison", "plague", "rot", "venom", "toxin", "bramble", "corros")) {
    // drop
    g.fillStyle(0x8bc34a, 1).fillCircle(x, y + s * 0.25, s * 0.55);
    g.fillTriangle(x - s * 0.5, y, x + s * 0.5, y, x, y - s * 0.8);
    return;
  }
  if (has(t, "slash", "cleave", "iaido", "blade", "sword", "strike", "punch", "fist")) {
    // slash
    g.lineStyle(2.2, 0xffe07a, 1).lineBetween(x - s * 0.7, y + s * 0.7, x + s * 0.7, y - s * 0.7);
    return;
  }
  // default: star (arcane / generic active or passive)
  g.fillStyle(col, 1).fillPoints(star4(x, y, s, s * 0.4), true);
}

const P = (x: number, y: number) => new Phaser.Geom.Point(x, y);
const has = (s: string, ...k: string[]) => k.some((w) => s.includes(w));
function star4(x: number, y: number, outer: number, inner: number): Phaser.Geom.Point[] {
  const pts: Phaser.Geom.Point[] = [];
  for (let i = 0; i < 8; i++) {
    const r = i % 2 ? inner : outer;
    const a = (Math.PI / 4) * i - Math.PI / 2;
    pts.push(P(x + Math.cos(a) * r, y + Math.sin(a) * r));
  }
  return pts;
}
function diamond(x: number, y: number, r: number): Phaser.Geom.Point[] {
  return [P(x, y - r), P(x + r, y), P(x, y + r), P(x - r, y)];
}
