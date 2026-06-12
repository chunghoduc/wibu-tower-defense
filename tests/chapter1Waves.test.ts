import { describe, expect, it } from "vitest";
import { progressionScaling } from "../src/core/progressionScaling.ts";
import { buildChapter1Waves, CH1_PLANS } from "../src/data/chapter1Waves.ts";
import { ENEMIES } from "../src/data/enemies.ts";
import type { WaveDef } from "../src/data/schema.ts";
import { STAGES as STAGE_DEFS } from "../src/data/stage.ts";

const byId = new Map(ENEMIES.map((e) => [e.id, e]));
const isBoss = (id: string) => byId.get(id)?.archetype === "Boss";
/** Effective-HP proxy: maxHp + any shield. Enough to rank wave toughness. */
const ehp = (id: string) => {
  const e = byId.get(id);
  return e ? e.baseStats.maxHp + (e.special?.shieldHp ?? 0) : 0;
};
/** Total non-boss toughness of a wave (the throughput the board must chew). */
const trashThreat = (wave: WaveDef) =>
  wave.spawns.filter((s) => !isBoss(s.enemyId)).reduce((t, s) => t + s.count * ehp(s.enemyId), 0);

/** Trash threat excluding the stage's featured archetype — the stage "chassis".
 *  Features rotate (gargoyle 58 ehp vs bulwark 250 ehp), so raw threat zig-zags
 *  by design; the chassis is what must grow strictly stage over stage. */
const chassisThreat = (waves: WaveDef[], feature: string) =>
  waves.reduce(
    (t, w) =>
      t +
      w.spawns
        .filter((s) => !isBoss(s.enemyId) && s.enemyId !== feature)
        .reduce((u, s) => u + s.count * ehp(s.enemyId), 0),
    0,
  );

/** Total trash threat of a full stage (all 10 waves). */
const stageThreat = (waves: WaveDef[]) => waves.reduce((t, w) => t + trashThreat(w), 0);

// Boss for stage n is the nth entry; mid-boss is the previous tier.
const BOSSES = [
  "champion",
  "zabro",
  "ryomen",
  "kura",
  "warden",
  "akai",
  "mukade",
  "madarok",
  "overlord",
  "meruon",
];
const wavesFor = (n: number) => buildChapter1Waves(n, BOSSES[n - 1], BOSSES[Math.max(0, n - 2)]);

const STAGES = Array.from({ length: 10 }, (_, i) => i + 1);

describe("chapter 1 wave design", () => {
  it("every stage has exactly 10 waves", () => {
    for (const n of STAGES) expect(wavesFor(n).length, `stage ${n}`).toBe(10);
  });

  it("wave 5 and wave 10 are the only boss waves, and both have a boss", () => {
    for (const n of STAGES) {
      const w = wavesFor(n);
      w.forEach((wave, i) => {
        const hasBoss = wave.spawns.some((s) => isBoss(s.enemyId));
        const expectBoss = i === 4 || i === 9;
        expect(hasBoss, `stage ${n} wave ${i + 1}`).toBe(expectBoss);
      });
    }
  });

  it("the opener (wave 1) is a pure-rusher warm-up", () => {
    for (const n of STAGES) {
      for (const s of wavesFor(n)[0].spawns) {
        expect(byId.get(s.enemyId)?.archetype, `stage ${n} W1 ${s.enemyId}`).toBe("Rusher");
      }
    }
  });

  it("wave 1 is the lightest wave and wave 9 is the heaviest (easy -> super hard)", () => {
    for (const n of STAGES) {
      const threats = wavesFor(n).map(trashThreat);
      const w1 = threats[0];
      const w9 = threats[8];
      expect(w1, `stage ${n}: W1 should be the minimum`).toBe(Math.min(...threats));
      expect(w9, `stage ${n}: W9 should be the maximum`).toBe(Math.max(...threats));
    }
  });

  it("the wave-9 gauntlet is at least 3x the opener's threat", () => {
    for (const n of STAGES) {
      const threats = wavesFor(n).map(trashThreat);
      expect(threats[8], `stage ${n}`).toBeGreaterThanOrEqual(3 * threats[0]);
    }
  });

  it("walls are permanent from stage 5 and supports from stage 3 (composition curve)", () => {
    for (const n of STAGES) {
      const p = CH1_PLANS[n - 1];
      expect(p.wall !== null, `stage ${n} wall`).toBe(n >= 5);
      expect(p.support !== null, `stage ${n} support`).toBe(n >= 3);
      expect(p.support2 !== null, `stage ${n} support2`).toBe(n >= 9);
    }
  });

  it("scaled chassis threat strictly increases stage over stage (monotonic law)", () => {
    const scaled = STAGES.map(
      (n) => chassisThreat(wavesFor(n), CH1_PLANS[n - 1].feature) * progressionScaling(n).hpMult,
    );
    for (let i = 1; i < scaled.length; i++) {
      expect(scaled[i], `stage ${i + 1} vs ${i}`).toBeGreaterThan(scaled[i - 1]);
    }
  });

  it("a harder stage 10 still sits below procedural stage 11 (chapter ordering)", () => {
    const s10 = stageThreat(wavesFor(10)) * progressionScaling(10).hpMult;
    const s11 = stageThreat(STAGE_DEFS[10].waves) * progressionScaling(11).hpMult;
    expect(s10).toBeLessThan(s11);
  });

  it("later stages spawn faster (cadence pressure), stage 1 keeps the tutorial pace", () => {
    const i1 = wavesFor(1)[0].spawns[0].interval ?? 1;
    const i10 = wavesFor(10)[0].spawns[0].interval ?? 1;
    expect(i1).toBeCloseTo(1.0, 5);
    expect(i10).toBeLessThanOrEqual(0.56);
  });

  it("the chapter's hardest stages (9-10) force both damage types in the gauntlet", () => {
    for (const n of [9, 10]) {
      const w9 = wavesFor(n)[8];
      const physImmune = w9.spawns.some((s) => byId.get(s.enemyId)?.immunity === "Physical");
      const magicImmune = w9.spawns.some((s) => byId.get(s.enemyId)?.immunity === "Magic");
      expect(physImmune, `stage ${n} W9 needs a Physical-immune wall`).toBe(true);
      expect(magicImmune, `stage ${n} W9 needs a Magic-immune wall`).toBe(true);
    }
  });
});
