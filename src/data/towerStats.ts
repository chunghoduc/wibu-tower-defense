import type { DamageType, Rarity, Stats, TowerRole } from "./schema.ts";

/**
 * Towers are full combat units, not glass turrets: they carry the same stat set
 * as the hero EXCEPT move speed and gold find (towers are static and don't loot).
 * Designers set each tower's offensive profile (atk/crit/pen/skillPower); this
 * fills in the DEFENSIVE + survival layer every tower otherwise left at zero,
 * scaled by rarity (stronger tiers) and role (front-line/control units tankier).
 */
const RARITY_TIER: Record<Rarity, number> = { Common: 0, Magic: 1, Rare: 2, Legendary: 3, Unique: 4 };

const ROLE_TANK: Record<TowerRole, number> = {
  damage: 1, splash: 1, chain: 0.85, dot: 0.85, debuff: 1.3, support: 1.2,
};

const r3 = (n: number) => Math.round(n * 1000) / 1000;
const r2 = (n: number) => Math.round(n * 100) / 100;
const round5 = (n: number) => Math.round(n / 5) * 5;

/**
 * Core power budget per role × rarity. Each tower's CORE combat stats (atk,
 * attack rate, range, hp, mana economy, placement cost) are derived from this
 * table so the whole roster scales coherently — monotonic with rarity, and the
 * role defines the shape (damage = high atk; support = tanky, low atk; etc.).
 * Per-tower data keeps its IDENTITY (role, type, passives, active, behavior) and
 * FLAVOUR stats (crit, penetration, lifesteal); the baseline owns the budget so
 * no single character is accidentally stronger than a higher tier.
 *
 * Skill/behaviour magnitudes (splash radius, chain targets, dot dps, slow %, buff
 * aura) are authored per-tower and already scale cleanly, so they're untouched.
 */
const RARITY_POWER = [1.0, 1.35, 1.8, 2.45, 3.3]; // by tier (Common…Unique)

// NOTE: `range` is deliberately NOT budgeted here — it's an identity stat (a
// melee brawler has short reach, an archer long), kept per-tower so the roster
// still reads as melee vs ranged and the attack-style picker stays correct.
interface RoleBase { atk: number; aspd: number; hp: number; cost: number }
const ROLE_BASE: Record<TowerRole, RoleBase> = {
  // role      atk  aspd   hp   cost   (values at the Common tier)
  damage:  { atk: 16, aspd: 1.20, hp: 130, cost: 45 },
  splash:  { atk: 15, aspd: 0.90, hp: 145, cost: 55 },
  chain:   { atk: 13, aspd: 1.05, hp: 115, cost: 55 },
  dot:     { atk: 10, aspd: 1.00, hp: 125, cost: 50 },
  debuff:  { atk:  9, aspd: 0.85, hp: 150, cost: 55 },
  support: { atk:  6, aspd: 0.75, hp: 175, cost: 60 },
};

/** The role × rarity core-stat budget + placement cost (before the damage-type archetype). */
export function towerBaseline(role: TowerRole, rarity: Rarity): { core: Partial<Stats>; cost: number } {
  const tier = RARITY_TIER[rarity];
  const p = RARITY_POWER[tier];
  const b = ROLE_BASE[role];
  const isSupport = role === "support";
  const core: Partial<Stats> = {
    atk: Math.round(b.atk * p),
    attackSpeed: r2(b.aspd * (1 + 0.04 * tier)),
    maxHp: Math.round(b.hp * (0.5 + 0.5 * p)),
    maxMana: isSupport ? 0 : 55 + 12 * tier,       // supports are aura-only, never cast
    manaOnHit: isSupport ? 0 : 7,
    manaRegen: isSupport ? 0 : r2(1.4 + 0.3 * tier),
  };
  return { core, cost: round5(b.cost * p) };
}

/** Return a copy of `s` with defensive/survival baselines filled where unset (0). */
export function augmentTowerStats(role: TowerRole, rarity: Rarity, s: Stats): Stats {
  const tier = RARITY_TIER[rarity];
  const tank = ROLE_TANK[role] ?? 1;
  return {
    ...s,
    armor: s.armor || Math.round((6 + tier * 4) * tank),
    magicResist: s.magicResist || Math.round((5 + tier * 3) * tank),
    hpRegen: s.hpRegen || Math.round(s.maxHp * 0.008 + tier),
    damageReduction: s.damageReduction || r3(0.02 * tier),
    critDefense: s.critDefense || r3(0.03 * tier),
    tenacity: s.tenacity || r3(0.05 + 0.03 * tier),
    manaOnKill: s.manaOnKill || (s.maxMana > 0 ? Math.max(2, Math.round(s.manaOnHit * 1.5)) : 0),
  };
}

/**
 * Damage-type identity. A tower's basic-attack type defines how it deals damage:
 *
 *  - PHYSICAL towers are auto-attack bruisers — higher atk and attack rate, and
 *    NO skill power (skillPower = 1), so their actives stay modest. Their damage
 *    comes from sustained hits.
 *  - MAGIC towers are casters — weaker, slower basic attacks but high skill power
 *    (scaling with rarity), which makes their active skill the powerful payoff
 *    (active burst = atk × 2 × skillPower).
 *
 * Applied on top of `augmentTowerStats` so every tower conforms to its type.
 */
export function applyDamageArchetype(damageType: DamageType, rarity: Rarity, s: Stats): Stats {
  const tier = RARITY_TIER[rarity];
  if (damageType === "Physical") {
    return { ...s, atk: Math.round(s.atk * 1.15), attackSpeed: r3(s.attackSpeed * 1.15), skillPower: 1 };
  }
  if (damageType === "Magic") {
    return {
      ...s,
      atk: Math.round(s.atk * 0.8),
      attackSpeed: r3(s.attackSpeed * 0.8),
      skillPower: Math.max(s.skillPower, r3(1.6 + 0.1 * tier)),
    };
  }
  return s; // True or other — left as authored
}
