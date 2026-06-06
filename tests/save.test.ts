import { describe, expect, it, beforeEach } from "vitest";
import {
  LocalSaveProvider,
  loadAndMigrate,
  createFreshSave,
  CURRENT_SAVE_VERSION,
} from "../src/core/save.ts";

const store: Record<string, string> = {};
const mockStorage = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
};

describe("LocalSaveProvider", () => {
  let provider: LocalSaveProvider;

  beforeEach(() => {
    Object.keys(store).forEach((k) => delete store[k]);
    provider = new LocalSaveProvider(mockStorage as unknown as Storage);
  });

  it("returns null when no save exists", () => {
    expect(provider.load()).toBeNull();
  });

  it("persists and reloads a save", () => {
    const save = createFreshSave();
    provider.persist(save);
    const loaded = provider.load();
    expect(loaded).not.toBeNull();
    expect(loaded!.heroId).toBe(save.heroId);
  });

  it("returns null if stored JSON is corrupted", () => {
    mockStorage.setItem("wibu-td-save", "not-json{{{");
    expect(provider.load()).toBeNull();
  });

  it("clear removes the save", () => {
    provider.persist(createFreshSave());
    provider.clear();
    expect(provider.load()).toBeNull();
  });
});

describe("createFreshSave", () => {
  it("starts at level 1 with 0 XP", () => {
    const save = createFreshSave();
    expect(save.hero.level).toBe(1);
    expect(save.hero.totalXp).toBe(0);
    expect(save.hero.skillPoints).toBe(0);
  });

  it("has empty inventory and no equipped items", () => {
    const save = createFreshSave();
    expect(save.inventory.items).toHaveLength(0);
    expect(Object.keys(save.inventory.equipped)).toHaveLength(0);
  });

  it("has current schema version", () => {
    const save = createFreshSave();
    expect(save.version).toBe(CURRENT_SAVE_VERSION);
  });
});

describe("loadAndMigrate", () => {
  it("returns fresh save when input is null", () => {
    const result = loadAndMigrate(null);
    expect(result.version).toBe(CURRENT_SAVE_VERSION);
  });

  it("passes through already-current version unchanged", () => {
    const save = createFreshSave();
    save.hero.level = 42;
    const result = loadAndMigrate(save);
    expect(result.hero.level).toBe(42);
    expect(result.version).toBe(CURRENT_SAVE_VERSION);
  });
});
