/**
 * Enemy catalog — the 12 design archetypes plus their spawned minions and the
 * boss/mid-boss units. Tuned for the Normal difficulty baseline; Hard/Nightmare
 * scale these via DIFFICULTY_SCALING.
 *
 * Every archetype demands a distinct answer but stays beatable multiple ways
 * (the "no lock-and-key" rule): immunities are limited to ONE thing and never
 * shut out the hero or True damage.
 */
import { makeStats, type EnemyDef } from "./schema.ts";

export const ENEMIES: EnemyDef[] = [
  // --- Rushers (fast ground swarm) ---
  {
    id: "grunt",
    name: "Husk Footman",
    archetype: "Rusher",
    flying: false,
    immunity: null,
    damageType: "Physical",
    bounty: 6,
    castleDamage: 1,
    baseStats: makeStats({ maxHp: 64, moveSpeed: 44, atk: 8, attackSpeed: 1 }),
    artRef: "placeholder",
  },
  {
    id: "runner",
    name: "Scrabbler",
    archetype: "Rusher",
    flying: false,
    immunity: null,
    damageType: "Physical",
    bounty: 5,
    castleDamage: 1,
    baseStats: makeStats({ maxHp: 36, moveSpeed: 92, atk: 5, attackSpeed: 1.4 }),
    artRef: "placeholder",
  },
  // --- Brute (armored tank) ---
  {
    id: "brute",
    name: "Ironhide Ogre",
    archetype: "Brute",
    flying: false,
    immunity: null,
    damageType: "Physical",
    bounty: 14,
    castleDamage: 3,
    baseStats: makeStats({ maxHp: 210, armor: 70, moveSpeed: 26, atk: 16, attackSpeed: 0.7 }),
    artRef: "placeholder",
  },
  // --- Bulwark (shielded; shrugs off AoE, so use single-target/chain) ---
  {
    id: "bulwark",
    name: "Tower Shieldman",
    archetype: "Bulwark",
    flying: false,
    immunity: "AoE",
    damageType: "Physical",
    bounty: 13,
    castleDamage: 2,
    baseStats: makeStats({ maxHp: 120, armor: 20, moveSpeed: 34, atk: 10, attackSpeed: 0.8 }),
    special: { shieldHp: 130 },
    artRef: "placeholder",
  },
  // --- Mender (heals allies; magic-resistant; burst it first) ---
  {
    id: "mender",
    name: "Pale Acolyte",
    archetype: "Mender",
    flying: false,
    immunity: null,
    damageType: "Magic",
    bounty: 16,
    castleDamage: 1,
    baseStats: makeStats({ maxHp: 90, magicResist: 60, moveSpeed: 38, atk: 4, attackSpeed: 0.8 }),
    special: { healAura: { radius: 95, hps: 16 } },
    artRef: "placeholder",
  },
  // --- Regenerator (regrows HP; needs sustained DoT) ---
  {
    id: "regenerator",
    name: "Mosshide Troll",
    archetype: "Regenerator",
    flying: false,
    immunity: null,
    damageType: "Physical",
    bounty: 12,
    castleDamage: 2,
    baseStats: makeStats({ maxHp: 150, moveSpeed: 34, atk: 9, attackSpeed: 0.8, hpRegen: 22 }),
    artRef: "placeholder",
  },
  // --- Splitter (spawns minions on death; use splash or kill early) ---
  {
    id: "slime",
    name: "Cleaving Ooze",
    archetype: "Splitter",
    flying: false,
    immunity: null,
    damageType: "Physical",
    bounty: 10,
    castleDamage: 2,
    baseStats: makeStats({ maxHp: 120, moveSpeed: 36, atk: 8, attackSpeed: 0.8 }),
    special: { splitInto: { enemyId: "slimelet", count: 2 } },
    artRef: "placeholder",
  },
  {
    id: "slimelet",
    name: "Oozeling",
    archetype: "Splitter",
    flying: false,
    immunity: null,
    damageType: "Physical",
    bounty: 2,
    castleDamage: 1,
    baseStats: makeStats({ maxHp: 30, moveSpeed: 52, atk: 4, attackSpeed: 1 }),
    artRef: "placeholder",
  },
  // --- Flyers (ignore the lane, beeline the castle) ---
  {
    id: "gargoyle",
    name: "Cliff Gargoyle",
    archetype: "Gargoyle",
    flying: true,
    immunity: null,
    damageType: "Physical",
    bounty: 8,
    castleDamage: 2,
    baseStats: makeStats({ maxHp: 58, moveSpeed: 56, atk: 7, attackSpeed: 1 }),
    artRef: "placeholder",
  },
  {
    id: "stormflyer",
    name: "Stormwing Drake",
    archetype: "StormFlyer",
    flying: true,
    immunity: null,
    damageType: "Magic",
    bounty: 18,
    castleDamage: 2,
    baseStats: makeStats({ maxHp: 140, moveSpeed: 44, atk: 13, attackSpeed: 0.8 }),
    special: { attacksTowers: { range: 120 } },
    artRef: "placeholder",
  },
  // --- Sapper (stops to shoot down towers) ---
  {
    id: "sapper",
    name: "Demolisher",
    archetype: "Sapper",
    flying: false,
    immunity: null,
    damageType: "Physical",
    bounty: 14,
    castleDamage: 2,
    baseStats: makeStats({ maxHp: 95, moveSpeed: 40, atk: 24, attackSpeed: 0.8 }),
    special: { attacksTowers: { range: 130 } },
    artRef: "placeholder",
  },
  // --- Phantom (stealth; only the hero / untargeted AoE can hit it) ---
  {
    id: "phantom",
    name: "Veil Stalker",
    archetype: "Phantom",
    flying: false,
    immunity: null,
    damageType: "Physical",
    bounty: 15,
    castleDamage: 2,
    baseStats: makeStats({ maxHp: 78, moveSpeed: 60, atk: 9, attackSpeed: 1.1 }),
    special: { stealth: true },
    artRef: "placeholder",
  },
  // --- Summoner (raises adds; kill on priority) ---
  {
    id: "summoner",
    name: "Bone Conductor",
    archetype: "Summoner",
    flying: false,
    immunity: null,
    damageType: "Magic",
    bounty: 20,
    castleDamage: 2,
    baseStats: makeStats({ maxHp: 165, moveSpeed: 30, atk: 6, attackSpeed: 0.7 }),
    special: { summon: { enemyId: "imp", count: 2, interval: 6 } },
    artRef: "placeholder",
  },
  {
    id: "imp",
    name: "Risen Imp",
    archetype: "Summoner",
    flying: false,
    immunity: null,
    damageType: "Physical",
    bounty: 1,
    castleDamage: 1,
    baseStats: makeStats({ maxHp: 26, moveSpeed: 66, atk: 4, attackSpeed: 1.2 }),
    artRef: "placeholder",
  },
  // --- Raider (fast tower-smasher) ---
  {
    id: "raider",
    name: "Wrecking Berserker",
    archetype: "Raider",
    flying: false,
    immunity: null,
    damageType: "Physical",
    bounty: 15,
    castleDamage: 2,
    baseStats: makeStats({ maxHp: 100, moveSpeed: 78, atk: 28, attackSpeed: 1 }),
    special: { attacksTowers: { range: 95 } },
    artRef: "placeholder",
  },
  // --- Courier (gold pinata; kill before it reaches the castle) ---
  {
    id: "courier",
    name: "Coin Runner",
    archetype: "Courier",
    flying: false,
    immunity: null,
    damageType: "Physical",
    bounty: 45,
    castleDamage: 1,
    baseStats: makeStats({ maxHp: 85, moveSpeed: 72, atk: 0, attackSpeed: 0 }),
    artRef: "placeholder",
  },
  // --- Juggernauts (slow, immovable damage sponges; halve ALL damage and are
  //     immune to one type — answer with the OTHER type, True, or penetration) ---
  {
    // Physical-immune: arrows/swords do nothing. Bring magic or True damage.
    id: "golem",
    name: "Ironclad Golem",
    archetype: "Juggernaut",
    flying: false,
    immunity: "Physical",
    damageType: "Physical",
    bounty: 34,
    castleDamage: 5,
    baseStats: makeStats({ maxHp: 420, armor: 50, magicResist: 30, damageReduction: 0.5, moveSpeed: 15, atk: 20, attackSpeed: 0.55 }),
    artRef: "placeholder",
  },
  {
    // Magic-immune: spells fizzle. Bring physical or True damage.
    id: "monolith",
    name: "Runed Monolith",
    archetype: "Juggernaut",
    flying: false,
    immunity: "Magic",
    damageType: "Physical",
    bounty: 34,
    castleDamage: 5,
    baseStats: makeStats({ maxHp: 420, armor: 30, magicResist: 50, damageReduction: 0.5, moveSpeed: 15, atk: 20, attackSpeed: 0.55 }),
    artRef: "placeholder",
  },
  // --- Support enemies (fragile but force-multipliers; kill them FIRST) ---
  {
    // Herald: a rallying banner — speeds up and toughens every nearby ally.
    id: "herald",
    name: "Warbanner Herald",
    archetype: "Herald",
    flying: false,
    immunity: null,
    damageType: "Physical",
    bounty: 26,
    castleDamage: 1,
    baseStats: makeStats({ maxHp: 135, armor: 20, magicResist: 20, moveSpeed: 34, atk: 6, attackSpeed: 0.8 }),
    special: { supportAura: { radius: 115, moveSpeedMult: 1.3, damageReductionAdd: 0.15 } },
    artRef: "placeholder",
  },
  {
    // Hexer: heals and armors nearby allies AND hexes nearby towers to attack slower.
    id: "hexer",
    name: "Grave Hexbinder",
    archetype: "Hexer",
    flying: false,
    immunity: null,
    damageType: "Magic",
    bounty: 28,
    castleDamage: 1,
    baseStats: makeStats({ maxHp: 120, magicResist: 50, moveSpeed: 30, atk: 8, attackSpeed: 0.9 }),
    special: { supportAura: { radius: 125, healPerSec: 14, armorAdd: 25, magicResistAdd: 25, towerAttackSpeedMult: 0.75 } },
    artRef: "placeholder",
  },
  // --- Mid-boss: a teaching enrager ---
  {
    id: "champion",
    name: "Pass Champion",
    archetype: "Boss",
    flying: false,
    immunity: null,
    damageType: "Physical",
    bounty: 60,
    castleDamage: 6,
    baseStats: makeStats({
      maxHp: 700,
      armor: 50,
      moveSpeed: 24,
      atk: 30,
      attackSpeed: 0.9,
      tenacity: 0.4,
    }),
    boss: {
      enrage: { belowHpPct: 0.4, atkMult: 1.6, speedMult: 1.5 },
      skill: { id: "champion-quake", name: "Seismic Slam", description: "Slams the ground — stuns nearby towers and hurts the hero.", manaCost: 110, type: "quake", radius: 150, power: 0.14 },
    },
    artRef: "placeholder",
  },
  // --- Final boss: enrage + the works ---
  {
    id: "warden",
    name: "Warden of the Pass",
    archetype: "Boss",
    flying: false,
    immunity: null,
    damageType: "Physical",
    bounty: 130,
    castleDamage: 12,
    baseStats: makeStats({
      maxHp: 1700,
      armor: 45,
      moveSpeed: 22,
      atk: 44,
      attackSpeed: 0.8,
      hpRegen: 6,
      tenacity: 0.55,
    }),
    boss: {
      enrage: { belowHpPct: 0.4, atkMult: 1.7, speedMult: 1.6 },
      skill: { id: "warden-barrier", name: "Bulwark Ward", description: "Shields the Warden and nearby foes.", manaCost: 100, type: "barrier", radius: 170, power: 0.3 },
    },
    artRef: "placeholder",
  },
  // --- Final boss variant: summoner + tower-disabler ---
  {
    id: "overlord",
    name: "Grave Overlord",
    archetype: "Boss",
    flying: false,
    immunity: null,
    damageType: "Magic",
    bounty: 160,
    castleDamage: 14,
    baseStats: makeStats({
      maxHp: 2200,
      armor: 30,
      magicResist: 30,
      moveSpeed: 20,
      atk: 40,
      attackSpeed: 0.8,
      tenacity: 0.6,
    }),
    boss: {
      summon: { enemyId: "imp", count: 3, interval: 7 },
      towerDisable: { radius: 130, duration: 3, interval: 12 },
      skill: { id: "overlord-surge", name: "Grave Surge", description: "Tears open the ground to spew a horde of imps.", manaCost: 120, type: "summon-surge", power: 4, summonId: "imp" },
    },
    artRef: "placeholder",
  },

  // ===================== Anime-homage bosses (original) =====================
  // Each evokes an iconic anime antagonist WITHOUT copying name/likeness.
  {
    id: "zabro", name: "Zabro the Mist Demon", // homage: Zabuza Momochi (Naruto)
    archetype: "Boss", flying: false, immunity: null, damageType: "Physical",
    bounty: 80, castleDamage: 7,
    baseStats: makeStats({ maxHp: 1000, armor: 28, moveSpeed: 32, atk: 36, attackSpeed: 1.1, tenacity: 0.45 }),
    boss: {
      enrage: { belowHpPct: 0.5, atkMult: 1.5, speedMult: 1.7 },
      skill: { id: "zabro-rally", name: "Hidden Mist", description: "Veils allies in healing mist.", manaCost: 90, type: "rally", radius: 180, power: 0.16 },
    },
    artRef: "placeholder",
  },
  {
    id: "ryomen", name: "Ryomen the Cursed King", // homage: Ryomen Sukuna (Jujutsu Kaisen)
    archetype: "Boss", flying: false, immunity: null, damageType: "Physical",
    bounty: 95, castleDamage: 9,
    baseStats: makeStats({ maxHp: 1200, armor: 36, moveSpeed: 26, atk: 50, attackSpeed: 1.0, tenacity: 0.55 }),
    boss: {
      enrage: { belowHpPct: 0.45, atkMult: 1.8, speedMult: 1.5 },
      skill: { id: "ryomen-cleave", name: "Cursed Cleave", description: "An unseen slash stuns towers and rends the hero.", manaCost: 100, type: "quake", radius: 160, power: 0.18 },
    },
    artRef: "placeholder",
  },
  {
    id: "kura", name: "Kura the Tailed Calamity", // homage: Kurama / the Nine-Tails (Naruto)
    archetype: "Boss", flying: false, immunity: null, damageType: "Magic",
    bounty: 105, castleDamage: 10,
    baseStats: makeStats({ maxHp: 1450, magicResist: 40, moveSpeed: 24, atk: 44, attackSpeed: 0.9, tenacity: 0.5 }),
    boss: {
      summon: { enemyId: "imp", count: 2, interval: 6 },
      enrage: { belowHpPct: 0.4, atkMult: 1.6, speedMult: 1.4 },
      skill: { id: "kura-cloak", name: "Tailed Cloak", description: "A roaring chakra cloak shields the Calamity and its brood.", manaCost: 105, type: "barrier", radius: 180, power: 0.32 },
    },
    artRef: "placeholder",
  },
  {
    id: "akai", name: "Akai the Magma Admiral", // homage: Akainu / magma-logia admiral (One Piece)
    archetype: "Boss", flying: false, immunity: null, damageType: "Magic",
    bounty: 140, castleDamage: 12,
    baseStats: makeStats({ maxHp: 2000, armor: 40, magicResist: 22, moveSpeed: 22, atk: 52, attackSpeed: 0.85, tenacity: 0.6 }),
    boss: {
      towerDisable: { radius: 110, duration: 2.5, interval: 10 },
      enrage: { belowHpPct: 0.4, atkMult: 1.6, speedMult: 1.4 },
      skill: { id: "akai-eruption", name: "Magma Eruption", description: "Erupting magma melts towers and scorches the hero.", manaCost: 115, type: "quake", radius: 165, power: 0.2 },
    },
    artRef: "placeholder",
  },
  {
    id: "mukade", name: "Mukade the Undying", // homage: regenerating immortals (e.g. Mahito / Kabuto)
    archetype: "Boss", flying: false, immunity: null, damageType: "True",
    bounty: 155, castleDamage: 13,
    baseStats: makeStats({ maxHp: 2200, armor: 30, moveSpeed: 20, atk: 48, attackSpeed: 0.9, hpRegen: 32, tenacity: 0.6 }),
    boss: {
      enrage: { belowHpPct: 0.35, atkMult: 1.7, speedMult: 1.5 },
      skill: { id: "mukade-mend", name: "Undying Mend", description: "Reknits its flesh and that of its kin.", manaCost: 90, type: "rally", radius: 190, power: 0.2 },
    },
    artRef: "placeholder",
  },
  {
    id: "madarok", name: "Madarok the Eternal Eye", // homage: Madara Uchiha (Naruto)
    archetype: "Boss", flying: false, immunity: null, damageType: "Magic",
    bounty: 180, castleDamage: 15,
    baseStats: makeStats({ maxHp: 2700, armor: 40, magicResist: 40, moveSpeed: 20, atk: 54, attackSpeed: 0.85, tenacity: 0.65 }),
    boss: {
      summon: { enemyId: "imp", count: 3, interval: 6 },
      towerDisable: { radius: 140, duration: 3, interval: 11 },
      enrage: { belowHpPct: 0.4, atkMult: 1.7, speedMult: 1.5 },
      skill: { id: "madarok-susano", name: "Spectral Ribs", description: "A spectral guardian shields the Eternal Eye and its host.", manaCost: 110, type: "barrier", radius: 200, power: 0.35 },
    },
    artRef: "placeholder",
  },
  {
    id: "meruon", name: "Meruon the Ant Sovereign", // homage: Meruem the Chimera Ant King (Hunter x Hunter)
    archetype: "Boss", flying: false, immunity: null, damageType: "Physical",
    bounty: 260, castleDamage: 18,
    baseStats: makeStats({ maxHp: 3800, armor: 55, magicResist: 35, moveSpeed: 22, atk: 66, attackSpeed: 1.0, hpRegen: 14, tenacity: 0.75 }),
    boss: {
      summon: { enemyId: "imp", count: 2, interval: 8 },
      enrage: { belowHpPct: 0.35, atkMult: 2.0, speedMult: 1.7 },
      skill: { id: "meruon-rage", name: "Sovereign's Wrath", description: "An overwhelming shockwave devastates the hero and silences towers.", manaCost: 120, type: "quake", radius: 190, power: 0.24 },
    },
    artRef: "placeholder",
  },
];
