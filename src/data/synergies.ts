/**
 * F8 — Squad Synergy / Set bonuses. The chosen battle squad's composition grants
 * team-wide stat auras applied at battle start. Makes squad selection a real
 * decision (kills the fake-choice anti-pattern) and rewards collection breadth.
 *
 * Each synergy has a `test` over the squad's character defs and an `effect`
 * (multiplicative team buffs). Active synergies stack.
 */
import type { CharacterDef, TowerRole, Rarity } from "./schema.ts";

export interface SynergyEffect {
  atkMul?: number;
  hpMul?: number;
  attackSpeedMul?: number;
}

export interface SynergyDef {
  id: string;
  name: string;
  description: string;
  test: (squad: CharacterDef[]) => boolean;
  effect: SynergyEffect;
}

function countRole(squad: CharacterDef[], role: TowerRole): number {
  return squad.filter((c) => c.role === role).length;
}
function countRarityAtLeast(squad: CharacterDef[], min: Rarity): number {
  const order: Rarity[] = ["Common", "Magic", "Rare", "Legendary", "Unique"];
  const minIdx = order.indexOf(min);
  return squad.filter((c) => order.indexOf(c.rarity) >= minIdx).length;
}

export const SYNERGIES: SynergyDef[] = [
  {
    id: "vanguard",
    name: "Vanguard",
    description: "3+ Damage towers: +12% team ATK.",
    test: (s) => countRole(s, "damage") >= 3,
    effect: { atkMul: 1.12 },
  },
  {
    id: "bulwark",
    name: "Bulwark",
    description: "2+ Support towers: +15% team HP.",
    test: (s) => countRole(s, "support") >= 2,
    effect: { hpMul: 1.15 },
  },
  {
    id: "tempest",
    name: "Tempest",
    description: "2+ Chain towers: +10% team attack speed.",
    test: (s) => countRole(s, "chain") >= 2,
    effect: { attackSpeedMul: 1.1 },
  },
  {
    id: "affliction",
    name: "Affliction",
    description: "2+ DoT or Debuff towers: +10% team ATK.",
    test: (s) => countRole(s, "dot") + countRole(s, "debuff") >= 2,
    effect: { atkMul: 1.1 },
  },
  {
    id: "elite-corps",
    name: "Elite Corps",
    description: "4+ Legendary or Unique towers: +10% ATK & HP.",
    test: (s) => countRarityAtLeast(s, "Legendary") >= 4,
    effect: { atkMul: 1.1, hpMul: 1.1 },
  },
  {
    id: "full-roster",
    name: "Full Roster",
    description: "All 6 roles present: +8% ATK, +8% HP, +5% attack speed.",
    test: (s) => {
      const roles: TowerRole[] = ["damage", "splash", "chain", "dot", "debuff", "support"];
      return roles.every((r) => countRole(s, r) >= 1);
    },
    effect: { atkMul: 1.08, hpMul: 1.08, attackSpeedMul: 1.05 },
  },
];

/** Synergies active for a squad, in catalog order. */
export function activeSynergies(squad: CharacterDef[]): SynergyDef[] {
  return SYNERGIES.filter((s) => s.test(squad));
}

/** Aggregate multiplier from all active synergies (1.0 baseline). */
export function squadSynergyMul(squad: CharacterDef[]): Required<SynergyEffect> {
  const mul = { atkMul: 1, hpMul: 1, attackSpeedMul: 1 };
  for (const s of activeSynergies(squad)) {
    if (s.effect.atkMul) mul.atkMul *= s.effect.atkMul;
    if (s.effect.hpMul) mul.hpMul *= s.effect.hpMul;
    if (s.effect.attackSpeedMul) mul.attackSpeedMul *= s.effect.attackSpeedMul;
  }
  return mul;
}
