import { describe, expect, it, beforeEach } from "vitest";
import { SaveManager } from "../src/core/saveManager.ts";
import { LocalSaveProvider } from "../src/core/save.ts";
import { Rng } from "../src/core/rng.ts";

const store: Record<string, string> = {};
const mockStorage = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
};

describe("SaveManager", () => {
  let manager: SaveManager;

  beforeEach(() => {
    Object.keys(store).forEach((k) => delete store[k]);
    manager = new SaveManager(new LocalSaveProvider(mockStorage as unknown as Storage));
  });

  it("getSave returns fresh save on first use", () => {
    const save = manager.getSave();
    expect(save.hero.level).toBe(1);
    expect(save.version).toBe(5);
  });

  it("afterBattle awards crystals and persists", () => {
    const result = manager.afterBattle("stage-1", "won", "Normal", new Rng(1));
    expect(result).not.toBeNull();
    expect(result!.crystalsAwarded).toBeGreaterThan(0);
    const reloaded = new SaveManager(new LocalSaveProvider(mockStorage as unknown as Storage));
    expect(reloaded.getSave().currency.crystals).toBeGreaterThan(0);
  });

  it("afterBattle returns null on loss", () => {
    expect(manager.afterBattle("stage-1", "lost", "Normal", new Rng(1))).toBeNull();
  });

  it("afterSummon with 10 returns 10 results", () => {
    manager.getSave().currency.crystals = 1600;
    manager["persist"]();
    const results = manager.afterSummon(10, new Rng(42));
    expect(results).toHaveLength(10);
  });

  it("grantDailyLogin gives crystals once per day", () => {
    expect(manager.grantDailyLogin("2026-06-06")).toBe(10);
    expect(manager.grantDailyLogin("2026-06-06")).toBe(0);
    expect(manager.grantDailyLogin("2026-06-07")).toBe(10);
  });

  describe("respec (forget / reset passive points)", () => {
    // Grant points then allocate the chain grid-start → brawler-p1 → brawler-p2.
    const allocateChain = (m: SaveManager) => {
      m.getSave().hero.skillPoints = 5;
      m["persist"]();
      expect(m.unlockPassiveNode("grid-start")).toBe(true);
      expect(m.unlockPassiveNode("brawler-p1")).toBe(true);
      expect(m.unlockPassiveNode("brawler-p2")).toBe(true);
    };

    it("forgetPassiveNode refunds a point and removes a forgettable leaf", () => {
      allocateChain(manager);
      const before = manager.getSave().hero.skillPoints;
      expect(manager.forgetPassiveNode("brawler-p2")).toBe(true);
      expect(manager.getSave().hero.skillPoints).toBe(before + 1);
      expect(manager.getSave().hero.unlockedNodes).not.toContain("brawler-p2");
      expect(manager.getSave().hero.unlockedNodes).toContain("brawler-p1");
    });

    it("forgetPassiveNode refuses to orphan the tree (interior node) and changes nothing", () => {
      allocateChain(manager);
      const before = manager.getSave().hero.skillPoints;
      expect(manager.forgetPassiveNode("brawler-p1")).toBe(false);
      expect(manager.getSave().hero.skillPoints).toBe(before);
      expect(manager.getSave().hero.unlockedNodes).toContain("brawler-p1");
    });

    it("forgetPassiveNode persists the refund across reloads", () => {
      allocateChain(manager);
      manager.forgetPassiveNode("brawler-p2");
      const reloaded = new SaveManager(new LocalSaveProvider(mockStorage as unknown as Storage));
      expect(reloaded.getSave().hero.unlockedNodes).not.toContain("brawler-p2");
    });

    it("resetPassiveTree refunds every spent point and clears all nodes", () => {
      allocateChain(manager);
      const before = manager.getSave().hero.skillPoints; // 5 - 3 spent = 2
      const refunded = manager.resetPassiveTree();
      expect(refunded).toBe(3);
      expect(manager.getSave().hero.skillPoints).toBe(before + 3);
      expect(manager.getSave().hero.unlockedNodes).toEqual([]);
    });
  });
});
