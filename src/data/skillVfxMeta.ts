// src/data/skillVfxMeta.ts
//
// Per-skill cast VFX metadata — the single source of truth for what each hero
// active skill LOOKS like when it fires. Every active skill gets its own unique,
// deliberately over-the-top "signature" so a player can tell at a glance which
// skill just went off, even mid-swarm.
//
// This drives two things from one description:
//   1) the in-battle signature renderer (src/scenes/skillSignatures.ts), and
//   2) the prompt used to paint each skill's ability icon / cast emblem.
//
// `signature` selects which bespoke set-piece to draw; `palette` tints it;
// `appearance` is the human-readable art brief (also surfaced in the codex).
// The colours are deliberately distinct per skill so two skills never read the
// same — that's the whole point of "easily see the differences".

import type { SkillStyle, SkillShape } from "./attackStyle.ts";

/** The literal projectile a skill fires FROM the caster (what the player sees leave the hero). */
export type MotifKind = "arrow" | "bolt" | "bullet" | "orb" | "blade" | "none";

/** How the projectiles are arranged in flight. */
export type MotifSpread = "single" | "fan" | "stream" | "pierce";

/**
 * The literal "thing fired from the caster" for a skill, so the VFX matches the
 * description — e.g. tri-shot ("fire three bolts in a wide spread") is
 * `{ kind: "arrow", count: 3, spread: "fan" }`. `kind: "none"` means nothing is
 * fired (melee sweep / ground sigil / expanding nova erupts at the target).
 */
export interface SkillMotif {
  kind: MotifKind;
  count: number;
  spread: MotifSpread;
}

/** Shared "fires no projectile" sentinel (melee / area / curse / sky skills). */
export const NO_MOTIF: SkillMotif = { kind: "none", count: 0, spread: "single" };

/** A single skill's cast-effect identity. */
export interface SkillVfxSpec {
  /** Which bespoke set-piece the renderer draws (1:1 with a skill). */
  signature: SkillSignature;
  /** How the cast arrives — caster→target, sky-fall, ground-erupt, etc. */
  delivery: DeliveryKind;
  /** What literally flies from the caster (the "fired-from-hero" beat). */
  motif: SkillMotif;
  /** Tints layered over the set-piece. `core` is the dominant hue. */
  palette: { core: number; hot: number; deep: number };
  /** Plain-language description of the look — art brief + in-game codex blurb. */
  appearance: string;
}

/** The bespoke set-pieces, one per active skill (never shared). */
export type SkillSignature =
  | "valiant-sweep"
  | "spirit-comet"
  | "steel-cross"
  | "earthshatter"
  | "guillotine"
  | "triple-volley"
  | "piercing-lance"
  | "mana-detonation"
  | "arcane-supernova"
  | "muzzle-barrage"
  | "concussion-blast"
  | "hex-sigil"
  | "pure-technique"
  | "void-rift";

/** How a cast travels from its origin to the impact point (the "fly-from-source" beat). */
export type DeliveryKind = "bolt" | "beam" | "skyfall" | "ground" | "cast";

/** Runtime-checkable list of every delivery kind (keep in sync with DeliveryKind). */
export const DELIVERY_KINDS: readonly DeliveryKind[] = [
  "bolt",
  "beam",
  "skyfall",
  "ground",
  "cast",
];

/**
 * Map of active-skill id → its cast-effect identity. MUST stay 1:1 with
 * ACTIVE_SKILLS in skills.ts (a test enforces full coverage + uniqueness).
 */
export const SKILL_VFX: Record<string, SkillVfxSpec> = {
  "valiant-strike": {
    signature: "valiant-sweep",
    delivery: "cast",
    motif: { kind: "none", count: 0, spread: "single" }, // melee sweep around the hero
    palette: { core: 0xffe07a, hot: 0xffffff, deep: 0xc8962a },
    appearance:
      "A radiant golden crescent sweeps a full half-circle around the hero, " +
      "trailing a banner-like ribbon of light, while a bright cross-gleam flashes " +
      "at the centre and gold motes drift upward. Heroic, clean, warm.",
  },
  "spirit-bolt": {
    signature: "spirit-comet",
    delivery: "bolt",
    motif: { kind: "orb", count: 1, spread: "single" }, // hurl one spirit-orb
    palette: { core: 0x6fe9ff, hot: 0xffffff, deep: 0x2a8fc0 },
    appearance:
      "A cyan spirit-orb implodes to a pinpoint then erupts into a ghost-flame " +
      "burst, throwing out curling wisp trails that fade like will-o'-the-wisps. " +
      "Ethereal teal-white.",
  },
  "iron-cleave": {
    signature: "steel-cross",
    delivery: "cast",
    motif: { kind: "none", count: 0, spread: "single" }, // wide melee arc
    palette: { core: 0xcfe2f0, hot: 0xffffff, deep: 0x6f87a0 },
    appearance:
      "Two broad steel blade-arcs slash across each other in a hard X, throwing a " +
      "horizontal ground-crack shock and a spray of bright sparks. Cold metallic blue-white.",
  },
  "stone-bash": {
    signature: "earthshatter",
    delivery: "ground",
    motif: { kind: "none", count: 0, spread: "single" }, // overhead slam at the target
    palette: { core: 0xd2a86a, hot: 0xffe6b0, deep: 0x7a5230 },
    appearance:
      "An overhead slam drives a heavy dust shock outward; jagged stone shards erupt " +
      "from the ground in a ring and a brown debris cloud billows up. Earthy, weighty, screen-shaking.",
  },
  "execute-slash": {
    signature: "guillotine",
    delivery: "skyfall",
    motif: { kind: "none", count: 0, spread: "single" }, // guillotine drop from above
    palette: { core: 0xff3a3a, hot: 0xffffff, deep: 0x8c0a0a },
    appearance:
      "A single massive vertical guillotine slash drops straight down with a crimson " +
      "flash and a lingering blood-red X afterimage. Brutal, decisive, dark-red.",
  },
  "tri-shot": {
    signature: "triple-volley",
    delivery: "bolt",
    motif: { kind: "arrow", count: 3, spread: "fan" }, // three arrows in a wide spread
    palette: { core: 0x5fe08a, hot: 0xd8ffcf, deep: 0x2f8a4a },
    appearance:
      "Three glowing emerald arrows fan outward in a wide spread, each leaving a " +
      "fletched light-trail and bursting into a small green spark on the far edge. Quick and verdant.",
  },
  "piercing-arrow": {
    signature: "piercing-lance",
    delivery: "beam",
    motif: { kind: "arrow", count: 1, spread: "pierce" }, // one arrow through a line
    palette: { core: 0xbfe6ff, hot: 0xffffff, deep: 0x4f9fd8 },
    appearance:
      "One long, thin azure lance-beam shoots out in a straight line, punching through " +
      "everything with a white sonic ring at the muzzle and a sharp tapering streak. Precise, fast, icy-blue.",
  },
  "mana-burst": {
    signature: "mana-detonation",
    delivery: "bolt",
    motif: { kind: "orb", count: 1, spread: "single" }, // a single magical orb
    palette: { core: 0x5a8cff, hot: 0xcfe0ff, deep: 0x2a4fc0 },
    appearance:
      "Concentric sapphire mana-rings pulse outward while glowing rune-motes orbit and " +
      "a soft core implodes then pops in a blue flash. Calm, magical, deep blue.",
  },
  "arcane-nova": {
    signature: "arcane-supernova",
    delivery: "skyfall",
    motif: { kind: "none", count: 0, spread: "single" }, // expanding ring at the target
    palette: { core: 0xc77dde, hot: 0xf0d4ff, deep: 0x7a2fd0 },
    appearance:
      "A huge violet supernova: a double expanding ring blasts out, two counter-rotating " +
      "arcane sigils spin, and a starfield of magenta sparks scatters. The biggest, brightest cast — screen shakes.",
  },
  "rapid-fire": {
    signature: "muzzle-barrage",
    delivery: "bolt",
    motif: { kind: "bullet", count: 5, spread: "stream" }, // five rapid shots
    palette: { core: 0xffae3a, hot: 0xffe08a, deep: 0xc85a10 },
    appearance:
      "Five staccato orange muzzle-flashes stamp out in a line, each spitting a bullet " +
      "tracer streak and a curl of grey smoke. Rapid, punchy, hot orange-yellow.",
  },
  "concussion-round": {
    signature: "concussion-blast",
    delivery: "skyfall",
    motif: { kind: "bullet", count: 1, spread: "single" }, // one heavy round
    palette: { core: 0xffc46a, hot: 0xfff0c0, deep: 0x8a6a30 },
    appearance:
      "One heavy shell lands with a thick amber shockwave ring, a billow of grey smoke, " +
      "and a ring of spinning stun-stars overhead. Concussive and dusty — screen shakes.",
  },
  "shadow-curse": {
    signature: "hex-sigil",
    delivery: "ground",
    motif: { kind: "none", count: 0, spread: "single" }, // a curse sigil on the target
    palette: { core: 0x9a4fd0, hot: 0xd8a8ff, deep: 0x3a1060 },
    appearance:
      "A dark pentacle hex-sigil blooms on the ground, purple glyphs orbit it, and creeping " +
      "shadow tendrils claw outward before sinking away. Ominous, dim, violet-on-black.",
  },
  "true-strike": {
    signature: "pure-technique",
    delivery: "beam",
    motif: { kind: "none", count: 0, spread: "single" }, // a flawless technique slash
    palette: { core: 0xffffff, hot: 0xffffff, deep: 0xffe9a8 },
    appearance:
      "A blinding pure-white slash with no colour to it — a stark flash, golden filament " +
      "lines converging to a single point, and one crisp expanding ring. Absolute, flawless, white-gold.",
  },
  "void-palm": {
    signature: "void-rift",
    delivery: "beam",
    motif: { kind: "none", count: 0, spread: "single" }, // a palm strike + reality tear
    palette: { core: 0x2a0a40, hot: 0xd8a8ff, deep: 0x000000 },
    appearance:
      "A black void-rift tears open with a glowing violet rim; cracks in space radiate outward, " +
      "then the rift collapses to a point and snaps shut in a white reality-tear flash. The most dramatic cast.",
  },
};

/** Lookup helper — returns the spec for a skill id, or undefined for non-hero casts. */
export function skillVfxSpec(skillId: string | undefined): SkillVfxSpec | undefined {
  return skillId ? SKILL_VFX[skillId] : undefined;
}

/** Fallback delivery for tower/elemental casts that have no bespoke signature. */
export function deliveryForStyle(style: SkillStyle): DeliveryKind {
  if (style === "lightning") return "skyfall";
  if (style === "slash") return "cast";
  return "bolt";
}

/** Source-delivery for a tower-skill SHAPE (the "fly-from-source" beat). */
export function deliveryForShape(shape: SkillShape): DeliveryKind {
  switch (shape) {
    case "nova":
      return "skyfall";
    case "beam":
      return "beam";
    case "cloud":
      return "ground";
    case "slam":
      return "ground";
    case "aura":
      return "cast";
    case "chain":
      return "bolt";
    case "barrage":
      return "bolt";
    case "bolt":
      return "bolt";
  }
}
