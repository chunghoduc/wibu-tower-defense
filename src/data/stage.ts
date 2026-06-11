/**
 * Chapter 1 — "Greywood Pass" — 10 stages. Same region, ten distinct lane
 * layouts. Waves scale with stage number and progressively introduce the enemy
 * archetypes; every stage is ten waves with a mid-boss on wave 5 and the
 * stage's themed boss on wave 10.
 *
 * Logical play area is 960x540; the scene scales this to the screen.
 */
import { makeStats, type SpawnEntry, type StageDef, type TerrainFeature, type TerrainType, type Vec2, type WaveDef } from "./schema.ts";
import { Rng } from "../core/rng.ts";
import { stageThemeForStage } from "./chapters.ts";
import { EXPANSION_LAYOUTS, BOSS_EXPANSION } from "./stagesExpansion.ts";
import { buildChapter1Waves } from "./chapter1Waves.ts";

export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;

export interface Layout {
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

/**
 * Final boss for each stage (1-indexed), escalating in difficulty. Chapter 1's
 * ten bosses, then the Chapter 2/3/4/5 expansion roster (stages 11–30) appended.
 */
export const BOSS_BY_STAGE = [
  "champion", "zabro", "ryomen", "kura", "warden",
  "akai", "mukade", "madarok", "overlord", "meruon",
  ...BOSS_EXPANSION,
];

/** Every campaign layout in stage order: Chapter 1, then the 2–5 expansion. */
const ALL_LAYOUTS: Layout[] = [...LAYOUTS, ...EXPANSION_LAYOUTS];

/** Stage id (with the right `chN-` region prefix) for a global stage number. */
function stageIdFor(n: number): string {
  const chapter = n <= 10 ? 1 : n <= 15 ? 2 : n <= 20 ? 3 : n <= 25 ? 4 : 5;
  return `ch${chapter}-s${n}`;
}

/** Stage number (1-based) parsed from a stage id like "ch1-s7". */
export function stageNumber(stageId: string): number {
  const m = stageId.match(/s(\d+)$/);
  return m ? parseInt(m[1], 10) : 1;
}

/** Loot-box tier (1..5) for a stage — two stages per tier, escalating. */
export function boxTierForStage(stageId: string): number {
  return Math.max(1, Math.min(5, Math.ceil(stageNumber(stageId) / 2)));
}

const spawn = (enemyId: string, count: number, interval = 0.8, delay = 0): SpawnEntry => ({
  enemyId,
  count,
  interval,
  delay,
});

/**
 * Build the wave list for stage number n (1-based). EVERY stage is exactly ten
 * waves with the same shape: waves 1–4 build pressure, wave 5 is a mid-boss,
 * waves 6–9 escalate, and wave 10 is the stage's themed final boss. Bosses
 * appear ONLY on waves 5 and 10 (they leak for 10 damage into a 15-HP castle —
 * see {@link castleLeakDamage}). Enemy density/variety still scales with n, so
 * later stages fill the same ten slots with denser, meaner waves.
 */
function buildWaves(n: number): WaveDef[] {
  // Wave 10 is the stage's themed boss; wave 5's mid-boss is the previous tier
  // (always a notch easier than the finale, and never the silent fallback).
  const finalBoss = BOSS_BY_STAGE[n - 1] ?? "overlord";
  const midBoss = BOSS_BY_STAGE[Math.max(0, n - 2)] ?? "champion";
  const heavy = n >= 8; // late stages get an extra flyer/wall layer
  const w: WaveDef[] = [];

  // 1 — rushers. (Cadence tightens on later stages so more enemies overlap.)
  w.push({ spawns: [spawn("grunt", 5 + n, n >= 6 ? 0.7 : 0.9), spawn("runner", Math.min(2 + n, 8), 0.6, 4)] });

  // 2 — flyers and the first armor.
  w.push({ spawns: [
    spawn("grunt", 6 + n, n >= 6 ? 0.55 : 0.7),
    spawn("gargoyle", 2 + Math.floor(n / 2), 1.2, 3),
    spawn("brute", Math.max(1, Math.floor(n / 2)), 1.5, 6),
  ] });

  // 3 — armored archetype mix that grows with the stage.
  const w3: SpawnEntry[] = [
    spawn("bulwark", 1 + Math.floor(n / 3), 1.5),
    spawn("slime", 1 + Math.floor(n / 3), 1.5, 2),
    spawn("herald", 1, 1, 3), // rally support — kill it first
  ];
  if (n >= 4) w3.push(spawn("regenerator", 1 + Math.floor(n / 3), 2, 3));
  w.push({ spawns: w3 });

  // 4 — swarm pressure + first healer.
  const w4: SpawnEntry[] = [
    spawn("runner", 6 + n, n >= 6 ? 0.35 : 0.5),
    spawn("gargoyle", 1 + Math.floor(n / 3), 0.9, 2),
  ];
  if (n >= 5) w4.push(spawn("mender", 1, 1, 4));
  w.push({ spawns: w4 });

  // 5 — MID-BOSS. Hold the line: a leak here costs 10 of your 15 castle HP.
  w.push({ spawns: [
    spawn("grunt", 5, 0.5),
    spawn("brute", 1 + Math.floor(n / 4), 1.5, 2),
    spawn(midBoss, 1, 1, 6),
  ] });

  // 6 — heavier mix with walls.
  const w6: SpawnEntry[] = [
    spawn("grunt", 7 + n, 0.5),
    spawn("golem", 1 + Math.floor(n / 5), 2.5, 3), // physical-immune wall
  ];
  if (n >= 5) w6.push(spawn("phantom", 1 + Math.floor(n / 2), 1.2, 4));
  if (n >= 6) w6.push(spawn("monolith", 1, 2.5, 5)); // magic-immune wall
  w.push({ spawns: w6 });

  // 7 — fast raiders and couriers.
  const w7: SpawnEntry[] = [
    spawn("runner", 8 + n, 0.35),
    spawn("raider", 1 + Math.floor(n / 3), 2, 2),
  ];
  if (n >= 5) w7.push(spawn("sapper", 1, 1, 5));
  if (n >= 6) w7.push(spawn("courier", 1, 1, 3));
  w.push({ spawns: w7 });

  // 8 — flyer storm with priority-kill supports.
  const w8: SpawnEntry[] = [
    spawn("gargoyle", 3 + Math.floor(n / 2), 0.8),
    spawn("stormflyer", 1 + Math.floor(n / 3), 1.2, 2),
  ];
  if (n >= 6) w8.push(spawn("summoner", 1, 1, 4));
  if (n >= 6) w8.push(spawn("hexer", 1, 1, 5)); // tower-slowing healer — a priority kill
  w.push({ spawns: w8 });

  // 9 — pre-finale gauntlet: dense elites.
  const w9: SpawnEntry[] = [
    spawn("brute", 2 + Math.floor(n / 2), 1.2),
    spawn("regenerator", 1 + Math.floor(n / 3), 1.5, 2),
    spawn("bulwark", 1 + Math.floor(n / 4), 1.5, 3),
  ];
  if (heavy) w9.push(spawn("golem", 1, 2.5, 4), spawn("monolith", 1, 2.5, 5));
  w.push({ spawns: w9 });

  // 10 — FINAL BOSS: the stage's distinct themed boss, escalating.
  const w10: SpawnEntry[] = [spawn("grunt", 6, 0.6), spawn("brute", 2, 2, 3)];
  if (heavy) w10.push(spawn("stormflyer", 2, 1.5, 4));
  w10.push(spawn(finalBoss, 1, 1, 10));
  w.push({ spawns: w10 });

  return w;
}

/**
 * The battlefield world is larger than the 960×540 screen so the battle camera
 * can show it zoomed out (T6). Layouts authored at 960×540 are scaled up to fill
 * the world; gameplay quantities stay in world units.
 */
export const WORLD_WIDTH = 1280;
export const WORLD_HEIGHT = 720;
const WSX = WORLD_WIDTH / GAME_WIDTH;
const WSY = WORLD_HEIGHT / GAME_HEIGHT;
const scaleV = (p: Vec2): Vec2 => ({ x: Math.round(p.x * WSX), y: Math.round(p.y * WSY) });

/** Distance from point p to segment a-b. */
function segDist(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const l2 = dx * dx + dy * dy || 1;
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}
function nearPath(p: Vec2, path: Vec2[], clearance: number): boolean {
  for (let i = 1; i < path.length; i++) if (segDist(p, path[i - 1], path[i]) < clearance) return true;
  return false;
}

/**
 * Deterministically scatter terrain features that keep the lane corridor clear.
 * The obstacle/decor type pools come from the stage's biome theme so the map
 * matches its backdrop (lava on the lava field, ice on the frozen reach, …).
 */
function generateTerrain(path: Vec2[], seed: number, block: TerrainType[], decor: TerrainType[]): TerrainFeature[] {
  const rng = new Rng(seed * 7919 + 13);
  const feats: TerrainFeature[] = [];
  let attempts = 0;
  while (feats.length < 16 && attempts < 500) {
    attempts++;
    const x = 50 + rng.next() * (WORLD_WIDTH - 100);
    const y = 50 + rng.next() * (WORLD_HEIGHT - 100);
    const r = 26 + rng.next() * 36;
    if (nearPath({ x, y }, path, r + 30)) continue;             // keep the lane walkable + buildable beside it
    if (feats.some((f) => Math.hypot(f.x - x, f.y - y) < f.r + r + 12)) continue;
    const blocks = rng.next() < 0.6;
    const pool = blocks ? block : decor;
    const type = pool[Math.floor(rng.next() * pool.length)];
    feats.push({ type, x: Math.round(x), y: Math.round(y), r: Math.round(r), blocks });
  }
  return feats;
}

export const STAGES: StageDef[] = ALL_LAYOUTS.map((l, i) => {
  const id = stageIdFor(i + 1);
  const path = l.path.map(scaleV);
  const theme = stageThemeForStage(id);
  return {
    id,
    name: l.name,
    path,
    airSpawns: l.air.map(scaleV),
    castleHp: 15,
    startingGold: 170 + i * 10,
    towerSlots: l.slots.map(scaleV),
    terrain: generateTerrain(path, i + 1, theme.block, theme.decor),
    // Chapter 1 (stages 1–10) uses the hand-tuned per-stage arc; chapters 2–5
    // keep the procedural builder.
    waves: i < 10
      ? buildChapter1Waves(i + 1, BOSS_BY_STAGE[i] ?? "overlord", BOSS_BY_STAGE[Math.max(0, i - 1)] ?? "champion")
      : buildWaves(i + 1),
  };
});

/** Backwards-compatible alias for the first stage. */
export const STAGE_1: StageDef = STAGES[0];

/** Default hero loadout for now (Phase 3 replaces this with persistence). */
export function defaultHeroStats() {
  return makeStats({
    atk: 28,
    attackSpeed: 1.1,
    range: 130,
    // Crit is a neutral growth stat: base chance 0% (level scaling ramps it to
    // 30% by L90, see heroStatPipeline) and a fixed 150% crit damage. Gear,
    // kills and passives add on top of both.
    critRate: 0,
    critDamage: 1.5,
    maxHp: 600,
    hpRegen: 8,
    armor: 30,
    moveSpeed: 160,
    manaOnHit: 12,
    skillPower: 1.5,
    goldFind: 0.1,
    omnivamp: 0.08,
  });
}
