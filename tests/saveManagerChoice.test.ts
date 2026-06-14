import { describe, expect, it, beforeEach } from "vitest";
import { SaveManager } from "../src/core/saveManager.ts";
import { LocalSaveProvider } from "../src/core/save.ts";

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

function freshMgr(): SaveManager {
  Object.keys(store).forEach((k) => delete store[k]);
  const mgr = new SaveManager(new LocalSaveProvider(mockStorage as unknown as Storage));
  const save = mgr.getSave();
  save.hero.level = 50;
  save.hero.skillPoints = 10;
  // brawler-mastery-1's only neighbor — seed it so the node is reachable.
  save.hero.unlockedNodes = ["brawler-notable-1"];
  return mgr;
}

describe("mastery choice via SaveManager", () => {
  let mgr: SaveManager;
  beforeEach(() => {
    mgr = freshMgr();
  });

  it("unlock records the requested choice", () => {
    const ok = mgr.unlockPassiveNode("brawler-mastery-1", "penetration");
    expect(ok).toBe(true);
    expect(mgr.getSave().hero.nodeChoices["brawler-mastery-1"]).toBe("penetration");
  });

  it("unlock without a choiceId defaults to the first option", () => {
    mgr.unlockPassiveNode("brawler-mastery-1");
    expect(mgr.getSave().hero.nodeChoices["brawler-mastery-1"]).toBe("precision");
  });

  it("unlock with an unknown choiceId defaults to the first option", () => {
    mgr.unlockPassiveNode("brawler-mastery-1", "bogus");
    expect(mgr.getSave().hero.nodeChoices["brawler-mastery-1"]).toBe("precision");
  });

  it("setNodeChoice switches an unlocked choice node", () => {
    mgr.unlockPassiveNode("brawler-mastery-1", "precision");
    expect(mgr.setNodeChoice("brawler-mastery-1", "power")).toBe(true);
    expect(mgr.getSave().hero.nodeChoices["brawler-mastery-1"]).toBe("power");
  });

  it("setNodeChoice rejects a locked node, unknown option, or non-choice node", () => {
    expect(mgr.setNodeChoice("brawler-mastery-1", "power")).toBe(false); // not unlocked
    mgr.unlockPassiveNode("brawler-mastery-1", "precision");
    expect(mgr.setNodeChoice("brawler-mastery-1", "nope")).toBe(false); // unknown option
    expect(mgr.setNodeChoice("brawler-notable-1", "x")).toBe(false); // non-choice node
  });

  it("resetPassiveTree clears recorded choices", () => {
    mgr.unlockPassiveNode("brawler-mastery-1", "power");
    mgr.resetPassiveTree();
    expect(mgr.getSave().hero.nodeChoices).toEqual({});
  });
});
