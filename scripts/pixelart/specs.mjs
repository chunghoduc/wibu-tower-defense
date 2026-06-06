// Per-character design descriptors. Each evokes the OUTLOOK of its anime-homage
// source (hair, outfit colour, weapon, signature prop) without copying it —
// matching the project's "inspired by, never copying" rule.

const BLACK = "#201a26", DKBROWN = "#5a3a22", BROWN = "#7a4a28", BLOND = "#e8c860";
const WHITE = "#e8eef4", SILVER = "#cfd8e2", GREEN = "#357a3a", BLUE = "#3a6ad0";
const YELLOW = "#f5d24a", ORANGE = "#e8902a", RED = "#c0392b", PURPLE = "#7a4a9a";
const SKIN = "#f0c49a", PALE = "#f6dcc0", TAN = "#d8a878";

export const CHARACTERS = {
  // ---------------- DAMAGE ----------------
  "yamo-desert-bandit": { rarity: "Common", skin: TAN, hair: "spiky", hairColor: BLACK, scar: true,
    outfit: "#d8a85a", outfitStyle: "gi", belt: "#7a3a2a", pants: "#9a6a2a", weapon: "fists" },
  "kazu-spirit-brawler": { rarity: "Magic", skin: SKIN, hair: "pompadour", hairColor: "#d98a2a",
    outfit: "#36507a", outfitStyle: "coat", pants: BLACK, weapon: "katana", hiltColor: "#2a6acc",
    orbColor: "#7ad1ff" },
  "zoran-thricedraw": { rarity: "Rare", skin: SKIN, hair: "short", hairColor: GREEN, headgear: "bandana",
    bandanaColor: GREEN, scar: true, outfit: "#2a4a2a", outfitStyle: "coat", sash: "#1f7a3a",
    pants: "#26302a", weapon: "katana3" },
  "prince-vael": { rarity: "Legendary", skin: SKIN, hair: "widowsPeak", hairColor: BLACK,
    outfit: "#3a6ad0", outfitStyle: "armor", trim: "#e8eef4", pants: "#2a2a3a", weapon: "fists",
    fistGlow: "#9ad8ff" },
  "karu-sunfist": { rarity: "Unique", skin: SKIN, hair: "spikyTall", hairColor: BLACK,
    outfit: ORANGE, outfitStyle: "gi", belt: "#2a3a8a", pants: ORANGE, weapon: "fists",
    fistGlow: "#ffd86a" },
  "jugo-limitless": { rarity: "Unique", skin: PALE, hair: "spiky", hairColor: WHITE, blindfold: true,
    outfit: "#22242e", outfitStyle: "coat", pants: BLACK, weapon: "fists", fistGlow: "#7aa6ff" },
  "sota-caped-fist": { rarity: "Unique", skin: SKIN, hair: "bald", outfit: "#f2cf2a", outfitStyle: "gi",
    belt: WHITE, pants: "#f2cf2a", back: "cape", capeColor: "#e8e8ee", weapon: "fists" },

  // ---------------- SPLASH ----------------
  "pip-powderkeg": { rarity: "Common", skin: SKIN, hair: "short", hairColor: BROWN, headgear: "witchHat",
    hatColor: "#3a2a4a", outfit: "#5a4a6a", outfitStyle: "robe", trim: "#caa84a", pants: BLACK, weapon: "staff",
    orbColor: "#ff9a4a" },
  "iron-bo-cannonarm": { rarity: "Magic", skin: TAN, hair: "pompadour", hairColor: "#3a9ad0", broad: true,
    outfit: "#5a6275", outfitStyle: "armor", trim: "#2f6fdb", pants: "#2a3550", weapon: "cannon",
    orbColor: "#2f6fdb" },
  "kanae-petalfall": { rarity: "Rare", skin: PALE, hair: "long", hairColor: "#3a2a3a",
    outfit: "#d56a8a", outfitStyle: "robe", trim: "#e8b0c4", pants: "#7a4a5a", weapon: "katana",
    hiltColor: "#7ac0a0" },
  "akagan-ashen": { rarity: "Legendary", skin: TAN, hair: "short", hairColor: "#3a3a3a",
    outfit: "#7a2a2a", outfitStyle: "coat", trim: "#caa84a", pants: BLACK, weapon: "fists",
    fistGlow: "#ff6a2a" },
  "megu-explosion-sage": { rarity: "Unique", skin: PALE, hair: "long", hairColor: BROWN, headgear: "witchHat",
    hatColor: "#241a30", eyepatch: true, outfit: "#3a2a4a", outfitStyle: "robe", trim: "#d23b3b",
    back: "cape", capeColor: "#2a1a2a", pants: BLACK, weapon: "staff", orbColor: "#ff5a3a" },

  // ---------------- CHAIN ----------------
  "tobi-skipstone": { rarity: "Common", skin: SKIN, hair: "spiky", hairColor: DKBROWN, headgear: "headband",
    bandColor: "#3a4a8a", outfit: "#3a6a8a", outfitStyle: "coat", sash: "#caa84a", pants: "#2a3a4a",
    weapon: "fists" },
  "zeni-spark": { rarity: "Magic", skin: SKIN, hair: "short", hairColor: YELLOW, faceMark: "#d23b3b",
    outfit: "#e08a3a", outfitStyle: "robe", trim: WHITE, pants: "#8a5a2a", weapon: "katana",
    hiltColor: "#e8c84a" },
  "hyo-frost-arc": { rarity: "Rare", skin: PALE, hair: "spiky", hairColor: WHITE,
    outfit: "#26303a", outfitStyle: "coat", trim: WHITE, pants: BLACK, weapon: "katana",
    hiltColor: "#7ad1ff", orbColor: "#bfeaff" },
  "kilo-lightning-hand": { rarity: "Legendary", skin: SKIN, hair: "spiky", hairColor: SILVER,
    outfit: "#3a6ad0", outfitStyle: "coat", pants: "#2a3550", weapon: "fists", fistGlow: "#bfe8ff" },
  "sasu-stormblade": { rarity: "Unique", skin: PALE, hair: "spiky", hairColor: "#2a2e44", eye: "#d23b3b",
    outfit: "#23283a", outfitStyle: "coat", trim: "#5a6aa0", pants: BLACK, weapon: "katana",
    hiltColor: "#3a3a4a" },

  // ---------------- DOT ----------------
  "bram-thornling": { rarity: "Common", skin: "#cdbb90", hair: "short", hairColor: "#4a6a2a",
    outfit: "#4a6a3a", outfitStyle: "robe", trim: "#8aae5a", pants: "#3a4a2a", weapon: "spear" },
  "kona-ember-fox": { rarity: "Magic", skin: SKIN, hair: "flame", hairColor: ORANGE, headgear: "horns",
    hornColor: ORANGE, back: "tails", tailColor: ORANGE, faceMark: "#b15a2a", outfit: "#b85a2a",
    outfitStyle: "robe", trim: YELLOW, pants: "#7a3a1a", weapon: "fists", fistGlow: "#ff9a4a" },
  "shion-venom-priestess": { rarity: "Rare", skin: "#c9b6d0", headgear: "hood", hoodColor: "#3c2f52",
    hairColor: PURPLE, outfit: "#46386a", outfitStyle: "robe", trim: "#8ad14a", pants: "#2e2440",
    weapon: "staff", orbColor: "#8ad14a", eye: "#8ad14a" },
  "roan-flame-alchemist": { rarity: "Legendary", skin: SKIN, hair: "short", hairColor: BLACK,
    outfit: "#2a3a6a", outfitStyle: "coat", trim: "#caa84a", pants: "#1f2a4a", weapon: "fists",
    fistGlow: "#ff7a2a" },
  "morren-plaguebearer": { rarity: "Unique", skin: "#cbbfae", hair: "short", hairColor: "#8a8a9a",
    faceMark: "#5a6a8a", outfit: "#5a6a7a", outfitStyle: "robe", trim: "#3a4a5a", pants: "#3a3a4a",
    weapon: "fists", fistGlow: "#9ad14a" },

  // ---------------- DEBUFF ----------------
  "doro-mire-spirit": { rarity: "Common", skin: "#8fae6a", hair: "bald", eye: "#e8d24a",
    outfit: "#5a6a3a", outfitStyle: "robe", trim: "#3a4a2a", pants: "#3a4a2a" },
  "shika-shadowbinder": { rarity: "Magic", skin: TAN, hair: "ponytail", hairColor: BLACK,
    outfit: "#3a5a4a", outfitStyle: "armor", trim: "#7a8a6a", pants: "#2a3a2a", weapon: "fists" },
  "glace-ice-maker": { rarity: "Rare", skin: SKIN, hair: "spiky", hairColor: "#2a2e44",
    outfit: "#2a3a5a", outfitStyle: "coat", trim: "#bfeaff", pants: "#1f2a3a", weapon: "fists",
    fistGlow: "#bfeaff", emblem: "#bfeaff" },
  "yuki-frostward-maiden": { rarity: "Legendary", skin: PALE, hair: "long", hairColor: "#7ac0e8",
    outfit: "#dfe9f5", outfitStyle: "coat", trim: "#7ad1ff", pants: "#aac4e0", weapon: "staff",
    orbColor: "#bfeaff" },
  "garan-sandshackle": { rarity: "Unique", skin: TAN, hair: "spiky", hairColor: "#b5302a", back: "gourd",
    faceMark: "#3a2a2a", eye: "#7ad1c0", outfit: "#9a5a3a", outfitStyle: "robe", trim: "#c8a06a",
    pants: "#6a3a2a" },

  // ---------------- SUPPORT ----------------
  "mochi-morale-sprite": { rarity: "Common", skin: "#ffe0d0", hair: "bowl", hairColor: "#ffb6c1",
    outfit: "#ffd1e0", outfitStyle: "robe", trim: WHITE, pants: "#f0a0c0", weapon: "fists" },
  "lyra-tempo": { rarity: "Magic", skin: SKIN, hair: "mohawk", hairColor: "#2a2030",
    outfit: "#3a2a4a", outfitStyle: "coat", trim: "#caa84a", pants: BLACK, weapon: "fan",
    fanColor: "#8a5a2a" },
  "orin-celestial-herald": { rarity: "Rare", skin: PALE, hair: "long", hairColor: "#e8902a", headgear: "halo",
    outfit: "#5a7ad0", outfitStyle: "robe", trim: WHITE, pants: "#3a5a9a", weapon: "fists" },
  "aldric-banner-bearer": { rarity: "Legendary", skin: SKIN, hair: "short", hairColor: BLOND,
    outfit: "#6a5a3a", outfitStyle: "coat", trim: "#caa84a", pants: "#4a3a2a", back: "banner",
    bannerColor: "#caa84a" },
  "senna-slug-sannin": { rarity: "Unique", skin: PALE, hair: "twin", hairColor: BLOND, faceMark: "#7ac0a0",
    outfit: "#4a7a4a", outfitStyle: "robe", trim: "#caa84a", pants: "#7a9a7a", weapon: "fists" },
};

// Hero — the player's RPG warrior (balanced knight).
export const HERO = { rarity: "Legendary", skin: SKIN, hair: "short", hairColor: BROWN,
  headgear: "helm", helmColor: "#c0cbd8", plume: "#d23b3b", outfit: "#8a96a8", outfitStyle: "armor",
  trim: "#caa84a", pants: "#3a4258", weapon: "broadsword" };

// Bosses — animated rig descriptors (homage-inspired looks), rendered larger.
export const BOSSES = {
  champion: { rarity: "Legendary", skin: "#cfcad0", headgear: "helm", helmColor: "#8a8f9c", plume: "#caa84a",
    outfit: "#8a8f9c", outfitStyle: "armor", trim: "#caa84a", pants: "#3a3f4c", weapon: "broadsword", eye: "#d23b3b" },
  warden: { rarity: "Legendary", skin: "#b0b4bc", headgear: "helm", helmColor: "#5a6070", plume: "#9aa6b8",
    outfit: "#5a6070", outfitStyle: "armor", trim: "#9aa6b8", pants: "#2a3038", weapon: "broadsword", eye: "#bfe8ff" },
  overlord: { rarity: "Unique", skin: "#7a6a8a", headgear: "hood", hoodColor: "#2a1a3a", hairColor: "#3a2a4a",
    outfit: "#3a2a4a", outfitStyle: "robe", trim: "#b07ad8", back: "cape", capeColor: "#2a1a3a", weapon: "staff", orbColor: "#c77dde", eye: "#ff5a5a" },
  zabro: { rarity: "Legendary", skin: "#dfe3ea", headgear: "headband", bandColor: "#3a4a66", hair: "spiky", hairColor: "#2a2e3a",
    outfit: "#3a4a66", outfitStyle: "coat", trim: "#8a98b4", pants: "#2a3040", weapon: "katana", eye: "#1b2a4a" },
  ryomen: { rarity: "Unique", skin: "#e8c0a0", hair: "spiky", hairColor: "#e8e2e8", headgear: "horns", hornColor: "#1b1b26",
    outfit: "#7a2a3a", outfitStyle: "robe", trim: "#1b1b26", faceMark: "#7a2a3a", pants: "#4a1f28", weapon: "fists", fistGlow: "#d23b3b", eye: "#d23b3b" },
  kura: { rarity: "Legendary", skin: "#e8902a", hair: "flame", hairColor: "#e8902a", headgear: "horns", hornColor: "#e8902a",
    outfit: "#b85a2a", outfitStyle: "robe", trim: "#ffd24a", back: "tails", tailColor: "#e8902a", faceMark: "#b15a2a", pants: "#7a3a1a", weapon: "fists", fistGlow: "#ff9a4a", eye: "#ffd24a" },
  akai: { rarity: "Legendary", skin: "#c89a7a", hair: "short", hairColor: "#3a3a3a",
    outfit: "#7a2424", outfitStyle: "coat", trim: "#ff7a2a", pants: "#3a1818", weapon: "fists", fistGlow: "#ff6a2a", eye: "#ff6a2a" },
  mukade: { rarity: "Unique", skin: "#9aae8a", hair: "short", hairColor: "#6a7a5a", faceMark: "#5a6a4a",
    outfit: "#4a5a4a", outfitStyle: "robe", trim: "#7a8a6a", pants: "#3a4a3a", weapon: "fists", fistGlow: "#9ad14a", eye: "#cfe87a" },
  madarok: { rarity: "Unique", skin: "#d8d0d8", hair: "long", hairColor: "#1b1b26",
    outfit: "#6a1f2a", outfitStyle: "armor", trim: "#3a2a3a", back: "cape", capeColor: "#3a1f28", weapon: "fan", fanColor: "#b07ad8", eye: "#d23b3b" },
  meruon: { rarity: "Unique", skin: "#b07ad8", headgear: "horns", hornColor: "#ffd24a", hairColor: "#5a2a7a",
    outfit: "#4a2a6a", outfitStyle: "armor", trim: "#ffd24a", back: "cape", capeColor: "#2a1a3a", weapon: "fists", fistGlow: "#fff3a0", eye: "#fff3a0" },
};
