# Achievement icon restyle — match the house icon style

**Date:** 2026-06-14
**Status:** Approved (full-auto self-approval)
**Type:** Art-prompt restyle + regeneration (no mechanic/data/render change)

## Problem

The 20 achievement icons (board badges in `AchievementScene`) are rendered in a
**flat "trophy-medal clipart" style** — `ACHIEVEMENT_STYLE` asks SDXL for "a
single ornate circular achievement trophy medal badge … thick beveled polished
metal rim with a small ribbon tab at the top … flat cel-shaded game UI icon".
The result reads like generic Olympic-medal sticker art and looks out of place
next to the rest of the game, whose icons are **painted cel-shaded anime game
assets** (items, characters, skills, structures all share the `ITEM_STYLE`
"clean cel-shaded anime game asset, soft rim light" house look).

The user asked to "redesign the achievement icon to follow all other icons
style using the SDXL flow."

## Goal

Make the achievement icons look like they belong to the same game as every other
icon: painted, sculpted, cel-shaded anime award objects — not flat UI stickers —
while preserving everything that already works (per-achievement motif, the
bronze→silver→gold tier-metal prestige signal, the untinted 64px board render).

## Approach (chosen)

**Prompt-only restyle of the achievement SDXL wrapper + regenerate the 20 PNGs.**
Nothing in the runtime changes.

### What changes

1. **`scripts/sdart/prompts.mjs` — `ACHIEVEMENT_STYLE`**
   Rewrite the wrapper from the flat-UI-badge language to the house
   game-asset language, mirroring `ITEM_STYLE`:
   - Drop: "circular … trophy medal badge", "thick beveled polished metal rim
     with a small ribbon tab", "flat cel-shaded game UI icon", "instantly
     readable at small size".
   - Adopt: "ornate cel-shaded anime game trophy/medallion award icon",
     "sculpted metallic relief with depth", "glossy highlights", "soft rim
     light", "clean cel-shaded anime game asset", "isolated on a plain solid
     light grey background" (matches `ITEM_STYLE`'s background).
   - Keep: `{V}` substitution, centered, no text/numbers.

2. **`scripts/sdart/prompts.mjs` — `ACHIEVEMENT_NEG`**
   Add the anti-flat-clipart pushers ("flat sticker, flat clipart, flat icon,
   2d vector, ribbon, lanyard"), keep the existing structural negatives
   (character/person, multiple medals, background scenery, text, frame).

3. **`ACHIEVEMENT_VISUAL` (the 20 per-achievement motif strings)**
   Light touch only: the strings already describe good motifs + tier metals
   ("a bronze medal embossed with a single blood-dripping dagger crossing a
   small round shield"). They stay semantically identical; we only soften
   "embossed" toward "sculpted in relief on" where it reinforces the painted
   look. **The keys (achievement ids) do not change** — the drift-guard test
   (`tests/achievementIconPrompts.test.ts`) must keep passing untouched.

4. **Regenerate art**: `npm run gen:sprites -- --only achievement --force`
   → 20 PNGs in `public/assets/sprites/achievement/` (768×768 → transparent-cut
   to 128px, exactly as today).

5. **Bump `ASSET_VERSION`** (`2026-06-14i` → `2026-06-14j`) — generated art was
   regenerated, so the cache-busting stamp must change (per the asset
   cache-busting rule).

### What does NOT change

- `AchievementScene.ts` rendering (still 64px, left of card, **no tint**,
  dimmed when locked).
- `achievementTex` / `assetKeys.ts` (keys stay `achievement__<id>`).
- `src/data/achievements.ts` catalog, rewards, progress tracking.
- The medallion CONCEPT (trophies/medals remain the visual language for
  achievements — only the rendering style is upgraded from flat to painted).
- `prompts.d.mts` — no exported symbol names change.

## Why this approach (alternatives rejected)

- **A. Restyle to the painted game-asset / ITEM look (CHOSEN).** Achievements
  render at 64px on a list card — the same context an item icon lives in. The
  house look there is the cel-shaded painted asset. Keeps the prestige tier
  metals and motifs; smallest possible surface (two prompt strings + regen).
- **B. Restyle to the flat-vector UI-emblem look (role icons / rarity gems).**
  Those are deliberately minimal 16px in-battle/on-card glyphs. At 64px on a
  board they'd look under-detailed, and the bronze/silver/gold prestige signal
  would flatten away. Rejected — wrong sibling family.
- **C. Drop medals entirely, draw bespoke per-achievement objects.** More art
  churn, loses the at-a-glance "this is an award" read, and discards the
  working tier-metal prestige ladder. Rejected — over-scoped (YAGNI).

## Testing

- **New guard test** (TDD RED→GREEN): assert `achievementIconStyle(v)` output
  contains the house markers (`cel-shaded anime game asset`, `soft rim light`)
  and is FREE of the flat-clipart markers (`flat cel-shaded game UI icon`,
  `trophy medal badge`, `ribbon tab`). This fails against the current style
  (RED) and passes after the rewrite (GREEN). It locks the restyle so the icons
  can't silently drift back to flat clipart.
- Existing `tests/achievementIconPrompts.test.ts` (one-emblem-per-id, distinct,
  key namespacing) must keep passing unchanged.
- `npx tsc --noEmit` + full `npm test` + `npm run build` green.
- **Visual proof**: regenerate, then a CDP/montage check that the 20 textures
  load in `AchievementScene` (reuse `scripts/playtest/repro_achievement_icons.mjs`
  if it still applies, else a quick contact-sheet of the 20 PNGs sent to chat).

## Deliverables / done criteria

- Two prompt strings rewritten; 20 motif strings lightly aligned (keys intact).
- 20 regenerated PNGs committed.
- `ASSET_VERSION` bumped.
- New + existing tests green; build green.
- Contact sheet of the new icons sent to chat for visual confirmation.
- Pushed and deployed (live cache-bust via the new ASSET_VERSION).
