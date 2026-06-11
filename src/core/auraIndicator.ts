// src/core/auraIndicator.ts
//
// Pure, Phaser-free helpers for the tower aura-range indicator. `auraRadiusOf`
// mirrors the gate in BattleState.recomputeTowerBuffs() (support role + a
// positive-radius buffAura) so the on-screen ring can never disagree with the
// simulation about which towers actually project a tower-buff aura. It reads the
// live runtime radius (behavior.buffAura.radius), which already includes in-battle
// upgrade scaling, so the ring stays truthful as a tower is upgraded.
import type { TowerRuntime } from "./battleTypes.ts";

/** Aura-indicator ring color — aquamarine, distinct from the gold attack/upgrade rings. */
export const AURA_RING_COLOR = 0x66ffcc;

/**
 * The true, current tower-buff aura radius for a tower, or null if it projects none.
 * (alive/disabled are the render layer's concern — they affect HOW the ring draws,
 * not whether the tower's def has an aura.)
 */
export function auraRadiusOf(t: TowerRuntime): number | null {
  if (t.def.role !== "support") return null;
  const a = t.behavior?.buffAura;
  if (!a || a.radius <= 0) return null;
  return a.radius;
}

/** Gentle 0..1 glow pulse, de-synced per tower via uid so rings don't blink in unison. */
export function auraPulse(timeMs: number, uid: number): number {
  return 0.5 + 0.5 * Math.sin(timeMs * 0.004 + uid);
}
