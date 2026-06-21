// src/data/triggerFxPlan.ts
//
// The VISUAL plan for a triggered Unique-item proc. Where triggeredEffects.ts says
// WHAT a proc does and battleTriggerFx.ts runs it on the sim, this maps each
// TriggerKind to a small, readable VFX *family* + theme colour so the presenter
// (scenes/triggerFx.ts) can render a branded flourish. Pure / Phaser-free so the
// whole vocabulary is unit-testable and shared.
//
// `chain` and `gold` already paint their own VFX (a bolt / a loot pop), so they
// map to null — no double flourish.
import type { TriggerKind } from "./triggeredEffects.ts";

/** A small, deliberately-limited vocabulary so 20 procs feel designed. */
export type TriggerFxFamily =
  | "recoil" // spike recoil from the hero back at the attacker (thorns / counter)
  | "nova" // concussive shockwave ring at a centre (blast / pain nova / echo)
  | "frost" // ice ring + crystal shards (control: freeze / slow / chill)
  | "dotSeed" // themed motes settling on a target (burn / poison / bleed)
  | "lifeflare" // life motes + a heal cross converging on the hero (sustain)
  | "execute" // decisive X-slash + skull spark (instakill)
  | "spread" // tendrils from a corpse to its neighbours (contagion)
  | "resurrect"; // golden phoenix flare + screen flash — the cheat-death

export interface TriggerFxPlan {
  family: TriggerFxFamily;
  /** Family signature colour (the presenter may override for element-tinted families). */
  color: number;
  /** Optional accent colour. */
  secondary?: number;
  /** Floating banner text for the marquee procs. */
  label?: string;
  /** Extra punch (and, for `resurrect`, a brief full-screen flash). */
  big?: boolean;
}

// Theme palette (kept close to fx.ts DMG_COLOR / impactFx so it reads consistent).
const STEEL = 0xcfd6e2;
const CRIMSON = 0xff5a5a;
const GOLD = 0xffe07a;
const WHITE_STEEL = 0xe9eef7;
const ARCANE = 0xc77dde;
const CYAN = 0x9fe6ff;
const PALE_CYAN = 0x8fd0ff;
const EMBER = 0xff7a2a;
const VENOM = 0x8bc34a;
const BLOOD = 0xc0202a;
const LIFE = 0x7cfc8a;
const EXEC_RED = 0xff3a3a;
const SICK_GREEN = 0x9bd34a;
const PHOENIX = 0xffd34d;

const PLANS: Partial<Record<TriggerKind, TriggerFxPlan>> = {
  // — recoil (retaliation) —
  reflect: { family: "recoil", color: STEEL, secondary: 0x8a93a6 },
  aegisthorns: { family: "recoil", color: CRIMSON, secondary: 0xffd0c0 },
  riposte: { family: "recoil", color: GOLD, secondary: 0xfff3c0 },
  // — nova (concussive ring) —
  painnova: { family: "nova", color: WHITE_STEEL, secondary: CRIMSON },
  blast: { family: "nova", color: ARCANE, secondary: 0xeec6ff },
  echo: { family: "nova", color: ARCANE, secondary: 0xffffff },
  // — frost (control) —
  frostguard: { family: "frost", color: CYAN, secondary: 0xe1f5ff },
  frostnova: { family: "frost", color: CYAN, secondary: 0xe1f5ff },
  glaciate: { family: "frost", color: CYAN, secondary: 0xe1f5ff },
  freeze: { family: "frost", color: CYAN, secondary: 0xe1f5ff },
  slow: { family: "frost", color: PALE_CYAN, secondary: 0xdff2ff },
  castnova: { family: "frost", color: CYAN, secondary: 0xe1f5ff },
  // — dotSeed (lingering damage) —
  pyre: { family: "dotSeed", color: EMBER, secondary: 0xffd24d },
  cinder: { family: "dotSeed", color: EMBER, secondary: 0xffd24d },
  poison: { family: "dotSeed", color: VENOM, secondary: 0xd3ec9e },
  bleed: { family: "dotSeed", color: BLOOD, secondary: 0xff8a8a },
  // — lifeflare (sustain) —
  heal: { family: "lifeflare", color: LIFE, secondary: 0xffffff },
  overkill: { family: "lifeflare", color: LIFE, secondary: GOLD },
  secondwind: { family: "lifeflare", color: GOLD, secondary: 0xffffff, label: "SECOND WIND", big: true },
  // — execute —
  execute: { family: "execute", color: EXEC_RED, secondary: 0xffffff, label: "EXECUTE" },
  // — spread —
  contagion: { family: "spread", color: SICK_GREEN, secondary: 0x6f9a2a },
  // — resurrect (the big one) —
  undying: { family: "resurrect", color: PHOENIX, secondary: 0xffffff, label: "UNDYING!", big: true },
};

/** The VFX plan for a proc, or null if the kind already paints its own VFX. */
export function triggerFxPlan(kind: TriggerKind): TriggerFxPlan | null {
  return PLANS[kind] ?? null;
}
