// src/data/skillVfxPower.ts
//
// Rarity → VFX "power profile". A skill's on-screen spectacle scales with the
// CASTER's rarity: a Common tower's active gives a tidy pop, while a Legendary /
// Unique ult is a multi-wave, screen-shaking set-piece with far denser particles
// and a grand flourish. This is the single knob the cast VFX pipeline reads to
// decide HOW BIG a cast looks. Pure / Phaser-free, fully unit-tested.
import { type Rarity } from "./schemaEnums.ts";

export interface VfxPower {
  /** 0 (Common) … 4 (Unique) — index into the rarity ladder. */
  tier: number;
  /** Multiplier on every particle / sub-element COUNT (sparks, motes, shards…). */
  count: number;
  /** How many staggered impact WAVES the signature replays — the "more frames"
   *  knob. Common = 1 clean beat; the apex = a rolling 3-wave cascade. */
  waves: number;
  /** Geometry SCALE (ring radius, arc reach, core size) — bigger at high rarity. */
  scale: number;
  /** Duration stretch so weightier casts linger longer. */
  duration: number;
  /** Camera-shake intensity multiplier. */
  shake: number;
  /** Whether to crown the cast with the grand flourish (sigil halo + flash +
   *  rising light column). Reserved for Legendary and above. */
  grand: boolean;
}

const TABLE: Record<Rarity, VfxPower> = {
  Common: { tier: 0, count: 1.0, waves: 1, scale: 1.0, duration: 1.0, shake: 0.7, grand: false },
  Magic: { tier: 1, count: 1.45, waves: 2, scale: 1.12, duration: 1.1, shake: 0.95, grand: false },
  Rare: { tier: 2, count: 2.0, waves: 2, scale: 1.26, duration: 1.22, shake: 1.15, grand: false },
  Legendary: {
    tier: 3,
    count: 2.7,
    waves: 3,
    scale: 1.44,
    duration: 1.38,
    shake: 1.45,
    grand: true,
  },
  Unique: { tier: 4, count: 3.5, waves: 3, scale: 1.62, duration: 1.55, shake: 1.75, grand: true },
};

/** The power profile for a caster's rarity (undefined → the restrained Common look). */
export function vfxPower(rarity?: Rarity): VfxPower {
  return TABLE[rarity ?? "Common"];
}

/** Scale a base particle count by power, rounding so even Common keeps ≥ base. */
export function scaleCount(base: number, p: VfxPower): number {
  return Math.max(base, Math.round(base * p.count));
}

/** The hero is not rarity-graded, so its cast power rises with LEVEL instead —
 *  a freshly-rolled hero casts modestly; a maxed hero unleashes an apex spectacle. */
export function heroPowerRarity(level: number): Rarity {
  const lvl = Math.max(1, Math.floor(level || 1));
  if (lvl >= 100) return "Unique";
  if (lvl >= 60) return "Legendary";
  if (lvl >= 30) return "Rare";
  if (lvl >= 12) return "Magic";
  return "Common";
}
