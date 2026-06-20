// Compact per-region growth descriptors consumed by passiveTreeGen.ts. Pure data:
// stat pools for travel/notable nodes, the deep outer keystone, and one mastery
// choice node per region. Anchor + sector angle are DERIVED at build time from each
// region's farthest authored node (see passiveTreeGen.ts) — not stored here.
import type { Stats, PassiveRegion } from "./schema.ts";

export const CENTER = { x: 12, y: 9 } as const;

// Lobe shape. Tuned so: the outer keystone sits at BFS depth ≥ ~56 from grid-start
// (anchorDepth ~4-9 + spineLen), making TWO regions' keystones (> 100 pts)
// unaffordable at the 100-point cap; and each lobe is ~110 nodes (× 8 ≈ 880+).
export const GEN = {
  spineLen: 52, // travel nodes from anchor out to the outer keystone
  branchEvery: 2, // attach a side branch off every Nth spine node
  branchMin: 1,
  branchMax: 3,
  masteryAt: 12, // spine index that carries the mastery choice node
  jewelAt: [8, 28, 46], // spine indices that carry a jewel socket off-branch
  ringStep: 1, // grid rings advanced per spine node
  angleJitter: 0.05, // radians of deterministic wobble inside the sector
  branchAngle: 0.14, // radians a branch peels off the spine
} as const;

type Pair = [keyof Stats, number];

export interface RegionGrowth {
  region: PassiveRegion;
  /** Travel nodes pick one entry (increased%). At least 3 per region. */
  travel: Pair[];
  /** Notable bag (increased%). */
  notable: Partial<Stats>;
  /** Deep outer keystone. */
  keystone: { name: string; desc: string; effectId: string; more: Partial<Stats> };
  /** One mastery choice node per lobe. */
  mastery: {
    name: string;
    effectId: string;
    choices: { id: string; label: string; increased?: Partial<Stats>; flat?: Partial<Stats> }[];
  };
}

export const REGION_GROWTH: RegionGrowth[] = [
  {
    region: "brawler",
    travel: [
      ["atk", 0.04],
      ["critRate", 0.03],
      ["critDamage", 0.05],
      ["armorPen", 0.03],
    ],
    notable: { atk: 0.14, critRate: 0.06 },
    keystone: {
      name: "Warlord's Ruin",
      desc: "Hits vs full-HP enemies deal ×1.6 damage.",
      effectId: "gen-brawler-keystone",
      more: { atk: 0.6 },
    },
    mastery: {
      name: "Brawler Focus",
      effectId: "gen-brawler-mastery",
      choices: [
        { id: "edge", label: "Edge  +25% Crit Dmg", increased: { critDamage: 0.25 } },
        { id: "rend", label: "Rend  +18% Armor Pen", increased: { armorPen: 0.18 } },
        { id: "might", label: "Might  +15% ATK", increased: { atk: 0.15 } },
      ],
    },
  },
  {
    region: "arcane",
    travel: [
      ["skillPower", 0.05],
      ["magicPen", 0.03],
      ["maxHp", 0.03],
    ],
    notable: { skillPower: 0.16, magicPen: 0.08 },
    keystone: {
      name: "Archmage Ascendant",
      desc: "Every 4th cast deals ×2.5 skill damage.",
      effectId: "gen-arcane-keystone",
      more: { skillPower: 1.2 },
    },
    mastery: {
      name: "Arcane Focus",
      effectId: "gen-arcane-mastery",
      choices: [
        { id: "potency", label: "Potency  +20% Skill Power", increased: { skillPower: 0.2 } },
        { id: "pierce", label: "Pierce  +14% Magic Pen", increased: { magicPen: 0.14 } },
        { id: "siphon", label: "Siphon  +6 Mana/Hit", flat: { manaOnHit: 6 } },
      ],
    },
  },
  {
    region: "warden",
    travel: [
      ["maxHp", 0.04],
      ["armor", 0.05],
      ["magicResist", 0.05],
      ["damageReduction", 0.02],
    ],
    notable: { maxHp: 0.16, armor: 0.1 },
    keystone: {
      name: "Unbreakable",
      desc: "Take 25% less damage while above 80% HP.",
      effectId: "gen-warden-keystone",
      more: { damageReduction: 0.25 },
    },
    mastery: {
      name: "Warden Focus",
      effectId: "gen-warden-mastery",
      choices: [
        { id: "wall", label: "Wall  +18% Damage Reduction", increased: { damageReduction: 0.18 } },
        { id: "ward", label: "Ward  +22% Magic Resist", increased: { magicResist: 0.22 } },
        { id: "life", label: "Life  +18% Max HP", increased: { maxHp: 0.18 } },
      ],
    },
  },
  {
    region: "predator",
    travel: [
      ["critRate", 0.04],
      ["critDamage", 0.06],
      ["atk", 0.03],
      ["armorPen", 0.03],
    ],
    notable: { critRate: 0.1, critDamage: 0.12 },
    keystone: {
      name: "Apex Hunter",
      desc: "Crits deal ×1.5 damage and pierce 20% more armor.",
      effectId: "gen-predator-keystone",
      more: { critDamage: 0.5 },
    },
    mastery: {
      name: "Predator Focus",
      effectId: "gen-predator-mastery",
      choices: [
        { id: "lethal", label: "Lethal  +30% Crit Dmg", increased: { critDamage: 0.3 } },
        { id: "keen", label: "Keen  +12% Crit Rate", increased: { critRate: 0.12 } },
        { id: "savage", label: "Savage  +15% Armor Pen", increased: { armorPen: 0.15 } },
      ],
    },
  },
  {
    region: "tactician",
    travel: [
      ["goldFind", 0.03],
      ["skillPower", 0.04],
      ["moveSpeed", 0.03],
    ],
    notable: { skillPower: 0.1, goldFind: 0.08 },
    keystone: {
      name: "Grand Strategist",
      desc: "Towers near the hero gain +20% attack damage.",
      effectId: "gen-tactician-keystone",
      more: { skillPower: 0.4 },
    },
    mastery: {
      name: "Tactician Focus",
      effectId: "gen-tactician-mastery",
      choices: [
        { id: "command", label: "Command  +16% Skill Power", increased: { skillPower: 0.16 } },
        { id: "fortune", label: "Fortune  +14% Gold Find", increased: { goldFind: 0.14 } },
        { id: "haste", label: "Haste  +10% Move Speed", increased: { moveSpeed: 0.1 } },
      ],
    },
  },
  {
    region: "phantom",
    travel: [
      ["moveSpeed", 0.04],
      ["critRate", 0.03],
      ["tenacity", 0.03],
      ["atk", 0.03],
    ],
    notable: { moveSpeed: 0.1, critRate: 0.07 },
    keystone: {
      name: "Untouchable",
      desc: "Gain 15% tenacity; the first hit each wave is avoided.",
      effectId: "gen-phantom-keystone",
      more: { moveSpeed: 0.3 },
    },
    mastery: {
      name: "Phantom Focus",
      effectId: "gen-phantom-mastery",
      choices: [
        { id: "swift", label: "Swift  +12% Move Speed", increased: { moveSpeed: 0.12 } },
        { id: "elusive", label: "Elusive  +15% Tenacity", increased: { tenacity: 0.15 } },
        { id: "strike", label: "Strike  +10% Crit Rate", increased: { critRate: 0.1 } },
      ],
    },
  },
  {
    region: "conduit",
    travel: [
      ["skillPower", 0.05],
      ["magicPen", 0.03],
      ["maxHp", 0.03],
      ["hpRegen", 0.05],
    ],
    notable: { skillPower: 0.12, magicPen: 0.07 },
    keystone: {
      name: "Stormbound",
      desc: "Skill hits chain to 2 extra enemies for 50% damage.",
      effectId: "gen-conduit-keystone",
      more: { skillPower: 0.8 },
    },
    mastery: {
      name: "Conduit Focus",
      effectId: "gen-conduit-mastery",
      choices: [
        { id: "surge", label: "Surge  +18% Skill Power", increased: { skillPower: 0.18 } },
        { id: "flow", label: "Flow  +12% HP Regen", increased: { hpRegen: 0.12 } },
        { id: "spark", label: "Spark  +12% Magic Pen", increased: { magicPen: 0.12 } },
      ],
    },
  },
  {
    region: "prestige",
    travel: [
      ["atk", 0.03],
      ["skillPower", 0.03],
      ["maxHp", 0.03],
      ["critDamage", 0.04],
    ],
    notable: { atk: 0.08, skillPower: 0.08, maxHp: 0.08 },
    keystone: {
      name: "Paragon",
      desc: "All stats +10%. The crown of any path.",
      effectId: "gen-prestige-keystone",
      more: { atk: 0.2, skillPower: 0.2, maxHp: 0.2 },
    },
    mastery: {
      name: "Prestige Focus",
      effectId: "gen-prestige-mastery",
      choices: [
        { id: "war", label: "War  +12% ATK", increased: { atk: 0.12 } },
        { id: "magi", label: "Magi  +12% Skill Power", increased: { skillPower: 0.12 } },
        { id: "guard", label: "Guard  +12% Max HP", increased: { maxHp: 0.12 } },
      ],
    },
  },
];
