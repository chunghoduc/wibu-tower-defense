import { describe, expect, it } from "vitest";
import { processEnemyKill, killXpFor } from "../src/core/killRewards.ts";
import { createFreshSave } from "../src/core/save.ts";
import { ENEMIES } from "../src/data/enemies.ts";
import { Rng } from "../src/core/rng.ts";

const grunt = ENEMIES.find((e) => e.archetype !== "Boss")!;
const boss = ENEMIES.find((e) => e.archetype === "Boss") ?? grunt;

describe("kill rewards persist per kill", () => {
  it("awards hero XP straight into the save on every kill", () => {
    const save = createFreshSave();
    const before = save.hero.totalXp;
    const r = processEnemyKill(save, grunt, "Normal", 20, new Rng(1));
    expect(r.xp).toBeGreaterThan(0);
    expect(save.hero.totalXp).toBe(before + r.xp);
  });

  it("scales XP with difficulty and rewards bosses far more", () => {
    expect(killXpFor(grunt, "Nightmare")).toBeGreaterThan(killXpFor(grunt, "Normal"));
    if (boss !== grunt)
      expect(killXpFor(boss, "Normal")).toBeGreaterThan(killXpFor(grunt, "Normal"));
  });

  it("an elite kill always drops exactly one loot box into materials", () => {
    const save = createFreshSave();
    const r = processEnemyKill(save, grunt, "Normal", 30, new Rng(11), true);
    expect(r.boxDropped).toMatch(/^boss-box-t[1-5]$/);
    expect(save.materials[r.boxDropped!]).toBe(1);
  });

  it("a non-elite kill never drops a box", () => {
    const save = createFreshSave();
    for (let seed = 0; seed < 50; seed++) {
      const r = processEnemyKill(save, grunt, "Normal", 30, new Rng(seed));
      expect(r.boxDropped).toBeNull();
    }
  });

  it("occasionally drops an item into the inventory over many kills", () => {
    const save = createFreshSave();
    let drops = 0;
    for (let seed = 0; seed < 400; seed++) {
      const before = save.inventory.items.length;
      const r = processEnemyKill(save, grunt, "Normal", 30, new Rng(seed));
      if (r.itemDropped) {
        drops++;
        expect(save.inventory.items.length).toBe(before + 1);
      }
    }
    expect(drops).toBeGreaterThan(0); // small chance, but present over 400 kills
  });
});
