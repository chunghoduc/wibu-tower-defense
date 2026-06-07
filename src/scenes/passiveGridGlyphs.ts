import Phaser from "phaser";
import type { PassiveNodeDef } from "../data/schema.ts";

// ── Per-region icon glyphs drawn with Phaser.Graphics (T1 / T18) ──────────────
// Each glyph is a tiny recognisable shape centred at (x,y), sized to s (half-size).
type GlyphFn = (g: Phaser.GameObjects.Graphics, x: number, y: number, s: number, col: number) => void;

const REGION_GLYPH: Record<string, GlyphFn> = {
  brawler: (g, x, y, s, col) => {          // sword
    g.fillStyle(col, 1).fillRect(x - s * 0.18, y - s, s * 0.36, s * 1.5);
    g.fillStyle(col, 0.7).fillRect(x - s * 0.55, y - s * 0.15, s * 1.1, s * 0.28);
    g.fillStyle(col, 0.5).fillCircle(x, y + s * 0.65, s * 0.22);
  },
  arcane: (g, x, y, s, col) => {           // 4-point star
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 - Math.PI / 4;
      g.fillStyle(col, 1).fillTriangle(x, y, x + Math.cos(a) * s * 0.45, y + Math.sin(a) * s * 0.45, x + Math.cos(a + Math.PI / 4) * s * 0.22, y + Math.sin(a + Math.PI / 4) * s * 0.22);
    }
    g.fillStyle(0xffffff, 0.7).fillCircle(x, y, s * 0.22);
  },
  warden: (g, x, y, s, col) => {           // shield
    g.fillStyle(col, 0.9);
    g.fillPoints([new Phaser.Geom.Point(x - s * 0.65, y - s), new Phaser.Geom.Point(x + s * 0.65, y - s), new Phaser.Geom.Point(x + s * 0.65, y + s * 0.25), new Phaser.Geom.Point(x, y + s), new Phaser.Geom.Point(x - s * 0.65, y + s * 0.25)], true);
    g.fillStyle(0xffffff, 0.25).fillRect(x - s * 0.3, y - s * 0.7, s * 0.25, s * 1.2);
  },
  tactician: (g, x, y, s, col) => {        // coin circle with cross
    g.fillStyle(col, 1).fillCircle(x, y, s * 0.75);
    g.fillStyle(0x000000, 0.4).fillRect(x - s * 0.12, y - s * 0.5, s * 0.24, s); // vertical bar
    g.fillStyle(0x000000, 0.4).fillRect(x - s * 0.5, y - s * 0.12, s, s * 0.24); // horizontal bar
  },
  predator: (g, x, y, s, col) => {         // two curved fangs
    for (const sx of [-1, 1]) {
      g.fillStyle(col, 1).fillTriangle(x + sx * s * 0.22, y - s, x + sx * s * 0.55, y + s * 0.6, x, y + s * 0.2);
    }
  },
  phantom: (g, x, y, s, col) => {          // eye shape
    g.fillStyle(col, 0.85).fillEllipse(x, y, s * 1.5, s * 0.85);
    g.fillStyle(0x10141c, 1).fillCircle(x, y, s * 0.32);
    g.fillStyle(0xffffff, 0.8).fillCircle(x - s * 0.12, y - s * 0.12, s * 0.12);
  },
  conduit: (g, x, y, s, col) => {          // pentagon gem
    const pts = Array.from({ length: 5 }, (_, i) => { const a = (i / 5) * Math.PI * 2 - Math.PI / 2; return new Phaser.Geom.Point(x + Math.cos(a) * s * 0.7, y + Math.sin(a) * s * 0.7); });
    g.fillStyle(col, 1).fillPoints(pts, true);
    g.fillStyle(0xffffff, 0.35).fillTriangle(pts[0].x, pts[0].y, pts[1].x, pts[1].y, x, y);
  },
  prestige: (g, x, y, s, col) => {         // crown
    g.fillStyle(col, 1);
    g.fillRect(x - s * 0.65, y + s * 0.2, s * 1.3, s * 0.55);
    g.fillTriangle(x - s * 0.65, y + s * 0.2, x - s * 0.65, y - s, x - s * 0.28, y + s * 0.2);
    g.fillTriangle(x - s * 0.18, y + s * 0.2, x, y - s * 0.8, x + s * 0.18, y + s * 0.2);
    g.fillTriangle(x + s * 0.28, y + s * 0.2, x + s * 0.65, y - s, x + s * 0.65, y + s * 0.2);
    g.fillStyle(0xffffff, 0.5).fillCircle(x, y - s * 0.55, s * 0.17);
  },
};

export function drawNodeIcon(g: Phaser.GameObjects.Graphics, node: PassiveNodeDef, x: number, y: number, r: number, alpha: number): void {
  if (node.type === "jewel-socket") {  // already has distinctive shape, skip extra glyph
    g.fillStyle(0x80d8ff, alpha * 0.8).fillCircle(x, y, r * 0.5);
    return;
  }
  const fn = REGION_GLYPH[node.region];
  if (!fn) return;
  const size = r * 0.58;
  g.setAlpha(alpha);
  fn(g, x, y, size, 0xffffff);
  g.setAlpha(1);
}
