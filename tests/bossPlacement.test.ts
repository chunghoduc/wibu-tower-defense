import { describe, expect, it } from "vitest";
import { BOSS_BY_STAGE, midBossFor } from "../src/data/stage.ts";
import { ENEMIES } from "../src/data/enemies.ts";

const NEW = [
  "gravemourn", "vindicator", "sundermark", "crownfall", "unkilling",
  "mawborn", "devourer", "crimsonlord", "fallenward", "ashghost",
];
const hp = (id: string) => ENEMIES.find((e) => e.id === id)!.baseStats.maxHp;

describe("Antihero Gallery — stage placement", () => {
  it("BOSS_BY_STAGE covers all 30 stages", () => {
    expect(BOSS_BY_STAGE.length).toBe(30);
  });
  it("every new boss headlines at least one stage", () => {
    for (const id of NEW) expect(BOSS_BY_STAGE, id).toContain(id);
  });
  it("ashghost is the stage-30 final boss (the game's apex)", () => {
    expect(BOSS_BY_STAGE[29]).toBe("ashghost");
  });
  it("within the expansion (stages 11-30) no boss repeats more than twice", () => {
    // Chapter 1 (stages 1-10) is fixed and out of scope; this feature controls the
    // expansion roster, where the old build recycled the same ~6 bosses 3-4x each.
    const expansion = BOSS_BY_STAGE.slice(10); // stages 11-30
    const counts = new Map<string, number>();
    for (const id of expansion) counts.set(id, (counts.get(id) ?? 0) + 1);
    for (const [id, c] of counts) expect(c, id).toBeLessThanOrEqual(2);
  });
  it("the new bosses headline the majority of expansion finales (fresh faces)", () => {
    const expansion = BOSS_BY_STAGE.slice(10); // 20 stages
    const fresh = expansion.filter((id) => NEW.includes(id)).length;
    expect(fresh).toBeGreaterThanOrEqual(12); // > half are brand-new bosses
  });
});

describe("Difficulty monotonic law", () => {
  it("within every chapter (5 stages) the finale bosses ascend by base HP", () => {
    for (let ch = 0; ch < 6; ch++) {
      const slice = BOSS_BY_STAGE.slice(ch * 5, ch * 5 + 5);
      for (let i = 1; i < slice.length; i++) {
        expect(hp(slice[i]), `ch${ch + 1} stage ${i + 1}: ${slice[i]} (${hp(slice[i])}) < ${slice[i - 1]} (${hp(slice[i - 1])})`)
          .toBeGreaterThanOrEqual(hp(slice[i - 1]));
      }
    }
  });
  it("wave-5 mid-boss never out-ranks the wave-10 finale, for all 30 stages", () => {
    for (let n = 1; n <= 30; n++) {
      const final = BOSS_BY_STAGE[n - 1];
      const mid = midBossFor(n);
      expect(hp(mid), `stage ${n}: mid ${mid} (${hp(mid)}) > final ${final} (${hp(final)})`)
        .toBeLessThanOrEqual(hp(final));
    }
  });
});
