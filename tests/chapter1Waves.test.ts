import { describe, expect, it } from "vitest";
import { buildChapter1Waves } from "../src/data/chapter1Waves.ts";
import { ENEMIES } from "../src/data/enemies.ts";
import type { WaveDef } from "../src/data/schema.ts";

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
