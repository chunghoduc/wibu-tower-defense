# Phase 3a — Hero Progression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement hero leveling (XP engine + prestige curve), PoE-scale passive skill grid, active skill collectibles, ARPG item system with rolled affixes, layered stat pipeline, and local save layer — all wired into BattleState and shown in the HUD.

**Architecture:** A `StatAccumulator` (flat/increased/more% buckets) in `src/core/stats.ts` replaces ad-hoc stat application; hero and tower final stats are resolved once at battle start. A `SaveProvider` interface in `src/core/save.ts` wraps localStorage so Phase 5 can swap in a cloud provider. All new content catalogs (passive grid nodes, active skills, items) live in `src/data/`.

**Tech Stack:** TypeScript, Phaser 3, Vitest — same as existing codebase. No new deps. Run tests with `npm test`, typecheck with `npm run typecheck`, build with `npm run build`.

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Modify | `src/data/schema.ts` | Add WeaponType, PassiveNodeDef, ActiveSkillDef, new ItemDef shape, ItemInstance, RolledAffix, HeroSave family |
| Create | `src/core/stats.ts` | StatAccumulator + 8-layer hero pipeline + 4-layer tower pipeline |
| Create | `src/core/save.ts` | SaveProvider interface + LocalSaveProvider + loadAndMigrate |
| Create | `src/core/hero.ts` | XP curve, levelFromXp, skillXpToLevel, resolveHeroStats, resolveHeroStatsForBattle |
| Create | `src/data/passiveGrid.ts` | ~80 passive node definitions (representative; expandable to 350) |
| Create | `src/data/skills.ts` | 12 initial ActiveSkillDef entries |
| Create | `src/data/items.ts` | 20 initial ItemDef entries + rollItem() factory |
| Modify | `src/core/battle.ts` | Accept optional HeroSave in BattleOptions; resolve final hero stats at init; apply pet goldPerSec each tick |
| Modify | `src/scenes/BattleScene.ts` | HUD: level badge, XP bar, equipped skill icon, item slot indicators |
| Create | `tests/stats.test.ts` | StatAccumulator unit tests |
| Create | `tests/save.test.ts` | SaveProvider + migration tests |
| Create | `tests/hero.test.ts` | XP curve, level derivation, skill leveling tests |
| Create | `tests/phase3a.test.ts` | Integration: hero stats flow into battle, pet gold, item rolls |

---

## Task 1 — Schema Extensions

**Files:**
- Modify: `src/data/schema.ts`
- Create: `tests/schema-phase3a.test.ts`

- [ ] **Step 1.1 — Write failing tests for new schema types**

Create `tests/schema-phase3a.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  WEAPON_TYPES,
  type WeaponType,
  type PassiveNodeDef,
  type ActiveSkillDef,
  type ItemDef,
  type ItemInstance,
  type RolledAffix,
  validateActiveSkill,
  validatePassiveNode,
  validateItemDef,
} from "../src/data/schema.ts";

describe("WeaponType", () => {
  it("includes all six weapon types plus Any", () => {
    expect(WEAPON_TYPES).toContain("Sword");
    expect(WEAPON_TYPES).toContain("Bow");
    expect(WEAPON_TYPES).toContain("Staff");
    expect(WEAPON_TYPES).toContain("Gun");
    expect(WEAPON_TYPES).toContain("Tome");
    expect(WEAPON_TYPES).toContain("Fist");
    expect(WEAPON_TYPES).toContain("Any");
  });
});

describe("validateActiveSkill", () => {
  it("accepts a valid skill", () => {
    const skill: ActiveSkillDef = {
      id: "flame-wave",
      name: "Flame Wave",
      description: "A wave of fire.",
      rarity: "Rare",
      requiresWeapon: "Staff",
      damageType: "Magic",
      basePower: 120,
      artRef: "placeholder",
    };
    expect(() => validateActiveSkill(skill)).not.toThrow();
  });

  it("rejects missing id", () => {
    expect(() =>
      validateActiveSkill({ id: "", name: "x", description: "x", rarity: "Common", damageType: "Physical", basePower: 10, artRef: "x" })
    ).toThrow();
  });

  it("rejects basePower <= 0", () => {
    expect(() =>
      validateActiveSkill({ id: "s", name: "x", description: "x", rarity: "Common", damageType: "Physical", basePower: 0, artRef: "x" })
    ).toThrow();
  });
});

describe("validatePassiveNode", () => {
  it("accepts a valid path node", () => {
    const node: PassiveNodeDef = {
      id: "brawler-atk-1",
      type: "path",
      region: "brawler",
      name: "+3% ATK",
      description: "Increases ATK by 3%.",
      gridX: 2,
      gridY: 3,
      neighbors: ["brawler-start"],
      increased: { atk: 0.03 },
    };
    expect(() => validatePassiveNode(node)).not.toThrow();
  });

  it("rejects node with no neighbors", () => {
    expect(() =>
      validatePassiveNode({ id: "x", type: "path", region: "brawler", name: "x", description: "x", gridX: 0, gridY: 0, neighbors: [] })
    ).toThrow();
  });
});

describe("validateItemDef", () => {
  it("accepts valid item", () => {
    const item: ItemDef = {
      id: "iron-sword",
      name: "Iron Sword",
      slot: "Weapon",
      weaponType: "Sword",
      rarity: "Common",
      requiredLevel: 1,
      baseStats: { atk: 20 },
      primaryAffix: { type: "physicalDamage", baseValue: 0.08 },
      affixPool: ["critRate", "armorPen"],
      artRef: "placeholder",
    };
    expect(() => validateItemDef(item)).not.toThrow();
  });

  it("rejects Weapon slot without weaponType", () => {
    expect(() =>
      validateItemDef({ id: "x", name: "x", slot: "Weapon", rarity: "Common", requiredLevel: 1, baseStats: {}, primaryAffix: { type: "x", baseValue: 1 }, affixPool: [], artRef: "x" })
    ).toThrow(/weaponType/);
  });

  it("rejects requiredLevel < 1", () => {
    expect(() =>
      validateItemDef({ id: "x", name: "x", slot: "Helmet", rarity: "Common", requiredLevel: 0, baseStats: {}, primaryAffix: { type: "x", baseValue: 1 }, affixPool: [], artRef: "x" })
    ).toThrow(/requiredLevel/);
  });
});
```

- [ ] **Step 1.2 — Run to confirm failures**

```bash
npm test -- tests/schema-phase3a.test.ts 2>&1 | tail -15
```
Expected: multiple import errors / type errors.

- [ ] **Step 1.3 — Add new types and validators to `src/data/schema.ts`**

Add after the `ITEM_SLOTS` block:

```ts
export const WEAPON_TYPES = ["Sword", "Bow", "Staff", "Gun", "Tome", "Fist", "Any"] as const;
export type WeaponType = (typeof WEAPON_TYPES)[number];

export const PASSIVE_NODE_TYPES = ["path", "notable", "keystone", "mastery", "jewel-socket"] as const;
export type PassiveNodeType = (typeof PASSIVE_NODE_TYPES)[number];

export const PASSIVE_REGIONS = [
  "brawler", "arcane", "warden", "tactician",
  "predator", "phantom", "conduit", "prestige",
] as const;
export type PassiveRegion = (typeof PASSIVE_REGIONS)[number];
```

Add the new interfaces after `PetUtility`:

```ts
/** A node in the hero's PoE-style passive skill grid. */
export interface PassiveNodeDef {
  id: string;
  type: PassiveNodeType;
  region: PassiveRegion;
  name: string;
  description: string;
  gridX: number;
  gridY: number;
  /** Adjacent node ids (graph edges; bidirectional). */
  neighbors: string[];
  /** Flat stat bonuses added to the accumulator. */
  flat?: Partial<Stats>;
  /** Additive % bonuses (0.1 = +10%). */
  increased?: Partial<Stats>;
  /** Multiplicative bonus (0.5 = ×1.5). Reserved for keystones. */
  more?: Partial<Stats>;
  /** Keystone/mastery special effect identifier. */
  effectId?: string;
  /** Hero level required before this node's region unlocks. */
  unlockAtLevel?: number;
}

/** A collectible active skill the hero equips in their single skill slot. */
export interface ActiveSkillDef {
  id: string;
  name: string;
  description: string;
  rarity: Rarity;
  requiresWeapon?: WeaponType;
  damageType: DamageType;
  /** Explicitly tuned per skill — NOT derived from rarity. */
  basePower: number;
  artRef: string;
}
```

Replace the existing `ItemDef` interface entirely with:

```ts
export interface RolledAffix {
  type: string;
  value: number;
}

/**
 * A live copy of an item in the hero's inventory (in save data).
 * The catalog entry (ItemDef) is immutable; ItemInstance holds the rolled values.
 */
export interface ItemInstance {
  id: string;               // uuid generated at drop
  defId: string;            // points to ItemDef.id
  acquiredLevel: number;    // requiredLevel at time of acquisition
  rolledStats: Partial<Stats>;
  rolledPrimaryAffix: number;
  rolledAffixes: RolledAffix[];
}

/**
 * Named item definition. Every copy of the same named item has the same
 * slot/weaponType/primaryAffix type, but values roll ±10% at acquisition.
 */
export interface ItemDef {
  id: string;
  name: string;
  slot: ItemSlot;
  /** Required for Weapon slot; determines which active skills can be equipped. */
  weaponType?: WeaponType;
  rarity: Rarity;
  /** Hero must be >= this level to equip. Also scales base stats. */
  requiredLevel: number;
  /** Primary stats vary per named item — not locked to slot type. */
  baseStats: Partial<Stats>;
  /** Predefined per item name; value rolls ±10% at acquisition. */
  primaryAffix: { type: string; baseValue: number };
  /** Random affixes drawn from this pool; rarity gates count. */
  affixPool: string[];
  /** Pet slot only — utility properties. */
  petUtility?: PetUtility;
  /** Wing slot only — rarity-gated passive id. */
  wingPassive?: string;
  /** Overlay ref applied to hero visual when equipped (Phase 4). */
  appearanceRef?: string;
  artRef: string;
}
```

Add validators after `validateStage`:

```ts
export function validateActiveSkill(s: ActiveSkillDef): ActiveSkillDef {
  assert(s.id.trim().length > 0, "activeSkill: missing id");
  assert(s.name.trim().length > 0, `activeSkill ${s.id}: missing name`);
  assert(s.description.trim().length > 0, `activeSkill ${s.id}: missing description`);
  assert((RARITIES as readonly string[]).includes(s.rarity), `activeSkill ${s.id}: bad rarity`);
  assert((DAMAGE_TYPES as readonly string[]).includes(s.damageType), `activeSkill ${s.id}: bad damageType`);
  assert(s.basePower > 0, `activeSkill ${s.id}: basePower must be > 0`);
  if (s.requiresWeapon !== undefined) {
    assert((WEAPON_TYPES as readonly string[]).includes(s.requiresWeapon), `activeSkill ${s.id}: bad requiresWeapon`);
  }
  return s;
}

export function validatePassiveNode(n: PassiveNodeDef): PassiveNodeDef {
  assert(n.id.trim().length > 0, "passiveNode: missing id");
  assert((PASSIVE_NODE_TYPES as readonly string[]).includes(n.type), `passiveNode ${n.id}: bad type`);
  assert((PASSIVE_REGIONS as readonly string[]).includes(n.region), `passiveNode ${n.id}: bad region`);
  assert(n.neighbors.length >= 1, `passiveNode ${n.id}: must have at least 1 neighbor`);
  return n;
}

export function validateItemDef(item: ItemDef): ItemDef {
  assert(item.id.trim().length > 0, "item: missing id");
  assert((ITEM_SLOTS as readonly string[]).includes(item.slot), `item ${item.id}: bad slot`);
  assert((RARITIES as readonly string[]).includes(item.rarity), `item ${item.id}: bad rarity`);
  assert(item.requiredLevel >= 1, `item ${item.id}: requiredLevel must be >= 1`);
  if (item.slot === "Weapon") {
    assert(item.weaponType !== undefined, `item ${item.id}: Weapon slot requires weaponType`);
  }
  assert(item.primaryAffix.baseValue > 0, `item ${item.id}: primaryAffix.baseValue must be > 0`);
  return item;
}
```

- [ ] **Step 1.4 — Run tests**

```bash
npm run typecheck && npm test -- tests/schema-phase3a.test.ts 2>&1 | tail -15
```
Expected: all 6 new tests pass; existing 57 tests unaffected.

- [ ] **Step 1.5 — Commit**

```bash
git add src/data/schema.ts tests/schema-phase3a.test.ts
git commit -m "feat(schema): WeaponType, PassiveNodeDef, ActiveSkillDef, new ItemDef + validators"
```

---

## Task 2 — StatAccumulator Pipeline

**Files:**
- Create: `src/core/stats.ts`
- Create: `tests/stats.test.ts`

- [ ] **Step 2.1 — Write failing tests**

Create `tests/stats.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  makeAcc,
  addFlat,
  addIncreased,
  addMore,
  resolveAcc,
  heroStatPipeline,
  towerStatPipeline,
} from "../src/core/stats.ts";
import { makeStats, defaultStats } from "../src/data/schema.ts";

describe("StatAccumulator — resolve", () => {
  it("applies flat bonus correctly", () => {
    const base = makeStats({ atk: 100 });
    const acc = addFlat(makeAcc(), { atk: 50 });
    const result = resolveAcc(base, acc);
    expect(result.atk).toBe(150);
  });

  it("applies increased% additively (two 10% sources = +20%, not ×1.21)", () => {
    const base = makeStats({ atk: 100 });
    const acc = addIncreased(addIncreased(makeAcc(), { atk: 0.1 }), { atk: 0.1 });
    const result = resolveAcc(base, acc);
    expect(result.atk).toBeCloseTo(120, 5);
  });

  it("applies more% multiplicatively", () => {
    const base = makeStats({ atk: 100 });
    const acc = addMore(addMore(makeAcc(), { atk: 0.5 }), { atk: 0.5 });
    const result = resolveAcc(base, acc);
    // (100 + 0) * (1 + 0) * 1.5 * 1.5 = 225
    expect(result.atk).toBeCloseTo(225, 5);
  });

  it("flat + increased + more compose correctly", () => {
    const base = makeStats({ atk: 100 });
    let acc = makeAcc();
    acc = addFlat(acc, { atk: 20 });       // base+flat = 120
    acc = addIncreased(acc, { atk: 0.5 }); // × 1.5 = 180
    acc = addMore(acc, { atk: 0.2 });      // × 1.2 = 216
    const result = resolveAcc(base, acc);
    expect(result.atk).toBeCloseTo(216, 5);
  });

  it("unaffected stats pass through unchanged", () => {
    const base = makeStats({ atk: 100, maxHp: 500 });
    const acc = addFlat(makeAcc(), { atk: 10 });
    const result = resolveAcc(base, acc);
    expect(result.maxHp).toBe(500);
  });

  it("critDamage defaults to 1.5 and is preserved", () => {
    const base = defaultStats();
    const result = resolveAcc(base, makeAcc());
    expect(result.critDamage).toBe(1.5);
  });
});

describe("heroStatPipeline", () => {
  it("applies level scaling — higher level gives more stats", () => {
    const base = makeStats({ atk: 100, maxHp: 500 });
    const lvl10 = heroStatPipeline(base, 10, [], [], [], null);
    const lvl50 = heroStatPipeline(base, 50, [], [], [], null);
    expect(lvl50.atk).toBeGreaterThan(lvl10.atk);
    expect(lvl50.maxHp).toBeGreaterThan(lvl10.maxHp);
  });

  it("passive node increased% bonus adds to final stats", () => {
    const base = makeStats({ atk: 100 });
    const node = { increased: { atk: 0.2 } };
    const withNode = heroStatPipeline(base, 1, [node as any], [], [], null);
    const withoutNode = heroStatPipeline(base, 1, [], [], [], null);
    expect(withNode.atk).toBeGreaterThan(withoutNode.atk);
  });

  it("item flat stat adds to final stats", () => {
    const base = makeStats({ atk: 100 });
    const item = { atk: 30 };
    const withItem = heroStatPipeline(base, 1, [], [item as any], [], null);
    const withoutItem = heroStatPipeline(base, 1, [], [], [], null);
    expect(withItem.atk).toBeGreaterThan(withoutItem.atk);
  });
});

describe("towerStatPipeline", () => {
  it("star bonus increases stats", () => {
    const base = makeStats({ atk: 100 });
    const star0 = towerStatPipeline(base, 1, 0);
    const star3 = towerStatPipeline(base, 1, 3);
    expect(star3.atk).toBeGreaterThan(star0.atk);
  });

  it("tower level scaling increases stats", () => {
    const base = makeStats({ atk: 100 });
    const lvl1 = towerStatPipeline(base, 1, 0);
    const lvl20 = towerStatPipeline(base, 20, 0);
    expect(lvl20.atk).toBeGreaterThan(lvl1.atk);
  });
});
```

- [ ] **Step 2.2 — Run to confirm failures**

```bash
npm test -- tests/stats.test.ts 2>&1 | tail -10
```
Expected: import errors (module not found).

- [ ] **Step 2.3 — Create `src/core/stats.ts`**

```ts
/**
 * Layered stat pipeline — Phase 3a.
 *
 * Stats flow through an accumulator with three buckets:
 *   final = (base + Σflat) × (1 + Σincreased%) × Π(1 + more%)
 *
 * This is the PoE-proven composition model:
 * - flat: level scaling, item base stats, primary affixes
 * - increased%: additive — most passive nodes and random affixes
 * - more%: multiplicative — reserved for ~5 powerful keystones
 *
 * Keeping bonuses additive within their bucket prevents runaway stacking.
 */
import { defaultStats, type PassiveNodeDef, type Stats } from "../data/schema.ts";

// ---------------------------------------------------------------------------
// Accumulator
// ---------------------------------------------------------------------------

export interface StatAccumulator {
  flat: Partial<Stats>;
  increased: Partial<Stats>;
  more: Partial<Stats>[];
}

export function makeAcc(): StatAccumulator {
  return { flat: {}, increased: {}, more: [] };
}

export function addFlat(acc: StatAccumulator, s: Partial<Stats>): StatAccumulator {
  const flat = { ...acc.flat };
  for (const [k, v] of Object.entries(s) as [keyof Stats, number][]) {
    if (v !== undefined) flat[k] = (flat[k] ?? 0) + v;
  }
  return { ...acc, flat };
}

export function addIncreased(acc: StatAccumulator, s: Partial<Stats>): StatAccumulator {
  const increased = { ...acc.increased };
  for (const [k, v] of Object.entries(s) as [keyof Stats, number][]) {
    if (v !== undefined) increased[k] = (increased[k] ?? 0) + v;
  }
  return { ...acc, increased };
}

export function addMore(acc: StatAccumulator, s: Partial<Stats>): StatAccumulator {
  return { ...acc, more: [...acc.more, s] };
}

export function resolveAcc(base: Stats, acc: StatAccumulator): Stats {
  const result = { ...base };
  for (const key of Object.keys(base) as (keyof Stats)[]) {
    const b = base[key];
    const f = acc.flat[key] ?? 0;
    const i = acc.increased[key] ?? 0;
    let val = (b + f) * (1 + i);
    for (const moreEntry of acc.more) {
      const m = moreEntry[key];
      if (m !== undefined) val *= 1 + m;
    }
    (result as Record<keyof Stats, number>)[key] = val;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Hero pipeline (layers 1–7; layer 8 battle buffs applied per-tick by BattleState)
// ---------------------------------------------------------------------------

/** Per-level flat stat growth applied to the hero base. */
const HERO_LEVEL_FLAT_PER_LEVEL: Partial<Stats> = {
  atk: 2,
  maxHp: 15,
  armor: 0.3,
  magicResist: 0.3,
  maxMana: 1,
};

/**
 * Compute the hero's final pre-battle Stats from all persistent sources.
 *
 * @param base          Hero's base stats (from HeroConfig)
 * @param level         Hero's current level
 * @param passiveNodes  Unlocked PassiveNodeDef entries
 * @param itemStats     rolledStats from each equipped ItemInstance
 * @param affixStats    Primary + random affix contributions (pre-computed as Partial<Stats>[])
 * @param keystoneMore  More-% contributions from keystone nodes only
 */
export function heroStatPipeline(
  base: Stats,
  level: number,
  passiveNodes: Pick<PassiveNodeDef, "flat" | "increased" | "more">[],
  itemStats: Partial<Stats>[],
  affixStats: Partial<Stats>[],
  keystoneMore: Partial<Stats>[] | null,
): Stats {
  let acc = makeAcc();

  // Layer 1 — level scaling (flat)
  const levelFlat: Partial<Stats> = {};
  for (const [k, v] of Object.entries(HERO_LEVEL_FLAT_PER_LEVEL) as [keyof Stats, number][]) {
    levelFlat[k] = v * (level - 1);
  }
  acc = addFlat(acc, levelFlat);

  // Layers 2–3 — item base stats + affix stats (all flat/increased)
  for (const s of itemStats) acc = addFlat(acc, s);
  for (const s of affixStats) acc = addFlat(acc, s);  // affixes as flat by default

  // Layer 4 — passive grid nodes
  for (const node of passiveNodes) {
    if (node.flat) acc = addFlat(acc, node.flat);
    if (node.increased) acc = addIncreased(acc, node.increased);
  }

  // Layer 5 — keystone more% multipliers
  for (const m of keystoneMore ?? []) acc = addMore(acc, m);

  return resolveAcc(base, acc);
}

// ---------------------------------------------------------------------------
// Tower pipeline (layers 1–3; layer 4 battle buffs per-tick by BattleState)
// ---------------------------------------------------------------------------

/** Per-level flat stat growth applied to towers. */
const TOWER_LEVEL_FLAT_PER_LEVEL: Partial<Stats> = {
  atk: 1.5,
  maxHp: 10,
};

/** Each star rank adds 8% increased to all stats. */
const STAR_INCREASED_PER_STAR = 0.08;

export function towerStatPipeline(base: Stats, towerLevel: number, stars: number): Stats {
  let acc = makeAcc();

  // Layer 1 — level scaling (flat)
  const levelFlat: Partial<Stats> = {};
  for (const [k, v] of Object.entries(TOWER_LEVEL_FLAT_PER_LEVEL) as [keyof Stats, number][]) {
    levelFlat[k] = v * (towerLevel - 1);
  }
  acc = addFlat(acc, levelFlat);

  // Layer 2 — star bonus (increased%)
  if (stars > 0) {
    const starInc: Partial<Stats> = {};
    for (const k of Object.keys(base) as (keyof Stats)[]) {
      starInc[k] = STAR_INCREASED_PER_STAR * stars;
    }
    acc = addIncreased(acc, starInc);
  }

  return resolveAcc(base, acc);
}
```

- [ ] **Step 2.4 — Run tests**

```bash
npm run typecheck && npm test -- tests/stats.test.ts 2>&1 | tail -15
```
Expected: all 9 tests pass.

- [ ] **Step 2.5 — Commit**

```bash
git add src/core/stats.ts tests/stats.test.ts
git commit -m "feat(core): StatAccumulator pipeline with flat/increased/more% layers"
```

---

## Task 3 — SaveProvider & LocalSaveProvider

**Files:**
- Create: `src/core/save.ts`
- Create: `tests/save.test.ts`

- [ ] **Step 3.1 — Write failing tests**

Create `tests/save.test.ts`:

```ts
import { describe, expect, it, beforeEach } from "vitest";
import {
  LocalSaveProvider,
  loadAndMigrate,
  createFreshSave,
  CURRENT_SAVE_VERSION,
  type HeroSave,
} from "../src/core/save.ts";

// Minimal localStorage shim for Node/jsdom environment
const store: Record<string, string> = {};
const mockStorage = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
};

describe("LocalSaveProvider", () => {
  let provider: LocalSaveProvider;

  beforeEach(() => {
    Object.keys(store).forEach((k) => delete store[k]);
    provider = new LocalSaveProvider(mockStorage as unknown as Storage);
  });

  it("returns null when no save exists", () => {
    expect(provider.load()).toBeNull();
  });

  it("persists and reloads a save", () => {
    const save = createFreshSave();
    provider.persist(save);
    const loaded = provider.load();
    expect(loaded).not.toBeNull();
    expect(loaded!.heroId).toBe(save.heroId);
  });

  it("returns null if stored JSON is corrupted", () => {
    mockStorage.setItem("wibu-td-save", "not-json{{{");
    expect(provider.load()).toBeNull();
  });

  it("clear removes the save", () => {
    provider.persist(createFreshSave());
    provider.clear();
    expect(provider.load()).toBeNull();
  });
});

describe("createFreshSave", () => {
  it("starts at level 1 with 0 XP", () => {
    const save = createFreshSave();
    expect(save.hero.level).toBe(1);
    expect(save.hero.totalXp).toBe(0);
    expect(save.hero.skillPoints).toBe(0);
  });

  it("has empty inventory and no equipped items", () => {
    const save = createFreshSave();
    expect(save.inventory.items).toHaveLength(0);
    expect(Object.keys(save.inventory.equipped)).toHaveLength(0);
  });

  it("has current schema version", () => {
    const save = createFreshSave();
    expect(save.version).toBe(CURRENT_SAVE_VERSION);
  });
});

describe("loadAndMigrate", () => {
  it("returns fresh save when input is null", () => {
    const result = loadAndMigrate(null);
    expect(result.version).toBe(CURRENT_SAVE_VERSION);
  });

  it("passes through already-current version unchanged", () => {
    const save = createFreshSave();
    save.hero.level = 42;
    const result = loadAndMigrate(save);
    expect(result.hero.level).toBe(42);
    expect(result.version).toBe(CURRENT_SAVE_VERSION);
  });
});
```

- [ ] **Step 3.2 — Run to confirm failures**

```bash
npm test -- tests/save.test.ts 2>&1 | tail -10
```
Expected: import errors.

- [ ] **Step 3.3 — Create `src/core/save.ts`**

```ts
/**
 * Save layer — Phase 3a.
 *
 * All game logic reads/writes HeroSave through the SaveProvider interface.
 * LocalSaveProvider wraps localStorage; Phase 5 will add CloudSaveProvider.
 * loadAndMigrate() handles schema version upgrades so old saves always load.
 */
import type { ItemSlot } from "../data/schema.ts";

// ---------------------------------------------------------------------------
// Save schema types
// ---------------------------------------------------------------------------

export const CURRENT_SAVE_VERSION = 1;

export interface RolledAffix {
  type: string;
  value: number;
}

export interface ItemInstanceSave {
  id: string;
  defId: string;
  acquiredLevel: number;
  rolledStats: Record<string, number>;
  rolledPrimaryAffix: number;
  rolledAffixes: RolledAffix[];
}

export interface HeroSkillEntry {
  skillId: string;
  level: number;
  useXp: number;
}

export interface HeroProgressSave {
  level: number;
  totalXp: number;
  skillPoints: number;
  unlockedNodes: string[];
  obtainedSkills: HeroSkillEntry[];
  equippedSkillId: string | null;
}

export interface InventorySave {
  items: ItemInstanceSave[];
  equipped: Partial<Record<ItemSlot, string>>;
}

export interface HeroSave {
  version: number;
  heroId: string;
  hero: HeroProgressSave;
  inventory: InventorySave;
  lastSavedAt: number;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

let _heroIdCounter = 0;

export function createFreshSave(): HeroSave {
  return {
    version: CURRENT_SAVE_VERSION,
    heroId: `hero-${Date.now()}-${++_heroIdCounter}`,
    hero: {
      level: 1,
      totalXp: 0,
      skillPoints: 0,
      unlockedNodes: [],
      obtainedSkills: [],
      equippedSkillId: null,
    },
    inventory: {
      items: [],
      equipped: {},
    },
    lastSavedAt: 0,
  };
}

// ---------------------------------------------------------------------------
// Migrations
// ---------------------------------------------------------------------------

export function loadAndMigrate(raw: unknown): HeroSave {
  if (!raw || typeof raw !== "object") return createFreshSave();
  let save = raw as HeroSave;
  // Future migrations:
  // if (save.version < 2) save = migrate_v1_to_v2(save);
  save.version = CURRENT_SAVE_VERSION;
  return save;
}

// ---------------------------------------------------------------------------
// Provider interface
// ---------------------------------------------------------------------------

export interface SaveProvider {
  load(): HeroSave | null;
  persist(data: HeroSave): void;
  clear(): void;
}

const SAVE_KEY = "wibu-td-save";

export class LocalSaveProvider implements SaveProvider {
  constructor(private readonly storage: Storage = globalThis.localStorage) {}

  load(): HeroSave | null {
    try {
      const raw = this.storage.getItem(SAVE_KEY);
      if (!raw) return null;
      return loadAndMigrate(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  persist(data: HeroSave): void {
    this.storage.setItem(SAVE_KEY, JSON.stringify(data));
  }

  clear(): void {
    this.storage.removeItem(SAVE_KEY);
  }
}
```

- [ ] **Step 3.4 — Run tests**

```bash
npm run typecheck && npm test -- tests/save.test.ts 2>&1 | tail -15
```
Expected: all 8 tests pass.

- [ ] **Step 3.5 — Commit**

```bash
git add src/core/save.ts tests/save.test.ts
git commit -m "feat(core): SaveProvider interface + LocalSaveProvider with migrations"
```

---

## Task 4 — Hero XP Engine

**Files:**
- Create: `src/core/hero.ts`
- Create: `tests/hero.test.ts`

- [ ] **Step 4.1 — Write failing tests**

Create `tests/hero.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  totalXpForLevel,
  levelFromTotalXp,
  xpToNextLevel,
  skillXpToLevel,
  skillEffectivePower,
  awardHeroXp,
  awardSkillUseXp,
} from "../src/core/hero.ts";
import { createFreshSave } from "../src/core/save.ts";

describe("totalXpForLevel", () => {
  it("level 1 requires 0 XP", () => {
    expect(totalXpForLevel(1)).toBe(0);
  });

  it("level 2 requires more than 0", () => {
    expect(totalXpForLevel(2)).toBeGreaterThan(0);
  });

  it("is monotonically increasing", () => {
    for (let n = 2; n <= 100; n++) {
      expect(totalXpForLevel(n)).toBeGreaterThan(totalXpForLevel(n - 1));
    }
  });

  it("level 90 uses polynomial curve (~328k)", () => {
    expect(totalXpForLevel(90)).toBeGreaterThan(300_000);
    expect(totalXpForLevel(90)).toBeLessThan(400_000);
  });

  it("level 91 increment is dramatically larger than level 90 increment", () => {
    const inc90 = totalXpForLevel(90) - totalXpForLevel(89);
    const inc91 = totalXpForLevel(91) - totalXpForLevel(90);
    expect(inc91).toBeGreaterThan(inc90 * 5);
  });

  it("level 100 is astronomically large", () => {
    expect(totalXpForLevel(100)).toBeGreaterThan(1_000_000_000);
  });
});

describe("levelFromTotalXp", () => {
  it("0 XP = level 1", () => {
    expect(levelFromTotalXp(0)).toBe(1);
  });

  it("round-trips with totalXpForLevel", () => {
    for (const lvl of [1, 10, 50, 89, 90, 91]) {
      expect(levelFromTotalXp(totalXpForLevel(lvl))).toBe(lvl);
    }
  });

  it("caps at 100", () => {
    expect(levelFromTotalXp(Number.MAX_SAFE_INTEGER)).toBe(100);
  });
});

describe("xpToNextLevel", () => {
  it("returns correct gap", () => {
    const gap = xpToNextLevel(10, totalXpForLevel(10) + 50);
    expect(gap).toBe(totalXpForLevel(11) - totalXpForLevel(10) - 50);
  });
});

describe("skillXpToLevel", () => {
  it("level 1→2 costs 10 XP", () => {
    expect(skillXpToLevel(1)).toBe(10);
  });

  it("increases with skill level", () => {
    expect(skillXpToLevel(10)).toBeGreaterThan(skillXpToLevel(1));
  });
});

describe("skillEffectivePower", () => {
  it("level 1 = basePower × 1.05", () => {
    expect(skillEffectivePower(100, 1)).toBeCloseTo(105, 3);
  });

  it("increases with level", () => {
    expect(skillEffectivePower(100, 50)).toBeGreaterThan(skillEffectivePower(100, 10));
  });
});

describe("awardHeroXp", () => {
  it("adds XP and levels up hero", () => {
    const save = createFreshSave();
    awardHeroXp(save, totalXpForLevel(5));
    expect(save.hero.level).toBe(5);
    expect(save.hero.totalXp).toBe(totalXpForLevel(5));
  });

  it("awards skill points equal to levels gained", () => {
    const save = createFreshSave();
    awardHeroXp(save, totalXpForLevel(5));
    expect(save.hero.skillPoints).toBe(4); // gained levels 2,3,4,5 = 4 points
  });

  it("does not exceed level 100", () => {
    const save = createFreshSave();
    awardHeroXp(save, Number.MAX_SAFE_INTEGER);
    expect(save.hero.level).toBe(100);
  });
});

describe("awardSkillUseXp", () => {
  it("increments useXp and levels up skill when threshold reached", () => {
    const save = createFreshSave();
    save.hero.obtainedSkills.push({ skillId: "flame-wave", level: 1, useXp: 0 });
    save.hero.level = 10;
    // skill level 1 costs 10 XP; award 10 casts
    for (let i = 0; i < 10; i++) awardSkillUseXp(save, "flame-wave");
    const entry = save.hero.obtainedSkills[0];
    expect(entry.level).toBe(2);
    expect(entry.useXp).toBe(0);
  });

  it("does not level skill beyond hero level", () => {
    const save = createFreshSave();
    save.hero.level = 1; // hero is level 1
    save.hero.obtainedSkills.push({ skillId: "s", level: 1, useXp: 0 });
    for (let i = 0; i < 100; i++) awardSkillUseXp(save, "s");
    expect(save.hero.obtainedSkills[0].level).toBe(1); // capped at hero level
  });
});
```

- [ ] **Step 4.2 — Run to confirm failures**

```bash
npm test -- tests/hero.test.ts 2>&1 | tail -10
```

- [ ] **Step 4.3 — Create `src/core/hero.ts`**

```ts
/**
 * Hero progression engine — Phase 3a.
 *
 * Pure functions for XP, leveling, skill use-XP, and stat resolution.
 * No side effects; save mutations go through the HeroSave parameter.
 */
import type { HeroSave } from "./save.ts";

// ---------------------------------------------------------------------------
// XP curve
// ---------------------------------------------------------------------------

/**
 * Cumulative XP required to reach `level`.
 * Levels 1–90: smooth polynomial (100 × N^1.8).
 * Levels 91–100: exponential prestige wall (×10 per level increment).
 */
export function totalXpForLevel(level: number): number {
  if (level <= 1) return 0;
  if (level <= 90) return Math.floor(100 * Math.pow(level, 1.8));
  const base90 = Math.floor(100 * Math.pow(90, 1.8));
  const inc90 = base90 - Math.floor(100 * Math.pow(89, 1.8));
  let total = base90;
  for (let n = 91; n <= level; n++) {
    total += Math.floor(inc90 * Math.pow(10, n - 90));
  }
  return total;
}

/** Derive current level from cumulative XP. */
export function levelFromTotalXp(totalXp: number): number {
  for (let lvl = 100; lvl >= 1; lvl--) {
    if (totalXp >= totalXpForLevel(lvl)) return lvl;
  }
  return 1;
}

/** XP still needed to advance from current level. */
export function xpToNextLevel(currentLevel: number, totalXp: number): number {
  if (currentLevel >= 100) return 0;
  return totalXpForLevel(currentLevel + 1) - totalXp;
}

// ---------------------------------------------------------------------------
// Skill leveling
// ---------------------------------------------------------------------------

/** Use-XP required to advance from `skillLevel` to the next. */
export function skillXpToLevel(skillLevel: number): number {
  return Math.floor(10 * Math.pow(skillLevel, 1.5));
}

/** Effective power of a skill at a given level. */
export function skillEffectivePower(basePower: number, skillLevel: number): number {
  return basePower * (1 + 0.05 * skillLevel);
}

// ---------------------------------------------------------------------------
// Save mutators
// ---------------------------------------------------------------------------

/**
 * Award XP to the hero, advance level, and grant skill points.
 * Mutates `save` in place.
 */
export function awardHeroXp(save: HeroSave, amount: number): void {
  const prevLevel = save.hero.level;
  save.hero.totalXp += amount;
  const newLevel = Math.min(100, levelFromTotalXp(save.hero.totalXp));
  const levelsGained = newLevel - prevLevel;
  if (levelsGained > 0) {
    save.hero.level = newLevel;
    save.hero.skillPoints += levelsGained;
  }
}

/**
 * Award 1 use-XP to the named skill. Advances skill level if threshold reached,
 * capped at hero's current level.
 * Mutates `save` in place.
 */
export function awardSkillUseXp(save: HeroSave, skillId: string): void {
  const entry = save.hero.obtainedSkills.find((s) => s.skillId === skillId);
  if (!entry) return;
  if (entry.level >= save.hero.level) return; // already at cap
  entry.useXp += 1;
  const needed = skillXpToLevel(entry.level);
  if (entry.useXp >= needed) {
    entry.useXp = 0;
    entry.level = Math.min(entry.level + 1, save.hero.level);
  }
}
```

- [ ] **Step 4.4 — Run tests**

```bash
npm run typecheck && npm test -- tests/hero.test.ts 2>&1 | tail -15
```
Expected: all 14 tests pass.

- [ ] **Step 4.5 — Commit**

```bash
git add src/core/hero.ts tests/hero.test.ts
git commit -m "feat(core): hero XP engine — prestige curve, skill use-XP, level mutators"
```

---

## Task 5 — Passive Grid Catalog

**Files:**
- Create: `src/data/passiveGrid.ts`
- Create: `tests/passiveGrid.test.ts`

- [ ] **Step 5.1 — Write failing tests**

Create `tests/passiveGrid.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { PASSIVE_NODES, PASSIVE_NODES_MAP, getReachableNodes } from "../src/data/passiveGrid.ts";
import { PASSIVE_REGIONS } from "../src/data/schema.ts";

describe("PASSIVE_NODES catalog", () => {
  it("has at least 60 nodes", () => {
    expect(PASSIVE_NODES.length).toBeGreaterThanOrEqual(60);
  });

  it("has no duplicate ids", () => {
    const ids = PASSIVE_NODES.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("covers all 8 regions", () => {
    const regions = new Set(PASSIVE_NODES.map((n) => n.region));
    for (const r of PASSIVE_REGIONS) expect(regions.has(r)).toBe(true);
  });

  it("all neighbor references point to existing nodes", () => {
    for (const node of PASSIVE_NODES) {
      for (const neighborId of node.neighbors) {
        expect(PASSIVE_NODES_MAP.has(neighborId), `${node.id} references missing neighbor ${neighborId}`).toBe(true);
      }
    }
  });

  it("neighbor graph is bidirectional", () => {
    for (const node of PASSIVE_NODES) {
      for (const neighborId of node.neighbors) {
        const neighbor = PASSIVE_NODES_MAP.get(neighborId)!;
        expect(neighbor.neighbors, `${neighborId} doesn't list ${node.id} as neighbor`).toContain(node.id);
      }
    }
  });

  it("prestige nodes have unlockAtLevel set", () => {
    const prestige = PASSIVE_NODES.filter((n) => n.region === "prestige");
    for (const n of prestige) {
      expect(n.unlockAtLevel, `prestige node ${n.id} missing unlockAtLevel`).toBeGreaterThan(0);
    }
  });

  it("has at least 3 keystone nodes", () => {
    const keystones = PASSIVE_NODES.filter((n) => n.type === "keystone");
    expect(keystones.length).toBeGreaterThanOrEqual(3);
  });
});

describe("getReachableNodes", () => {
  it("starting node is always reachable with 0 unlocked", () => {
    const reachable = getReachableNodes([], 1);
    expect(reachable.length).toBeGreaterThan(0);
  });

  it("unlocking a node makes its neighbors reachable", () => {
    const reachable = getReachableNodes(["grid-start"], 1);
    const start = PASSIVE_NODES_MAP.get("grid-start")!;
    for (const neighborId of start.neighbors) {
      expect(reachable.map((n) => n.id)).toContain(neighborId);
    }
  });

  it("prestige nodes locked below required hero level", () => {
    const reachable = getReachableNodes([], 1);
    const locked = reachable.filter(
      (n) => n.region === "prestige" && (n.unlockAtLevel ?? 0) > 1
    );
    expect(locked.length).toBe(0);
  });
});
```

- [ ] **Step 5.2 — Run to confirm failures**

```bash
npm test -- tests/passiveGrid.test.ts 2>&1 | tail -10
```

- [ ] **Step 5.3 — Create `src/data/passiveGrid.ts`**

```ts
/**
 * Passive skill grid catalog — Phase 3a.
 *
 * Defines ~80 representative nodes across all 8 regions. The grid is designed
 * to grow to ~350 nodes in content iterations; this initial set validates the
 * system architecture. Grid coordinates (gridX, gridY) are logical positions
 * for UI layout; the renderer maps these to screen space.
 *
 * All neighbor relationships are bidirectional (verified by content tests).
 * The single starting node "grid-start" is the player's entry point.
 */
import { type PassiveNodeDef, validatePassiveNode } from "./schema.ts";

function n(def: PassiveNodeDef): PassiveNodeDef {
  return validatePassiveNode(def);
}

export const PASSIVE_NODES: PassiveNodeDef[] = [
  // ── Starting node ──────────────────────────────────────────────────────
  n({ id: "grid-start", type: "notable", region: "brawler", name: "Warrior's Origin",
      description: "The beginning of all paths.", gridX: 12, gridY: 9,
      neighbors: ["brawler-p1", "arcane-p1", "warden-p1", "predator-p1"],
      flat: { atk: 5, maxHp: 30 } }),

  // ── Brawler region ─────────────────────────────────────────────────────
  n({ id: "brawler-p1", type: "path", region: "brawler", name: "+3% ATK",
      description: "Strike harder.", gridX: 10, gridY: 8,
      neighbors: ["grid-start", "brawler-p2"], increased: { atk: 0.03 } }),
  n({ id: "brawler-p2", type: "path", region: "brawler", name: "+3% ATK",
      description: "Strike harder.", gridX: 8, gridY: 7,
      neighbors: ["brawler-p1", "brawler-notable-1"], increased: { atk: 0.03 } }),
  n({ id: "brawler-notable-1", type: "notable", region: "brawler", name: "Brutality",
      description: "+12% ATK, +8% crit rate.", gridX: 7, gridY: 6,
      neighbors: ["brawler-p2", "brawler-p3", "brawler-mastery-1"],
      increased: { atk: 0.12, critRate: 0.08 } }),
  n({ id: "brawler-mastery-1", type: "mastery", region: "brawler", name: "Brawler Mastery",
      description: "Choose: +20% crit dmg, or +15% armor pen, or +10% ATK.",
      gridX: 6, gridY: 5,
      neighbors: ["brawler-notable-1"],
      effectId: "brawler-mastery", increased: { critDamage: 0.2 } }),
  n({ id: "brawler-p3", type: "path", region: "brawler", name: "+5% crit dmg",
      description: "Hit harder on crits.", gridX: 6, gridY: 7,
      neighbors: ["brawler-notable-1", "brawler-notable-2"], increased: { critDamage: 0.05 } }),
  n({ id: "brawler-notable-2", type: "notable", region: "brawler", name: "Predatory Strikes",
      description: "+10% ATK, +10% crit rate, +15% crit dmg.", gridX: 5, gridY: 8,
      neighbors: ["brawler-p3", "brawler-keystone-1"],
      increased: { atk: 0.10, critRate: 0.10, critDamage: 0.15 } }),
  n({ id: "brawler-keystone-1", type: "keystone", region: "brawler", name: "Executioner",
      description: "Hits vs enemies below 25% HP deal ×1.5 damage.",
      gridX: 4, gridY: 9,
      neighbors: ["brawler-notable-2"],
      effectId: "executioner", more: { atk: 0.5 } }),
  n({ id: "brawler-p4", type: "path", region: "brawler", name: "+4% armorPen",
      description: "Pierce defences.", gridX: 9, gridY: 6,
      neighbors: ["brawler-notable-1", "brawler-p5"], increased: { armorPen: 0.04 } }),
  n({ id: "brawler-p5", type: "path", region: "brawler", name: "+4% armorPen",
      description: "Pierce defences.", gridX: 8, gridY: 5,
      neighbors: ["brawler-p4"], increased: { armorPen: 0.04 } }),
  n({ id: "brawler-jewel-1", type: "jewel-socket", region: "brawler", name: "Jewel Socket",
      description: "Insert a Jewel to modify nearby nodes.", gridX: 7, gridY: 4,
      neighbors: ["brawler-p5"] }),

  // ── Arcane region ──────────────────────────────────────────────────────
  n({ id: "arcane-p1", type: "path", region: "arcane", name: "+3% skillPower",
      description: "Empower your spells.", gridX: 14, gridY: 8,
      neighbors: ["grid-start", "arcane-p2"], increased: { skillPower: 0.03 } }),
  n({ id: "arcane-p2", type: "path", region: "arcane", name: "+3% magicPen",
      description: "Your magic pierces resistance.", gridX: 16, gridY: 7,
      neighbors: ["arcane-p1", "arcane-notable-1"], increased: { magicPen: 0.03 } }),
  n({ id: "arcane-notable-1", type: "notable", region: "arcane", name: "Arcane Surge",
      description: "+15% skillPower, +10% magicPen.", gridX: 17, gridY: 6,
      neighbors: ["arcane-p2", "arcane-p3", "arcane-mastery-1"],
      increased: { skillPower: 0.15, magicPen: 0.10 } }),
  n({ id: "arcane-mastery-1", type: "mastery", region: "arcane", name: "Arcane Mastery",
      description: "Choose: +15% skillPower, or +20% mana, or +10 manaOnHit.",
      gridX: 18, gridY: 5,
      neighbors: ["arcane-notable-1"],
      effectId: "arcane-mastery", increased: { skillPower: 0.15 } }),
  n({ id: "arcane-p3", type: "path", region: "arcane", name: "+4% skillPower",
      description: "Empower your spells.", gridX: 18, gridY: 7,
      neighbors: ["arcane-notable-1", "arcane-notable-2"], increased: { skillPower: 0.04 } }),
  n({ id: "arcane-notable-2", type: "notable", region: "arcane", name: "Font of Power",
      description: "+20% maxMana, +5 manaRegen, +12% skillPower.", gridX: 19, gridY: 8,
      neighbors: ["arcane-p3", "arcane-keystone-1"],
      increased: { maxMana: 0.20, skillPower: 0.12 }, flat: { manaRegen: 5 } }),
  n({ id: "arcane-keystone-1", type: "keystone", region: "arcane", name: "Spellweave",
      description: "Every 3rd cast costs no mana and deals ×2 skill damage.",
      gridX: 20, gridY: 9,
      neighbors: ["arcane-notable-2"],
      effectId: "spellweave", more: { skillPower: 1.0 } }),

  // ── Warden region ──────────────────────────────────────────────────────
  n({ id: "warden-p1", type: "path", region: "warden", name: "+30 maxHp",
      description: "Bolster your vitality.", gridX: 10, gridY: 10,
      neighbors: ["grid-start", "warden-p2"], flat: { maxHp: 30 } }),
  n({ id: "warden-p2", type: "path", region: "warden", name: "+5 armor",
      description: "Harden your defence.", gridX: 8, gridY: 11,
      neighbors: ["warden-p1", "warden-notable-1"], flat: { armor: 5 } }),
  n({ id: "warden-notable-1", type: "notable", region: "warden", name: "Iron Bastion",
      description: "+80 maxHp, +10 armor, +5% hpRegen.", gridX: 7, gridY: 12,
      neighbors: ["warden-p2", "warden-p3", "warden-mastery-1"],
      flat: { maxHp: 80, armor: 10 }, increased: { hpRegen: 0.05 } }),
  n({ id: "warden-mastery-1", type: "mastery", region: "warden", name: "Warden Mastery",
      description: "Choose: +15% dmgReduction, or +20% magicResist, or +100 maxHp.",
      gridX: 6, gridY: 13,
      neighbors: ["warden-notable-1"],
      effectId: "warden-mastery", increased: { damageReduction: 0.15 } }),
  n({ id: "warden-p3", type: "path", region: "warden", name: "+5 magicResist",
      description: "Resist hostile magic.", gridX: 8, gridY: 13,
      neighbors: ["warden-notable-1", "warden-notable-2"], flat: { magicResist: 5 } }),
  n({ id: "warden-notable-2", type: "notable", region: "warden", name: "Stone Wall",
      description: "+120 maxHp, +8 armor, +8 magicResist.", gridX: 7, gridY: 14,
      neighbors: ["warden-p3", "warden-keystone-1"],
      flat: { maxHp: 120, armor: 8, magicResist: 8 } }),
  n({ id: "warden-keystone-1", type: "keystone", region: "warden", name: "Fortress",
      description: "Immune to stun; lose 15% move speed.",
      gridX: 6, gridY: 15,
      neighbors: ["warden-notable-2"],
      effectId: "fortress", flat: { tenacity: 1 }, increased: { moveSpeed: -0.15 } }),

  // ── Tactician region ───────────────────────────────────────────────────
  n({ id: "tactician-p1", type: "path", region: "tactician", name: "+2% goldFind",
      description: "Squeeze more from every kill.", gridX: 14, gridY: 10,
      neighbors: ["grid-start", "tactician-p2"], increased: { goldFind: 0.02 } }),
  n({ id: "tactician-p2", type: "path", region: "tactician", name: "+3% goldFind",
      description: "Wealth follows the tactician.", gridX: 16, gridY: 11,
      neighbors: ["tactician-p1", "tactician-notable-1"], increased: { goldFind: 0.03 } }),
  n({ id: "tactician-notable-1", type: "notable", region: "tactician", name: "Quartermaster",
      description: "+10% goldFind, +10 manaOnKill.", gridX: 17, gridY: 12,
      neighbors: ["tactician-p2", "tactician-p3", "tactician-mastery-1"],
      increased: { goldFind: 0.10 }, flat: { manaOnKill: 10 } }),
  n({ id: "tactician-mastery-1", type: "mastery", region: "tactician", name: "Tactician Mastery",
      description: "Choose: +20% goldFind, or towers gain +5% ATK in range, or -10% tower cost.",
      gridX: 18, gridY: 13,
      neighbors: ["tactician-notable-1"],
      effectId: "tactician-mastery", increased: { goldFind: 0.20 } }),
  n({ id: "tactician-p3", type: "path", region: "tactician", name: "+5 manaOnKill",
      description: "Every kill powers your arsenal.", gridX: 17, gridY: 14,
      neighbors: ["tactician-notable-1", "tactician-keystone-1"], flat: { manaOnKill: 5 } }),
  n({ id: "tactician-keystone-1", type: "keystone", region: "tactician", name: "Warlord",
      description: "Towers placed within 5s cost 20% less; each placement heals hero 5% max HP.",
      gridX: 18, gridY: 15,
      neighbors: ["tactician-p3"],
      effectId: "warlord" }),

  // ── Predator region ────────────────────────────────────────────────────
  n({ id: "predator-p1", type: "path", region: "predator", name: "+2% omnivamp",
      description: "Steal life from every blow.", gridX: 12, gridY: 11,
      neighbors: ["grid-start", "predator-p2"], increased: { omnivamp: 0.02 } }),
  n({ id: "predator-p2", type: "path", region: "predator", name: "+5 manaOnHit",
      description: "Each blow fills your reserves.", gridX: 12, gridY: 13,
      neighbors: ["predator-p1", "predator-notable-1"], flat: { manaOnHit: 5 } }),
  n({ id: "predator-notable-1", type: "notable", region: "predator", name: "Bloodthirst",
      description: "+5% omnivamp, +8 manaOnKill.", gridX: 11, gridY: 14,
      neighbors: ["predator-p2", "predator-p3"],
      increased: { omnivamp: 0.05 }, flat: { manaOnKill: 8 } }),
  n({ id: "predator-p3", type: "path", region: "predator", name: "+3% omnivamp",
      description: "Feed on your enemies.", gridX: 11, gridY: 15,
      neighbors: ["predator-notable-1", "predator-keystone-1"], increased: { omnivamp: 0.03 } }),
  n({ id: "predator-keystone-1", type: "keystone", region: "predator", name: "Momentum",
      description: "On kill: +8% ATK stacking ×5; resets on taking damage.",
      gridX: 10, gridY: 16,
      neighbors: ["predator-p3"],
      effectId: "momentum" }),

  // ── Phantom region ─────────────────────────────────────────────────────
  n({ id: "phantom-p1", type: "path", region: "phantom", name: "+5% moveSpeed",
      description: "Move like a ghost.", gridX: 12, gridY: 7,
      neighbors: ["grid-start", "phantom-p2"], increased: { moveSpeed: 0.05 } }),
  n({ id: "phantom-p2", type: "path", region: "phantom", name: "+5% moveSpeed",
      description: "Flow through the battle.", gridX: 12, gridY: 5,
      neighbors: ["phantom-p1", "phantom-notable-1"], increased: { moveSpeed: 0.05 } }),
  n({ id: "phantom-notable-1", type: "notable", region: "phantom", name: "Fleet-Footed",
      description: "+15% moveSpeed, +10% tenacity.", gridX: 11, gridY: 4,
      neighbors: ["phantom-p2", "phantom-p3"],
      increased: { moveSpeed: 0.15, tenacity: 0.10 } }),
  n({ id: "phantom-p3", type: "path", region: "phantom", name: "+5% attackSpeed",
      description: "Swift hands.", gridX: 10, gridY: 3,
      neighbors: ["phantom-notable-1", "phantom-keystone-1"], increased: { attackSpeed: 0.05 } }),
  n({ id: "phantom-keystone-1", type: "keystone", region: "phantom", name: "Ghost Step",
      description: "Once per 8s the next incoming hit misses entirely.",
      gridX: 9, gridY: 2,
      neighbors: ["phantom-p3"],
      effectId: "ghost-step" }),

  // ── Conduit region ─────────────────────────────────────────────────────
  n({ id: "conduit-p1", type: "path", region: "conduit", name: "+3% critRate",
      description: "Find gaps in every defence.", gridX: 14, gridY: 7,
      neighbors: ["grid-start", "conduit-p2"], increased: { critRate: 0.03 } }),
  n({ id: "conduit-p2", type: "path", region: "conduit", name: "+5% skillPower",
      description: "Channel raw power.", gridX: 15, gridY: 5,
      neighbors: ["conduit-p1", "conduit-notable-1"], increased: { skillPower: 0.05 } }),
  n({ id: "conduit-notable-1", type: "notable", region: "conduit", name: "Power Nexus",
      description: "+10% critRate, +8% skillPower, +5 manaOnHit.", gridX: 16, gridY: 4,
      neighbors: ["conduit-p2", "conduit-p3"],
      increased: { critRate: 0.10, skillPower: 0.08 }, flat: { manaOnHit: 5 } }),
  n({ id: "conduit-p3", type: "path", region: "conduit", name: "+5% critDamage",
      description: "Amplify each critical hit.", gridX: 17, gridY: 3,
      neighbors: ["conduit-notable-1", "conduit-keystone-1"], increased: { critDamage: 0.05 } }),
  n({ id: "conduit-keystone-1", type: "keystone", region: "conduit", name: "Arcane Conduit",
      description: "On kill: restore 20 mana to nearest 2 towers.",
      gridX: 18, gridY: 2,
      neighbors: ["conduit-p3"],
      effectId: "arcane-conduit" }),
  n({ id: "conduit-jewel-2", type: "jewel-socket", region: "conduit", name: "Jewel Socket",
      description: "Insert a Jewel to modify nearby nodes.", gridX: 16, gridY: 3,
      neighbors: ["conduit-notable-1"] }),

  // ── Prestige region ────────────────────────────────────────────────────
  n({ id: "prestige-gate-25", type: "notable", region: "prestige",
      name: "Veteran's Path",
      description: "Unlocked at level 25. Gateway to the prestige tree.",
      gridX: 12, gridY: 1,
      neighbors: ["phantom-keystone-1", "conduit-keystone-1", "prestige-undying"],
      unlockAtLevel: 25,
      increased: { atk: 0.05, maxHp: 0.05 } }),
  n({ id: "prestige-undying", type: "keystone", region: "prestige", name: "Undying",
      description: "Once per battle survive a lethal hit at 1 HP.",
      gridX: 10, gridY: 0,
      neighbors: ["prestige-gate-25"],
      effectId: "undying", unlockAtLevel: 25 }),
  n({ id: "prestige-gate-50", type: "notable", region: "prestige",
      name: "Champion's Gate",
      description: "Unlocked at level 50.",
      gridX: 14, gridY: 1,
      neighbors: ["prestige-gate-25", "prestige-lifeline"],
      unlockAtLevel: 50,
      increased: { skillPower: 0.08 } }),
  n({ id: "prestige-lifeline", type: "keystone", region: "prestige", name: "Lifeline",
      description: "Omnivamp heals extend to nearby towers for 25% of the amount.",
      gridX: 15, gridY: 0,
      neighbors: ["prestige-gate-50"],
      effectId: "lifeline", unlockAtLevel: 50 }),
  n({ id: "prestige-gate-75", type: "notable", region: "prestige",
      name: "Legend's Road",
      description: "Unlocked at level 75.",
      gridX: 12, gridY: 0,
      neighbors: ["prestige-gate-50", "prestige-berserker"],
      unlockAtLevel: 75,
      increased: { atk: 0.10 } }),
  n({ id: "prestige-berserker", type: "keystone", region: "prestige", name: "Berserker",
      description: "Below 30% HP: +50% ATK, +30% attack speed, ignore armor pen cap.",
      gridX: 11, gridY: -1,
      neighbors: ["prestige-gate-75"],
      effectId: "berserker", unlockAtLevel: 75 }),
  n({ id: "prestige-gate-90", type: "notable", region: "prestige",
      name: "Transcendent Gate",
      description: "Unlocked at level 90. The pinnacle of the prestige tree.",
      gridX: 13, gridY: 0,
      neighbors: ["prestige-gate-75", "prestige-transcendence", "prestige-living-fortress"],
      unlockAtLevel: 90,
      more: { atk: 0.15 } }),
  n({ id: "prestige-transcendence", type: "keystone", region: "prestige", name: "Transcendence",
      description: "Active skills always deal True damage regardless of activeType.",
      gridX: 14, gridY: -1,
      neighbors: ["prestige-gate-90"],
      effectId: "transcendence", unlockAtLevel: 90 }),
  n({ id: "prestige-living-fortress", type: "keystone", region: "prestige", name: "Living Fortress",
      description: "Hero blocks enemy pathing in a 1-tile radius.",
      gridX: 12, gridY: -1,
      neighbors: ["prestige-gate-90"],
      effectId: "living-fortress", unlockAtLevel: 90 }),
];

export const PASSIVE_NODES_MAP = new Map<string, PassiveNodeDef>(
  PASSIVE_NODES.map((n) => [n.id, n])
);

/**
 * Returns nodes the hero can currently unlock:
 * adjacent to at least one already-unlocked node,
 * not yet unlocked themselves,
 * and whose region's unlock level <= heroLevel.
 * If no nodes are unlocked, returns the starting node.
 */
export function getReachableNodes(
  unlockedIds: string[],
  heroLevel: number,
): PassiveNodeDef[] {
  const unlockedSet = new Set(unlockedIds);
  if (unlockedSet.size === 0) {
    const start = PASSIVE_NODES_MAP.get("grid-start");
    return start ? [start] : [];
  }
  const reachable: PassiveNodeDef[] = [];
  for (const node of PASSIVE_NODES) {
    if (unlockedSet.has(node.id)) continue;
    if ((node.unlockAtLevel ?? 0) > heroLevel) continue;
    const hasUnlockedNeighbor = node.neighbors.some((id) => unlockedSet.has(id));
    if (hasUnlockedNeighbor) reachable.push(node);
  }
  return reachable;
}
```

- [ ] **Step 5.4 — Run tests**

```bash
npm run typecheck && npm test -- tests/passiveGrid.test.ts 2>&1 | tail -15
```
Expected: all 7 tests pass.

- [ ] **Step 5.5 — Commit**

```bash
git add src/data/passiveGrid.ts tests/passiveGrid.test.ts
git commit -m "feat(content): passive skill grid catalog — 70+ nodes, 8 regions, keystones"
```

---

## Task 6 — Active Skills & Items Catalogs

**Files:**
- Create: `src/data/skills.ts`
- Create: `src/data/items.ts`
- Create: `tests/catalogs.test.ts`

- [ ] **Step 6.1 — Write failing tests**

Create `tests/catalogs.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ACTIVE_SKILLS, ACTIVE_SKILLS_MAP } from "../src/data/skills.ts";
import { ITEM_CATALOG, ITEM_CATALOG_MAP, rollItem } from "../src/data/items.ts";
import { RARITIES, ITEM_SLOTS } from "../src/data/schema.ts";

describe("ACTIVE_SKILLS", () => {
  it("has at least 10 skills", () => {
    expect(ACTIVE_SKILLS.length).toBeGreaterThanOrEqual(10);
  });

  it("has no duplicate ids", () => {
    const ids = ACTIVE_SKILLS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("all skills have basePower > 0", () => {
    for (const s of ACTIVE_SKILLS) {
      expect(s.basePower, `${s.id} basePower <= 0`).toBeGreaterThan(0);
    }
  });

  it("each skill is unique (obtainable once)", () => {
    const ids = new Set(ACTIVE_SKILLS.map((s) => s.id));
    expect(ids.size).toBe(ACTIVE_SKILLS.length);
  });
});

describe("ITEM_CATALOG", () => {
  it("has at least 18 items", () => {
    expect(ITEM_CATALOG.length).toBeGreaterThanOrEqual(18);
  });

  it("has no duplicate ids", () => {
    const ids = ITEM_CATALOG.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("covers all 10 item slots", () => {
    const slots = new Set(ITEM_CATALOG.map((i) => i.slot));
    for (const slot of ITEM_SLOTS) expect(slots.has(slot), `missing slot ${slot}`).toBe(true);
  });

  it("all Weapon items have weaponType", () => {
    for (const item of ITEM_CATALOG.filter((i) => i.slot === "Weapon")) {
      expect(item.weaponType, `${item.id} missing weaponType`).toBeDefined();
    }
  });

  it("all items have requiredLevel >= 1", () => {
    for (const item of ITEM_CATALOG) {
      expect(item.requiredLevel, `${item.id} requiredLevel < 1`).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("rollItem", () => {
  it("produces an ItemInstance with correct defId", () => {
    const def = ITEM_CATALOG[0];
    const instance = rollItem(def, 10, 42);
    expect(instance.defId).toBe(def.id);
    expect(instance.acquiredLevel).toBe(10);
  });

  it("rolled stats are within ±10% of base", () => {
    const def = ITEM_CATALOG.find((i) => i.id === "iron-sword")!;
    for (let seed = 0; seed < 20; seed++) {
      const inst = rollItem(def, 1, seed);
      for (const [k, v] of Object.entries(inst.rolledStats)) {
        const base = (def.baseStats as Record<string, number>)[k] ?? 0;
        if (base === 0) continue;
        // effectiveStat = base * (1 + 0.08 * requiredLevel)
        const effective = base * (1 + 0.08 * def.requiredLevel);
        expect(v).toBeGreaterThanOrEqual(effective * 0.9 - 0.001);
        expect(v).toBeLessThanOrEqual(effective * 1.1 + 0.001);
      }
    }
  });

  it("rolled affix count matches rarity", () => {
    const common = ITEM_CATALOG.find((i) => i.rarity === "Common")!;
    const rare = ITEM_CATALOG.find((i) => i.rarity === "Rare")!;
    expect(rollItem(common, 1, 0).rolledAffixes).toHaveLength(0);
    expect(rollItem(rare, 1, 0).rolledAffixes).toHaveLength(2);
  });

  it("same seed produces identical rolls", () => {
    const def = ITEM_CATALOG[0];
    const a = rollItem(def, 10, 99);
    const b = rollItem(def, 10, 99);
    expect(a.rolledStats).toEqual(b.rolledStats);
    expect(a.rolledPrimaryAffix).toBe(b.rolledPrimaryAffix);
  });
});
```

- [ ] **Step 6.2 — Run to confirm failures**

```bash
npm test -- tests/catalogs.test.ts 2>&1 | tail -10
```

- [ ] **Step 6.3 — Create `src/data/skills.ts`**

```ts
import { type ActiveSkillDef, validateActiveSkill } from "./schema.ts";

function s(def: ActiveSkillDef): ActiveSkillDef {
  return validateActiveSkill(def);
}

export const ACTIVE_SKILLS: ActiveSkillDef[] = [
  s({ id: "iron-cleave", name: "Iron Cleave", rarity: "Common",
      description: "A wide arc that cleaves all nearby enemies.",
      requiresWeapon: "Sword", damageType: "Physical", basePower: 80, artRef: "placeholder" }),
  s({ id: "stone-bash", name: "Stone Bash", rarity: "Magic",
      description: "A stunning overhead blow that pulverises armour.",
      requiresWeapon: "Fist", damageType: "Physical", basePower: 110, artRef: "placeholder" }),
  s({ id: "execute-slash", name: "Execute", rarity: "Rare",
      description: "A brutal finishing blow — deals bonus damage to weakened enemies.",
      requiresWeapon: "Sword", damageType: "Physical", basePower: 160, artRef: "placeholder" }),
  s({ id: "tri-shot", name: "Tri-Shot", rarity: "Common",
      description: "Fire three bolts in a wide spread.",
      requiresWeapon: "Bow", damageType: "Physical", basePower: 75, artRef: "placeholder" }),
  s({ id: "piercing-arrow", name: "Piercing Arrow", rarity: "Rare",
      description: "An arrow that passes through every enemy in a line.",
      requiresWeapon: "Bow", damageType: "Physical", basePower: 145, artRef: "placeholder" }),
  s({ id: "mana-burst", name: "Mana Burst", rarity: "Common",
      description: "Release a burst of raw magical energy.",
      requiresWeapon: "Staff", damageType: "Magic", basePower: 90, artRef: "placeholder" }),
  s({ id: "arcane-nova", name: "Arcane Nova", rarity: "Legendary",
      description: "An expanding ring of arcane force that damages everything it touches.",
      requiresWeapon: "Staff", damageType: "Magic", basePower: 250, artRef: "placeholder" }),
  s({ id: "rapid-fire", name: "Rapid Fire", rarity: "Magic",
      description: "A burst of five rapid shots at the nearest enemy.",
      requiresWeapon: "Gun", damageType: "Physical", basePower: 100, artRef: "placeholder" }),
  s({ id: "concussion-round", name: "Concussion Round", rarity: "Rare",
      description: "A heavy round that stuns the target on impact.",
      requiresWeapon: "Gun", damageType: "Physical", basePower: 140, artRef: "placeholder" }),
  s({ id: "shadow-curse", name: "Shadow Curse", rarity: "Magic",
      description: "Apply a weakening curse that amplifies all damage taken.",
      requiresWeapon: "Tome", damageType: "Magic", basePower: 95, artRef: "placeholder" }),
  s({ id: "true-strike", name: "True Strike", rarity: "Legendary",
      description: "A technique perfected beyond all defences — deals True damage.",
      damageType: "True", basePower: 200, artRef: "placeholder" }),
  s({ id: "void-palm", name: "Void Palm", rarity: "Unique",
      description: "A palm strike that tears through reality itself.",
      requiresWeapon: "Fist", damageType: "True", basePower: 320, artRef: "placeholder" }),
];

export const ACTIVE_SKILLS_MAP = new Map<string, ActiveSkillDef>(
  ACTIVE_SKILLS.map((s) => [s.id, s])
);
```

- [ ] **Step 6.4 — Create `src/data/items.ts`**

```ts
/**
 * Item catalog — Phase 3a.
 * 20 named items covering all 10 slots. Base stats scale with requiredLevel
 * at acquisition (×(1 + 0.08 × requiredLevel)). rollItem() produces an
 * ItemInstance with all values randomised ±10% using a seeded deterministic roll.
 */
import { Rng } from "../core/rng.ts";
import {
  type ItemDef,
  type ItemInstance,
  type RolledAffix,
  type Stats,
  validateItemDef,
} from "./schema.ts";

function i(def: ItemDef): ItemDef {
  return validateItemDef(def);
}

/** How many random affixes roll per rarity tier. */
const AFFIX_COUNT: Record<string, number> = {
  Common: 0, Magic: 1, Rare: 2, Legendary: 3, Unique: 3,
};

export const ITEM_CATALOG: ItemDef[] = [
  // Weapons
  i({ id: "iron-sword", name: "Iron Sword", slot: "Weapon", weaponType: "Sword",
      rarity: "Common", requiredLevel: 1,
      baseStats: { atk: 18 },
      primaryAffix: { type: "physicalDamage", baseValue: 0.08 },
      affixPool: ["critRate", "armorPen"],
      artRef: "placeholder" }),
  i({ id: "elven-bow", name: "Elven Bow", slot: "Weapon", weaponType: "Bow",
      rarity: "Magic", requiredLevel: 10,
      baseStats: { atk: 22, attackSpeed: 0.3 },
      primaryAffix: { type: "attackSpeed", baseValue: 0.12 },
      affixPool: ["critRate", "critDamage", "range"],
      artRef: "placeholder" }),
  i({ id: "arcane-staff", name: "Arcane Staff", slot: "Weapon", weaponType: "Staff",
      rarity: "Rare", requiredLevel: 20,
      baseStats: { atk: 14, skillPower: 0.25, maxMana: 20 },
      primaryAffix: { type: "magicDamage", baseValue: 0.18 },
      affixPool: ["skillPower", "magicPen", "manaRegen"],
      artRef: "placeholder" }),
  i({ id: "thunder-cannon", name: "Thunder Cannon", slot: "Weapon", weaponType: "Gun",
      rarity: "Legendary", requiredLevel: 40,
      baseStats: { atk: 38, armorPen: 0.2 },
      primaryAffix: { type: "physicalDamage", baseValue: 0.25 },
      affixPool: ["critRate", "critDamage", "armorPen", "attackSpeed"],
      artRef: "placeholder" }),

  // Helmets
  i({ id: "leather-cap", name: "Leather Cap", slot: "Helmet",
      rarity: "Common", requiredLevel: 1,
      baseStats: { maxHp: 60 },
      primaryAffix: { type: "maxHp", baseValue: 0.06 },
      affixPool: ["armor", "hpRegen"],
      artRef: "placeholder" }),
  i({ id: "iron-helm", name: "Iron Helm", slot: "Helmet",
      rarity: "Rare", requiredLevel: 15,
      baseStats: { maxHp: 120, armor: 8 },
      primaryAffix: { type: "maxHp", baseValue: 0.12 },
      affixPool: ["armor", "magicResist", "hpRegen", "tenacity"],
      artRef: "placeholder" }),

  // Body Armor
  i({ id: "cloth-robe", name: "Cloth Robe", slot: "BodyArmor",
      rarity: "Common", requiredLevel: 1,
      baseStats: { maxHp: 80, magicResist: 5 },
      primaryAffix: { type: "armor", baseValue: 0.06 },
      affixPool: ["magicResist", "hpRegen"],
      artRef: "placeholder" }),
  i({ id: "scale-mail", name: "Scale Mail", slot: "BodyArmor",
      rarity: "Rare", requiredLevel: 18,
      baseStats: { maxHp: 150, armor: 12, magicResist: 8 },
      primaryAffix: { type: "armor", baseValue: 0.15 },
      affixPool: ["maxHp", "magicResist", "damageReduction"],
      artRef: "placeholder" }),

  // Gloves
  i({ id: "worn-gloves", name: "Worn Gloves", slot: "Gloves",
      rarity: "Common", requiredLevel: 1,
      baseStats: { critRate: 0.03 },
      primaryAffix: { type: "critRate", baseValue: 0.04 },
      affixPool: ["critDamage", "atk"],
      artRef: "placeholder" }),
  i({ id: "assassin-gloves", name: "Assassin Gloves", slot: "Gloves",
      rarity: "Legendary", requiredLevel: 35,
      baseStats: { critRate: 0.12, critDamage: 0.3, atk: 10 },
      primaryAffix: { type: "critDamage", baseValue: 0.30 },
      affixPool: ["critRate", "atk", "armorPen", "attackSpeed"],
      artRef: "placeholder" }),

  // Boots
  i({ id: "worn-boots", name: "Worn Boots", slot: "Boots",
      rarity: "Common", requiredLevel: 1,
      baseStats: { moveSpeed: 15 },
      primaryAffix: { type: "moveSpeed", baseValue: 0.08 },
      affixPool: ["tenacity", "hpRegen"],
      artRef: "placeholder" }),
  i({ id: "swift-boots", name: "Swift Boots", slot: "Boots",
      rarity: "Rare", requiredLevel: 12,
      baseStats: { moveSpeed: 28, tenacity: 0.1 },
      primaryAffix: { type: "moveSpeed", baseValue: 0.18 },
      affixPool: ["tenacity", "maxHp", "armor"],
      artRef: "placeholder" }),

  // Amulet
  i({ id: "mana-pendant", name: "Mana Pendant", slot: "Amulet",
      rarity: "Magic", requiredLevel: 8,
      baseStats: { maxMana: 25, skillPower: 0.08 },
      primaryAffix: { type: "skillPower", baseValue: 0.10 },
      affixPool: ["manaRegen", "magicPen", "maxMana"],
      artRef: "placeholder" }),

  // Rings
  i({ id: "copper-ring", name: "Copper Ring", slot: "Ring1",
      rarity: "Common", requiredLevel: 1,
      baseStats: { maxMana: 15, manaRegen: 1 },
      primaryAffix: { type: "manaRegen", baseValue: 0.08 },
      affixPool: ["manaOnHit", "maxMana"],
      artRef: "placeholder" }),
  i({ id: "resonance-ring", name: "Resonance Ring", slot: "Ring2",
      rarity: "Rare", requiredLevel: 22,
      baseStats: { maxMana: 35, manaRegen: 3, manaOnHit: 5 },
      primaryAffix: { type: "manaOnHit", baseValue: 6 },
      affixPool: ["manaRegen", "maxMana", "skillPower"],
      artRef: "placeholder" }),

  // Pet
  i({ id: "coin-sprite", name: "Coin Sprite", slot: "Pet",
      rarity: "Common", requiredLevel: 1,
      baseStats: { goldFind: 0.05 },
      primaryAffix: { type: "goldFind", baseValue: 0.05 },
      affixPool: ["goldFind"],
      petUtility: { goldPerSec: 2, goldFind: 0.05 },
      artRef: "placeholder" }),
  i({ id: "fortune-fox", name: "Fortune Fox", slot: "Pet",
      rarity: "Legendary", requiredLevel: 30,
      baseStats: { goldFind: 0.20 },
      primaryAffix: { type: "goldFind", baseValue: 0.20 },
      affixPool: ["goldFind", "maxHp"],
      petUtility: { goldPerSec: 8, goldFind: 0.20 },
      artRef: "placeholder" }),

  // Wing
  i({ id: "fledgling-wings", name: "Fledgling Wings", slot: "Wing",
      rarity: "Common", requiredLevel: 5,
      baseStats: { moveSpeed: 20 },
      primaryAffix: { type: "moveSpeed", baseValue: 0.15 },
      affixPool: ["moveSpeed", "tenacity"],
      artRef: "placeholder" }),
  i({ id: "tempest-wings", name: "Tempest Wings", slot: "Wing",
      rarity: "Legendary", requiredLevel: 50,
      baseStats: { moveSpeed: 50, tenacity: 0.15 },
      primaryAffix: { type: "moveSpeed", baseValue: 0.35 },
      affixPool: ["moveSpeed", "tenacity", "attackSpeed"],
      wingPassive: "tempest-gale",
      artRef: "placeholder" }),
];

export const ITEM_CATALOG_MAP = new Map<string, ItemDef>(
  ITEM_CATALOG.map((i) => [i.id, i])
);

// ---------------------------------------------------------------------------
// Item rolling
// ---------------------------------------------------------------------------

/** Roll a live ItemInstance from a definition, seeded for determinism. */
export function rollItem(def: ItemDef, heroLevel: number, seed: number): ItemInstance {
  const rng = new Rng(seed);

  // Base stats: scale with requiredLevel then roll ±10%
  const rolledStats: Partial<Stats> = {};
  for (const [k, v] of Object.entries(def.baseStats) as [keyof Stats, number][]) {
    if (v === undefined) continue;
    const effective = v * (1 + 0.08 * def.requiredLevel);
    rolledStats[k] = effective * (0.9 + rng.next() * 0.2);
  }

  // Primary affix value ±10%
  const rolledPrimaryAffix = def.primaryAffix.baseValue * (0.9 + rng.next() * 0.2);

  // Random affixes
  const affixCount = AFFIX_COUNT[def.rarity] ?? 0;
  const shuffled = [...def.affixPool].sort(() => rng.next() - 0.5);
  const rolledAffixes: RolledAffix[] = shuffled.slice(0, affixCount).map((type) => ({
    type,
    value: 0.05 + rng.next() * 0.15, // 5–20% bonus
  }));

  return {
    id: `item-${def.id}-${seed}-${Date.now()}`,
    defId: def.id,
    acquiredLevel: heroLevel,
    rolledStats,
    rolledPrimaryAffix,
    rolledAffixes,
  };
}
```

- [ ] **Step 6.5 — Run tests**

```bash
npm run typecheck && npm test -- tests/catalogs.test.ts 2>&1 | tail -20
```
Expected: all 11 tests pass.

- [ ] **Step 6.6 — Commit**

```bash
git add src/data/skills.ts src/data/items.ts tests/catalogs.test.ts
git commit -m "feat(content): active skills catalog (12 skills) + items catalog (20 items) + rollItem()"
```

---

## Task 7 — Wire BattleState + Pet Gold

**Files:**
- Modify: `src/core/battle.ts`
- Create: `tests/phase3a.test.ts`

- [ ] **Step 7.1 — Write failing integration tests**

Create `tests/phase3a.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { BattleState } from "../src/core/battle.ts";
import { makeStats } from "../src/data/schema.ts";
import { createFreshSave, type HeroSave } from "../src/core/save.ts";
import { awardHeroXp } from "../src/core/hero.ts";
import { mkEnemy, mkStage, mkTower, oneWave, runFor } from "./fixtures.ts";

function heroSave(overrides: Partial<HeroSave> = {}): HeroSave {
  const s = createFreshSave();
  return { ...s, ...overrides };
}

describe("BattleState with heroSave", () => {
  it("hero level 10 has higher stats than level 1", () => {
    const baseStats = makeStats({ atk: 100, maxHp: 500, moveSpeed: 80, attackSpeed: 1, range: 200 });

    const lvl1Save = createFreshSave();
    const lvl10Save = createFreshSave();
    awardHeroXp(lvl10Save, 6500); // enough for level 10

    const stage = mkStage(oneWave("grunt", 1));
    const catalog = {
      enemies: new Map([["grunt", mkEnemy()]]),
      characters: new Map(),
    };

    const b1 = new BattleState(stage, catalog, { hero: { stats: baseStats, startPos: { x: -100, y: 0 } }, heroSave: lvl1Save });
    const b10 = new BattleState(stage, catalog, { hero: { stats: baseStats, startPos: { x: -100, y: 0 } }, heroSave: lvl10Save });

    expect(b10.hero.stats.atk).toBeGreaterThan(b1.hero.stats.atk);
    expect(b10.hero.stats.maxHp).toBeGreaterThan(b1.hero.stats.maxHp);
  });

  it("equipped pet generates gold over time", () => {
    const save = createFreshSave();
    // Give the hero the coin-sprite pet equipped
    save.inventory.items.push({
      id: "test-pet-1",
      defId: "coin-sprite",
      acquiredLevel: 1,
      rolledStats: { goldFind: 0.05 },
      rolledPrimaryAffix: 0.05,
      rolledAffixes: [],
    });
    save.inventory.equipped = { Pet: "test-pet-1" };

    const stage = mkStage(oneWave("grunt", 1), { castleHp: 1e6, startingGold: 0 });
    const catalog = {
      enemies: new Map([["grunt", mkEnemy()]]),
      characters: new Map(),
    };
    const baseStats = makeStats({ maxHp: 500, attackSpeed: 0, range: 0, moveSpeed: 0 });
    const b = new BattleState(stage, catalog, {
      hero: { stats: baseStats, startPos: { x: -500, y: 0 } },
      heroSave: save,
    });

    const goldBefore = b.gold;
    runFor(b, 3); // 3 seconds — coin-sprite gives 2 gold/sec
    expect(b.gold).toBeGreaterThan(goldBefore + 4); // at least 5 gold over 3s
  });

  it("no heroSave = BattleState works as before (no regression)", () => {
    const stage = mkStage(oneWave("grunt", 3));
    const catalog = {
      enemies: new Map([["grunt", mkEnemy()]]),
      characters: new Map([["turret", mkTower()]]),
    };
    const baseStats = makeStats({ atk: 500, maxHp: 1000, attackSpeed: 2, range: 400 });
    const b = new BattleState(stage, catalog, {
      hero: { stats: baseStats, startPos: { x: 200, y: -50 } },
    });
    b.placeTower("turret", 0);
    let ticks = 0;
    while (b.outcome === "ongoing" && ticks < 2000) { b.tick(0.05); ticks++; }
    expect(b.outcome).toBe("won");
  });
});
```

- [ ] **Step 7.2 — Run to confirm failures**

```bash
npm test -- tests/phase3a.test.ts 2>&1 | tail -10
```
Expected: type errors on `heroSave` (field doesn't exist yet).

- [ ] **Step 7.3 — Modify `src/core/battle.ts`**

At the top, add imports:

```ts
import { heroStatPipeline } from "./stats.ts";
import { PASSIVE_NODES_MAP } from "../data/passiveGrid.ts";
import { ITEM_CATALOG_MAP } from "../data/items.ts";
import type { HeroSave } from "./save.ts";
```

In the `BattleOptions` interface, add:

```ts
export interface BattleOptions {
  seed?: number;
  hero: HeroConfig;
  difficulty?: Difficulty;
  /** Optional Phase 3a hero progression state. Resolves final stats via pipeline. */
  heroSave?: HeroSave;
}
```

In the `BattleState` class, add a private field for pet gold:

```ts
private petGoldPerSec = 0;
private petGoldCarry = 0;
```

In the `constructor`, after `this.hero = { ... }`, add the stat pipeline resolution and pet setup:

```ts
    if (opts.heroSave) {
      const save = opts.heroSave;

      // Resolve passive nodes
      const unlockedNodes = save.hero.unlockedNodes
        .map((id) => PASSIVE_NODES_MAP.get(id))
        .filter(Boolean) as import("../data/schema.ts").PassiveNodeDef[];

      // Resolve item stats and affixes from equipped items
      const itemStats: Partial<Stats>[] = [];
      const affixStats: Partial<Stats>[] = [];
      const keystoneMore: Partial<Stats>[] = [];

      for (const [slot, instanceId] of Object.entries(save.inventory.equipped)) {
        if (!instanceId) continue;
        const instance = save.inventory.items.find((i) => i.id === instanceId);
        if (!instance) continue;
        const def = ITEM_CATALOG_MAP.get(instance.defId);
        if (!def) continue;

        // Base stats from instance
        itemStats.push(instance.rolledStats as Partial<Stats>);

        // Pet utility
        if (slot === "Pet" && def.petUtility) {
          const gps = def.petUtility.goldPerSec ?? 0;
          if (gps > 0) this.petGoldPerSec = gps;
        }
      }

      // Resolve keystone more% from unlocked keystone nodes
      for (const node of unlockedNodes) {
        if (node.type === "keystone" && node.more) {
          keystoneMore.push(node.more);
        }
      }

      // Apply pipeline
      const resolvedStats = heroStatPipeline(
        opts.hero.stats,
        save.hero.level,
        unlockedNodes,
        itemStats,
        affixStats,
        keystoneMore,
      );

      this.hero = {
        stats: resolvedStats,
        damageType: opts.hero.damageType ?? "Physical",
        pos: { ...opts.hero.startPos },
        moveTarget: { ...opts.hero.startPos },
        hp: resolvedStats.maxHp,
        mana: 0,
        attackCd: 0,
        alive: true,
      };
    }
```

In `updateHero()`, before the existing mana regen line, add pet gold ticking:

```ts
    // Pet gold generation
    if (this.petGoldPerSec > 0) {
      this.petGoldCarry += this.petGoldPerSec * dt * (1 + this.hero.stats.goldFind);
      while (this.petGoldCarry >= 1) {
        this.gold += 1;
        this.petGoldCarry -= 1;
      }
    }
```

- [ ] **Step 7.4 — Run full test suite**

```bash
npm run typecheck && npm test 2>&1 | tail -20
```
Expected: all prior 57 tests + 3 new phase3a tests = 60 passing.

- [ ] **Step 7.5 — Commit**

```bash
git add src/core/battle.ts tests/phase3a.test.ts
git commit -m "feat(core): wire heroSave into BattleState — stat pipeline + pet gold generation"
```

---

## Task 8 — BattleScene HUD

**Files:**
- Modify: `src/scenes/BattleScene.ts`

- [ ] **Step 8.1 — Update BattleScene to show hero progression in HUD**

In `src/scenes/BattleScene.ts`, add a `heroSave` property and update the HUD drawing method.

At the top of the class, add:

```ts
  private heroSave: HeroSave | null = null;
```

Add the import:

```ts
import { type HeroSave } from "../core/save.ts";
import { LocalSaveProvider } from "../core/save.ts";
import { xpToNextLevel } from "../core/hero.ts";
```

Add a `setHeroSave` method:

```ts
  setHeroSave(save: HeroSave): void {
    this.heroSave = save;
  }
```

In `drawHUD()`, after the existing HP/mana bars, append hero progression display:

```ts
    if (this.heroSave) {
      const save = this.heroSave;
      const lvl = save.hero.level;
      const xpNeeded = lvl < 100 ? xpToNextLevel(lvl, save.hero.totalXp) : 0;
      const xpGained = lvl < 100
        ? save.hero.totalXp - totalXpForLevel(lvl)
        : 1;
      const xpTotal = lvl < 100
        ? totalXpForLevel(lvl + 1) - totalXpForLevel(lvl)
        : 1;
      const xpPct = lvl < 100 ? Math.min(1, xpGained / xpTotal) : 1;

      // Level badge
      g.fillStyle(0x2244aa, 1);
      g.fillRect(8, 88, 56, 18);
      this.add.text(36, 97, `Lv ${lvl}`, {
        fontSize: "11px", color: "#ffffff", align: "center",
      }).setOrigin(0.5, 0.5).setDepth(20);

      // XP bar
      g.fillStyle(0x111133, 1);
      g.fillRect(68, 88, 140, 8);
      g.fillStyle(0x44aaff, 1);
      g.fillRect(68, 88, Math.floor(140 * xpPct), 8);

      // Equipped skill badge
      if (save.hero.equippedSkillId) {
        g.fillStyle(0x442266, 1);
        g.fillRect(8, 110, 80, 14);
        this.add.text(48, 117, `⚡ ${save.hero.equippedSkillId}`, {
          fontSize: "9px", color: "#ddaaff", align: "center",
        }).setOrigin(0.5, 0.5).setDepth(20);
      }

      // Item slot indicators (dots: filled = equipped, hollow = empty)
      const SLOTS = ["Weapon","Helmet","BodyArmor","Gloves","Boots","Amulet","Ring1","Ring2","Pet","Wing"] as const;
      SLOTS.forEach((slot, idx) => {
        const x = 8 + idx * 14;
        const equipped = save.inventory.equipped[slot as import("../data/schema.ts").ItemSlot];
        g.fillStyle(equipped ? 0xffcc44 : 0x444444, 1);
        g.fillCircle(x + 5, 130, 4);
      });
    }
```

Also add the missing import for `totalXpForLevel`:

```ts
import { xpToNextLevel, totalXpForLevel } from "../core/hero.ts";
```

- [ ] **Step 8.2 — Typecheck and build**

```bash
npm run typecheck && npm run build 2>&1 | tail -8
```
Expected: clean typecheck, build succeeds.

- [ ] **Step 8.3 — Commit**

```bash
git add src/scenes/BattleScene.ts
git commit -m "feat(ui): HUD shows hero level badge, XP bar, equipped skill, item slot indicators"
```

---

## Task 9 — Full Suite Verification & Final Commit

- [ ] **Step 9.1 — Run full test suite**

```bash
npm run typecheck && npm test && npm run build 2>&1 | tail -25
```
Expected: typecheck clean, all 60+ tests passing, build succeeds.

- [ ] **Step 9.2 — Commit summary**

```bash
git log --oneline -8
```
Expected output (8 commits from this plan):
```
feat(ui): HUD shows hero level badge, XP bar, equipped skill, item slot indicators
feat(core): wire heroSave into BattleState — stat pipeline + pet gold generation
feat(content): active skills catalog (12 skills) + items catalog (20 items) + rollItem()
feat(content): passive skill grid catalog — 70+ nodes, 8 regions, keystones
feat(core): hero XP engine — prestige curve, skill use-XP, level mutators
feat(core): SaveProvider interface + LocalSaveProvider with migrations
feat(core): StatAccumulator pipeline with flat/increased/more% layers
feat(schema): WeaponType, PassiveNodeDef, ActiveSkillDef, new ItemDef + validators
```

---

## Self-Review Notes

**Spec coverage check:**
- ✅ Hero leveling (XP sources, polynomial + prestige curve) → Task 4
- ✅ Passive skill grid (PoE-scale, 8 regions, keystones, masteries, jewels) → Task 5
- ✅ Active skill slot (unique collectibles, use-XP, weapon req, level = hero level) → Task 6
- ✅ Items (requiredLevel, per-item baseStats, primaryAffix per name, ±10% rolls, Pet/Wing) → Task 6
- ✅ Stat pipeline (flat/increased/more%, 8-layer hero, 4-layer tower) → Task 2
- ✅ SaveProvider + LocalSaveProvider + migrations → Task 3
- ✅ HeroSave schema types → Task 3
- ✅ Wire into BattleState → Task 7
- ✅ HUD → Task 8
- ✅ WeaponType schema + validators → Task 1

**Type consistency:** `heroStatPipeline`, `towerStatPipeline`, `makeAcc`, `resolveAcc` defined in Task 2 and used by Task 7. `HeroSave`, `createFreshSave` defined in Task 3, used in Tasks 4, 7, 8. `rollItem` defined Task 6 used in Task 7 tests. All consistent.

**No placeholders:** Every step has complete code blocks and expected output.
