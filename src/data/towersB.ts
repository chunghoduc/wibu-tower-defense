/** Tower roster — DoT / debuff / support characters (split from towers.ts). */
import { makeStats, type CharacterDef } from "./schema.ts";
import { t } from "./towerBuilder.ts";

export const TOWERS_B: CharacterDef[] = [
  // ============================ DOT ============================
  t({
    id: "bram-thornling",
    name: "Bram the Thornling", // homage: wood/plant users (e.g., mokuton, Naruto)
    rarity: "Common",
    role: "dot",
    target: "Ground",
    cost: 45,
    description:
      "A tiny treant sprout that lashes passersby with barbed vines and grumbles, leaf by leaf, about trespassers on its patch.",
    meta: {
      homage: "wood/plant users such as the mokuton style (Naruto)",
      outfit: "A tiny treant body of bark and moss with a leaf-tuft crown and grumpy knothole eyes",
      weapon: {
        family: "thorn",
        element: "poison",
        display: "Barbed vines that lash and bleed trespassers",
      },
    },
    passives: ["barbs"],
    active: "bramble",
    behavior: { dot: { dps: 7, duration: 3 } },
    baseStats: makeStats({
      atk: 8,
      attackSpeed: 1.0,
      range: 110,
      maxHp: 120,
      manaOnHit: 9,
    }),
  }),
  t({
    id: "kona-ember-fox",
    name: "Kona the Ember Fox", // homage: nine-tailed fox spirits (e.g., Kurama, Naruto)
    rarity: "Magic",
    role: "dot",
    target: "Both",
    cost: 80,
    description:
      "A nine-tailed fox-spirit wearing the shape of a girl, trailing foxfire that smolders in a wound long after the strike lands.",
    meta: {
      homage: "nine-tailed fox spirits such as Kurama (Naruto)",
      outfit: "A fox-girl in a red-and-white miko robe, nine ember-tipped tails fanning behind her",
      weapon: {
        family: "nature",
        element: "fire",
        display: "Foxfire — clinging spirit flame that smolders in the wound",
      },
    },
    passives: ["smolder", "foxfire"],
    active: "wildfire",
    behavior: { dot: { dps: 12, duration: 3.5 } },
    baseStats: makeStats({
      atk: 12,
      attackSpeed: 1.1,
      range: 135,
      skillPower: 1.2,
      maxHp: 110,
      manaOnHit: 11,
    }),
  }),
  t({
    id: "shion-venom-priestess",
    name: "Shion the Venom Priestess", // homage: poison users (e.g., Shizuku, HxH)
    rarity: "Rare",
    role: "dot",
    target: "Both",
    cost: 100,
    description:
      "A serene shrine-keeper who anoints her enemies with lingering toxins, murmuring soft prayers as they wither away.",
    meta: {
      homage: "poison users such as Shizuku (Hunter x Hunter)",
      outfit: "A serene shrine maiden's deep-violet robe with prayer beads and a veiled headdress",
      weapon: {
        family: "talisman",
        element: "poison",
        display: "Anointing toxins and venom-tipped prayer talismans",
      },
    },
    passives: ["virulence", "lingering-toxin"],
    active: "plague-cloud",
    behavior: { dot: { dps: 16, duration: 4 } },
    baseStats: makeStats({
      atk: 14,
      attackSpeed: 1.0,
      range: 140,
      magicPen: 0.2,
      skillPower: 1.3,
      maxHp: 120,
      manaOnHit: 12,
    }),
  }),
  t({
    id: "roan-flame-alchemist",
    name: "Roan the Flame Alchemist", // homage: Roy Mustang (Fullmetal Alchemist)
    rarity: "Legendary",
    role: "dot",
    target: "Both",
    cost: 155,
    description:
      "A sharp-eyed officer who snaps his gloved fingers to set the very air alight, leaving foes to burn long after the spark.",
    meta: {
      homage: "Roy Mustang (Fullmetal Alchemist)",
      outfit:
        "A trim military officer's blue uniform under a long coat, ignition-cloth gloves on both hands",
      weapon: {
        family: "aura",
        element: "fire",
        display: "Spark-cloth gloves that snap fire to life from the air itself",
      },
    },
    passives: ["ignition", "pinpoint-flame", "ambition"],
    active: "inferno-snap",
    behavior: { dot: { dps: 24, duration: 4.5 } },
    baseStats: makeStats({
      atk: 18,
      attackSpeed: 1.0,
      range: 150,
      magicPen: 0.35,
      skillPower: 1.6,
      maxHp: 150,
      manaOnHit: 13,
    }),
  }),
  t({
    id: "morren-plaguebearer",
    name: "Morren the Plaguebearer", // homage: decay/curse wielders (e.g., Mahito, JJK)
    rarity: "Unique",
    role: "dot",
    target: "Both",
    cost: 200,
    description:
      "A hollow-eyed wanderer who carries rot in his very veins, spreading a black corruption that armor and ward alike fail to stop.",
    meta: {
      homage: "decay/curse wielders such as Mahito (Jujutsu Kaisen)",
      outfit:
        "A hollow-eyed wanderer's tattered grey cloak stained with rot, skin a patchwork of decay",
      weapon: {
        family: "curse",
        element: "poison",
        display: "A bare touch that spreads unstoppable black decay",
      },
    },
    passives: ["corrosion", "epidemic", "necrosis"],
    active: "black-rot",
    behavior: { dot: { dps: 30, duration: 5, damageType: "True" } }, // the rot bypasses everything
    baseStats: makeStats({
      atk: 20,
      attackSpeed: 1.0,
      range: 155,
      skillPower: 1.8,
      maxHp: 170,
      manaOnHit: 13,
    }),
  }),

  // ============================ DEBUFF ============================
  t({
    id: "doro-mire-spirit",
    name: "Doro the Mire Spirit", // homage: swamp/mud yokai
    rarity: "Common",
    role: "debuff",
    target: "Ground",
    cost: 50,
    description:
      "A bog-dwelling sprite that drags enemies down into sucking mud. Smells of fresh rain and very old secrets.",
    meta: {
      homage: "swamp and mud yokai of old folklore",
      outfit: "A small bog-sprite formed of dripping mud and reeds with glowing marsh-light eyes",
      weapon: {
        family: "nature",
        display: "A mire conduit of sucking tar and grasping mud that drag foes down",
      },
    },
    passives: ["sticky-mud"],
    active: "tar-pit",
    behavior: { slow: { pct: 0.28, duration: 2 } },
    baseStats: makeStats({
      atk: 8,
      attackSpeed: 0.9,
      range: 125,
      maxHp: 110,
      manaOnHit: 10,
    }),
  }),
  t({
    id: "shika-shadowbinder",
    name: "Shika the Shadowbinder", // homage: Shikamaru Nara (Naruto)
    rarity: "Magic",
    role: "debuff",
    target: "Ground",
    cost: 85,
    description:
      "A brilliant, perpetually bored tactician who pins enemies in place with their own shadows. Ten steps ahead, half asleep.",
    meta: {
      homage: "Shikamaru Nara (Naruto)",
      outfit:
        "A green flak vest over a dark mesh uniform, hair tied in a spiky tail, perpetually half-asleep",
      weapon: {
        family: "shadow",
        display: "His own shadow, stretched out to stitch enemies in place",
      },
    },
    passives: ["shadow-bind", "two-hundred-iq"],
    active: "shadow-stitch",
    behavior: { stun: { duration: 0.8, chance: 0.3 }, slow: { pct: 0.2, duration: 1.5 } },
    baseStats: makeStats({
      atk: 12,
      attackSpeed: 0.9,
      range: 140,
      skillPower: 1.1,
      maxHp: 130,
      manaOnHit: 12,
    }),
  }),
  t({
    id: "glace-ice-maker",
    name: "Glace the Ice-Maker", // homage: ice-make mages (e.g., Gray, Fairy Tail)
    rarity: "Rare",
    role: "debuff",
    target: "Both",
    cost: 105,
    description:
      "A hot-headed mage who sculpts weapons from ice in an instant, chilling everything around him (and losing his shirt in the process).",
    meta: {
      homage: "ice-make mages such as Gray Fullbuster (Fairy Tail)",
      outfit:
        "A bare-chested ice mage in dark trousers with a silver necklace, frost rimming his fists",
      weapon: {
        family: "aura",
        element: "ice",
        display: "An ice conjurer's focus — weapons sculpted from ice in an instant",
      },
    },
    passives: ["ice-make", "freezing-touch"],
    active: "ice-geyser",
    behavior: { slow: { pct: 0.38, duration: 2.3 } },
    baseStats: makeStats({
      atk: 16,
      attackSpeed: 1.0,
      range: 145,
      skillPower: 1.3,
      maxHp: 140,
      manaOnHit: 12,
    }),
  }),
  t({
    id: "yuki-frostward-maiden",
    name: "Yuki the Frostward Maiden", // homage: ice-queen generals (e.g., Esdeath, Akame ga Kill)
    rarity: "Legendary",
    role: "debuff",
    target: "Both",
    cost: 155,
    description:
      "A glacial general who freezes time itself in a radius, slowing all who dare approach. Beautiful, merciless, and endlessly patient.",
    meta: {
      homage: "ice-queen generals such as Esdeath (Akame ga Kill)",
      outfit:
        "A glacial general's white-and-blue military coat with epaulettes and long ice-blue hair",
      weapon: {
        family: "sword",
        element: "ice",
        enchanted: true,
        display: "A rapier of conjured ice and a time-freezing aura",
      },
    },
    passives: ["deep-chill", "hoarfrost", "absolute-zero"],
    active: "blizzard",
    behavior: { slow: { pct: 0.5, duration: 3 }, stun: { duration: 0.6, chance: 0.2 } },
    baseStats: makeStats({
      atk: 22,
      attackSpeed: 1.0,
      range: 150,
      skillPower: 1.5,
      maxHp: 160,
      manaOnHit: 13,
    }),
  }),
  t({
    id: "garan-sandshackle",
    name: "Garan Sandshackle", // homage: Gaara (Naruto)
    rarity: "Unique",
    role: "debuff",
    target: "Ground",
    cost: 195,
    description:
      "A somber warden who entombs charging foes in crushing sand, holding the line alone where lesser defenders would break.",
    meta: {
      homage: "Gaara (Naruto)",
      outfit:
        "A sand-red robe with a great gourd strapped to the back, dark-rimmed sleepless eyes, somber and still",
      weapon: { family: "sand", display: "A living gourd of sand that entombs and crushes" },
    },
    passives: ["sand-armor", "iron-grip", "tailed-rage"],
    active: "sand-burial",
    behavior: {
      stun: { duration: 1.4, chance: 0.45 },
      slow: { pct: 0.3, duration: 2 },
      activeType: "True", // the burial crushes regardless of armor
    },
    baseStats: makeStats({
      atk: 30,
      attackSpeed: 0.9,
      range: 140,
      armorPen: 0.3,
      skillPower: 1.5,
      maxHp: 240,
      manaOnHit: 14,
    }),
  }),

  // ============================ SUPPORT ============================
  t({
    id: "mochi-morale-sprite",
    name: "Mochi the Morale Sprite", // homage: tiny cheer/mascot spirits
    rarity: "Common",
    role: "support",
    target: "Ground",
    cost: 50,
    description:
      "A round, squishy spirit that bounces between defenders shouting encouragement. Small lungs, enormous enthusiasm.",
    meta: {
      homage: "tiny cheer and mascot spirits",
      outfit: "A round, squishy white mochi-spirit with stubby arms and an unshakeable grin",
      weapon: { family: "charm", display: "Tiny cheer pom-poms and bottomless encouragement" },
    },
    passives: ["cheer"],
    active: "pep-talk",
    behavior: { buffAura: { radius: 120, atkPct: 0.08 } },
    baseStats: makeStats({ atk: 4, attackSpeed: 0.7, range: 100, maxHp: 130 }),
  }),
  t({
    id: "lyra-tempo",
    name: "Lyra Tempo", // homage: musician buffers (e.g., Brook, One Piece)
    rarity: "Magic",
    role: "support",
    target: "Both",
    cost: 90,
    description:
      "A traveling musician whose battle-rhythm quickens her comrades' hands. One more song before the encore, yohoho.",
    meta: {
      homage: "musician buffers such as Brook (One Piece)",
      outfit: "A traveling minstrel's frock coat and feathered hat, a violin tucked under one arm",
      weapon: {
        family: "instrument",
        display: "A battle-violin whose quickening rhythm hastens allies",
      },
    },
    passives: ["allegro"],
    active: "crescendo",
    behavior: { buffAura: { radius: 150, attackSpeedPct: 0.15 } },
    baseStats: makeStats({ atk: 8, attackSpeed: 0.8, range: 125, maxHp: 140 }),
  }),
  t({
    id: "orin-celestial-herald",
    name: "Orin the Celestial Herald", // homage: rejection/shield healers (e.g., Orihime, Bleach)
    rarity: "Rare",
    role: "support",
    target: "Both",
    cost: 115,
    description:
      "A kind-hearted herald whose fairy-blessing shelters her allies and sharpens their resolve in the same breath.",
    meta: {
      homage: "rejection/shield healers such as Orihime (Bleach)",
      outfit: "A gentle herald's white-and-gold dress with fairy-pin hairclips",
      weapon: { family: "charm", display: "Fairy-blessing shields and fate-rejecting wards" },
    },
    passives: ["blessing", "shun-shield"],
    active: "reject-fate",
    behavior: { buffAura: { radius: 150, atkPct: 0.12, attackSpeedPct: 0.08 } },
    baseStats: makeStats({ atk: 8, attackSpeed: 0.8, range: 135, maxHp: 160 }),
  }),
  t({
    id: "aldric-banner-bearer",
    name: "Aldric the Banner-Bearer", // homage: rallying commanders (e.g., Erwin Smith, AoT)
    rarity: "Legendary",
    role: "support",
    target: "Ground",
    cost: 160,
    description:
      "A grizzled commander whose war-cry steels the resolve of every ally in sight. Dedicate your hearts — and hold the wall.",
    meta: {
      homage: "rallying commanders such as Erwin Smith (Attack on Titan)",
      outfit: "A grizzled commander's tan military coat under a wing-crest cloak, one sleeve bound",
      weapon: {
        family: "banner",
        display: "A great war-banner raised high as a rallying standard",
      },
    },
    passives: ["rally", "vanguard", "last-charge"],
    active: "war-cry",
    behavior: { buffAura: { radius: 165, atkPct: 0.18, attackSpeedPct: 0.1 } },
    baseStats: makeStats({ atk: 10, attackSpeed: 0.8, range: 135, maxHp: 220 }),
  }),
  t({
    id: "senna-slug-sannin",
    name: "Senna the Slug Sannin", // homage: Tsunade (Naruto)
    rarity: "Unique",
    role: "support",
    target: "Both",
    cost: 200,
    description:
      "A legendary medic of monstrous strength who empowers an entire line at once. Gambles with everything but her comrades' lives.",
    meta: {
      homage: "Tsunade (Naruto)",
      outfit:
        "A grey-green haori over a sleeveless top, blonde hair in twin tails, a violet seal on the brow",
      weapon: {
        family: "fist",
        display: "Monstrous chakra-enhanced fists and master healing arts",
      },
    },
    passives: ["hundred-healings", "monster-strength", "sannin-resolve"],
    active: "creation-rebirth",
    behavior: { buffAura: { radius: 185, atkPct: 0.25, attackSpeedPct: 0.18 } },
    baseStats: makeStats({ atk: 16, attackSpeed: 0.8, range: 150, maxHp: 260 }),
  }),

  // ============================ TANKER ============================
  // Front-line bulwarks: lowest atk + slowest cadence, immense armor/HP. Their
  // payoff is a signature skill whose burst is fueled by their OWN defenses
  // (behavior.defenseScale) — the harder they are to break, the harder they hit.
  t({
    id: "riku-ironhide",
    name: "Riku the Ironhide", // homage: Kirishima / Red Riot (My Hero Academia) — Hardening
    rarity: "Common",
    role: "tanker",
    target: "Ground",
    cost: 60,
    description:
      "A big-hearted rookie who hardens his skin to iron and plants himself between danger and everyone behind him. Manliness above all.",
    meta: {
      homage: "Kirishima / Red Riot (My Hero Academia) — the Hardening tank",
      outfit:
        "A rugged red-trimmed guard's harness over hardened, jagged skin, spiked crimson hair",
      weapon: { family: "fist", display: "Iron-hardened fists and a shoulder-first body slam" },
    },
    passives: ["ironhide", "guts"],
    active: "ironhide-slam",
    behavior: { defenseScale: { armor: 1.2, maxHp: 0.05 } },
    baseStats: makeStats({
      range: 85,
      critRate: 0.05,
      armor: 18,
      magicResist: 12,
      damageReduction: 0.05,
      hpRegen: 4,
    }),
  }),
  t({
    id: "garrek-ironscale",
    name: "Garrek Ironscale", // homage: Gajeel / Iron Dragon Slayer (Fairy Tail)
    rarity: "Magic",
    role: "tanker",
    target: "Ground",
    cost: 80,
    description:
      "A surly drifter whose skin sheaths itself in dragon-iron scales. Picks fights, holds grudges, and never once steps back from the wall.",
    meta: {
      homage: "Gajeel / the Iron Dragon Slayer (Fairy Tail)",
      outfit: "A dark studded coat over iron-scaled skin, wild black mane and riveted brow",
      weapon: {
        family: "fist",
        enchanted: true,
        display: "Iron-scaled fists and a club-like dragon-iron forearm",
      },
    },
    passives: ["iron-scales", "counter-stance"],
    active: "scaleguard-crash",
    behavior: { defenseScale: { armor: 1.5, magicResist: 1.0, maxHp: 0.06 } },
    baseStats: makeStats({
      range: 90,
      critRate: 0.05,
      armor: 28,
      magicResist: 22,
      damageReduction: 0.06,
      hpRegen: 5,
    }),
  }),
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
