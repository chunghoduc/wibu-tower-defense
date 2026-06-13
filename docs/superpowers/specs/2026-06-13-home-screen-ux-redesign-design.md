# Home Screen UX Redesign — Design Spec

**Date:** 2026-06-13
**Status:** Approved (full-auto session — designer self-approved)
**Scene:** `src/scenes/MainMenuScene.ts` (the throne-room home screen)

## Problem

The home screen "looks bad." Grounded in the live 960×540 render
(`/tmp/home_current.png`), the concrete failures are:

1. **Header collision / illegibility.** A 26px "WIBU TOWER DEFENSE" wordmark, the
   logo crest, and an *un-framed* gold counter all stack in the top-center and
   overlap on the busy stained-glass backdrop. Bright text on bright art = poor
   contrast; the wordmark visibly clips at the screen edges.
2. **Weak resource display.** Gold floats with no plate; **diamonds are not shown
   at all**, even though they're a real currency (`CurrencySave.diamonds`).
3. **Floating mid-screen CTA.** The "⚔ Set Squad" button sits over the diorama
   center with no anchor.
4. **Navigation = label soup with no hierarchy.** Twelve equal-weight buttons in a
   cramped 6×2 dock. The core action (**Battle**) carries the same visual weight
   as **Settings**. Long labels ("Activities", "Inventory", "Passives") crowd
   their cells; rows read as a wall of text.

The *good* parts — the painted throne-hall backdrop, the living atmosphere
(god-rays/embers/vignette), the hero+squad+pet diorama, the painted SDXL icons,
and the red notification badges — are keepers. This redesign is **layout +
hierarchy**, not an art regen.

## Goals

- Establish a clear three-band hierarchy: **Resources (top) → Hero diorama
  (center, focal) → Navigation (bottom)**.
- Make resources legible and complete: framed **gold + diamond** pills.
- Give the core loop a distinct, prominent **primary BATTLE call-to-action**,
  separated from the eleven secondary destinations.
- Tidy the secondary navigation: consistent tiles, more breathing room, larger
  touch targets, a soft row grouping (core-loop row vs meta row).
- Keep the diorama, atmosphere, painted icons, and badges unchanged.
- All new layout math is **pure and unit-tested**, matching the repo's
  established `menuLayout.ts` / `homeRoom.ts` convention (Phaser-free geometry +
  a thin Scene presenter).

Non-goals (YAGNI): no new SDXL art, no scene-graph re-architecture, no change to
the 12 destinations themselves, no settings/audio changes.

## Approach

Chosen of three considered:

- **A — Tweak in place** (nudge title down, add a gold plate): cheapest, but
  leaves the dock's no-hierarchy problem, which is the worst offender. Rejected.
- **B — Full bottom tab-bar restructure** (5 tabs + "More" overflow): most
  "modern", but hides destinations behind an overflow and is a large, risky
  rewrite of navigation semantics. Over-scoped. Rejected.
- **C — Structured three-band layout (CHOSEN).** Keep all 12 destinations
  visible, but introduce real hierarchy via a pure layout module: a top resource
  bar, a primary Battle CTA, and a cleaner secondary grid. High visual win, fits
  existing patterns, fully testable. **Selected.**

## Architecture

### New pure module: `src/scenes/homeLayout.ts` (Phaser-free, unit-tested)

Replaces/absorbs `menuLayout.ts`'s `dockLayout`. Exposes:

```ts
export interface Rect { x: number; y: number; w: number; h: number; }
export interface Pill extends Rect { /* rounded resource chip */ }

export interface TopBar {
  brand: { x: number; y: number };      // logo/wordmark anchor (top-left)
  gold: Pill;                            // top-right, outermost
  diamonds: Pill;                        // top-right, left of gold
}
export function homeTopBar(W: number, H: number): TopBar;

export interface NavCell { x: number; y: number; w: number; h: number; }
export interface NavLayout {
  panel: Rect;          // framed dock background
  primary: Rect;        // the wide BATTLE CTA (spans the dock width, top of dock)
  cells: NavCell[];     // the secondary destinations, row-major grid
  rowDivider?: number;  // y of the soft line between core-loop and meta rows
}
export function homeNavLayout(secondaryCount: number, W: number, H: number): NavLayout;
```

Geometry rules:
- **Pills**: fixed height (~26px), width grows with content but layout reserves a
  sensible max; anchored to the top-right with an inner margin; gold outermost,
  diamonds immediately to its left, equal gaps. Each pill is a rounded rect the
  presenter fills with a dark translucent plate + thin gold stroke for contrast.
- **Primary CTA**: a wide button rect across the dock interior, sitting as the top
  band of the dock panel — the unmistakable "PLAY" affordance.
- **Secondary grid**: the remaining **11** destinations laid row-major; keep a
  6-wide grid (rows of 6 then 5), centered, but with increased row gap and tile
  spacing vs the old dock. `rowDivider` marks the visual split between the
  core-loop row and the meta row.
- All cells provably sit inside `panel`; rows are monotonic top-to-bottom and
  left-to-right within a row (mirrors existing dockLayout invariants).

### Presenter changes: `MainMenuScene.ts`

- `drawHeader` → **`drawTopBar`**: draw the two framed resource pills (gold +
  diamonds) at `homeTopBar` positions with icon + value; keep the daily-login
  bonus toast, re-anchored to animate off the gold pill. Branding becomes a
  compact crest/wordmark at the top-left `brand` anchor (small, not the giant
  centered title) so it never collides with resources or clips at the edges.
- `drawMenu` → uses `homeNavLayout`: draw the framed dock panel, a **primary
  Battle button** (`drawPrimaryButton`, gold-accented, label "▶ BATTLE", routes
  to `StageSelectScene`), then the 11 secondary destinations via the existing
  `iconButton` over `nav.cells`. The soft `rowDivider` is a faint line.
- `MENU_ITEMS` splits into `PRIMARY` (Battle) + `SECONDARY` (the other 11). Keep
  every existing painted icon, label, badge, hover/press tween, and scene route.
- Re-anchor the "Set Squad" CTA / squad stand so it no longer floats over the
  hero (lower it / tie it to the diorama band). Hero stays the focal subject.

### Interaction & motion

Unchanged button feel: reuse `uiKit.interactive`/existing hover-scale + press
tweens + `fadeToScene`. The primary Battle button gets a slightly stronger
hover/press and a subtle idle pulse to read as the hero action.

## Data flow

`MainMenuScene.create()` reads the save (gold, diamonds, badges, squad) exactly
as today, then calls the pure `homeTopBar` / `homeNavLayout` to get geometry and
renders. No new persistent state; no save-version bump. Atmosphere, hangers,
pet, and squad code paths are untouched except the squad/CTA re-anchor.

## Error handling / fallbacks

- Missing `ui__logo` texture → text-only compact wordmark at the brand anchor
  (existing fallback pattern).
- Missing painted menu icon → existing `drawMenuGlyph` line-art fallback.
- Pills always render (gold/diamonds are always present numbers).

## Testing

Pure-module unit tests in `tests/homeLayout.test.ts` (TDD, written first):
- `homeTopBar`: gold pill is right of diamonds; both within top margin; pills do
  not overlap; both inside screen bounds.
- `homeNavLayout(11)`: exactly 11 cells; `primary` sits above all cells and
  within `panel`; every cell inside `panel`; rows monotonic (y increases between
  rows, x increases within a row); grid horizontally centered.
- Backward-compat: the existing `tests/menuLayout.test.ts` invariants are
  preserved or migrated to the new module (no silent loss of coverage).

Plus the standard gate: `tsc --noEmit`, full `vitest` suite, `vite build`, and a
headless playtest screenshot of the redesigned home screen for visual confirm.

## File-size discipline

`homeLayout.ts` stays a small focused module; `MainMenuScene.ts` must remain
under 500 code lines after the change (split a helper module if it approaches the
limit).
