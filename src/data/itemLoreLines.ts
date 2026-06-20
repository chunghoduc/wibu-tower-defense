/**
 * Generated item-line homages — one homage per line; all rarity tiers of a line
 * share it. Keyed by line id; each carries a `base` (homage base name, rendered
 * with the rarity prefix by the catalog). See `itemLore.ts` for the resolver.
 */
import type { ItemLoreEntry } from "./itemLore.ts";

export const ITEM_LORE_LINES: Record<string, ItemLoreEntry> = {
  warblade: {
    base: "Hollowmoon Cleaver",
    appearance: {
      family: "greatblade",
      material: { tint: "#d8dde6", accent: "#1c2740" },
      look: "an oversized cleaver-style longsword with a dark blade-spine, no crossguard, and a bandage-wrapped grip",
    },
    homage: { source: "Bleach", original: "Zangetsu" },
    specialty: "A soul-cutter — its true power is released, not merely drawn.",
    lore: "Bandaged steel that hums for the wielder who can hear it.",
  },
  longbow: {
    base: "Spiritbone Longbow",
    appearance: {
      family: "bow",
      material: { tint: "#8a6a3a", accent: "#e8d8a0" },
      look: "a tall recurve longbow of pale spirit-bone with a faintly glowing drawn string",
    },
    homage: { source: "Fate/stay night", original: "the Archer's bow" },
    specialty: "Rewards a fast hand — the steadier the draw, the faster the loose.",
    lore: "Traced from a memory of a weapon, not a tree.",
  },
  "wizard-staff": {
    base: "Crimson Caster Staff",
    appearance: {
      family: "staff",
      material: { tint: "#6a4a8a", accent: "#d23b3b" },
      look: "a dark wooden caster's staff crowned with a crimson explosion-gem wreathed in embers",
    },
    homage: { source: "KonoSuba", original: "the explosion mage's staff" },
    specialty: "Channels overwhelming spell-power into a single decisive blast.",
    lore: "It only knows one trick, but oh, what a trick.",
  },
  "hand-cannon": {
    base: "Stampede Sidearm",
    appearance: {
      family: "firearm",
      material: { tint: "#b8c0cc", accent: "#d9a441" },
      look: "a long silver revolver with an engraved barrel and a worn wooden grip",
    },
    homage: { source: "Trigun", original: "the gunman's silver revolver" },
    specialty: "A peacemaker's aim — punches straight through plate.",
    lore: "Carried by someone who would rather not use it.",
  },
  grimoire: {
    base: "Clovermark Grimoire",
    appearance: {
      family: "tome",
      material: { tint: "#2a3550", accent: "#6ee06e" },
      look: "a thick leather spellbook clasped shut, a green clover sigil embossed on the cover",
    },
    homage: { source: "Black Clover", original: "a grimoire" },
    specialty: "Its pages turn raw mana into towering spell-power.",
    lore: "The sigil is said to decide its own master.",
  },
  "war-fists": {
    base: "Symbol Knuckles",
    appearance: {
      family: "gauntlet",
      material: { tint: "#c8ccd2", accent: "#ffd24a" },
      look: "a pair of heavy steel knuckle gauntlets with golden plating across the knuckles",
    },
    homage: { source: "My Hero Academia", original: "the Symbol of Peace's gauntleted strikes" },
    specialty: "Built to land that one heroic, crowd-clearing punch.",
    lore: "Worn by those who smile while they save you.",
  },
  warhelm: {
    base: "Slayer's Steel Helm",
    appearance: {
      family: "helm",
      material: { tint: "#aeb6c2", accent: "#6a7686" },
      look: "a full steel barbute helm with a narrow T-visor and a riveted brow",
    },
    homage: { source: "Goblin Slayer", original: "the iron helm" },
    specialty: "Never comes off in a fight — and the fight never reaches the head.",
    lore: "The face beneath is a rumor.",
  },
  "mage-cowl": {
    base: "Arcanist's Cowl",
    appearance: {
      family: "helm",
      material: { tint: "#3a4a6a", accent: "#c9b8ff" },
      look: "a deep arcanist's hood of midnight cloth trimmed with faint silver runes",
    },
    homage: { source: "Frieren: Beyond Journey's End", original: "a mage apprentice's hood" },
    specialty: "Focuses a scattered mind into clean, potent casting.",
    lore: "Shadow over the eyes; clarity behind them.",
  },
  platemail: {
    base: "Claymore Plate",
    appearance: {
      family: "chestplate",
      material: { tint: "#b6bcc6", accent: "#8a93a0" },
      look: "a heavy layered steel cuirass with broad angular pauldrons",
    },
    homage: { source: "Claymore", original: "a Claymore's armor" },
    specialty: "Walls of steel — armor that simply does not give.",
    lore: "Issued to those sent where no one returns.",
  },
  "battle-robe": {
    base: "Sage Battle Robe",
    appearance: {
      family: "robe",
      material: { tint: "#c2873a", accent: "#e8c84a" },
      look: "a sage's open battle robe with wide sleeves, red trim, and a thick rope sash",
    },
    homage: { source: "Naruto", original: "the Sage's haori" },
    specialty: "Turns hostile magic aside while feeding the wearer's own.",
    lore: "Embroidered by a master who never wore it into battle.",
  },
  brigandine: {
    base: "Einherjar Brigandine",
    appearance: {
      family: "chestplate",
      material: { tint: "#6a5a3a", accent: "#9a8a5a" },
      look: "a riveted leather-and-iron brigandine worn over a coarse wool tunic",
    },
    homage: { source: "Vinland Saga", original: "a raider's mail" },
    specialty: "Rugged plating that trades grace for raw staying power.",
    lore: "It has seen more winters than most men.",
  },
  "battle-gloves": {
    base: "Brawler's Wraps",
    appearance: {
      family: "gloves",
      material: { tint: "#4a8a6a", accent: "#d8dde6" },
      look: "a pair of green fingerless hand-wraps reinforced with studded leather over the knuckles",
    },
    homage: { source: "Hunter x Hunter", original: "a young fighter's gloves" },
    specialty: "Loads every hit with extra crushing force.",
    lore: "Re-taped after every fight, never replaced.",
  },
  "swift-gloves": {
    base: "Godspeed Gloves",
    appearance: {
      family: "gloves",
      material: { tint: "#4aa0d8", accent: "#eaf6ff" },
      look: "slim pale-blue gloves crackling faintly with white lightning at the fingertips",
    },
    homage: { source: "Hunter x Hunter", original: "the lightning-fast assassin's hands" },
    specialty: "Hands move on their own — attacks blur together.",
    lore: "Faster than the eye, almost faster than the wearer.",
  },
  "assassin-mitts": {
    base: "Shadowfang Mitts",
    appearance: {
      family: "gloves",
      material: { tint: "#2a2a36", accent: "#d23b3b" },
      look: "tight black assassin's mitts with a thin red blade tucked along each forearm",
    },
    homage: { source: "Akame ga Kill!", original: "a night-raider's blades" },
    specialty: "Finds the gap — turns precise hits into lethal ones.",
    lore: "Quiet work, quietly done.",
  },
  striders: {
    base: "Shinobi Striders",
    appearance: {
      family: "boots",
      material: { tint: "#2a3550", accent: "#d8dde6" },
      look: "open-toed dark shinobi sandals with bound shin-wraps",
    },
    homage: { source: "Naruto", original: "ninja sandals" },
    specialty: "Light and sure — pure, untiring speed.",
    lore: "They leave no print worth following.",
  },
  "war-boots": {
    base: "Vanguard War Boots",
    appearance: {
      family: "boots",
      material: { tint: "#5a5a64", accent: "#aeb6c2" },
      look: "sturdy grey armored marching boots with steel toe-caps and harness straps",
    },
    homage: { source: "Attack on Titan", original: "the maneuver-gear boots" },
    specialty: "Planted and protected — speed that doesn't sacrifice footing.",
    lore: "Built for those who charge the wall first.",
  },
  "plate-legguards": {
    base: "Bulwark Legplates",
    appearance: {
      family: "pants",
      material: { tint: "#b6bcc6", accent: "#8a93a0" },
      look: "a pair of heavy steel leg plates — articulated cuisses and knee guards over dark padded trousers",
    },
    homage: { source: "Berserk", original: "a knight's greaves" },
    specialty: "Plated from hip to knee — the lower body simply will not fall.",
    lore: "Dented a thousand times, broken never.",
  },
  "war-greaves": {
    base: "Vanguard Warplate Legs",
    appearance: {
      family: "pants",
      material: { tint: "#5a5a64", accent: "#aeb6c2" },
      look: "rugged grey armored war-trousers with riveted thigh plates and harness straps",
    },
    homage: { source: "Attack on Titan", original: "the maneuver-gear leg harness" },
    specialty: "Braced legs that anchor a charge and shrug off the counter-blow.",
    lore: "First over the wall, last to buckle.",
  },
  "swift-leggings": {
    base: "Gale Runner Leggings",
    appearance: {
      family: "pants",
      material: { tint: "#2a3550", accent: "#9fd8ff" },
      look: "slim dark-blue running leggings with light shin-wraps trailing faint wind streaks",
    },
    homage: { source: "Naruto", original: "a shinobi's leg-wraps" },
    specialty: "Featherlight wraps that turn every stride into open ground.",
    lore: "They leave no print worth following.",
  },
  "mage-trousers": {
    base: "Arcanist's Trousers",
    appearance: {
      family: "pants",
      material: { tint: "#3a4a6a", accent: "#c9b8ff" },
      look: "deep midnight-blue mage robes-trousers trimmed with faint silver runes down each leg",
    },
    homage: { source: "Frieren: Beyond Journey's End", original: "a mage's lower robes" },
    specialty: "Runed cloth that turns hostile magic aside.",
    lore: "The runes warm faintly before a spell lands.",
  },
  "mana-talisman": {
    base: "Spirit Ward Talisman",
    appearance: {
      family: "amulet",
      material: { tint: "#caa84a", accent: "#6ee0e0" },
      look: "a folded paper-and-gold spirit ward wrapped around a glowing teal bead",
    },
    homage: { source: "Yu Yu Hakusho", original: "a spirit ward (ofuda)" },
    specialty: "A deep mana reservoir the wearer can draw on at will.",
    lore: "The ink shifts when spirits are near.",
  },
  "focus-gem": {
    base: "Soul Focus Gem",
    appearance: {
      family: "amulet",
      material: { tint: "#caa84a", accent: "#f6d24a" },
      look: "a small round soul-gem of pale gold light set in a thin gold ring on a chain",
    },
    homage: { source: "Puella Magi Madoka Magica", original: "a Soul Gem" },
    specialty: "Concentrates the wearer's will into sharper spellcraft.",
    lore: "Hold it to the light and you can see something move inside.",
  },
  "pierce-pendant": {
    base: "Piercer's Pendant",
    appearance: {
      family: "amulet",
      material: { tint: "#caa84a", accent: "#cfd6e2" },
      look: "a slender needle-shaped silver pendant hanging from a fine chain",
    },
    homage: { source: "Hellsing", original: "a blessed silver charm" },
    specialty: "Hones spells to slip past magical resistance.",
    lore: "Thin as a whisper, sharp as a verdict.",
  },
  "blood-ring": {
    base: "Crimson Thirst Ring",
    appearance: {
      family: "ring",
      material: { tint: "#6a1a1a", accent: "#d23b3b" },
      look: "a dark iron ring set with a deep crimson blood-garnet",
    },
    homage: { source: "Hellsing", original: "the no-life king's hunger" },
    specialty: "Drains life from every wound it deals back to the wielder.",
    lore: "The garnet is never quite full.",
  },
  "fortune-ring": {
    base: "Pirate's Fortune Ring",
    appearance: {
      family: "ring",
      material: { tint: "#caa84a", accent: "#f5d870" },
      look: "a fat gold signet ring stamped with a coin-and-skull emblem",
    },
    homage: { source: "One Piece", original: "a treasure-hunter's spoils" },
    specialty: "Sniffs out coin — fattens every payout.",
    lore: "Worn by someone chasing a far greater fortune.",
  },
  "precision-ring": {
    base: "Hawk-Eye Band",
    appearance: {
      family: "ring",
      material: { tint: "#2a3550", accent: "#6ee06e" },
      look: "a slender dark band set with a single green hawk-eye stone",
    },
    homage: { source: "One Piece", original: "the greatest swordsman's gaze" },
    specialty: "Steadies the aim so strikes land on the weak point.",
    lore: "Its stone never blinks.",
  },
  "vital-ring": {
    base: "Senzu Vital Ring",
    appearance: {
      family: "ring",
      material: { tint: "#4a8a4a", accent: "#9ce89c" },
      look: "a green jade ring carved in the shape of a curled sprouting bean",
    },
    homage: { source: "Dragon Ball", original: "the Senzu Bean" },
    specialty: "Knits wounds steadily, keeping the wearer in the fight.",
    lore: "One is worth ten good meals.",
  },
  "aegis-charm": {
    base: "Guardian's Aegis Charm",
    appearance: {
      family: "amulet",
      material: { tint: "#caa84a", accent: "#4d9bf0" },
      look: "a small round shield-shaped charm of bronze rimmed with blue enamel",
    },
    homage: { source: "The Rising of the Shield Hero", original: "the Legendary Shield" },
    specialty: "Hardens the bearer against crits and heavy blows alike.",
    lore: "A shield small enough to carry, stubborn enough to matter.",
  },
  "coin-pet": {
    base: "Goldslime Sprite",
    appearance: {
      family: "familiar",
      material: { tint: "#e8c84a", accent: "#f5d870" },
      look: "a tiny round golden slime sprite with a coin-slot mouth and big shining eyes",
    },
    homage: { source: "Dragon Quest", original: "the metal/gold slime" },
    specialty: "Burps up a little gold for its keeper as it bounces along.",
    lore: "Squishy, harmless, and weirdly profitable.",
  },
  "fortune-pet": {
    base: "Payday Felynx",
    appearance: {
      family: "familiar",
      material: { tint: "#b8941f", accent: "#f5d870" },
      look: "a chubby cat-like coin beast with a gold collar bell, batting a coin between its paws",
    },
    homage: { source: "Pokémon", original: "the coin-flinging scratch cat" },
    specialty: "Flings coin on a whim — a steadier, richer hoard.",
    lore: "It only ever pays when it feels like it.",
  },
  skywings: {
    base: "Skyfreedom Wings",
    appearance: {
      family: "wings",
      material: { tint: "#7ad1ff", accent: "#eaf6ff" },
      look: "a pair of broad feathered wings, slate-and-white, edged with sky-blue light",
    },
    homage: { source: "Attack on Titan", original: "the Wings of Freedom emblem" },
    specialty: "Lift and drive together — fast and tireless aloft.",
    lore: "A promise stitched in feathers: never caged.",
  },
  "frost-glaive": {
    base: "Frostfang Glaive",
    appearance: {
      family: "greatblade",
      material: { tint: "#bfe6ff", accent: "#4d9bf0" },
      look: "a long pale-steel sword sheathed in frost, breathing cold mist along its edge",
    },
    homage: { source: "Bleach", original: "the ice-and-sky zanpakuto" },
    specialty: "Each cut bites colder — devastating, freezing critical blows.",
    lore: "Heaven and earth freeze where it falls.",
  },
  "venom-fang": {
    base: "Serpent Venom Fang",
    appearance: {
      family: "gauntlet",
      material: { tint: "#4a8a4a", accent: "#9c4dd0" },
      look: "a fanged knuckle-claw dripping luminous purple venom",
    },
    homage: { source: "Naruto", original: "the serpent sannin's blade" },
    specialty: "Bleeds the foe and drinks the life back into the striker.",
    lore: "Its bite outlives the bitten.",
  },
  "bulwark-plate": {
    base: "Aegis Bulwark Plate",
    appearance: {
      family: "chestplate",
      material: { tint: "#b6bcc6", accent: "#4d9bf0" },
      look: "a thick rounded breastplate bearing a blue heraldic shield crest",
    },
    homage: { source: "The Rising of the Shield Hero", original: "the Shield Hero's defense" },
    specialty: "Soaks damage outright — the immovable line.",
    lore: "Made to be hit so the line behind it never is.",
  },
  "oracle-crown": {
    base: "Geass Oracle Crown",
    appearance: {
      family: "helm",
      material: { tint: "#2a2a4a", accent: "#d23b3b" },
      look: "a thin dark circlet drawn over one eye, a glowing red sigil burning at the brow",
    },
    homage: { source: "Code Geass", original: "the power of the king" },
    specialty: "Commands the flow of mana into overwhelming spell-power.",
    lore: "Look into its eye and you will obey.",
  },
  "shadowstep-treads": {
    base: "Shadowstep Treads",
    appearance: {
      family: "boots",
      material: { tint: "#2a2a36", accent: "#6e6e88" },
      look: "low black soft-soled treads wrapped tight for silent, sudden movement",
    },
    homage: { source: "Naruto", original: "the Body Flicker technique" },
    specialty: "Blink-quick footwork that sets up the opening strike.",
    lore: "Gone before the dust settles.",
  },
  "duelist-band": {
    base: "Duelist's Band",
    appearance: {
      family: "ring",
      material: { tint: "#cfd6e2", accent: "#4d9bf0" },
      look: "a sleek techno-ring shaped like a miniature dueling gauntlet with a glowing blue edge",
    },
    homage: { source: "Yu-Gi-Oh!", original: "the Duel Disk" },
    specialty: "Quickens the draw — attack after attack, no wasted beat.",
    lore: "It's your move.",
  },
};
