/**
 * Chapter 1 — "Greywood Pass" — 10 stages. Same region, ten distinct lane
 * layouts. Waves scale with stage number and progressively introduce the enemy
 * archetypes; every stage is ten waves with a mid-boss on wave 5 and the
 * stage's themed boss on wave 10.
 *
 * Logical play area is 960x540; the scene scales this to the screen.
 */
import {
  makeStats,
  type SpawnEntry,
  type StageDef,
  type TerrainFeature,
  type TerrainType,
  type Vec2,
  type WaveDef,
} from "./schema.ts";
import { Rng } from "../core/rng.ts";
import { stageThemeForStage } from "./chapters.ts";
import { EXPANSION_LAYOUTS, BOSS_EXPANSION } from "./stagesExpansion.ts";
import { buildChapter1Waves } from "./chapter1Waves.ts";
import { CH1_LAYOUTS } from "./chapter1Layouts.ts";

export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;

export interface Layout {
  name: string;
  path: Vec2[];
  /** Optional extra ground lanes (each authored edge→keep). `path` mirrors lanes[0]. */
  lanes?: Vec2[][];
  air: Vec2[];
  slots: Vec2[];
}

const LAYOUTS: Layout[] = CH1_LAYOUTS;

/**
 * Final boss for each stage (1-indexed), escalating in difficulty. Chapter 1's
 * ten bosses, then the Chapter 2/3/4/5 expansion roster (stages 11–30) appended.
 */
export const BOSS_BY_STAGE = [
  // Ordered weakest→strongest so the boss spike climbs with the stage (overlord
  // 2200 before madarok 2700 — base HP, before the progression curve scales it).
  "champion",
  "zabro",
  "ryomen",
  "kura",
  "warden",
  "akai",
  "mukade",
  "overlord",
  "madarok",
  "meruon",
  ...BOSS_EXPANSION,
];

/**
 * The boss roster in ascending base-HP order — the canonical difficulty rank used
 * to keep wave 5's mid-boss from ever out-ranking wave 10's finale (see
 * {@link midBossFor}). Bosses share base HP in a couple of spots; ties are broken
 * by listed order, which is fine for the ≤ comparison.
 */
const BOSS_HP_RANK = [
  // Ascending base HP — the canonical difficulty rank (keeps wave-5 ≤ wave-10).
  "champion", // 700
  "zabro", // 1000
  "gravemourn", // 1150
  "ryomen", // 1200
  "vindicator", // 1350
  "kura", // 1450
  "sundermark", // 1500
  "crownfall", // 1650
  "warden", // 1700
  "unkilling", // 1950
  "akai", // 2000
  "mukade", // 2200
  "overlord", // 2200
  "mawborn", // 2250
  "devourer", // 2400
  "crimsonlord", // 2600
  "madarok", // 2700
  "fallenward", // 2850
  "meruon", // 3200
  "ashghost", // 3500
];
const bossRank = (id: string): number => {
  const r = BOSS_HP_RANK.indexOf(id);
  return r < 0 ? BOSS_HP_RANK.length : r; // unknown ids sort last (treated as hardest)
};

/**
 * Mid-boss (wave 5) for global stage `n`: the previous stage's boss — a notch
 * easier than the wave-10 finale, so the stage climbs to its climax on wave 10.
 *
 * At a chapter opener the "previous stage" is the prior chapter's APEX boss, which
 * would out-rank the new chapter's intro boss and make wave 5 harder than wave 10
 * (a felt anticlimax). In that case we drop to the strongest boss still weaker than
 * the finale, so the run's peak always lands on the final wave.
 */
export function midBossFor(n: number): string {
  const finalBoss = BOSS_BY_STAGE[n - 1] ?? "overlord";
  const prev = BOSS_BY_STAGE[Math.max(0, n - 2)] ?? "champion";
  if (bossRank(prev) <= bossRank(finalBoss)) return prev;
  const fr = bossRank(finalBoss);
  return fr > 0 ? BOSS_HP_RANK[fr - 1] : finalBoss; // chapter-opener guard
}

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
  const midBoss = midBossFor(n);
  const heavy = n >= 8; // late stages get an extra flyer/wall layer
  const w: WaveDef[] = [];

  // 1 — rushers. (Cadence tightens on later stages so more enemies overlap.)
  w.push({
    spawns: [
      spawn("grunt", 5 + n, n >= 6 ? 0.7 : 0.9),
      spawn("runner", Math.min(2 + n, 8), 0.6, 4),
    ],
  });

  // 2 — flyers and the first armor.
  w.push({
    spawns: [
      spawn("grunt", 6 + n, n >= 6 ? 0.55 : 0.7),
      spawn("gargoyle", 2 + Math.floor(n / 2), 1.2, 3),
      spawn("brute", Math.max(1, Math.floor(n / 2)), 1.5, 6),
    ],
  });

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
  w.push({
    spawns: [
      spawn("grunt", 5, 0.5),
      spawn("brute", 1 + Math.floor(n / 4), 1.5, 2),
      spawn(midBoss, 1, 1, 6),
    ],
  });

  // 6 — heavier mix with walls.
  const w6: SpawnEntry[] = [
    spawn("grunt", 7 + n, 0.5),
    spawn("golem", 1 + Math.floor(n / 5), 2.5, 3), // physical-immune wall
  ];
  if (n >= 5) w6.push(spawn("phantom", 1 + Math.floor(n / 2), 1.2, 4));
  if (n >= 6) w6.push(spawn("monolith", 1, 2.5, 5)); // magic-immune wall
  if (n >= 12) w6.push(spawn("carrier", 1 + Math.floor(n / 8), 1.5, 4)); // Bloomrot Carrier — space your towers
  if (n >= 14) w6.push(spawn("prism", 1, 2.5, 6)); // Prism Behemoth — dual-type wall
  w.push({ spawns: w6 });

  // 7 — fast raiders and couriers.
  const w7: SpawnEntry[] = [
    spawn("runner", 8 + n, 0.35),
    spawn("raider", 1 + Math.floor(n / 3), 2, 2),
  ];
  if (n >= 5) w7.push(spawn("sapper", 1, 1, 5));
  if (n >= 6) w7.push(spawn("courier", 1, 1, 3));
  if (n >= 11) w7.push(spawn("reaver", 1 + Math.floor(n / 4), 2, 4)); // Bloodmad Reaver — burst it
  w.push({ spawns: w7 });

  // 8 — flyer storm with priority-kill supports.
  const w8: SpawnEntry[] = [
    spawn("gargoyle", 3 + Math.floor(n / 2), 0.8),
    spawn("stormflyer", 1 + Math.floor(n / 3), 1.2, 2),
  ];
  if (n >= 6) w8.push(spawn("summoner", 1, 1, 4));
  if (n >= 6) w8.push(spawn("hexer", 1, 1, 5)); // tower-slowing healer — a priority kill
  if (n >= 11) w8.push(spawn("dreadwing", 1 + Math.floor(n / 5), 1.5, 3)); // Iron Dreadwing — heavy anti-air
  if (n >= 13) w8.push(spawn("cantor", 1, 1, 6)); // Gravewail Cantor — priority kill
  w.push({ spawns: w8 });

  // 9 — pre-finale gauntlet: dense elites.
  const w9: SpawnEntry[] = [
    spawn("brute", 2 + Math.floor(n / 2), 1.2),
    spawn("regenerator", 1 + Math.floor(n / 3), 1.5, 2),
    spawn("bulwark", 1 + Math.floor(n / 4), 1.5, 3),
  ];
  if (heavy) w9.push(spawn("golem", 1, 2.5, 4), spawn("monolith", 1, 2.5, 5));
  if (n >= 14) w9.push(spawn("prism", 1, 2.5, 6)); // capstone gauntlet wall
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
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const l2 = dx * dx + dy * dy || 1;
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}
function nearPath(p: Vec2, path: Vec2[], clearance: number): boolean {
  for (let i = 1; i < path.length; i++)
    if (segDist(p, path[i - 1], path[i]) < clearance) return true;
  return false;
}

/**
 * Deterministically scatter terrain features that keep the lane corridor clear.
 * The obstacle/decor type pools come from the stage's biome theme so the map
 * matches its backdrop (lava on the lava field, ice on the frozen reach, …).
 */
function generateTerrain(
  lanes: Vec2[][],
  seed: number,
  block: TerrainType[],
  decor: TerrainType[],
): TerrainFeature[] {
  const rng = new Rng(seed * 7919 + 13);
  const feats: TerrainFeature[] = [];
  let attempts = 0;
  while (feats.length < 16 && attempts < 500) {
    attempts++;
    const x = 50 + rng.next() * (WORLD_WIDTH - 100);
    const y = 50 + rng.next() * (WORLD_HEIGHT - 100);
    const r = 26 + rng.next() * 36;
    // keep every lane walkable + buildable beside it
    if (lanes.some((lane) => nearPath({ x, y }, lane, r + 30))) continue;
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
  // Scale authored lanes (if any) to world units; `path` mirrors lanes[0] so the
  // keep (last point) and castlePos stay correct. Single-lane stages keep `path`
  // and omit `lanes`.
  const lanes = l.lanes?.map((lane) => lane.map(scaleV));
  const path = lanes ? lanes[0] : l.path.map(scaleV);
  const theme = stageThemeForStage(id);
  return {
    id,
    name: l.name,
    path,
    lanes,
    airSpawns: l.air.map(scaleV),
    castleHp: 15,
    startingGold: 170 + i * 10,
    towerSlots: l.slots.map(scaleV),
    terrain: generateTerrain(lanes ?? [path], i + 1, theme.block, theme.decor),
    // Chapter 1 (stages 1–10) uses the hand-tuned per-stage arc; chapters 2–5
    // keep the procedural builder.
    waves:
      i < 10
        ? buildChapter1Waves(i + 1, BOSS_BY_STAGE[i] ?? "overlord", midBossFor(i + 1))
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
