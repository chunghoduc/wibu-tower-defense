# Phase 3a — Hero Progression Design

**Date:** 2026-06-06
**Status:** Approved
**Scope:** Hero leveling & XP, passive skill grid (PoE-scale), active skill slot, hero items & affix system, stat pipeline (layered), local save schema

---

## 1. Hero Leveling & XP System

### XP Sources (all three active)

- **Kill XP** — each enemy awards `baseXp × difficultyMultiplier` (Normal ×1, Hard ×1.5, Nightmare ×2). Bosses grant 5× base. Hero must be alive to receive kill XP.
- **Stage completion XP** — flat reward per stage, scaled by stage index and difficulty. The dominant XP source; kill XP is a bonus.
- **Quest / daily XP** — burst rewards from quest milestones. The hook (`awardQuestXP(amount)`) is built in Phase 3a; activation depends on Phase 3c's save layer tracking quest state.

### XP Curve

**Levels 1–90** — smooth polynomial:

```
totalXP(N) = 100 × N^1.8
```

- Level 10 ≈ 6,300 total XP
- Level 50 ≈ 180,000 total XP
- Level 90 ≈ 328,000 total XP

**Levels 91–100** — prestige wall (exponential):

```
incrementXP(N) = incrementXP(90) × 10^(N−90)   for N = 91..100
```

Level 91 costs ~10× level 90's increment; level 95 ~10,000×; level 100 ~1,000,000×. At a normal play pace (~5,000 XP/stage, 4 stages/day) level 91 takes weeks, level 95 months, level 100 years. The base `10` is a tuning constant.

### Level Rewards

- +1 passive skill point per level
- Hero stat growth applied automatically via the level-scaling stat layer
- Milestone prestige grid regions unlock at levels 25, 50, 75, 90

---

## 2. Passive Skill Grid (PoE-scale)

### Scale

~350 nodes across a large irregular constellation. With 100 points maximum (90 normal + 10 prestige), players unlock ~28% of the tree. You can never finish it — every build is a different path.

### Node Types

| Type               | Count | Description                                                                                                         |
| ------------------ | ----- | ------------------------------------------------------------------------------------------------------------------- |
| **Path nodes**     | ~160  | Connector nodes with tiny bonuses (+2% ATK, +5 HP). Cost 1 point each — traveling to distant clusters costs points. |
| **Notable nodes**  | ~80   | Multi-stat bonuses at cluster cores worth pathing toward.                                                           |
| **Keystone nodes** | ~20   | Game-changing mechanics scattered at distant ends. Each fundamentally alters play.                                  |
| **Mastery nodes**  | ~12   | Unlocked after taking any Notable in their cluster. Choose 1 bonus from a list of 3.                                |
| **Jewel sockets**  | ~8    | Insert a Jewel item (rare drop) that modifies all nodes within 3 steps.                                             |

### Eight Thematic Regions

| Region        | Theme                      | Example keystone                                                                   |
| ------------- | -------------------------- | ---------------------------------------------------------------------------------- |
| **Brawler**   | Raw physical damage        | _Executioner_ — hits vs enemies below 25% HP deal ×1.5 damage                      |
| **Arcane**    | Magic damage & mana        | _Spellweave_ — every 3rd cast costs no mana and deals ×2 skill damage              |
| **Warden**    | Defense & HP               | _Fortress_ — immune to stun; lose 15% move speed                                   |
| **Tactician** | Tower synergy & gold       | _Warlord_ — towers placed within 5s cost 20% less; each placement heals hero 5% HP |
| **Predator**  | Kill rewards & sustain     | _Momentum_ — on kill: +8% ATK stacking ×5, resets on damage taken                  |
| **Phantom**   | Speed & evasion            | _Ghost Step_ — once per 8s the next hit misses entirely                            |
| **Conduit**   | Cross-system synergies     | _Arcane Conduit_ — on kill, restore 20 mana to nearest 2 towers                    |
| **Prestige**  | Endgame only (level-gated) | 4 sub-clusters unlocked at levels 25/50/75/90                                      |

### Prestige Region Keystones (rarest, hardest to reach)

- _Undying_ — once per battle survive lethal hit at 1 HP
- _Lifeline_ — omnivamp heals extend to nearby towers for 25% of the amount
- _Berserker_ — below 30% HP: +50% ATK, +30% attack speed, ignore armor pen cap
- _Transcendence_ — active skills always deal True damage regardless of behavior.activeType
- _Living Fortress_ — hero blocks enemy pathing in a 1-tile radius

### Build Diversity Examples

- **Glass cannon:** Brawler → Arcane → Conduit → Executioner + Spellweave
- **Sustain bruiser:** Warden → Predator → Lifeline + Momentum
- **Tower commander:** Tactician → Conduit → Warlord + Arcane Conduit
- **Speed demon:** Phantom → Predator → Ghost Step + Momentum

---

## 3. Active Skill Slot

### Core Mechanics

- One equipped active skill slot. Auto-casts when mana bar fills (same pattern as tower actives).
- Hero carries a **library** of obtained skills; only one is equipped at a time. Swapping happens in the pre-battle loadout screen.

### Skill Uniqueness

Every active skill is a one-of-a-kind collectible. Each skill exists exactly once in the catalog and can only be obtained once. No duplicates, no star ranks, no rarity upgrades — the only progression axis is leveling through use.

### Acquisition

Active skills drop from enemies and bosses as loot, and from gacha bundles (Phase 3c). Once obtained, permanently in the hero's library.

### Weapon Requirements

Skills declare an optional `requiresWeapon` field. If set, the skill is unequippable unless the matching weapon type is in the Weapon slot.

| Weapon type | Archetype                     |
| ----------- | ----------------------------- |
| `Sword`     | Melee burst, execute, cleave  |
| `Bow`       | Piercing shot, rain of arrows |
| `Staff`     | Mana nova, arcane burst       |
| `Gun`       | Rapid fire, concussive round  |
| `Tome`      | Curse, summon, field effects  |
| `Fist`      | Ground slam, ki wave          |
| `Any`       | No weapon requirement         |

### Leveling — Flat Use-XP

- Every cast: +1 use-XP to equipped skill
- Level cap = hero's current level (can't grind a skill past hero level)
- XP per level: `10 × skillLevel^1.5` (level 1→2 costs 10 XP; level 99→100 costs ~990 XP)
- Effective power scales: `effectivePower = basePower × (1 + 0.05 × skillLevel)` — `0.05` is a per-skill tuning constant

### Rarity & Power

Rarity gates acquisition difficulty and prestige; it does NOT mathematically derive `basePower`. Each skill's `basePower` is an explicitly preset value in the catalog, tunable independently for balance.

### Schema

```ts
interface ActiveSkillDef {
  id: string;
  name: string;
  description: string;
  rarity: Rarity;
  requiresWeapon?: WeaponType;
  damageType: DamageType; // may be True
  basePower: number; // explicitly tuned per skill
  artRef: string;
}

interface HeroSkillEntry {
  // in save data
  skillId: string;
  level: number;
  useXp: number;
}
```

Hero's obtained skill library in save: `HeroSkillEntry[]` — no quantity tracking needed (each skill owned at most once).

---

## 4. Hero Items & Affix System

### Item Level & Stat Scaling

Every item has a `requiredLevel` (1–100). Hero must meet or exceed it to equip. Base stats scale with required level:

```
effectiveStat = baseStat × (1 + 0.08 × requiredLevel)
```

Drop context (stage index, difficulty) sets the required level floor, tying gear progression to content difficulty.

### Base Stat Roll

Every item's base stats roll ±10% randomly at drop time. Two identical named items from the same source will differ slightly — the primary loot-chase hook.

### Primary Stats Vary Per Named Item

Primary stats are NOT fixed by slot type. A helmet can have HP+armor, or HP+magic resist, or HP+armor+magic resist+HP regen — whatever the designer assigns to that specific named item. A defensive sword can have HP as a primary stat.

### Primary Affix Is Per Named Item

Each named item has a predefined primary affix type (e.g., "Excalibur Sword" always has "increase physical damage %"; another sword might have "attack speed %"). The affix _type_ is fixed to the item name; the _value_ rolls ±10% at drop time.

### Affix Rarity Gates

| Rarity    | Primary affix              | Random affixes          | Feel               |
| --------- | -------------------------- | ----------------------- | ------------------ |
| Common    | 1 (fixed type, ±10% value) | 0                       | Starter gear       |
| Magic     | 1                          | 1                       | First upgrade bump |
| Rare      | 1                          | 2                       | Build-relevant     |
| Legendary | 1                          | 3                       | Worth farming      |
| Unique    | 1                          | 3 + 1 mechanic-altering | Endgame defining   |

Each random affix value also rolls ±10% around its own base. A perfect-rolled Legendary is meaningfully better than an average one.

### Slot Identities

| Slot        | Typical primary stats       | Notes                                             |
| ----------- | --------------------------- | ------------------------------------------------- |
| `Weapon`    | ATK (dominant)              | Has `weaponType` — gates active skill eligibility |
| `Helmet`    | Max HP + one defense stat   | Varies per named item                             |
| `BodyArmor` | Armor + Magic Resist        | May include HP or regen                           |
| `Gloves`    | Crit Rate + Crit Damage     | May include ATK                                   |
| `Boots`     | Move Speed                  | May include tenacity                              |
| `Amulet`    | Skill Power                 | May include mana                                  |
| `Ring1/2`   | Mana + Mana Regen           | Most flexible slot                                |
| `Pet`       | Varies + `petUtility`       | Gold generation utility                           |
| `Wing`      | Move Speed (large, primary) | Rarity-gated passives/auras                       |

### Pet Slot — Utility by Rarity

- Common: `goldPerSec` only
- Magic+: `goldPerSec` + `goldFind` fraction
- Legendary+: may add a small passive (e.g., "nearby towers +5% attack speed")

### Wing Slot — Move Speed + Rarity Passives

Wings always have a large move speed primary — larger than Boots, making them the best mobility item. Rarity adds:

| Rarity    | Bonus                                                                                             |
| --------- | ------------------------------------------------------------------------------------------------- |
| Common    | Move speed only                                                                                   |
| Magic     | Move speed + 1 stat (e.g., tenacity)                                                              |
| Rare      | Move speed + small passive (e.g., "on kill: +5% move speed for 3s")                               |
| Legendary | Move speed + meaningful passive (e.g., "moving through enemies slows them 20%")                   |
| Unique    | Move speed + powerful aura (e.g., "hero movement generates 80-radius ATK aura for nearby towers") |

Wings are the rarest item type — intentionally harder to acquire than any other slot.

### Schema

```ts
interface ItemDef {
  id: string;
  name: string;
  slot: ItemSlot;
  weaponType?: WeaponType;
  rarity: Rarity;
  requiredLevel: number;
  baseStats: Partial<Stats>; // varies per named item; rolls ±10% at drop
  primaryAffix: {
    type: string; // predefined per item name
    baseValue: number; // rolls ±10% at drop
  };
  affixPool: string[];
  petUtility?: PetUtility;
  wingPassive?: string; // Wing slot — rarity-gated passive id
  appearanceRef?: string;
  artRef: string;
}

interface ItemInstance {
  // live copy in save data
  id: string; // uuid generated at drop
  defId: string;
  acquiredLevel: number;
  rolledStats: Partial<Stats>;
  rolledPrimaryAffix: number;
  rolledAffixes: RolledAffix[];
}

interface RolledAffix {
  type: string;
  value: number;
}
```

---

## 5. Stat Pipeline (Layered Architecture)

### Composition Formula

```
final = (base + Σ flat) × (1 + Σ increased%) × Π (1 + more%)
```

- **Flat:** level scaling, item base stats, primary affixes — all sum
- **`increased%`:** most passive grid nodes, most random affixes — additive with each other (ten "+10% ATK" nodes = +100%, not ×2.59). Predictable, exploit-resistant.
- **`more%`:** reserved for ~5 keystones (_Berserker_, _Executioner_, etc.) — multiplicative. Scarce by design; makes keystones feel powerful without breaking the power curve.

This prevents runaway stacking: additive `increased%` keeps the F2P/whale power gap linear and tunable.

### StatAccumulator

Layers contribute into buckets; a final `resolve()` collapses them. Order between flat/increased layers never causes bugs:

```ts
interface StatAccumulator {
  flat: Partial<Stats>;
  increased: Partial<Stats>;
  more: Partial<Stats>[];
}
type StatLayer = (acc: StatAccumulator, data: unknown) => StatAccumulator;
function resolve(acc: StatAccumulator): Stats;
```

### Hero Pipeline (8 layers, `src/core/stats.ts`)

```
1. heroBase(level)                  → flat (base + level scaling)
2. applyItemStats(rolledStats)      → flat
3. applyPrimaryAffixes              → flat OR increased% (per affix type)
4. applyRandomAffixes               → flat OR increased%
5. applyPassiveGrid(nodes)          → mostly increased%, a few flat
6. applyActiveSkillBonus            → flat / increased% (passive stat skills)
7. applyKeystoneMores(keystones)    → the only more% layer
8. applyBattleBuffs(auras/potions)  → recomputed each tick
```

### Tower Pipeline (4 layers)

```
towerBase → levelScaling(flat) → starBonus(flat/increased) → battleBuffs(per tick)
```

### Caching

Layers 1–7 resolve once at battle start → cached as `finalStats`. Layer 8 recomputes each tick (clones the cached accumulator, adds buffs, resolves). Equipment can't change mid-battle, so the cache never invalidates mid-fight.

### Location

`src/core/stats.ts` — pure TypeScript, no Phaser dependency, fully unit-testable per layer.

---

## 6. Save Schema & Provider Interface

### SaveProvider Interface (`src/core/save.ts`)

```ts
interface SaveProvider {
  load(): HeroSave | null;
  persist(data: HeroSave): void;
  clear(): void;
}
```

Phase 3a ships `LocalSaveProvider` (localStorage). Phase 5 drops in `CloudSaveProvider` (REST). Game logic never calls localStorage directly.

### Root Save Schema

```ts
interface HeroSave {
  version: number; // schema version — drives migrations
  heroId: string; // local UUID, generated on first run
  hero: HeroProgressSave;
  inventory: InventorySave;
  lastSavedAt: number; // unix timestamp ms
}
```

### Hero Progression

```ts
interface HeroProgressSave {
  level: number;
  totalXp: number; // cumulative — derive current level from this
  skillPoints: number; // unspent
  unlockedNodes: string[]; // passive grid node ids
  obtainedSkills: HeroSkillEntry[];
  equippedSkillId: string | null;
}
```

### Inventory

```ts
interface InventorySave {
  items: ItemInstance[];
  equipped: Partial<Record<ItemSlot, string>>; // slot → ItemInstance.id
}
```

### Schema Versioning & Migrations

```ts
function loadAndMigrate(raw: unknown): HeroSave {
  let save = raw as HeroSave;
  if (save.version < 2) save = migrate_v1_to_v2(save);
  // future migrations added here
  return save;
}
```

Current version: `1`. Phase 3b adds tower collection data → migration to `2`. Each migration is a pure function — independently testable.

### Persistence Strategy

- Auto-save after every battle outcome, item acquisition, and level-up
- Serialized JSON, stored under `wibu-td-save` localStorage key
- On load failure (corrupted/missing) → start fresh with `null`

---

## 7. Architecture Summary

| Concern                       | File                      | Pattern                             |
| ----------------------------- | ------------------------- | ----------------------------------- |
| Stat accumulator + pipeline   | `src/core/stats.ts`       | Pure functions, StatAccumulator     |
| Save provider interface       | `src/core/save.ts`        | Interface + LocalSaveProvider       |
| Hero & inventory schema types | `src/data/schema.ts`      | Extend existing schema              |
| Active skill catalog          | `src/data/skills.ts`      | New catalog file                    |
| Item catalog                  | `src/data/items.ts`       | New catalog file                    |
| Passive grid catalog          | `src/data/passiveGrid.ts` | New catalog file                    |
| BattleState integration       | `src/core/battle.ts`      | Feed resolved Stats at battle start |

---

## 8. New Schema Types Required in `src/data/schema.ts`

These types don't exist yet and must be added as part of Phase 3a:

```ts
export const WEAPON_TYPES = ["Sword", "Bow", "Staff", "Gun", "Tome", "Fist", "Any"] as const;
export type WeaponType = (typeof WEAPON_TYPES)[number];
```

Also extend `ITEM_SLOTS` validator to handle `petUtility` and `wingPassive` fields.

---

## 9. What Phase 3a Does NOT Include

- Tower collection, star ranks, tower leveling → Phase 3b
- Gacha/summon, currency, acquisition → Phase 3c
- Cloud save sync → Phase 5
- Art for items/skills → Phase 4
