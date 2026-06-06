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

function t(def: Omit<CharacterDef, "artRef">): CharacterDef {
  return { ...def, artRef: "placeholder" };
}

export const TOWERS: CharacterDef[] = [
  // ============================ DAMAGE ============================
  t({
    id: "yamo-desert-bandit",
    name: "Yamo the Desert Bandit", // homage: Yamcha (Dragon Ball) — famously outclassed
    rarity: "Common",
    role: "damage",
    damageType: "Physical",
    target: "Both",
    cost: 45,
    description:
      "A reformed bandit and eager martial artist who never quite escapes the punchline. Hits harder than anyone gives him credit for.",
    passives: ["wolf-fang"],
    active: "spirit-ball",
    baseStats: makeStats({
      atk: 13, attackSpeed: 1.3, range: 130, critRate: 0.1, maxHp: 120,
      maxMana: 60, manaOnHit: 8, manaRegen: 1,
    }),
  }),
  t({
    id: "kazu-spirit-brawler",
    name: "Kazu the Spirit Brawler", // homage: Kazuma Kuwabara (YuYu Hakusho)
    rarity: "Magic",
    role: "damage",
    damageType: "Magic",
    target: "Ground",
    cost: 70,
    description:
      "A loud-mouthed street tough with a heart of gold and a blade of pure spirit energy. Loyal to a fault, tougher than he looks.",
    passives: ["spirit-sword", "street-code"],
    active: "dimensional-slash",
    baseStats: makeStats({
      atk: 22, attackSpeed: 1.1, range: 105, critRate: 0.15, maxHp: 170,
      maxMana: 70, manaOnHit: 12, manaRegen: 1,
    }),
  }),
  t({
    id: "zoran-thricedraw",
    name: "Zoran Thricedraw", // homage: Roronoa Zoro (One Piece)
    rarity: "Rare",
    role: "damage",
    damageType: "Physical",
    target: "Ground",
    cost: 100,
    description:
      "A three-blade swordsman — one in each hand and one in his teeth — chasing a vow to be the greatest. Reliably gets lost walking in a straight line.",
    passives: ["three-sword-style", "first-strike"],
    active: "iaido-slash",
    baseStats: makeStats({
      atk: 30, attackSpeed: 1.1, range: 95, critRate: 0.25, critDamage: 1.9,
      armorPen: 0.4, omnivamp: 0.1, maxHp: 210, maxMana: 70, manaOnHit: 14, manaRegen: 1,
    }),
  }),
  t({
    id: "prince-vael",
    name: "Prince Vael", // homage: Vegeta (Dragon Ball)
    rarity: "Legendary",
    role: "damage",
    damageType: "Physical",
    target: "Ground",
    cost: 160,
    description:
      "The exiled heir of a warrior race, too proud to lose and too stubborn to fall. His final flash answers to no armor.",
    passives: ["royal-pride", "galick-surge", "perfect-form"],
    active: "final-flash",
    behavior: { activeType: "True" }, // ultimate pierces all defense
    baseStats: makeStats({
      atk: 44, attackSpeed: 1.4, range: 110, critRate: 0.35, critDamage: 2.0,
      armorPen: 0.45, omnivamp: 0.12, maxHp: 260, maxMana: 85, manaOnHit: 13, manaRegen: 1,
    }),
  }),
  t({
    id: "karu-sunfist",
    name: "Karu Sunfist", // homage: Son Goku (Dragon Ball)
    rarity: "Unique",
    role: "damage",
    damageType: "Magic",
    target: "Both",
    cost: 210,
    description:
      "An orphan martial artist with a bottomless appetite and a brighter grin, who turns sunlight into world-shaking ki and seeks the strong just to feel alive.",
    passives: ["boundless-ki", "instinct", "second-wind"],
    active: "kamefist-wave",
    behavior: { activeType: "True" }, // signature beam ignores defense
    baseStats: makeStats({
      atk: 56, attackSpeed: 1.4, range: 175, critRate: 0.3, critDamage: 2.0,
      magicPen: 0.4, skillPower: 1.8, maxHp: 280, maxMana: 100, manaOnHit: 16, manaRegen: 2,
    }),
  }),
  t({
    id: "jugo-limitless",
    name: "Jugo the Limitless", // homage: Satoru Gojo (Jujutsu Kaisen)
    rarity: "Unique",
    role: "damage",
    damageType: "Magic",
    target: "Both",
    cost: 215,
    description:
      "A blindfolded sorcerer who folds the space around his foes into nothing, so no defense can hold. Insufferably confident — and entirely justified.",
    passives: ["infinity", "six-eyes", "domain"],
    active: "hollow-purple",
    behavior: { activeType: "True" },
    baseStats: makeStats({
      atk: 52, attackSpeed: 0.85, range: 185, critRate: 0.2, skillPower: 2.0,
      magicPen: 0.5, maxHp: 220, maxMana: 100, manaOnHit: 18, manaRegen: 2,
    }),
  }),
  t({
    id: "sota-caped-fist",
    name: "Sota the Caped Fist", // homage: Saitama (One Punch Man)
    rarity: "Unique",
    role: "damage",
    damageType: "Physical",
    target: "Both",
    cost: 220,
    description:
      "A bored hero in a plain cape who ends most fights in a single, world-bending punch. Mostly worried about supermarket sales.",
    passives: ["no-limiter", "deadpan", "casual-stride"],
    active: "serious-punch",
    behavior: { activeType: "True" }, // one punch — nothing survives, nothing resists
    baseStats: makeStats({
      atk: 70, attackSpeed: 0.7, range: 150, critRate: 0.2, critDamage: 2.2,
      maxHp: 300, maxMana: 100, manaOnHit: 20, manaRegen: 1,
    }),
  }),

  // ============================ SPLASH ============================
  t({
    id: "pip-powderkeg",
    name: "Pip Powderkeg", // homage: Megumin (KonoSuba), as a junior dabbler
    rarity: "Common",
    role: "splash",
    damageType: "Physical",
    target: "Ground",
    cost: 55,
    description:
      "An explosion-obsessed apprentice with more gunpowder than sense. Detonates one tiny boom, strikes a pose, and badly needs a nap.",
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
    damageType: "Physical",
    target: "Ground",
    cost: 85,
    description:
      "A cola-fueled cyborg shipwright who swapped both forearms for siege cannons. SUPER dependable, allegedly, as long as the soda holds.",
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
    damageType: "Magic",
    target: "Both",
    cost: 110,
    description:
      "A gentle blade-dancer whose every strike scatters a storm of razor petals. She smiles even as the field blooms crimson.",
    passives: ["wide-bloom", "fuse-master"],
    active: "petal-storm",
    behavior: { splashRadius: 86 },
    baseStats: makeStats({
      atk: 30, attackSpeed: 0.7, range: 160, magicPen: 0.25, skillPower: 1.3,
      maxHp: 140, maxMana: 95, manaOnHit: 13, manaRegen: 2,
    }),
  }),
  t({
    id: "akagan-ashen",
    name: "Akagan the Ashen", // homage: Akainu / magma-logia (One Piece)
    rarity: "Legendary",
    role: "splash",
    damageType: "Magic",
    target: "Ground",
    cost: 165,
    description:
      "An implacable warlord of molten judgment who drums the earth until it erupts beneath his enemies. Believes in absolute justice — strictly his own.",
    passives: ["eruption", "molten-core", "aftershock"],
    active: "great-eruption",
    behavior: { splashRadius: 96 },
    baseStats: makeStats({
      atk: 42, attackSpeed: 0.65, range: 150, magicPen: 0.3, skillPower: 1.6,
      maxHp: 220, maxMana: 100, manaOnHit: 14, manaRegen: 2,
    }),
  }),
  t({
    id: "megu-explosion-sage",
    name: "Megu the Explosion Sage", // homage: Megumin at full power (KonoSuba)
    rarity: "Unique",
    role: "splash",
    damageType: "Magic",
    target: "Both",
    cost: 205,
    description:
      "A one-trick archmage who has poured her entire being into a single, apocalyptic Explosion. Casts once, collapses grinning, regrets nothing.",
    passives: ["explosion-only", "crimson-pride", "overflow"],
    active: "explosion",
    behavior: { splashRadius: 120, activeType: "True" }, // the Explosion brooks no resistance
    baseStats: makeStats({
      atk: 38, attackSpeed: 0.5, range: 190, magicPen: 0.4, skillPower: 2.0,
      maxHp: 150, maxMana: 120, manaOnHit: 18, manaRegen: 2,
    }),
  }),

  // ============================ CHAIN ============================
  t({
    id: "tobi-skipstone",
    name: "Tobi the Skipstone", // homage: scrappy ninja trainees (e.g., Konohamaru, Naruto)
    rarity: "Common",
    role: "chain",
    damageType: "Physical",
    target: "Both",
    cost: 55,
    description:
      "A mischievous trainee who skips energy-charged stones across a crowd just to show off. Surprisingly, infuriatingly effective.",
    passives: ["bounce"],
    active: "double-skip",
    behavior: { chainTargets: 2, chainFalloff: 0.6 },
    baseStats: makeStats({
      atk: 14, attackSpeed: 1.1, range: 130, maxHp: 100, maxMana: 60, manaOnHit: 10, manaRegen: 1,
    }),
  }),
  t({
    id: "zeni-spark",
    name: "Zeni the Spark", // homage: Zenitsu Agatsuma (Demon Slayer)
    rarity: "Magic",
    role: "chain",
    damageType: "Magic",
    target: "Both",
    cost: 85,
    description:
      "A trembling coward who unleashes his single thunderclap form only while fast asleep — at which point lightning leaps from foe to foe.",
    passives: ["conduit", "thunderclap"],
    active: "chain-lightning",
    behavior: { chainTargets: 3, chainFalloff: 0.7 },
    baseStats: makeStats({
      atk: 22, attackSpeed: 1.0, range: 150, magicPen: 0.25, skillPower: 1.3,
      maxHp: 120, maxMana: 80, manaOnHit: 13, manaRegen: 2,
    }),
  }),
  t({
    id: "hyo-frost-arc",
    name: "Hyo the Frost Arc", // homage: Toshiro Hitsugaya (Bleach)
    rarity: "Rare",
    role: "chain",
    damageType: "Magic",
    target: "Both",
    cost: 110,
    description:
      "A child-prodigy captain wielding the strongest ice in the realm, whose frozen arcs ricochet through entire ranks. Cold of temper, colder of blade.",
    passives: ["cold-snap", "ricochet"],
    active: "glacial-chain",
    behavior: { chainTargets: 4, chainFalloff: 0.68 },
    baseStats: makeStats({
      atk: 28, attackSpeed: 0.9, range: 165, skillPower: 1.4, maxHp: 130,
      maxMana: 85, manaOnHit: 14, manaRegen: 2,
    }),
  }),
  t({
    id: "kilo-lightning-hand",
    name: "Kilo the Lightning Hand", // homage: Killua Zoldyck (Hunter x Hunter)
    rarity: "Legendary",
    role: "chain",
    damageType: "Magic",
    target: "Both",
    cost: 155,
    description:
      "A former assassin prodigy who cloaks himself in lightning and moves faster than thought, striking a dozen foes in a heartbeat.",
    passives: ["godspeed", "whirlwind", "assassin-instinct"],
    active: "thunderbolt",
    behavior: { chainTargets: 5, chainFalloff: 0.74 },
    baseStats: makeStats({
      atk: 38, attackSpeed: 1.3, range: 160, critRate: 0.25, magicPen: 0.35, skillPower: 1.5,
      maxHp: 170, maxMana: 85, manaOnHit: 15, manaRegen: 2,
    }),
  }),
  t({
    id: "sasu-stormblade",
    name: "Sasu the Stormblade", // homage: Sasuke Uchiha (Naruto)
    rarity: "Unique",
    role: "chain",
    damageType: "Magic",
    target: "Both",
    cost: 205,
    description:
      "A brooding clan-last prodigy who calls down a dragon of lightning to leap between every enemy on the field. Power chased at a terrible price.",
    passives: ["sharingan", "chidori-stream", "vengeance"],
    active: "kirin",
    behavior: { chainTargets: 6, chainFalloff: 0.8, activeType: "True" }, // the descending lightning spares nothing
    baseStats: makeStats({
      atk: 46, attackSpeed: 1.2, range: 180, critRate: 0.3, critDamage: 1.9, magicPen: 0.4,
      skillPower: 1.7, maxHp: 200, maxMana: 100, manaOnHit: 16, manaRegen: 2,
    }),
  }),

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
    passives: ["hundred-healings", "monster-strength", "sannin-resolve"],
    active: "creation-rebirth",
    behavior: { buffAura: { radius: 185, atkPct: 0.25, attackSpeedPct: 0.18 } },
    baseStats: makeStats({ atk: 16, attackSpeed: 0.8, range: 160, maxHp: 260, maxMana: 0 }),
  }),
];
