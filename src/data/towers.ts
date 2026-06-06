/**
 * Character / tower catalog — 32 ORIGINAL homage characters, each channelling an
 * iconic all-time anime archetype without copying any real name, likeness, or
 * protected element (the legally-safe "inspired by" approach from the design).
 *
 * The `// homage:` comment on each entry records the inspiration for designers;
 * it is NOT shipped to players. The player-facing `description` lore is original.
 *
 * Each character carries its own mana bar (on-hit mana -> auto-cast active) and
 * role-driven `behavior` tuning. Stats are the Normal baseline.
 */
import { makeStats, type CharacterDef } from "./schema.ts";

/** Add the placeholder art reference so entries stay concise. */
function t(def: Omit<CharacterDef, "artRef">): CharacterDef {
  return { ...def, artRef: "placeholder" };
}

export const TOWERS: CharacterDef[] = [
  // ===================== DAMAGE (single-target) =====================
  t({
    id: "verdant-archer",
    name: "Brae the Keen-Eye", // homage: Sasha Braus (Attack on Titan)
    rarity: "Common",
    role: "damage",
    damageType: "Physical",
    target: "Both",
    cost: 50,
    description:
      "A famished forest scout whose arrows never miss a meal — or a monster. She'd trade her bow for a hot potato, but not until the wave is cleared.",
    passives: ["keen-eye"],
    active: "volley",
    baseStats: makeStats({
      atk: 16, attackSpeed: 1.3, range: 145, critRate: 0.1, maxHp: 120,
      maxMana: 60, manaOnHit: 8, manaRegen: 1,
    }),
  }),
  t({
    id: "pebble-slinger",
    name: "Gio the Wildling", // homage: Gon Freecss (Hunter x Hunter)
    rarity: "Common",
    role: "damage",
    damageType: "Physical",
    target: "Both",
    cost: 40,
    description:
      "A barefoot boy raised by beasts, hurling stones with uncanny instinct. Endlessly cheerful, endlessly hungry for the next adventure.",
    passives: ["quick-hands"],
    active: "rock-toss",
    baseStats: makeStats({
      atk: 12, attackSpeed: 1.5, range: 120, maxHp: 100, maxMana: 50, manaOnHit: 7, manaRegen: 1,
    }),
  }),
  t({
    id: "ronin-of-ash",
    name: "Zoran Thricedraw", // homage: Roronoa Zoro (One Piece)
    rarity: "Rare",
    role: "damage",
    damageType: "Physical",
    target: "Ground",
    cost: 95,
    description:
      "A wandering swordsman who fights with three blades — one in each hand and one in his teeth — chasing a vow to become the world's greatest. Gets lost walking in a straight line.",
    passives: ["blade-flow", "first-strike"],
    active: "iaido-slash",
    baseStats: makeStats({
      atk: 40, attackSpeed: 1.1, range: 90, critRate: 0.25, critDamage: 1.9,
      armorPen: 0.4, omnivamp: 0.1, maxHp: 200, maxMana: 70, manaOnHit: 14, manaRegen: 1,
    }),
  }),
  t({
    id: "skywatch-marksman",
    name: "Vance the Drifting Gunhand", // homage: Vash the Stampede (Trigun)
    rarity: "Rare",
    role: "damage",
    damageType: "Physical",
    target: "Both",
    cost: 110,
    description:
      "A red-coated gunslinger with a pacifist's heart and a marksman's aim, wanted across nine provinces for property damage he swears he never meant to cause.",
    passives: ["high-ground", "armor-breaker", "steady-aim"],
    active: "piercing-shot",
    baseStats: makeStats({
      atk: 46, attackSpeed: 0.5, range: 235, critRate: 0.25, critDamage: 1.8,
      armorPen: 0.5, maxHp: 90, maxMana: 70, manaOnHit: 16, manaRegen: 1,
    }),
  }),
  t({
    id: "emberwell-adept",
    name: "Rynn Tohwa", // homage: Rin Tohsaka (Fate/stay night)
    rarity: "Rare",
    role: "damage",
    damageType: "Magic",
    target: "Both",
    cost: 95,
    description:
      "A proud magus of a fading bloodline who fuels her spellcraft with jewel-bound mana. Brilliant, impeccably composed, and absolutely not blushing.",
    passives: ["arcane-focus", "mana-font"],
    active: "ember-bolt",
    baseStats: makeStats({
      atk: 24, attackSpeed: 0.9, range: 155, magicPen: 0.3, skillPower: 1.4,
      maxHp: 110, maxMana: 80, manaOnHit: 14, manaRegen: 2,
    }),
  }),
  t({
    id: "duelist-prince",
    name: "Prince Vael", // homage: Vegeta (Dragon Ball)
    rarity: "Legendary",
    role: "damage",
    damageType: "Physical",
    target: "Ground",
    cost: 160,
    description:
      "The exiled heir of a warrior race, too proud to lose and too stubborn to fall. Trains without rest to surpass the one rival he will never admit he respects.",
    passives: ["riposte", "noble-resolve", "perfect-form"],
    active: "thousand-cuts",
    baseStats: makeStats({
      atk: 58, attackSpeed: 1.4, range: 100, critRate: 0.35, critDamage: 2.0,
      armorPen: 0.45, omnivamp: 0.15, maxHp: 240, maxMana: 80, manaOnHit: 12, manaRegen: 1,
    }),
  }),
  t({
    id: "thunder-fist",
    name: "Karu Sunfist", // homage: Son Goku (Dragon Ball)
    rarity: "Legendary",
    role: "damage",
    damageType: "Magic",
    target: "Both",
    cost: 155,
    description:
      "An orphan martial artist with a bottomless appetite and a brighter grin, who turns sunlight into world-shaking ki. Seeks out the strong just to feel alive.",
    passives: ["overcharge", "static-veins", "second-wind"],
    active: "lightning-palm",
    baseStats: makeStats({
      atk: 44, attackSpeed: 1.3, range: 150, magicPen: 0.35, skillPower: 1.5,
      maxHp: 180, maxMana: 90, manaOnHit: 16, manaRegen: 2,
    }),
  }),
  t({
    id: "voidcaller",
    name: "Jugo the Limitless", // homage: Satoru Gojo (Jujutsu Kaisen)
    rarity: "Unique",
    role: "damage",
    damageType: "True",
    target: "Both",
    cost: 200,
    description:
      "A blindfolded sorcerer who folds the space around his foes into nothing, so no defense can hold. Insufferably confident — and entirely justified.",
    passives: ["entropy", "null-field", "ascendant"],
    active: "oblivion-lance",
    baseStats: makeStats({
      atk: 50, attackSpeed: 0.8, range: 180, critRate: 0.2, skillPower: 1.8,
      maxHp: 160, maxMana: 100, manaOnHit: 18, manaRegen: 2,
    }),
  }),

  // ===================== SPLASH (AoE) =====================
  t({
    id: "grenadier-pup",
    name: "Pip Powderkeg", // homage: Megumin (KonoSuba), junior
    rarity: "Common",
    role: "splash",
    damageType: "Physical",
    target: "Ground",
    cost: 55,
    description:
      "An explosion-obsessed apprentice who packs far more gunpowder than sense. Detonates one glorious blast, strikes a pose, then desperately needs a nap.",
    passives: ["loose-pin"],
    active: "frag-toss",
    behavior: { splashRadius: 55 },
    baseStats: makeStats({
      atk: 18, attackSpeed: 0.7, range: 110, maxHp: 120, maxMana: 70, manaOnHit: 11, manaRegen: 1,
    }),
  }),
  t({
    id: "bulwark-bombard",
    name: "Iron Bo the Cannonarm", // homage: Franky (One Piece)
    rarity: "Magic",
    role: "splash",
    damageType: "Physical",
    target: "Ground",
    cost: 80,
    description:
      "A cola-fueled cyborg shipwright who swapped both forearms for siege cannons. SUPER dependable, allegedly, as long as the soda holds out.",
    passives: ["siege-payload"],
    active: "mortar-barrage",
    behavior: { splashRadius: 70 },
    baseStats: makeStats({
      atk: 26, attackSpeed: 0.6, range: 120, armorPen: 0.3, maxHp: 160,
      maxMana: 90, manaOnHit: 12, manaRegen: 1,
    }),
  }),
  t({
    id: "blossom-mortar",
    name: "Kanae Petalfall", // homage: the Flower Hashira (Demon Slayer)
    rarity: "Rare",
    role: "splash",
    damageType: "Magic",
    target: "Both",
    cost: 105,
    description:
      "A gentle blade-dancer whose every strike scatters a storm of razor petals. She smiles even as the whole battlefield blooms crimson.",
    passives: ["wide-bloom", "fuse-master"],
    active: "petal-storm",
    behavior: { splashRadius: 85 },
    baseStats: makeStats({
      atk: 30, attackSpeed: 0.7, range: 160, magicPen: 0.25, skillPower: 1.3,
      maxHp: 130, maxMana: 95, manaOnHit: 13, manaRegen: 2,
    }),
  }),
  t({
    id: "magma-drummer",
    name: "Akagan the Ashen", // homage: Akainu / magma-logia (One Piece)
    rarity: "Legendary",
    role: "splash",
    damageType: "Magic",
    target: "Ground",
    cost: 165,
    description:
      "An implacable warlord of molten judgment who drums the earth until it erupts beneath his enemies. Believes in absolute justice — strictly his own.",
    passives: ["eruption", "molten-core", "aftershock"],
    active: "caldera",
    behavior: { splashRadius: 95 },
    baseStats: makeStats({
      atk: 40, attackSpeed: 0.65, range: 150, magicPen: 0.3, skillPower: 1.6,
      maxHp: 200, maxMana: 100, manaOnHit: 14, manaRegen: 2,
    }),
  }),
  t({
    id: "tempest-dancer",
    name: "Sera Skydancer", // homage: weather/storm masters (e.g., Nami, One Piece)
    rarity: "Unique",
    role: "splash",
    damageType: "True",
    target: "Both",
    cost: 195,
    description:
      "A sky-priestess who waltzes inside typhoons, scattering foes with edges of pure wind that no armor was ever forged to stop.",
    passives: ["cyclone", "windborne", "eye-of-storm"],
    active: "maelstrom",
    behavior: { splashRadius: 90 },
    baseStats: makeStats({
      atk: 36, attackSpeed: 0.9, range: 170, skillPower: 1.7, maxHp: 170,
      maxMana: 100, manaOnHit: 16, manaRegen: 2,
    }),
  }),

  // ===================== CHAIN =====================
  t({
    id: "spark-weaver",
    name: "Zeni the Spark", // homage: Zenitsu Agatsuma (Demon Slayer)
    rarity: "Magic",
    role: "chain",
    damageType: "Magic",
    target: "Both",
    cost: 85,
    description:
      "A trembling coward of a swordsman who only unleashes his single thunderclap form while fast asleep — at which point lightning leaps from foe to foe.",
    passives: ["conduit"],
    active: "chain-lightning",
    behavior: { chainTargets: 3, chainFalloff: 0.7 },
    baseStats: makeStats({
      atk: 20, attackSpeed: 1.0, range: 150, magicPen: 0.25, skillPower: 1.3,
      maxHp: 110, maxMana: 80, manaOnHit: 13, manaRegen: 2,
    }),
  }),
  t({
    id: "frost-arc",
    name: "Hyo the Frost Arc", // homage: Toshiro Hitsugaya (Bleach)
    rarity: "Rare",
    role: "chain",
    damageType: "Magic",
    target: "Both",
    cost: 100,
    description:
      "A child-prodigy captain wielding the strongest ice in the realm, whose frozen arcs ricochet through entire ranks. Cold of temper, colder of blade.",
    passives: ["cold-snap", "ricochet"],
    active: "glacial-chain",
    behavior: { chainTargets: 4, chainFalloff: 0.65 },
    baseStats: makeStats({
      atk: 22, attackSpeed: 0.9, range: 160, skillPower: 1.4, maxHp: 120,
      maxMana: 85, manaOnHit: 14, manaRegen: 2,
    }),
  }),
  t({
    id: "bladestorm-twins",
    name: "The Ren Twins", // homage: hyper-speed blade duos (e.g., Levi, AoT)
    rarity: "Legendary",
    role: "chain",
    damageType: "Physical",
    target: "Ground",
    cost: 150,
    description:
      "Two siblings who fight as a single whirling storm of steel, blades flickering between foes faster than the eye can follow.",
    passives: ["tandem", "whirling-edge", "bloodlink"],
    active: "crossfire",
    behavior: { chainTargets: 4, chainFalloff: 0.75 },
    baseStats: makeStats({
      atk: 34, attackSpeed: 1.2, range: 120, armorPen: 0.35, omnivamp: 0.1,
      maxHp: 190, maxMana: 80, manaOnHit: 12, manaRegen: 1,
    }),
  }),
  t({
    id: "skipping-stone",
    name: "Tobi the Skipstone", // homage: scrappy ninja trainees (e.g., Konohamaru, Naruto)
    rarity: "Common",
    role: "chain",
    damageType: "Physical",
    target: "Both",
    cost: 60,
    description:
      "A mischievous trainee who skips energy-charged stones across a crowd just to show off. Surprisingly, infuriatingly effective.",
    passives: ["bounce"],
    active: "double-skip",
    behavior: { chainTargets: 2, chainFalloff: 0.6 },
    baseStats: makeStats({
      atk: 15, attackSpeed: 1.1, range: 130, maxHp: 100, maxMana: 60, manaOnHit: 10, manaRegen: 1,
    }),
  }),

  // ===================== DOT =====================
  t({
    id: "venom-priestess",
    name: "Shion the Venom Priestess", // homage: poison/curse users (e.g., Shizuku/Shalnark, HxH)
    rarity: "Rare",
    role: "dot",
    damageType: "Magic",
    target: "Both",
    cost: 100,
    description:
      "A serene shrine-keeper who anoints her enemies with lingering toxins, murmuring soft prayers as they wither away.",
    passives: ["virulence", "lingering-toxin"],
    active: "plague-cloud",
    behavior: { dot: { dps: 16, duration: 4 } },
    baseStats: makeStats({
      atk: 14, attackSpeed: 1.0, range: 150, magicPen: 0.2, skillPower: 1.3,
      maxHp: 110, maxMana: 80, manaOnHit: 12, manaRegen: 2,
    }),
  }),
  t({
    id: "ember-fox",
    name: "Kona the Ember Fox", // homage: nine-tailed fox spirits (e.g., Kurama, Naruto)
    rarity: "Magic",
    role: "dot",
    damageType: "Magic",
    target: "Both",
    cost: 80,
    description:
      "A nine-tailed fox-spirit wearing the shape of a girl, trailing foxfire that smolders in a wound long after the strike lands.",
    passives: ["smolder"],
    active: "wildfire",
    behavior: { dot: { dps: 12, duration: 3.5 } },
    baseStats: makeStats({
      atk: 12, attackSpeed: 1.1, range: 140, skillPower: 1.2, maxHp: 100,
      maxMana: 70, manaOnHit: 11, manaRegen: 2,
    }),
  }),
  t({
    id: "plaguebearer",
    name: "Morren the Plaguebearer", // homage: decay/curse wielders (e.g., Mahito, JJK)
    rarity: "Legendary",
    role: "dot",
    damageType: "True",
    target: "Both",
    cost: 160,
    description:
      "A hollow-eyed wanderer who carries rot in his very veins, spreading a black corruption that armor and ward alike fail to stop.",
    passives: ["corrosion", "epidemic", "necrosis"],
    active: "black-rot",
    behavior: { dot: { dps: 26, duration: 5 } },
    baseStats: makeStats({
      atk: 16, attackSpeed: 1.0, range: 160, skillPower: 1.6, maxHp: 150,
      maxMana: 90, manaOnHit: 13, manaRegen: 2,
    }),
  }),
  t({
    id: "thornling",
    name: "Bram the Thornling", // homage: plant/wood users (e.g., mokuton, Naruto)
    rarity: "Common",
    role: "dot",
    damageType: "Physical",
    target: "Ground",
    cost: 45,
    description:
      "A tiny treant sprout that lashes passersby with barbed vines and grumbles, leaf by leaf, about trespassers on its patch.",
    passives: ["barbs"],
    active: "bramble",
    behavior: { dot: { dps: 7, duration: 3 } },
    baseStats: makeStats({
      atk: 8, attackSpeed: 1.0, range: 110, maxHp: 110, maxMana: 55, manaOnHit: 9, manaRegen: 1,
    }),
  }),

  // ===================== DEBUFF (slow / stun) =====================
  t({
    id: "frostward-maiden",
    name: "Yuki the Frostward Maiden", // homage: ice-queen generals (e.g., Esdeath, Akame ga Kill)
    rarity: "Rare",
    role: "debuff",
    damageType: "Magic",
    target: "Both",
    cost: 90,
    description:
      "A glacial sorceress who freezes the very air, slowing all who dare approach. Beautiful, merciless, and endlessly patient.",
    passives: ["deep-chill", "hoarfrost"],
    active: "blizzard",
    behavior: { slow: { pct: 0.4, duration: 2.5 } },
    baseStats: makeStats({
      atk: 12, attackSpeed: 1.0, range: 150, skillPower: 1.2, maxHp: 120,
      maxMana: 80, manaOnHit: 12, manaRegen: 2,
    }),
  }),
  t({
    id: "shackle-warden",
    name: "Garan Sandshackle", // homage: Gaara (Naruto)
    rarity: "Legendary",
    role: "debuff",
    damageType: "Physical",
    target: "Ground",
    cost: 150,
    description:
      "A somber warden who entombs charging foes in crushing sand, holding the line alone where lesser defenders would break.",
    passives: ["iron-grip", "concussion", "lockdown"],
    active: "earthshatter",
    behavior: { stun: { duration: 1.0, chance: 0.35 }, slow: { pct: 0.25, duration: 1.5 } },
    baseStats: makeStats({
      atk: 26, attackSpeed: 0.9, range: 130, armorPen: 0.3, maxHp: 210,
      maxMana: 85, manaOnHit: 13, manaRegen: 1,
    }),
  }),
  t({
    id: "mire-spirit",
    name: "Doro the Mire Spirit", // homage: swamp/mud yokai
    rarity: "Common",
    role: "debuff",
    damageType: "Magic",
    target: "Ground",
    cost: 55,
    description:
      "A bog-dwelling sprite that drags enemies down into sucking mud. Smells of fresh rain and very old secrets.",
    passives: ["sticky-mud"],
    active: "tar-pit",
    behavior: { slow: { pct: 0.3, duration: 2 } },
    baseStats: makeStats({
      atk: 8, attackSpeed: 0.9, range: 130, maxHp: 110, maxMana: 65, manaOnHit: 10, manaRegen: 1,
    }),
  }),
  t({
    id: "gale-djinn",
    name: "Zephyr the Gale Djinn", // homage: wish-granting storm spirits (e.g., Enel, One Piece)
    rarity: "Unique",
    role: "debuff",
    damageType: "True",
    target: "Both",
    cost: 190,
    description:
      "An ancient djinn of the high winds who cages foes in coils of stasis-wind. He grants wishes — rarely the ones anyone actually wanted.",
    passives: ["typhoon", "stasis-winds", "wish-granter"],
    active: "tempest-prison",
    behavior: { stun: { duration: 1.3, chance: 0.45 }, slow: { pct: 0.45, duration: 2.5 } },
    baseStats: makeStats({
      atk: 24, attackSpeed: 1.0, range: 170, skillPower: 1.5, maxHp: 160,
      maxMana: 95, manaOnHit: 15, manaRegen: 2,
    }),
  }),

  // ===================== SUPPORT (buff aura) =====================
  t({
    id: "banner-bearer",
    name: "Aldric the Banner-Bearer", // homage: rallying commanders (e.g., Erwin Smith, AoT)
    rarity: "Magic",
    role: "support",
    damageType: "Physical",
    target: "Ground",
    cost: 75,
    description:
      "A grizzled standard-bearer whose war-cry steels the resolve of every ally in sight. Dedicate your hearts — and hold the wall.",
    passives: ["rally"],
    active: "war-cry",
    behavior: { buffAura: { radius: 140, atkPct: 0.15 } },
    baseStats: makeStats({ atk: 6, attackSpeed: 0.8, range: 110, maxHp: 180, maxMana: 0 }),
  }),
  t({
    id: "tempo-bard",
    name: "Lyra Tempo", // homage: musician buffers (e.g., Brook, One Piece)
    rarity: "Rare",
    role: "support",
    damageType: "Magic",
    target: "Both",
    cost: 110,
    description:
      "A traveling musician whose battle-rhythm quickens her comrades' hands. One more song before the encore, yohoho.",
    passives: ["allegro", "encore"],
    active: "crescendo",
    behavior: { buffAura: { radius: 150, attackSpeedPct: 0.2 } },
    baseStats: makeStats({ atk: 8, attackSpeed: 0.8, range: 130, maxHp: 140, maxMana: 0 }),
  }),
  t({
    id: "celestial-herald",
    name: "Orin the Celestial Herald", // homage: rejection/shield healers (e.g., Orihime, Bleach)
    rarity: "Legendary",
    role: "support",
    damageType: "Magic",
    target: "Both",
    cost: 170,
    description:
      "A radiant herald who refuses to accept fate itself, wrapping allies in divine blessing and an aegis nothing can shatter.",
    passives: ["blessing", "aegis", "ascension"],
    active: "divine-hymn",
    behavior: { buffAura: { radius: 170, atkPct: 0.2, attackSpeedPct: 0.15 } },
    baseStats: makeStats({ atk: 10, attackSpeed: 0.8, range: 150, maxHp: 200, maxMana: 0 }),
  }),

  // ===================== ECONOMY (gold generation) =====================
  t({
    id: "coin-sprite",
    name: "Chibi the Coin Sprite", // homage: chibi fortune mascots
    rarity: "Common",
    role: "economy",
    damageType: "Physical",
    target: "Ground",
    cost: 60,
    description:
      "A palm-sized fortune spirit that sneezes out coins when excited. Hoards bottle caps, shiny pebbles, and the occasional real treasure.",
    passives: ["pocket-change"],
    active: null,
    behavior: { goldPerSec: 3 },
    baseStats: makeStats({ atk: 4, attackSpeed: 0.6, range: 90, maxHp: 90, maxMana: 0 }),
  }),
  t({
    id: "merchant-tanuki",
    name: "Ponta the Merchant", // homage: shapeshifting tanuki traders (e.g., Pom Poko)
    rarity: "Rare",
    role: "economy",
    damageType: "Physical",
    target: "Ground",
    cost: 120,
    description:
      "A shapeshifting raccoon-dog trader who always turns a profit, even mid-siege. Whatever you do, do not sign his contracts.",
    passives: ["haggle", "lucky-leaf"],
    active: null,
    behavior: { goldPerSec: 6 },
    baseStats: makeStats({ atk: 6, attackSpeed: 0.6, range: 100, maxHp: 120, maxMana: 0, goldFind: 0.1 }),
  }),
  t({
    id: "golden-koi",
    name: "Kinryu the Golden Koi", // homage: fortune dragons / ascending koi legend
    rarity: "Legendary",
    role: "economy",
    damageType: "Magic",
    target: "Both",
    cost: 180,
    description:
      "A koi that swam up the great falls and became a dragon of fortune, raining gold upon the defenders it chooses to favor.",
    passives: ["fortune-stream", "midas-scale", "abundance"],
    active: "coin-shower",
    behavior: { goldPerSec: 10 },
    baseStats: makeStats({
      atk: 10, attackSpeed: 0.7, range: 140, skillPower: 1.2, maxHp: 150,
      maxMana: 90, manaOnHit: 10, manaRegen: 2, goldFind: 0.15,
    }),
  }),
  t({
    id: "piggy-sentinel",
    name: "Buta the Piggy Sentinel", // homage: piggy-bank guardian mascots
    rarity: "Magic",
    role: "economy",
    damageType: "Physical",
    target: "Ground",
    cost: 85,
    description:
      "A stout armored piglet that guards the war-chest with its life and skewers anyone foolish enough to reach for it.",
    passives: ["nest-egg"],
    active: null,
    behavior: { goldPerSec: 4 },
    baseStats: makeStats({ atk: 5, attackSpeed: 0.5, range: 95, maxHp: 200, maxMana: 0 }),
  }),
];
