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
    damageType: "Physical",
    target: "Ground",
    cost: 45,
    description:
      "A tiny treant sprout that lashes passersby with barbed vines and grumbles, leaf by leaf, about trespassers on its patch.",
    meta: {
      homage: "wood/plant users such as the mokuton style (Naruto)",
      outfit: "A tiny treant body of bark and moss with a leaf-tuft crown and grumpy knothole eyes",
      weapon: "Barbed vines that lash and bleed trespassers",
    },
    passives: ["barbs"],
    active: "bramble",
    behavior: { dot: { dps: 7, duration: 3 } },
    baseStats: makeStats({
      atk: 8, attackSpeed: 1.0, range: 110, maxHp: 120, maxMana: 55, manaOnHit: 9, manaRegen: 1,
    }),
  }),
  t({
    id: "kona-ember-fox",
    name: "Kona the Ember Fox", // homage: nine-tailed fox spirits (e.g., Kurama, Naruto)
    rarity: "Magic",
    role: "dot",
    damageType: "Magic",
    target: "Both",
    cost: 80,
    description:
      "A nine-tailed fox-spirit wearing the shape of a girl, trailing foxfire that smolders in a wound long after the strike lands.",
    meta: {
      homage: "nine-tailed fox spirits such as Kurama (Naruto)",
      outfit: "A fox-girl in a red-and-white miko robe, nine ember-tipped tails fanning behind her",
      weapon: "Foxfire — clinging spirit flame that smolders in the wound",
    },
    passives: ["smolder", "foxfire"],
    active: "wildfire",
    behavior: { dot: { dps: 12, duration: 3.5 } },
    baseStats: makeStats({
      atk: 12, attackSpeed: 1.1, range: 140, skillPower: 1.2, maxHp: 110,
      maxMana: 70, manaOnHit: 11, manaRegen: 2,
    }),
  }),
  t({
    id: "shion-venom-priestess",
    name: "Shion the Venom Priestess", // homage: poison users (e.g., Shizuku, HxH)
    rarity: "Rare",
    role: "dot",
    damageType: "Magic",
    target: "Both",
    cost: 100,
    description:
      "A serene shrine-keeper who anoints her enemies with lingering toxins, murmuring soft prayers as they wither away.",
    meta: {
      homage: "poison users such as Shizuku (Hunter x Hunter)",
      outfit: "A serene shrine maiden's deep-violet robe with prayer beads and a veiled headdress",
      weapon: "Anointing toxins and venom-tipped prayer talismans",
    },
    passives: ["virulence", "lingering-toxin"],
    active: "plague-cloud",
    behavior: { dot: { dps: 16, duration: 4 } },
    baseStats: makeStats({
      atk: 14, attackSpeed: 1.0, range: 150, magicPen: 0.2, skillPower: 1.3,
      maxHp: 120, maxMana: 80, manaOnHit: 12, manaRegen: 2,
    }),
  }),
  t({
    id: "roan-flame-alchemist",
    name: "Roan the Flame Alchemist", // homage: Roy Mustang (Fullmetal Alchemist)
    rarity: "Legendary",
    role: "dot",
    damageType: "Magic",
    target: "Both",
    cost: 155,
    description:
      "A sharp-eyed officer who snaps his gloved fingers to set the very air alight, leaving foes to burn long after the spark.",
    meta: {
      homage: "Roy Mustang (Fullmetal Alchemist)",
      outfit: "A trim military officer's blue uniform under a long coat, ignition-cloth gloves on both hands",
      weapon: "Spark-cloth gloves that snap fire to life from the air itself",
    },
    passives: ["ignition", "pinpoint-flame", "ambition"],
    active: "inferno-snap",
    behavior: { dot: { dps: 24, duration: 4.5 } },
    baseStats: makeStats({
      atk: 18, attackSpeed: 1.0, range: 165, magicPen: 0.35, skillPower: 1.6,
      maxHp: 150, maxMana: 90, manaOnHit: 13, manaRegen: 2,
    }),
  }),
  t({
    id: "morren-plaguebearer",
    name: "Morren the Plaguebearer", // homage: decay/curse wielders (e.g., Mahito, JJK)
    rarity: "Unique",
    role: "dot",
    damageType: "Magic",
    target: "Both",
    cost: 200,
    description:
      "A hollow-eyed wanderer who carries rot in his very veins, spreading a black corruption that armor and ward alike fail to stop.",
    meta: {
      homage: "decay/curse wielders such as Mahito (Jujutsu Kaisen)",
      outfit: "A hollow-eyed wanderer's tattered grey cloak stained with rot, skin a patchwork of decay",
      weapon: "A bare touch that spreads unstoppable black decay",
    },
    passives: ["corrosion", "epidemic", "necrosis"],
    active: "black-rot",
    behavior: { dot: { dps: 30, duration: 5, damageType: "True" } }, // the rot bypasses everything
    baseStats: makeStats({
      atk: 20, attackSpeed: 1.0, range: 170, skillPower: 1.8, maxHp: 170,
      maxMana: 95, manaOnHit: 13, manaRegen: 2,
    }),
  }),

  // ============================ DEBUFF ============================
  t({
    id: "doro-mire-spirit",
    name: "Doro the Mire Spirit", // homage: swamp/mud yokai
    rarity: "Common",
    role: "debuff",
    damageType: "Magic",
    target: "Ground",
    cost: 50,
    description:
      "A bog-dwelling sprite that drags enemies down into sucking mud. Smells of fresh rain and very old secrets.",
    meta: {
      homage: "swamp and mud yokai of old folklore",
      outfit: "A small bog-sprite formed of dripping mud and reeds with glowing marsh-light eyes",
      weapon: "Sucking tar and grasping mud that drag foes down",
    },
    passives: ["sticky-mud"],
    active: "tar-pit",
    behavior: { slow: { pct: 0.28, duration: 2 } },
    baseStats: makeStats({
      atk: 8, attackSpeed: 0.9, range: 130, maxHp: 110, maxMana: 65, manaOnHit: 10, manaRegen: 1,
    }),
  }),
  t({
    id: "shika-shadowbinder",
    name: "Shika the Shadowbinder", // homage: Shikamaru Nara (Naruto)
    rarity: "Magic",
    role: "debuff",
    damageType: "Magic",
    target: "Ground",
    cost: 85,
    description:
      "A brilliant, perpetually bored tactician who pins enemies in place with their own shadows. Ten steps ahead, half asleep.",
    meta: {
      homage: "Shikamaru Nara (Naruto)",
      outfit: "A green flak vest over a dark mesh uniform, hair tied in a spiky tail, perpetually half-asleep",
      weapon: "His own shadow, stretched out to stitch enemies in place",
    },
    passives: ["shadow-bind", "two-hundred-iq"],
    active: "shadow-stitch",
    behavior: { stun: { duration: 0.8, chance: 0.3 }, slow: { pct: 0.2, duration: 1.5 } },
    baseStats: makeStats({
      atk: 12, attackSpeed: 0.9, range: 150, skillPower: 1.1, maxHp: 130,
      maxMana: 80, manaOnHit: 12, manaRegen: 2,
    }),
  }),
  t({
    id: "glace-ice-maker",
    name: "Glace the Ice-Maker", // homage: ice-make mages (e.g., Gray, Fairy Tail)
    rarity: "Rare",
    role: "debuff",
    damageType: "Magic",
    target: "Both",
    cost: 105,
    description:
      "A hot-headed mage who sculpts weapons from ice in an instant, chilling everything around him (and losing his shirt in the process).",
    meta: {
      homage: "ice-make mages such as Gray Fullbuster (Fairy Tail)",
      outfit: "A bare-chested ice mage in dark trousers with a silver necklace, frost rimming his fists",
      weapon: "Ice-Make — weapons sculpted from ice in an instant",
    },
    passives: ["ice-make", "freezing-touch"],
    active: "ice-geyser",
    behavior: { slow: { pct: 0.38, duration: 2.3 } },
    baseStats: makeStats({
      atk: 16, attackSpeed: 1.0, range: 155, skillPower: 1.3, maxHp: 140,
      maxMana: 80, manaOnHit: 12, manaRegen: 2,
    }),
  }),
  t({
    id: "yuki-frostward-maiden",
    name: "Yuki the Frostward Maiden", // homage: ice-queen generals (e.g., Esdeath, Akame ga Kill)
    rarity: "Legendary",
    role: "debuff",
    damageType: "Magic",
    target: "Both",
    cost: 155,
    description:
      "A glacial general who freezes time itself in a radius, slowing all who dare approach. Beautiful, merciless, and endlessly patient.",
    meta: {
      homage: "ice-queen generals such as Esdeath (Akame ga Kill)",
      outfit: "A glacial general's white-and-blue military coat with epaulettes and long ice-blue hair",
      weapon: "A rapier of conjured ice and a time-freezing aura",
    },
    passives: ["deep-chill", "hoarfrost", "absolute-zero"],
    active: "blizzard",
    behavior: { slow: { pct: 0.5, duration: 3 }, stun: { duration: 0.6, chance: 0.2 } },
    baseStats: makeStats({
      atk: 22, attackSpeed: 1.0, range: 165, skillPower: 1.5, maxHp: 160,
      maxMana: 85, manaOnHit: 13, manaRegen: 2,
    }),
  }),
  t({
    id: "garan-sandshackle",
    name: "Garan Sandshackle", // homage: Gaara (Naruto)
    rarity: "Unique",
    role: "debuff",
    damageType: "Physical",
    target: "Ground",
    cost: 195,
    description:
      "A somber warden who entombs charging foes in crushing sand, holding the line alone where lesser defenders would break.",
    meta: {
      homage: "Gaara (Naruto)",
      outfit: "A sand-red robe with a great gourd strapped to the back, dark-rimmed sleepless eyes, somber and still",
      weapon: "A living gourd of sand that entombs and crushes",
    },
    passives: ["sand-armor", "iron-grip", "tailed-rage"],
    active: "sand-burial",
    behavior: {
      stun: { duration: 1.4, chance: 0.45 },
      slow: { pct: 0.3, duration: 2 },
      activeType: "True", // the burial crushes regardless of armor
    },
    baseStats: makeStats({
      atk: 30, attackSpeed: 0.9, range: 150, armorPen: 0.3, skillPower: 1.5, maxHp: 240,
      maxMana: 95, manaOnHit: 14, manaRegen: 1,
    }),
  }),

  // ============================ SUPPORT ============================
  t({
    id: "mochi-morale-sprite",
    name: "Mochi the Morale Sprite", // homage: tiny cheer/mascot spirits
    rarity: "Common",
    role: "support",
    damageType: "Magic",
    target: "Ground",
    cost: 50,
    description:
      "A round, squishy spirit that bounces between defenders shouting encouragement. Small lungs, enormous enthusiasm.",
    meta: {
      homage: "tiny cheer and mascot spirits",
      outfit: "A round, squishy white mochi-spirit with stubby arms and an unshakeable grin",
      weapon: "Tiny cheer pom-poms and bottomless encouragement",
    },
    passives: ["cheer"],
    active: "pep-talk",
    behavior: { buffAura: { radius: 120, atkPct: 0.08 } },
    baseStats: makeStats({ atk: 4, attackSpeed: 0.7, range: 100, maxHp: 130, maxMana: 0 }),
  }),
  t({
    id: "lyra-tempo",
    name: "Lyra Tempo", // homage: musician buffers (e.g., Brook, One Piece)
    rarity: "Magic",
    role: "support",
    damageType: "Magic",
    target: "Both",
    cost: 90,
    description:
      "A traveling musician whose battle-rhythm quickens her comrades' hands. One more song before the encore, yohoho.",
    meta: {
      homage: "musician buffers such as Brook (One Piece)",
      outfit: "A traveling minstrel's frock coat and feathered hat, a violin tucked under one arm",
      weapon: "A battle-violin whose quickening rhythm hastens allies",
    },
    passives: ["allegro"],
    active: "crescendo",
    behavior: { buffAura: { radius: 150, attackSpeedPct: 0.15 } },
    baseStats: makeStats({ atk: 8, attackSpeed: 0.8, range: 130, maxHp: 140, maxMana: 0 }),
  }),
  t({
    id: "orin-celestial-herald",
    name: "Orin the Celestial Herald", // homage: rejection/shield healers (e.g., Orihime, Bleach)
    rarity: "Rare",
    role: "support",
    damageType: "Magic",
    target: "Both",
    cost: 115,
    description:
      "A kind-hearted herald whose fairy-blessing shelters her allies and sharpens their resolve in the same breath.",
    meta: {
      homage: "rejection/shield healers such as Orihime (Bleach)",
      outfit: "A gentle herald's white-and-gold dress with fairy-pin hairclips",
      weapon: "Fairy-blessing shields and fate-rejecting wards",
    },
    passives: ["blessing", "shun-shield"],
    active: "reject-fate",
    behavior: { buffAura: { radius: 150, atkPct: 0.12, attackSpeedPct: 0.08 } },
    baseStats: makeStats({ atk: 8, attackSpeed: 0.8, range: 140, maxHp: 160, maxMana: 0 }),
  }),
  t({
    id: "aldric-banner-bearer",
    name: "Aldric the Banner-Bearer", // homage: rallying commanders (e.g., Erwin Smith, AoT)
    rarity: "Legendary",
    role: "support",
    damageType: "Physical",
    target: "Ground",
    cost: 160,
    description:
      "A grizzled commander whose war-cry steels the resolve of every ally in sight. Dedicate your hearts — and hold the wall.",
    meta: {
      homage: "rallying commanders such as Erwin Smith (Attack on Titan)",
      outfit: "A grizzled commander's tan military coat under a wing-crest cloak, one sleeve bound",
      weapon: "A great war-banner raised high as a rallying standard",
    },
    passives: ["rally", "vanguard", "last-charge"],
    active: "war-cry",
    behavior: { buffAura: { radius: 165, atkPct: 0.18, attackSpeedPct: 0.1 } },
    baseStats: makeStats({ atk: 10, attackSpeed: 0.8, range: 140, maxHp: 220, maxMana: 0 }),
  }),
  t({
    id: "senna-slug-sannin",
    name: "Senna the Slug Sannin", // homage: Tsunade (Naruto)
    rarity: "Unique",
    role: "support",
    damageType: "Physical",
    target: "Both",
    cost: 200,
    description:
      "A legendary medic of monstrous strength who empowers an entire line at once. Gambles with everything but her comrades' lives.",
    meta: {
      homage: "Tsunade (Naruto)",
      outfit: "A grey-green haori over a sleeveless top, blonde hair in twin tails, a violet seal on the brow",
      weapon: "Monstrous chakra-enhanced fists and master healing arts",
    },
    passives: ["hundred-healings", "monster-strength", "sannin-resolve"],
    active: "creation-rebirth",
    behavior: { buffAura: { radius: 185, atkPct: 0.25, attackSpeedPct: 0.18 } },
    baseStats: makeStats({ atk: 16, attackSpeed: 0.8, range: 160, maxHp: 260, maxMana: 0 }),
  }),
];
