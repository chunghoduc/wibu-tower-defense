# Rename the smelt material: "Jewel of Chaos" → "Jewel of Entropy"

**Date:** 2026-06-13
**Status:** Approved (full-auto self-approval)

## Goal

Free up the player-facing name **"Jewel of Chaos"** for a future feature. The
material that gear smelts into (and that Reforge spends) is renamed to
**"Jewel of Entropy"** (short label **"Entropy"**). Nothing about the mechanic
changes — only what players read.

## Why "Entropy"

Entropy (disorder / heat-death) fits both halves of the material's role:

- It is _smelted_ from gear (heat, melting).
- It _re-rolls all affixes at once_ (randomness, disorder).

It also preserves the existing "Jewel of \_\_\_" convention (Bless / Soul /
Entropy) and is unmistakably distinct from the soon-to-be-reused "Chaos".

## Hard constraint: no save migration, no art regen

The internal id `chaos-jewel` is a **save key** — every existing player holds a
stack under `save.materials["chaos-jewel"]`. Renaming the id would orphan those
materials. Therefore the rename is **display-only**:

| Layer                                   | Action     |
| --------------------------------------- | ---------- |
| Save id `"chaos-jewel"`                  | **unchanged** |
| Constant `CHAOS_JEWEL`                   | **unchanged** |
| Icon key `icon: "chaos"` + crimson art  | **unchanged** |
| Numeric field `chaos` (smelt/reforge)   | **unchanged** |
| Display `name` + all player-visible text | **renamed → Entropy** |

Because no art changes, **`ASSET_VERSION` is NOT bumped**.

## Player-facing strings to change

All occurrences of the words "Jewel of Chaos" / "Chaos" (the material) that a
player can read become "Jewel of Entropy" / "Entropy":

1. **`src/data/materials.ts`** — `name: "Jewel of Chaos"` → `"Jewel of Entropy"`.
   (The `description` text contains no "chaos" word; left as-is.)
2. **`src/scenes/ShopScene.ts`** — every flash / label with the literal word
   "Chaos":
   - `Recycled N items → ❖ C Chaos` → `… Entropy`
   - `🔨 Smelt → ❖ C Chaos` → `… Entropy`
   - `Smelted → ❖ C Chaos` → `… Entropy`
   - `Not enough gold or chaos` → `Not enough gold or entropy`
   - Header doc-comment + the `CHAOS_COL` comment that name "Jewel of Chaos"
     (accuracy only).
   - The `❖ ${chaos}` counters with NO trailing word are untouched (they show a
     number, not the name).
3. **`src/scenes/autoRecycleDialog.ts`** — preview line
   `Smelt N items → ❖ C Chaos` → `… Entropy`.
4. **`src/core/smelt.ts`, `src/core/reforge.ts`** — doc-comments that name
   "Jewel of Chaos" updated to "Jewel of Entropy" (comments only; no logic).

## What stays exactly the same

- The id, constant, icon key, crimson icon art, and the `chaos` numeric field.
- All smelt yields, reforge costs, the closed gear→material→reforge loop.
- Every test that imports `CHAOS_JEWEL` or reads a `.chaos` field — those use
  the unchanged identifiers, so no existing test breaks.

## Testing

No existing test asserts the display string "Jewel of Chaos", so the rename
breaks nothing. Add one guard test (in a new `tests/materialName.test.ts`) that
pins the intent:

- `MATERIALS_MAP.get(CHAOS_JEWEL)!.name` === `"Jewel of Entropy"`.
- No material in `MATERIALS` is named `"Jewel of Chaos"` — i.e. the name is now
  free for the future feature.

(TDD: write this test first; it fails RED against the current "Jewel of Chaos"
name, then GREEN after the `materials.ts` edit.)

## Verification

- `tsc --noEmit` clean.
- Full vitest suite green (existing + new guard).
- `eslint` clean on touched files.
- Grep proof: zero player-facing "Jewel of Chaos" / " Chaos" material strings
  remain in `src/` (only the unchanged `chaos-jewel` id / `CHAOS_JEWEL` /
  `chaos` field identifiers).

## Out of scope

- The future "Jewel of Chaos" feature itself — this only vacates the name.
- Renaming code identifiers or the save id (deliberately avoided to skip a
  migration).
- Any art change.
