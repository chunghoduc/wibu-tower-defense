import { describe, expect, it, beforeEach } from "vitest";
import { SaveManager, RESPEC_DIAMOND_COST } from "../src/core/saveManager.ts";
import { LocalSaveProvider, CURRENT_SAVE_VERSION } from "../src/core/save.ts";
import { Rng } from "../src/core/rng.ts";
import { OBLIVION_ORB } from "../src/data/materials.ts";
import { STARTER_SKILL_IDS, MAX_ACTIVE_SKILLS } from "../src/data/skills.ts";

const store: Record<string, string> = {};
const mockStorage = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => {
    store[k] = v;
  },
  removeItem: (k: string) => {
    delete store[k];
  },
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
    expect(save.version).toBe(CURRENT_SAVE_VERSION);
  });

  describe("fresh-save starter skills", () => {
    it("equips exactly one active skill at the beginning", () => {
      const save = manager.getSave();
      expect(save.hero.equippedSkillIds).toHaveLength(1);
      expect(save.hero.equippedSkillIds.length).toBeLessThanOrEqual(MAX_ACTIVE_SKILLS);
    });

    it("equips the first starter skill", () => {
      expect(manager.getSave().hero.equippedSkillIds[0]).toBe(STARTER_SKILL_IDS[0]);
    });

    it("still owns both weapon-free starter skills", () => {
      const owned = manager.getSave().hero.obtainedSkills.map((s) => s.skillId);
      for (const id of STARTER_SKILL_IDS) expect(owned).toContain(id);
    });
  });

  it("afterBattle awards crystals and persists", () => {
    const result = manager.afterBattle("stage-1", "won", "Normal", new Rng(1));
    expect(result).not.toBeNull();
    expect(result!.goldAwarded).toBeGreaterThan(0);
    const reloaded = new SaveManager(new LocalSaveProvider(mockStorage as unknown as Storage));
    expect(reloaded.getSave().currency.gold).toBeGreaterThan(0);
  });

  it("afterBattle returns null on loss", () => {
    expect(manager.afterBattle("stage-1", "lost", "Normal", new Rng(1))).toBeNull();
  });

  it("afterSummon with 10 returns 10 results", () => {
    manager.getSave().currency.diamonds = 1600;
    manager["persist"]();
    const results = manager.afterSummon(10, new Rng(42));
    expect(results).toHaveLength(10);
  });

  describe("free summon (8-hour timer)", () => {
    const HOUR = 60 * 60 * 1000;

    it("is available on a fresh save", () => {
      expect(manager.freeSummonAvailable(1_000_000)).toBe(true);
    });

    it("claims a summon and restarts the 8-hour timer", () => {
      const now = 1_000_000;
      const result = manager.claimFreeSummon(now, new Rng(7));
      expect(result).not.toBeNull();
      expect(manager.freeSummonAvailable(now)).toBe(false);
      expect(manager.freeSummonAvailable(now + 7 * HOUR)).toBe(false);
      expect(manager.freeSummonAvailable(now + 8 * HOUR)).toBe(true);
    });

    it("does not cost diamonds", () => {
      manager.getSave().currency.diamonds = 0;
      manager["persist"]();
      manager.claimFreeSummon(1_000_000, new Rng(3));
      expect(manager.getSave().currency.diamonds).toBe(0);
    });

    it("returns null while on cooldown (never banks more than one)", () => {
      const now = 1_000_000;
      manager.claimFreeSummon(now, new Rng(1));
      expect(manager.claimFreeSummon(now + 1, new Rng(2))).toBeNull();
      // Even long after, only one becomes available — no stacking.
      expect(manager.claimFreeSummon(now + 100 * HOUR, new Rng(2))).not.toBeNull();
      expect(manager.claimFreeSummon(now + 100 * HOUR + 1, new Rng(2))).toBeNull();
    });

    it("persists the timer across reloads", () => {
      const now = 1_000_000;
      manager.claimFreeSummon(now, new Rng(1));
      const reloaded = new SaveManager(new LocalSaveProvider(mockStorage as unknown as Storage));
      expect(reloaded.freeSummonAvailable(now + HOUR)).toBe(false);
    });
  });

  describe("scroll-priority summons", () => {
    it("useSummonScrollsMulti spends 10 scrolls for 10 results, no diamonds", () => {
      manager.addMaterial("summon-scroll", 12);
      manager.getSave().currency.diamonds = 0;
      manager["persist"]();
      const results = manager.useSummonScrollsMulti(10, new Rng(5));
      expect(results).toHaveLength(10);
      expect(manager.getSave().materials["summon-scroll"]).toBe(2);
      expect(manager.getSave().currency.diamonds).toBe(0);
    });

    it("useSummonScrollsMulti returns null with fewer than 10 scrolls", () => {
      manager.addMaterial("summon-scroll", 9);
      manager["persist"]();
      expect(manager.useSummonScrollsMulti(10, new Rng(5))).toBeNull();
      expect(manager.getSave().materials["summon-scroll"]).toBe(9);
    });
  });

  it("grantDailyLogin gives crystals once per day", () => {
    expect(manager.grantDailyLogin("2026-06-06")).toBe(50);
    expect(manager.grantDailyLogin("2026-06-06")).toBe(0);
    expect(manager.grantDailyLogin("2026-06-07")).toBe(50);
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

    it("forgetPassiveNode spends one Oblivion Orb, refunds a point and removes a forgettable leaf", () => {
      allocateChain(manager);
      manager.addMaterial(OBLIVION_ORB, 2);
      const before = manager.getSave().hero.skillPoints;
      expect(manager.forgetPassiveNode("brawler-p2")).toBe(true);
      expect(manager.getSave().hero.skillPoints).toBe(before + 1);
      expect(manager.getSave().hero.unlockedNodes).not.toContain("brawler-p2");
      expect(manager.getSave().hero.unlockedNodes).toContain("brawler-p1");
      expect(manager.getMaterial(OBLIVION_ORB)).toBe(1); // one orb spent
    });

    it("forgetPassiveNode refuses without an Oblivion Orb and changes nothing", () => {
      allocateChain(manager);
      const before = manager.getSave().hero.skillPoints;
      expect(manager.forgetPassiveNode("brawler-p2")).toBe(false);
      expect(manager.getSave().hero.skillPoints).toBe(before);
      expect(manager.getSave().hero.unlockedNodes).toContain("brawler-p2");
    });

    it("forgetPassiveNode refuses to orphan the tree (interior node) and keeps the orb", () => {
      allocateChain(manager);
      manager.addMaterial(OBLIVION_ORB, 1);
      const before = manager.getSave().hero.skillPoints;
      expect(manager.forgetPassiveNode("brawler-p1")).toBe(false);
      expect(manager.getSave().hero.skillPoints).toBe(before);
      expect(manager.getSave().hero.unlockedNodes).toContain("brawler-p1");
      expect(manager.getMaterial(OBLIVION_ORB)).toBe(1); // no orb wasted on a rejected forget
    });

    it("forgetPassiveNode persists the refund across reloads", () => {
      allocateChain(manager);
      manager.addMaterial(OBLIVION_ORB, 1);
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

    it("respecWithDiamonds spends RESPEC_DIAMOND_COST and refunds the whole tree", () => {
      allocateChain(manager);
      manager.getSave().currency.diamonds = RESPEC_DIAMOND_COST + 100;
      const before = manager.getSave().hero.skillPoints;
      expect(manager.respecWithDiamonds()).toBe(3);
      expect(manager.getSave().hero.skillPoints).toBe(before + 3);
      expect(manager.getSave().hero.unlockedNodes).toEqual([]);
      expect(manager.getSave().currency.diamonds).toBe(100); // cost deducted
    });

    it("respecWithDiamonds returns -1 and changes nothing when too poor", () => {
      allocateChain(manager);
      manager.getSave().currency.diamonds = RESPEC_DIAMOND_COST - 1;
      const before = manager.getSave().hero.skillPoints;
      expect(manager.respecWithDiamonds()).toBe(-1);
      expect(manager.getSave().hero.skillPoints).toBe(before);
      expect(manager.getSave().hero.unlockedNodes).toContain("grid-start");
    });

    it("respecWithDiamonds does not charge when nothing is allocated", () => {
      manager.getSave().currency.diamonds = RESPEC_DIAMOND_COST;
      expect(manager.respecWithDiamonds()).toBe(0);
      expect(manager.getSave().currency.diamonds).toBe(RESPEC_DIAMOND_COST); // diamonds kept
    });
  });

  describe("jewels", () => {
    // Pretend the socket is allocated (the unlock flow is covered elsewhere).
    const allocateSocket = (m: SaveManager) => {
      m.getSave().hero.unlockedNodes = ["brawler-jewel-1"];
    };

    it("grantJewel adds an owned jewel instance", () => {
      const inst = manager.grantJewel("crimson-shard");
      expect(inst.defId).toBe("crimson-shard");
      expect(manager.getSave().hero.jewels).toContainEqual(inst);
    });

    it("socketJewel places an owned jewel into an allocated jewel-socket", () => {
      const inst = manager.grantJewel("crimson-shard");
      allocateSocket(manager);
      expect(manager.socketJewel("brawler-jewel-1", inst.id)).toBe(true);
      expect(manager.getSave().hero.socketedJewels["brawler-jewel-1"]).toBe(inst.id);
    });

    it("socketJewel rejects an un-allocated socket", () => {
      const inst = manager.grantJewel("crimson-shard");
      expect(manager.socketJewel("brawler-jewel-1", inst.id)).toBe(false);
    });

    it("socketJewel rejects a node that isn't a jewel socket", () => {
      const inst = manager.grantJewel("crimson-shard");
      manager.getSave().hero.unlockedNodes = ["grid-start"];
      expect(manager.socketJewel("grid-start", inst.id)).toBe(false);
    });

    it("socketJewel rejects when the socket already holds a jewel", () => {
      const a = manager.grantJewel("crimson-shard");
      const b = manager.grantJewel("honed-edge");
      allocateSocket(manager);
      manager.socketJewel("brawler-jewel-1", a.id);
      expect(manager.socketJewel("brawler-jewel-1", b.id)).toBe(false);
    });

    it("discardJewel destroys the jewel forever and clears its socket", () => {
      const inst = manager.grantJewel("crimson-shard");
      allocateSocket(manager);
      manager.socketJewel("brawler-jewel-1", inst.id);
      expect(manager.discardJewel(inst.id)).toBe(true);
      expect(manager.getSave().hero.jewels.some((j) => j.id === inst.id)).toBe(false);
      expect(manager.getSave().hero.socketedJewels["brawler-jewel-1"]).toBeUndefined();
    });

    it("unsocketJewel frees the socket but keeps the jewel owned", () => {
      const inst = manager.grantJewel("crimson-shard");
      allocateSocket(manager);
      manager.socketJewel("brawler-jewel-1", inst.id);
      expect(manager.unsocketJewel("brawler-jewel-1")).toBe(true);
      expect(manager.getSave().hero.socketedJewels["brawler-jewel-1"]).toBeUndefined();
      expect(manager.getSave().hero.jewels.some((j) => j.id === inst.id)).toBe(true);
    });

    it("persists socketed jewels across reloads", () => {
      const inst = manager.grantJewel("crimson-shard");
      allocateSocket(manager);
      manager["persist"]();
      manager.socketJewel("brawler-jewel-1", inst.id);
      const reloaded = new SaveManager(new LocalSaveProvider(mockStorage as unknown as Storage));
      expect(reloaded.getSave().hero.socketedJewels["brawler-jewel-1"]).toBe(inst.id);
    });
  });
});
