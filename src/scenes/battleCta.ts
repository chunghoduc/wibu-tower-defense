/**
 * battleCta — pure, Phaser-free layered geometry for the home-screen BATTLE
 * hero call-to-action. Redesigned (2026-06-21) from a busy crimson plate
 * (drop-shadow + gold bevel + two-tone body + gloss + 4 rivets + far-left muddy
 * emblem + constant sheen sweep, with the label stranded right-of-centre over
 * dead crimson space) into a REFINED ROYAL WAR-SEAL: a single capsule with a
 * thin radiant-gold rim over a warm ember→garnet core, a slim top gloss, a
 * breathing rim glow, flanking hairline flourishes, and ONE tight centred
 * content unit — [gold sword mark · BATTLE · ▸▸ chevrons] — so there is no
 * lopsided empty space. The warm-gold/ember palette belongs in the gold-lit
 * stained-glass throne hall instead of fighting it.
 *
 * `battleCtaPlan` returns the static chrome (deterministic from the rect);
 * `battleCtaContent` centres the content unit given the runtime-measured label
 * width (text width is only known after the Text object exists). The presenter
 * (drawBattleCta in homeBarFx.ts) only paints these. Unit-tested in
 * tests/battleCta.test.ts.
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
  /** Corner radius of the capsule (full pill = h/2). */
  radius: number;
  /** Thickness of the radiant-gold rim framing the ember core. */
  rim: number;
  /** The ember→garnet core face, inset from the rect by `rim`. */
  body: Rect;
  /** Slim white gloss band along the top of the body. */
  gloss: Rect;
  /** Soft outer halo rect (drawn additively, alpha pulses) for the breathing glow. */
  glow: Rect;
}

const RIM = 2.5;
const GLOW_SPREAD = 7;

/** Compute the static capsule chrome of the BATTLE CTA from its outer rect. */
export function battleCtaPlan(r: Rect): BattleCtaPlan {
  const radius = r.h / 2;
  const rim = RIM;
  const body: Rect = {
    x: r.x + rim,
    y: r.y + rim,
    w: r.w - rim * 2,
    h: r.h - rim * 2,
  };
  const gloss: Rect = {
    x: body.x + radius * 0.5,
    y: body.y + 1,
    w: body.w - radius,
    h: Math.round(body.h * 0.34),
  };
  const glow: Rect = {
    x: r.x - GLOW_SPREAD,
    y: r.y - GLOW_SPREAD,
    w: r.w + GLOW_SPREAD * 2,
    h: r.h + GLOW_SPREAD * 2,
  };
  return { radius, rim, body, gloss, glow };
}

/** Measured dimensions of the centred content unit's parts. */
export interface ContentDims {
  /** Square side of the sword mark. */
  iconSize: number;
  /** Gap between the sword mark and the label. */
  iconGap: number;
  /** Runtime-measured pixel width of the BATTLE label. */
  textW: number;
  /** Gap between the label and the chevrons. */
  chevGap: number;
  /** Total width of the ▸▸ chevron group. */
  chevW: number;
}

export interface BattleCtaContent {
  /** Vertical centre line of the whole unit. */
  cy: number;
  /** Left edge x of the content unit (icon + gap + label + gap + chevrons). */
  start: number;
  /** Total width of the content unit. */
  width: number;
  /** Centre of the sword mark. */
  iconCenter: Pt;
  /** Origin-0.5 anchor for the BATTLE label. */
  labelCenter: Pt;
  /** Centre of the ▸▸ chevron group. */
  chevCenter: Pt;
  /** Left flank flourish: a hairline from `x0`→`x1` at row `y`. */
  leftFlank: { x0: number; x1: number; y: number };
  /** Right flank flourish, mirror of the left. */
  rightFlank: { x0: number; x1: number; y: number };
}

const FLANK_PAD = 16; // space between the content unit and a flourish
const FLANK_MIN = 10; // shortest a flourish can be before we drop it (caller checks)

/**
 * Centre the [icon · label · chevrons] unit inside the rect and lay two hairline
 * flourishes in the leftover capsule width on each side. Pure & deterministic
 * given the measured `textW`.
 */
export function battleCtaContent(r: Rect, d: ContentDims): BattleCtaContent {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const width = d.iconSize + d.iconGap + d.textW + d.chevGap + d.chevW;
  const start = cx - width / 2;

  const iconCenter: Pt = { x: start + d.iconSize / 2, y: cy };
  const labelCenter: Pt = { x: start + d.iconSize + d.iconGap + d.textW / 2, y: cy };
  const chevCenter: Pt = { x: start + width - d.chevW / 2, y: cy };

  // Flourishes fill the leftover capsule between the content unit and the rim.
  const radius = r.h / 2;
  const innerL = r.x + radius * 0.7;
  const innerR = r.x + r.w - radius * 0.7;
  const leftFlank = { x0: innerL, x1: start - FLANK_PAD, y: cy };
  const rightFlank = { x0: start + width + FLANK_PAD, x1: innerR, y: cy };

  return { cy, start, width, iconCenter, labelCenter, chevCenter, leftFlank, rightFlank };
}

export { FLANK_MIN };
