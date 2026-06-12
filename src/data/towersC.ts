/**
 * Roster batch C — towers that populate the previously-empty ranged and magic
 * weapon families (bow / crossbow / gun / thrown / tome / scepter / wand / orb),
 * so the weapon-family → damage-type taxonomy (weaponFamily.ts) is fully covered.
 * Split out of towers.ts / towersB.ts to keep every roster file under the
 * project's 500-line limit. Each entry authors only its structured weapon; the
 * damage type derives from the family (physical bows/guns, magic staves/orbs).
 */
import { makeStats, type CharacterDef } from "./schema.ts";
import { t } from "./towerBuilder.ts";

export const TOWERS_C: CharacterDef[] = [
  // ===================== PHYSICAL RANGED — bow =====================
  t({
    id: "aya-dawnshot",
    name: "Aya Dawnshot", // homage: Yona (Akatsuki no Yona) — the archer princess
    rarity: "Common",
    role: "damage",
    target: "Both",
    cost: 50,
    description:
      "A runaway princess who taught herself the bow in exile and never misses the same target twice. Quick, bright, and far steadier than her soft hands suggest.",
    meta: {
      homage: "An exiled princess who taught herself the bow surviving in the wild",
      outfit:
        "A traveller's red-and-cream tunic with a half-cloak and a worn quiver, long red hair tied back",
      weapon: { family: "bow", display: "A slender hunting bow drawn in rapid, clean loosings" },
    },
    passives: ["quick-draw", "keen-eye"],
    active: "rapid-volley",
    baseStats: makeStats({
      atk: 14,
      attackSpeed: 1.3,
      range: 240,
      critRate: 0.1,
      critDamage: 1.5,
      maxHp: 115,
      manaOnHit: 8,
    }),
  }),
  t({
    id: "lyran-ricochet",
    name: "Lyran Ricochet", // homage: classic elven trick-archer (high-fantasy ranger)
    rarity: "Rare",
    role: "chain",
    target: "Both",
    cost: 105,
    description:
      "A green-cloaked elf marksman who bends every shaft off bark, helm, and shield so a single arrow visits an entire patrol before it falls.",
    meta: {
      homage: "Classic elven trick-archer / high-fantasy ranger",
      outfit:
        "A green hooded ranger's cloak over light leathers, a long elegant bow and a tall quiver",
      weapon: { family: "bow", display: "A longbow loosing arrows that skip between foes" },
    },
    passives: ["ricochet", "trick-shot"],
    active: "skipping-volley",
    behavior: { chainTargets: 4, chainFalloff: 0.7 },
    baseStats: makeStats({
      atk: 26,
      attackSpeed: 1.15,
      range: 235,
      critRate: 0.2,
      critDamage: 1.8,
      maxHp: 200,
      manaOnHit: 13,
    }),
  }),
  t({
    id: "seren-skyfall",
    name: "Seren Skyfall", // homage: Arash (Fate) — the hero of a single sky-splitting shot
    rarity: "Legendary",
    role: "splash",
    target: "Both",
    cost: 160,
    description:
      "A legendary archer-hero who looses one arrow into the heavens and brings down a falling sky of shafts. Each volley is offered like a last shot.",
    meta: {
      homage: "A legendary hero-archer remembered for one sky-splitting shot",
      outfit:
        "A weathered nomad-hero's open vest and arm-wraps, a massive ornate war-bow on his back",
      weapon: {
        family: "bow",
        display: "A great war-bow that arcs a rain of arrows over a wide span",
      },
    },
    passives: ["far-sight", "arcing-loose", "last-shot"],
    active: "meteor-volley",
    behavior: { splashRadius: 96 },
    baseStats: makeStats({
      atk: 33,
      attackSpeed: 0.65,
      range: 240,
      critRate: 0.3,
      critDamage: 1.9,
      armorPen: 0.35,
      maxHp: 245,
      manaOnHit: 15,
    }),
  }),
  // ===================== PHYSICAL RANGED — crossbow =====================
  t({
    id: "dren-heavybolt",
    name: "Dren Heavybolt", // homage: stoic crossbow hunter archetype
    rarity: "Magic",
    role: "damage",
    target: "Both",
    cost: 80,
    description:
      "A taciturn monster-hunter who carries a crossbow built more like a ballista. One slow, deliberate bolt punches clean through plate and beast alike.",
    meta: {
      homage: "Stoic monster-hunting crossbowman archetype",
      outfit:
        "A heavy hunter's longcoat and bracers, a bulky steel-limbed crossbow braced on one knee",
      weapon: {
        family: "crossbow",
        display: "A heavy steel crossbow firing armor-splitting bolts",
      },
    },
    passives: ["armor-piercer", "steady-aim"],
    active: "siege-bolt",
    baseStats: makeStats({
      atk: 21,
      attackSpeed: 0.8,
      range: 230,
      critRate: 0.15,
      critDamage: 1.7,
      armorPen: 0.45,
      maxHp: 165,
      manaOnHit: 11,
    }),
  }),
  t({
    id: "vesska-venombolt",
    name: "Vesska Venombolt", // homage: venom-bolt assassin archetype
    rarity: "Rare",
    role: "dot",
    target: "Both",
    cost: 100,
    description:
      "A hooded crossbow assassin who coats every quarrel in a slow green rot. Her victims rarely notice the bolt — only the hours of fever that follow.",
    meta: {
      homage: "Hooded venom-bolt assassin archetype",
      outfit:
        "A dark hooded assassin's wrap with vials of green toxin at the belt, a slim repeating crossbow",
      weapon: {
        family: "crossbow",
        element: "poison",
        display: "A repeating crossbow loosing venom-soaked bolts",
      },
    },
    passives: ["envenom", "barbed-bolt"],
    active: "plague-quiver",
    behavior: { dot: { dps: 16, duration: 4 } },
    baseStats: makeStats({
      atk: 14,
      attackSpeed: 1.0,
      range: 225,
      critRate: 0.18,
      critDamage: 1.7,
      armorPen: 0.3,
      maxHp: 195,
      manaOnHit: 14,
    }),
  }),
  // ===================== PHYSICAL RANGED — gun =====================
  t({
    id: "vance-the-drifter",
    name: "Vance the Drifter", // homage: Vash the Stampede (Trigun)
    rarity: "Rare",
    role: "damage",
    target: "Both",
    cost: 110,
    description:
      "A wandering peacemaker with a bottomless smile and an impossibly fast trigger finger. He swears he never aims to kill — and somehow never has to.",
    meta: {
      homage: "A wandering pacifist gunslinger with an impossibly fast trigger finger",
      outfit:
        "A long red duster over a buckled bodysuit, round orange glasses and unruly blond spikes",
      weapon: { family: "gun", display: "A long silver revolver fired in a blur of trick shots" },
    },
    passives: ["gun-kata", "fan-the-hammer"],
    active: "spin-shot",
    baseStats: makeStats({
      atk: 30,
      attackSpeed: 1.35,
      range: 260,
      critRate: 0.24,
      critDamage: 1.85,
      armorPen: 0.3,
      omnivamp: 0.1,
      maxHp: 200,
      manaOnHit: 14,
    }),
  }),
  t({
    id: "yael-boomshot",
    name: "Yael Boomshot", // homage: Yoko Littner (Gurren Lagann)
    rarity: "Legendary",
    role: "splash",
    target: "Both",
    cost: 160,
    description:
      "A sharpshooter from the underground who upgraded from rifle to grenade-launcher and never looked back. Every shell she lobs blooms into a wall of fire.",
    meta: {
      homage: "A fiery underground sharpshooter who graduated to a grenade launcher",
      outfit:
        "A flame-print bikini top with a slung ammo belt and short shorts, long red-orange ponytail",
      weapon: {
        family: "gun",
        element: "fire",
        display: "A break-action grenade launcher firing explosive shells",
      },
    },
    passives: ["incendiary-rounds", "wide-blast", "high-ground"],
    active: "grenade-barrage",
    behavior: { splashRadius: 96 },
    baseStats: makeStats({
      atk: 41,
      attackSpeed: 0.6,
      range: 255,
      critRate: 0.3,
      critDamage: 1.9,
      maxHp: 240,
      manaOnHit: 15,
    }),
  }),
  t({
    id: "rivka-rebound",
    name: "Rivka Rebound", // homage: Rip Van Winkle (Hellsing) — the curving musket-ball
    rarity: "Unique",
    role: "chain",
    target: "Both",
    cost: 215,
    description:
      "A humming markswoman whose enchanted rounds bend around cover and rebound from foe to foe, hunting down everything in the lane before the echo fades.",
    meta: {
      homage: "A humming markswoman whose enchanted bullets curve and rebound at will",
      outfit:
        "A long military greatcoat and round spectacles, a slender ornate long-rifle held high",
      weapon: {
        family: "gun",
        display: "A long-barrelled rifle firing rounds that rebound between targets",
      },
    },
    passives: ["homing-rounds", "ricochet", "perfect-cadence"],
    active: "phantom-fusillade",
    behavior: { chainTargets: 6, chainFalloff: 0.8 },
    baseStats: makeStats({
      atk: 56,
      attackSpeed: 1.2,
      range: 260,
      critRate: 0.28,
      critDamage: 2.1,
      armorPen: 0.4,
      omnivamp: 0.1,
      maxHp: 280,
      manaOnHit: 18,
    }),
  }),
  // ===================== PHYSICAL RANGED — thrown =====================
  t({
    id: "tella-wirefang",
    name: "Tella Wirefang", // homage: Tenten (Naruto) — the weapons specialist
    rarity: "Magic",
    role: "debuff",
    target: "Both",
    cost: 75,
    description:
      "A weapons-scroll prodigy who hurls a glittering hail of kunai, bolas, and wire that pins enemies where they stand. Never reaches for the same tool twice.",
    meta: {
      homage: "A thrown-weapons prodigy who never reaches for the same tool twice",
      outfit:
        "A sleeveless qipao-style top with twin hair buns and bandaged forearms, scroll pouches at the hip",
      weapon: { family: "thrown", display: "A whirling fan of kunai and weighted bola-wire" },
    },
    passives: ["weighted-net", "pinning-throw"],
    active: "bola-storm",
    behavior: { slow: { pct: 0.35, duration: 2.5 } },
    baseStats: makeStats({
      atk: 16,
      attackSpeed: 1.0,
      range: 200,
      critRate: 0.12,
      critDamage: 1.6,
      maxHp: 160,
      manaOnHit: 11,
    }),
  }),
  // ===================== MAGIC IMPLEMENT — tome =====================
  t({
    id: "mortise-inkhex",
    name: "Mortise Inkhex", // homage: grimoire curse-scribe archetype
    rarity: "Magic",
    role: "dot",
    target: "Both",
    cost: 80,
    description:
      "A pale scrivener who writes a foe's name in festering ink and lets the curse do the killing. The page always finishes what the pen begins.",
    meta: {
      homage: "Grimoire curse-scribe archetype",
      outfit:
        "An ink-stained scholar's robe with a quill behind one ear, a floating open black grimoire",
      weapon: {
        family: "tome",
        element: "poison",
        display: "A black grimoire whose written hexes rot the flesh",
      },
    },
    passives: ["festering-script", "spreading-curse"],
    active: "ruinous-passage",
    behavior: { dot: { dps: 12, duration: 4 } },
    baseStats: makeStats({
      atk: 12,
      attackSpeed: 1.0,
      range: 195,
      critRate: 0.1,
      critDamage: 1.6,
      skillPower: 1.8,
      maxHp: 160,
      manaOnHit: 11,
    }),
  }),
  t({
    id: "verena-quillbane",
    name: "Verena Quillbane", // homage: hex-scholar archetype
    rarity: "Rare",
    role: "debuff",
    target: "Both",
    cost: 100,
    description:
      "A court archivist who edits the battlefield like a manuscript — striking out an enemy's strength with a single dismissive flick of her quill.",
    meta: {
      homage: "Curse-scholar / hex-archivist archetype",
      outfit:
        "A high-collared violet academic robe with gold trim, an enchanted tome and a glowing quill",
      weapon: {
        family: "tome",
        display: "A spell-codex that scribes weakening hexes onto its targets",
      },
    },
    passives: ["weakening-word", "ink-shackle"],
    active: "errata-curse",
    behavior: { slow: { pct: 0.4, duration: 2.5 }, stun: { duration: 0.8, chance: 0.25 } },
    baseStats: makeStats({
      atk: 14,
      attackSpeed: 0.9,
      range: 195,
      critRate: 0.12,
      critDamage: 1.6,
      skillPower: 1.8,
      maxHp: 200,
      manaOnHit: 13,
    }),
  }),
  // ===================== MAGIC IMPLEMENT — scepter =====================
  t({
    id: "auriel-wardlight",
    name: "Auriel Wardlight", // homage: holy princess-cleric archetype
    rarity: "Legendary",
    role: "support",
    target: "Both",
    cost: 165,
    description:
      "A radiant queen-regent whose raised scepter wraps her allies in golden law — quickening their strikes and turning aside the first blow meant for them.",
    meta: {
      homage: "Holy princess / radiant cleric-queen archetype",
      outfit:
        "A white-and-gold royal gown with a winged circlet, bearing a tall jewelled scepter of light",
      weapon: {
        family: "scepter",
        element: "holy",
        display: "A jewelled royal scepter radiating a warding light",
      },
    },
    passives: ["royal-decree", "aegis-blessing", "dawns-favor"],
    active: "coronation-ward",
    behavior: { buffAura: { radius: 170, atkPct: 0.2, attackSpeedPct: 0.12 } },
    baseStats: makeStats({
      atk: 12,
      attackSpeed: 0.7,
      range: 200,
      critRate: 0.1,
      critDamage: 1.5,
      skillPower: 2.0,
      maxHp: 250,
      manaOnHit: 0,
    }),
  }),
  t({
    id: "sael-arcrod",
    name: "Sael Arcrod", // homage: storm-priest archetype
    rarity: "Rare",
    role: "chain",
    target: "Both",
    cost: 105,
    description:
      "A wind-swept storm-caller who raises a copper scepter and lets the lightning decide its own path, leaping gleefully from one foe to the next.",
    meta: {
      homage: "Storm-priest / lightning-caller archetype",
      outfit:
        "A storm-grey priestly robe with crackling blue trim, a copper scepter capped by a charged crystal",
      weapon: {
        family: "scepter",
        element: "lightning",
        display: "A copper scepter that arcs chaining bolts of storm",
      },
    },
    passives: ["arc-conduct", "storm-link"],
    active: "tempest-scepter",
    behavior: { chainTargets: 4, chainFalloff: 0.7 },
    baseStats: makeStats({
      atk: 25,
      attackSpeed: 1.0,
      range: 200,
      critRate: 0.15,
      critDamage: 1.7,
      skillPower: 1.8,
      maxHp: 195,
      manaOnHit: 13,
    }),
  }),
  // ===================== MAGIC IMPLEMENT — wand =====================
  t({
    id: "pim-sparklet",
    name: "Pim Sparklet", // homage: novice spark-mage archetype
    rarity: "Common",
    role: "splash",
    target: "Both",
    cost: 50,
    description:
      "An over-eager apprentice whose tiny wand throws more sparks than she means to — a small crackling burst that zaps a whole cluster at once.",
    meta: {
      homage: "Novice apprentice spark-mage archetype",
      outfit:
        "An oversized starry mage-robe and a slightly-too-big pointed hat, a stubby crystal-tipped wand",
      weapon: {
        family: "wand",
        element: "lightning",
        display: "A short crystal wand spitting scattering sparks",
      },
    },
    passives: ["static-burst", "spark-scatter"],
    active: "zap-nova",
    behavior: { splashRadius: 55 },
    baseStats: makeStats({
      atk: 11,
      attackSpeed: 0.85,
      range: 185,
      critRate: 0.1,
      critDamage: 1.5,
      skillPower: 1.6,
      maxHp: 120,
      manaOnHit: 8,
    }),
  }),
  t({
    id: "aldous-boltcaster",
    name: "Aldous Boltcaster", // homage: arcane-missile master archetype
    rarity: "Legendary",
    role: "damage",
    target: "Both",
    cost: 160,
    description:
      "A precise battle-mage who disdains flash for function, loosing unerring darts of raw arcane force that find the gap in any guard.",
    meta: {
      homage: "Arcane-missile master-mage archetype",
      outfit:
        "A deep-blue mage's coat with silver sigils and a focusing monocle, a long rune-etched wand",
      weapon: { family: "wand", display: "A rune-etched wand firing unerring arcane darts" },
    },
    passives: ["arcane-focus", "mana-bolt", "true-aim"],
    active: "missile-salvo",
    baseStats: makeStats({
      atk: 42,
      attackSpeed: 1.1,
      range: 185,
      critRate: 0.32,
      critDamage: 1.95,
      magicPen: 0.45,
      skillPower: 2.0,
      maxHp: 240,
      manaOnHit: 15,
    }),
  }),
  // The MAGIC IMPLEMENT (orb) entry continues in towersD.ts (TOWERS_C2).
];
