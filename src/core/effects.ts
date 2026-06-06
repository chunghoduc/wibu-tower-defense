/**
 * Pure helpers for status effects and shields. Kept separate from BattleState so
 * the fiddly arithmetic (tenacity, shield absorption, DoT ticking, stacking
 * slows) is unit-testable in isolation.
 */
import { clamp01 } from "./damage.ts";

/** A damage-over-time instance applied to an enemy. */
export interface Dot {
  dps: number;
  remaining: number;
  /** Damage type carried by the DoT (DoTs ignore the AoE-immunity flag). */
  type: "Physical" | "Magic" | "True";
  armorPen: number;
  magicPen: number;
}

/** Crowd-control duration after the target's tenacity reduces it. */
export function ccDuration(base: number, tenacity: number): number {
  return Math.max(0, base * (1 - clamp01(tenacity)));
}

/**
 * Absorb incoming damage with a shield first. Returns the shield that remains
 * and the overflow that should hit HP.
 */
export function absorbWithShield(shield: number, incoming: number): {
  shield: number;
  overflow: number;
} {
  if (shield <= 0) return { shield: 0, overflow: Math.max(0, incoming) };
  if (incoming <= shield) return { shield: shield - incoming, overflow: 0 };
  return { shield: 0, overflow: incoming - shield };
}

/** Effective move-speed fraction given a slow (0 = unaffected, 1 = frozen). */
export function slowedSpeed(moveSpeed: number, slowPct: number): number {
  return moveSpeed * (1 - clamp01(slowPct));
}

/** Advance a list of DoTs by dt, returning total damage dealt and the survivors. */
export function tickDots(dots: Dot[], dt: number): { total: number; remaining: Dot[] } {
  let total = 0;
  const remaining: Dot[] = [];
  for (const d of dots) {
    const active = Math.min(dt, d.remaining);
    total += d.dps * active;
    const left = d.remaining - dt;
    if (left > 0) remaining.push({ ...d, remaining: left });
  }
  return { total, remaining };
}
