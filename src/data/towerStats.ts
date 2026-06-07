import type { Rarity, Stats, TowerRole } from "./schema.ts";

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
