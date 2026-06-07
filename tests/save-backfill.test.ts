import { describe, expect, it } from "vitest";
import { loadAndMigrate, CURRENT_SAVE_VERSION } from "../src/core/save.ts";

describe("loadAndMigrate defensive backfill", () => {
  it("backfills materials on a save already stamped at the current version", () => {
    // Repro of the crash: a save persisted AT version 5 but missing `materials`
    // skips the `< 5` migration hop, leaving save.materials undefined → giveMat crashes.
    const stale: any = {
      version: CURRENT_SAVE_VERSION,
      inventory: { items: [], equipped: {} },
      hero: { level: 1, obtainedSkills: [] },
      // no materials / collection / squad / currency / progress
    };
    const save = loadAndMigrate(stale);
    expect(save.materials).toBeDefined();
    expect(save.materials["boss-box-t4"]).toBeUndefined();
    save.materials["boss-box-t4"] = (save.materials["boss-box-t4"] ?? 0) + 1; // must not throw
    expect(save.materials["boss-box-t4"]).toBe(1);
  });

  it("backfills all required top-level fields", () => {
    const save = loadAndMigrate({ version: CURRENT_SAVE_VERSION } as any);
    expect(save.collection).toBeDefined();
    expect(save.squad).toBeDefined();
    expect(save.materials).toBeDefined();
    expect(save.currency).toBeDefined();
    expect(save.progress).toBeDefined();
  });

  it("does not clobber existing field data", () => {
    const save = loadAndMigrate({
      version: CURRENT_SAVE_VERSION,
      materials: { "boss-box-t4": 3 },
      squad: ["karu-sunfist"],
    } as any);
    expect(save.materials["boss-box-t4"]).toBe(3);
    expect(save.squad).toEqual(["karu-sunfist"]);
  });
});
