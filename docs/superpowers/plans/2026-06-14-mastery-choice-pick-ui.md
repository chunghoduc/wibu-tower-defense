# Mastery Choice-Pick UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let players actually pick one of the three options on each "Choose" mastery passive node, persist the pick, apply it to hero stats, and surface a clear in-panel picker UI.

**Architecture:** Add a `choices` array to `PassiveNodeDef` (each option is a `Stats` bag). Persist the per-node pick in `save.hero.nodeChoices`. A pure `effectiveNode()` seam maps a stored node + the save's choices into a node whose stats reflect the pick; `heroStats` runs every unlocked node through it. The UI is an inline option-chip presenter (`MasteryChoicePanel`) wired into `PassiveGridScene`'s right detail panel.

**Tech Stack:** TypeScript, Phaser 3, vitest. Pure logic modules are Phaser-free and unit-tested; presenters/scenes are thin.

**Conventions:**
- Run tests with `npx vitest run <path>` (single file) or `npm test` (all).
- Typecheck with `npx tsc --noEmit`. Lint with `npm run lint` (max-lines 500 = error).
- Commit trailer required: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Read a file in the current turn before editing it.

---

## File Structure

- `src/data/schema.ts` — add `PassiveChoiceOption` interface + `PassiveNodeDef.choices?`.
- `src/data/passiveGrid.ts` — author options for `brawler-mastery-1`, `arcane-mastery-1`, `warden-mastery-1`.
- `src/data/passiveGridRegions2.ts` — author options for `tactician-mastery-1`.
- `src/core/save.ts` — `nodeChoices` field + default + v12 migration + backfill.
- `src/core/passiveChoice.ts` — **new** pure module: `selectedChoice`, `effectiveNode`.
- `src/core/heroStats.ts` — map unlocked nodes through `effectiveNode`.
- `src/core/saveManagerCore.ts` — unlock/forget/reset honour choices + new `setNodeChoice`.
- `src/scenes/masteryChoicePanel.ts` — **new** presenter for the option chips.
- `src/scenes/PassiveGridScene.ts` — wire the panel; keep < 500 lines.
- Tests: `tests/passiveChoice.test.ts` (new), additions to `tests/passiveGrid.test.ts` and a save/heroStats test.

---

## Task 1: Choice data model in the schema

**Files:**
- Modify: `src/data/schema.ts` (the `PassiveNodeDef` interface, around lines 137-158)

- [ ] **Step 1: Add the option type and the `choices` field**

In `src/data/schema.ts`, immediately **before** `export interface PassiveNodeDef {`, add:

```ts
/** One selectable option on a "choose" passive node. Its stat bags replace the node's own. */
export interface PassiveChoiceOption {
  /** Stable id, unique within the node (persisted in the save). */
  id: string;
  /** Short display label, e.g. "Precision  +20% Crit Dmg". */
  label: string;
  flat?: Partial<Stats>;
  increased?: Partial<Stats>;
  more?: Partial<Stats>;
}
```

Then inside `PassiveNodeDef`, after the `effectId?` line and before `unlockAtLevel?`, add:

```ts
  /** When present, the player picks ONE option; the chosen option's stats replace
   *  the node's own flat/increased/more. */
  choices?: PassiveChoiceOption[];
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (no new code uses the field yet).

- [ ] **Step 3: Commit**

```bash
git add src/data/schema.ts
git commit -m "feat(passive): PassiveChoiceOption type + node choices field

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Pure stat-resolution module (`passiveChoice.ts`)

**Files:**
- Create: `src/core/passiveChoice.ts`
- Test: `tests/passiveChoice.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/passiveChoice.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import type { PassiveNodeDef } from "../src/data/schema.ts";
import { selectedChoice, effectiveNode } from "../src/core/passiveChoice.ts";

const choiceNode: PassiveNodeDef = {
  id: "x-mastery",
  type: "mastery",
  region: "brawler",
  name: "X Mastery",
  description: "Choose one.",
  gridX: 0,
  gridY: 0,
  neighbors: [],
  choices: [
    { id: "a", label: "A", increased: { critDamage: 0.2 } },
    { id: "b", label: "B", increased: { armorPen: 0.15 } },
    { id: "c", label: "C", flat: { maxHp: 100 } },
  ],
};

const plainNode: PassiveNodeDef = {
  id: "x-path",
  type: "path",
  region: "brawler",
  name: "Plain",
  description: "",
  gridX: 0,
  gridY: 0,
  neighbors: [],
  increased: { atk: 0.05 },
};

describe("selectedChoice", () => {
  it("returns the chosen option when recorded", () => {
    expect(selectedChoice(choiceNode, { "x-mastery": "b" })?.id).toBe("b");
  });
  it("returns null for an unrecorded choice node", () => {
    expect(selectedChoice(choiceNode, {})).toBeNull();
  });
  it("returns null for a non-choice node", () => {
    expect(selectedChoice(plainNode, { "x-path": "a" })).toBeNull();
  });
});

describe("effectiveNode", () => {
  it("uses the chosen option's stats", () => {
    const n = effectiveNode(choiceNode, { "x-mastery": "b" });
    expect(n.increased).toEqual({ armorPen: 0.15 });
    expect(n.flat).toBeUndefined();
  });
  it("falls back to the first option when unrecorded", () => {
    const n = effectiveNode(choiceNode, {});
    expect(n.increased).toEqual({ critDamage: 0.2 });
  });
  it("falls back to the first option when the recorded id is unknown", () => {
    const n = effectiveNode(choiceNode, { "x-mastery": "zzz" });
    expect(n.increased).toEqual({ critDamage: 0.2 });
  });
  it("passes a non-choice node through unchanged", () => {
    const n = effectiveNode(plainNode, {});
    expect(n).toBe(plainNode);
  });
  it("preserves identity fields and effectId on a choice node", () => {
    const n = effectiveNode(choiceNode, { "x-mastery": "c" });
    expect(n.id).toBe("x-mastery");
    expect(n.flat).toEqual({ maxHp: 100 });
    expect(n.increased).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/passiveChoice.test.ts`
Expected: FAIL — cannot resolve `../src/core/passiveChoice.ts`.

- [ ] **Step 3: Write the minimal implementation**

Create `src/core/passiveChoice.ts`:

```ts
/**
 * Pure resolution of "choose one" passive nodes. A node with `choices` carries
 * its stats inside the options; the player's pick (stored in save.hero.nodeChoices)
 * selects which option's stats apply. `effectiveNode` is the single seam the stat
 * pipeline consumes — it returns a node whose flat/increased/more reflect the pick,
 * falling back to the first option when nothing valid is recorded.
 */
import type { PassiveChoiceOption, PassiveNodeDef } from "../data/schema.ts";

/** The chosen option for a choice node, or null (not a choice node / unrecorded). */
export function selectedChoice(
  node: PassiveNodeDef,
  nodeChoices: Record<string, string>,
): PassiveChoiceOption | null {
  if (!node.choices || node.choices.length === 0) return null;
  const id = nodeChoices[node.id];
  if (id === undefined) return null;
  return node.choices.find((c) => c.id === id) ?? null;
}

/**
 * A node whose flat/increased/more reflect the chosen option. Non-choice nodes are
 * returned unchanged (same reference). For a choice node, falls back to the first
 * option when the recorded pick is missing or unknown.
 */
export function effectiveNode(
  node: PassiveNodeDef,
  nodeChoices: Record<string, string>,
): PassiveNodeDef {
  if (!node.choices || node.choices.length === 0) return node;
  const option = selectedChoice(node, nodeChoices) ?? node.choices[0];
  return {
    ...node,
    flat: option.flat,
    increased: option.increased,
    more: option.more,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/passiveChoice.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/core/passiveChoice.ts tests/passiveChoice.test.ts
git commit -m "feat(passive): pure effectiveNode/selectedChoice resolver (TDD)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Save model — `nodeChoices` field, default, migration

**Files:**
- Modify: `src/core/save.ts` — `HeroProgressSave` (lines 72-84), `CURRENT_SAVE_VERSION` (line 5), `createFreshSave` (lines 162-171), migration block (after line 282), backfill (after line 322)
- Test: add to `tests/passiveGrid.test.ts` OR a new `tests/saveMigration.test.ts` (use new file to avoid coupling)

- [ ] **Step 1: Write the failing test**

Create `tests/saveNodeChoices.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createFreshSave, migrateSave, CURRENT_SAVE_VERSION } from "../src/core/save.ts";

describe("nodeChoices save field", () => {
  it("a fresh save starts with an empty nodeChoices map", () => {
    const save = createFreshSave();
    expect(save.hero.nodeChoices).toEqual({});
    expect(save.version).toBe(CURRENT_SAVE_VERSION);
  });

  it("migrates an old save (no nodeChoices) without crashing and backfills the map", () => {
    const fresh = createFreshSave();
    // Simulate a pre-v12 save: strip the field and stamp an older version.
    const legacy = JSON.parse(JSON.stringify(fresh)) as Record<string, any>;
    delete legacy.hero.nodeChoices;
    legacy.version = 11;
    const migrated = migrateSave(legacy);
    expect(migrated.hero.nodeChoices).toEqual({});
    expect(migrated.version).toBe(CURRENT_SAVE_VERSION);
  });
});
```

> Note: confirm the exported names. `src/core/save.ts` exports `createFreshSave` and
> `CURRENT_SAVE_VERSION`. The migration function is exported — open the file and use its real name
> (it is referenced in the file around line 199+ as the function wrapping the `if ((save.version...`
> hops). If it is named differently than `migrateSave`, update the import accordingly.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/saveNodeChoices.test.ts`
Expected: FAIL — `save.hero.nodeChoices` is `undefined`.

- [ ] **Step 3: Bump the version constant**

In `src/core/save.ts` line 5, change:

```ts
export const CURRENT_SAVE_VERSION = 11;
```
to
```ts
export const CURRENT_SAVE_VERSION = 12;
```

- [ ] **Step 4: Add the field to `HeroProgressSave`**

In the `HeroProgressSave` interface (after the `socketedJewels` line ~83), add:

```ts
  /** nodeId → chosen PassiveChoiceOption.id, for unlocked "choose" nodes. */
  nodeChoices: Record<string, string>;
```

- [ ] **Step 5: Seed it in `createFreshSave`**

In `createFreshSave` (the `hero: { ... }` block ~162-171), after `socketedJewels: {},` add:

```ts
      nodeChoices: {},
```

- [ ] **Step 6: Add the migration hop + backfill**

In the migration function, **after** the `if ((save.version ?? 0) < 11) { ... }` block (ends ~line 283) and before the "Defensive backfill" comment, add:

```ts
  if ((save.version ?? 0) < 12) {
    // Mastery choice-pick: choose-nodes now persist which option is active.
    save = { ...save, version: 12 };
    if (save.hero) save.hero.nodeChoices ??= {};
  }
```

And in the defensive backfill for `save.hero` (alongside `save.hero.socketedJewels ??= {};` ~line 322), add:

```ts
    save.hero.nodeChoices ??= {};
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx vitest run tests/saveNodeChoices.test.ts`
Expected: PASS.

- [ ] **Step 8: Run the full suite + typecheck (catch save-shape fallout)**

Run: `npx tsc --noEmit && npm test`
Expected: PASS. If another test builds a `hero` object literal inline and now errors on the missing
`nodeChoices`, add `nodeChoices: {}` to that literal.

- [ ] **Step 9: Commit**

```bash
git add src/core/save.ts tests/saveNodeChoices.test.ts
git commit -m "feat(passive): persist nodeChoices + v11->v12 migration (TDD)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Author the four mastery nodes' options

**Files:**
- Modify: `src/data/passiveGrid.ts` — `brawler-mastery-1` (~64-75), `arcane-mastery-1` (~166-177), `warden-mastery-1` (~270-281)
- Modify: `src/data/passiveGridRegions2.ts` — `tactician-mastery-1` (~48-59)
- Test: add a block to `tests/passiveGrid.test.ts`

- [ ] **Step 1: Write the failing data-integrity test**

Append to `tests/passiveGrid.test.ts` (inside the file, add a new `describe`):

```ts
import { PASSIVE_NODES } from "../src/data/passiveGrid.ts";

describe("mastery choice nodes", () => {
  const choiceNodes = PASSIVE_NODES.filter((n) => n.choices && n.choices.length > 0);

  it("has the four expected choose-nodes", () => {
    expect(choiceNodes.map((n) => n.id).sort()).toEqual(
      ["arcane-mastery-1", "brawler-mastery-1", "tactician-mastery-1", "warden-mastery-1"].sort(),
    );
  });

  it("each choice node has >=2 options with unique ids and at least one stat", () => {
    for (const node of choiceNodes) {
      const opts = node.choices!;
      expect(opts.length).toBeGreaterThanOrEqual(2);
      const ids = opts.map((o) => o.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const o of opts) {
        const hasStat = !!(o.flat || o.increased || o.more);
        expect(hasStat).toBe(true);
      }
    }
  });

  it("choice nodes carry no node-level stat bags (stats live in options)", () => {
    for (const node of choiceNodes) {
      expect(node.flat).toBeUndefined();
      expect(node.increased).toBeUndefined();
      expect(node.more).toBeUndefined();
    }
  });

  it("choice node descriptions do not enumerate stale 'Choose: X, or Y' values", () => {
    for (const node of choiceNodes) {
      expect(node.description).not.toMatch(/, or /i);
    }
  });
});
```

> If `tests/passiveGrid.test.ts` already imports `PASSIVE_NODES`, don't duplicate the import — reuse it.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/passiveGrid.test.ts`
Expected: FAIL — nodes still have `increased` and "Choose: …, or …" descriptions, no `choices`.

- [ ] **Step 3: Rewrite `brawler-mastery-1`**

In `src/data/passiveGrid.ts`, replace the `description`, remove the `increased` line, and add `choices`:

```ts
  n({
    id: "brawler-mastery-1",
    type: "mastery",
    region: "brawler",
    name: "Brawler Mastery",
    description: "Choose one path to greater offense.",
    gridX: 6,
    gridY: 5,
    neighbors: ["brawler-notable-1"],
    effectId: "brawler-mastery",
    choices: [
      { id: "precision", label: "Precision  +20% Crit Dmg", increased: { critDamage: 0.2 } },
      { id: "penetration", label: "Penetration  +15% Armor Pen", increased: { armorPen: 0.15 } },
      { id: "power", label: "Power  +10% ATK", increased: { atk: 0.1 } },
    ],
  }),
```

- [ ] **Step 4: Rewrite `arcane-mastery-1`**

```ts
  n({
    id: "arcane-mastery-1",
    type: "mastery",
    region: "arcane",
    name: "Arcane Mastery",
    description: "Choose one path to greater magic.",
    gridX: 18,
    gridY: 5,
    neighbors: ["arcane-notable-1", "arcane-jewel-1"],
    effectId: "arcane-mastery",
    choices: [
      { id: "potency", label: "Potency  +15% Skill Power", increased: { skillPower: 0.15 } },
      { id: "piercing", label: "Piercing  +10% Magic Pen", increased: { magicPen: 0.1 } },
      { id: "channeling", label: "Channeling  +8 Mana/Hit", flat: { manaOnHit: 8 } },
    ],
  }),
```

- [ ] **Step 5: Rewrite `warden-mastery-1`**

```ts
  n({
    id: "warden-mastery-1",
    type: "mastery",
    region: "warden",
    name: "Warden Mastery",
    description: "Choose one path to greater defense.",
    gridX: 6,
    gridY: 13,
    neighbors: ["warden-notable-1", "warden-jewel-1"],
    effectId: "warden-mastery",
    choices: [
      { id: "fortitude", label: "Fortitude  +15% Dmg Reduction", increased: { damageReduction: 0.15 } },
      { id: "warding", label: "Warding  +20% Magic Resist", increased: { magicResist: 0.2 } },
      { id: "vitality", label: "Vitality  +100 Max HP", flat: { maxHp: 100 } },
    ],
  }),
```

- [ ] **Step 6: Rewrite `tactician-mastery-1`**

In `src/data/passiveGridRegions2.ts`. Note: the original options 2 & 3 ("tower ATK aura",
"-10% tower cost") were effect-phrasings, not hero stats. Normalise to three concrete stat options
of comparable utility-budget (gold/mana economy):

```ts
  n({
    id: "tactician-mastery-1",
    type: "mastery",
    region: "tactician",
    name: "Tactician Mastery",
    description: "Choose one path to greater command.",
    gridX: 18,
    gridY: 13,
    neighbors: ["tactician-notable-1", "tactician-jewel-1"],
    effectId: "tactician-mastery",
    choices: [
      { id: "prosperity", label: "Prosperity  +20% Gold Find", increased: { goldFind: 0.2 } },
      { id: "momentum", label: "Momentum  +10% Atk Speed", increased: { attackSpeed: 0.1 } },
      { id: "reservoir", label: "Reservoir  +12 Mana/Kill", flat: { manaOnKill: 12 } },
    ],
  }),
```

- [ ] **Step 7: Run the data test + typecheck**

Run: `npx vitest run tests/passiveGrid.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/data/passiveGrid.ts src/data/passiveGridRegions2.ts tests/passiveGrid.test.ts
git commit -m "feat(passive): author 3 stat options per mastery node (TDD)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Apply the choice in hero stat resolution

**Files:**
- Modify: `src/core/heroStats.ts` (the `unlockedNodes` builder, lines 32-34)
- Test: `tests/heroStatsChoice.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `tests/heroStatsChoice.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createFreshSave } from "../src/core/save.ts";
import { resolveHeroBattleStats } from "../src/core/heroStats.ts";
import type { Stats } from "../src/data/schema.ts";

// Minimal non-zero base; only the deltas from the node matter for this test.
const BASE: Stats = {
  atk: 100,
  attackSpeed: 1,
  range: 100,
  maxHp: 1000,
  hpRegen: 0,
  armor: 0,
  magicResist: 0,
  critRate: 0,
  critDamage: 0,
  armorPen: 0,
  magicPen: 0,
  skillPower: 0,
  damageReduction: 0,
  tenacity: 0,
  manaOnHit: 0,
  manaOnKill: 0,
  omnivamp: 0,
  moveSpeed: 0,
  goldFind: 0,
};

describe("nodeChoices reach hero stats", () => {
  it("option B (armorPen) differs from the default option A (critDamage)", () => {
    const a = createFreshSave();
    a.hero.unlockedNodes = ["brawler-mastery-1"];
    a.hero.nodeChoices = {}; // default → first option (critDamage)

    const b = createFreshSave();
    b.hero.unlockedNodes = ["brawler-mastery-1"];
    b.hero.nodeChoices = { "brawler-mastery-1": "penetration" }; // armorPen

    const statsA = resolveHeroBattleStats(a, { ...BASE }).stats;
    const statsB = resolveHeroBattleStats(b, { ...BASE }).stats;

    expect(statsA.critDamage).toBeGreaterThan(statsB.critDamage);
    expect(statsB.armorPen).toBeGreaterThan(statsA.armorPen);
  });
});
```

> If `Stats` requires additional/different keys, open `src/data/schema.ts` and match the real shape
> for `BASE`. The point is a fully-populated base so the pipeline doesn't read `undefined`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/heroStatsChoice.test.ts`
Expected: FAIL — both resolve to the first option (choice not yet applied), so `armorPen` is equal.

- [ ] **Step 3: Wire `effectiveNode` into `resolveHeroBattleStats`**

In `src/core/heroStats.ts`, add the import near the other core imports (after line 21):

```ts
import { effectiveNode } from "./passiveChoice.ts";
```

Replace the `unlockedNodes` builder (lines 32-34):

```ts
  const unlockedNodes = save.hero.unlockedNodes
    .map((id) => PASSIVE_NODES_MAP.get(id))
    .filter((n): n is PassiveNodeDef => n !== undefined);
```
with:
```ts
  const unlockedNodes = save.hero.unlockedNodes
    .map((id) => PASSIVE_NODES_MAP.get(id))
    .filter((n): n is PassiveNodeDef => n !== undefined)
    .map((n) => effectiveNode(n, save.hero.nodeChoices ?? {}));
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/heroStatsChoice.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/heroStats.ts tests/heroStatsChoice.test.ts
git commit -m "feat(passive): apply chosen mastery option to hero stats (TDD)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: SaveManager — record/clear/switch the pick

**Files:**
- Modify: `src/core/saveManagerCore.ts` — `unlockPassiveNode` (~139-147), `forgetPassiveNode` (~156-165), `resetPassiveTree` (~172-180), add `setNodeChoice`
- Test: `tests/saveManagerChoice.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `tests/saveManagerChoice.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { SaveManager } from "../src/core/saveManager.ts";

// Use an in-memory save. Open src/core/saveManager.ts to confirm the constructor /
// factory used elsewhere in tests; mirror that pattern here. The assertions below
// only touch passive-tree methods.
function freshMgr(): SaveManager {
  const mgr = new SaveManager();
  const save = mgr.getSave();
  save.hero.level = 50; // ensure regions are unlocked
  save.hero.skillPoints = 10;
  return mgr;
}

describe("mastery choice via SaveManager", () => {
  let mgr: SaveManager;
  beforeEach(() => {
    mgr = freshMgr();
  });

  it("unlock records the requested choice", () => {
    // brawler-mastery-1 requires its neighbor chain; allocate prerequisites first.
    // Open src/data/passiveGrid.ts to confirm the reachable path to the node, then
    // unlock each step. For the test, seed unlockedNodes to the node's neighbor so
    // it is reachable:
    mgr.getSave().hero.unlockedNodes = ["brawler-notable-1"];
    const ok = mgr.unlockPassiveNode("brawler-mastery-1", "penetration");
    expect(ok).toBe(true);
    expect(mgr.getSave().hero.nodeChoices["brawler-mastery-1"]).toBe("penetration");
  });

  it("unlock without a choiceId defaults to the first option", () => {
    mgr.getSave().hero.unlockedNodes = ["brawler-notable-1"];
    mgr.unlockPassiveNode("brawler-mastery-1");
    expect(mgr.getSave().hero.nodeChoices["brawler-mastery-1"]).toBe("precision");
  });

  it("setNodeChoice switches an unlocked choice node", () => {
    mgr.getSave().hero.unlockedNodes = ["brawler-notable-1"];
    mgr.unlockPassiveNode("brawler-mastery-1", "precision");
    expect(mgr.setNodeChoice("brawler-mastery-1", "power")).toBe(true);
    expect(mgr.getSave().hero.nodeChoices["brawler-mastery-1"]).toBe("power");
  });

  it("setNodeChoice rejects a locked node, unknown option, or non-choice node", () => {
    expect(mgr.setNodeChoice("brawler-mastery-1", "power")).toBe(false); // not unlocked
    mgr.getSave().hero.unlockedNodes = ["brawler-notable-1"];
    mgr.unlockPassiveNode("brawler-mastery-1", "precision");
    expect(mgr.setNodeChoice("brawler-mastery-1", "nope")).toBe(false); // unknown option
    expect(mgr.setNodeChoice("brawler-notable-1", "x")).toBe(false); // non-choice node
  });

  it("resetPassiveTree clears recorded choices", () => {
    mgr.getSave().hero.unlockedNodes = ["brawler-notable-1"];
    mgr.unlockPassiveNode("brawler-mastery-1", "power");
    mgr.resetPassiveTree();
    expect(mgr.getSave().hero.nodeChoices).toEqual({});
  });
});
```

> Confirm `SaveManager`'s construction pattern against an existing test (e.g. `tests/` files that
> already `new SaveManager()` or use a factory). Match it. Also confirm `unlockPassiveNode`'s
> reachability rule — if seeding `unlockedNodes` to the direct neighbor isn't enough to make the
> node reachable, allocate the full chain the same way the existing passive tests do.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/saveManagerChoice.test.ts`
Expected: FAIL — `unlockPassiveNode` ignores the 2nd arg; `setNodeChoice` doesn't exist.

- [ ] **Step 3: Update `unlockPassiveNode` to record the choice**

In `src/core/saveManagerCore.ts`, first ensure `PASSIVE_NODES_MAP` is importable. Check the existing
imports at the top of the file; if `PASSIVE_NODES_MAP` isn't already imported from
`../data/passiveGrid.ts`, add it to that import.

Replace the method (lines ~138-147):

```ts
  /** Unlock a passive node. Returns false if not enough skill points or node unreachable. */
  unlockPassiveNode(nodeId: string): boolean {
    const save = this.save;
    if (save.hero.skillPoints <= 0) return false;
    if (save.hero.unlockedNodes.includes(nodeId)) return false;
    save.hero.unlockedNodes.push(nodeId);
    save.hero.skillPoints -= 1;
    this.persist();
    return true;
  }
```
with:
```ts
  /** Unlock a passive node. Returns false if not enough skill points or node unreachable.
   *  For "choose" nodes, records `choiceId` (defaulting to the first option). */
  unlockPassiveNode(nodeId: string, choiceId?: string): boolean {
    const save = this.save;
    if (save.hero.skillPoints <= 0) return false;
    if (save.hero.unlockedNodes.includes(nodeId)) return false;
    save.hero.unlockedNodes.push(nodeId);
    save.hero.skillPoints -= 1;
    const node = PASSIVE_NODES_MAP.get(nodeId);
    if (node?.choices && node.choices.length > 0) {
      const valid = choiceId && node.choices.some((c) => c.id === choiceId);
      save.hero.nodeChoices[nodeId] = valid ? choiceId! : node.choices[0].id;
    }
    this.persist();
    return true;
  }
```

> Note: this method does not currently enforce reachability (the scene gates the button). Keep that
> behaviour — don't add a reachability check that existing tests/UI don't expect.

- [ ] **Step 4: Clear the choice on forget**

In `forgetPassiveNode` (~156-165), after the line that filters `unlockedNodes`
(`hero.unlockedNodes = hero.unlockedNodes.filter((id) => id !== nodeId);`), add:

```ts
    delete hero.nodeChoices[nodeId];
```

- [ ] **Step 5: Clear all choices on reset**

In `resetPassiveTree` (~172-180), after `hero.unlockedNodes = [];` add:

```ts
    hero.nodeChoices = {};
```

- [ ] **Step 6: Add `setNodeChoice`**

Immediately after `forgetPassiveNode` (before `resetPassiveTree`), add:

```ts
  /**
   * Switch the active option on an already-unlocked "choose" node. Free — the
   * options are intra-node sidegrades and the node's point is already spent.
   * Returns false if the node isn't unlocked, isn't a choice node, or the option
   * id is unknown.
   */
  setNodeChoice(nodeId: string, choiceId: string): boolean {
    const hero = this.save.hero;
    if (!hero.unlockedNodes.includes(nodeId)) return false;
    const node = PASSIVE_NODES_MAP.get(nodeId);
    if (!node?.choices || !node.choices.some((c) => c.id === choiceId)) return false;
    hero.nodeChoices[nodeId] = choiceId;
    this.persist();
    return true;
  }
```

- [ ] **Step 7: Run the test + typecheck**

Run: `npx vitest run tests/saveManagerChoice.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/core/saveManagerCore.ts tests/saveManagerChoice.test.ts
git commit -m "feat(passive): record/switch/clear mastery choice in SaveManager (TDD)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Choice-picker presenter (`masteryChoicePanel.ts`)

**Files:**
- Create: `src/scenes/masteryChoicePanel.ts`

This is a Phaser presenter; it has no unit test (verified live in Task 9). Keep it focused and < 200
lines.

- [ ] **Step 1: Write the presenter**

Create `src/scenes/masteryChoicePanel.ts`:

```ts
import Phaser from "phaser";
import type { SaveManager } from "../core/saveManager.ts";
import type { PassiveNodeDef } from "../data/schema.ts";

const CHIP_X = 545; // matches PANEL_X in PassiveGridScene
const CHIP_W = 400; // matches PANEL_W
const CHIP_TOP = 176; // sits where panelStats would be
const CHIP_H = 34;
const CHIP_GAP = 8;

/**
 * Inline option-chip picker for "choose" mastery nodes, rendered into the passive
 * tree's right detail panel. For a locked node, tapping a chip sets a *pending*
 * pick (returned via getPending) that the scene's Unlock button consumes. For an
 * unlocked node, tapping a chip switches the active option immediately (free) via
 * SaveManager.setNodeChoice and triggers the scene to redraw.
 */
export class MasteryChoicePanel {
  private chips: Phaser.GameObjects.Text[] = [];
  private pendingId: string | null = null;

  constructor(
    private scene: Phaser.Scene,
    private mgr: SaveManager,
    private onChange: () => void,
  ) {}

  /** The chip the player has tentatively selected on a locked node (for Unlock). */
  getPending(): string | null {
    return this.pendingId;
  }

  /** Hide the picker (non-choice node or no selection). */
  clear(): void {
    for (const c of this.chips) c.destroy();
    this.chips = [];
    this.pendingId = null;
  }

  /**
   * Render chips for a choice node. `isUnlocked` drives behaviour: locked → pending
   * selection; unlocked → instant free switch. Returns true if it rendered (caller
   * should then hide the plain stat text).
   */
  render(node: PassiveNodeDef, isUnlocked: boolean): boolean {
    this.clear();
    if (!node.choices || node.choices.length === 0) return false;

    const activeId = isUnlocked
      ? (this.mgr.getSave().hero.nodeChoices[node.id] ?? node.choices[0].id)
      : null;
    // Default the pending pick to the first option so Unlock always has a value.
    if (!isUnlocked) this.pendingId = node.choices[0].id;

    node.choices.forEach((opt, i) => {
      const y = CHIP_TOP + i * (CHIP_H + CHIP_GAP);
      const selected = isUnlocked ? opt.id === activeId : opt.id === this.pendingId;
      const chip = this.scene.add
        .text(CHIP_X, y, (selected ? "● " : "○ ") + opt.label, {
          fontSize: "13px",
          color: selected ? "#fff8e1" : "#cfd8dc",
          backgroundColor: selected ? "#5d4037" : "#2c3a47",
          fixedWidth: CHIP_W,
          padding: { left: 10, right: 10, top: 8, bottom: 8 },
        })
        .setInteractive({ useHandCursor: true });

      chip.on("pointerover", () =>
        chip.setBackgroundColor(this.isSelected(opt.id, isUnlocked, activeId) ? "#6d4c41" : "#37474f"),
      );
      chip.on("pointerout", () =>
        chip.setBackgroundColor(this.isSelected(opt.id, isUnlocked, activeId) ? "#5d4037" : "#2c3a47"),
      );
      chip.on("pointerdown", () => this.pick(node, opt.id, isUnlocked));
      this.chips.push(chip);
    });
    return true;
  }

  private isSelected(optId: string, isUnlocked: boolean, activeId: string | null): boolean {
    return isUnlocked ? optId === activeId : optId === this.pendingId;
  }

  private pick(node: PassiveNodeDef, optId: string, isUnlocked: boolean): void {
    if (isUnlocked) {
      if (this.mgr.setNodeChoice(node.id, optId)) this.onChange();
    } else {
      this.pendingId = optId;
      this.render(node, false); // re-render to move the highlight
    }
  }
}
```

> The chip highlight colours and geometry mirror PassiveGridScene's panel constants. If `PANEL_X` /
> `PANEL_W` differ from 545 / 400 when you implement, keep them in sync (or import shared constants).

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/scenes/masteryChoicePanel.ts
git commit -m "feat(passive): MasteryChoicePanel option-chip presenter

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: Wire the panel into `PassiveGridScene`

**Files:**
- Modify: `src/scenes/PassiveGridScene.ts` — imports, a field, `create()`, `tryUnlock()`, `refreshPanel()`

Keep the scene **under 500 lines**. The picker logic lives in the presenter; the scene only
orchestrates show/hide and the unlock hand-off.

- [ ] **Step 1: Import the presenter**

At the top of `src/scenes/PassiveGridScene.ts`, after the other scene imports, add:

```ts
import { MasteryChoicePanel } from "./masteryChoicePanel.ts";
```

- [ ] **Step 2: Add the field**

In the class fields (near `private jewelOverlay!: JewelOverlay;`), add:

```ts
  private choicePanel!: MasteryChoicePanel;
```

- [ ] **Step 3: Construct it in `create()`**

Right after `this.jewelOverlay = new JewelOverlay(this, this.mgr, () => this.redraw());`, add:

```ts
    this.choicePanel = new MasteryChoicePanel(this, this.mgr, () => this.redraw());
```

- [ ] **Step 4: Hand the pending pick to `tryUnlock`**

Replace `tryUnlock` (~382-388):

```ts
  private tryUnlock(): void {
    if (!this.selectedNode) return;
    const ok = this.mgr.unlockPassiveNode(this.selectedNode.id);
    if (ok) {
      this.redraw();
    }
  }
```
with:
```ts
  private tryUnlock(): void {
    if (!this.selectedNode) return;
    const choiceId = this.selectedNode.choices ? this.choicePanel.getPending() : undefined;
    const ok = this.mgr.unlockPassiveNode(this.selectedNode.id, choiceId ?? undefined);
    if (ok) {
      this.redraw();
    }
  }
```

- [ ] **Step 5: Render/hide the picker in `refreshPanel`**

In `refreshPanel`, two edits.

(a) In the early `if (!this.selectedNode) { ... }` block (the no-selection branch ~465-476), before
`return;`, add:

```ts
      this.choicePanel.clear();
```

(b) After the line `this.panelStats.setText(formatStatBonuses(node)).setColor("#a5d6a7");` (~487),
add the choice-node branch:

```ts
    // "Choose" nodes replace the static stat line with an interactive option picker.
    if (node.choices && node.choices.length > 0) {
      this.panelStats.setText("");
      this.choicePanel.render(node, isUnlocked);
    } else {
      this.choicePanel.clear();
    }
```

> `isUnlocked` is already computed earlier in `refreshPanel`. The jewel-socket branch below sets its
> own `panelStats` text; choice nodes are never jewel sockets, so the two branches don't collide.

- [ ] **Step 6: Typecheck + line count**

Run: `npx tsc --noEmit && npx eslint src/scenes/PassiveGridScene.ts`
Expected: PASS, no `max-lines` error. If the scene now exceeds 500 lines, move the two new
`refreshPanel` snippets into a small private helper, or relocate panel constants — but the presenter
already holds the bulk, so it should stay under.

- [ ] **Step 7: Commit**

```bash
git add src/scenes/PassiveGridScene.ts
git commit -m "feat(passive): wire choice picker into PassiveGridScene

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 9: Verify whole — tests, build, live playtest

**Files:** none (verification only)

- [ ] **Step 1: Full test suite + typecheck + lint**

Run: `npx tsc --noEmit && npm test && npm run lint`
Expected: all PASS, no `max-lines` violations.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: succeeds (the pre-existing >500 kB chunk warning is benign).

- [ ] **Step 3: Live CDP playtest**

Start the dev server and drive via `window.__game` (see memory `reference_playtest_and_art.md`).
Verify:
- Open Passive Tree, select a mastery node (e.g. Brawler Mastery). Three option chips show with the
  first highlighted (`●`).
- Locked node: tap a different chip → highlight moves. Tap Unlock → node unlocks with that option.
- Re-select the now-unlocked node → the chosen option shows highlighted with a filled marker; the
  other two are tappable. Tap another → it switches immediately.
- Reload the page → the picked option persists (check `window.__game` save / re-open the node).
- A non-choice node (e.g. a path node) still shows the plain green stat line, no chips.

Capture a screenshot of the picker for the summary.

- [ ] **Step 4: Final commit (if any playtest fixups)**

```bash
git add -A
git commit -m "fix(passive): playtest fixups for mastery choice picker

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

> No `ASSET_VERSION` bump is needed — this change ships no new art or audio.

---

## Self-Review Notes

- **Spec coverage:** data model (T1), pure resolver (T2), save+migration (T3), authored options (T4),
  stat application (T5), SaveManager unlock/forget/reset/switch (T6), presenter (T7), scene wiring
  (T8), verification (T9). All spec sections mapped.
- **Type consistency:** `effectiveNode(node, nodeChoices)` and `selectedChoice(node, nodeChoices)`
  used identically in T2/T5; `setNodeChoice(nodeId, choiceId)` and `unlockPassiveNode(nodeId,
  choiceId?)` consistent across T6/T8; `MasteryChoicePanel` API (`render`, `clear`, `getPending`)
  consistent across T7/T8.
- **Placeholders:** none — every code step shows full code; test seeds note where to confirm real
  exports against the file.
- **Risk:** additive migration; non-choice nodes pass through `effectiveNode` unchanged (same
  reference, asserted in T2).
```