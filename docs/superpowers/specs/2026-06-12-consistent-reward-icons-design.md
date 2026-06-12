# Consistent item / reward icons across every screen — Design

## Problem

The player reports that item icons look inconsistent from screen to screen — "loot,
inventory, spin in activity, etc." The same reward should look the same wherever it
appears.

## Audit (what's actually inconsistent)

I mapped every surface that draws an equipment-item or reward icon. The findings:

- **Equipment item icons are already consistent.** Inventory, shop cards, the compare
  dialog, the post-battle reward panel, loot-fly, box-reveal, wall hangers, and the worn
  hero overlay all resolve to the `item__<defId>` texture and render it through the shared
  `makeFitIcon` / `iconFitScale` sizing helper in `src/scenes/itemIcon.ts`. Sizes differ
  per surface (22 px on a loot-fly, 72 px on a shop card), but that is intentional,
  context-appropriate scaling of the _same_ artwork — not an inconsistency to fix.
- **The wing `appearanceRef` "divergence" is a non-issue.** Both wing items
  (`fledgling-wings`, `tempest-wings`) set `appearanceRef` to their own `item__<id>` key,
  so the worn path (`appearanceRef ?? item__<id>`) and the raw inventory path resolve to
  the identical texture. No visible difference today.
- **The real inconsistency is the Lucky Spin (Activities → F4).** The spin reel
  (`src/scenes/spinReel.ts`) renders each prize cell with a hand-picked **emoji glyph**
  (`prizeGlyph`: 🪙 💎 💠 🔷 📜 🔹 ✨) instead of the real texture. Every _other_ loot
  surface — the post-battle reward panel, the jewel picker, the box-reveal — renders the
  actual `material__<id>` / `icon__gold` / `icon__gem` artwork for those very same prizes.
  So a "Jewel of Soul" shows real jewel art when it drops in battle, but a flat 🔷 emoji
  when it's won on the wheel. That is the screen-to-screen mismatch the player is seeing.

The textures the spin needs already exist and are preloaded: `material__<id>` for every
non-box material (`PreloadScene` line 64, driven by `MATERIAL_ICON_IDS`), and
`icon__gold` / `icon__gem` from the UI manifest. The spin simply isn't using them.

## Goal

Make the Lucky Spin reel render the **same icon** for a prize that the rest of the game
already renders for that reward — falling back to an emoji glyph only when a texture is
genuinely missing. Do this by introducing **one** shared reward→icon resolver so the spin
and the post-battle panel can never disagree again.

## Non-goals (YAGNI)

- No change to equipment-item rendering (already consistent).
- No `itemIconKey(def)` wing helper — there is no visible wing divergence to fix.
- No re-sizing or re-framing of the existing per-surface icon boxes; their sizes are
  deliberately context-specific.
- The reward-burst **particle shower** (`rewardBurst`) keeps flinging emoji confetti —
  that is decorative celebration VFX, not an icon panel, and is thematically fine.
- No change to gameplay, drop rates, save data, or art assets.

## Design

Two units: one pure data resolver (the single source of truth), one render-glue edit.

### Unit 1 — `src/data/rewardIcon.ts` (pure, Phaser-free, tested)

The single source of truth for "what icon represents this reward". Today the per-kind
`{iconKey, emoji, color}` triples are inlined inside the tile builders in
`src/data/rewardTiles.ts`. Extract those triples into small pure functions here so both
the reward panel and the spin consume the _same_ mapping and can never drift:

```ts
export interface RewardIconView {
  iconKey: string;
  emoji: string;
  color: number;
}

export function goldIcon(): RewardIconView;
export function diamondIcon(): RewardIconView;
export function xpIcon(): RewardIconView;
export function materialIcon(id: string): RewardIconView; // box → box__<id> + rarity color; else material__<id> + MAT_INT
export function itemIcon(rarity: Rarity, defId: string): RewardIconView;
export function jewelIcon(rarity: Rarity, defId: string): RewardIconView;

/**
 * The single most salient icon for a reward bundle, for callers that show ONE
 * icon (the spin reel cell, a one-line toast). Priority: rarest material/box >
 * diamonds > gold. Returns a sparkle fallback for an empty bundle.
 */
export function rewardPrimaryIcon(reward: Reward): RewardIconView;
```

`rewardPrimaryIcon` mirrors how the reward panel would render the bundle: for a
`materials` map it picks the rarest entry (boxes are rarity-tiered; other materials fall
back to the material accent), so the wheel's headline prize gets the headline icon.

The rarity-color constants (`RARITY_INT`, `GOLD_INT`, `DIAMOND_INT`, `XP_INT`, `MAT_INT`)
move here (or stay in `rewardTiles` and are imported — whichever keeps both files under the
500-line limit and avoids a cycle). `rewardTiles.ts` is refactored to call these helpers
for its icon fields, keeping its own tooltip/label logic. This makes "single source of
truth" literal and is covered by the existing `rewardTiles` tests plus new `rewardIcon`
tests.

### Unit 2 — `src/scenes/spinReel.ts` (render glue)

In `buildCell`, replace the emoji-only glyph with the resolved texture:

- `const view = rewardPrimaryIcon(prize.reward);`
- Render the icon via `makeFitIcon(scene, 0, -14, view.iconKey, 56, view.emoji)` — this
  draws the real texture when loaded and falls back to `view.emoji` when not, exactly like
  every other loot surface.
- Cell accent: keep the existing **rare → magenta** override, but for non-rare prizes use
  `view.color` instead of the old ad-hoc `cellAccent` switch, so the cell frame matches the
  reward's real rarity/category color.

`prizeGlyph` and the color half of `cellAccent` are deleted (replaced by the shared
resolver). The reel's scroll/jitter/reveal choreography is untouched.

## Data flow

```
SpinPrize.reward ─► rewardPrimaryIcon() ─► { iconKey, emoji, color }
                                              │
                          makeFitIcon(iconKey, fallback=emoji)  ─► real texture or emoji
                                              │
                                       cell frame color = rare ? magenta : color
```

The post-battle panel flows through the same per-kind helpers, guaranteeing the wheel and
the panel show identical artwork for identical rewards.

## Edge cases

- **Missing texture** → `makeFitIcon` already renders the emoji fallback at 60% size. The
  spin degrades to today's behavior for any un-arted reward; nothing breaks.
- **Empty / unknown reward** → `rewardPrimaryIcon` returns a sparkle (`✨`) view.
- **Box prizes** → the live `SPIN_WHEEL` awards no boxes, but `rewardPrimaryIcon` handles
  `kind === "box"` (→ `box__<id>` + rarity color) so future wheel entries are covered.

## Testing (TDD)

`tests/rewardIcon.test.ts` (pure, no Phaser):

- `goldIcon`/`diamondIcon`/`xpIcon` return the documented `icon__*` keys + colors.
- `materialIcon("soul-jewel")` → `material__soul-jewel`; a box id → `box__<id>` with its
  rarity color.
- `rewardPrimaryIcon({ gold: n })` → gold view; `{ diamonds: n }` → gem view;
  `{ materials: { "soul-jewel": 1 } }` → the soul-jewel material view; a multi-material
  bundle picks the rarest; `{}` → the sparkle fallback.
- **Cross-check (the anti-drift guard):** for every `SPIN_WHEEL` prize,
  `rewardPrimaryIcon(prize.reward).iconKey` equals the `iconKey` the reward panel
  (`battleLootTiles` / the per-kind tile builder) would produce for that same reward — so
  the spin and the panel are proven to agree.

Existing `tests/rewardTiles.test.ts` must stay green after the refactor (the panel's
output is unchanged). Final: `tsc --noEmit`, full `vitest`, `npm run build`, and a CDP
playtest of the Activities spin to eyeball the real icons on the reel.

## Files

- **New:** `src/data/rewardIcon.ts`, `tests/rewardIcon.test.ts`
- **Edit:** `src/data/rewardTiles.ts` (consume the shared helpers), `src/scenes/spinReel.ts`
  (render real icons)
- Both touched source files stay well under the 500-line limit.

## Risks

- Refactoring the shipped `rewardTiles.ts` could regress the post-battle panel. Mitigated
  by extracting only the icon triple (not tooltips/labels) and keeping
  `tests/rewardTiles.test.ts` green.
- Spin-cell layout: a 56 px icon must sit cleanly above the label in the 132×104 cell.
  Verified visually in the playtest step.
