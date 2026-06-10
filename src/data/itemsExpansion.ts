/**
 * The 200-item homage expansion — 40 five-rarity item LINES (40 × 5 = 200 items)
 * paying ORIGINAL homage to famous gear from games, films, fiction, and myth.
 *
 * Each line is one famous-item homage spanning Worn→Mythic; the catalog's
 * RARITY_TIERS auto-balance the five tiers, and `archetypeFor` (or the explicit
 * `archetype` here) labels its build. The real source lives ONLY in the
 * designer-only `homage` field in itemLoreExpansion.ts and the `// homage:`
 * comments below — never in a player-facing name (a legal requirement).
 *
 * Distribution is deliberate: every accessory slot (Ring/Amulet/Pet) offers a
 * physical / magic / defense / utility option so a player can build a coherent
 * archetype. See docs/superpowers/specs/2026-06-10-item-archetypes-and-200-homage-expansion-design.md.
 */
import type { ItemLine } from "./items.ts";

export const EXPANSION_LINES: ItemLine[] = [
  // ── Weapons ───────────────────────────────────────────────────────────────
  // homage: Arthurian → Excalibur
  { id: "kingsworn-brand", base: "Kingsworn Brand", slot: "Weapon", weaponType: "Sword", archetype: "physical",
    primary: "physicalDamage", primaryBase: 0.09, stats: { atk: 17 }, affixPool: ["critRate", "armorPen", "atk"] },
  // homage: Dark Souls → Moonlight Greatsword
  { id: "moonlit-greatblade", base: "Moonlit Greatblade", slot: "Weapon", weaponType: "Sword", archetype: "magic",
    primary: "magicDamage", primaryBase: 0.16, stats: { atk: 12, skillPower: 0.18 }, affixPool: ["skillPower", "magicPen", "manaOnHit"] },
  // homage: Warcraft → Frostmourne
  { id: "rimewill-runeblade", base: "Rimewill Runeblade", slot: "Weapon", weaponType: "Sword", archetype: "physical",
    primary: "omnivamp", primaryBase: 0.04, stats: { atk: 15, omnivamp: 0.03 }, affixPool: ["omnivamp", "critRate", "armorPen"] },
  // homage: Final Fantasy VII → Buster Sword
  { id: "busterfell-cleaver", base: "Busterfell Cleaver", slot: "Weapon", weaponType: "Sword", archetype: "physical",
    primary: "physicalDamage", primaryBase: 0.10, stats: { atk: 20 }, affixPool: ["critDamage", "armorPen", "atk"] },
  // homage: Star Wars → the lightsaber
  { id: "emberlight-saber", base: "Emberlight Saber", slot: "Weapon", weaponType: "Sword", archetype: "magic",
    primary: "magicDamage", primaryBase: 0.14, stats: { atk: 13, skillPower: 0.12 }, affixPool: ["magicPen", "skillPower", "critRate"] },
  // homage: Diablo II → Windforce
  { id: "galewind-longbow", base: "Galewind Longbow", slot: "Weapon", weaponType: "Bow", archetype: "physical",
    primary: "attackSpeed", primaryBase: 0.12, stats: { atk: 13, attackSpeed: 0.2 }, affixPool: ["critRate", "critDamage", "range"] },
  // homage: Greek myth → the Bow of Apollo
  { id: "dawnsong-bow", base: "Dawnsong Bow", slot: "Weapon", weaponType: "Bow", archetype: "magic",
    primary: "magicDamage", primaryBase: 0.13, stats: { atk: 11, skillPower: 0.12 }, affixPool: ["magicPen", "skillPower", "range"] },
  // homage: The Dark Tower → the gunslinger's revolver
  { id: "peacekeeper-revolver", base: "Peacekeeper Revolver", slot: "Weapon", weaponType: "Gun", archetype: "physical",
    primary: "armorPen", primaryBase: 0.12, stats: { atk: 18, armorPen: 0.1 }, affixPool: ["critRate", "critDamage", "attackSpeed"] },
  // homage: Metroid → the arm cannon
  { id: "starhunter-cannon", base: "Starhunter Cannon", slot: "Weapon", weaponType: "Gun", archetype: "physical",
    primary: "physicalDamage", primaryBase: 0.11, stats: { atk: 19 }, affixPool: ["armorPen", "critRate", "attackSpeed"] },
  // homage: Harry Potter → the Elder Wand
  { id: "eldwood-wand", base: "Eldwood Wand", slot: "Weapon", weaponType: "Staff", archetype: "magic",
    primary: "skillPower", primaryBase: 0.15, stats: { atk: 10, skillPower: 0.2 }, affixPool: ["skillPower", "magicPen", "manaOnHit"] },
  // homage: Lovecraft → the Necronomicon
  { id: "dreadpage-codex", base: "Dreadpage Codex", slot: "Weapon", weaponType: "Tome", archetype: "magic",
    primary: "magicPen", primaryBase: 0.09, stats: { skillPower: 0.16, manaOnHit: 3 }, affixPool: ["magicPen", "skillPower", "manaOnHit"] },
  // homage: Capcom → Power Stone gauntlets
  { id: "titangrip-knuckles", base: "Titangrip Knuckles", slot: "Weapon", weaponType: "Fist", archetype: "physical",
    primary: "critDamage", primaryBase: 0.12, stats: { atk: 13, critDamage: 0.08 }, affixPool: ["critRate", "atk", "attackSpeed"] },

  // ── Body armor & helmets ──────────────────────────────────────────────────
  // homage: LOTR → the mithril shirt
  { id: "mithrilweave-shirt", base: "Mithrilweave Shirt", slot: "BodyArmor", archetype: "defense",
    primary: "damageReduction", primaryBase: 0.05, stats: { maxHp: 80, damageReduction: 0.03 }, affixPool: ["maxHp", "magicResist", "tenacity"] },
  // homage: Star Wars → beskar armor
  { id: "beskar-plate", base: "Beskar Plate", slot: "BodyArmor", archetype: "defense",
    primary: "armor", primaryBase: 0.10, stats: { maxHp: 95, armor: 14 }, affixPool: ["maxHp", "magicResist", "damageReduction"] },
  // homage: Dark Souls → Havel's armor
  { id: "havelthane-plate", base: "Havelthane Plate", slot: "BodyArmor", archetype: "defense",
    primary: "maxHp", primaryBase: 0.09, stats: { maxHp: 120, armor: 16 }, affixPool: ["armor", "maxHp", "tenacity"] },
  // homage: Skyrim → dragonscale armor
  { id: "dragonscale-mail", base: "Dragonscale Mail", slot: "BodyArmor", archetype: "defense",
    primary: "magicResist", primaryBase: 0.09, stats: { maxHp: 85, magicResist: 14 }, affixPool: ["magicResist", "maxHp", "damageReduction"] },
  // homage: Marvel → the vibranium shield
  { id: "sentinel-bulwark", base: "Sentinel Bulwark", slot: "BodyArmor", archetype: "defense",
    primary: "damageReduction", primaryBase: 0.05, stats: { maxHp: 100, armor: 12, damageReduction: 0.03 }, affixPool: ["maxHp", "armor", "magicResist"] },
  // homage: Final Fantasy → the Ribbon
  { id: "ribbon-circlet", base: "Ribbon Circlet", slot: "Helmet", archetype: "defense",
    primary: "tenacity", primaryBase: 0.08, stats: { maxHp: 55, tenacity: 0.06 }, affixPool: ["tenacity", "magicResist", "hpRegen"] },
  // homage: Greek myth → the Helm of Hades
  { id: "hadeshood-cowl", base: "Hadeshood Cowl", slot: "Helmet", archetype: "utility",
    primary: "moveSpeed", primaryBase: 0.10, stats: { moveSpeed: 16, critRate: 0.03 }, affixPool: ["moveSpeed", "critRate", "tenacity"] },
  // homage: generic knightly homage
  { id: "valor-greathelm", base: "Valor Greathelm", slot: "Helmet", archetype: "defense",
    primary: "maxHp", primaryBase: 0.07, stats: { maxHp: 75, armor: 6 }, affixPool: ["armor", "magicResist", "hpRegen"] },
  // homage: Doctor Strange → the Eye of Agamotto
  { id: "seerlight-circlet", base: "Seerlight Circlet", slot: "Helmet", archetype: "magic",
    primary: "skillPower", primaryBase: 0.09, stats: { manaOnHit: 4, skillPower: 0.08 }, affixPool: ["skillPower", "manaOnHit", "magicResist"] },

  // ── Gloves / boots / wings ────────────────────────────────────────────────
  // homage: Marvel → the Infinity Gauntlet
  { id: "titanhold-gauntlets", base: "Titanhold Gauntlets", slot: "Gloves", archetype: "physical",
    primary: "critDamage", primaryBase: 0.13, stats: { critDamage: 0.1, atk: 8 }, affixPool: ["critRate", "atk", "armorPen"] },
  // homage: generic rogue homage
  { id: "trickster-grips", base: "Trickster Grips", slot: "Gloves", archetype: "physical",
    primary: "critRate", primaryBase: 0.05, stats: { critRate: 0.04, critDamage: 0.06 }, affixPool: ["critDamage", "armorPen", "attackSpeed"] },
  // homage: folklore → the seven-league boots
  { id: "mistwalk-treads", base: "Mistwalk Treads", slot: "Boots", archetype: "utility",
    primary: "moveSpeed", primaryBase: 0.11, stats: { moveSpeed: 26 }, affixPool: ["moveSpeed", "tenacity", "goldFind"] },
  // homage: Norse myth → valkyrie wings
  { id: "valkyrie-pinions", base: "Valkyrie Pinions", slot: "Wing", archetype: "physical",
    primary: "attackSpeed", primaryBase: 0.08, stats: { moveSpeed: 24, attackSpeed: 0.06 }, affixPool: ["attackSpeed", "moveSpeed", "critRate"] },
  // homage: myth → the phoenix
  { id: "phoenix-pinions", base: "Phoenix Pinions", slot: "Wing", archetype: "magic",
    primary: "skillPower", primaryBase: 0.09, stats: { moveSpeed: 22, skillPower: 0.08 }, affixPool: ["skillPower", "hpRegen", "moveSpeed"] },

  // ── Rings — completes the ring archetype matrix ───────────────────────────
  // homage: Diablo II → the Stone of Jordan
  { id: "juggernaut-signet", base: "Juggernaut Signet", slot: "Ring", archetype: "physical",
    primary: "physicalDamage", primaryBase: 0.08, stats: { atk: 6 }, affixPool: ["atk", "critDamage", "armorPen"] },
  // homage: DC → a power ring
  { id: "archmage-loop", base: "Archmage Loop", slot: "Ring", archetype: "magic",
    primary: "skillPower", primaryBase: 0.10, stats: { skillPower: 0.08, manaOnHit: 2 }, affixPool: ["skillPower", "magicPen", "manaOnHit"] },
  // homage: generic ring of protection
  { id: "bulwark-band", base: "Bulwark Band", slot: "Ring", archetype: "defense",
    primary: "maxHp", primaryBase: 0.07, stats: { maxHp: 45, armor: 6 }, affixPool: ["armor", "maxHp", "damageReduction"] },
  // homage: LOTR → the One Ring (stealth + fortune read as mobility + gold)
  { id: "wayfarer-ring", base: "Wayfarer Ring", slot: "Ring", archetype: "utility",
    primary: "goldFind", primaryBase: 0.08, stats: { goldFind: 0.05, moveSpeed: 8 }, affixPool: ["goldFind", "moveSpeed", "tenacity"] },

  // ── Amulets ───────────────────────────────────────────────────────────────
  // homage: generic war-charm
  { id: "warpriest-talisman", base: "Warpriest Talisman", slot: "Amulet", archetype: "physical",
    primary: "critDamage", primaryBase: 0.11, stats: { atk: 6, critDamage: 0.06 }, affixPool: ["critRate", "atk", "armorPen"] },
  // homage: Elder Scrolls → the Amulet of Kings
  { id: "archon-amulet", base: "Archon Amulet", slot: "Amulet", archetype: "magic",
    primary: "magicPen", primaryBase: 0.08, stats: { skillPower: 0.08, magicPen: 0.05 }, affixPool: ["magicPen", "skillPower", "manaOnHit"] },
  // homage: generic ward
  { id: "wardstone-amulet", base: "Wardstone Amulet", slot: "Amulet", archetype: "defense",
    primary: "magicResist", primaryBase: 0.08, stats: { magicResist: 10, maxHp: 40 }, affixPool: ["magicResist", "maxHp", "tenacity"] },
  // homage: Greek myth → the touch of Midas
  { id: "midas-locket", base: "Midas Locket", slot: "Amulet", archetype: "utility",
    primary: "goldFind", primaryBase: 0.09, stats: { goldFind: 0.07 }, affixPool: ["goldFind", "manaOnKill", "moveSpeed"] },
  // homage: Marvel → the arc reactor
  { id: "heartforge-pendant", base: "Heartforge Pendant", slot: "Amulet", archetype: "defense",
    primary: "hpRegen", primaryBase: 0.10, stats: { hpRegen: 5, maxHp: 50 }, affixPool: ["hpRegen", "maxHp", "damageReduction"] },

  // ── Pets — adds combat / mystic / guardian pets beyond gold ───────────────
  // homage: A Song of Ice and Fire → a direwolf
  { id: "direwolf-cub", base: "Direwolf Cub", slot: "Pet", archetype: "physical",
    primary: "critRate", primaryBase: 0.05, stats: { critRate: 0.04, atk: 5 }, affixPool: ["critDamage", "atk", "attackSpeed"] },
  // homage: Zelda → the fairy companion
  { id: "arcane-wisp", base: "Arcane Wisp", slot: "Pet", archetype: "magic",
    primary: "skillPower", primaryBase: 0.10, stats: { skillPower: 0.08, manaOnHit: 2 }, affixPool: ["skillPower", "manaOnHit", "magicPen"] },
  // homage: folklore → the iron golem
  { id: "iron-sentinel-chibi", base: "Iron Sentinel", slot: "Pet", archetype: "defense",
    primary: "maxHp", primaryBase: 0.08, stats: { maxHp: 50, armor: 6 }, affixPool: ["maxHp", "armor", "magicResist"] },
  // homage: Japanese folklore → the lucky tanuki
  { id: "lucky-tanuki", base: "Lucky Tanuki", slot: "Pet", archetype: "utility", pet: true,
    primary: "goldFind", primaryBase: 0.12, stats: { goldFind: 0.12 }, affixPool: ["goldFind", "hpRegen"] },
  // homage: myth → the nine-tailed fox
  { id: "emberfox-kit", base: "Emberfox Kit", slot: "Pet", archetype: "magic",
    primary: "manaOnHit", primaryBase: 4, stats: { manaOnHit: 3, skillPower: 0.06 }, affixPool: ["manaOnHit", "skillPower", "manaOnKill"] },
];
