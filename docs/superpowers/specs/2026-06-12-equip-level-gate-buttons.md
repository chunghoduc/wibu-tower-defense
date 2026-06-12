# Spec — Level-gated Replace / Equip buttons

**Date:** 2026-06-12
**Status:** Approved (full-auto, self-approved)

## Problem

The inventory's **Replace** button (side-by-side compare dialog) and **Equip**
button (enhance dialog, when a slot is free) currently _always_ look enabled.
When the hero's level is below the item's required level, clicking them silently
fails and only fires a transient toast (`Requires level N`). The player gets no
_advance_ signal that the action is unavailable — they have to click and read a
toast that vanishes in 1.6s.

## Goal

A zero-gameplay-change UX fix:

1. **Disable** the Replace / Equip button when `heroLevel < item.requiredLevel`
   — greyed background, reduced opacity, a small 🔒 marker, no click handler.
2. **Hover** the (disabled) button shows the requirement inline:
   `Requires level N · you are M`. The hint appears on `pointerover`, hides on
   `pointerout`.
3. When the level _is_ met, the buttons behave exactly as today (full colour,
   clickable, replace/equip on tap).

Out of scope: the **Enhance** button (gated on jewels, not level — unchanged),
drag-to-equip on the paper-doll (keeps its toast — no button to gate there), and
any change to the underlying `equipItem` rule.

## Design

### 1. Pure gate — `src/data/equipGate.ts`

A tiny Phaser-free helper so the decision is unit-testable:

```ts
export interface EquipLevelGate {
  met: boolean; // heroLevel >= reqLevel
  reqLevel: number;
  heroLevel: number;
  hint: string; // "" when met, else "Requires level N · you are M"
}
export function equipLevelGate(heroLevel: number, reqLevel: number): EquipLevelGate;
```

Mirrors the existing `equipItem` rule (`save.hero.level < instanceReqLevel(...)`).
Call sites resolve `reqLevel` via the existing `instanceReqLevel(inst, def)`.

### 2. Presenter — `src/scenes/gatedButton.ts`

One shared helper so both dialogs render the gate identically (DRY) and stay
small:

```ts
export function addGatedButton(
  scene,
  container,
  opts: {
    x: number;
    y: number;
    label: string;
    bg: string; // background when enabled
    color?: string; // text colour when enabled (default #fff)
    gate: EquipLevelGate;
    onClick: () => void; // wired only when gate.met
  },
): void;
```

- **Met:** crisp text button, `bg` colour, `useHandCursor`, `pointerup → onClick`.
- **Unmet:** label gets a ` 🔒` suffix, background `#3a3f48`, alpha `0.55`, **no**
  `pointerup`. It is still `setInteractive` so it can receive hover events; on
  `pointerover` a hint label (created hidden, positioned just under the button,
  centered) is shown; `pointerout` hides it. No click handler → tapping a
  disabled button is a no-op (it also shields the scrim, so the dialog stays
  open, which is the desired behaviour).

Both states keep the existing button geometry (`setOrigin(0.5,0)`, padding
`14,8,14,8`) so the layout is unchanged.

### 3. Wiring

- **`itemCompareDialog.ts`** — add a `heroLevel: number` parameter to
  `renderCompareDialog`. Build the Replace button via `addGatedButton` with
  `gate = equipLevelGate(heroLevel, instanceReqLevel(bag.inst, bag.def))`,
  `bg = "#1565c0"`. Enhance button is untouched (always enabled).
- **`itemEnhanceDialog.ts`** — the Equip button (only rendered when
  `cb.onEquip`) becomes `addGatedButton` with
  `gate = equipLevelGate(save.hero.level, instanceReqLevel(inst, def))`,
  `bg = "#2e7d32"`.
- **`HeroScene.ts`** — `openCompare` passes `this.mgr.getSave().hero.level` to
  `renderCompareDialog`. The existing `onReplace`/`onEquip` failure toasts stay
  as a belt-and-suspenders fallback (they simply won't fire anymore because the
  click handler is absent when unmet).

## Testing

- **Unit (`tests/equipGate.test.ts`):** `equipLevelGate` — met when
  `heroLevel >= reqLevel` (incl. equal), unmet below, `hint` empty when met and
  formatted `Requires level N · you are M` when unmet; `met` boolean drives.
- **Existing suite:** `tests/item-compare.test.ts` stays green (data layer
  unchanged). The new `heroLevel` param is additive at the presenter boundary.
- **Playtest (CDP):** force the compare dialog with a bag item whose
  `requiredLevel` exceeds the hero's level → assert the Replace button is greyed
  / non-interactive and the hover hint text exists; then with a met level →
  assert it's the blue interactive button. Screenshot.

## Risks

- Headless rendering: `addGatedButton` uses only `crispText` + container adds —
  no texture dependency, so it's headless-safe (same as the rest of the dialog).
- The compare dialog signature changes (new required `heroLevel` param). Only one
  caller (`HeroScene.openCompare`) — updated in lockstep. Tests call the pure
  `compareItems`, not the presenter, so they're unaffected.
