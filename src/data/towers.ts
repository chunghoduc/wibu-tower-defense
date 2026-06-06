/**
 * Placeholder character/tower catalog (Phase 1). Four archetypes that exercise
 * single-target, splash, magic, and anti-air long-range play. The 30–40
 * homage-character roster is Phase 2 content work.
 *
 * Each tower carries its own mana bar; on-hit mana fills it and the active
 * auto-casts (a generic AoE burst in Phase 1).
 */
import { makeStats, type CharacterDef } from "./schema.ts";

export const TOWERS: CharacterDef[] = [
  {
    id: "archer",
    name: "Verdant Archer",
    rarity: "Common",
    role: "damage",
    damageType: "Physical",
    target: "Both",
    cost: 50,
    passives: ["keen-eye"],
    active: "volley",
    baseStats: makeStats({
      atk: 16,
      attackSpeed: 1.3,
      range: 140,
      critRate: 0.1,
      maxHp: 120,
      maxMana: 60,
      manaOnHit: 8,
      manaRegen: 1,
    }),
    artRef: "placeholder",
  },
  {
    id: "cannon",
    name: "Bulwark Bombard",
    rarity: "Magic",
    role: "splash",
    damageType: "Physical",
    target: "Ground",
    cost: 80,
    passives: ["siege-payload"],
    active: "mortar-barrage",
    baseStats: makeStats({
      atk: 24,
      attackSpeed: 0.6,
      range: 115,
      armorPen: 0.3,
      maxHp: 160,
      maxMana: 90,
      manaOnHit: 12,
      manaRegen: 1,
    }),
    artRef: "placeholder",
  },
  {
    id: "mage",
    name: "Emberwell Adept",
    rarity: "Rare",
    role: "damage",
    damageType: "Magic",
    target: "Both",
    cost: 95,
    passives: ["arcane-focus", "mana-font"],
    active: "ember-nova",
    baseStats: makeStats({
      atk: 22,
      attackSpeed: 0.9,
      range: 150,
      magicPen: 0.25,
      skillPower: 1.4,
      maxHp: 110,
      maxMana: 80,
      manaOnHit: 14,
      manaRegen: 2,
    }),
    artRef: "placeholder",
  },
  {
    id: "sniper",
    name: "Skywatch Marksman",
    rarity: "Rare",
    role: "damage",
    damageType: "Physical",
    target: "Both",
    cost: 110,
    passives: ["high-ground", "armor-breaker", "steady-aim"],
    active: "piercing-shot",
    baseStats: makeStats({
      atk: 46,
      attackSpeed: 0.45,
      range: 230,
      critRate: 0.25,
      critDamage: 1.8,
      armorPen: 0.5,
      maxHp: 90,
      maxMana: 70,
      manaOnHit: 16,
      manaRegen: 1,
    }),
    artRef: "placeholder",
  },
];
