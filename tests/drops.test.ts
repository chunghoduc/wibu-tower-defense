import { describe, expect, it } from "vitest";
import { processStageClear, CRYSTAL_REWARD } from "../src/core/drops.ts";
import { createFreshSave } from "../src/core/save.ts";
import { Rng } from "../src/core/rng.ts";

describe("processStageClear", () => {
  it("awards crystals on win", () => {
    const save = createFreshSave();
    const result = processStageClear(save, "stage-1", "Normal", new Rng(1));
    expect(result.crystalsAwarded).toBeGreaterThanOrEqual(CRYSTAL_REWARD.Normal);
    expect(save.currency.crystals).toBe(result.crystalsAwarded);
  });

  it("awards first-clear bonus once", () => {
    const save = createFreshSave();
    const first = processStageClear(save, "stage-1", "Normal", new Rng(1));
    expect(first.isFirstClear).toBe(true);
    const second = processStageClear(save, "stage-1", "Normal", new Rng(2));
    expect(second.isFirstClear).toBe(false);
    expect(second.crystalsAwarded).toBe(CRYSTAL_REWARD.Normal);
  });

  it("records stage clear in progress", () => {
    const save = createFreshSave();
    processStageClear(save, "stage-5", "Hard", new Rng(1));
    expect(save.progress.stageClearMap["stage-5"]?.Hard).toBe(true);
    expect(save.progress.stageClearMap["stage-5"]?.Normal).toBeFalsy();
  });

  it("Hard gives more crystals than Normal (second clear, no bonus)", () => {
    const saveN = createFreshSave();
    const saveH = createFreshSave();
    processStageClear(saveN, "s", "Normal", new Rng(1));
    processStageClear(saveH, "s", "Hard", new Rng(1));
    const n = processStageClear(saveN, "s", "Normal", new Rng(99));
    const h = processStageClear(saveH, "s", "Hard", new Rng(99));
    expect(h.crystalsAwarded).toBeGreaterThan(n.crystalsAwarded);
  });

  it("may drop an item over 100 runs", () => {
    let dropped = false;
    for (let seed = 0; seed < 100 && !dropped; seed++) {
      const save = createFreshSave();
      if (processStageClear(save, "s", "Normal", new Rng(seed)).itemDropped) dropped = true;
    }
    expect(dropped).toBe(true);
  });
});
