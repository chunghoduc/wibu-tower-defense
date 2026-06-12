import { describe, expect, it } from "vitest";
import { createFreshSave, loadAndMigrate, CURRENT_SAVE_VERSION } from "../src/core/save.ts";
import { defaultMeta, backfillMeta, isoWeekKey } from "../src/core/meta.ts";

describe("meta save (v10)", () => {
  it("fresh save carries a full meta block", () => {
    const save = createFreshSave();
    expect(save.version).toBe(CURRENT_SAVE_VERSION);
    expect(save.meta).toEqual(defaultMeta());
  });

  it("migrates a v9 save up to v10 with default meta", () => {
    const v9 = { version: 9, hero: { obtainedSkills: [] }, currency: { gold: 0, diamonds: 0 } };
    const migrated = loadAndMigrate(v9);
    expect(migrated.version).toBe(CURRENT_SAVE_VERSION);
    expect(migrated.meta).toEqual(defaultMeta());
  });

  it("backfills a partial meta block without dropping existing data", () => {
    const save = createFreshSave();
    // Simulate a dev save that has only some meta fields.
    (save as unknown as { meta: unknown }).meta = {
      streak: { count: 4, lastClaimDate: "2026-06-01" },
      mastery: { yamo: { xp: 10, level: 1 } },
    };
    const fixed = loadAndMigrate(save);
    expect(fixed.meta.streak.count).toBe(4);
    expect(fixed.meta.streak.best).toBe(0); // defaulted
    expect(fixed.meta.mastery.yamo).toEqual({ xp: 10, level: 1 });
    expect(fixed.meta.banner).toEqual(defaultMeta().banner); // whole missing sub-object defaulted
    expect(fixed.meta.endless.bestWave).toEqual({});
  });

  it("backfillMeta is idempotent", () => {
    const once = backfillMeta(undefined);
    const twice = backfillMeta(once);
    expect(twice).toEqual(once);
  });

  it("isoWeekKey is stable within a week and changes across weeks", () => {
    const mon = isoWeekKey(new Date("2026-06-08T12:00:00Z")); // Monday
    const sun = isoWeekKey(new Date("2026-06-14T12:00:00Z")); // Sunday same ISO week
    const nextMon = isoWeekKey(new Date("2026-06-15T12:00:00Z"));
    expect(mon).toBe(sun);
    expect(nextMon).not.toBe(mon);
    expect(mon).toMatch(/^\d{4}-W\d{2}$/);
  });
});
