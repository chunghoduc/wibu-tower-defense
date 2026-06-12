/**
 * Base + signature item homages — the hand-authored core of the catalog.
 * Keyed by item id; each carries a `name` (display name). See `itemLore.ts`
 * for the `ItemLoreEntry` shape and the `loreFor` resolver that reads this.
 */
import type { ItemLoreEntry } from "./itemLore.ts";

export const ITEM_LORE_BASE: Record<string, ItemLoreEntry> = {
  // ── Base items ──────────────────────────────────────────────────────────────
  "iron-sword": {
    name: "Dawncut Katana",
    appearance: {
      family: "greatblade",
      material: { tint: "#c0cbd8", accent: "#1a1a22" },
      look: "a straight single-edged katana with a matte charcoal-steel blade, a plain ring guard, and a dark cord-wrapped grip",
    },
    homage: { source: "Demon Slayer: Kimetsu no Yaiba", original: "black Nichirin blade" },
    specialty: "Its steel drinks the dawn — said to bite deeper against things that fear sunlight.",
    lore: "A humble first blade that hums faintly when the sun crests the hills.",
  },
  "elven-bow": {
    name: "Hallowed Spirit Bow",
    appearance: {
      family: "bow",
      material: { tint: "#5a8a4a", accent: "#e8d070" },
      look: "an elegant tall recurve longbow of pale green spiritwood with gold-leaf tips and a faintly glowing string",
    },
    homage: { source: "Inuyasha", original: "the sacred priestess bow" },
    specialty: "Looses arrows wrapped in purifying light that punch clean through guard.",
    lore: "Carved from a tree that grew where a shrine maiden once stood vigil.",
  },
  "arcane-staff": {
    name: "Wisteria Caster Staff",
    appearance: {
      family: "staff",
      material: { tint: "#6a4a8a", accent: "#b07ad8" },
      look: "an ornate dark wooden magic staff topped with a glowing violet crystal orb ringed by floating runes",
    },
    homage: { source: "Frieren: Beyond Journey's End", original: "a mage's staff" },
    specialty: "Stores spent mana in its crystal, letting a caster chain spells longer.",
    lore: "Quiet and patient, like the mage who carried it across a thousand years.",
  },
  "thunder-cannon": {
    name: "Voltcoil Cannon",
    appearance: {
      family: "firearm",
      material: { tint: "#7a6a4a", accent: "#4dc6f6" },
      look: "a heavy bronze steampunk hand cannon wrapped in copper coils, crackling with arcs of blue electricity",
    },
    homage: { source: "A Certain Scientific Railgun", original: "the electromaster's railgun" },
    specialty: "Rails a charged slug on a bolt of lightning, shredding armor on impact.",
    lore: "It smells of ozone and recoils like a kicking mule.",
  },
  "leather-cap": {
    name: "Cadet's Leather Cap",
    appearance: {
      family: "helm",
      material: { tint: "#8a6a3a", accent: "#5a4426" },
      look: "a simple worn brown leather scouting cap with a short stitched brim",
    },
    homage: { source: "Attack on Titan", original: "cadet corps gear" },
    specialty: "Light enough to keep a recruit's head clear and quick.",
    lore: "First issue. Most never grow out of it; the lucky few do.",
  },
  "iron-helm": {
    name: "Bronze Saint Helm",
    appearance: {
      family: "helm",
      material: { tint: "#aeb6c2", accent: "#6a7686" },
      look: "a polished steel knight's helmet with a smooth crown and a narrow vision slit",
    },
    homage: { source: "Saint Seiya", original: "a Cloth helmet" },
    specialty: "Plated to turn aside blows that would fell a lesser warrior.",
    lore: "Dented in a hundred duels, never once cracked.",
  },
  "cloth-robe": {
    name: "Wanderer's Field Robe",
    appearance: {
      family: "robe",
      material: { tint: "#7a8aa0", accent: "#5a6678" },
      look: "a simple grey-blue cloth field robe with loose sleeves and a wrapped waist",
    },
    homage: { source: "Naruto", original: "a wandering shinobi's field garb" },
    specialty: "Woven to shrug off stray magic better than its weight suggests.",
    lore: "The first thing a traveler buys and the last thing they throw away.",
  },
  "scale-mail": {
    name: "Hawk Knight Scalemail",
    appearance: {
      family: "chestplate",
      material: { tint: "#8a9aa8", accent: "#6a7686" },
      look: "a steel scale-mail chest cuirass of overlapping plates with a raised collar",
    },
    homage: { source: "Berserk", original: "Band of the Hawk armor" },
    specialty: "Overlapping scales spread a hit so no single blow lands true.",
    lore: "Forged for a company that believed it could not lose.",
  },
  "worn-gloves": {
    name: "Trainee Wraps",
    appearance: {
      family: "gloves",
      material: { tint: "#8a6a4a", accent: "#5a4426" },
      look: "a pair of worn brown leather fingerless gloves with frayed straps",
    },
    homage: { source: "Hunter x Hunter", original: "a young hunter's gear" },
    specialty: "Bare fingertips keep the grip a hair sharper for a clean strike.",
    lore: "Calluses do the rest.",
  },
  "assassin-gloves": {
    name: "Nightreaper Gloves",
    appearance: {
      family: "gloves",
      material: { tint: "#3a3a4a", accent: "#d23b3b" },
      look: "a pair of dark leather assassin gloves with a thin red blade folded along each wrist",
    },
    homage: { source: "Akame ga Kill!", original: "an assassin's concealed blades" },
    specialty: "Hidden edges turn a graze into a killing wound.",
    lore: "Their owners are never seen twice.",
  },
  "worn-boots": {
    name: "Wayfarer Boots",
    appearance: {
      family: "boots",
      material: { tint: "#8a6a4a", accent: "#5a4426" },
      look: "a pair of worn brown leather travel boots, scuffed at the toes",
    },
    homage: { source: "Mushishi", original: "a traveler's boots" },
    specialty: "Broken in until the road no longer slows you.",
    lore: "They remember more roads than their owner does.",
  },
  "swift-boots": {
    name: "Flashstep Greaves",
    appearance: {
      family: "boots",
      material: { tint: "#4a8a6a", accent: "#eaf6ff" },
      look: "a pair of enchanted green boots with small white feathered wings at the heels",
    },
    homage: { source: "Bleach", original: "shunpo (flash step)" },
    specialty: "Closes the gap between heartbeats — here, then there.",
    lore: "Outrunners swear the wings beat on their own.",
  },
  "mana-pendant": {
    name: "Aegis-Eye Pendant",
    appearance: {
      family: "amulet",
      material: { tint: "#caa84a", accent: "#4da6f6" },
      look: "a silver amulet set with a glowing blue mana gem ringed by a thin gold bezel",
    },
    homage: { source: "Yu-Gi-Oh!", original: "the Millennium Puzzle" },
    specialty: "Pools ambient mana so a caster never quite runs dry.",
    lore: "It warms against the chest when danger is near.",
  },
  "copper-ring": {
    name: "Novice Seal Ring",
    appearance: {
      family: "ring",
      material: { tint: "#c08a4a", accent: "#e0b070" },
      look: "a simple plain copper band with a small flat seal face",
    },
    homage: { source: "Fairy Tail", original: "a guild ring" },
    specialty: "A first focus that steadies a beginner's flow of mana.",
    lore: "Cheap, dependable, and quietly proud of it.",
  },
  "resonance-ring": {
    name: "Soul Resonance Band",
    appearance: {
      family: "ring",
      material: { tint: "#c0cbd8", accent: "#9c4dd0" },
      look: "a silver ring set with a glowing purple gem that pulses in time",
    },
    homage: { source: "Soul Eater", original: "Soul Resonance" },
    specialty: "Returns mana with every blow as wielder and weapon sync up.",
    lore: "Two souls beating as one ring twice as loud.",
  },
  "coin-sprite": {
    name: "Fortune Mote",
    appearance: {
      family: "familiar",
      material: { tint: "#e8c84a", accent: "#f5d870" },
      look: "a cute glowing golden coin spirit with tiny stub wings and big sparkling eyes",
    },
    homage: { source: "Spirited Away", original: "a wandering coin spirit" },
    specialty: "Trails its keeper, nudging a little extra gold from every kill.",
    lore: "Feed it a coin and it makes two — sometimes.",
  },
  "fortune-fox": {
    name: "Ninetail Coinkeeper",
    appearance: {
      family: "familiar",
      material: { tint: "#e8902a", accent: "#f5b060" },
      look: "an adorable orange nine-tailed fox spirit pet clutching a fat gold coin",
    },
    homage: { source: "Naruto", original: "Kurama, the Nine-Tails" },
    specialty: "A hoarder by nature — vastly fattens the gold its keeper finds.",
    lore: "Each tail counts a fortune it refuses to spend.",
  },
  "fledgling-wings": {
    name: "Fledgling Halo Wings",
    appearance: {
      family: "wings",
      material: { tint: "#e8eef4", accent: "#ffffff" },
      look: "a pair of small soft white feathered angel wings with a faint pale glow",
    },
    homage: { source: "Haibane Renmei", original: "the grey-feathered wings" },
    specialty: "Just enough lift to lighten every step.",
    lore: "Small wings, but they ache to fly.",
  },
  "tempest-wings": {
    name: "Tempest Featherwings",
    appearance: {
      family: "wings",
      material: { tint: "#7ad1ff", accent: "#eaf6ff" },
      look: "a pair of large glowing blue storm-energy wings shedding sparks of wind",
    },
    homage: { source: "Howl's Moving Castle", original: "Howl's bird-form wings" },
    specialty: "Ride the gale — blistering speed with a gust that never tires.",
    lore: "They beat with the sound of a coming storm.",
  },
  // ── Signature loot ──────────────────────────────────────────────────────────
  dawnbreaker: {
    name: "Daybreak Solblade",
    appearance: {
      family: "greatblade",
      material: { tint: "#f0e6c0", accent: "#ffd24a" },
      look: "a radiant long katana with a sun-gold blade trailing motes of dawnlight and a flame-wrapped guard",
    },
    homage: { source: "Demon Slayer: Kimetsu no Yaiba", original: "the Sun Breathing Nichirin" },
    specialty: "The first and brightest sword — its light ignores the dark's defenses.",
    lore: "When it is drawn, night ends a little early.",
  },
  "void-render": {
    name: "Hollow Purple Driver",
    appearance: {
      family: "firearm",
      material: { tint: "#3a2a4a", accent: "#9c4dd0" },
      look: "a sleek black hand cannon channeling a swirling violet sphere of collapsing energy at the muzzle",
    },
    homage: { source: "Jujutsu Kaisen", original: "the Hollow Technique" },
    specialty: "Fires a clash of forces that erases armor on the way through.",
    lore: "What it touches is not destroyed so much as unmade.",
  },
  "aegis-of-dawn": {
    name: "Goldcloth of Dawn",
    appearance: {
      family: "chestplate",
      material: { tint: "#e8d8a0", accent: "#ffd24a" },
      look: "a gleaming ornate gold breastplate with radiant filigree and a sunburst at the heart",
    },
    homage: { source: "Saint Seiya", original: "a Gold Cloth" },
    specialty: "Drinks incoming force into light, blunting the heaviest blows.",
    lore: "Worn by those who stand where others fall.",
  },
  "seers-eye": {
    name: "All-Seeing Oracle Eye",
    appearance: {
      family: "amulet",
      material: { tint: "#caa84a", accent: "#d23b3b" },
      look: "a gold-rimmed amulet holding a crimson iris-gem that seems to track the viewer",
    },
    homage: { source: "Naruto", original: "the Sharingan" },
    specialty: "Reads the flow of battle, sharpening every spell its bearer casts.",
    lore: "It blinks only when no one is watching.",
  },
  "midas-paw": {
    name: "Goldhand Maneki",
    appearance: {
      family: "familiar",
      material: { tint: "#e8c84a", accent: "#f5d870" },
      look: "a chubby beckoning gold cat-spirit with one raised paw and a coin bell at its collar",
    },
    homage: { source: "anime maneki-neko folklore", original: "the lucky beckoning cat" },
    specialty: "Everything its raised paw points at turns a profit.",
    lore: "It beckons, and fortune (mostly) obeys.",
  },
};
