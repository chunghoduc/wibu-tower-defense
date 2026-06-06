/**
 * Chapter 1 — "Greywood Pass" — 10 stages. Same region, ten distinct lane
 * layouts. Waves scale with stage number and progressively introduce the enemy
 * archetypes; every stage ends in a boss (a mid-boss appears from stage 4).
 *
 * Logical play area is 960x540; the scene scales this to the screen.
 */
import { makeStats, type SpawnEntry, type StageDef, type Vec2, type WaveDef } from "./schema.ts";

export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;

interface Layout {
  name: string;
  path: Vec2[];
  air: Vec2[];
  slots: Vec2[];
}

const LAYOUTS: Layout[] = [
  {
    name: "Greywood Trailhead",
    path: [{ x: -20, y: 120 }, { x: 300, y: 120 }, { x: 300, y: 420 }, { x: 660, y: 420 }, { x: 660, y: 210 }, { x: 900, y: 210 }],
    air: [{ x: -20, y: 480 }, { x: -20, y: 60 }],
    slots: [{ x: 200, y: 60 }, { x: 360, y: 230 }, { x: 360, y: 340 }, { x: 520, y: 480 }, { x: 600, y: 340 }, { x: 740, y: 150 }, { x: 820, y: 300 }, { x: 480, y: 200 }],
  },
  {
    name: "Switchback Gully",
    path: [{ x: -20, y: 80 }, { x: 760, y: 80 }, { x: 760, y: 260 }, { x: 160, y: 260 }, { x: 160, y: 440 }, { x: 900, y: 440 }],
    air: [{ x: -20, y: 260 }, { x: -20, y: 500 }],
    slots: [{ x: 300, y: 150 }, { x: 560, y: 150 }, { x: 680, y: 190 }, { x: 400, y: 200 }, { x: 260, y: 340 }, { x: 540, y: 360 }, { x: 760, y: 360 }, { x: 100, y: 360 }],
  },
  {
    name: "Twin Fords",
    path: [{ x: -20, y: 270 }, { x: 240, y: 270 }, { x: 240, y: 90 }, { x: 520, y: 90 }, { x: 520, y: 450 }, { x: 900, y: 450 }],
    air: [{ x: -20, y: 90 }, { x: -20, y: 450 }],
    slots: [{ x: 140, y: 200 }, { x: 340, y: 160 }, { x: 420, y: 220 }, { x: 620, y: 200 }, { x: 440, y: 360 }, { x: 620, y: 380 }, { x: 760, y: 380 }, { x: 760, y: 510 }],
  },
  {
    name: "Hollow Stair",
    path: [{ x: -20, y: 60 }, { x: 200, y: 60 }, { x: 200, y: 200 }, { x: 440, y: 200 }, { x: 440, y: 340 }, { x: 680, y: 340 }, { x: 680, y: 480 }, { x: 900, y: 480 }],
    air: [{ x: -20, y: 480 }, { x: -20, y: 270 }],
    slots: [{ x: 120, y: 150 }, { x: 320, y: 140 }, { x: 360, y: 280 }, { x: 560, y: 280 }, { x: 600, y: 420 }, { x: 800, y: 420 }, { x: 280, y: 420 }, { x: 520, y: 120 }],
  },
  {
    name: "Serpent Bend",
    path: [{ x: -20, y: 470 }, { x: 700, y: 470 }, { x: 700, y: 300 }, { x: 120, y: 300 }, { x: 120, y: 120 }, { x: 900, y: 120 }],
    air: [{ x: -20, y: 120 }, { x: -20, y: 300 }],
    slots: [{ x: 300, y: 400 }, { x: 560, y: 400 }, { x: 620, y: 380 }, { x: 360, y: 230 }, { x: 540, y: 230 }, { x: 220, y: 210 }, { x: 500, y: 190 }, { x: 760, y: 190 }],
  },
  {
    name: "Quarry Descent",
    path: [{ x: -20, y: 150 }, { x: 380, y: 150 }, { x: 380, y: 470 }, { x: 900, y: 470 }],
    air: [{ x: -20, y: 470 }, { x: -20, y: 300 }],
    slots: [{ x: 200, y: 80 }, { x: 200, y: 230 }, { x: 460, y: 300 }, { x: 460, y: 400 }, { x: 600, y: 400 }, { x: 740, y: 400 }, { x: 600, y: 530 }, { x: 320, y: 230 }],
  },
  {
    name: "Cinder Crossroads",
    path: [{ x: -20, y: 270 }, { x: 300, y: 270 }, { x: 300, y: 110 }, { x: 620, y: 110 }, { x: 620, y: 430 }, { x: 900, y: 430 }],
    air: [{ x: -20, y: 110 }, { x: -20, y: 430 }],
    slots: [{ x: 160, y: 200 }, { x: 380, y: 190 }, { x: 460, y: 180 }, { x: 540, y: 200 }, { x: 540, y: 340 }, { x: 700, y: 360 }, { x: 700, y: 510 }, { x: 220, y: 350 }],
  },
  {
    name: "Mistgrove Loop",
    path: [{ x: -20, y: 90 }, { x: 820, y: 90 }, { x: 820, y: 470 }, { x: 200, y: 470 }, { x: 200, y: 280 }, { x: 900, y: 280 }],
    air: [{ x: -20, y: 280 }, { x: -20, y: 470 }],
    slots: [{ x: 360, y: 160 }, { x: 640, y: 160 }, { x: 740, y: 200 }, { x: 760, y: 390 }, { x: 480, y: 400 }, { x: 300, y: 380 }, { x: 380, y: 350 }, { x: 600, y: 340 }],
  },
  {
    name: "Broken Aqueduct",
    path: [{ x: -20, y: 200 }, { x: 180, y: 200 }, { x: 180, y: 60 }, { x: 480, y: 60 }, { x: 480, y: 300 }, { x: 720, y: 300 }, { x: 720, y: 470 }, { x: 900, y: 470 }],
    air: [{ x: -20, y: 470 }, { x: -20, y: 60 }],
    slots: [{ x: 100, y: 290 }, { x: 320, y: 130 }, { x: 400, y: 200 }, { x: 560, y: 220 }, { x: 600, y: 360 }, { x: 820, y: 380 }, { x: 360, y: 380 }, { x: 240, y: 130 }],
  },
  {
    name: "Wardens' Gate",
    path: [{ x: -20, y: 270 }, { x: 220, y: 270 }, { x: 220, y: 100 }, { x: 700, y: 100 }, { x: 700, y: 440 }, { x: 360, y: 440 }, { x: 360, y: 540 }],
    air: [{ x: -20, y: 100 }, { x: -20, y: 440 }],
    slots: [{ x: 120, y: 190 }, { x: 340, y: 180 }, { x: 500, y: 180 }, { x: 640, y: 200 }, { x: 600, y: 360 }, { x: 460, y: 360 }, { x: 760, y: 320 }, { x: 280, y: 360 }],
  },
];

/** Final boss for each of the 10 stages (1-indexed), escalating in difficulty. */
const BOSS_BY_STAGE = [
  "champion", "zabro", "ryomen", "kura", "warden",
  "akai", "mukade", "madarok", "overlord", "meruon",
];

const spawn = (enemyId: string, count: number, interval = 0.8, delay = 0): SpawnEntry => ({
  enemyId,
  count,
  interval,
  delay,
});

/** Build the wave list for stage number n (1-based), scaling with progression. */
function buildWaves(n: number): WaveDef[] {
  const w: WaveDef[] = [];

  // Wave 1 — rushers.
  w.push({ spawns: [spawn("grunt", 5 + n, 0.9), spawn("runner", Math.min(2 + n, 8), 0.6, 4)] });

  // Wave 2 — flyers and the first armor.
  const w2: SpawnEntry[] = [spawn("grunt", 6 + n, 0.7)];
  if (n >= 2) w2.push(spawn("gargoyle", 2 + Math.floor(n / 2), 1.2, 3));
  if (n >= 2) w2.push(spawn("brute", Math.max(1, Math.floor(n / 2)), 1.5, 6));
  w.push({ spawns: w2 });

  // Wave 3 — archetype mix that grows with the stage.
  const w3: SpawnEntry[] = [];
  if (n >= 3) w3.push(spawn("bulwark", 1 + Math.floor(n / 3), 1.5));
  if (n >= 3) w3.push(spawn("slime", 1 + Math.floor(n / 3), 1.5, 2));
  if (n >= 4) w3.push(spawn("regenerator", Math.floor(n / 3), 2, 3));
  if (n >= 4) w3.push(spawn("mender", 1, 1, 4));
  if (n >= 5) w3.push(spawn("phantom", Math.floor(n / 2), 1.2, 5));
  if (n >= 5) w3.push(spawn("sapper", 1, 1, 6));
  if (n >= 6) w3.push(spawn("stormflyer", 1 + Math.floor(n / 4), 1.5, 4));
  if (w3.length === 0) w3.push(spawn("grunt", 9, 0.6));
  w.push({ spawns: w3 });

  // Mid-boss wave (from stage 4).
  if (n >= 4) w.push({ spawns: [spawn("grunt", 4, 0.5), spawn("champion", 1, 1, 4)] });

  // Pressure wave for later stages.
  if (n >= 6) {
    const wx: SpawnEntry[] = [spawn("runner", 6 + n, 0.4)];
    wx.push(spawn("summoner", 1, 1, 5));
    if (n >= 7) wx.push(spawn("raider", 1 + Math.floor(n / 4), 2, 3));
    if (n >= 7) wx.push(spawn("courier", 1, 1, 2));
    w.push({ spawns: wx });
  }

  // Each stage ends in a distinct themed boss (anime-homage), escalating.
  const finalBoss = BOSS_BY_STAGE[n - 1] ?? "overlord";
  const wb: SpawnEntry[] = [spawn("grunt", 6, 0.6), spawn("brute", 2, 2, 3)];
  if (n >= 8) wb.push(spawn("stormflyer", 2, 1.5, 4));
  wb.push(spawn(finalBoss, 1, 1, 10));
  w.push({ spawns: wb });

  return w;
}

export const STAGES: StageDef[] = LAYOUTS.map((l, i) => ({
  id: `ch1-s${i + 1}`,
  name: l.name,
  path: l.path,
  airSpawns: l.air,
  castleHp: 28 + i * 2,
  startingGold: 170 + i * 10,
  towerSlots: l.slots,
  waves: buildWaves(i + 1),
}));

/** Backwards-compatible alias for the first stage. */
export const STAGE_1: StageDef = STAGES[0];

/** Default hero loadout for now (Phase 3 replaces this with persistence). */
export function defaultHeroStats() {
  return makeStats({
    atk: 28,
    attackSpeed: 1.1,
    range: 130,
    critRate: 0.15,
    critDamage: 1.6,
    maxHp: 600,
    hpRegen: 8,
    armor: 30,
    moveSpeed: 160,
    maxMana: 100,
    manaOnHit: 12,
    manaRegen: 4,
    skillPower: 1.5,
    goldFind: 0.1,
    omnivamp: 0.08,
  });
}
