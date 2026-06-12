# Unified Asset-Key Registry & Entity-Icon Resolver — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every screen render the same entity (item/tower/material/jewel/currency/box) from one place by introducing a single texture-key derivation module + generalized entity→`IconView` resolvers, then routing all call sites through them, guarded by contract tests.

**Architecture:** `src/data/assetKeys.ts` becomes the SOLE place any `<namespace>__<id>` key is built. `rewardIcon.ts` (already the reward resolver) derives keys via `assetKeys` and gains entity-level resolvers (`itemInstanceIcon`, `towerIcon`, `skillIcon`; `materialIcon` stays the sole owner of the box-vs-material branch). Scenes and `boxRewardView`/`HeroScene` stop hand-building keys. Two contract tests prevent drift: a catalog→key loadability test and a "no inline `__${` template in source except assetKeys.ts" guard.

**Tech Stack:** TypeScript (strict, ESM, `.ts` import specifiers), Phaser 3, Vitest. Pure data modules are Phaser-free and unit-tested.

**Spec:** `docs/superpowers/specs/2026-06-12-unified-asset-registry-design.md`

---

## File Structure

**Create:**

- `src/data/assetKeys.ts` — the single key-derivation point (pure, ~40 lines).
- `tests/assetKeys.test.ts` — derivation-shape + catalog→key contract test.
- `tests/assetKeyDiscipline.test.ts` — no-inline-keys source guard.

**Modify (key derivation → delegate/route through `assetKeys`):**

- `src/data/rewardIcon.ts` — derive via assetKeys; add `itemInstanceIcon`/`towerIcon`/`skillIcon`.
- `src/data/materialIconManifest.ts`, `jewelIconManifest.ts`, `skillIconManifest.ts` — `*IconKey` delegates to assetKeys.
- `src/data/boxRewardView.ts`, `src/data/rewardTiles.ts` — keys via assetKeys.
- `src/scenes/PreloadScene.ts` — load via assetKeys derivations.
- Scene call sites enumerated in Task 5.

> **Size rule:** the project hard-caps source files at 500 lines. After each task that grows a file, confirm `wc -l` stays < 500. If `rewardIcon.ts` would exceed it, move the three new entity resolvers into a new `src/data/entityIcon.ts` (same `RewardIconView` contract, imports `assetKeys` + the color helpers) — noted inline in Task 4.

---

## Task 1: `assetKeys.ts` — the single key-derivation module

**Files:**

- Create: `src/data/assetKeys.ts`
- Test: `tests/assetKeys.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/assetKeys.test.ts
import { describe, it, expect } from "vitest";
import {
  itemTex,
  towerTex,
  jewelTex,
  materialTex,
  boxTex,
  skillTex,
  menuTex,
  fxTex,
  GOLD_TEX,
  GEM_TEX,
  XP_TEX,
  HERODOLL_BASE_TEX,
} from "../src/data/assetKeys.ts";

describe("assetKeys derivation", () => {
  it("derives namespaced entity keys", () => {
    expect(itemTex("iron-sword")).toBe("item__iron-sword");
    expect(towerTex("karu-sunfist")).toBe("tower__karu-sunfist");
    expect(jewelTex("ruby")).toBe("jewel__ruby");
    expect(materialTex("soul-jewel")).toBe("material__soul-jewel");
    expect(boxTex("boss-box-t3")).toBe("box__boss-box-t3");
    expect(skillTex("fireball")).toBe("skill__fireball");
    expect(menuTex("shop")).toBe("menu__shop");
    expect(fxTex("burst")).toBe("fx__burst");
  });
  it("exposes fixed currency / singleton keys as named constants", () => {
    expect(GOLD_TEX).toBe("icon__gold");
    expect(GEM_TEX).toBe("icon__gem");
    expect(XP_TEX).toBe("icon__xp");
    expect(HERODOLL_BASE_TEX).toBe("herodoll__base");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/assetKeys.test.ts`
Expected: FAIL — "Failed to load url ../src/data/assetKeys.ts".

- [ ] **Step 3: Write minimal implementation**

```ts
// src/data/assetKeys.ts
//
// THE single point where any "<namespace>__<id>" texture key is derived. Every
// scene, manifest, and resolver imports from here instead of hand-building the
// string, so a naming-convention change is a one-line edit and a typo is caught
// by tests/assetKeyDiscipline.test.ts (which forbids inline "__${" templates
// anywhere else). Pure / Phaser-free — resolves INTO Phaser's Texture Manager,
// which shows the __MISSING sentinel on a bad key.

/** Inventory/worn icon for a gear item (96×96 spritesheet). */
export const itemTex = (id: string): string => `item__${id}`;
/** Character/tower sprite sheet. */
export const towerTex = (id: string): string => `tower__${id}`;
/** Skill-jewel gem icon (96×96). */
export const jewelTex = (id: string): string => `jewel__${id}`;
/** Crafting-material icon (non-box: enhance jewels, scroll …). */
export const materialTex = (id: string): string => `material__${id}`;
/** Boss loot-box chest art. */
export const boxTex = (id: string): string => `box__${id}`;
/** Active/passive skill ability icon (96×96). */
export const skillTex = (id: string): string => `skill__${id}`;
/** Main-menu button icon. */
export const menuTex = (id: string): string => `menu__${id}`;
/** Additive-blend VFX texture. */
export const fxTex = (id: string): string => `fx__${id}`;

/** Fixed singleton currency / UI keys (named so they are never magic strings). */
export const GOLD_TEX = "icon__gold";
export const GEM_TEX = "icon__gem";
export const XP_TEX = "icon__xp";
export const HERODOLL_BASE_TEX = "herodoll__base";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/assetKeys.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Confirm file size, then commit**

Run: `wc -l src/data/assetKeys.ts` → expect < 50.

```bash
git add src/data/assetKeys.ts tests/assetKeys.test.ts
git commit -m "feat(assets): single texture-key derivation module (assetKeys.ts)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Manifest key helpers delegate to `assetKeys`

**Files:**

- Modify: `src/data/materialIconManifest.ts`, `src/data/jewelIconManifest.ts`, `src/data/skillIconManifest.ts`

Each currently builds its own template; route through `assetKeys` so the convention lives in one place (the `*_ICON_IDS` lists are unchanged).

- [ ] **Step 1: Update `materialIconManifest.ts`**

Replace the body of `materialIconKey`:

```ts
import { MATERIALS } from "./materials.ts";
import { materialTex } from "./assetKeys.ts";

export const MATERIAL_ICON_IDS: string[] = MATERIALS.filter((m) => m.kind !== "box").map(
  (m) => m.id,
);

/** Texture key for a material's painted icon. */
export function materialIconKey(id: string): string {
  return materialTex(id);
}
```

- [ ] **Step 2: Update `jewelIconManifest.ts`**

```ts
import { JEWEL_CATALOG } from "./jewels.ts";
import { jewelTex } from "./assetKeys.ts";

export const JEWEL_ICON_IDS: string[] = JEWEL_CATALOG.map((jw) => jw.id);

/** Texture key for a jewel's painted icon. */
export function jewelIconKey(id: string): string {
  return jewelTex(id);
}
```

- [ ] **Step 3: Update `skillIconManifest.ts`**

Keep the existing imports/`SKILL_ICON_IDS`; change only the helper:

```ts
import { skillTex } from "./assetKeys.ts";
// ...existing SKILL_ICON_IDS unchanged...

/** Texture key for a skill's painted icon. */
export function skillIconKey(id: string): string {
  return skillTex(id);
}
```

- [ ] **Step 4: Verify existing tests still pass**

Run: `npx vitest run tests/materialIcons.test.ts tests/skill-icons.test.ts`
Expected: PASS (unchanged behavior — same strings out).

- [ ] **Step 5: Commit**

```bash
git add src/data/materialIconManifest.ts src/data/jewelIconManifest.ts src/data/skillIconManifest.ts
git commit -m "refactor(assets): manifest key helpers delegate to assetKeys

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: `rewardIcon.ts` derives keys via `assetKeys` (no output change)

**Files:**

- Modify: `src/data/rewardIcon.ts`
- Test: `tests/rewardIcon.test.ts` (existing — must stay green)

- [ ] **Step 1: Add the import**

At the top of `rewardIcon.ts`, after the existing imports:

```ts
import { itemTex, jewelTex, materialTex, boxTex, GOLD_TEX, GEM_TEX, XP_TEX } from "./assetKeys.ts";
```

- [ ] **Step 2: Replace the inline key strings**

```ts
export function goldIcon(): RewardIconView {
  return { iconKey: GOLD_TEX, emoji: "🪙", color: GOLD_INT };
}
export function diamondIcon(): RewardIconView {
  return { iconKey: GEM_TEX, emoji: "💎", color: DIAMOND_INT };
}
export function xpIcon(): RewardIconView {
  return { iconKey: XP_TEX, emoji: "⭐", color: XP_INT };
}

export function itemIcon(rarity: Rarity, defId: string): RewardIconView {
  return { iconKey: itemTex(defId), emoji: "📦", color: RARITY_INT[rarity] };
}
export function jewelIcon(rarity: Rarity, defId: string): RewardIconView {
  return { iconKey: jewelTex(defId), emoji: "💠", color: RARITY_INT[rarity] };
}
```

And inside `materialIcon`, replace the two template literals:

```ts
if (def?.kind === "box") {
  const rarity = RARITY_ORDER[(def.rarity ?? 1) - 1] ?? "Common";
  return { iconKey: boxTex(id), emoji: "🎁", color: RARITY_INT[rarity] };
}
return { iconKey: materialTex(id), emoji: "💠", color: MAT_INT };
```

- [ ] **Step 3: Run the existing resolver + panel tests**

Run: `npx vitest run tests/rewardIcon.test.ts tests/rewardPanel.test.ts`
Expected: PASS — strings are byte-identical, so all assertions hold.

- [ ] **Step 4: Commit**

```bash
git add src/data/rewardIcon.ts
git commit -m "refactor(assets): rewardIcon derives keys via assetKeys (no output change)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Entity-level resolvers (`itemInstanceIcon` / `towerIcon` / `skillIcon`)

**Files:**

- Modify: `src/data/rewardIcon.ts` (or create `src/data/entityIcon.ts` if size > 480 — see note)
- Test: `tests/entityIcon.test.ts`

These give every consumer one resolver per entity class returning the shared `RewardIconView`, so scenes never assemble `{iconKey,emoji,color}` themselves.

- [ ] **Step 1: Write the failing test**

```ts
// tests/entityIcon.test.ts
import { describe, it, expect } from "vitest";
import { itemInstanceIcon, towerIcon, skillIcon } from "../src/data/rewardIcon.ts";
import { ITEM_CATALOG } from "../src/data/items.ts";
import { TOWERS } from "../src/data/towers.ts";
import { RARITY_INT } from "../src/data/rewardIcon.ts";

describe("entity icon resolvers", () => {
  it("resolves an owned item instance to item__<defId> + rarity color", () => {
    const def = ITEM_CATALOG[0];
    const inst = {
      id: "inst-1",
      defId: def.id,
      acquiredLevel: 1,
      rolledStats: {},
      rolledPrimaryAffix: 0,
      rolledAffixes: [],
      enhanceLevel: 0,
    };
    const v = itemInstanceIcon(inst);
    expect(v.iconKey).toBe(`item__${def.id}`);
    expect(v.color).toBe(RARITY_INT[def.rarity]);
    expect(v.emoji).toBe("📦");
  });
  it("resolves a tower id to tower__<id> + rarity color", () => {
    const t = TOWERS[0];
    const v = towerIcon(t.id);
    expect(v.iconKey).toBe(`tower__${t.id}`);
    expect(v.color).toBe(RARITY_INT[t.rarity]);
  });
  it("resolves a skill id to skill__<id>", () => {
    const v = skillIcon("fireball");
    expect(v.iconKey).toBe("skill__fireball");
    expect(v.emoji).toBe("⚡");
  });
  it("defaults to Common color when the def is unknown", () => {
    expect(towerIcon("does-not-exist").color).toBe(RARITY_INT.Common);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/entityIcon.test.ts`
Expected: FAIL — `itemInstanceIcon` / `towerIcon` / `skillIcon` are not exported.

- [ ] **Step 3: Add the resolvers to `rewardIcon.ts`**

Add imports at the top:

```ts
import type { ItemInstanceSave } from "../core/save.ts";
import { ITEM_CATALOG_MAP } from "./items.ts";
import { TOWERS } from "./towers.ts";
import { skillTex, towerTex } from "./assetKeys.ts";
```

Add at the end of the file:

```ts
/** Owned-item instance → its icon (rarity color from the catalog def: flyweight). */
export function itemInstanceIcon(inst: ItemInstanceSave): RewardIconView {
  const def = ITEM_CATALOG_MAP.get(inst.defId);
  return itemIcon(def?.rarity ?? "Common", inst.defId);
}

/** Tower/character id → its roster icon (tower__<id>, rarity-tinted). */
export function towerIcon(id: string): RewardIconView {
  const def = TOWERS.find((t) => t.id === id);
  return { iconKey: towerTex(id), emoji: "✨", color: RARITY_INT[def?.rarity ?? "Common"] };
}

/** Skill id → its ability icon (skill__<id>). */
export function skillIcon(id: string): RewardIconView {
  return { iconKey: skillTex(id), emoji: "⚡", color: RARITY_INT.Common };
}
```

> **Size note:** if `wc -l src/data/rewardIcon.ts` would exceed ~480 after this, instead create `src/data/entityIcon.ts` containing these three functions (importing `RewardIconView`, `RARITY_INT`, `itemIcon` from `./rewardIcon.ts` and the keys from `./assetKeys.ts`), and update the test import path to `../src/data/entityIcon.ts`. Pick whichever keeps both files < 500.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/entityIcon.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Confirm size + commit**

Run: `wc -l src/data/rewardIcon.ts` → confirm < 500.

```bash
git add src/data/rewardIcon.ts tests/entityIcon.test.ts
git commit -m "feat(assets): entity-level icon resolvers (item instance / tower / skill)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Route call sites through `assetKeys` + kill the duplicated branches

**Files:**

- Modify: `src/scenes/PreloadScene.ts`, `src/data/boxRewardView.ts`, `src/data/rewardTiles.ts`,
  `src/scenes/HeroScene.ts`, and the scene call sites below.

Each edit swaps an inline template for the matching `assetKeys` call — **same string out, zero behavior change** — and replaces the two re-implemented material/box branches with the shared derivation.

- [ ] **Step 1: `PreloadScene.ts` — load via derivations**

Add import:

```ts
import { skillTex, jewelTex, materialTex, itemTex, menuTex, fxTex } from "../data/assetKeys.ts";
```

Replace the inline keys in `preload()`:

- line ~37 `const key = `skill\_\_${id}`;` → `const key = skillTex(id);`
- line ~43 `const key = `jewel\_\_${id}`;` → `const key = jewelTex(id);`
- line ~57 `this.load.image(`menu\_\_${id}`, …)` → `this.load.image(menuTex(id), …)`
- line ~62 `this.load.image(`fx\_\_${id}`, …)` → `this.load.image(fxTex(id), …)`
- line ~64 `this.load.image(`material\_\_${id}`, …)` → `this.load.image(materialTex(id), …)`
- line ~69 `const key = `item\_\_${it.id}`;` → `const key = itemTex(it.id);`

- [ ] **Step 2: `boxRewardView.ts` — keys via assetKeys**

Add `import { itemTex, materialTex, GOLD_TEX, GEM_TEX } from "./assetKeys.ts";` and replace the four literals:

- `iconKey: "icon__gold"` → `iconKey: GOLD_TEX`
- `iconKey: "icon__gem"` → `iconKey: GEM_TEX`
- `iconKey: `material\_\_${mid}``→`iconKey: materialTex(mid)`
- `iconKey: `item\_\_${item.defId}``→`iconKey: itemTex(item.defId)`

- [ ] **Step 3: `rewardTiles.ts` — tower key via assetKeys**

Add `import { towerTex } from "./assetKeys.ts";` and in `characterTile` replace
`iconKey: `tower\_\_${id}``→`iconKey: towerTex(id)`.

- [ ] **Step 4: `HeroScene.ts` — kill the duplicated material/box branch**

Add `import { materialTex, boxTex, itemTex } from "../data/assetKeys.ts";`.
In `makeMaterialTile` (line ~354) replace:

```ts
const spriteKey = this.textures.exists(`material__${id}`) ? `material__${id}` : `box__${id}`;
```

with:

```ts
const spriteKey = this.textures.exists(materialTex(id)) ? materialTex(id) : boxTex(id);
```

Also swap the equipped-item icon (line ~308) `` `item__${inst.defId}` `` → `itemTex(inst.defId)`.

- [ ] **Step 5: Swap the remaining scene call sites**

For each file, add the needed import from `../data/assetKeys.ts` and replace the inline template with the function call (same id argument). Sites (from the audit):

| File                       | Replace                                               | With                      |
| -------------------------- | ----------------------------------------------------- | ------------------------- |
| `battleSceneInput.ts`      | `` `tower__${towerId}` ``                             | `towerTex(towerId)`       |
| `battleSceneInput.ts`      | `` `item__${inst.defId}` ``                           | `itemTex(inst.defId)`     |
| `battleSceneInput.ts` (×4) | `` `skill__${id}` ``                                  | `skillTex(id)`            |
| `battleSceneSprites.ts`    | `` `tower__${t.def.id}` ``                            | `towerTex(t.def.id)`      |
| `BattleScene.ts`           | `` `tower__${def.id}` ``                              | `towerTex(def.id)`        |
| `boxOpenOverlay.ts`        | `` `box__${boxId}` ``                                 | `boxTex(boxId)`           |
| `CollectionScene.ts` (×2)  | `` `tower__${tower.id}` ``                            | `towerTex(tower.id)`      |
| `CollectionScene.ts` (×2)  | `` `skill__${id}` ``                                  | `skillTex(id)`            |
| `dressHero.ts`             | `` `item__${def.id}` ``                               | `itemTex(def.id)`         |
| `ExpeditionScene.ts`       | `` `tower__${t.id}` ``                                | `towerTex(t.id)`          |
| `fx.ts`                    | `` `item__${e.itemDefId}` ``                          | `itemTex(e.itemDefId)`    |
| `fx.ts`                    | `` `box__${e.box}` ``                                 | `boxTex(e.box)`           |
| `heroEquipVisuals.ts` (×3) | `` `item__${…id}` ``                                  | `itemTex(…id)`            |
| `homeRoom.ts`              | `` `item__${def.id}` ``                               | `itemTex(def.id)`         |
| `itemCompareDialog.ts`     | `` `item__${ref.def.id}` ``                           | `itemTex(ref.def.id)`     |
| `MainMenuScene.ts`         | `` `tower__${id}` ``                                  | `towerTex(id)`            |
| `MainMenuScene.ts`         | `` `item__${def.id}` ``                               | `itemTex(def.id)`         |
| `ShopScene.ts` (×4)        | `` `item__${…defId}` ``                               | `itemTex(…defId)`         |
| `SkillsScene.ts`           | `` `skill__${def.id}` ``                              | `skillTex(def.id)`        |
| `squadInfoPanel.ts`        | `` `tower__${def.id}` ``                              | `towerTex(def.id)`        |
| `SquadScene.ts` (×2)       | `` `tower__${…id}` ``                                 | `towerTex(…id)`           |
| `summonResultOverlay.ts`   | `` `tower__${r.characterId}` ``                       | `towerTex(r.characterId)` |
| `HeroScene.ts`             | `` `material__${id}` `` (line ~354 handled in Step 4) | —                         |

> `skillVfx.ts` builds `` `vfx__${skillId}` `` (its own VFX namespace, kept) **and** a `` `skill__${skillId}` `` fallback — replace only the `skill__` one with `skillTex(skillId)`; leave `vfx__` as-is (it is not in the registry's namespace set and Task 6's guard excludes it).

- [ ] **Step 6: Typecheck + full suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc clean; all tests pass (no behavior changed).

- [ ] **Step 7: Confirm sizes + commit**

Run: `wc -l src/scenes/HeroScene.ts src/scenes/PreloadScene.ts` → all < 500.

```bash
git add -A
git commit -m "refactor(assets): route every texture-key call site through assetKeys

Replaces ~30 inline \`<ns>__\${id}\` templates across scenes + data with the
single derivation module, and collapses the 3 reimplemented material/box
branches (rewardIcon, boxRewardView, HeroScene) into the shared helpers.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Anti-drift contract tests

**Files:**

- Create: `tests/assetKeyDiscipline.test.ts`
- Extend: `tests/assetKeys.test.ts` (catalog→key loadability contract)

- [ ] **Step 1: Write the no-inline-keys guard (RED proves it catches current scatter — run BEFORE Task 5 if executing out of order; here it should pass)**

```ts
// tests/assetKeyDiscipline.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// The ONLY file allowed to build "<namespace>__${...}" texture keys.
const ALLOWED = new Set(["src/data/assetKeys.ts"]);
// Namespaces owned by the registry. (vfx__ is skillVfx's own VFX namespace, not registry-owned.)
const RE = /`(item|tower|jewel|material|box|skill|menu|fx)__\$\{/;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith(".ts")) out.push(p);
  }
  return out;
}

describe("asset-key discipline", () => {
  it("no source file except assetKeys.ts builds a registry texture key inline", () => {
    const offenders: string[] = [];
    for (const dir of ["src/data", "src/scenes"]) {
      for (const file of walk(dir)) {
        const rel = file.replace(/\\/g, "/");
        if (ALLOWED.has(rel)) continue;
        const src = readFileSync(file, "utf8");
        if (RE.test(src)) offenders.push(rel);
      }
    }
    expect(offenders).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it**

Run: `npx vitest run tests/assetKeyDiscipline.test.ts`
Expected: PASS (Task 5 already migrated every site). If it lists offenders, migrate those files (same swap) until green.

- [ ] **Step 3: Add the catalog→key loadability contract to `assetKeys.test.ts`**

Append:

```ts
import { ITEM_CATALOG } from "../src/data/items.ts";
import { TOWERS } from "../src/data/towers.ts";
import { JEWEL_CATALOG } from "../src/data/jewels.ts";
import { MATERIALS } from "../src/data/materials.ts";
import { MATERIAL_ICON_IDS } from "../src/data/materialIconManifest.ts";
import { JEWEL_ICON_IDS } from "../src/data/jewelIconManifest.ts";

describe("catalog → key contract", () => {
  it("every item id derives a well-formed item__ key", () => {
    for (const d of ITEM_CATALOG) expect(itemTex(d.id)).toBe(`item__${d.id}`);
  });
  it("every tower id derives a well-formed tower__ key", () => {
    for (const t of TOWERS) expect(towerTex(t.id)).toMatch(/^tower__/);
  });
  it("non-box materials are the exact set loaded as material__ icons", () => {
    const nonBox = MATERIALS.filter((m) => m.kind !== "box")
      .map((m) => m.id)
      .sort();
    expect([...MATERIAL_ICON_IDS].sort()).toEqual(nonBox);
  });
  it("every jewel id is in the loaded jewel icon set", () => {
    const ids = new Set(JEWEL_ICON_IDS);
    for (const j of JEWEL_CATALOG) expect(ids.has(j.id)).toBe(true);
  });
});
```

- [ ] **Step 4: Run the contract test**

Run: `npx vitest run tests/assetKeys.test.ts`
Expected: PASS (derivation + contract).

- [ ] **Step 5: Commit**

```bash
git add tests/assetKeyDiscipline.test.ts tests/assetKeys.test.ts
git commit -m "test(assets): anti-drift contract — no inline keys + catalog→key loadability

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Whole-system verify + playtest + memory

**Files:** none (verification) + `memory/` update.

- [ ] **Step 1: Full verify**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: tsc clean; full suite green; build succeeds (pre-existing chunk-size warning OK).

- [ ] **Step 2: Size audit of every touched file**

Run: `for f in src/data/assetKeys.ts src/data/rewardIcon.ts src/data/entityIcon.ts src/scenes/PreloadScene.ts src/scenes/HeroScene.ts; do [ -f "$f" ] && wc -l "$f"; done`
Expected: all < 500.

- [ ] **Step 3: CDP playtest the icon-heavy screens**

Run, for each scene, e.g.:
`bash scripts/playtest/snap.sh --out=/tmp/inv.png --scene=HeroScene --wait=1200`
then `--scene=ShopScene`, `--scene=CollectionScene`, `--scene=SquadScene`, `--scene=ActivitiesScene`.
Expected: no EXC in output; screenshots show real item/tower/material textures (not emoji) and match what the reward panel shows. View each PNG to confirm.

- [ ] **Step 4: Update memory**

Update `memory/project_reward_icon_single_source.md` to note that key derivation is now centralized in `assetKeys.ts` (the resolver derives through it; the discipline test forbids inline keys), and add a one-line pointer in `memory/MEMORY.md` if a new memory file is warranted.

- [ ] **Step 5: Final commit (if memory changed)**

```bash
git add -A && git commit -m "docs(memory): record assetKeys single key-derivation registry

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**

- Unit 1 (assetKeys) → Task 1 + Task 2 (delegation). ✓
- Unit 2 (generalized resolver) → Task 3 (rewardIcon derives via assetKeys) + Task 4 (entity resolvers). ✓
- Unit 3 (migrate + dedupe) → Task 5 (call sites + 3 dup branches collapsed). ✓
- Unit 4 (contract tests) → Task 6 (discipline guard + catalog→key contract). ✓
- Zero-output-change guarantee → existing `rewardIcon`/`rewardPanel`/`materialIcons`/`iconFit` re-run in Tasks 2/3, full suite in 5/7. ✓
- 500-line rule → size checks in Tasks 1, 4, 5, 7 + the entityIcon split escape hatch in Task 4. ✓
- Non-goals (no branded ids, no codegen, no art/resize, no economy change) → nothing in any task touches those. ✓

**Placeholder scan:** every code step shows complete code; every run step has an exact command + expected result. No TBD/TODO. ✓

**Type consistency:** `RewardIconView` is the one descriptor type throughout; resolvers `itemInstanceIcon`/`towerIcon`/`skillIcon` keep identical names in Task 4 test, Task 4 impl, and (if split) the entityIcon note; key fns `itemTex/towerTex/jewelTex/materialTex/boxTex/skillTex/menuTex/fxTex` + constants `GOLD_TEX/GEM_TEX/XP_TEX/HERODOLL_BASE_TEX` are named identically in Task 1 impl, Task 1 test, and every consumer task. ✓
