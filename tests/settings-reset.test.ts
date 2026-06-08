import { describe, expect, it } from "vitest";
import { SaveManager } from "../src/core/saveManager.ts";
import { defaultSettings, type HeroSave, type SaveProvider } from "../src/core/save.ts";

class MemProvider implements SaveProvider {
  data: HeroSave | null = null;
  load() { return this.data; }
  persist(d: HeroSave) { this.data = JSON.parse(JSON.stringify(d)); }
  clear() { this.data = null; }
}

describe("settings + reset", () => {
  it("fresh save has default settings", () => {
    const mgr = new SaveManager(new MemProvider());
    expect(mgr.getSettings()).toEqual(defaultSettings());
  });

  it("setSettings merges + persists", () => {
    const p = new MemProvider();
    const mgr = new SaveManager(p);
    mgr.setSettings({ volume: 0.3, musicEnabled: false });
    expect(mgr.getSettings().volume).toBe(0.3);
    expect(mgr.getSettings().musicEnabled).toBe(false);
    expect(mgr.getSettings().muted).toBe(false); // untouched
    expect(p.data!.settings.volume).toBe(0.3);   // persisted
  });

  it("resetProgress wipes progress but keeps audio settings", () => {
    const mgr = new SaveManager(new MemProvider());
    mgr.setSettings({ volume: 0.2 });
    mgr.getSave().currency.gold = 99999;
    mgr.getSave().hero.level = 50;
    mgr.resetProgress();
    expect(mgr.getSave().hero.level).toBe(1);            // fresh
    expect(Object.keys(mgr.getSave().collection).length).toBeGreaterThan(0); // starter squad regranted
    expect(mgr.getSettings().volume).toBe(0.2);          // settings kept
  });
});
