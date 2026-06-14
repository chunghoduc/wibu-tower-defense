# Wing-Craft Result Reveal — Design Spec

**Date:** 2026-06-14
**Status:** Approved (full-auto session)

## Problem

Crafting Wings (Forge → Craft Wings) consumes 5+ sacrificed gear, a Feather, and
1–4 Jewels of Chaos for a *chance* at a random-rarity pair of skywings. The stake
is high, but the payoff is invisible: today the `ForgeScene` confirm handler plays
a particle burst (`playForgeFx`) and shows a single one-line toast
("✦ Forged …!" / "The wings dissolved into chaos…"), then rebuilds. The player
never sees **what they got** — the wing, its rarity, or its stats — nor gets a
satisfying failure beat. The reveal is the emotional core of a gambling sink and
it is missing.

## Goal

After a craft resolves, show a **result reveal overlay**:

- **Success** — a celebratory reveal of the minted wing: rarity-tinted glow,
  burst, the wing icon, its auto-fit name, a rarity badge, and its rolled stat
  lines.
- **Failure** — a deflating-but-clear "dissolved into chaos" beat so the loss
  reads as intentional, not a bug.

## Non-Goals

- **No mechanic change.** `core/wingCraft.ts` (odds, consumption, rarity bias,
  rolled stats) is untouched. This is presentation only.
- **No new art.** Reuse the existing 5-tier skywings icons + procedural Graphics
  FX. No SDXL regen, no `ASSET_VERSION` bump.
- **No save / schema change.** Pure read of the already-returned
  `CraftWingsResult`.
- **Not a rework of the craft dialog** (`wingCraftDialog.ts` / `wingCraftTray`).
  Only the post-confirm result is added.

## Architecture

Two new units, mirroring the established pure-logic + thin-presenter split and the
existing `SummonResultOverlay` reveal pattern.

### 1. `src/core/wingCraftResultView.ts` (pure, Phaser-free, tested)

Turns a `CraftWingsResult` into a render-ready, discriminated view model. No
Phaser, no scene — just data, so it can be unit-tested.

```ts
export type WingCraftResultVM =
  | {
      kind: "success";
      name: string;          // wing display name (catalog) or "Wings" fallback
      rarity: Rarity;
      color: number;         // rarity accent (hex int), via rewardIcon/RARITY_INT
      iconKey: string;       // "" when no texture
      emoji: string;         // fallback glyph
      statRows: ItemStatRow[]; // from itemDisplay.itemStatRows(item, def)
    }
  | { kind: "failure" };

export function wingCraftResultView(result: CraftWingsResult): WingCraftResultVM;
```

- Resolves the item def via `ITEM_CATALOG_MAP`, the icon via
  `itemInstanceIcon(item)` (`rewardIcon.ts`), and stat rows via
  `itemStatRows(item, def)` (`itemDisplay.ts`) — all existing single-source
  helpers, so the reveal agrees with tooltips/inventory.
- Treats `ok && success && item && def present` as the only success path;
  everything else (rolled failure, or a defensive missing-item/def) collapses to
  `{ kind: "failure" }`. (Validation failures — `!ok` — never reach the overlay;
  `ForgeScene` keeps its existing pre-check toast for those.)

### 2. `src/scenes/wingCraftResultOverlay.ts` (presenter, < 500 lines)

`openWingCraftResultOverlay(scene, vm, onDone)` — a self-contained modal container
at a depth above the forge FX (≥ 380), reusing `uiKit` scaffolding so it matches
every other dialog.

**Shared:** full-screen `dimBackdrop`; a centered card via `accentPanel` tinted by
the result accent; a Claim/Close `button` that fades in after the reveal settles
and runs `closeModal` → `onDone`.

**Success layout:**
- Pulsing rarity-colored radial glow + slow rotating light rays behind the card
  (ADD blend), echoing `SummonResultOverlay.buildBackdrop`.
- A one-shot open burst (white flash + sparkle scatter) on mount.
- Wing icon via `makeFitIcon` (texture or emoji fallback), `popIn`-scaled.
- Auto-fit name via `addNamePlate` (rarity accent) so long names never spill.
- A small rarity badge/label under the name.
- Stat lines: render `statRows` (`before` + colored `value` + `after`, using the
  existing `SOURCE_COLOR`/`QUALITY_COLOR`) as a left-aligned list inside the card.

**Failure layout:**
- Muted/ashen accent (grey), no celebratory glow; a soft downward ash drift.
- A broken-wing / "💔"-style glyph + the line "The wings dissolved into chaos…"
  and a sub-line noting the materials were consumed.

### 3. Wiring — `src/scenes/ForgeScene.ts` confirm handler

After `playForgeFx(...)` (kept as the lead-in burst), build the VM and open the
overlay instead of the bare success/failure toast; `rebuild()` moves into the
overlay's `onDone` so the inventory refreshes when the player dismisses the
reveal. The pre-validation `!r.ok` toast ("Craft failed — check materials.")
stays as-is. `dialog.destroy()` still fires before the overlay opens.

## Data Flow

```
ForgeScene.confirm
  └─ mgr.craftWings(ids, jewels) ─→ CraftWingsResult
       ├─ !ok            → existing toast (unchanged)
       └─ ok             → playForgeFx(lead-in)
                            → vm = wingCraftResultView(result)   [pure]
                            → openWingCraftResultOverlay(scene, vm, onDone=rebuild)
```

## Error Handling

- Missing catalog def or missing item on a "success" result → VM degrades to
  `failure` (never throws, never renders a blank card).
- Empty `statRows` still renders a valid card (name + badge only).
- Overlay is idempotent on close (`closeModal` guards double-dismiss), consistent
  with other modals.

## Testing

Pure module (`tests/wing-craft-result-view.test.ts`), TDD:
1. A successful result yields `kind:"success"` with the wing's catalog name,
   rarity, a non-`undefined` color, and non-empty `statRows`.
2. A rolled-failure result (`ok:true, success:false`) yields `kind:"failure"`.
3. A defensive malformed success (`success:true` but no `item`) yields
   `kind:"failure"` (no throw).
4. Color/icon agree with `itemInstanceIcon` for the same item (single-source
   guard).

Presenter is verified by build + live playtest (open Forge → Craft Wings → craft,
observe success and failure reveals), per house practice for Phaser presenters.

Full verify: `npx vitest run`, `npm run build`, `npm run lint`, `npm run
lint:cycles`.

## Risks

- **File size:** the overlay must stay < 500 code lines (ESLint hard error). If it
  approaches the limit, extract the backdrop/burst FX primitives into a sibling
  (e.g. `wingCraftResultFx.ts`) — same pattern as other split presenters.
- **Depth collision:** forge FX render at depth 360; the overlay sits at ≥ 380 so
  the reveal is never occluded by lingering particles.
