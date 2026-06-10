/**
 * Character / tower catalog — 32 ORIGINAL homage characters, each channelling an
 * iconic all-time anime archetype WITHOUT copying any real name, likeness, or
 * protected element (the legally-safe "inspired by" approach).
 *
 * Design rules enforced here:
 * - Every ROLE (damage/splash/chain/dot/debuff/support) has at least one
 *   character of EACH rarity (Common -> Magic -> Rare -> Legendary -> Unique).
 * - A character's rarity & stats track its source's power level (a famously weak
 *   character is Common; a top-tier powerhouse is Unique).
 * - Basic attacks are Physical or Magic ONLY. TRUE damage comes only from
 *   skills — modelled via `behavior.activeType` (active skill) or a DoT's
 *   `damageType` override.
 * - The `// homage:` comment is a designer note and is NOT shown to players;
 *   the player-facing `description` lore is original.
 */
import { makeStats, type CharacterDef } from "./schema.ts";
import { t } from "./towerBuilder.ts";
import { TOWERS_B } from "./towersB.ts";
import { TOWERS_C } from "./towersC.ts";

const TOWERS_A: CharacterDef[] = [
  // ============================ DAMAGE ============================
  t({
    id: "yamo-desert-bandit",
    name: "Yamo the Desert Bandit", // homage: Yamcha (Dragon Ball) — famously outclassed
    rarity: "Common",
    role: "damage",
    target: "Both",
    cost: 45,
    description:
      "A reformed bandit and eager martial artist who never quite escapes the punchline. Hits harder than anyone gives him credit for.",
    meta: {
      homage: "Yamcha (Dragon Ball) — the famously outclassed underdog",
      outfit: "Tattered orange-and-blue martial gi with a sand scarf and a forehead band",
      weapon: { family: "fist", display: "Bare fists and a thrown ball of ki" },
    },
    passives: ["wolf-fang"],
    active: "spirit-ball",
    baseStats: makeStats({
      atk: 13, attackSpeed: 1.3, range: 90, critRate: 0.1, maxHp: 120,
      maxMana: 60, manaOnHit: 8, manaRegen: 1,
    }),
  }),
  t({
    id: "kazu-spirit-brawler",
    name: "Kazu the Spirit Brawler", // homage: Kazuma Kuwabara (YuYu Hakusho)
    rarity: "Magic",
    role: "damage",
    target: "Ground",
    cost: 70,
    description:
      "A loud-mouthed street tough with a heart of gold and a blade of pure spirit energy. Loyal to a fault, tougher than he looks.",
    meta: {
      homage: "Kazuma Kuwabara (YuYu Hakusho)",
      outfit: "A street tough's rolled-up school uniform with a towering pompadour, sleeves torn for brawling",
      weapon: { family: "sword", enchanted: true, display: "A Spirit Sword conjured from raw energy" },
    },
    passives: ["spirit-sword", "street-code"],
    active: "dimensional-slash",
    baseStats: makeStats({
      atk: 22, attackSpeed: 1.1, range: 90, critRate: 0.15, maxHp: 170,
      maxMana: 70, manaOnHit: 12, manaRegen: 1,
    }),
  }),
  t({
    id: "zoran-thricedraw",
    name: "Zoran Thricedraw", // homage: Roronoa Zoro (One Piece)
    rarity: "Rare",
    role: "damage",
    target: "Ground",
    cost: 100,
    description:
      "A three-blade swordsman — one in each hand and one in his teeth — chasing a vow to be the greatest. Reliably gets lost walking in a straight line.",
    meta: {
      homage: "Roronoa Zoro (One Piece)",
      outfit: "A dark open coat over a green haramaki sash, three sheaths riding the left hip",
      weapon: { family: "sword", multi: true, display: "Three katana — one in each hand and one clenched in his teeth" },
    },
    passives: ["three-sword-style", "first-strike"],
    active: "iaido-slash",
    baseStats: makeStats({
      atk: 30, attackSpeed: 1.1, range: 85, critRate: 0.25, critDamage: 1.9,
      armorPen: 0.4, omnivamp: 0.1, maxHp: 210, maxMana: 70, manaOnHit: 14, manaRegen: 1,
    }),
  }),
  t({
    id: "prince-vael",
    name: "Prince Vael", // homage: Vegeta (Dragon Ball)
    rarity: "Legendary",
    role: "damage",
    target: "Ground",
    cost: 160,
    description:
      "The exiled heir of a warrior race, too proud to lose and too stubborn to fall. His final flash answers to no armor.",
    meta: {
      homage: "Vegeta (Dragon Ball)",
      outfit: "A royal warrior's blue bodysuit with a white armored chestplate and gloves, chin always raised",
      weapon: { family: "fist", display: "Bare-handed ki combat capped by a piercing energy flash" },
    },
    passives: ["royal-pride", "galick-surge", "perfect-form"],
    active: "final-flash",
    behavior: { activeType: "True" }, // ultimate pierces all defense
    baseStats: makeStats({
      atk: 44, attackSpeed: 1.4, range: 90, critRate: 0.35, critDamage: 2.0,
      armorPen: 0.45, omnivamp: 0.12, maxHp: 260, maxMana: 85, manaOnHit: 13, manaRegen: 1,
    }),
  }),
  t({
    id: "karu-sunfist",
    name: "Karu Sunfist", // homage: Son Goku (Dragon Ball)
    rarity: "Unique",
    role: "damage",
    target: "Both",
    cost: 210,
    description:
      "An orphan martial artist with a bottomless appetite and a brighter grin, who turns sunlight into world-shaking ki and seeks the strong just to feel alive.",
    meta: {
      homage: "Son Goku (Dragon Ball)",
      outfit: "An orange martial gi over a blue undershirt and belt, wild spiked hair",
      weapon: { family: "fist", enchanted: true, display: "Fists and a charged, world-shaking ki wave" },
    },
    passives: ["boundless-ki", "instinct", "second-wind"],
    active: "kamefist-wave",
    behavior: { activeType: "True" }, // signature beam ignores defense
    baseStats: makeStats({
      atk: 56, attackSpeed: 1.4, range: 160, critRate: 0.3, critDamage: 2.0,
      magicPen: 0.4, skillPower: 1.8, maxHp: 280, maxMana: 100, manaOnHit: 16, manaRegen: 2,
    }),
  }),
  t({
    id: "jugo-limitless",
    name: "Jugo the Limitless", // homage: Satoru Gojo (Jujutsu Kaisen)
    rarity: "Unique",
    role: "damage",
    target: "Both",
    cost: 215,
    description:
      "A blindfolded sorcerer who folds the space around his foes into nothing, so no defense can hold. Insufferably confident — and entirely justified.",
    meta: {
      homage: "Satoru Gojo (Jujutsu Kaisen)",
      outfit: "A black high-collared coat with a white blindfold drawn over the eyes",
      weapon: { family: "curse", display: "Cursed energy that folds the space around his foes" },
    },
    passives: ["infinity", "six-eyes", "domain"],
    active: "hollow-purple",
    behavior: { activeType: "True" },
    baseStats: makeStats({
      atk: 52, attackSpeed: 0.85, range: 165, critRate: 0.2, skillPower: 2.0,
      magicPen: 0.5, maxHp: 220, maxMana: 100, manaOnHit: 18, manaRegen: 2,
    }),
  }),
  t({
    id: "sota-caped-fist",
    name: "Sota the Caped Fist", // homage: Saitama (One Punch Man)
    rarity: "Unique",
    role: "damage",
    target: "Both",
    cost: 220,
    description:
      "A bored hero in a plain cape who ends most fights in a single, world-bending punch. Mostly worried about supermarket sales.",
    meta: {
      homage: "Saitama (One Punch Man)",
      outfit: "A plain yellow jumpsuit with a white cape and red gloves and boots, expression utterly bored",
      weapon: { family: "fist", heavy: true, display: "A single bare-fisted punch that ends everything" },
    },
    passives: ["no-limiter", "deadpan", "casual-stride"],
    active: "serious-punch",
    behavior: { activeType: "True" }, // one punch — nothing survives, nothing resists
    baseStats: makeStats({
      atk: 70, attackSpeed: 0.7, range: 100, critRate: 0.2, critDamage: 2.2,
      maxHp: 300, maxMana: 100, manaOnHit: 20, manaRegen: 1,
    }),
  }),

  // ============================ SPLASH ============================
  t({
    id: "pip-powderkeg",
    name: "Pip Powderkeg", // homage: Megumin (KonoSuba), as a junior dabbler
    rarity: "Common",
    role: "splash",
    target: "Ground",
    cost: 55,
    description:
      "An explosion-obsessed apprentice with more gunpowder than sense. Detonates one tiny boom, strikes a pose, and badly needs a nap.",
    meta: {
      homage: "Megumin as a junior dabbler (KonoSuba)",
      outfit: "An oversized crimson mage robe and witch hat with a single eyepatch, all far too big for her",
      weapon: { family: "gun", element: "fire", display: "Gunpowder, hand-lit bombs, and a stubby explosion wand" },
    },
    passives: ["loose-pin"],
    active: "frag-toss",
    behavior: { splashRadius: 55 },
    baseStats: makeStats({
      atk: 16, attackSpeed: 0.7, range: 110, maxHp: 120, maxMana: 70, manaOnHit: 11, manaRegen: 1,
    }),
  }),
  t({
    id: "iron-bo-cannonarm",
    name: "Iron Bo the Cannonarm", // homage: Franky (One Piece)
    rarity: "Magic",
    role: "splash",
    target: "Ground",
    cost: 85,
    description:
      "A cola-fueled cyborg shipwright who swapped both forearms for siege cannons. SUPER dependable, allegedly, as long as the soda holds.",
    meta: {
      homage: "Franky (One Piece)",
      outfit: "A loud Hawaiian shirt over a massive cyborg torso, blue pompadour and a star tattoo, metal forearms",
      weapon: { family: "gun", display: "Twin siege cannons built into both forearms" },
    },
    passives: ["siege-payload", "cola-boost"],
    active: "coup-de-burst",
    behavior: { splashRadius: 72 },
    baseStats: makeStats({
      atk: 24, attackSpeed: 0.6, range: 120, armorPen: 0.3, maxHp: 170,
      maxMana: 90, manaOnHit: 12, manaRegen: 1,
    }),
  }),
  t({
    id: "kanae-petalfall",
    name: "Kanae Petalfall", // homage: the Flower Hashira (Demon Slayer)
    rarity: "Rare",
    role: "splash",
    target: "Both",
    cost: 110,
    description:
      "A gentle blade-dancer whose every strike scatters a storm of razor petals. She smiles even as the field blooms crimson.",
    meta: {
      homage: "the Flower Hashira (Demon Slayer)",
      outfit: "A flowing pastel haori patterned with blossoms, hair pinned with a flower clasp",
      weapon: { family: "sword", enchanted: true, display: "A slender nichirin katana whose cuts scatter razor petals" },
    },
    passives: ["wide-bloom", "fuse-master"],
    active: "petal-storm",
    behavior: { splashRadius: 86 },
    baseStats: makeStats({
      atk: 30, attackSpeed: 0.7, range: 150, magicPen: 0.25, skillPower: 1.3,
      maxHp: 140, maxMana: 95, manaOnHit: 13, manaRegen: 2,
    }),
  }),
  t({
    id: "akagan-ashen",
    name: "Akagan the Ashen", // homage: Akainu / magma-logia (One Piece)
    rarity: "Legendary",
    role: "splash",
    target: "Ground",
    cost: 165,
    description:
      "An implacable warlord of molten judgment who drums the earth until it erupts beneath his enemies. Believes in absolute justice — strictly his own.",
    meta: {
      homage: "Akainu / the magma-logia (One Piece)",
      outfit: "A warlord's double-breasted marine greatcoat and cap, grim and weathered",
      weapon: { family: "fist", element: "fire", enchanted: true, display: "Fists of erupting molten magma" },
    },
    passives: ["eruption", "molten-core", "aftershock"],
    active: "great-eruption",
    behavior: { splashRadius: 96 },
    baseStats: makeStats({
      atk: 42, attackSpeed: 0.65, range: 140, magicPen: 0.3, skillPower: 1.6,
      maxHp: 220, maxMana: 100, manaOnHit: 14, manaRegen: 2,
    }),
  }),
  t({
    id: "megu-explosion-sage",
    name: "Megu the Explosion Sage", // homage: Megumin at full power (KonoSuba)
    rarity: "Unique",
    role: "splash",
    target: "Both",
    cost: 205,
    description:
      "A one-trick archmage who has poured her entire being into a single, apocalyptic Explosion. Casts once, collapses grinning, regrets nothing.",
    meta: {
      homage: "Megumin at full power (KonoSuba)",
      outfit: "A crimson archmage robe and pointed witch hat with an eyepatch and fingerless gloves, mid dramatic pose",
      weapon: { family: "staff", element: "fire", display: "A gnarled wizard's staff that channels a single apocalyptic Explosion" },
    },
    passives: ["explosion-only", "crimson-pride", "overflow"],
    active: "explosion",
    behavior: { splashRadius: 120, activeType: "True" }, // the Explosion brooks no resistance
    baseStats: makeStats({
      atk: 38, attackSpeed: 0.5, range: 170, magicPen: 0.4, skillPower: 2.0,
      maxHp: 150, maxMana: 120, manaOnHit: 18, manaRegen: 2,
    }),
  }),

  // ============================ CHAIN ============================
  t({
    id: "tobi-skipstone",
    name: "Tobi the Skipstone", // homage: scrappy ninja trainees (e.g., Konohamaru, Naruto)
    rarity: "Common",
    role: "chain",
    target: "Both",
    cost: 55,
    description:
      "A mischievous trainee who skips energy-charged stones across a crowd just to show off. Surprisingly, infuriatingly effective.",
    meta: {
      homage: "scrappy ninja trainees such as Konohamaru (Naruto)",
      outfit: "A young ninja's blue trainee uniform with a long trailing scarf and goggles pushed up on the brow",
      weapon: { family: "thrown", display: "Energy-charged stones skipped across the crowd" },
    },
    passives: ["bounce"],
    active: "double-skip",
    behavior: { chainTargets: 2, chainFalloff: 0.6 },
    baseStats: makeStats({
      atk: 14, attackSpeed: 1.1, range: 125, maxHp: 100, maxMana: 60, manaOnHit: 10, manaRegen: 1,
    }),
  }),
  t({
    id: "zeni-spark",
    name: "Zeni the Spark", // homage: Zenitsu Agatsuma (Demon Slayer)
    rarity: "Magic",
    role: "chain",
    target: "Both",
    cost: 85,
    description:
      "A trembling coward who unleashes his single thunderclap form only while fast asleep — at which point lightning leaps from foe to foe.",
    meta: {
      homage: "Zenitsu Agatsuma (Demon Slayer)",
      outfit: "A bright yellow triangle-patterned haori over a black uniform, hair flopping over teary eyes",
      weapon: { family: "sword", element: "lightning", enchanted: true, display: "A lightning-etched nichirin katana, unleashed only while asleep" },
    },
    passives: ["conduit", "thunderclap"],
    active: "chain-lightning",
    behavior: { chainTargets: 3, chainFalloff: 0.7 },
    baseStats: makeStats({
      atk: 22, attackSpeed: 1.0, range: 140, magicPen: 0.25, skillPower: 1.3,
      maxHp: 120, maxMana: 80, manaOnHit: 13, manaRegen: 2,
    }),
  }),
  t({
    id: "hyo-frost-arc",
    name: "Hyo the Frost Arc", // homage: Toshiro Hitsugaya (Bleach)
    rarity: "Rare",
    role: "chain",
    target: "Both",
    cost: 110,
    description:
      "A child-prodigy captain wielding the strongest ice in the realm, whose frozen arcs ricochet through entire ranks. Cold of temper, colder of blade.",
    meta: {
      homage: "Toshiro Hitsugaya (Bleach)",
      outfit: "A captain's black robe under a white haori, white hair and a turquoise ice-toned sash",
      weapon: { family: "sword", element: "ice", enchanted: true, display: "An ice-releasing longsword that looses ricocheting frozen arcs" },
    },
    passives: ["cold-snap", "ricochet"],
    active: "glacial-chain",
    behavior: { chainTargets: 4, chainFalloff: 0.68 },
    baseStats: makeStats({
      atk: 28, attackSpeed: 0.9, range: 150, skillPower: 1.4, maxHp: 130,
      maxMana: 85, manaOnHit: 14, manaRegen: 2,
    }),
  }),
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
      outfit: "A simple turtleneck and shorts, spiky silver-white hair, lightning crawling over bare skin",
      weapon: { family: "fist", element: "lightning", enchanted: true, display: "Bare hands cloaked in crackling lightning" },
    },
    passives: ["godspeed", "whirlwind", "assassin-instinct"],
    active: "thunderbolt",
    behavior: { chainTargets: 5, chainFalloff: 0.74 },
    baseStats: makeStats({
      atk: 38, attackSpeed: 1.3, range: 150, critRate: 0.25, magicPen: 0.35, skillPower: 1.5,
      maxHp: 170, maxMana: 85, manaOnHit: 15, manaRegen: 2,
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
      outfit: "A dark high-collared cloak bearing a clan crest, black hair, one arm wrapped in storm-light",
      weapon: { family: "sword", element: "lightning", enchanted: true, display: "A lightning-charged chokuto that calls down a dragon of thunder" },
    },
    passives: ["sharingan", "chidori-stream", "vengeance"],
    active: "kirin",
    behavior: { chainTargets: 6, chainFalloff: 0.8, activeType: "True" }, // the descending lightning spares nothing
    baseStats: makeStats({
      atk: 46, attackSpeed: 1.2, range: 165, critRate: 0.3, critDamage: 1.9, magicPen: 0.4,
      skillPower: 1.7, maxHp: 200, maxMana: 100, manaOnHit: 16, manaRegen: 2,
    }),
  }),
];

export const TOWERS: CharacterDef[] = [...TOWERS_A, ...TOWERS_B, ...TOWERS_C];
