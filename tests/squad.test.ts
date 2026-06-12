import { describe, expect, it } from "vitest";
import { SaveManager } from "../src/core/saveManager.ts";
import type { HeroSave, SaveProvider } from "../src/core/save.ts";
import { addTowerToCollection } from "../src/core/collection.ts";

function mgr() {
  let stored: HeroSave | null = null;
  const prov: SaveProvider = {
    load: () => stored,
    persist: (d) => {
      stored = d;
    },
    clear: () => {
      stored = null;
    },
  };
  return new SaveManager(prov);
}

describe("SaveManager.setSquad", () => {
  it("keeps only owned tower ids", () => {
    const m = mgr();
    const s = m.getSave();
    addTowerToCollection(s, "owned-a");
    addTowerToCollection(s, "owned-b");
    m.setSquad(["owned-a", "not-owned", "owned-b"]);
    expect(m.getSave().squad).toEqual(["owned-a", "owned-b"]);
  });

  it("caps the squad at 7", () => {
    const m = mgr();
    const s = m.getSave();
    const ids = Array.from({ length: 10 }, (_, i) => `t${i}`);
    for (const id of ids) addTowerToCollection(s, id);
    m.setSquad(ids);
    expect(m.getSave().squad.length).toBe(7);
  });

  it("persists the squad across reload", () => {
    let stored: HeroSave | null = null;
    const prov: SaveProvider = {
      load: () => stored,
      persist: (d) => {
        stored = d;
      },
      clear: () => {
        stored = null;
      },
    };
    const m1 = new SaveManager(prov);
    addTowerToCollection(m1.getSave(), "keep-me");
    m1.setSquad(["keep-me"]);
    const m2 = new SaveManager(prov);
    expect(m2.getSave().squad).toContain("keep-me");
  });
});
