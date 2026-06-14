# Wing Craft drag closes the dialog — fix design

**Date:** 2026-06-14
**Type:** Bug fix (systematic-debugging workflow)

## Symptom

In the Forge → Craft Wings machine, dragging a material (Jewel of Chaos / Feather)
or an item onto the central machine drop-zone tore the whole dialog down. The UI
auto-closed before the player could finish loading the inputs, so crafting wings
was effectively impossible on touch.

## Root cause

`openWingCraftDialog` lays a full-screen **dim zone** behind the panel whose
`pointerup` unconditionally calls `opts.onClose()` (a tap-outside-to-dismiss).

Phaser's `InputPlugin.update` processes a pointer release as
`processDragUpEvent` (fires `dragend`) **then** `processUpEvents` (fires
`pointerup` on the top-most object under the released pointer) in the *same* input
frame. On touch the release routes that `pointerup` to the full-screen dim zone,
so the tail of a tile drag is misread as "tapped outside → close." The drop math
and gating were fine; only the tap-out was over-eager.

(Confirmed by reading `node_modules/phaser/src/input/InputPlugin.js` and by a CDP
repro that reproduces the engine's `dragend → dim pointerup` routing —
`scripts/playtest/repro_wing_drag.mjs`. Real synthetic touch input does not reach
the game in this headless Chrome build, so the repro drives the proven
event-routing order directly.)

## Fix

Guard the dim-zone tap-out against drag releases:

- Track a `dragging` flag: set on scene `dragstart`, cleared one tick after
  `dragend` (via `scene.time.delayedCall(0, …)`) so it still covers the
  same-frame release `pointerup`; a fresh `pointerdown` also resets it as a
  safety net against a cancelled drag leaving the flag stuck.
- The dim-zone `pointerup` now closes only when `!dragging`.
- While here, the previously-leaking scene-level `input.on("drag", …)` listener
  (and the new drag-tracking listeners) are removed on container `destroy`, so
  re-opening the machine no longer stacks duplicate handlers.

## Verification

- `scripts/playtest/repro_wing_drag.mjs`: RED before (drag tail → onClose), GREEN
  after (A: genuine tap-out closes; B: drag release does **not**).
- `tsc --noEmit` clean · `vitest run` 1328/1328 · `eslint` clean · `vite build`
  clean.

## Scope

Touches only `src/scenes/wingCraftDialog.ts`. Same dim-tap-out + draggable-tiles
pattern could exist in other drag dialogs; not in scope for this report.
