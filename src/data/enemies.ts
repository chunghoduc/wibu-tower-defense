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
import { HOMAGE_BOSSES } from "./enemiesBosses.ts";

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
  // --- Chapter 2+ elites ("The Escalation Five") — debut from stages 11+ via buildWaves.
  //     Authored at the Chapter-1 power tier; the progression curve scales them per chapter.
  {
    // Berserker: a tower-smasher that turns lethal once wounded — burst it, don't chip it.
    id: "reaver",
    name: "Bloodmad Reaver",
    archetype: "Berserker",
    flying: false,
    immunity: null,
    damageType: "Physical",
    bounty: 22,
    castleDamage: 3,
    baseStats: makeStats({ maxHp: 170, armor: 10, moveSpeed: 60, atk: 30, attackSpeed: 1 }),
    special: { attacksTowers: { range: 95 }, frenzy: { belowHpPct: 0.5, speedMult: 1.8, atkMult: 1.6 } },
    artRef: "placeholder",
  },
  {
    // Adapter: alternates Physical/Magic immunity — needs both damage types, True, or penetration.
    id: "prism",
    name: "Prism Behemoth",
    archetype: "Adapter",
    flying: false,
    immunity: null,
    damageType: "Physical",
    bounty: 40,
    castleDamage: 5,
    baseStats: makeStats({ maxHp: 360, armor: 35, magicResist: 35, damageReduction: 0.4, moveSpeed: 16, atk: 22, attackSpeed: 0.6 }),
    special: { adaptiveImmunity: { types: ["Physical", "Magic"], switchIntervalSec: 3.5 } },
    artRef: "placeholder",
  },
  {
    // Burster: detonates on death, splashing your towers — kill at range or space your line.
    id: "carrier",
    name: "Bloomrot Carrier",
    archetype: "Burster",
    flying: false,
    immunity: null,
    damageType: "Magic",
    bounty: 14,
    castleDamage: 2,
    baseStats: makeStats({ maxHp: 130, moveSpeed: 40, atk: 6, attackSpeed: 0.8 }),
    // damage 180 ≈ 40-45% of a real in-battle tower's HP floor (~400): threatens a
    // clustered tower without one-shotting a healthy one; stacked deaths punish packing.
    special: { deathNova: { radius: 110, damage: 180, type: "Magic" } },
    artRef: "placeholder",
  },
  {
    // Dreadnought: an armored flyer that bombards towers — demands heavy anti-air.
    id: "dreadwing",
    name: "Iron Dreadwing",
    archetype: "Dreadnought",
    flying: true,
    immunity: null,
    damageType: "Physical",
    bounty: 22,
    castleDamage: 3,
    baseStats: makeStats({ maxHp: 220, armor: 30, moveSpeed: 40, atk: 18, attackSpeed: 0.7 }),
    special: { attacksTowers: { range: 130 } },
    artRef: "placeholder",
  },
  {
    // Disruptor: a keening cantor that periodically silences nearby towers — priority-kill it.
    id: "cantor",
    name: "Gravewail Cantor",
    archetype: "Disruptor",
    flying: false,
    immunity: null,
    damageType: "Magic",
    bounty: 24,
    castleDamage: 2,
    baseStats: makeStats({ maxHp: 130, magicResist: 30, moveSpeed: 30, atk: 6, attackSpeed: 0.8 }),
    special: { towerDisablePulse: { radius: 120, duration: 1.6, interval: 7 } },
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
    weapon: { family: "sword", display: "a broad pass-guard blade" },
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
    weapon: { family: "spear", display: "a warden's heavy longspear" },
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
    weapon: { family: "staff", display: "a bone-wrought grave staff" },
    boss: {
      summon: { enemyId: "imp", count: 3, interval: 7 },
      towerDisable: { radius: 130, duration: 3, interval: 12 },
      skill: { id: "overlord-surge", name: "Grave Surge", description: "Tears open the ground to spew a horde of imps.", manaCost: 120, type: "summon-surge", power: 4, summonId: "imp" },
    },
    artRef: "placeholder",
  },

  // Anime-homage bosses (zabro … meruon) live in ./enemiesBosses.ts to keep this
  // file under the 500-line cap. They append after the original/expansion roster.
  ...HOMAGE_BOSSES,
];

/**
 * Damage a boss inflicts on the castle when it leaks through — a flat 10, i.e.
 * 10× a normal enemy's 1-point hit. With the castle holding only 15 HP, letting
 * a single boss reach the gate is very nearly a loss, which is the whole point:
 * the wave-5 and wave-10 bosses are the moments that decide a stage.
 */
export const BOSS_CASTLE_DAMAGE = 10;

/** Castle damage for one leaked enemy: bosses hit for {@link BOSS_CASTLE_DAMAGE}, everyone else for their own value. */
export function castleLeakDamage(def: EnemyDef): number {
  return def.archetype === "Boss" ? BOSS_CASTLE_DAMAGE : def.castleDamage;
}
