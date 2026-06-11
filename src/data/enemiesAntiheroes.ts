/**
 * The Antihero Gallery — 10 original bosses, each an homage to a beloved
 * anti-hero from anime/movies/stories. The real inspiration lives ONLY in a
 * `// homage:` comment (never shipped as data); the `name` is original. Split out
 * of `enemies.ts` to keep that file under the 500-line cap; spread into `ENEMIES`
 * there alongside HOMAGE_BOSSES. All compose the existing boss/special kit — no
 * new engine code. See docs/superpowers/specs/2026-06-12-antihero-bosses-design.md
 * and [[project_homage_field_shipped]].
 */
import { makeStats, type EnemyDef } from "./schema.ts";

export const ANTIHERO_BOSSES: EnemyDef[] = [
  {
    id: "gravemourn", name: "Gravemourn the Black Reaver", // homage: Guts (Berserk)
    archetype: "Boss", flying: false, immunity: null, damageType: "Physical",
    bounty: 90, castleDamage: 8,
    baseStats: makeStats({ maxHp: 1150, armor: 30, moveSpeed: 34, atk: 40, attackSpeed: 1.2, tenacity: 0.5 }),
    weapon: { family: "sword", display: "a slab of iron too large to be called a sword", heavy: true },
    special: { attacksTowers: { range: 100 }, frenzy: { belowHpPct: 0.5, speedMult: 1.5, atkMult: 1.5 } },
    boss: {
      enrage: { belowHpPct: 0.5, atkMult: 1.6, speedMult: 1.6 },
      skill: { id: "gravemourn-cleave", name: "Berserker Cleave", description: "A wild horizontal cleave staggers nearby towers and rends the hero.", manaCost: 95, type: "quake", radius: 150, power: 0.16 },
    },
    artRef: "placeholder",
  },
  {
    id: "vindicator", name: "The Vindicator", // homage: The Punisher (Marvel)
    archetype: "Boss", flying: false, immunity: null, damageType: "Physical",
    bounty: 110, castleDamage: 9,
    baseStats: makeStats({ maxHp: 1350, armor: 35, moveSpeed: 28, atk: 52, attackSpeed: 1.3, tenacity: 0.5 }),
    weapon: { family: "thrown", display: "a relentless barrage of gunfire" },
    special: { attacksTowers: { range: 170 } }, // outranges the line — a race to kill
    boss: {
      enrage: { belowHpPct: 0.35, atkMult: 1.5, speedMult: 1.4 }, // "you can't kill me fast enough"
      skill: { id: "vindicator-barrage", name: "Suppressing Fire", description: "Rakes the line with fire — stuns nearby towers and batters the hero.", manaCost: 100, type: "quake", radius: 160, power: 0.18 },
    },
    artRef: "placeholder",
  },
  {
    id: "sundermark", name: "Sundermark the Vagrant", // homage: Scar (Fullmetal Alchemist)
    archetype: "Boss", flying: false, immunity: null, damageType: "Magic",
    bounty: 120, castleDamage: 10,
    baseStats: makeStats({ maxHp: 1500, armor: 28, magicResist: 30, moveSpeed: 30, atk: 44, attackSpeed: 1.0, tenacity: 0.55 }),
    weapon: { family: "fist", display: "a destroying right hand" },
    special: { attacksTowers: { range: 110 } },
    boss: {
      towerDisable: { radius: 120, duration: 2.5, interval: 9 },
      skill: { id: "sundermark-deconstruct", name: "Deconstruction", description: "Unmakes the matter of nearby towers and savages the hero.", manaCost: 105, type: "quake", radius: 150, power: 0.18 },
    },
    artRef: "placeholder",
  },
  {
    id: "crownfall", name: "Crownfall the Proud", // homage: Vegeta (Dragon Ball)
    archetype: "Boss", flying: false, immunity: null, damageType: "Magic",
    bounty: 130, castleDamage: 10,
    baseStats: makeStats({ maxHp: 1650, armor: 32, magicResist: 28, moveSpeed: 30, atk: 46, attackSpeed: 1.0, tenacity: 0.6 }),
    weapon: { family: "fist", display: "searing fists of energy", element: "fire", enchanted: true },
    boss: {
      summon: { enemyId: "imp", count: 2, interval: 7 },
      enrage: { belowHpPct: 0.45, atkMult: 2.0, speedMult: 1.7 }, // prideful power-up
      skill: { id: "crownfall-pride", name: "Galick Pride", description: "Erupts a prideful aura, shielding itself and its minions.", manaCost: 110, type: "barrier", radius: 180, power: 0.32 },
    },
    artRef: "placeholder",
  },
  {
    id: "unkilling", name: "The Unkilling", // homage: Wolverine (X-Men)
    archetype: "Boss", flying: false, immunity: null, damageType: "Physical",
    bounty: 150, castleDamage: 11,
    baseStats: makeStats({ maxHp: 1950, armor: 34, moveSpeed: 32, atk: 42, attackSpeed: 1.3, hpRegen: 60, tenacity: 0.7 }),
    weapon: { family: "fist", display: "three slashing claws" },
    special: { frenzy: { belowHpPct: 0.4, speedMult: 1.5, atkMult: 1.6 } },
    boss: {
      enrage: { belowHpPct: 0.4, atkMult: 1.5, speedMult: 1.4 },
      skill: { id: "unkilling-mend", name: "Healing Factor", description: "Knits its wounds shut, restoring a burst of health.", manaCost: 90, type: "rally", radius: 120, power: 0.22 },
    },
    artRef: "placeholder",
  },
  {
    id: "mawborn", name: "The Hungering Other", // homage: Venom (symbiote)
    archetype: "Boss", flying: false, immunity: null, damageType: "Physical",
    bounty: 170, castleDamage: 12,
    baseStats: makeStats({ maxHp: 2250, armor: 36, moveSpeed: 28, atk: 48, attackSpeed: 1.0, tenacity: 0.6 }),
    weapon: { family: "fist", display: "lashing symbiotic tendrils" },
    special: { splitInto: { enemyId: "imp", count: 3 } },
    boss: {
      summon: { enemyId: "imp", count: 2, interval: 6 },
      enrage: { belowHpPct: 0.4, atkMult: 1.6, speedMult: 1.5 },
      skill: { id: "mawborn-swarm", name: "Spawn the Brood", description: "Splits off a writhing brood of spawn.", manaCost: 110, type: "summon-surge", power: 4, summonId: "imp" },
    },
    artRef: "placeholder",
  },
  {
    id: "devourer", name: "The Devouring Heir", // homage: Eren Yeager / the Titans (Attack on Titan)
    archetype: "Boss", flying: false, immunity: null, damageType: "Physical",
    bounty: 185, castleDamage: 13,
    baseStats: makeStats({ maxHp: 2400, armor: 40, moveSpeed: 22, atk: 54, attackSpeed: 0.85, tenacity: 0.65 }),
    weapon: { family: "fist", display: "titanic crushing fists" },
    boss: {
      summon: { enemyId: "brute", count: 1, interval: 9 }, // a wall that breeds walls
      enrage: { belowHpPct: 0.4, atkMult: 1.7, speedMult: 1.5 },
      skill: { id: "devourer-rumbling", name: "The Rumbling", description: "Calls a march of lesser titans to trample the line.", manaCost: 120, type: "summon-surge", power: 3, summonId: "brute" },
    },
    artRef: "placeholder",
  },
  {
    id: "crimsonlord", name: "The Crimson Sovereign", // homage: Alucard (Hellsing)
    archetype: "Boss", flying: false, immunity: null, damageType: "Magic",
    bounty: 200, castleDamage: 13,
    baseStats: makeStats({ maxHp: 2600, armor: 30, magicResist: 38, moveSpeed: 26, atk: 50, attackSpeed: 1.1, hpRegen: 40, tenacity: 0.65 }),
    weapon: { family: "thrown", display: "twin blessed long-barreled pistols" },
    boss: {
      summon: { enemyId: "imp", count: 2, interval: 7 }, // raises familiars
      enrage: { belowHpPct: 0.4, atkMult: 1.6, speedMult: 1.5 },
      skill: { id: "crimsonlord-drain", name: "Crimson Feast", description: "Drains vitality from the field to heal itself and its familiars.", manaCost: 105, type: "rally", radius: 190, power: 0.2 },
    },
    artRef: "placeholder",
  },
  {
    id: "fallenward", name: "The Fallen Warden", // homage: Darth Vader (Star Wars)
    archetype: "Boss", flying: false, immunity: null, damageType: "Magic",
    bounty: 230, castleDamage: 15,
    baseStats: makeStats({ maxHp: 3100, armor: 45, magicResist: 35, moveSpeed: 24, atk: 56, attackSpeed: 0.9, tenacity: 0.7 }),
    weapon: { family: "sword", display: "a humming crimson energy blade", element: "fire", enchanted: true },
    boss: {
      towerDisable: { radius: 150, duration: 3.5, interval: 10 }, // dread "force choke"
      enrage: { belowHpPct: 0.4, atkMult: 1.6, speedMult: 1.4 },
      skill: { id: "fallenward-choke", name: "Dread Choke", description: "An unseen grip silences the towers and crushes the hero.", manaCost: 115, type: "barrier", radius: 180, power: 0.34 },
    },
    artRef: "placeholder",
  },
  {
    id: "ashghost", name: "The Ashen Ghost", // homage: Kratos (God of War)
    archetype: "Boss", flying: false, immunity: null, damageType: "Physical",
    bounty: 300, castleDamage: 20,
    baseStats: makeStats({ maxHp: 4200, armor: 55, magicResist: 35, moveSpeed: 24, atk: 70, attackSpeed: 1.0, hpRegen: 16, tenacity: 0.8 }),
    weapon: { family: "thrown", display: "twin chained blades wreathed in ash", element: "fire", enchanted: true },
    boss: { // the apex: the works
      summon: { enemyId: "imp", count: 2, interval: 7 },
      towerDisable: { radius: 140, duration: 3, interval: 11 },
      enrage: { belowHpPct: 0.4, atkMult: 2.0, speedMult: 1.7 },
      skill: { id: "ashghost-rage", name: "Spartan Rage", description: "An eruption of ash and fury devastates the hero and silences nearby towers.", manaCost: 120, type: "quake", radius: 200, power: 0.24 },
    },
    artRef: "placeholder",
  },
];
