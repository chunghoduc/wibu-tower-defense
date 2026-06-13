# Craft Wings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Forge "Craft Wings" station that burns ≥5 gear + Jewel of Chaos + Feather for a chance at a random-rarity pair of Wings.

**Architecture:** A pure `wingCraft.ts` core owns all formula/roll logic (Phaser-free, fully tested); two new materials are added to the data catalog and faucet through boss chests; `SaveManager.craftWings` wraps the core with persistence; a `wingCraftDialog.ts` overlay (opened from `ForgeScene`) is the UI. Crafted output reuses the existing 5-tier **skywings** item line — no new wing art.

**Tech Stack:** TypeScript, Phaser 3, Vitest, ESLint (max-lines 500 code lines), local Z-Image-Turbo art API.

Reference spec: `docs/superpowers/specs/2026-06-13-craft-wings-design.md`.

---

## File Structure

**New**
- `src/core/wingCraft.ts` — constants, `wingSuccessChance`, `wingOutcomeOdds`, `skywingsDefId`, `craftWings`, result types. Pure.
- `src/scenes/wingCraftDialog.ts` — overlay presenter (item picker + jewel stepper + preview + craft).
- `tests/wingCraft.test.ts` — formula, validation, distribution, mint/consume.
- `public/assets/sprites/material/jewel-of-chaos.png`, `feather.png` — 96×96 icons.

**Changed**
- `src/data/materials.ts` — `JEWEL_OF_CHAOS` + `FEATHER` exports + defs.
- `src/core/boxes.ts` — feather + jewel-of-chaos per-tier `bonusMaterials`.
- `src/core/saveManagerCore.ts` — `craftWings` wrapper.
- `src/scenes/ForgeScene.ts` — Craft Wings section + open-dialog button.
- `src/data/assetVersion.ts` — bump `ASSET_VERSION`.
- `tests/wingMaterials.test.ts` (new small guard) — the 2 new materials exist & have icon ids.

---

## Task 1: New materials (Jewel of Chaos + Feather)

**Files:**
- Create: `tests/wingMaterials.test.ts`
- Modify: `src/data/materials.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/wingMaterials.test.ts
import { describe, expect, it } from "vitest";
import { MATERIALS_MAP, JEWEL_OF_CHAOS, FEATHER } from "../src/data/materials.ts";
import { MATERIAL_ICON_IDS } from "../src/data/materialIconManifest.ts";

describe("wing-craft materials", () => {
  it("Jewel of Chaos exists with its own id (NOT the Entropy id)", () => {
    expect(JEWEL_OF_CHAOS).toBe("jewel-of-chaos");
    const m = MATERIALS_MAP.get(JEWEL_OF_CHAOS)!;
    expect(m.name).toBe("Jewel of Chaos");
    expect(m.kind).toBe("jewel");
    expect(m.icon).toBe("jewel-of-chaos");
  });

  it("Feather exists", () => {
    expect(FEATHER).toBe("feather");
    const m = MATERIALS_MAP.get(FEATHER)!;
    expect(m.name).toBe("Feather");
  });

  it("both new materials get painted icons (non-box ⇒ in MATERIAL_ICON_IDS)", () => {
    expect(MATERIAL_ICON_IDS).toContain("jewel-of-chaos");
    expect(MATERIAL_ICON_IDS).toContain("feather");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/wingMaterials.test.ts`
Expected: FAIL — `JEWEL_OF_CHAOS`/`FEATHER` are not exported.

- [ ] **Step 3: Add the exports + defs**

In `src/data/materials.ts`, after the `CHAOS_JEWEL` export block (~line 13) add:

```ts
/** Wing-craft material (Forge → Craft Wings). Each one raises the craft's
 *  success chance; mandatory minimum 1, up to 4. NOTE: distinct id from the
 *  Jewel of Entropy (`chaos-jewel`) — do not conflate the two. */
export const JEWEL_OF_CHAOS = "jewel-of-chaos";
/** Wing-craft seed — exactly one is consumed per wing-craft attempt. */
export const FEATHER = "feather";
```

In the `MATERIALS` array, after the `AWAKENING_CRYSTAL` entry (before the closing `]`) add:

```ts
  {
    id: JEWEL_OF_CHAOS,
    name: "Jewel of Chaos",
    kind: "jewel",
    icon: "jewel-of-chaos",
    description:
      "A volatile gem of raw chaos. Spend it in the Forge to craft Wings — each Jewel added raises the craft's success chance (up to four).",
  },
  {
    id: FEATHER,
    name: "Feather",
    kind: "consumable",
    icon: "feather",
    description:
      "A single luminous flight-feather — the seed of a pair of Wings. One is consumed by every wing-craft attempt.",
  },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/wingMaterials.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add tests/wingMaterials.test.ts src/data/materials.ts
git commit -m "feat(materials): add Jewel of Chaos + Feather (wing-craft materials)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: wingCraft formula + outcome odds (pure)

**Files:**
- Create: `src/core/wingCraft.ts`
- Create/append: `tests/wingCraft.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/wingCraft.test.ts
import { describe, expect, it } from "vitest";
import {
  wingSuccessChance,
  wingOutcomeOdds,
  skywingsDefId,
  MIN_ITEMS,
  MAX_JEWELS,
  SUCCESS_CAP,
} from "../src/core/wingCraft.ts";
import { ITEM_CATALOG_MAP } from "../src/data/items.ts";
import type { Rarity } from "../src/data/schema.ts";

const five = (r: Rarity): Rarity[] => [r, r, r, r, r];

describe("wingSuccessChance", () => {
  it("base 20% + per-item rarity, 1 jewel adds no bonus", () => {
    // 5× Common = 5×0.01 = 0.05; +0.20 base = 0.25
    expect(wingSuccessChance(five("Common"), 1)).toBeCloseTo(0.25, 5);
  });
  it("extra jewels add 10% each (jewel 4 ⇒ +0.30)", () => {
    expect(wingSuccessChance(five("Common"), 4)).toBeCloseTo(0.55, 5);
  });
  it("per-item rarity ladder (Magic .02 / Rare .04 / Leg .07 / Unique .10)", () => {
    expect(wingSuccessChance(five("Magic"), 1)).toBeCloseTo(0.3, 5);
    expect(wingSuccessChance(five("Legendary"), 1)).toBeCloseTo(0.55, 5);
  });
  it("clamps at the 80% cap", () => {
    expect(wingSuccessChance(five("Unique"), 4)).toBe(SUCCESS_CAP); // 0.20+0.50+0.30=1.0 → 0.80
  });
});

describe("wingOutcomeOdds", () => {
  const odds = (rs: Rarity[]) =>
    Object.fromEntries(wingOutcomeOdds(rs).map((o) => [o.rarity, o.chance]));

  it("average Magic ⇒ 60% Common · 35% Magic · 5% Rare (the spec example)", () => {
    const o = odds(five("Magic"));
    expect(o.Common).toBeCloseTo(0.6, 5);
    expect(o.Magic).toBeCloseTo(0.35, 5);
    expect(o.Rare).toBeCloseTo(0.05, 5);
  });
  it("average Common folds the below-weight onto Common (95/5)", () => {
    const o = odds(five("Common"));
    expect(o.Common).toBeCloseTo(0.95, 5);
    expect(o.Magic).toBeCloseTo(0.05, 5);
  });
  it("average Unique folds the above-weight onto Unique (60 Leg / 40 Uni)", () => {
    const o = odds(five("Unique"));
    expect(o.Legendary).toBeCloseTo(0.6, 5);
    expect(o.Unique).toBeCloseTo(0.4, 5);
  });
  it("weights always sum to 1", () => {
    for (const r of ["Common", "Magic", "Rare", "Legendary", "Unique"] as Rarity[]) {
      const sum = wingOutcomeOdds(five(r)).reduce((s, o) => s + o.chance, 0);
      expect(sum).toBeCloseTo(1, 5);
    }
  });
});

describe("skywingsDefId", () => {
  it("maps every rarity to a real skywings def", () => {
    const expected: Record<Rarity, string> = {
      Common: "worn-skywings",
      Magic: "fine-skywings",
      Rare: "masterwork-skywings",
      Legendary: "heroic-skywings",
      Unique: "mythic-skywings",
    };
    for (const r of Object.keys(expected) as Rarity[]) {
      expect(skywingsDefId(r)).toBe(expected[r]);
      expect(ITEM_CATALOG_MAP.get(skywingsDefId(r))?.slot).toBe("Wing");
    }
  });
});

it("exposes the documented constants", () => {
  expect(MIN_ITEMS).toBe(5);
  expect(MAX_JEWELS).toBe(4);
  expect(SUCCESS_CAP).toBe(0.8);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/wingCraft.test.ts`
Expected: FAIL — cannot resolve `../src/core/wingCraft.ts`.

- [ ] **Step 3: Write the pure module (formula half)**

```ts
// src/core/wingCraft.ts
/**
 * Craft Wings — sacrifice ≥5 gear + a Feather + 1–4 Jewels of Chaos for a CHANCE
 * at a random-rarity pair of Wings. A pure gear sink: inputs are consumed whether
 * or not the craft succeeds, and the outcome rarity is biased one tier below the
 * average of the sacrificed gear (rare upside, common downside). Reuses the
 * existing 5-tier skywings item line for the minted wing — no new wing art.
 *
 * The odds helpers mirror boxes.ts/boxRarityOdds: a clamp-and-fold 3-point
 * distribution so preview and roll share one source of truth.
 *
 * Pure mutations on HeroSave (like smelt.ts / reforge.ts); SaveManager wraps with
 * persistence.
 */
import type { HeroSave } from "./save.ts";
import type { ItemInstanceSave } from "./save.ts";
import type { Rng } from "./rng.ts";
import { ITEM_CATALOG_MAP, rollItem, MAX_ITEM_REQ_LEVEL } from "../data/items.ts";
import { type Rarity, RARITIES } from "../data/schema.ts";
import { toItemInstanceSave } from "./itemDrop.ts";
import { JEWEL_OF_CHAOS, FEATHER } from "../data/materials.ts";

export const MIN_ITEMS = 5;
export const BASE_SUCCESS = 0.2;
export const JEWEL_BONUS = 0.1; // per extra jewel beyond the mandatory first
export const MAX_JEWELS = 4;
export const SUCCESS_CAP = 0.8;

/** Per-component success contribution by rarity. */
export const ITEM_RARITY_SUCCESS: Record<Rarity, number> = {
  Common: 0.01,
  Magic: 0.02,
  Rare: 0.04,
  Legendary: 0.07,
  Unique: 0.1,
};

// Outcome distribution: biased one tier DOWN from the component average.
const OUTCOME_W_BELOW = 0.6,
  OUTCOME_W_CENTER = 0.35,
  OUTCOME_W_ABOVE = 0.05;

const SKYWINGS_BY_RARITY: Record<Rarity, string> = {
  Common: "worn-skywings",
  Magic: "fine-skywings",
  Rare: "masterwork-skywings",
  Legendary: "heroic-skywings",
  Unique: "mythic-skywings",
};

/** The skywings def id minted for a given outcome rarity. */
export function skywingsDefId(rarity: Rarity): string {
  return SKYWINGS_BY_RARITY[rarity];
}

/**
 * Success chance for a craft. `rarities` is the rarity of every component item
 * (≥5); `jewels` is the Jewel-of-Chaos count (1..4). Clamped to [0, 0.80].
 */
export function wingSuccessChance(rarities: Rarity[], jewels: number): number {
  const j = Math.max(1, Math.min(MAX_JEWELS, jewels));
  const itemSum = rarities.reduce((s, r) => s + (ITEM_RARITY_SUCCESS[r] ?? 0), 0);
  const jewelBonus = JEWEL_BONUS * (j - 1);
  return Math.max(0, Math.min(SUCCESS_CAP, BASE_SUCCESS + itemSum + jewelBonus));
}

/**
 * Outcome rarity odds — a 3-point band { avg-1, avg, avg+1 } weighted
 * { .60, .35, .05 } around the rounded average component rarity. Off-ladder
 * weight folds onto the nearest valid tier. Pure; drives BOTH preview and roll.
 */
export function wingOutcomeOdds(rarities: Rarity[]): { rarity: Rarity; chance: number }[] {
  const last = RARITIES.length - 1;
  const mean =
    rarities.reduce((s, r) => s + RARITIES.indexOf(r), 0) / Math.max(1, rarities.length);
  const center = Math.max(0, Math.min(last, Math.round(mean)));
  const w = new Array<number>(RARITIES.length).fill(0);
  const add = (idx: number, weight: number) => {
    w[Math.max(0, Math.min(last, idx))] += weight; // clamp folds off-ladder weight inward
  };
  add(center - 1, OUTCOME_W_BELOW);
  add(center, OUTCOME_W_CENTER);
  add(center + 1, OUTCOME_W_ABOVE);
  return RARITIES.map((rarity, i) => ({ rarity, chance: Math.round(w[i] * 1e6) / 1e6 })).filter(
    (o) => o.chance > 0,
  );
}

function pickOutcomeRarity(rarities: Rarity[], rng: Rng): Rarity {
  const odds = wingOutcomeOdds(rarities);
  const total = odds.reduce((a, o) => a + o.chance, 0);
  let r = rng.next() * total;
  for (const o of odds) {
    r -= o.chance;
    if (r <= 0) return o.rarity;
  }
  return odds[odds.length - 1].rarity;
}
```

> NOTE: confirm `src/data/schema.ts` exports `RARITIES` as `["Common","Magic","Rare","Legendary","Unique"]` (it is imported the same way by `boxes.ts`). If the order differs, the index math still holds because it is derived from `RARITIES.indexOf`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/wingCraft.test.ts`
Expected: PASS (the formula/odds/map suites). `pickOutcomeRarity` is unused for now — that's fine, it's `function`-scoped and consumed in Task 3; if ESLint flags no-unused, Task 3 follows immediately. To keep the tree green, add a temporary `void pickOutcomeRarity;` at module end ONLY IF lint fails, and remove it in Task 3.

- [ ] **Step 5: Commit**

```bash
git add src/core/wingCraft.ts tests/wingCraft.test.ts
git commit -m "feat(wings): wingCraft success/outcome formula (pure, tested)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: craftWings resolution (consume + roll + mint)

**Files:**
- Modify: `src/core/wingCraft.ts`
- Append: `tests/wingCraft.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/wingCraft.test.ts`:

```ts
import { craftWings } from "../src/core/wingCraft.ts";
import { createFreshSave } from "../src/core/save.ts";
import { Rng } from "../src/core/rng.ts";
import { rollItem, ITEM_CATALOG_MAP } from "../src/data/items.ts";
import { toItemInstanceSave } from "../src/core/itemDrop.ts";

function saveWith(defIds: string[]) {
  const s = createFreshSave();
  s.hero.level = 30;
  s.materials["jewel-of-chaos"] = 4;
  s.materials["feather"] = 2;
  s.inventory.items = defIds.map((defId, n) =>
    toItemInstanceSave(rollItem(ITEM_CATALOG_MAP.get(defId)!, 30, 100 + n)),
  );
  return s;
}

describe("craftWings", () => {
  // 5 Magic-rarity items (fine-skywings is Magic; any 5 Magic defs work)
  const magicFive = () => ["fine-skywings", "fine-skywings", "fine-skywings", "fine-skywings", "fine-skywings"];

  it("rejects fewer than 5 items, mutating nothing", () => {
    const s = saveWith(magicFive());
    const before = s.inventory.items.length;
    const r = craftWings(s, { itemIds: s.inventory.items.slice(0, 4).map((i) => i.id), jewels: 1 }, new Rng(1));
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("too-few-items");
    expect(s.inventory.items.length).toBe(before);
  });

  it("rejects jewels outside [1,4]", () => {
    const s = saveWith(magicFive());
    const ids = s.inventory.items.map((i) => i.id);
    expect(craftWings(s, { itemIds: ids, jewels: 0 }, new Rng(1)).reason).toBe("bad-jewels");
    expect(craftWings(s, { itemIds: ids, jewels: 5 }, new Rng(1)).reason).toBe("bad-jewels");
  });

  it("rejects when the player lacks a feather", () => {
    const s = saveWith(magicFive());
    s.materials["feather"] = 0;
    const r = craftWings(s, { itemIds: s.inventory.items.map((i) => i.id), jewels: 1 }, new Rng(1));
    expect(r.reason).toBe("no-feather");
  });

  it("consumes items + jewels + 1 feather on SUCCESS and mints a skywings of the rolled rarity", () => {
    const s = saveWith(magicFive());
    const ids = s.inventory.items.map((i) => i.id);
    // Rng seed chosen so the success gate passes; force by maxing jewels (cap 0.55 here)
    // Use a deterministic Rng and assert via the result object rather than the seed.
    let result = craftWings(s, { itemIds: ids, jewels: 4 }, new Rng(12345));
    // Retry a couple of fixed seeds until we land a success (deterministic, no Math.random)
    for (const seed of [1, 2, 3, 7, 11, 42] as number[]) {
      if (result.success) break;
      const s2 = saveWith(magicFive());
      result = craftWings(s2, { itemIds: s2.inventory.items.map((i) => i.id), jewels: 4 }, new Rng(seed));
      if (result.success) {
        expect(result.item).toBeDefined();
        expect(["worn-skywings", "fine-skywings", "masterwork-skywings"]).toContain(result.item!.defId);
        expect(s2.materials["jewel-of-chaos"]).toBe(0);
        expect(s2.materials["feather"]).toBe(1);
        expect(s2.inventory.items.length).toBe(1); // 5 consumed, 1 wing minted
        return;
      }
    }
    throw new Error("no success across fixed seeds — broaden the seed list");
  });

  it("consumes inputs but mints nothing on FAILURE", () => {
    // Find a failing seed deterministically (1 jewel, 5 Common = 25% success)
    const commonFive = () => Array(5).fill("worn-skywings");
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8] as number[]) {
      const s = saveWith(commonFive());
      const r = craftWings(s, { itemIds: s.inventory.items.map((i) => i.id), jewels: 1 }, new Rng(seed));
      if (r.ok && r.success === false) {
        expect(s.inventory.items.length).toBe(0); // 5 consumed, none minted
        expect(s.materials["jewel-of-chaos"]).toBe(3);
        expect(s.materials["feather"]).toBe(1);
        return;
      }
    }
    throw new Error("no failure across fixed seeds — broaden the seed list");
  });
});
```

> NOTE: the save factory is `createFreshSave()` (verified — `src/core/save.ts:158`). It returns `hero.level: 1` and `inventory.equipped: {}`, so no selected item is "equipped". The helper bumps `hero.level` to 30 so rolled wings have non-trivial scalars.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/wingCraft.test.ts`
Expected: FAIL — `craftWings` not exported.

- [ ] **Step 3: Implement `craftWings`**

Append to `src/core/wingCraft.ts`:

```ts
export interface CraftWingsRequest {
  itemIds: string[];
  jewels: number;
}

export type CraftWingsReason =
  | "too-few-items"
  | "bad-jewels"
  | "no-jewels"
  | "no-feather"
  | "missing-item";

export interface CraftWingsResult {
  ok: boolean;
  reason?: CraftWingsReason;
  /** present when ok: did the craft succeed? */
  success?: boolean;
  rarity?: Rarity;
  item?: ItemInstanceSave;
}

/**
 * Resolve a wing craft. Validates, then ALWAYS consumes inputs (the stake), then
 * rolls success and — on success — mints a skywings of the rolled rarity at the
 * hero's level. Mutates `save`.
 */
export function craftWings(save: HeroSave, req: CraftWingsRequest, rng: Rng): CraftWingsResult {
  const { itemIds, jewels } = req;
  if (itemIds.length < MIN_ITEMS) return { ok: false, reason: "too-few-items" };
  if (jewels < 1 || jewels > MAX_JEWELS) return { ok: false, reason: "bad-jewels" };
  if ((save.materials[JEWEL_OF_CHAOS] ?? 0) < jewels) return { ok: false, reason: "no-jewels" };
  if ((save.materials[FEATHER] ?? 0) < 1) return { ok: false, reason: "no-feather" };

  const equipped = new Set(Object.values(save.inventory.equipped).filter(Boolean) as string[]);
  const ids = new Set(itemIds);
  const selected = save.inventory.items.filter((it) => ids.has(it.id));
  if (selected.length < MIN_ITEMS || selected.some((it) => equipped.has(it.id))) {
    return { ok: false, reason: "missing-item" };
  }

  const rarities: Rarity[] = selected.map(
    (it) => ITEM_CATALOG_MAP.get(it.defId)?.rarity ?? "Common",
  );

  // Consume inputs (the stake is paid whatever the outcome).
  save.inventory.items = save.inventory.items.filter((it) => !ids.has(it.id));
  save.materials[JEWEL_OF_CHAOS] = (save.materials[JEWEL_OF_CHAOS] ?? 0) - jewels;
  save.materials[FEATHER] = (save.materials[FEATHER] ?? 0) - 1;

  if (rng.next() >= wingSuccessChance(rarities, jewels)) {
    return { ok: true, success: false };
  }

  const rarity = pickOutcomeRarity(rarities, rng);
  const def = ITEM_CATALOG_MAP.get(skywingsDefId(rarity))!;
  const heroLevel = Math.max(1, save.hero.level);
  const reqLevel = Math.min(MAX_ITEM_REQ_LEVEL, heroLevel);
  const inst = rollItem(def, heroLevel, Math.floor(rng.next() * 999983), reqLevel, {
    ignoreFloor: true,
  });
  const saved = toItemInstanceSave(inst);
  save.inventory.items.push(saved);
  return { ok: true, success: true, rarity, item: saved };
}
```

If you added the temporary `void pickOutcomeRarity;` in Task 2, delete it now.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/wingCraft.test.ts`
Expected: PASS (all suites).

- [ ] **Step 5: Commit**

```bash
git add src/core/wingCraft.ts tests/wingCraft.test.ts
git commit -m "feat(wings): craftWings resolution (consume, roll, mint skywings)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: SaveManager wrapper

**Files:**
- Modify: `src/core/saveManagerCore.ts`

- [ ] **Step 1: Add the import**

Near the other core imports (alongside `smeltItem`/`reforgeItem`, ~line 13-14):

```ts
import { craftWings, type CraftWingsResult } from "./wingCraft.ts";
```

- [ ] **Step 2: Add the method**

After the `reforgeItem` wrapper (~line 363), add:

```ts
  /** Craft Wings: burn ≥5 items + 1..4 Jewels of Chaos + 1 Feather for a chance
   *  at a random-rarity pair of Wings. Persists on any valid attempt. */
  craftWings(
    itemIds: string[],
    jewels: number,
    rng: Rng = new Rng((Math.random() * 1e9) | 0),
  ): CraftWingsResult {
    const r = craftWings(this.save, { itemIds, jewels }, rng);
    if (r.ok) this.persist();
    return r;
  }
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/core/saveManagerCore.ts
git commit -m "feat(wings): SaveManager.craftWings wrapper

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Material sources — boss chests

**Files:**
- Modify: `src/core/boxes.ts`
- Create: `tests/wingBoxDrops.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/wingBoxDrops.test.ts
import { describe, expect, it } from "vitest";
import { boxOdds } from "../src/core/boxes.ts";
import { JEWEL_OF_CHAOS, FEATHER } from "../src/data/materials.ts";

describe("wing materials drop from boss chests", () => {
  it("every tier can drop a Feather, weighted up by tier", () => {
    const chance = (t: number) =>
      boxOdds(`boss-box-t${t}`).bonusMaterials.find((b) => b.id === FEATHER)?.chance ?? 0;
    expect(chance(1)).toBeGreaterThan(0);
    expect(chance(5)).toBeGreaterThan(chance(1));
  });
  it("Jewel of Chaos drops, rarer and weighted to higher tiers", () => {
    const chance = (t: number) =>
      boxOdds(`boss-box-t${t}`).bonusMaterials.find((b) => b.id === JEWEL_OF_CHAOS)?.chance ?? 0;
    expect(chance(1)).toBeGreaterThan(0);
    expect(chance(5)).toBeGreaterThan(chance(1));
    // rarer than feathers at every tier
    for (const t of [1, 2, 3, 4, 5]) {
      const feather = boxOdds(`boss-box-t${t}`).bonusMaterials.find((b) => b.id === FEATHER)!.chance;
      expect(chance(t)).toBeLessThan(feather);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/wingBoxDrops.test.ts`
Expected: FAIL — no feather/jewel in `bonusMaterials`.

- [ ] **Step 3: Add the faucet entries**

In `src/core/boxes.ts`:

3a. Extend the materials import (~line 19-25) to include the two new ids:

```ts
import {
  BLESS_JEWEL,
  SOUL_JEWEL,
  SUMMON_SCROLL,
  OBLIVION_ORB,
  JEWEL_OF_CHAOS,
  FEATHER,
  MATERIALS_MAP,
} from "../data/materials.ts";
```

3b. Add helper constructors next to `soul`/`scroll`/`orb` (~line 48-50):

```ts
const feather = (chance: number): BonusMaterial => ({ id: FEATHER, chance });
const chaos = (chance: number): BonusMaterial => ({ id: JEWEL_OF_CHAOS, chance });
```

3c. Append them to each tier's `bonusMaterials` array (per the spec's drop table):

- T1: `bonusMaterials: [soul(0.05), orb(0.04), feather(0.25), chaos(0.06)],`
- T2: `bonusMaterials: [soul(0.12), scroll(0.03), orb(0.06), feather(0.35), chaos(0.1)],`
- T3: `bonusMaterials: [soul(0.2), scroll(0.06), orb(0.09), feather(0.45), chaos(0.16)],`
- T4: `bonusMaterials: [soul(0.32), scroll(0.1), orb(0.13), feather(0.55), chaos(0.24)],`
- T5: `bonusMaterials: [soul(0.5), scroll(0.16), orb(0.18), feather(0.7), chaos(0.35)],`

(No other code changes — `openBox` already rolls every `bonusMaterials` entry independently, and `boxOddsText` already lists them.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/wingBoxDrops.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/boxes.ts tests/wingBoxDrops.test.ts
git commit -m "feat(wings): boss chests faucet Feather + Jewel of Chaos

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Material icon art + ASSET_VERSION bump

**Files:**
- Create: `public/assets/sprites/material/jewel-of-chaos.png` (96×96)
- Create: `public/assets/sprites/material/feather.png` (96×96)
- Modify: `src/data/assetVersion.ts`

- [ ] **Step 1: Generate the two icons**

Use the **generating-images** skill (local Z-Image-Turbo HTTP API). Generate each at a large size, then crop/resize to **exactly 96×96** with a transparent background (use `scripts/sdart/dewhite.py` / `cutout.py` / `resize_items.py` as needed — the same flow used for existing material icons, which are all 96×96).

Prompts:
- `jewel-of-chaos`: "a single floating faceted magic gemstone of pure chaos, deep violet and black with swirling purple energy and tiny orbiting shards, glowing rim light, game item icon, centered, plain dark background, no text"
- `feather`: "a single luminous white-and-gold angelic flight feather, softly glowing, gently curved, game item icon, centered, plain dark background, no text"

Verify size:

Run: `python3 -c "from PIL import Image; print(Image.open('public/assets/sprites/material/jewel-of-chaos.png').size, Image.open('public/assets/sprites/material/feather.png').size)"`
Expected: `(96, 96) (96, 96)`

- [ ] **Step 2: Bump ASSET_VERSION**

In `src/data/assetVersion.ts`, change:

```ts
export const ASSET_VERSION = "2026-06-13a";
```

to:

```ts
export const ASSET_VERSION = "2026-06-13b";
```

- [ ] **Step 3: Sanity-check the icons load (typecheck only — runtime checked in Task 9)**

Run: `npx tsc --noEmit`
Expected: no errors (no code refs the PNGs directly; `MATERIAL_ICON_IDS` already includes the new ids from Task 1).

- [ ] **Step 4: Commit**

```bash
git add public/assets/sprites/material/jewel-of-chaos.png public/assets/sprites/material/feather.png src/data/assetVersion.ts
git commit -m "feat(art): Jewel of Chaos + Feather material icons; bump ASSET_VERSION

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Craft Wings dialog (UI)

**Files:**
- Create: `src/scenes/wingCraftDialog.ts`

This module owns the overlay. It is data-driven via an opts object so the scene wires
counts/inventory and the actual craft. Mirrors the visual language of
`autoRecycleDialog.ts` (dim + panel + chips + preview + action button).

- [ ] **Step 1: Implement the dialog**

```ts
// src/scenes/wingCraftDialog.ts
/**
 * Craft Wings overlay — pick ≥5 component items, choose 1–4 Jewels of Chaos, see
 * the live success % + outcome odds, and forge. The caller owns inventory access,
 * the live preview math, and the actual craft (confirm); this module owns only the
 * selection UI + preview rendering. Visual language mirrors autoRecycleDialog.
 */
import type Phaser from "phaser";
import { crispText } from "./ui.ts";
import { itemTex } from "../data/assetKeys.ts";
import { RARITY_INT } from "../data/rarityColors.ts";
import type { Rarity } from "../data/schema.ts";

export interface WingCraftItem {
  id: string;
  defId: string;
  name: string;
  rarity: Rarity;
}

export interface WingCraftPreview {
  success: number; // 0..1
  odds: { rarity: Rarity; chance: number }[];
}

export interface WingCraftOpts {
  items: WingCraftItem[];
  jewelsOwned: number;
  feathersOwned: number;
  /** success % + outcome odds for the current selection. */
  preview(selectedIds: string[], jewels: number): WingCraftPreview;
  /** perform the craft; the dialog stays open and re-reads via onChange. */
  confirm(selectedIds: string[], jewels: number): void;
  onClose(): void;
}

const PANEL = 0x9a59d6; // chaos violet accent

export function openWingCraftDialog(
  scene: Phaser.Scene,
  opts: WingCraftOpts,
): Phaser.GameObjects.Container {
  const W = scene.scale.width,
    H = scene.scale.height;
  const selected = new Set<string>();
  let jewels = Math.min(4, Math.max(1, opts.jewelsOwned));

  const c = scene.add.container(0, 0).setDepth(320);
  const dim = scene.add.graphics();
  dim.fillStyle(0x000000, 0.78).fillRect(0, 0, W, H);
  const dimZone = scene.add
    .zone(W / 2, H / 2, W, H)
    .setInteractive()
    .on("pointerup", () => opts.onClose());
  c.add([dim, dimZone]);

  const bw = 560,
    bh = 420,
    bx = (W - bw) / 2,
    by = (H - bh) / 2;
  const panel = scene.add.graphics();
  panel.fillStyle(0x141022, 0.99).fillRoundedRect(bx, by, bw, bh, 12);
  panel.lineStyle(2, PANEL, 1).strokeRoundedRect(bx, by, bw, bh, 12);
  const panelZone = scene.add.zone(bx + bw / 2, by + bh / 2, bw, bh).setInteractive();
  c.add([panel, panelZone]);

  c.add(
    crispText(scene, W / 2, by + 14, "Craft Wings", {
      fontSize: "18px",
      color: "#e9d5ff",
      fontStyle: "bold",
    }).setOrigin(0.5, 0),
  );
  c.add(
    crispText(
      scene,
      W / 2,
      by + 38,
      `Jewel of Chaos: ${opts.jewelsOwned}   ·   Feather: ${opts.feathersOwned}`,
      { fontSize: "12px", color: "#c9b8e6" },
    ).setOrigin(0.5, 0),
  );

  // Item grid (tap to toggle). 8 cols, 44px cells, scroll-free first ~24 items.
  const gridX = bx + 20,
    gridY = by + 64,
    cell = 46,
    cols = 11;
  const tiles: { it: WingCraftItem; ring: Phaser.GameObjects.Graphics }[] = [];
  opts.items.slice(0, 44).forEach((it, n) => {
    const cxp = gridX + (n % cols) * cell,
      cyp = gridY + Math.floor(n / cols) * cell;
    const tex = scene.textures.exists(itemTex(it.defId)) ? itemTex(it.defId) : undefined;
    if (tex) {
      const img = scene.add.image(cxp + 20, cyp + 20, tex).setDisplaySize(40, 40);
      c.add(img);
    }
    const ring = scene.add.graphics();
    c.add(ring);
    const z = scene.add
      .zone(cxp, cyp, cell - 2, cell - 2)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true });
    z.on("pointerup", () => {
      if (selected.has(it.id)) selected.delete(it.id);
      else selected.add(it.id);
      render();
    });
    tiles.push({ it, ring });
  });

  const jewelText = crispText(scene, bx + 20, by + bh - 96, "", {
    fontSize: "13px",
    color: "#e9d5ff",
  });
  c.add(jewelText);
  const minus = chip(scene, c, bx + 200, by + bh - 92, "−", () => {
    jewels = Math.max(1, jewels - 1);
    render();
  });
  const plus = chip(scene, c, bx + 240, by + bh - 92, "+", () => {
    jewels = Math.min(Math.min(4, Math.max(1, opts.jewelsOwned)), jewels + 1);
    render();
  });
  void minus;
  void plus;

  const previewText = crispText(scene, bx + 20, by + bh - 64, "", {
    fontSize: "13px",
    color: "#ffe6a0",
  });
  c.add(previewText);

  const craftBtn = crispText(scene, W / 2, by + bh - 36, "🔨 Forge Wings", {
    fontSize: "15px",
    color: "#fff",
    backgroundColor: "#6a2fa0",
    fixedWidth: bw - 220,
    align: "center",
  })
    .setOrigin(0.5, 0)
    .setPadding(0, 9, 0, 9)
    .setInteractive({ useHandCursor: true });
  craftBtn.on("pointerup", () => {
    if (!isValid()) return;
    opts.confirm([...selected], jewels);
  });
  c.add(craftBtn);

  const cancel = crispText(scene, bx + bw - 70, by + bh - 32, "Close", {
    fontSize: "13px",
    color: "#cdb8e6",
  })
    .setOrigin(0.5, 0)
    .setPadding(0, 4, 0, 4)
    .setInteractive({ useHandCursor: true });
  cancel.on("pointerup", () => opts.onClose());
  c.add(cancel);

  function isValid(): boolean {
    return selected.size >= 5 && opts.feathersOwned >= 1 && opts.jewelsOwned >= jewels;
  }

  function render(): void {
    for (const t of tiles) {
      const on = selected.has(t.it.id);
      const col = RARITY_INT[t.it.rarity];
      t.ring.clear();
      const idx = tiles.indexOf(t);
      const cxp = gridX + (idx % cols) * cell,
        cyp = gridY + Math.floor(idx / cols) * cell;
      t.ring.lineStyle(on ? 3 : 1, on ? 0xffffff : col, on ? 1 : 0.6);
      t.ring.strokeRoundedRect(cxp, cyp, cell - 2, cell - 2, 6);
    }
    jewelText.setText(`Jewels of Chaos: ${jewels}  (each extra +10% success)`);
    const p = opts.preview([...selected], jewels);
    const oddsLine = p.odds.map((o) => `${Math.round(o.chance * 100)}% ${o.rarity}`).join(" · ");
    previewText.setText(
      selected.size < 5
        ? `Select ${5 - selected.size} more item(s)  ·  min 5`
        : `Success ${Math.round(p.success * 100)}%   →   ${oddsLine}`,
    );
    const enabled = isValid();
    craftBtn
      .setColor(enabled ? "#fff" : "#8a7a9a")
      .setBackgroundColor(enabled ? "#6a2fa0" : "#2a2140");
  }

  render();
  return c;
}

function chip(
  scene: Phaser.Scene,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  label: string,
  cb: () => void,
): Phaser.GameObjects.Text {
  const t = crispText(scene, x, y, label, {
    fontSize: "16px",
    color: "#fff",
    backgroundColor: "#3a2a55",
    fixedWidth: 30,
    align: "center",
  })
    .setOrigin(0, 0)
    .setPadding(0, 4, 0, 4)
    .setInteractive({ useHandCursor: true });
  t.on("pointerup", cb);
  c.add(t);
  return t;
}
```

> NOTE: confirm `RARITY_INT` is exported from `src/data/rarityColors.ts` (it is used by `autoRecycleDialog.ts`) and `itemTex` from `src/data/assetKeys.ts`. Keep this file under 500 lines (it is ~250).

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/scenes/wingCraftDialog.ts
git commit -m "feat(wings): Craft Wings overlay UI (item picker + jewel stepper + preview)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: Wire Craft Wings into ForgeScene

**Files:**
- Modify: `src/scenes/ForgeScene.ts`

- [ ] **Step 1: Add imports**

At the top of `src/scenes/ForgeScene.ts`:

```ts
import { openWingCraftDialog, type WingCraftItem } from "./wingCraftDialog.ts";
import { JEWEL_OF_CHAOS, FEATHER } from "../data/materials.ts";
import { ITEM_CATALOG_MAP } from "../data/items.ts";
import { wingSuccessChance, wingOutcomeOdds, MIN_ITEMS } from "../core/wingCraft.ts";
import type { Rarity } from "../data/schema.ts";
```

- [ ] **Step 2: Add a draw section + opener**

In `redraw()` (~line 68-77), insert a wings section after `drawSpark`:

```ts
    y = this.drawSpark(y);
    y = this.drawWings(y);
```

Add the method (place near `drawAlchemy`):

```ts
  private drawWings(y: number): number {
    const jewels = this.mgr.getMaterial(JEWEL_OF_CHAOS);
    const feathers = this.mgr.getMaterial(FEATHER);
    this.layer.add(
      crispText(this, PX + 4, y, "Craft Wings", {
        fontSize: "15px",
        color: "#e9b8ff",
        fontStyle: "bold",
      }),
    );
    y += 24;
    const h = 52;
    this.panel(y, h, 0x3a2a55, jewels >= 1 && feathers >= 1);
    this.layer.add(
      crispText(
        this,
        PX + 14,
        y + 8,
        "Burn 5+ items + Jewel of Chaos + Feather for a chance at random Wings.",
        { fontSize: "12px", color: "#cdb8e6" },
      ),
    );
    this.layer.add(
      crispText(
        this,
        PX + 14,
        y + 28,
        `Jewel of Chaos: ${jewels}   ·   Feather: ${feathers}`,
        { fontSize: "12px", color: "#9fb0c4" },
      ),
    );
    this.button(PX + PW - 14, y + h / 2, "Craft Wings…", "#7a3aa8", jewels >= 1 && feathers >= 1, () =>
      this.openWingCraft(),
    );
    return y + h + 12;
  }

  private openWingCraft(): void {
    const save = this.mgr.getSave();
    const equipped = new Set(Object.values(save.inventory.equipped).filter(Boolean) as string[]);
    const items: WingCraftItem[] = save.inventory.items
      .filter((it) => !equipped.has(it.id))
      .map((it) => {
        const def = ITEM_CATALOG_MAP.get(it.defId);
        return {
          id: it.id,
          defId: it.defId,
          name: def?.name ?? it.defId,
          rarity: (def?.rarity ?? "Common") as Rarity,
        };
      });
    const raritiesOf = (ids: string[]): Rarity[] =>
      ids
        .map((id) => items.find((i) => i.id === id)?.rarity)
        .filter((r): r is Rarity => !!r);
    const dialog = openWingCraftDialog(this, {
      items,
      jewelsOwned: this.mgr.getMaterial(JEWEL_OF_CHAOS),
      feathersOwned: this.mgr.getMaterial(FEATHER),
      preview: (selectedIds, j) => {
        const rs = raritiesOf(selectedIds);
        return {
          success: rs.length >= MIN_ITEMS ? wingSuccessChance(rs, j) : 0,
          odds: wingOutcomeOdds(rs.length ? rs : (["Common"] as Rarity[])),
        };
      },
      confirm: (selectedIds, j) => {
        const r = this.mgr.craftWings(selectedIds, j);
        if (!r.ok) {
          this.showToast("Craft failed — check materials.");
          return;
        }
        if (r.success && r.item) {
          this.showToast(`✦ Forged ${ITEM_CATALOG_MAP.get(r.item.defId)?.name ?? "Wings"}!`);
        } else {
          this.showToast("The wings dissolved into chaos…");
        }
        dialog.destroy();
        this.redraw();
      },
      onClose: () => dialog.destroy(),
    });
  }
```

> NOTE: `this.button(...)` and `this.panel(...)` and `this.showToast(...)` already exist in ForgeScene. Keep ForgeScene under 500 lines — it is ~296 now; this adds ~80, well within budget.

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit && npx eslint src/scenes/ForgeScene.ts src/scenes/wingCraftDialog.ts src/core/wingCraft.ts`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/scenes/ForgeScene.ts
git commit -m "feat(wings): wire Craft Wings station into the Forge

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 9: Verify whole + playtest + memory

**Files:**
- Modify: memory under `~/.claude/projects/.../memory/` (index + a new project note)

- [ ] **Step 1: Full verification**

Run: `npx tsc --noEmit`
Expected: clean.

Run: `npx vitest run`
Expected: all suites pass (note: `firebaseCachePolicy.test.ts` has a KNOWN pre-existing unrelated failure — confirm it is the ONLY failure and matches clean HEAD, otherwise investigate).

Run: `npx eslint src/core/wingCraft.ts src/scenes/wingCraftDialog.ts src/scenes/ForgeScene.ts src/data/materials.ts src/core/boxes.ts src/core/saveManagerCore.ts`
Expected: clean (every touched file < 500 code lines).

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 2: CDP self-playtest**

Launch the app (see memory `reference_playtest_and_art`), drive via `window.__game`:
- Grant materials in a throwaway save (`mgr.addMaterial('jewel-of-chaos', 4); mgr.addMaterial('feather', 2)`) and ensure ≥5 inventory items.
- Open Forge → Craft Wings, select 5 items, set jewels, confirm.
- Verify: success% + odds render, the two new icons display (not the missing-texture fallback), a wing is added on success, inputs are consumed.
- Screenshot the dialog; send it to the chat.

- [ ] **Step 3: Update memory**

Add a project note `project_craft_wings.md` (id, formula, skywings reuse, materials + box faucet, files) and a one-line pointer in `MEMORY.md`. Cross-link `[[project_smelt_reforge_chaos]]` (the Entropy rename that freed the name) and `[[project_item_icon_96_contract]]`.

- [ ] **Step 4: Final report**

Summarize: feature, formula, sources, art, tests, verification evidence, commits. Confirm the working tree is clean except the pre-existing protected out-of-scope files.

---

## Self-Review

**Spec coverage:**
- Two new materials + art → Tasks 1, 6 ✓
- Forge craft station → Tasks 7, 8 ✓
- Formula (5 items min, base 20% + item-rarity, jewel +10% max 4, cap 80%) → Task 2 ✓
- Outcome rarity distribution (60/35/5 biased down, Magic example) → Task 2 ✓
- Random outcome + consume-on-fail → Task 3 ✓
- Material sources → Task 5 ✓

**Placeholder scan:** all code steps contain full code; no TBD/TODO. The two test helpers carry explicit NOTEs to confirm `newHeroSave`/`RARITIES`/`RARITY_INT` exports (verify-before-use, not placeholders).

**Type consistency:** `craftWings(save, {itemIds, jewels}, rng)` signature is identical in core (Task 3), SaveManager wrapper passes `{itemIds, jewels}` (Task 4); `wingSuccessChance(rarities, jewels)` / `wingOutcomeOdds(rarities)` used identically in tests, dialog preview, and ForgeScene; `skywingsDefId(rarity)` returns the ids asserted present in Task 2 and minted in Task 3; result fields (`ok/reason/success/rarity/item`) consistent across core, wrapper, and UI.

**Pre-verified exports (all confirmed against the tree):**
- `src/core/save.ts:158` — `createFreshSave()` factory; `ItemInstanceSave` exported.
- `src/data/schema.ts` re-exports `RARITIES = ["Common","Magic","Rare","Legendary","Unique"]` (via `schemaEnums.ts`).
- `src/data/rarityColors.ts:17` — `RARITY_INT`.
- `src/data/assetKeys.ts:12` — `itemTex`.
- `src/core/itemDrop.ts:23` — `toItemInstanceSave`.
