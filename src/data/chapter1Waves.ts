/**
 * Chapter 1 — per-stage wave design, authored ONE STAGE AT A TIME.
 *
 * Every chapter-1 stage runs the same 10-wave arc — a deliberate easy → super
 * hard climb — but each stage spotlights a DIFFERENT archetype so the chapter
 * teaches one answer at a time (rushers → air → armor → sustain → walls → …).
 * The 2026-06-13 difficulty redesign made the curve meaner three ways:
 *
 *   1. COMPOSITION — juggernaut walls are PERMANENT from stage 5 on (every
 *      late stage forces a second damage type), supports run S3→S10 unbroken,
 *      and the final exam stages (9-10) stack BOTH walls plus TWO supports so
 *      a board with no priority-kill answer drowns in auras.
 *   2. CADENCE — `cadence(n)` multiplies every spawn interval (×1.0 on stage 1
 *      → ×0.55 on stage 10), so later stages flood the same 30s wave window
 *      with overlapping spawns instead of a trickle.
 *   3. DENSITY — steeper count formulas on the stage-number knob `d`.
 *
 * The arc inside one stage:
 *   W1  warm-up — pure rushers, slow cadence (always trivial)
 *   W2  introduce the stage's featured archetype, still light
 *   W3  first armor — a touch of single-target / penetration
 *   W4  swarm bump — density climbs (+ splitters from stage 4)
 *   W5  MID-BOSS with a featured escort (a leak costs 10 of 15 castle HP)
 *   W6  juggernaut wall — forces a 2nd damage type (two walls on stages 9-10)
 *   W7  speed / tower-threat pressure — raiders, late-stage sappers
 *   W8  sky + a priority-kill support — getting hard
 *   W9  THE GAUNTLET — dense mixed elites + both walls + both supports (the
 *       "many towers" exam; the intra-stage stat ramp in waveScaling.ts piles
 *       on top)
 *   W10 FINAL BOSS + gauntlet-grade escort (regenerators/bulwarks/walls)
 *
 * Bosses appear ONLY on waves 5 and 10 — the structure the rest of the game
 * (and tests/waveStructure.test.ts) relies on. The monotonic difficulty law
 * (wave < stage < chapter) is pinned by tests/chapter1Waves.test.ts, including
 * a guard that stage 10 stays below procedural stage 11.
 *
 * Boss ids are passed in from stage.ts (the BOSS_BY_STAGE roster) to avoid an
 * import cycle.
 */
import type { SpawnEntry, WaveDef } from "./schema.ts";

const spawn = (enemyId: string, count: number, interval = 0.8, delay = 0): SpawnEntry => ({
  enemyId,
  count,
  interval,
  delay,
});

interface Ch1Plan {
  /** The archetype this stage spotlights — entered light in W2, dense by W9. */
  feature: string;
  /** A juggernaut wall from W6 on (forces a 2nd damage type), or null. */
  wall: string | null;
  /** A second wall for the chapter's hardest stages (W9/W10), or null. */
  wall2: string | null;
  /** A priority-kill support that joins the late gauntlet, or null. */
  support: string | null;
  /** A second aura-carrier stacked onto the final exam stages (9-10), or null. */
  support2: string | null;
}

/**
 * One entry per chapter-1 stage (1→10), tuned individually. The progression of
 * featured archetypes is the chapter's teaching curve; walls become permanent
 * from stage 5, supports from stage 3, and the final two stages stack both
 * walls plus two supports for the full-coverage exam.
 *
 * Exported for the difficulty guard tests.
 */
export const CH1_PLANS: Ch1Plan[] = [
  { feature: "grunt", wall: null, wall2: null, support: null, support2: null }, // 1 — basics
  { feature: "gargoyle", wall: null, wall2: null, support: null, support2: null }, // 2 — air
  { feature: "bulwark", wall: null, wall2: null, support: "herald", support2: null }, // 3 — armor
  { feature: "slime", wall: null, wall2: null, support: "mender", support2: null }, // 4 — splitters
  { feature: "regenerator", wall: "golem", wall2: null, support: "herald", support2: null }, // 5
  { feature: "sapper", wall: "monolith", wall2: null, support: "mender", support2: null }, // 6
  { feature: "phantom", wall: "monolith", wall2: null, support: "summoner", support2: null }, // 7
  { feature: "stormflyer", wall: "golem", wall2: null, support: "hexer", support2: null }, // 8
  {
    feature: "regenerator",
    wall: "golem",
    wall2: "monolith",
    support: "hexer",
    support2: "summoner",
  }, // 9 — BOTH walls, two supports
  {
    feature: "phantom",
    wall: "golem",
    wall2: "monolith",
    support: "summoner",
    support2: "hexer",
  }, // 10 — the exam: everything
];

/** Spawn-interval multiplier: ×1.0 on stage 1 → ×0.55 on stage 10 (overlap pressure). */
const cadence = (n: number): number => Math.max(0.55, 1 - 0.05 * (n - 1));

/**
 * Build the 10-wave arc for chapter-1 stage `n` (1-based). `finalBoss` fronts
 * wave 10; `midBoss` fronts wave 5 (a notch easier — the previous tier).
 */
export function buildChapter1Waves(n: number, finalBoss: string, midBoss: string): WaveDef[] {
  const p = CH1_PLANS[n - 1] ?? CH1_PLANS[CH1_PLANS.length - 1];
  const d = n; // density knob: more enemies per wave on later stages
  const c = cadence(n); // cadence knob: later stages spawn faster
  const f = p.feature;
  const w: WaveDef[] = [];

  // W1 — warm-up: pure rushers, slow cadence. Always easy.
  w.push({ spawns: [spawn("grunt", 4 + Math.ceil(0.7 * d), 1.0 * c)] });

  // W2 — introduce the stage's featured archetype, still light.
  w.push({
    spawns: [
      spawn("grunt", 4 + Math.floor(d / 2), 0.9 * c),
      spawn(f, 2 + Math.ceil(0.7 * d), 1.2 * c, 3),
    ],
  });

  // W3 — first armor: demands a little single-target / penetration.
  w.push({
    spawns: [
      spawn("brute", 1 + Math.floor(d / 2), 1.4 * c),
      spawn("bulwark", 1 + Math.floor(d / 3), 1.4 * c, 2),
      spawn(f, 2 + Math.floor(d / 2), 1.0 * c, 1),
    ],
  });

  // W4 — swarm bump: density climbs; splitters join from stage 4.
  const w4: SpawnEntry[] = [
    spawn("runner", 8 + d, 0.5 * c),
    spawn("gargoyle", 2 + Math.floor(d / 2), 0.9 * c, 2),
  ];
  if (d >= 4) w4.push(spawn("slime", 1 + Math.floor(d / 4), 1.3 * c, 3));
  w.push({ spawns: w4 });

  // W5 — MID-BOSS with a featured escort. A leak costs 10 of your 15 castle HP.
  w.push({
    spawns: [
      spawn("grunt", 5, 0.5 * c),
      spawn("brute", 1 + Math.floor(d / 3), 1.5 * c, 2),
      spawn(f, 2 + Math.floor(d / 3), 1.1 * c, 3),
      spawn(midBoss, 1, 1, 6),
    ],
  });

  // W6 — juggernaut wall: forces a second damage type (two walls on stages 9-10).
  const w6: SpawnEntry[] = [
    spawn("grunt", 7 + d, 0.5 * c),
    spawn(f, 2 + Math.floor(d / 2), 0.9 * c, 2),
  ];
  if (p.wall) w6.push(spawn(p.wall, d >= 9 ? 2 : 1, 2.5 * c, 4));
  w.push({ spawns: w6 });

  // W7 — tower-threat / speed pressure: protect the back line; sappers late.
  const w7: SpawnEntry[] = [
    spawn("runner", 9 + d, 0.4 * c),
    spawn("raider", 1 + Math.floor(d / 2), 1.8 * c, 2),
    spawn(f, 2 + Math.floor(d / 2), 1.0 * c, 3),
  ];
  if (d >= 6) w7.push(spawn("sapper", 1 + Math.floor(d / 3), 1.5 * c, 4));
  w.push({ spawns: w7 });

  // W8 — sky + a priority-kill support. Getting hard.
  const w8: SpawnEntry[] = [
    spawn("gargoyle", 3 + Math.ceil(0.7 * d), 0.8 * c),
    spawn("stormflyer", 1 + Math.floor(d / 2), 1.2 * c, 2),
    spawn(f, 2 + Math.floor(d / 2), 1.0 * c, 1),
  ];
  if (p.support) w8.push(spawn(p.support, 1, 1, 4));
  w.push({ spawns: w8 });

  // W9 — THE GAUNTLET: the chapter's throughput exam. Dense mixed elites + both
  // walls + both supports. This is the wave that demands a full, type-diverse board.
  const w9: SpawnEntry[] = [
    spawn("brute", 4 + Math.ceil(0.7 * d), 0.8 * c),
    spawn("regenerator", 2 + Math.floor(d / 2), 1.1 * c, 1),
    spawn("bulwark", 2 + Math.floor(d / 3), 1.2 * c, 2),
    spawn(f, 3 + Math.ceil(0.7 * d), 0.7 * c, 1),
  ];
  if (p.wall) w9.push(spawn(p.wall, 1, 2.5, 3));
  if (p.wall2) w9.push(spawn(p.wall2, 1, 2.5, 4));
  if (p.support) w9.push(spawn(p.support, 1, 1, 2));
  if (p.support2) w9.push(spawn(p.support2, 1, 1, 5));
  w.push({ spawns: w9 });

  // W10 — FINAL BOSS + gauntlet-grade escort.
  const w10: SpawnEntry[] = [
    spawn("grunt", 6, 0.6 * c),
    spawn("brute", 2 + Math.floor(d / 3), 1.8 * c, 2),
    spawn(f, 2 + Math.floor(d / 2), 0.9 * c, 1),
    spawn("regenerator", 1 + Math.floor(d / 3), 1.4 * c, 3),
    spawn("bulwark", 1 + Math.floor(d / 4), 1.5 * c, 4),
  ];
  if (p.wall) w10.push(spawn(p.wall, 1, 2.5, 5));
  if (p.wall2) w10.push(spawn(p.wall2, 1, 2.5, 7));
  if (n >= 7 && p.support) w10.push(spawn(p.support, 1, 1, 6));
  w10.push(spawn(finalBoss, 1, 1, 12));
  w.push({ spawns: w10 });

  return w;
}
