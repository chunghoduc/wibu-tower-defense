# Craft Wings — loaded icons + scroll fix

## Problem

In the Craft Wings dialog (`wingCraftDialog.ts`):

1. **Loaded gear shows a letter, not its icon.** When you tap a gear tile to load
   it into the machine, `renderLoaded()` draws a rarity-colored square with the
   first letter of the item's name (`(it.name[0]).toUpperCase()`). The tray below
   already shows real `item__<id>` icons, so the machine looks inconsistent and a
   player can't tell *which* item they loaded.
2. **Materials read as glyphs, not icons.** The jewel/feather sockets show a faint
   30px material image (0.5 alpha) behind a `◈n` / `✦` glyph. The glyph dominates;
   the real material art is barely visible.
3. **Tray scroll degrades after reopening the dialog.** `attachDragScroll()`
   registers global `scene.input` / `scene.events` listeners but returns no
   teardown — `wingCraftTray.destroy()` only destroys its containers. ForgeScene
   is a long-lived scene and the wing dialog is opened/closed repeatedly, so each
   reopen **stacks another set of scroll handlers** on the same scene. Stale
   handlers fire on later gestures (drawing into destroyed containers / fighting
   over the offset), so scrolling stops behaving normally.

## Goal

Every piece loaded into the machine — gear and the two materials — shows its real
icon, dual-coded with rarity color where applicable; and tray scrolling works the
same on the 1st and Nth open of the dialog.

## Design

### 1. Loaded gear icons (`wingCraftDialog.renderLoaded`)

For each loaded item, replace the letter chip with:

- a rarity-colored rounded backing (kept, slightly dimmed so the icon reads on top),
- a rarity-colored ring (dual-coding rarity without relying on the fill),
- the real icon via `makeFitIcon(scene, x, y, itemTex(it.defId), ~26, fallbackLetter)`
  — `makeFitIcon` already falls back to the first letter when the texture is
  missing, so the current behavior is preserved for art-less items,
- the existing tap-to-unload hit `zone` (unchanged).

Slot pitch stays 30 (`loadedSlotLayout`), icon fit ~24–26 so it sits inside the
backing. Pure layout (`loadedSlotLayout`) is untouched.

### 2. Material socket icons (`wingCraftDialog`)

Create the jewel and feather socket icons **once** as persistent `Image`s sized to
fill the socket (~34px), and update them in `renderSockets()`:

- icon at full alpha when that material is engaged (jewels > 0 / feather on),
  dimmed (~0.4) when not,
- the count badge keeps the *number/state* only (`n` for jewels, `✓`/`·` for
  feather) — drop the redundant `◈`/`✦` glyph now that the real icon is shown.
- Fallback: when the material texture is missing, keep showing the `◈`/`✦` glyph
  so the socket is never blank.

### 3. Scroll teardown (`scrollDrag.attachDragScroll`)

Give `attachDragScroll` a real teardown:

- Name the four `scene.input` handlers and the two `scene.events.once` handlers so
  they can be removed.
- Return `{ didScroll, destroy }`; `destroy()` calls `stopFling()` and removes every
  registered `scene.input` / `scene.events` listener.
- `wingCraftTray` stores the handle and calls `scroll.destroy()` in `tray.destroy()`.

This is the actual fix for "scroll works normally" — it stops handler stacking
across reopens. Other call sites (Inventory/Collection/Shop) keep working: they
simply ignore the new `destroy` (their scrolls live for the scene's lifetime), and
`DragScrollHandle` gains an **optional** method so no existing caller breaks.

## Non-goals

- No change to craft mechanics, odds, materials, save shape, or art assets.
- No change to pure tray/machine math (`wingTray.ts`, `wingCraftMachine.ts`).
- No `ASSET_VERSION` bump (no regenerated art).

## Testing

- **Unit (TDD):** `attachDragScroll` teardown — a fake-emitter scene records
  `input.on`/`events.on` registrations; after `destroy()`, emitting `pointerdown`
  + `pointermove` no longer changes the offset, and all listeners are removed.
  Existing `dragOffset`/`offsetFromPixels` tests stay green.
- **Manual (CDP):** open the Forge → Craft Wings, Auto-fill, screenshot — loaded
  gear shows real icons; jewel/feather sockets show real material icons. Reopen
  the dialog several times and confirm tray drag-scroll still tracks 1:1.

## Risks

- `wingCraftDialog.ts` is ~380 lines; the icon changes are net-neutral in size —
  stays well under the 500-line cap.
- Persistent material `Image`s must be parented to the dialog container so they're
  destroyed with it (no leak); verified by reusing `c.add(...)`.
