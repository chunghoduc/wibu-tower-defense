# Mastery Choice-Pick UI — Design Spec

**Date:** 2026-06-14
**Status:** Approved (full-auto session — self-approved)

## Problem

Four passive-tree "mastery" nodes promise the player a choice but never deliver one. Their
descriptions read like a fork:

| Node | Description | Actually applied |
| --- | --- | --- |
| `brawler-mastery-1` | "Choose: +20% crit dmg, or +15% armor pen, or +10% ATK." | `+20% crit dmg` only |
| `arcane-mastery-1` | "Choose: +15% skillPower, or +10% magicPen, or +8 manaOnHit." | `+15% skillPower` only |
| `warden-mastery-1` | "Choose: +15% dmgReduction, or +20% magicResist, or +100 maxHp." | `+15% dmgReduction` only |
| `tactician-mastery-1` | "Choose: +20% goldFind, or tower ATK aura, or -10% tower cost." | `+20% goldFind` only |

The data structure (`PassiveNodeDef`) has a single `increased` stat bag, so only the **first**
option is ever stored and applied. There is **no UI** to pick, **no save field** to record a pick,
and **no stat path** to honour a pick. The "Choose:" wording is a broken promise.

> Note: `tactician-mastery-1`'s second and third options ("tower ATK aura", "-10% tower cost") are
> phrased as effects, not flat hero stats. To keep this change self-contained and shippable, all
> four nodes are normalised to **three concrete stat options each** (see Data below). The tactician
> options become real stat bonuses of comparable budget rather than new engine effects — no new
> mechanics, no engine changes. The node descriptions are rewritten to match exactly what they grant.

## Goals

1. Every "Choose" mastery node lets the player **actually pick** one of its options.
2. The pick is **persisted**, **applied** to hero stats (and the 60% hero→tower share), and
   **survives** reload.
3. The picker UI is **clear**: the player sees all options, what each grants, which one is active,
   and can change their mind.
4. No regression to non-choice nodes, jewel sockets, forget/respec, or save loading.
5. `PassiveGridScene` stays **under 500 lines** (it is already at 531 — the choice UI is extracted
   into its own presenter).

## Non-Goals

- New engine effects (auras, cost reductions as mechanics). Options are plain `Stats`.
- Choice nodes beyond the existing four. The model is general, but we only author these four.
- Charging a cost to switch a choice (see "Re-pick is free" below).

## Design

### 1. Data model — `PassiveChoiceOption`

`src/data/schema.ts` gains a choice option type and an optional `choices` field on `PassiveNodeDef`:

```ts
export interface PassiveChoiceOption {
  /** Stable id, unique within the node (persisted in the save). */
  id: string;
  /** Short display name, e.g. "Precision". */
  label: string;
  flat?: Partial<Stats>;
  increased?: Partial<Stats>;
  more?: Partial<Stats>;
}

// PassiveNodeDef gains:
  /** When present, the player picks ONE option; its stats replace the node's own. */
  choices?: PassiveChoiceOption[];
```

A node with `choices` carries its stats **inside the options**, not in the node-level
`flat/increased/more`. The four mastery nodes drop their node-level `increased` and gain a
`choices` array of three options. `effectId` stays as-is.

Authoring (one example; the other three mirror it):

```ts
n({
  id: "brawler-mastery-1",
  type: "mastery", region: "brawler", name: "Brawler Mastery",
  description: "Choose one: Precision, Penetration, or Power.",
  gridX: 6, gridY: 5, neighbors: ["brawler-notable-1"], effectId: "brawler-mastery",
  choices: [
    { id: "precision",   label: "Precision  +20% Crit Dmg",  increased: { critDamage: 0.2 } },
    { id: "penetration", label: "Penetration  +15% Armor Pen", increased: { armorPen: 0.15 } },
    { id: "power",       label: "Power  +10% ATK",            increased: { atk: 0.1 } },
  ],
}),
```

### 2. Save model — `nodeChoices`

`HeroProgressSave` (`src/core/save.ts`) gains:

```ts
/** nodeId → chosen PassiveChoiceOption.id, for unlocked choice nodes. */
nodeChoices: Record<string, string>;
```

- `defaultSave()` seeds `nodeChoices: {}`.
- `CURRENT_SAVE_VERSION` bumps **11 → 12** with a migration hop that sets `nodeChoices: {}`, plus a
  defensive backfill `save.hero.nodeChoices ??= {}` alongside the existing `socketedJewels` backfill.
- This is additive; no existing data is touched. Returning players keep their unlocked mastery node;
  with no recorded choice it falls back to the first option (current behaviour) until they re-pick.

### 3. Pure stat resolution — `src/core/passiveChoice.ts`

A small, Phaser-free, fully-tested module:

```ts
/** The chosen option for a choice node, or null (no choice / not a choice node). */
export function selectedChoice(node: PassiveNodeDef, nodeChoices: Record<string,string>):
  PassiveChoiceOption | null;

/** A PassiveNodeDef-shaped view whose flat/increased/more reflect the chosen option.
 *  Non-choice nodes return unchanged. Falls back to choices[0] when unrecorded. */
export function effectiveNode(node: PassiveNodeDef, nodeChoices: Record<string,string>):
  PassiveNodeDef;
```

`effectiveNode` is the single seam: it maps a stored node + the save's `nodeChoices` into a node
whose stat bags are the chosen option's. Everything downstream (the stat pipeline,
`collectPassiveMore`) consumes the result transparently and needs no choice awareness.

### 4. Wiring stat resolution — `src/core/heroStats.ts`

`resolveHeroBattleStats` already builds `unlockedNodes` from `PASSIVE_NODES_MAP`. Insert one map:

```ts
const unlockedNodes = save.hero.unlockedNodes
  .map((id) => PASSIVE_NODES_MAP.get(id))
  .filter((n): n is PassiveNodeDef => n !== undefined)
  .map((n) => effectiveNode(n, save.hero.nodeChoices ?? {}));
```

Both the pipeline call and `collectPassiveMore([...unlockedNodes, ...])` then see chosen stats.

### 5. SaveManager — `src/core/saveManagerCore.ts`

- `unlockPassiveNode(nodeId, choiceId?)` — if the node has `choices`, record
  `nodeChoices[nodeId] = choiceId ?? node.choices[0].id` when unlocking.
- `forgetPassiveNode(nodeId)` — also `delete hero.nodeChoices[nodeId]`.
- `respecWithDiamonds()` / reset — clear `nodeChoices = {}` (it refunds the whole tree).
- **New** `setNodeChoice(nodeId, choiceId): boolean` — for an already-unlocked choice node, switch
  the active option and persist. Returns false if the node isn't unlocked, has no `choices`, or the
  `choiceId` is unknown. **No cost.**

### 6. UI — picker in `PassiveGridScene` + `src/scenes/masteryChoicePanel.ts`

Because the scene is already at the 500-line ceiling, the choice UI lives in a new presenter class
`MasteryChoicePanel` (created once in `create()`, like `JewelOverlay`). The scene calls into it from
`refreshPanel`; the panel owns its own option-chip GameObjects and their lifecycle.

**Behaviour** — when the selected node has `choices`:

- The static green stat line (`panelStats`) is replaced by a **vertical stack of option chips**,
  one per option, rendered in the right panel below the description.
- Each chip shows the option `label` (which already encodes the stat, e.g. "Precision +20% Crit
  Dmg"). Chips use the shared button feel.
- **Not yet unlocked:** tapping a chip sets it as the *pending* pick (gold highlight). The existing
  `Unlock (1 pt)` button unlocks the node with the pending pick. If the player unlocks without
  tapping (pending defaults to option 0), they still get a valid choice and can change it for free
  afterward.
- **Already unlocked:** the active option shows a gold highlight + ✓. Tapping a different chip calls
  `setNodeChoice` immediately (free re-pick), re-applies stats, and redraws — instant feedback, no
  confirm dialog. This is the "change your mind" affordance.
- Non-choice nodes: the panel renders nothing; the existing `panelStats` text shows as today.

**Why inline chips, not a modal:** the side panel already is the node-detail surface; a modal would
add a click and hide the tree. Inline chips keep the pick one tap away and visible alongside the
node it belongs to. (Considered + rejected: a popup modal like `JewelOverlay` — heavier, and the
options are simple enough to list in place.)

**Re-pick is free** — the three options are intra-node sidegrades drawn from the same stat budget;
there is no economy to exploit by swapping crit-dmg for armor-pen between battles. The node was
already paid for with its skill point. Gating a swap behind an Oblivion Orb or diamonds would punish
players for a system that is currently silently broken, and discourage the experimentation that
makes a choice node interesting. Forgetting the node still costs an orb (unchanged).

## Data Flow

```
PassiveGridScene (select choice node)
  └─ MasteryChoicePanel.render(node, save)         renders option chips
        ├─ tap chip (locked)   → pending pick (local highlight)
        │     └─ Unlock btn    → mgr.unlockPassiveNode(id, pendingChoiceId)
        └─ tap chip (unlocked) → mgr.setNodeChoice(id, choiceId)
  save.hero.nodeChoices[id] = choiceId   (persisted)
        ↓
resolveHeroBattleStats → effectiveNode(node, nodeChoices) → heroStatPipeline / collectPassiveMore
        ↓
hero battle stats (+ 60% tower share) reflect the chosen option
```

## Testing

Pure-logic tests (vitest, no Phaser):

- **`passiveChoice.test.ts`** —
  - `effectiveNode` returns the chosen option's `increased` for each of the four nodes.
  - Unrecorded choice falls back to `choices[0]`.
  - Non-choice node passes through unchanged.
  - `selectedChoice` returns null for non-choice / unrecorded.
- **`saveManager` / save tests** —
  - `unlockPassiveNode(id, choiceId)` records `nodeChoices[id]`; default `choiceId` = first option.
  - `setNodeChoice` switches an unlocked node; rejects unknown id / locked node / non-choice node.
  - `forgetPassiveNode` clears the choice entry.
  - v11→v12 migration backfills `nodeChoices: {}`; a save missing the field doesn't crash.
- **`heroStats` test** — resolved hero stats differ when `nodeChoices` selects option B vs the
  default option A for `brawler-mastery-1` (proves the choice reaches the pipeline).
- **`passiveGrid` data test** — every node with `choices` has ≥2 options, unique option ids, and no
  node-level `increased`/`flat`/`more` (stats live in options); descriptions contain no stale
  "Choose: X, or Y" enumerations that contradict the options.

UI is verified by live CDP playtest (open Passive Tree, pick each option, confirm highlight + stat
panel update + persistence across reload).

## Risk / Rollback

- Additive save migration; worst case a returning player's mastery node keeps today's first-option
  behaviour until they open the picker. No data loss path.
- Single new stat seam (`effectiveNode`); if it regressed, non-choice nodes are unaffected because
  they pass through unchanged.
- New presenter is self-contained; if disabled, the scene falls back to the static stat line.

## File Touch List

- `src/data/schema.ts` — `PassiveChoiceOption` + `PassiveNodeDef.choices`.
- `src/data/passiveGrid.ts`, `src/data/passiveGridRegions2.ts` — author the four nodes' options.
- `src/core/save.ts` — `nodeChoices` field, default, v12 migration + backfill.
- `src/core/passiveChoice.ts` — **new** pure module (`selectedChoice`, `effectiveNode`).
- `src/core/heroStats.ts` — map unlocked nodes through `effectiveNode`.
- `src/core/saveManagerCore.ts` — unlock/forget/respec + new `setNodeChoice`.
- `src/scenes/masteryChoicePanel.ts` — **new** presenter for the option chips.
- `src/scenes/PassiveGridScene.ts` — wire the panel; keep < 500 lines.
- `src/data/assetVersion.ts` — bump only if art/audio changes (none expected here).
- Tests: `tests/passiveChoice.test.ts`, additions to existing save/heroStats/passiveGrid tests.
```