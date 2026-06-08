/**
 * Canonical data schemas — the backbone every system reads.
 *
 * Content (characters/towers, items, enemies, stages) is plain data that
 * conforms to these types. Validators reject malformed entries at load time so
 * a bad catalog fails loud in development instead of corrupting a battle.
 *
 * This is Phase 1: the schemas are complete enough to describe the full game
 * (so they don't churn later), but the catalogs that fill them in are minimal
 * placeholders.
 */

// ---------------------------------------------------------------------------
// Categorical attributes
// ---------------------------------------------------------------------------

export const DAMAGE_TYPES = ["Physical", "Magic", "True"] as const;
export type DamageType = (typeof DAMAGE_TYPES)[number];

export const TARGET_TYPES = ["Ground", "Air", "Both"] as const;
export type TargetType = (typeof TARGET_TYPES)[number];

export const TOWER_ROLES = [
  "damage",
  "splash",
  "chain",
  "dot",
  "support",
  "debuff",
] as const;
export type TowerRole = (typeof TOWER_ROLES)[number];

/**
 * Damage type a tower's BASIC ATTACK may deal. Towers auto-attack only in
 * Physical or Magic; True damage is reserved for passive/active SKILLS (see
 * TowerBehavior.activeType and the DoT damageType override).
 */
export const ATTACK_DAMAGE_TYPES = ["Physical", "Magic"] as const;
export type AttackDamageType = (typeof ATTACK_DAMAGE_TYPES)[number];

export const RARITIES = ["Common", "Magic", "Rare", "Legendary", "Unique"] as const;
export type Rarity = (typeof RARITIES)[number];

/** An enemy may be immune to at most ONE of these (the "no lock-and-key" rule). */
export const IMMUNITIES = ["Physical", "Magic", "CC", "AoE"] as const;
export type Immunity = (typeof IMMUNITIES)[number];

export const ENEMY_ARCHETYPES = [
  "Rusher",
  "Brute",
  "Bulwark",
  "Mender",
  "Regenerator",
  "Splitter",
  "Gargoyle",
  "StormFlyer",
  "Sapper",
  "Phantom",
  "Summoner",
  "Raider",
  "Courier",
  "Juggernaut",
  "Herald",
  "Hexer",
  "Boss",
] as const;
export type EnemyArchetype = (typeof ENEMY_ARCHETYPES)[number];

export const ITEM_SLOTS = [
  "Weapon",
  "Helmet",
  "BodyArmor",
  "Gloves",
  "Boots",
  "Amulet",
  "Ring1",
  "Ring2",
  "Pet",
  "Wing",
] as const;
export type ItemSlot = (typeof ITEM_SLOTS)[number];

/**
 * Item CATEGORY slots. Identical to the equip slots except the two ring slots
 * collapse to a single "Ring": a ring item isn't a "Ring1" or "Ring2" item, it's
 * just a ring that fits EITHER ring slot.
 */
export type ItemDefSlot = Exclude<ItemSlot, "Ring1" | "Ring2"> | "Ring";

/** The equip slot(s) an item of category `slot` can occupy (a Ring fits both). */
export function equipSlotsFor(slot: ItemDefSlot): ItemSlot[] {
  return slot === "Ring" ? ["Ring1", "Ring2"] : [slot];
}

export const WEAPON_TYPES = ["Sword", "Bow", "Staff", "Gun", "Tome", "Fist", "Any"] as const;
export type WeaponType = (typeof WEAPON_TYPES)[number];

export const PASSIVE_NODE_TYPES = ["path", "notable", "keystone", "mastery", "jewel-socket"] as const;
export type PassiveNodeType = (typeof PASSIVE_NODE_TYPES)[number];

export const PASSIVE_REGIONS = [
  "brawler", "arcane", "warden", "tactician",
  "predator", "phantom", "conduit", "prestige",
] as const;
export type PassiveRegion = (typeof PASSIVE_REGIONS)[number];

// ---------------------------------------------------------------------------
// The canonical 24-stat system
// ---------------------------------------------------------------------------

/**
 * Every combat entity (hero, tower, enemy) is described by a subset of these.
 * Percentage-style stats (critRate, armorPen, damageReduction, omnivamp,
 * tenacity, goldFind) are expressed as fractions in [0, 1].
 */
export interface Stats {
  // Offense
  atk: number;
  attackSpeed: number; // attacks per second
  critRate: number; // 0..1
  critDamage: number; // crit multiplier, e.g. 1.5 = +50%
  range: number; // attack reach in world units
  armorPen: number; // 0..1 fraction of target armor ignored
  magicPen: number; // 0..1 fraction of target magic resist ignored
  skillPower: number; // amplifies active/ability damage (1.0 = baseline)

  // Defense / survival
  maxHp: number;
  hpRegen: number; // hp per second
  armor: number; // reduces Physical damage
  magicResist: number; // reduces Magic damage
  damageReduction: number; // 0..1 flat reduction applied to ALL damage incl. True
  critDefense: number; // 0..1 fraction of an incoming crit's BONUS damage negated
  tenacity: number; // 0..1 reduction of crowd-control duration

  // Resource (hero + towers)
  maxMana: number;
  manaRegen: number; // mana per second
  manaOnHit: number;
  manaOnKill: number;
  manaCostReduction: number; // 0..1

  // Sustain
  omnivamp: number; // 0..1 heal as fraction of damage dealt

  // Utility
  moveSpeed: number; // world units per second (static towers = 0)
  goldFind: number; // 0..1 bonus gold multiplier
}

/** A baseline Stats with everything zeroed — entities override what they use. */
export function defaultStats(): Stats {
  return {
    atk: 0,
    attackSpeed: 0,
    critRate: 0,
    critDamage: 1.5,
    range: 0,
    armorPen: 0,
    magicPen: 0,
    skillPower: 1,
    maxHp: 0,
    hpRegen: 0,
    armor: 0,
    magicResist: 0,
    damageReduction: 0,
    critDefense: 0,
    tenacity: 0,
    maxMana: 0,
    manaRegen: 0,
    manaOnHit: 0,
    manaOnKill: 0,
    manaCostReduction: 0,
    omnivamp: 0,
    moveSpeed: 0,
    goldFind: 0,
  };
}

/**
 * Stats that are already fractions / multipliers (crit chance, penetration, %
 * reductions, skill power…). On items these add FLAT and are NOT scaled by item
 * level (a level-40 item shouldn't turn a 12% crit base into 50%); scalar stats
 * like atk/hp do scale. Shared so item rolling and affix resolution agree.
 */
export const FRACTIONAL_STAT_KEYS = new Set<keyof Stats>([
  "critRate", "critDamage", "critDefense", "armorPen", "magicPen",
  "damageReduction", "tenacity", "omnivamp", "goldFind", "skillPower", "manaCostReduction",
]);

/** Build a Stats from partial overrides on top of the zeroed baseline. */
export function makeStats(overrides: Partial<Stats>): Stats {
  return { ...defaultStats(), ...overrides };
}

// ---------------------------------------------------------------------------
// Content definitions
// ---------------------------------------------------------------------------

/**
 * Role-driven combat behaviour parameters. Each is optional; a tower only fills
 * in what its role uses. This keeps the BattleState data-driven instead of
 * hard-coding per-character logic.
 */
export interface TowerBehavior {
  /** splash role: AoE radius around the primary target. */
  splashRadius?: number;
  /** chain role: how many extra enemies the attack bounces to. */
  chainTargets?: number;
  /** chain role: fraction of damage retained per bounce (0..1). */
  chainFalloff?: number;
  /** dot role: a damage-over-time applied on hit (skills may deal True). */
  dot?: { dps: number; duration: number; damageType?: DamageType };
  /** debuff role: slow applied on hit. */
  slow?: { pct: number; duration: number };
  /** debuff role: stun applied on hit. */
  stun?: { duration: number; chance: number };
  /** support role: aura buffing nearby towers. */
  buffAura?: { radius: number; atkPct?: number; attackSpeedPct?: number };
  /** active-skill damage type override — lets a skill deal True (the only path to True). */
  activeType?: DamageType;
}

/**
 * Character codex metadata — the iconic anime archetype the character channels
 * plus a player-facing visual profile (outfit + signature weapon). The `homage`
 * is the designer/codex note; `outfit` and `weapon` are flavor shown in the
 * collection. The character's main skill and passive skills live in `active` /
 * `passives` on CharacterDef.
 */
export interface CharacterMeta {
  /** The legendary anime archetype this original character is inspired by. */
  homage: string;
  /** Short description of the character's signature outfit / visual design. */
  outfit: string;
  /** The character's main weapon or fighting implement. */
  weapon: string;
}

/** A collectible character — deployed in battle as a static tower. */
export interface CharacterDef {
  id: string;
  name: string;
  rarity: Rarity;
  role: TowerRole;
  /** Basic-attack damage type — Physical or Magic only (True comes from skills). */
  damageType: AttackDamageType;
  target: TargetType;
  /** Cost in in-battle gold to place this tower. */
  cost: number;
  /** Short original lore blurb shown in the collection / tooltip. */
  description: string;
  /** 1–3 predefined passive skill ids. */
  passives: string[];
  /** Single active skill id, auto-casts when the tower's mana bar is full. */
  active: string | null;
  baseStats: Stats;
  /** Role-specific tuning (splash radius, dot, slow, aura, gold/sec, ...). */
  behavior?: TowerBehavior;
  /** Codex metadata: homage source + outfit + signature weapon. */
  meta?: CharacterMeta;
  /** Sprite/asset reference (placeholder until Phase 4 art). */
  artRef: string;
}

/**
 * Pet utilities (the Pet slot). Pets replace the old economy towers: their
 * primary job is utility such as passive gold generation. Applied by the
 * equipment system in Phase 3.
 */
export interface PetUtility {
  /** Passive gold generated per second while equipped. */
  goldPerSec?: number;
  /** Bonus gold-find fraction added to the hero. */
  goldFind?: number;
}

/** One owned tower entry in the hero's collection. */
export interface TowerCollectionEntry {
  /** Star rank 1–5. 1 = first copy; ascend with copies + crystals up to 5. */
  stars: number;
  /** Duplicate copies banked toward the next star ascension. */
  copies: number;
}

/** A node in the hero's PoE-style passive skill grid. */
export interface PassiveNodeDef {
  id: string;
  type: PassiveNodeType;
  region: PassiveRegion;
  name: string;
  description: string;
  gridX: number;
  gridY: number;
  /** Adjacent node ids (graph edges; bidirectional). */
  neighbors: string[];
  /** Flat stat bonuses added to the accumulator. */
  flat?: Partial<Stats>;
  /** Additive % bonuses (0.1 = +10%). */
  increased?: Partial<Stats>;
  /** Multiplicative bonus, same fractional convention as increased (0.5 = +50% → final ×1.5). Reserved for keystones. */
  more?: Partial<Stats>;
  /** Keystone/mastery special effect identifier. */
  effectId?: string;
  /** Hero level required before this node's region unlocks. */
  unlockAtLevel?: number;
}

/** A collectible active skill the hero equips in their single skill slot. */
export interface ActiveSkillDef {
  id: string;
  name: string;
  description: string;
  rarity: Rarity;
  requiresWeapon?: WeaponType;
  damageType: DamageType;
  /** Explicitly tuned per skill — NOT derived from rarity. */
  basePower: number;
  artRef: string;
}

export interface RolledAffix {
  type: string;
  value: number;
}

/**
 * A live copy of an item in the hero's inventory (in save data).
 * The catalog entry (ItemDef) is immutable; ItemInstance holds the rolled values.
 */
export interface ItemInstance {
  id: string;               // uuid generated at drop
  defId: string;            // points to ItemDef.id
  acquiredLevel: number;    // hero level at time of acquisition
  /**
   * Rolled required level for THIS copy (>= the def's floor, <= 90). The same
   * named item can drop at different required levels; its base stats scale with
   * this value, so a higher-level copy is strictly stronger. Optional for
   * backward compat — fall back to def.requiredLevel when absent.
   */
  requiredLevel?: number;
  /** Set when requiredLevel hit the cap (90): the item carries the Apex effect. */
  apex?: boolean;
  rolledStats: Partial<Stats>;
  rolledPrimaryAffix: number;
  rolledAffixes: RolledAffix[];
  /** Enhancement level (+0..+15); scales primary stats & affix (T13). */
  enhanceLevel: number;
}

/**
 * Named item definition. Every copy of the same named item has the same
 * slot/weaponType/primaryAffix type, but values roll ±10% at acquisition.
 */
export interface ItemDef {
  id: string;
  name: string;
  slot: ItemDefSlot;
  /** Required for Weapon slot; determines which active skills can be equipped. */
  weaponType?: WeaponType;
  rarity: Rarity;
  /** Hero must be >= this level to equip. Also scales base stats. */
  requiredLevel: number;
  /** Primary stats vary per named item — not locked to slot type. */
  baseStats: Partial<Stats>;
  /** Predefined per item name; value rolls ±10% at acquisition. */
  primaryAffix: { type: string; baseValue: number };
  /** Random affixes drawn from this pool; rarity gates count. */
  affixPool: string[];
  /** Pet slot only — utility properties. */
  petUtility?: PetUtility;
  /** Wing slot only — rarity-gated passive id. */
  wingPassive?: string;
  /** Overlay ref applied to hero visual when equipped (Phase 4). */
  appearanceRef?: string;
  artRef: string;
}

/** Special enemy behaviours layered on top of the base march-to-castle loop. */
export interface EnemySpecial {
  /** Bulwark: a shield that absorbs damage before HP. */
  shieldHp?: number;
  /** Mender: heals nearby allies. */
  healAura?: { radius: number; hps: number };
  /** Splitter: spawns smaller enemies when it dies. */
  splitInto?: { enemyId: string; count: number };
  /** Summoner: periodically spawns adds at its position. */
  summon?: { enemyId: string; count: number; interval: number };
  /** Phantom: untargetable by towers (only the hero can hit it). */
  stealth?: boolean;
  /** Sapper/Raider: stops to attack towers within this range. */
  attacksTowers?: { range: number };
  /**
   * Support enemies (Herald/Hexer): a radial aura that bolsters nearby allies
   * and/or hampers nearby towers. Buffs are transient — recomputed each tick, so
   * they fade the instant the support dies or an ally leaves the radius.
   */
  supportAura?: {
    radius: number;
    /** Ally move-speed multiplier (e.g. 1.3 = +30%). */
    moveSpeedMult?: number;
    /** Ally healing per second. */
    healPerSec?: number;
    /** Flat damage-reduction added to allies (0..1), combined multiplicatively. */
    damageReductionAdd?: number;
    /** Flat armor added to allies. */
    armorAdd?: number;
    /** Flat magic resist added to allies. */
    magicResistAdd?: number;
    /** Nearby towers' attack-speed multiplier (e.g. 0.75 = −25%, a tower slow). */
    towerAttackSpeedMult?: number;
  };
}

/** Boss-only mechanics. Composable: a boss may use several. */
export interface BossMechanics {
  /** Timed or HP-triggered enrage: multiplies attack & move speed for a while. */
  enrage?: { belowHpPct: number; atkMult: number; speedMult: number };
  /** Periodically summon adds. */
  summon?: { enemyId: string; count: number; interval: number };
  /** Periodically disable towers within a radius for a duration. */
  towerDisable?: { radius: number; duration: number; interval: number };
  /** Active skill cast when the boss's mana bar fills (T16). */
  skill?: BossSkill;
}

/** A boss active skill, auto-cast when its mana fills. */
export interface BossSkill {
  id: string;
  name: string;
  description: string;
  /** Mana needed to cast (mana fills at a fixed rate + on taking damage). */
  manaCost: number;
  type: "quake" | "rally" | "barrier" | "summon-surge";
  /** Effect radius (world units). */
  radius?: number;
  /** Effect magnitude: quake = frac of hero maxHp damage; rally = heal frac;
   *  barrier = shield frac of maxHp; summon-surge = add count. */
  power?: number;
  /** summon-surge: which add to spawn (defaults to "imp"). */
  summonId?: string;
}

/** An enemy archetype definition. */
export interface EnemyDef {
  id: string;
  name: string;
  archetype: EnemyArchetype;
  /** Flying enemies ignore the lane and beeline the castle. */
  flying: boolean;
  /** The single thing this enemy is immune to, if any. */
  immunity: Immunity | null;
  /** Damage type this enemy deals when attacking towers/hero. */
  damageType: DamageType;
  /** Gold awarded to the killer's owner on death. */
  bounty: number;
  /** Damage dealt to the castle if this enemy reaches it. */
  castleDamage: number;
  baseStats: Stats;
  special?: EnemySpecial;
  boss?: BossMechanics;
  artRef: string;
}

// ---------------------------------------------------------------------------
// Difficulty tiers
// ---------------------------------------------------------------------------

export const DIFFICULTIES = ["Normal", "Hard", "Nightmare"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export interface DifficultyScaling {
  hpMult: number;
  atkMult: number;
  bountyMult: number;
}

/**
 * Difficulty is modelled as an enemy's combat power — effective HP × DPS. Hard
 * enemies are ~5× as hard to beat as Normal, Nightmare ~20×. The power factor is
 * split ~70/30 between HP and ATK (hp ∝ f^0.7, atk ∝ f^0.3) so harder tiers make
 * enemies dramatically TANKIER and somewhat deadlier — rather than turning into
 * one-shot glass cannons. Normal itself is tuned above the old 1.0 baseline so
 * the base game asks for real defence. Bounty rises with difficulty to reward
 * the climb. (hpMult × atkMult ratios: Normal ≈ 1.5, Hard ≈ 7.4 ≈ 5×, Nightmare
 * ≈ 30 ≈ 20×.)
 */
export const DIFFICULTY_SCALING: Record<Difficulty, DifficultyScaling> = {
  Normal: { hpMult: 1.3, atkMult: 1.15, bountyMult: 1 },
  Hard: { hpMult: 4, atkMult: 1.85, bountyMult: 2 },
  Nightmare: { hpMult: 10.5, atkMult: 2.85, bountyMult: 4 },
};

/** A point on the map in world coordinates. */
export interface Vec2 {
  x: number;
  y: number;
}

/** A single spawn instruction within a wave. */
export interface SpawnEntry {
  enemyId: string;
  count: number;
  /** Seconds between each spawn in this group. */
  interval: number;
  /** Seconds to wait (after the wave starts) before this group begins. */
  delay: number;
}

export interface WaveDef {
  spawns: SpawnEntry[];
}

/** A terrain feature on the battlefield (decorative, or a blocking obstacle). */
export type TerrainType =
  | "grass" | "sand" | "water" | "stone" | "jungle" | "mountain"
  | "lava" | "ice" | "snow" | "crystal";
export interface TerrainFeature {
  type: TerrainType;
  x: number;
  y: number;
  r: number;       // radius (circular blob)
  blocks: boolean; // true = towers cannot be placed here
}

export interface StageDef {
  id: string;
  name: string;
  /** Lane waypoints; the last point is the castle. */
  path: Vec2[];
  /** Where flying enemies spawn (they beeline the castle from here). */
  airSpawns: Vec2[];
  castleHp: number;
  startingGold: number;
  /** Discrete tower placement slots (legacy; free placement uses terrain instead). */
  towerSlots: Vec2[];
  /** Terrain features for rendering + obstacle-based free placement. */
  terrain?: TerrainFeature[];
  waves: WaveDef[];
}

// ---------------------------------------------------------------------------
// Validators — fail loud on malformed content
// ---------------------------------------------------------------------------

// Runtime validators live in schemaValidators.ts; re-exported here so existing
// `import { validateX } from "./schema.ts"` callsites keep working.
export {
  SchemaError, validateCharacter, validateEnemy, validateStage,
  validateActiveSkill, validatePassiveNode, validateItemDef,
} from "./schemaValidators.ts";
