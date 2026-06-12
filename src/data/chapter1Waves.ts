/**
 * Chapter 1 — per-stage wave design, authored ONE STAGE AT A TIME.
 *
 * Every chapter-1 stage runs the same 10-wave arc — a deliberate easy → super
 * hard climb — but each stage spotlights a DIFFERENT archetype so the chapter
 * teaches one answer at a time (rushers → air → armor → sustain → walls → …),
 * and the hardest stages stack BOTH juggernaut walls plus a support so the
 * finale needs a full, type-diverse board (no single tower type clears it).
 *
 * The arc inside one stage:
 *   W1  warm-up — pure rushers, slow cadence (always trivial)
 *   W2  introduce the stage's featured archetype, still light
 *   W3  first armor — a touch of single-target / penetration
 *   W4  swarm bump — density climbs
 *   W5  MID-BOSS (a leak costs 10 of 15 castle HP)
 *   W6  first juggernaut wall — forces a 2nd damage type onto the board
 *   W7  speed / tower-threat pressure — protect the back line
 *   W8  sky + a priority-kill support — getting hard
 *   W9  THE GAUNTLET — dense mixed elites + both walls + support (the "many
 *       towers" exam; the intra-stage stat ramp in waveScaling.ts piles on top)
 *   W10 FINAL BOSS + heavy escort
 *
 * Density rises with the stage number `n`, so later stages fill the same arc
 * with denser, meaner waves. Bosses appear ONLY on waves 5 and 10 — the
 * structure the rest of the game (and tests/waveStructure.test.ts) relies on.
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
}

/**
 * One entry per chapter-1 stage (1→10), tuned individually. The progression of
 * featured archetypes is the chapter's teaching curve; walls/supports enter
 * later and stack on the final two stages for the full-coverage exam.
 */
const CH1_PLANS: Ch1Plan[] = [
  { feature: "grunt", wall: null, wall2: null, support: null }, // 1 — basics: place towers, hold a swarm
  { feature: "gargoyle", wall: null, wall2: null, support: null }, // 2 — air: you need anti-air
  { feature: "bulwark", wall: null, wall2: null, support: "herald" }, // 3 — armor: single-target / penetration
  { feature: "slime", wall: null, wall2: null, support: "mender" }, // 4 — splitters + a healer to burst
  { feature: "regenerator", wall: "golem", wall2: null, support: null }, // 5 — first wall: bring magic damage
  { feature: "sapper", wall: null, wall2: null, support: "herald" }, // 6 — protect your towers
  { feature: "phantom", wall: "monolith", wall2: null, support: "summoner" }, // 7 — stealth + adds: hero / AoE
  { feature: "stormflyer", wall: null, wall2: null, support: "hexer" }, // 8 — sky storm + kill the hexer
  { feature: "regenerator", wall: "golem", wall2: "monolith", support: "hexer" }, // 9 — BOTH walls
  { feature: "phantom", wall: "golem", wall2: "monolith", support: "summoner" }, // 10 — the exam: everything
];

/**
 * Build the 10-wave arc for chapter-1 stage `n` (1-based). `finalBoss` fronts
 * wave 10; `midBoss` fronts wave 5 (a notch easier — the previous tier).
 */
export function buildChapter1Waves(n: number, finalBoss: string, midBoss: string): WaveDef[] {
  const p = CH1_PLANS[n - 1] ?? CH1_PLANS[CH1_PLANS.length - 1];
  const d = n; // density knob: more enemies per wave on later stages
  const f = p.feature;
  const w: WaveDef[] = [];

  // W1 — warm-up: pure rushers, slow cadence. Always easy.
  w.push({ spawns: [spawn("grunt", 4 + Math.floor(d / 2), 1.0)] });

  // W2 — introduce the stage's featured archetype, still light.
  w.push({
    spawns: [spawn("grunt", 4 + Math.floor(d / 2), 0.9), spawn(f, 2 + Math.floor(d / 2), 1.2, 3)],
  });

  // W3 — first armor: demands a little single-target / penetration.
  w.push({
    spawns: [
      spawn("brute", 1 + Math.floor(d / 3), 1.4),
      spawn("bulwark", 1 + Math.floor(d / 4), 1.4, 2),
      spawn(f, 2 + Math.floor(d / 2), 1.0, 1),
    ],
  });

  // W4 — swarm bump: density climbs.
  w.push({
    spawns: [spawn("runner", 6 + d, 0.5), spawn("gargoyle", 2 + Math.floor(d / 3), 0.9, 2)],
  });

  // W5 — MID-BOSS. A leak here costs 10 of your 15 castle HP.
  w.push({
    spawns: [
      spawn("grunt", 5, 0.5),
      spawn("brute", 1 + Math.floor(d / 4), 1.5, 2),
      spawn(midBoss, 1, 1, 6),
    ],
  });

  // W6 — first juggernaut wall: forces a second damage type onto the board.
  const w6: SpawnEntry[] = [spawn("grunt", 6 + d, 0.5), spawn(f, 2 + Math.floor(d / 2), 0.9, 2)];
  if (p.wall) w6.push(spawn(p.wall, 1, 2.5, 4));
  w.push({ spawns: w6 });

  // W7 — tower-threat / speed pressure: protect the back line.
  w.push({
    spawns: [
      spawn("runner", 8 + d, 0.4),
      spawn("raider", 1 + Math.floor(d / 3), 1.8, 2),
      spawn(f, 2 + Math.floor(d / 2), 1.0, 3),
    ],
  });

  // W8 — sky + a priority-kill support. Getting hard.
  const w8: SpawnEntry[] = [
    spawn("gargoyle", 3 + Math.floor(d / 2), 0.8),
    spawn("stormflyer", 1 + Math.floor(d / 3), 1.2, 2),
    spawn(f, 2 + Math.floor(d / 2), 1.0, 1),
  ];
  if (p.support) w8.push(spawn(p.support, 1, 1, 4));
  w.push({ spawns: w8 });

  // W9 — THE GAUNTLET: the chapter's throughput exam. Dense mixed elites + both
  // walls + a support. This is the wave that demands a full, type-diverse board.
  const w9: SpawnEntry[] = [
    spawn("brute", 3 + Math.floor(d / 2), 0.8),
    spawn("regenerator", 2 + Math.floor(d / 3), 1.1, 1),
    spawn("bulwark", 2 + Math.floor(d / 4), 1.2, 2),
    spawn(f, 3 + Math.floor(d / 2), 0.7, 1),
  ];
  if (p.wall) w9.push(spawn(p.wall, 1, 2.5, 3));
  if (p.wall2) w9.push(spawn(p.wall2, 1, 2.5, 4));
  if (p.support) w9.push(spawn(p.support, 1, 1, 2));
  w.push({ spawns: w9 });

  // W10 — FINAL BOSS + heavy escort.
  const w10: SpawnEntry[] = [
    spawn("grunt", 6, 0.6),
    spawn("brute", 2 + Math.floor(d / 4), 1.8, 2),
    spawn(f, 2 + Math.floor(d / 2), 0.9, 1),
  ];
  if (p.wall) w10.push(spawn(p.wall, 1, 2.5, 5));
  w10.push(spawn(finalBoss, 1, 1, 12));
  w.push({ spawns: w10 });

  return w;
}
