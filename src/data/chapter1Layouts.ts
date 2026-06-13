/**
 * Chapter 1 — "Greywood Pass" — the ten redesigned, Kingdom-Rush-inspired map
 * layouts. Path complexity ramps monotonically: single-lane tutorials (1–2), a
 * first split (3), two-front lanes (4–9), and a three-entrance finale (10). Every
 * `lanes` entry is a complete edge→keep polyline; multi-lane stages share a tail
 * chokepoint before the keep. `path` is derived from `lanes[0]` by the stage
 * builder, so the keep / castlePos stay correct. Authored at 960×540 (scaled to
 * the world by stage.ts). Lives apart from stage.ts to respect the 500-line cap
 * (mirrors stagesExpansion.ts). See
 * docs/superpowers/specs/2026-06-13-chapter1-branching-maps-design.md.
 */
import type { Layout } from "./stage.ts";

export const CH1_LAYOUTS: Layout[] = [
  // 1 — Greywood Trailhead — single sinuous S, gentle switchbacks (tutorial).
  {
    name: "Greywood Trailhead",
    path: [
      { x: -20, y: 140 },
      { x: 230, y: 140 },
      { x: 230, y: 300 },
      { x: 430, y: 300 },
      { x: 430, y: 150 },
      { x: 640, y: 150 },
      { x: 640, y: 400 },
      { x: 780, y: 400 },
      { x: 780, y: 300 },
      { x: 920, y: 300 },
    ],
    air: [
      { x: -20, y: 70 },
      { x: -20, y: 470 },
    ],
    slots: [
      { x: 330, y: 220 },
      { x: 540, y: 230 },
      { x: 540, y: 380 },
      { x: 700, y: 280 },
      { x: 160, y: 240 },
      { x: 860, y: 200 },
    ],
  },
  // 2 — Switchback Gully — tighter serpentine, narrow build pockets (single).
  {
    name: "Switchback Gully",
    path: [
      { x: -20, y: 80 },
      { x: 720, y: 80 },
      { x: 720, y: 180 },
      { x: 160, y: 180 },
      { x: 160, y: 290 },
      { x: 740, y: 290 },
      { x: 740, y: 400 },
      { x: 360, y: 400 },
      { x: 360, y: 470 },
      { x: 920, y: 470 },
    ],
    air: [
      { x: -20, y: 260 },
      { x: -20, y: 500 },
    ],
    slots: [
      { x: 400, y: 130 },
      { x: 440, y: 235 },
      { x: 540, y: 345 },
      { x: 600, y: 435 },
      { x: 240, y: 235 },
      { x: 820, y: 360 },
    ],
  },
  // 3 — Twin Fords — FIRST split: two edge entrances ford to a shared keep.
  {
    name: "Twin Fords",
    path: [
      { x: -20, y: 110 },
      { x: 250, y: 110 },
      { x: 250, y: 250 },
      { x: 520, y: 250 },
      { x: 700, y: 250 },
      { x: 760, y: 290 },
      { x: 920, y: 290 },
    ],
    lanes: [
      [
        { x: -20, y: 110 },
        { x: 250, y: 110 },
        { x: 250, y: 250 },
        { x: 520, y: 250 },
        { x: 700, y: 250 },
        { x: 760, y: 290 },
        { x: 920, y: 290 },
      ],
      [
        { x: -20, y: 470 },
        { x: 250, y: 470 },
        { x: 250, y: 330 },
        { x: 520, y: 330 },
        { x: 700, y: 330 },
        { x: 760, y: 290 },
        { x: 920, y: 290 },
      ],
    ],
    air: [
      { x: -20, y: 290 },
      { x: -20, y: 60 },
    ],
    slots: [
      { x: 380, y: 200 },
      { x: 380, y: 380 },
      { x: 600, y: 200 },
      { x: 600, y: 380 },
      { x: 150, y: 290 },
      { x: 860, y: 230 },
    ],
  },
  // 4 — Hollow Stair — doubled descending staircase, late merge.
  {
    name: "Hollow Stair",
    path: [
      { x: -20, y: 60 },
      { x: 180, y: 60 },
      { x: 180, y: 160 },
      { x: 380, y: 160 },
      { x: 380, y: 260 },
      { x: 580, y: 260 },
      { x: 580, y: 360 },
      { x: 760, y: 360 },
      { x: 760, y: 440 },
      { x: 920, y: 440 },
    ],
    lanes: [
      [
        { x: -20, y: 60 },
        { x: 180, y: 60 },
        { x: 180, y: 160 },
        { x: 380, y: 160 },
        { x: 380, y: 260 },
        { x: 580, y: 260 },
        { x: 580, y: 360 },
        { x: 760, y: 360 },
        { x: 760, y: 440 },
        { x: 920, y: 440 },
      ],
      [
        { x: -20, y: 500 },
        { x: 300, y: 500 },
        { x: 300, y: 420 },
        { x: 620, y: 420 },
        { x: 620, y: 440 },
        { x: 760, y: 440 },
        { x: 920, y: 440 },
      ],
    ],
    air: [
      { x: -20, y: 280 },
      { x: -20, y: 460 },
    ],
    slots: [
      { x: 280, y: 110 },
      { x: 480, y: 210 },
      { x: 680, y: 310 },
      { x: 460, y: 470 },
      { x: 120, y: 320 },
      { x: 860, y: 380 },
    ],
  },
  // 5 — Serpent Bend — long double serpentine, lanes merge at the low bend.
  {
    name: "Serpent Bend",
    path: [
      { x: -20, y: 110 },
      { x: 680, y: 110 },
      { x: 680, y: 230 },
      { x: 160, y: 230 },
      { x: 160, y: 300 },
      { x: 780, y: 300 },
      { x: 920, y: 300 },
    ],
    lanes: [
      [
        { x: -20, y: 110 },
        { x: 680, y: 110 },
        { x: 680, y: 230 },
        { x: 160, y: 230 },
        { x: 160, y: 300 },
        { x: 780, y: 300 },
        { x: 920, y: 300 },
      ],
      [
        { x: -20, y: 470 },
        { x: 680, y: 470 },
        { x: 680, y: 360 },
        { x: 160, y: 360 },
        { x: 160, y: 300 },
        { x: 780, y: 300 },
        { x: 920, y: 300 },
      ],
    ],
    air: [
      { x: -20, y: 290 },
      { x: -20, y: 60 },
    ],
    slots: [
      { x: 360, y: 160 },
      { x: 540, y: 160 },
      { x: 360, y: 415 },
      { x: 540, y: 415 },
      { x: 400, y: 265 },
      { x: 860, y: 250 },
    ],
  },
  // 6 — Quarry Descent — two ramps down opposite sides into one quarry floor.
  {
    name: "Quarry Descent",
    path: [
      { x: -20, y: 90 },
      { x: 220, y: 90 },
      { x: 220, y: 300 },
      { x: 460, y: 300 },
      { x: 460, y: 430 },
      { x: 920, y: 430 },
    ],
    lanes: [
      [
        { x: -20, y: 90 },
        { x: 220, y: 90 },
        { x: 220, y: 300 },
        { x: 460, y: 300 },
        { x: 460, y: 430 },
        { x: 920, y: 430 },
      ],
      [
        { x: -20, y: 200 },
        { x: 120, y: 200 },
        { x: 120, y: 430 },
        { x: 460, y: 430 },
        { x: 920, y: 430 },
      ],
    ],
    air: [
      { x: -20, y: 470 },
      { x: -20, y: 320 },
    ],
    slots: [
      { x: 340, y: 200 },
      { x: 600, y: 360 },
      { x: 740, y: 360 },
      { x: 600, y: 500 },
      { x: 320, y: 380 },
      { x: 860, y: 360 },
    ],
  },
  // 7 — Cinder Crossroads — the lanes literally cross (an X) then merge.
  {
    name: "Cinder Crossroads",
    path: [
      { x: -20, y: 120 },
      { x: 360, y: 120 },
      { x: 600, y: 420 },
      { x: 780, y: 300 },
      { x: 920, y: 270 },
    ],
    lanes: [
      [
        { x: -20, y: 120 },
        { x: 360, y: 120 },
        { x: 600, y: 420 },
        { x: 780, y: 300 },
        { x: 920, y: 270 },
      ],
      [
        { x: -20, y: 420 },
        { x: 360, y: 420 },
        { x: 600, y: 120 },
        { x: 780, y: 300 },
        { x: 920, y: 270 },
      ],
    ],
    air: [
      { x: -20, y: 270 },
      { x: -20, y: 500 },
    ],
    slots: [
      { x: 300, y: 250 },
      { x: 660, y: 250 },
      { x: 480, y: 160 },
      { x: 480, y: 380 },
      { x: 200, y: 280 },
      { x: 860, y: 240 },
    ],
  },
  // 8 — Mistgrove Loop — shared head forks into a loop, then rejoins.
  {
    name: "Mistgrove Loop",
    path: [
      { x: -20, y: 280 },
      { x: 200, y: 280 },
      { x: 200, y: 110 },
      { x: 620, y: 110 },
      { x: 620, y: 280 },
      { x: 780, y: 280 },
      { x: 920, y: 280 },
    ],
    lanes: [
      [
        { x: -20, y: 280 },
        { x: 200, y: 280 },
        { x: 200, y: 110 },
        { x: 620, y: 110 },
        { x: 620, y: 280 },
        { x: 780, y: 280 },
        { x: 920, y: 280 },
      ],
      [
        { x: -20, y: 280 },
        { x: 200, y: 280 },
        { x: 200, y: 450 },
        { x: 620, y: 450 },
        { x: 620, y: 280 },
        { x: 780, y: 280 },
        { x: 920, y: 280 },
      ],
    ],
    air: [
      { x: -20, y: 100 },
      { x: -20, y: 460 },
    ],
    slots: [
      { x: 410, y: 200 },
      { x: 410, y: 360 },
      { x: 410, y: 280 },
      { x: 700, y: 200 },
      { x: 700, y: 360 },
      { x: 860, y: 240 },
    ],
  },
  // 9 — Broken Aqueduct — high straight aqueduct + low winding collapse, merge.
  {
    name: "Broken Aqueduct",
    path: [
      { x: -20, y: 90 },
      { x: 760, y: 90 },
      { x: 760, y: 250 },
      { x: 920, y: 250 },
    ],
    lanes: [
      [
        { x: -20, y: 90 },
        { x: 760, y: 90 },
        { x: 760, y: 250 },
        { x: 920, y: 250 },
      ],
      [
        { x: -20, y: 460 },
        { x: 180, y: 460 },
        { x: 180, y: 330 },
        { x: 420, y: 330 },
        { x: 420, y: 460 },
        { x: 660, y: 460 },
        { x: 660, y: 250 },
        { x: 760, y: 250 },
        { x: 920, y: 250 },
      ],
    ],
    air: [
      { x: -20, y: 260 },
      { x: -20, y: 500 },
    ],
    slots: [
      { x: 300, y: 180 },
      { x: 520, y: 180 },
      { x: 300, y: 400 },
      { x: 540, y: 390 },
      { x: 120, y: 230 },
      { x: 860, y: 200 },
    ],
  },
  // 10 — Wardens' Gate — three entrances funnel through to one final gate.
  {
    name: "Wardens' Gate",
    path: [
      { x: -20, y: 90 },
      { x: 300, y: 90 },
      { x: 300, y: 200 },
      { x: 640, y: 200 },
      { x: 640, y: 270 },
      { x: 780, y: 270 },
      { x: 920, y: 270 },
    ],
    lanes: [
      [
        { x: -20, y: 90 },
        { x: 300, y: 90 },
        { x: 300, y: 200 },
        { x: 640, y: 200 },
        { x: 640, y: 270 },
        { x: 780, y: 270 },
        { x: 920, y: 270 },
      ],
      [
        { x: -20, y: 270 },
        { x: 300, y: 270 },
        { x: 640, y: 270 },
        { x: 780, y: 270 },
        { x: 920, y: 270 },
      ],
      [
        { x: -20, y: 450 },
        { x: 300, y: 450 },
        { x: 300, y: 340 },
        { x: 640, y: 340 },
        { x: 640, y: 270 },
        { x: 780, y: 270 },
        { x: 920, y: 270 },
      ],
    ],
    air: [
      { x: -20, y: 160 },
      { x: -20, y: 380 },
    ],
    slots: [
      { x: 460, y: 140 },
      { x: 460, y: 400 },
      { x: 200, y: 200 },
      { x: 200, y: 340 },
      { x: 720, y: 200 },
      { x: 720, y: 340 },
    ],
  },
];
