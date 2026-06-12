/**
 * Roster batch D — overflow tails split out of towers.ts (TOWERS_A2),
 * towersB.ts (TOWERS_B2), and towersC.ts (TOWERS_C2) purely to keep every
 * roster file under the project's 500-line limit. Each segment is spliced back
 * into the merged TOWERS roster (towers.ts) directly after its parent file's
 * entries, so the final roster content and order are unchanged.
 */
import { makeStats, type CharacterDef } from "./schema.ts";
import { t } from "./towerBuilder.ts";

/** Tail of the towers.ts CHAIN section (Legendary + Unique). */
export const TOWERS_A2: CharacterDef[] = [
  t({
    id: "kilo-lightning-hand",
    name: "Kilo the Lightning Hand", // homage: Killua Zoldyck (Hunter x Hunter)
    rarity: "Legendary",
    role: "chain",
    target: "Both",
    cost: 155,
    description:
      "A former assassin prodigy who cloaks himself in lightning and moves faster than thought, striking a dozen foes in a heartbeat.",
    meta: {
      homage: "Killua Zoldyck (Hunter x Hunter)",
      outfit:
        "A simple turtleneck and shorts, spiky silver-white hair, lightning crawling over bare skin",
      weapon: {
        family: "fist",
        element: "lightning",
        enchanted: true,
        display: "Bare hands cloaked in crackling lightning",
      },
    },
    passives: ["godspeed", "whirlwind", "assassin-instinct"],
    active: "thunderbolt",
    behavior: { chainTargets: 5, chainFalloff: 0.74 },
    baseStats: makeStats({
      atk: 38,
      attackSpeed: 1.3,
      range: 150,
      critRate: 0.25,
      magicPen: 0.35,
      skillPower: 1.5,
      maxHp: 170,
      manaOnHit: 15,
    }),
  }),
  t({
    id: "sasu-stormblade",
    name: "Sasu the Stormblade", // homage: Sasuke Uchiha (Naruto)
    rarity: "Unique",
    role: "chain",
    target: "Both",
    cost: 205,
    description:
      "A brooding clan-last prodigy who calls down a dragon of lightning to leap between every enemy on the field. Power chased at a terrible price.",
    meta: {
      homage: "Sasuke Uchiha (Naruto)",
      outfit:
        "A dark high-collared cloak bearing a clan crest, black hair, one arm wrapped in storm-light",
      weapon: {
        family: "sword",
        element: "lightning",
        enchanted: true,
        display: "A lightning-charged chokuto that calls down a dragon of thunder",
      },
    },
    passives: ["sharingan", "chidori-stream", "vengeance"],
    active: "kirin",
    behavior: { chainTargets: 6, chainFalloff: 0.8, activeType: "True" }, // the descending lightning spares nothing
    baseStats: makeStats({
      atk: 46,
      attackSpeed: 1.2,
      range: 165,
      critRate: 0.3,
      critDamage: 1.9,
      magicPen: 0.4,
      skillPower: 1.7,
      maxHp: 200,
      manaOnHit: 16,
    }),
  }),
];

/** Tail of the towersB.ts TANKER section (Rare → Unique). */
export const TOWERS_B2: CharacterDef[] = [
  t({
    id: "joro-diamondhide",
    name: "Joro the Diamondhide", // homage: Diamond Jozu (One Piece)
    rarity: "Rare",
    role: "tanker",
    target: "Ground",
    cost: 110,
    description:
      "A towering commander who turns his entire body to flawless diamond, shrugging off blows that would fell an army and answering with crushing fists.",
    meta: {
      homage: "Diamond Jozu (One Piece)",
      outfit:
        "A broad-shouldered officer's coat over a body faceted like cut diamond, glinting hard light",
      weapon: { family: "fist", display: "Diamond-hard fists that crack the ground on impact" },
    },
    passives: ["diamond-body", "unbreakable"],
    active: "adamant-burst",
    behavior: { defenseScale: { armor: 1.8, maxHp: 0.07 } },
    baseStats: makeStats({
      range: 90,
      critRate: 0.08,
      critDamage: 1.8,
      armor: 42,
      magicResist: 28,
      damageReduction: 0.08,
      hpRegen: 6,
    }),
  }),
  t({
    id: "reinhart-armored-wall",
    name: "Reinhart the Armored Wall", // homage: Reiner / the Armored Titan (Attack on Titan)
    rarity: "Legendary",
    role: "tanker",
    target: "Ground",
    cost: 145,
    description:
      "A grim soldier clad head to toe in living plate, who becomes the wall when the wall must hold. Carries the weight of duty like armor that never comes off.",
    meta: {
      homage: "Reiner / the Armored Titan (Attack on Titan)",
      outfit: "Interlocking bone-white armor plating over every limb, weathered and battle-scarred",
      weapon: {
        family: "fist",
        display: "Plated fists and a full-body charge that flattens the line",
      },
    },
    passives: ["plated-hide", "bulwark", "last-bastion"],
    active: "armored-charge",
    behavior: { defenseScale: { armor: 2.2, maxHp: 0.08 } },
    baseStats: makeStats({
      range: 95,
      critRate: 0.1,
      armor: 60,
      magicResist: 40,
      damageReduction: 0.1,
      hpRegen: 8,
    }),
  }),
  t({
    id: "garron-unbreaking-pillar",
    name: "Garron the Unbreaking Pillar", // homage: All Might (My Hero Academia)
    rarity: "Unique",
    role: "tanker",
    target: "Both",
    cost: 200,
    description:
      "The smiling symbol every defender rallies behind — he takes the hardest blow the enemy can throw, plants his feet, and answers with a strike that shakes the sky. As long as he stands, no one falls.",
    meta: {
      homage: "All Might (My Hero Academia) — the unbreakable Symbol of Peace",
      outfit:
        "A broad heroic frame in blue-and-gold, golden swept-back hair and an unshakeable grin",
      weapon: { family: "fist", display: "Bare fists and a city-block-shaking smash" },
    },
    passives: ["indomitable", "symbol-of-peace", "counter-stance"],
    active: "fortress-smash",
    behavior: { defenseScale: { armor: 2.6, magicResist: 1.5, maxHp: 0.1 } },
    baseStats: makeStats({
      range: 100,
      critRate: 0.15,
      critDamage: 2.0,
      armor: 80,
      magicResist: 60,
      damageReduction: 0.14,
      hpRegen: 10,
      omnivamp: 0.1,
    }),
  }),
];

/** Tail of towersC.ts — the MAGIC IMPLEMENT (orb) entry. */
export const TOWERS_C2: CharacterDef[] = [
  // ===================== MAGIC IMPLEMENT — orb =====================
  t({
    id: "aquella-the-radiant",
    name: "Aquella the Radiant", // homage: Aqua (KonoSuba) — the (self-proclaimed) goddess
    rarity: "Unique",
    role: "support",
    target: "Both",
    cost: 215,
    description:
      "A dazzling, deeply unserious water-goddess whose floating orb pours blessing over the whole battle line — astonishingly powerful when she stops complaining long enough to use it.",
    meta: {
      homage: "A dazzling, deeply unserious self-proclaimed water-goddess of support",
      outfit:
        "A blue-and-white goddess's dress with detached sleeves and a water-ring halo, a glowing scrying orb afloat at her hand",
      weapon: {
        family: "orb",
        element: "holy",
        display: "A floating scrying orb that haloes allies in sacred light",
      },
    },
    passives: ["benediction", "goddess-favor", "purify"],
    active: "sacred-renewal",
    behavior: { buffAura: { radius: 185, atkPct: 0.25, attackSpeedPct: 0.18 } },
    baseStats: makeStats({
      atk: 14,
      attackSpeed: 0.75,
      range: 190,
      critRate: 0.1,
      critDamage: 1.5,
      skillPower: 2.2,
      maxHp: 270,
      manaOnHit: 0,
    }),
  }),
];
