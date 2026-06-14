/**
 * battleCta — pure, Phaser-free layered geometry for the home-screen BATTLE
 * hero call-to-action. Given the button rect, computes the body face (inset by
 * a forged-gold bevel), the top gloss band, four corner rivets, the left-anchored
 * combat emblem, the centered label anchor, and the diagonal sheen sweep travel.
 * Deterministic; the presenter (drawBattleCta in homeBarFx.ts) only paints this.
 * Unit-tested in tests/battleCta.test.ts. See
 * docs/superpowers/specs/2026-06-14-battle-cta-redesign-design.md.
 */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Pt {
  x: number;
  y: number;
}
export interface BattleCtaPlan {
  /** Thickness of the gold bevel lip framing the crimson body. */
  bevel: number;
  /** The crimson face, inset from the rect by `bevel`. */
  body: Rect;
  /** Soft white gloss band along the top of the body. */
  gloss: Rect;
  /** Four gold stud centers, inset into the body corners. */
  rivets: Pt[];
  /** Combat emblem box, anchored to the left of the body. */
  emblem: { x: number; y: number; size: number };
  /** Center anchor for the BATTLE label (text column right of the emblem). */
  label: Pt;
  /** Diagonal sheen sweep: a band of width `w` travelling x0→x1 at row `y`. */
  sheen: { x0: number; x1: number; y: number; w: number };
}

const BEVEL = 3;
const RIVET_INSET = 9;
const EMBLEM_PAD = 8;

/** Compute the full layered geometry of the BATTLE CTA from its outer rect. */
export function battleCtaPlan(r: Rect): BattleCtaPlan {
  const bevel = BEVEL;
  const body: Rect = {
    x: r.x + bevel,
    y: r.y + bevel,
    w: r.w - bevel * 2,
    h: r.h - bevel * 2,
  };
  const gloss: Rect = {
    x: body.x + 4,
    y: body.y,
    w: body.w - 8,
    h: Math.round(body.h * 0.42),
  };
  const rivets: Pt[] = [
    { x: body.x + RIVET_INSET, y: body.y + RIVET_INSET },
    { x: body.x + body.w - RIVET_INSET, y: body.y + RIVET_INSET },
    { x: body.x + RIVET_INSET, y: body.y + body.h - RIVET_INSET },
    { x: body.x + body.w - RIVET_INSET, y: body.y + body.h - RIVET_INSET },
  ];
  const size = Math.round(r.h * 0.78);
  const emblem = { x: body.x + EMBLEM_PAD + size / 2, y: r.y + r.h / 2, size };
  // Label is centered in the space to the RIGHT of the emblem column.
  const textLeft = emblem.x + size / 2;
  const label = { x: (textLeft + (body.x + body.w)) / 2, y: r.y + r.h / 2 };
  const sheen = { x0: body.x - body.h, x1: body.x + body.w + body.h, y: r.y + r.h / 2, w: body.h };
  return { bevel, body, gloss, rivets, emblem, label, sheen };
}
