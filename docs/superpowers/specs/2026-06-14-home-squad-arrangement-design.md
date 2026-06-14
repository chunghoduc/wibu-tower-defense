# Home-screen squad arrangement — design

Date: 2026-06-14
Status: approved (full-auto session)

## Problem

On the main-menu throne-room diorama (`MainMenuScene`), the selected squad of
towers is laid out by the pure helper `squadStandPoints(n, W, H)` in
`src/scenes/homeRoom.ts`. The current formula:

```ts
x = W * 0.16 + tt * W * 0.68   // tt = i/(n-1), span 0.16W .. 0.84W
y = H * 0.58 + Math.sin(tt * Math.PI) * -10
```

Two visible defects:

1. **Towers overlap the wall gear hangers.** The equipped-gear hangers
   (`hangerLayout`) hang in two vertical columns at `W*0.13` (left) and `W*0.87`
   (right), with ~34px icons, descending to `y = H*0.64`. The outermost squad
   members stand at `W*0.16` / `W*0.84` and are ~54px tall (half-width ~25px),
   so an edge tower's body (left edge ≈ `0.16W − 25`) reaches back into the
   hanger column (`0.13W + 17`). At 960×540 the leftmost tower spans x≈129..180
   while the left hanger column occupies x≈108..142 down to y≈345 — they collide.
2. **The lineup looks flat.** The arc amplitude is only ±10px and the center
   member sits *higher* (further back) than the edges, which reads as a flat,
   slightly-frowning row rather than a staged team formation.

## Goal

Rearrange the squad so:

- No squad member's footprint overlaps either wall hanger column, for any squad
  size 1..7.
- Members never overlap each other.
- The whole lineup stays clear of the bottom nav dock and clear of the hero.
- It reads as a proper staged formation: a gentle forward wedge (center members
  closest/lowest/largest, flank members further back/higher/smaller).

## Approach

Keep all geometry in the existing pure, unit-tested helper. No new module.

1. **Tighten the horizontal span** to clear the hanger columns. New span:
   `W*0.24 .. W*0.76` (centered, span `0.52W`). At 960px the leftmost center is
   230.4 (left edge ≈ 205) — comfortably clear of the left hanger column
   (right edge ≈ 142). Symmetric on the right.
2. **Deepen + flip the arc** so the formation is a forward wedge: center members
   sit *lower* (front), flanks *higher* (back). Use
   `y = H*0.555 + Math.sin(tt*π) * 14` (positive amplitude → center is lowest).
   Base raised slightly (0.58→0.555) so the deeper arc keeps feet well above the
   dock.
3. **Add a perspective scale** to each stand point so front (center) members are
   a touch larger than flank members — a subtle staged-depth cue. Center `1.0`,
   flanks `0.85`, lerped by distance from center. `StandPoint` gains a `scale`
   field; the presenter multiplies the base 54px height by it.
4. **Order render depth by closeness** so front members occlude back members
   cleanly when a large squad bunches up: depth `5 + scale` (range 5.85..6.0),
   staying below the pet (7) and dock (7/8).

`squadStandPoints` stays the single source of truth; the empty-squad "Set Squad"
CTA is untouched (it already sits centered at `H*0.58`, depth 6).

## Components / data flow

- `src/scenes/homeRoom.ts` — `StandPoint` gains `scale: number`;
  `squadStandPoints` returns the new x/y/scale. Pure, deterministic.
- `src/scenes/MainMenuScene.ts#drawSquad` — consumes `p.scale` for sprite scale
  and depth. No other behavior change.
- `tests/homeRoom.test.ts` — strengthened squad test (see below).

## Testing

Strengthen the existing `squadStandPoints` test to assert, for n in {1,2,4,7}
at 960×540:

- Each point's footprint (center ± a sprite half-width of 27px) stays clear of
  both hanger columns: `x − 27 > hangerLeftX + 17` and
  `x + 27 < hangerRightX − 17`, where `hangerLeftX/RightX` come from
  `hangerLayout`.
- Adjacent members do not overlap: `|x[i+1] − x[i]| >= 54` (sprite width).
- Every point stays above the bottom dock band (`y < H*0.62`) and below mid
  (`y > H*0.5`).
- `scale` is within `[0.85, 1.0]`; for odd n the center member has the max scale.

RED first (current formula fails the hanger-clearance assertion), then GREEN.

## Out of scope

- Hero, pet, hanger, dock, top-bar layout — unchanged.
- Empty-squad CTA — unchanged.
- No art regen (`ASSET_VERSION` not bumped).
