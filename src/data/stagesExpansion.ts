/**
 * Campaign expansion — Chapter 2 "Sunscar Wastes" (desert, stages 11–15),
 * Chapter 3 "Emberfall" (volcanic, stages 16–20), Chapter 4 "Mire Hollow"
 * (poison swamp, stages 21–25), and Chapter 5 "The Blight" (corrupted, 26–30).
 *
 * Layouts + per-stage boss assignments live here to keep stage.ts focused (and
 * under the 500-line cap). stage.ts concatenates EXPANSION_LAYOUTS onto the
 * Chapter 1 layouts and BOSS_EXPANSION onto BOSS_BY_STAGE, so the stage build
 * pipeline (continuous global numbering, wave builder, terrain, theming) is
 * shared — these stages are tougher purely by their deeper global stage number,
 * which the progression curve scales up. Each new chapter adds a felt "wall"
 * step on top of the per-stage compounding, so every chapter's enemy HP lands
 * ≈1.9× the previous chapter's (s15 ≈5.0× base, s20 ≈9.5×, s25 ≈18.1×, s30
 * ≈34.6×). See campaign.ts for region lore and progressionScaling.ts for the curve.
 *
 * Coordinates are authored in the 960×540 logical space (scaled to the world by
 * stage.ts). Paths enter at x=-20 and end at the castle (last waypoint).
 */
import type { Layout } from "./stage.ts";

/**
 * Chapter 2 (stages 11–15), Chapter 3 (16–20), and Chapter 4 (21–25), in stage
 * order. Chapter 4's lanes coil longer and tighter — the meanest country yet.
 */
export const EXPANSION_LAYOUTS: Layout[] = [
  // ── Chapter 2 — Sunscar Wastes (desert) ──────────────────────────────────
  {
    name: "Glassflats Crossing",
    path: [{ x: -20, y: 140 }, { x: 260, y: 140 }, { x: 260, y: 400 }, { x: 620, y: 400 }, { x: 620, y: 160 }, { x: 900, y: 160 }],
    air: [{ x: -20, y: 420 }, { x: -20, y: 80 }],
    slots: [{ x: 160, y: 80 }, { x: 360, y: 250 }, { x: 420, y: 330 }, { x: 500, y: 470 }, { x: 700, y: 300 }, { x: 760, y: 120 }, { x: 820, y: 260 }, { x: 440, y: 200 }],
  },
  {
    name: "The Bonewalk",
    path: [{ x: -20, y: 460 }, { x: 180, y: 460 }, { x: 180, y: 120 }, { x: 460, y: 120 }, { x: 460, y: 440 }, { x: 740, y: 440 }, { x: 740, y: 120 }, { x: 900, y: 120 }],
    air: [{ x: -20, y: 120 }, { x: -20, y: 300 }],
    slots: [{ x: 80, y: 300 }, { x: 300, y: 200 }, { x: 340, y: 360 }, { x: 560, y: 260 }, { x: 600, y: 360 }, { x: 640, y: 200 }, { x: 820, y: 300 }, { x: 280, y: 90 }],
  },
  {
    name: "Mirage Bazaar",
    path: [{ x: -20, y: 120 }, { x: 220, y: 120 }, { x: 220, y: 300 }, { x: 440, y: 300 }, { x: 440, y: 120 }, { x: 660, y: 120 }, { x: 660, y: 300 }, { x: 900, y: 300 }],
    air: [{ x: -20, y: 300 }, { x: -20, y: 460 }],
    slots: [{ x: 120, y: 220 }, { x: 330, y: 200 }, { x: 330, y: 400 }, { x: 550, y: 200 }, { x: 550, y: 400 }, { x: 770, y: 200 }, { x: 780, y: 420 }, { x: 120, y: 400 }],
  },
  {
    name: "Sunscar Trench",
    path: [{ x: -20, y: 80 }, { x: 820, y: 80 }, { x: 820, y: 460 }, { x: 160, y: 460 }, { x: 160, y: 260 }, { x: 560, y: 260 }, { x: 560, y: 360 }, { x: 900, y: 360 }],
    air: [{ x: -20, y: 260 }, { x: -20, y: 460 }],
    slots: [{ x: 360, y: 160 }, { x: 640, y: 160 }, { x: 740, y: 300 }, { x: 300, y: 360 }, { x: 300, y: 510 }, { x: 640, y: 420 }, { x: 440, y: 330 }, { x: 460, y: 460 }],
  },
  {
    name: "Gate of the Glass Throne",
    path: [{ x: -20, y: 260 }, { x: 200, y: 260 }, { x: 200, y: 90 }, { x: 760, y: 90 }, { x: 760, y: 460 }, { x: 420, y: 460 }, { x: 420, y: 300 }, { x: 560, y: 300 }, { x: 560, y: 540 }],
    air: [{ x: -20, y: 90 }, { x: -20, y: 460 }],
    slots: [{ x: 110, y: 180 }, { x: 340, y: 170 }, { x: 520, y: 170 }, { x: 680, y: 180 }, { x: 650, y: 360 }, { x: 300, y: 360 }, { x: 820, y: 300 }, { x: 480, y: 420 }],
  },

  // ── Chapter 3 — Emberfall (volcanic) ─────────────────────────────────────
  {
    name: "Cinderfall Descent",
    path: [{ x: -20, y: 440 }, { x: 240, y: 440 }, { x: 240, y: 200 }, { x: 500, y: 200 }, { x: 500, y: 420 }, { x: 760, y: 420 }, { x: 760, y: 160 }, { x: 900, y: 160 }],
    air: [{ x: -20, y: 160 }, { x: -20, y: 320 }],
    slots: [{ x: 120, y: 300 }, { x: 360, y: 300 }, { x: 380, y: 140 }, { x: 620, y: 140 }, { x: 640, y: 300 }, { x: 840, y: 300 }, { x: 200, y: 330 }, { x: 600, y: 330 }],
  },
  {
    name: "Forge Roads",
    path: [{ x: -20, y: 300 }, { x: 320, y: 300 }, { x: 320, y: 100 }, { x: 600, y: 100 }, { x: 600, y: 440 }, { x: 900, y: 440 }],
    air: [{ x: -20, y: 100 }, { x: -20, y: 440 }],
    slots: [{ x: 160, y: 220 }, { x: 420, y: 180 }, { x: 480, y: 200 }, { x: 460, y: 360 }, { x: 740, y: 360 }, { x: 740, y: 510 }, { x: 220, y: 400 }, { x: 500, y: 260 }],
  },
  {
    name: "Ashen Colonnade",
    path: [{ x: -20, y: 110 }, { x: 840, y: 110 }, { x: 840, y: 290 }, { x: 120, y: 290 }, { x: 120, y: 470 }, { x: 900, y: 470 }],
    air: [{ x: -20, y: 290 }, { x: -20, y: 470 }],
    slots: [{ x: 300, y: 190 }, { x: 560, y: 190 }, { x: 740, y: 200 }, { x: 300, y: 380 }, { x: 560, y: 380 }, { x: 760, y: 390 }, { x: 200, y: 190 }, { x: 640, y: 200 }],
  },
  {
    name: "Magma Reliquary",
    path: [{ x: -20, y: 90 }, { x: 760, y: 90 }, { x: 760, y: 210 }, { x: 200, y: 210 }, { x: 200, y: 330 }, { x: 760, y: 330 }, { x: 760, y: 450 }, { x: 200, y: 450 }, { x: 200, y: 540 }],
    air: [{ x: -20, y: 210 }, { x: -20, y: 330 }],
    slots: [{ x: 360, y: 150 }, { x: 600, y: 150 }, { x: 460, y: 270 }, { x: 600, y: 390 }, { x: 360, y: 390 }, { x: 640, y: 270 }, { x: 320, y: 510 }, { x: 820, y: 270 }],
  },
  {
    name: "Throne of Emberfall",
    path: [{ x: -20, y: 80 }, { x: 200, y: 80 }, { x: 200, y: 460 }, { x: 420, y: 460 }, { x: 420, y: 140 }, { x: 640, y: 140 }, { x: 640, y: 460 }, { x: 820, y: 460 }, { x: 820, y: 200 }, { x: 480, y: 200 }, { x: 480, y: 540 }],
    air: [{ x: -20, y: 460 }, { x: -20, y: 260 }],
    slots: [{ x: 100, y: 260 }, { x: 310, y: 260 }, { x: 530, y: 300 }, { x: 730, y: 300 }, { x: 560, y: 420 }, { x: 350, y: 360 }, { x: 720, y: 150 }, { x: 300, y: 150 }],
  },

  // ── Chapter 4 — Mire Hollow (poison swamp) ───────────────────────────────
  {
    name: "Fenmouth Wade",
    path: [{ x: -20, y: 180 }, { x: 240, y: 180 }, { x: 240, y: 420 }, { x: 560, y: 420 }, { x: 560, y: 160 }, { x: 900, y: 160 }],
    air: [{ x: -20, y: 420 }, { x: -20, y: 80 }],
    slots: [{ x: 140, y: 90 }, { x: 360, y: 260 }, { x: 420, y: 340 }, { x: 480, y: 480 }, { x: 700, y: 300 }, { x: 760, y: 120 }, { x: 820, y: 260 }, { x: 440, y: 200 }],
  },
  {
    name: "The Sunken Dead",
    path: [{ x: -20, y: 440 }, { x: 200, y: 440 }, { x: 200, y: 140 }, { x: 460, y: 140 }, { x: 460, y: 440 }, { x: 720, y: 440 }, { x: 720, y: 140 }, { x: 900, y: 140 }],
    air: [{ x: -20, y: 140 }, { x: -20, y: 300 }],
    slots: [{ x: 90, y: 300 }, { x: 320, y: 240 }, { x: 340, y: 360 }, { x: 580, y: 260 }, { x: 600, y: 360 }, { x: 660, y: 220 }, { x: 820, y: 300 }, { x: 300, y: 90 }],
  },
  {
    name: "Sporebloom Hollow",
    path: [{ x: -20, y: 120 }, { x: 220, y: 120 }, { x: 220, y: 320 }, { x: 440, y: 320 }, { x: 440, y: 120 }, { x: 660, y: 120 }, { x: 660, y: 340 }, { x: 900, y: 340 }],
    air: [{ x: -20, y: 320 }, { x: -20, y: 460 }],
    slots: [{ x: 120, y: 230 }, { x: 330, y: 210 }, { x: 330, y: 420 }, { x: 550, y: 220 }, { x: 560, y: 420 }, { x: 770, y: 220 }, { x: 780, y: 440 }, { x: 120, y: 420 }],
  },
  {
    name: "The Miremother's Nest",
    path: [{ x: -20, y: 300 }, { x: 120, y: 300 }, { x: 120, y: 120 }, { x: 840, y: 120 }, { x: 840, y: 460 }, { x: 300, y: 460 }, { x: 300, y: 300 }, { x: 640, y: 300 }, { x: 640, y: 400 }, { x: 900, y: 400 }],
    air: [{ x: -20, y: 120 }, { x: -20, y: 460 }],
    slots: [{ x: 220, y: 210 }, { x: 460, y: 200 }, { x: 640, y: 200 }, { x: 760, y: 260 }, { x: 420, y: 360 }, { x: 500, y: 420 }, { x: 760, y: 510 }, { x: 200, y: 400 }],
  },
  {
    name: "Heart of the Rot",
    path: [{ x: -20, y: 90 }, { x: 760, y: 90 }, { x: 760, y: 210 }, { x: 180, y: 210 }, { x: 180, y: 330 }, { x: 760, y: 330 }, { x: 760, y: 450 }, { x: 300, y: 450 }, { x: 300, y: 540 }],
    air: [{ x: -20, y: 210 }, { x: -20, y: 330 }],
    slots: [{ x: 360, y: 150 }, { x: 600, y: 150 }, { x: 460, y: 270 }, { x: 600, y: 390 }, { x: 360, y: 390 }, { x: 660, y: 270 }, { x: 840, y: 270 }, { x: 220, y: 450 }],
  },

  // ── Chapter 5 — The Blight (corrupted) ───────────────────────────────────
  // The final region. Lanes run longest and fold back hardest — fewer build
  // slots sit on the killing line, so every placement has to earn its keep.
  {
    name: "Threshold of the Blight",
    path: [{ x: -20, y: 160 }, { x: 300, y: 160 }, { x: 300, y: 440 }, { x: 540, y: 440 }, { x: 540, y: 120 }, { x: 780, y: 120 }, { x: 780, y: 400 }, { x: 900, y: 400 }],
    air: [{ x: -20, y: 440 }, { x: -20, y: 80 }],
    slots: [{ x: 150, y: 90 }, { x: 380, y: 260 }, { x: 420, y: 360 }, { x: 480, y: 500 }, { x: 660, y: 260 }, { x: 690, y: 120 }, { x: 860, y: 240 }, { x: 460, y: 200 }],
  },
  {
    name: "Crystalweep Marches",
    path: [{ x: -20, y: 480 }, { x: 180, y: 480 }, { x: 180, y: 100 }, { x: 420, y: 100 }, { x: 420, y: 420 }, { x: 640, y: 420 }, { x: 640, y: 100 }, { x: 860, y: 100 }, { x: 860, y: 360 }, { x: 900, y: 360 }],
    air: [{ x: -20, y: 100 }, { x: -20, y: 300 }],
    slots: [{ x: 90, y: 300 }, { x: 300, y: 230 }, { x: 320, y: 360 }, { x: 530, y: 250 }, { x: 540, y: 360 }, { x: 740, y: 240 }, { x: 760, y: 360 }, { x: 280, y: 90 }],
  },
  {
    name: "The Hollow Choir",
    path: [{ x: -20, y: 120 }, { x: 240, y: 120 }, { x: 240, y: 300 }, { x: 120, y: 300 }, { x: 120, y: 460 }, { x: 480, y: 460 }, { x: 480, y: 120 }, { x: 720, y: 120 }, { x: 720, y: 460 }, { x: 900, y: 460 }],
    air: [{ x: -20, y: 300 }, { x: -20, y: 460 }],
    slots: [{ x: 340, y: 210 }, { x: 360, y: 380 }, { x: 600, y: 220 }, { x: 600, y: 380 }, { x: 800, y: 240 }, { x: 820, y: 380 }, { x: 200, y: 200 }, { x: 240, y: 420 }],
  },
  {
    name: "Spire of Unmaking",
    path: [{ x: -20, y: 80 }, { x: 820, y: 80 }, { x: 820, y: 200 }, { x: 160, y: 200 }, { x: 160, y: 320 }, { x: 820, y: 320 }, { x: 820, y: 440 }, { x: 160, y: 440 }, { x: 160, y: 540 }],
    air: [{ x: -20, y: 200 }, { x: -20, y: 320 }],
    slots: [{ x: 360, y: 140 }, { x: 600, y: 140 }, { x: 460, y: 260 }, { x: 600, y: 380 }, { x: 360, y: 380 }, { x: 660, y: 260 }, { x: 300, y: 500 }, { x: 840, y: 260 }],
  },
  {
    name: "The Wound at the World's End",
    path: [{ x: -20, y: 300 }, { x: 140, y: 300 }, { x: 140, y: 100 }, { x: 820, y: 100 }, { x: 820, y: 440 }, { x: 260, y: 440 }, { x: 260, y: 260 }, { x: 600, y: 260 }, { x: 600, y: 380 }, { x: 440, y: 380 }, { x: 440, y: 540 }],
    air: [{ x: -20, y: 100 }, { x: -20, y: 440 }],
    slots: [{ x: 230, y: 200 }, { x: 480, y: 180 }, { x: 680, y: 180 }, { x: 760, y: 280 }, { x: 360, y: 340 }, { x: 520, y: 460 }, { x: 360, y: 200 }, { x: 700, y: 440 }],
  },
];

/**
 * Final boss for stages 11–30 (1-indexed continues from BOSS_BY_STAGE). The
 * Antihero Gallery (10 new bosses) headlines most stages, with a few classic
 * apex bosses kept as chapter climaxes. Each chapter's five finals are ordered
 * ASCENDING by base HP so the boss spike climbs stage-by-stage and the chapter
 * climaxes on its hardest boss; the progression curve then scales these by depth.
 * Base HP rank lives in BOSS_HP_RANK (stage.ts). See the 2026-06-12 antihero spec.
 */
export const BOSS_EXPANSION = [
  // Chapter 2 — Sunscar Wastes (11–15) → climax: overlord (2200)
  "gravemourn", "vindicator", "sundermark", "crownfall", "overlord",
  // Chapter 3 — Emberfall (16–20) → climax: madarok (2700)
  "unkilling", "mukade", "mawborn", "devourer", "madarok",
  // Chapter 4 — Mire Hollow (21–25) → climax: meruon (3800)
  "akai", "crimsonlord", "madarok", "fallenward", "meruon",
  // Chapter 5 — The Blight (26–30) → climax: ashghost (4200), the final boss
  "devourer", "crimsonlord", "fallenward", "meruon", "ashghost",
];
