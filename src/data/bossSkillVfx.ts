// Pure mapping: a boss active-skill TYPE -> its cast-VFX signature, theme colour
// and on-screen label. One source of truth shared by the unit test and the
// scene-side renderer (bossSkillSignatures.ts). No Phaser import — stays testable.
import type { DamageType } from "./schemaEnums.ts";

export type BossSignature = "quake" | "rally" | "barrier" | "summon-surge" | "ring";

export interface BossSignatureSpec {
  /** Which bespoke set-piece to draw ("ring" = the cheap legacy fallback). */
  signature: BossSignature;
  /** Theme colour (also tints the legacy ring). */
  color: number;
  /** Short flavour label floated on cast (empty for the fallback). */
  label: string;
}

const SPECS: Record<string, BossSignatureSpec> = {
  quake: { signature: "quake", color: 0xff5a4a, label: "EARTHSHATTER" },
  rally: { signature: "rally", color: 0x9ccc65, label: "WAR ROAR" },
  barrier: { signature: "barrier", color: 0x8ad8ff, label: "AEGIS DOME" },
  "summon-surge": { signature: "summon-surge", color: 0xb085f5, label: "RIFT SUMMON" },
};

const FALLBACK: BossSignatureSpec = { signature: "ring", color: 0xff5a4a, label: "" };

/** Resolve a boss skill type to its VFX signature spec (never throws). */
export function bossSkillSignature(skillType: string): BossSignatureSpec {
  return SPECS[skillType] ?? FALLBACK;
}

/** Resolved cast palette + camera weight for ONE boss cast. */
export interface BossSkillTheme {
  /** Which set-piece to draw (same as the base signature). */
  signature: BossSignature;
  /** Base signature colour — the recognisable anchor hue. */
  primary: number;
  /** Element-derived secondary colour for glow/embers/accent layers. */
  accent: number;
  /** Flavour label floated on cast. */
  label: string;
  /** 0..1 camera-punch intensity (heaviest skills shake hardest). */
  weight: number;
}

/** Element -> accent colour (mirrors the DMG_COLOR family in fx.ts). */
const ELEMENT_ACCENT: Record<DamageType, number> = {
  Physical: 0xdfe7f2, // steel white
  Magic: 0xc77dde, // violet
  True: 0xfff3a0, // gold
};

/** Per-signature camera weight: quake hits hardest, barrier softest. */
const SIGNATURE_WEIGHT: Record<BossSignature, number> = {
  quake: 1.0,
  "summon-surge": 0.7,
  rally: 0.6,
  barrier: 0.4,
  ring: 0.5,
};

/** Resolve a boss cast to its full themed palette + camera weight (never throws). */
export function bossSkillTheme(skillType: string, element: DamageType): BossSkillTheme {
  const base = bossSkillSignature(skillType);
  return {
    signature: base.signature,
    primary: base.color,
    accent: ELEMENT_ACCENT[element] ?? ELEMENT_ACCENT.Physical,
    label: base.label,
    weight: SIGNATURE_WEIGHT[base.signature],
  };
}
