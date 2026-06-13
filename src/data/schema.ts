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

import type { WeaponSpec } from "./weaponFamily.ts";
import type { ItemArchetype } from "./itemArchetype.ts";
import type {
  DamageType,
  TargetType,
  TowerRole,
  AttackDamageType,
  Rarity,
  Immunity,
  EnemyArchetype,
  ItemDefSlot,
  WeaponType,
  PassiveNodeType,
  PassiveRegion,
} from "./schemaEnums.ts";
import type { Stats } from "./schemaStats.ts";

// Categorical attributes (enums) live in schemaEnums.ts; the 24-stat system in
// schemaStats.ts. Both are re-exported here so existing `import { ... } from
// "./schema.ts"` callsites keep working.
export * from "./schemaEnums.ts";
export * from "./schemaStats.ts";

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
  /**
   * tanker role: the active skill's burst is amplified by the caster's OWN
   * defensive stats, on top of the usual atk-scaling — the fortress fights back.
   * Each field is a multiplier on that stat, summed into the burst. So a
   * `{ armor: 2, maxHp: 0.1 }` tower adds `armor×2 + maxHp×0.1` damage to its cast.
   */
  defenseScale?: { armor?: number; magicResist?: number; maxHp?: number };
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
  /** The character's signature weapon, structured so damage type/style derive from it. */
  weapon: WeaponSpec;
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
  id: string; // uuid generated at drop
  defId: string; // points to ItemDef.id
  acquiredLevel: number; // hero level at time of acquisition
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
  /**
   * Build archetype this item pushes toward (physical / magic / defense /
   * utility / hybrid). Optional: when omitted it is derived from the primary
   * affix via `archetypeFor()`. Authored only for deliberate hybrids.
   */
  archetype?: ItemArchetype;
  /** Pet slot only — utility properties. */
  petUtility?: PetUtility;
  /** Wing slot only — rarity-gated passive id. */
  wingPassive?: string;
  /** Overlay ref applied to hero visual when equipped (Phase 4). */
  appearanceRef?: string;
  artRef: string;
  /**
   * Visual + flavour metadata. Single source of truth that drives BOTH the
   * inventory icon AND the in-battle "worn" overlay, so they cannot drift.
   * `appearance.look` is fed verbatim to the SDXL art pipeline.
   */
  appearance?: ItemAppearance;
  /** Designer-only homage note (the anime item this evokes); never shipped raw. */
  homage?: { source: string; original: string };
  /** What makes the item special, echoing the source item's signature gimmick. */
  specialty?: string;
  /** 1–2 sentence player-facing flavour line. */
  lore?: string;
}

/** Visual identity shared by an item's icon and its worn overlay. */
export interface ItemAppearance {
  /** Silhouette family → worn-art template + icon shape (e.g. "greatblade"). */
  family: string;
  /** Curated palette — body tint + accent. Reused by icon AND worn art (never PNG-sampled). */
  material: { tint: string; accent: string };
  /** Prose describing exactly how it looks; seeds the SDXL prompt. */
  look: string;
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
  /** Berserker: latches into a frenzy (faster + harder hits) once HP drops below the threshold. One-way, like boss enrage. */
  frenzy?: { belowHpPct: number; speedMult: number; atkMult: number };
  /** Adapter: rotates its immune damage type through `types` every `switchIntervalSec`. True damage and the off-type always land. */
  adaptiveImmunity?: { types: DamageType[]; switchIntervalSec: number };
  /** Burster: on death, deals one burst of `damage` (`type`) to towers within `radius`. */
  deathNova?: { radius: number; damage: number; type: DamageType };
  /** Disruptor: every `interval`s, disables towers within `radius` for `duration`s (a normal-enemy tower-disable). */
  towerDisablePulse?: { radius: number; duration: number; interval: number };
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
  /**
   * Optional weapon — bosses use it to set how far they can strike towers
   * (its RANGE only; the enemy's own `damageType` is unaffected).
   */
  weapon?: WeaponSpec;
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
  /** Extra HP multiplier applied to BOSSES only, on top of hpMult. */
  bossHpMult: number;
  /** Extra ATK multiplier applied to BOSSES only, on top of atkMult. */
  bossAtkMult: number;
}

/**
 * Difficulty is modelled as an enemy's combat power — effective HP × DPS. Hard
 * enemies are ~10× as hard to beat as Normal, Nightmare ~25×. The power factor
 * is split ~70/30 between HP and ATK (hp ∝ f^0.7, atk ∝ f^0.3) so harder tiers
 * make enemies dramatically TANKIER and somewhat deadlier — rather than turning
 * into one-shot glass cannons. Normal itself is tuned above the old 1.0 baseline
 * so the base game asks for real defence. Bounty rises with difficulty to reward
 * the climb.
 *
 * Combat-power (hpMult × atkMult) vs the Normal floor (1.55 × 1.25 ≈ 1.94):
 *   Normal    1.55 × 1.25 ≈ 1.94   (1×)
 *   Hard      7.8  × 2.5  ≈ 19.5   (≈10× Normal)
 *   Nightmare 14.8 × 3.3  ≈ 48.8   (≈25× Normal)
 *
 * BOSSES get a further multiplier (bossHpMult/bossAtkMult) on top, so a Normal
 * boss is ~2.48× HP over equal-base trash, a Hard boss ~15.6× HP / 3.25× ATK and
 * a Nightmare boss ~35.5× HP / 4.95× ATK over its Normal-tier self — the marquee
 * threat scales harder than the trash, and now reads as a real wall even on Normal
 * (where bossHpMult used to be a no-op 1.0).
 */
export const DIFFICULTY_SCALING: Record<Difficulty, DifficultyScaling> = {
  // Normal floor lifted (1.3→1.55 HP, 1.15→1.25 atk): the base game asks for
  // real defence from wave one. Most of the "too easy" fix comes from the
  // intra-stage wave ramp (see waveScaling.ts), not this flat multiplier.
  // bossHpMult lifted off 1.0 so the one boss per stage is a genuine wall.
  Normal: { hpMult: 1.55, atkMult: 1.25, bountyMult: 1, bossHpMult: 1.6, bossAtkMult: 1 },
  Hard: { hpMult: 7.8, atkMult: 2.5, bountyMult: 3, bossHpMult: 2.0, bossAtkMult: 1.3 },
  Nightmare: { hpMult: 14.8, atkMult: 3.3, bountyMult: 5, bossHpMult: 2.4, bossAtkMult: 1.5 },
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
  | "grass"
  | "sand"
  | "water"
  | "stone"
  | "jungle"
  | "mountain"
  | "lava"
  | "ice"
  | "snow"
  | "crystal";
export interface TerrainFeature {
  type: TerrainType;
  x: number;
  y: number;
  r: number; // radius (circular blob)
  blocks: boolean; // true = towers cannot be placed here
}

/**
 * A maze-arena battlefield (endless mode): a central castle besieged from many
 * directions through a braided road network. When a stage carries this, the
 * battle uses the arena's center as the castle and `routes` as the roads enemies
 * walk; campaign stages leave it undefined and use the single `path` lane.
 */
export interface ArenaDef {
  /** The castle — the world middle. */
  center: Vec2;
  /** Ground spawn points just outside the map edges (multi-direction siege). */
  gates: Vec2[];
  /** Flyer spawn points (the gate mouths); flyers beeline the center from here. */
  airSpawns: Vec2[];
  /** Precomputed corridor polylines, each running from a gate to the center. */
  routes: Vec2[][];
}

export interface StageDef {
  id: string;
  name: string;
  /** Lane waypoints; the last point is the castle. */
  path: Vec2[];
  /**
   * Optional multi-lane / branching ground paths. When present, enemies are
   * distributed across these complete polylines (each edge→keep) instead of the
   * single `path`. `path` is kept equal to `lanes[0]` so the keep (last point)
   * and `castlePos` stay correct. Undefined for single-lane and arena stages.
   */
  lanes?: Vec2[][];
  /** Where flying enemies spawn (they beeline the castle from here). */
  airSpawns: Vec2[];
  castleHp: number;
  startingGold: number;
  /** Discrete tower placement slots (legacy; free placement uses terrain instead). */
  towerSlots: Vec2[];
  /** Terrain features for rendering + obstacle-based free placement. */
  terrain?: TerrainFeature[];
  /** Endless maze arena (center castle, multi-gate roads). Campaign stages omit it. */
  arena?: ArenaDef;
  waves: WaveDef[];
}

// ---------------------------------------------------------------------------
// Validators — fail loud on malformed content
// ---------------------------------------------------------------------------

// Runtime validators live in schemaValidators.ts; re-exported here so existing
// `import { validateX } from "./schema.ts"` callsites keep working.
export {
  SchemaError,
  validateCharacter,
  validateEnemy,
  validateStage,
  validateActiveSkill,
  validatePassiveNode,
  validateItemDef,
} from "./schemaValidators.ts";
