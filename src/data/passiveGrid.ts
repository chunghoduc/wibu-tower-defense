import { type PassiveNodeDef, validatePassiveNode } from "./schema.ts";

function n(def: PassiveNodeDef): PassiveNodeDef {
  return validatePassiveNode(def);
}

export const PASSIVE_NODES: PassiveNodeDef[] = [
  // Starting node
  n({ id: "grid-start", type: "notable", region: "brawler", name: "Warrior's Origin",
      description: "The beginning of all paths.", gridX: 12, gridY: 9,
      neighbors: ["brawler-p1", "arcane-p1", "warden-p1", "predator-p1", "tactician-p1", "phantom-p1", "conduit-p1"],
      flat: { atk: 5, maxHp: 30 } }),

  // Brawler
  n({ id: "brawler-p1", type: "path", region: "brawler", name: "+3% ATK",
      description: "Strike harder.", gridX: 10, gridY: 8,
      neighbors: ["grid-start", "brawler-p2"], increased: { atk: 0.03 } }),
  n({ id: "brawler-p2", type: "path", region: "brawler", name: "+3% ATK",
      description: "Strike harder.", gridX: 8, gridY: 7,
      neighbors: ["brawler-p1", "brawler-notable-1"], increased: { atk: 0.03 } }),
  n({ id: "brawler-notable-1", type: "notable", region: "brawler", name: "Brutality",
      description: "+12% ATK, +8% crit rate.", gridX: 7, gridY: 6,
      neighbors: ["brawler-p2", "brawler-p3", "brawler-mastery-1", "brawler-p4"],
      increased: { atk: 0.12, critRate: 0.08 } }),
  n({ id: "brawler-mastery-1", type: "mastery", region: "brawler", name: "Brawler Mastery",
      description: "Choose: +20% crit dmg, or +15% armor pen, or +10% ATK.",
      gridX: 6, gridY: 5, neighbors: ["brawler-notable-1"],
      effectId: "brawler-mastery", increased: { critDamage: 0.2 } }),
  n({ id: "brawler-p3", type: "path", region: "brawler", name: "+5% crit dmg",
      description: "Hit harder on crits.", gridX: 6, gridY: 7,
      neighbors: ["brawler-notable-1", "brawler-notable-2"], increased: { critDamage: 0.05 } }),
  n({ id: "brawler-notable-2", type: "notable", region: "brawler", name: "Predatory Strikes",
      description: "+10% ATK, +10% crit rate, +15% crit dmg.", gridX: 5, gridY: 8,
      neighbors: ["brawler-p3", "brawler-keystone-1"],
      increased: { atk: 0.10, critRate: 0.10, critDamage: 0.15 } }),
  n({ id: "brawler-keystone-1", type: "keystone", region: "brawler", name: "Executioner",
      description: "Hits vs enemies below 25% HP deal ×1.5 damage.",
      gridX: 4, gridY: 9, neighbors: ["brawler-notable-2"],
      effectId: "executioner", more: { atk: 0.5 } }),
  n({ id: "brawler-p4", type: "path", region: "brawler", name: "+4% armorPen",
      description: "Pierce defences.", gridX: 9, gridY: 6,
      neighbors: ["brawler-notable-1", "brawler-jewel-1"], increased: { armorPen: 0.04 } }),
  n({ id: "brawler-jewel-1", type: "jewel-socket", region: "brawler", name: "Jewel Socket",
      description: "Insert a Jewel to modify nearby nodes.", gridX: 8, gridY: 5,
      neighbors: ["brawler-p4"] }),

  // Arcane
  n({ id: "arcane-p1", type: "path", region: "arcane", name: "+3% skillPower",
      description: "Empower your spells.", gridX: 14, gridY: 8,
      neighbors: ["grid-start", "arcane-p2"], increased: { skillPower: 0.03 } }),
  n({ id: "arcane-p2", type: "path", region: "arcane", name: "+3% magicPen",
      description: "Your magic pierces resistance.", gridX: 16, gridY: 7,
      neighbors: ["arcane-p1", "arcane-notable-1"], increased: { magicPen: 0.03 } }),
  n({ id: "arcane-notable-1", type: "notable", region: "arcane", name: "Arcane Surge",
      description: "+15% skillPower, +10% magicPen.", gridX: 17, gridY: 6,
      neighbors: ["arcane-p2", "arcane-p3", "arcane-mastery-1"],
      increased: { skillPower: 0.15, magicPen: 0.10 } }),
  n({ id: "arcane-mastery-1", type: "mastery", region: "arcane", name: "Arcane Mastery",
      description: "Choose: +15% skillPower, or +20% mana, or +10 manaOnHit.",
      gridX: 18, gridY: 5, neighbors: ["arcane-notable-1", "arcane-jewel-1"],
      effectId: "arcane-mastery", increased: { skillPower: 0.15 } }),
  n({ id: "arcane-jewel-1", type: "jewel-socket", region: "arcane", name: "Jewel Socket",
      description: "Insert a Jewel to empower your hero and towers.", gridX: 19, gridY: 5,
      neighbors: ["arcane-mastery-1"] }),
  n({ id: "arcane-p3", type: "path", region: "arcane", name: "+4% skillPower",
      description: "Empower your spells.", gridX: 18, gridY: 7,
      neighbors: ["arcane-notable-1", "arcane-notable-2"], increased: { skillPower: 0.04 } }),
  n({ id: "arcane-notable-2", type: "notable", region: "arcane", name: "Font of Power",
      description: "+20% maxMana, +5 manaRegen, +12% skillPower.", gridX: 19, gridY: 8,
      neighbors: ["arcane-p3", "arcane-keystone-1"],
      increased: { maxMana: 0.20, skillPower: 0.12 }, flat: { manaRegen: 5 } }),
  n({ id: "arcane-keystone-1", type: "keystone", region: "arcane", name: "Spellweave",
      description: "Every 3rd cast costs no mana and deals ×2 skill damage.",
      gridX: 20, gridY: 9, neighbors: ["arcane-notable-2", "arcane-p4"],
      effectId: "spellweave", more: { skillPower: 1.0 } }),
  n({ id: "arcane-p4", type: "path", region: "arcane", name: "+3% manaCostReduction",
      description: "Your spells cost less to cast.", gridX: 21, gridY: 8,
      neighbors: ["arcane-keystone-1"], increased: { manaCostReduction: 0.03 } }),

  // Warden
  n({ id: "warden-p1", type: "path", region: "warden", name: "+30 maxHp",
      description: "Bolster your vitality.", gridX: 10, gridY: 10,
      neighbors: ["grid-start", "warden-p2"], flat: { maxHp: 30 } }),
  n({ id: "warden-p2", type: "path", region: "warden", name: "+5 armor",
      description: "Harden your defence.", gridX: 8, gridY: 11,
      neighbors: ["warden-p1", "warden-notable-1"], flat: { armor: 5 } }),
  n({ id: "warden-notable-1", type: "notable", region: "warden", name: "Iron Bastion",
      description: "+80 maxHp, +10 armor, +5% hpRegen.", gridX: 7, gridY: 12,
      neighbors: ["warden-p2", "warden-p3", "warden-mastery-1"],
      flat: { maxHp: 80, armor: 10 }, increased: { hpRegen: 0.05 } }),
  n({ id: "warden-mastery-1", type: "mastery", region: "warden", name: "Warden Mastery",
      description: "Choose: +15% dmgReduction, or +20% magicResist, or +100 maxHp.",
      gridX: 6, gridY: 13, neighbors: ["warden-notable-1", "warden-jewel-1"],
      effectId: "warden-mastery", increased: { damageReduction: 0.15 } }),
  n({ id: "warden-jewel-1", type: "jewel-socket", region: "warden", name: "Jewel Socket",
      description: "Insert a Jewel to empower your hero and towers.", gridX: 5, gridY: 13,
      neighbors: ["warden-mastery-1"] }),
  n({ id: "warden-p3", type: "path", region: "warden", name: "+5 magicResist",
      description: "Resist hostile magic.", gridX: 8, gridY: 13,
      neighbors: ["warden-notable-1", "warden-notable-2"], flat: { magicResist: 5 } }),
  n({ id: "warden-notable-2", type: "notable", region: "warden", name: "Stone Wall",
      description: "+120 maxHp, +8 armor, +8 magicResist.", gridX: 7, gridY: 14,
      neighbors: ["warden-p3", "warden-keystone-1"],
      flat: { maxHp: 120, armor: 8, magicResist: 8 } }),
  n({ id: "warden-keystone-1", type: "keystone", region: "warden", name: "Fortress",
      description: "Immune to stun; lose 15% move speed.",
      gridX: 6, gridY: 15, neighbors: ["warden-notable-2"],
      effectId: "fortress", flat: { tenacity: 1 }, increased: { moveSpeed: -0.15 } }),

  // Tactician
  n({ id: "tactician-p1", type: "path", region: "tactician", name: "+2% goldFind",
      description: "Squeeze more from every kill.", gridX: 14, gridY: 10,
      neighbors: ["grid-start", "tactician-p2"], increased: { goldFind: 0.02 } }),
  n({ id: "tactician-p2", type: "path", region: "tactician", name: "+3% goldFind",
      description: "Wealth follows the tactician.", gridX: 16, gridY: 11,
      neighbors: ["tactician-p1", "tactician-notable-1"], increased: { goldFind: 0.03 } }),
  n({ id: "tactician-notable-1", type: "notable", region: "tactician", name: "Quartermaster",
      description: "+10% goldFind, +10 manaOnKill.", gridX: 17, gridY: 12,
      neighbors: ["tactician-p2", "tactician-p3", "tactician-mastery-1"],
      increased: { goldFind: 0.10 }, flat: { manaOnKill: 10 } }),
  n({ id: "tactician-mastery-1", type: "mastery", region: "tactician", name: "Tactician Mastery",
      description: "Choose: +20% goldFind, or tower ATK aura, or -10% tower cost.",
      gridX: 18, gridY: 13, neighbors: ["tactician-notable-1", "tactician-jewel-1"],
      effectId: "tactician-mastery", increased: { goldFind: 0.20 } }),
  n({ id: "tactician-jewel-1", type: "jewel-socket", region: "tactician", name: "Jewel Socket",
      description: "Insert a Jewel to empower your hero and towers.", gridX: 19, gridY: 13,
      neighbors: ["tactician-mastery-1"] }),
  n({ id: "tactician-p3", type: "path", region: "tactician", name: "+5 manaOnKill",
      description: "Every kill powers your arsenal.", gridX: 17, gridY: 14,
      neighbors: ["tactician-notable-1", "tactician-keystone-1"], flat: { manaOnKill: 5 } }),
  n({ id: "tactician-keystone-1", type: "keystone", region: "tactician", name: "Warlord",
      description: "Towers placed within 5s cost 20% less; each placement heals hero 5% max HP.",
      gridX: 18, gridY: 15, neighbors: ["tactician-p3"],
      effectId: "warlord" }),

  // Predator
  n({ id: "predator-p1", type: "path", region: "predator", name: "+2% omnivamp",
      description: "Steal life from every blow.", gridX: 12, gridY: 11,
      neighbors: ["grid-start", "predator-p2", "predator-p4"], increased: { omnivamp: 0.02 } }),
  n({ id: "predator-p2", type: "path", region: "predator", name: "+5 manaOnHit",
      description: "Each blow fills your reserves.", gridX: 12, gridY: 13,
      neighbors: ["predator-p1", "predator-notable-1"], flat: { manaOnHit: 5 } }),
  n({ id: "predator-notable-1", type: "notable", region: "predator", name: "Bloodthirst",
      description: "+5% omnivamp, +8 manaOnKill.", gridX: 11, gridY: 14,
      neighbors: ["predator-p2", "predator-p3"],
      increased: { omnivamp: 0.05 }, flat: { manaOnKill: 8 } }),
  n({ id: "predator-p3", type: "path", region: "predator", name: "+3% omnivamp",
      description: "Feed on your enemies.", gridX: 11, gridY: 15,
      neighbors: ["predator-notable-1", "predator-keystone-1"], increased: { omnivamp: 0.03 } }),
  n({ id: "predator-keystone-1", type: "keystone", region: "predator", name: "Momentum",
      description: "On kill: +8% ATK stacking ×5; resets on taking damage.",
      gridX: 10, gridY: 16, neighbors: ["predator-p3"],
      effectId: "momentum" }),
  n({ id: "predator-p4", type: "path", region: "predator", name: "+2% lifesteal",
      description: "Draw sustain from every strike.", gridX: 13, gridY: 12,
      neighbors: ["predator-p1", "predator-notable-2"], increased: { omnivamp: 0.02 } }),
  n({ id: "predator-notable-2", type: "notable", region: "predator", name: "Feral Instinct",
      description: "+8% omnivamp, +10% critRate.", gridX: 14, gridY: 13,
      neighbors: ["predator-p4", "predator-jewel-1"],
      increased: { omnivamp: 0.08, critRate: 0.10 } }),
  n({ id: "predator-jewel-1", type: "jewel-socket", region: "predator", name: "Jewel Socket",
      description: "Insert a Jewel to empower your hero and towers.", gridX: 15, gridY: 13,
      neighbors: ["predator-notable-2"] }),

  // Phantom
  n({ id: "phantom-p1", type: "path", region: "phantom", name: "+5% moveSpeed",
      description: "Move like a ghost.", gridX: 12, gridY: 7,
      neighbors: ["grid-start", "phantom-p2"], increased: { moveSpeed: 0.05 } }),
  n({ id: "phantom-p2", type: "path", region: "phantom", name: "+5% moveSpeed",
      description: "Flow through the battle.", gridX: 12, gridY: 5,
      neighbors: ["phantom-p1", "phantom-notable-1"], increased: { moveSpeed: 0.05 } }),
  n({ id: "phantom-notable-1", type: "notable", region: "phantom", name: "Fleet-Footed",
      description: "+15% moveSpeed, +10% tenacity.", gridX: 11, gridY: 4,
      neighbors: ["phantom-p2", "phantom-p3"],
      increased: { moveSpeed: 0.15, tenacity: 0.10 } }),
  n({ id: "phantom-p3", type: "path", region: "phantom", name: "+5% attackSpeed",
      description: "Swift hands.", gridX: 10, gridY: 3,
      neighbors: ["phantom-notable-1", "phantom-keystone-1", "phantom-p4"], increased: { attackSpeed: 0.05 } }),
  n({ id: "phantom-p4", type: "path", region: "phantom", name: "+5% tenacity",
      description: "Shake off crowd control faster.", gridX: 9, gridY: 4,
      neighbors: ["phantom-p3", "phantom-notable-2"], increased: { tenacity: 0.05 } }),
  n({ id: "phantom-notable-2", type: "notable", region: "phantom", name: "Wind Walker",
      description: "+10% attackSpeed, +8% moveSpeed.", gridX: 8, gridY: 5,
      neighbors: ["phantom-p4", "phantom-jewel-1"],
      increased: { attackSpeed: 0.10, moveSpeed: 0.08 } }),
  n({ id: "phantom-jewel-1", type: "jewel-socket", region: "phantom", name: "Jewel Socket",
      description: "Insert a Jewel to empower your hero and towers.", gridX: 7, gridY: 5,
      neighbors: ["phantom-notable-2"] }),
  n({ id: "phantom-keystone-1", type: "keystone", region: "phantom", name: "Ghost Step",
      description: "Once per 8s the next incoming hit misses entirely.",
      gridX: 9, gridY: 2, neighbors: ["phantom-p3", "prestige-gate-25"],
      effectId: "ghost-step" }),

  // Conduit
  n({ id: "conduit-p1", type: "path", region: "conduit", name: "+3% critRate",
      description: "Find gaps in every defence.", gridX: 14, gridY: 7,
      neighbors: ["grid-start", "conduit-p2"], increased: { critRate: 0.03 } }),
  n({ id: "conduit-p2", type: "path", region: "conduit", name: "+5% skillPower",
      description: "Channel raw power.", gridX: 15, gridY: 5,
      neighbors: ["conduit-p1", "conduit-notable-1"], increased: { skillPower: 0.05 } }),
  n({ id: "conduit-notable-1", type: "notable", region: "conduit", name: "Power Nexus",
      description: "+10% critRate, +8% skillPower, +5 manaOnHit.", gridX: 16, gridY: 4,
      neighbors: ["conduit-p2", "conduit-p3", "conduit-jewel-2"],
      increased: { critRate: 0.10, skillPower: 0.08 }, flat: { manaOnHit: 5 } }),
  n({ id: "conduit-jewel-2", type: "jewel-socket", region: "conduit", name: "Jewel Socket",
      description: "Insert a Jewel to modify nearby nodes.", gridX: 16, gridY: 3,
      neighbors: ["conduit-notable-1"] }),
  n({ id: "conduit-p3", type: "path", region: "conduit", name: "+5% critDamage",
      description: "Amplify each critical hit.", gridX: 17, gridY: 3,
      neighbors: ["conduit-notable-1", "conduit-keystone-1"], increased: { critDamage: 0.05 } }),
  n({ id: "conduit-keystone-1", type: "keystone", region: "conduit", name: "Arcane Conduit",
      description: "On kill: restore 20 mana to nearest 2 towers.",
      gridX: 18, gridY: 2, neighbors: ["conduit-p3", "prestige-gate-25"],
      effectId: "arcane-conduit" }),

  // Prestige
  n({ id: "prestige-gate-25", type: "notable", region: "prestige",
      name: "Veteran's Path", description: "Unlocked at level 25.",
      gridX: 12, gridY: 1,
      neighbors: ["phantom-keystone-1", "conduit-keystone-1", "prestige-undying", "prestige-gate-50", "prestige-jewel-1"],
      unlockAtLevel: 25, increased: { atk: 0.05, maxHp: 0.05 } }),
  n({ id: "prestige-jewel-1", type: "jewel-socket", region: "prestige", name: "Jewel Socket",
      description: "Insert a Jewel to empower your hero and towers (level 25+).", gridX: 13, gridY: 1,
      neighbors: ["prestige-gate-25"], unlockAtLevel: 25 }),
  n({ id: "prestige-undying", type: "keystone", region: "prestige", name: "Undying",
      description: "Once per battle survive a lethal hit at 1 HP.",
      gridX: 10, gridY: 0, neighbors: ["prestige-gate-25"],
      effectId: "undying", unlockAtLevel: 25 }),
  n({ id: "prestige-gate-50", type: "notable", region: "prestige",
      name: "Champion's Gate", description: "Unlocked at level 50.",
      gridX: 14, gridY: 1,
      neighbors: ["prestige-gate-25", "prestige-lifeline", "prestige-gate-75"],
      unlockAtLevel: 50, increased: { skillPower: 0.08 } }),
  n({ id: "prestige-lifeline", type: "keystone", region: "prestige", name: "Lifeline",
      description: "Omnivamp heals extend to nearby towers for 25% of the amount.",
      gridX: 15, gridY: 0, neighbors: ["prestige-gate-50"],
      effectId: "lifeline", unlockAtLevel: 50 }),
  n({ id: "prestige-gate-75", type: "notable", region: "prestige",
      name: "Legend's Road", description: "Unlocked at level 75.",
      gridX: 12, gridY: 0,
      neighbors: ["prestige-gate-50", "prestige-berserker", "prestige-gate-90"],
      unlockAtLevel: 75, increased: { atk: 0.10 } }),
  n({ id: "prestige-berserker", type: "keystone", region: "prestige", name: "Berserker",
      description: "Below 30% HP: +50% ATK, +30% attack speed.",
      gridX: 11, gridY: -1, neighbors: ["prestige-gate-75"],
      effectId: "berserker", unlockAtLevel: 75 }),
  n({ id: "prestige-gate-90", type: "notable", region: "prestige",
      name: "Transcendent Gate", description: "Unlocked at level 90.",
      gridX: 13, gridY: 0,
      neighbors: ["prestige-gate-75", "prestige-transcendence", "prestige-living-fortress"],
      unlockAtLevel: 90, more: { atk: 0.15 } }),
  n({ id: "prestige-transcendence", type: "keystone", region: "prestige", name: "Transcendence",
      description: "Active skills always deal True damage.",
      gridX: 14, gridY: -1, neighbors: ["prestige-gate-90"],
      effectId: "transcendence", unlockAtLevel: 90 }),
  n({ id: "prestige-living-fortress", type: "keystone", region: "prestige", name: "Living Fortress",
      description: "Hero blocks enemy pathing in a 1-tile radius.",
      gridX: 12, gridY: -1, neighbors: ["prestige-gate-90"],
      effectId: "living-fortress", unlockAtLevel: 90 }),
];

export const PASSIVE_NODES_MAP = new Map<string, PassiveNodeDef>(
  PASSIVE_NODES.map((n) => [n.id, n])
);

export function getReachableNodes(
  unlockedIds: string[],
  heroLevel: number,
): PassiveNodeDef[] {
  const unlockedSet = new Set(unlockedIds);
  if (unlockedSet.size === 0) {
    const start = PASSIVE_NODES_MAP.get("grid-start");
    return start ? [start] : [];
  }
  const reachable: PassiveNodeDef[] = [];
  for (const node of PASSIVE_NODES) {
    if (unlockedSet.has(node.id)) continue;
    if ((node.unlockAtLevel ?? 0) > heroLevel) continue;
    if (node.neighbors.some((id) => unlockedSet.has(id))) reachable.push(node);
  }
  return reachable;
}

/**
 * Whether `nodeId` can be safely un-allocated (forgotten) without orphaning any
 * other allocated node. Allocation only ever grows outward from `grid-start`
 * (see getReachableNodes), so a node is forgettable only when every OTHER
 * unlocked node stays reachable from the start along edges that pass solely
 * through still-unlocked nodes. This keeps the saved tree always-valid — never
 * leaving a floating node the player could not have legally bought.
 */
export function canForgetNode(unlockedIds: string[], nodeId: string): boolean {
  const unlocked = new Set(unlockedIds);
  if (!unlocked.has(nodeId)) return false;

  const remaining = new Set(unlocked);
  remaining.delete(nodeId);
  if (remaining.size === 0) return true; // forgetting the last node clears the tree

  // The start is the only root; if it's gone but other nodes remain, they orphan.
  if (!remaining.has("grid-start")) return false;

  // BFS from grid-start across the remaining unlocked nodes only.
  const seen = new Set<string>(["grid-start"]);
  const queue = ["grid-start"];
  while (queue.length > 0) {
    const node = PASSIVE_NODES_MAP.get(queue.pop()!);
    if (!node) continue;
    for (const nb of node.neighbors) {
      if (remaining.has(nb) && !seen.has(nb)) {
        seen.add(nb);
        queue.push(nb);
      }
    }
  }
  return seen.size === remaining.size;
}
