import { describe, expect, it } from "vitest";
import { processStageClear, CRYSTAL_REWARD } from "../src/core/drops.ts";
import { createFreshSave } from "../src/core/save.ts";
import { Rng } from "../src/core/rng.ts";
import { boxIdForTier, OBLIVION_ORB } from "../src/data/materials.ts";
import { boxTierForStage } from "../src/data/stage.ts";

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

  it("boss box is guaranteed on first clear, then drops dramatically", () => {
    const save = createFreshSave();
    const boxId = boxIdForTier(boxTierForStage("stage-1"));
    const first = processStageClear(save, "stage-1", "Normal", new Rng(1));
    expect(first.isFirstClear).toBe(true);
    expect(first.materialsDropped[boxId]).toBe(1); // 100% on first defeat

    // Repeat clears: the box becomes a rare bonus, far below every-time.
    const N = 200;
    let boxes = 0;
    for (let seed = 0; seed < N; seed++) {
      const r = processStageClear(save, "stage-1", "Normal", new Rng(seed));
      expect(r.isFirstClear).toBe(false);
      if (r.materialsDropped[boxId]) boxes++;
    }
    expect(boxes).toBeLessThan(N * 0.3); // dramatically lower than 100%
    expect(boxes).toBeGreaterThan(0);    // but still occasionally drops
  });

  it("drops the Oblivion Orb rarely (>0 but well under 10% across many clears)", () => {
    const N = 600;
    let orbs = 0;
    for (let seed = 0; seed < N; seed++) {
      const save = createFreshSave();
      const r = processStageClear(save, "stage-3", "Normal", new Rng(seed));
      if (r.materialsDropped[OBLIVION_ORB]) orbs++;
    }
    expect(orbs).toBeGreaterThan(0);        // it is obtainable
    expect(orbs).toBeLessThan(N * 0.1);     // but a rare drop
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
