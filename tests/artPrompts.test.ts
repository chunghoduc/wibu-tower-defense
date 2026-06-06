import { describe, expect, it } from "vitest";
import {
  towerPrompt,
  enemyPrompt,
  itemPrompt,
  allArtPrompts,
  type ArtPromptEntry,
} from "../src/data/artPrompts.ts";
import { TOWERS } from "../src/data/towers.ts";
import { ENEMIES } from "../src/data/enemies.ts";
import { ITEM_CATALOG } from "../src/data/items.ts";
import { STYLE_PREAMBLE, spriteKey, spritePath } from "../src/data/artSpec.ts";

describe("towerPrompt", () => {
  const tower = TOWERS[0];

  it("includes the global style preamble", () => {
    expect(towerPrompt(tower)).toContain(STYLE_PREAMBLE);
  });

  it("includes the character name and rarity", () => {
    const p = towerPrompt(tower);
    expect(p).toContain(tower.name);
    expect(p).toContain(tower.rarity);
  });

  it("includes the canonical tower dimensions", () => {
    expect(towerPrompt(tower)).toContain("32x32");
  });

  it("is deterministic for the same input", () => {
    expect(towerPrompt(tower)).toBe(towerPrompt(tower));
  });
});

describe("enemyPrompt", () => {
  it("uses boss dimensions for Boss-archetype enemies", () => {
    const boss = ENEMIES.find((e) => e.archetype === "Boss");
    if (boss) {
      expect(enemyPrompt(boss)).toContain("48x48");
    }
    const grunt = ENEMIES.find((e) => e.archetype !== "Boss")!;
    expect(enemyPrompt(grunt)).toContain("24x24");
  });

  it("mentions flying for flying enemies", () => {
    const flyer = ENEMIES.find((e) => e.flying);
    if (flyer) expect(enemyPrompt(flyer).toLowerCase()).toContain("flying");
  });
});

describe("itemPrompt", () => {
  it("includes the item slot and 16x16 dimensions", () => {
    const item = ITEM_CATALOG[0];
    const p = itemPrompt(item);
    expect(p).toContain(item.slot);
    expect(p).toContain("16x16");
  });
});

describe("allArtPrompts", () => {
  let entries: ArtPromptEntry[];
  it("produces one entry per tower, enemy, and item", () => {
    entries = allArtPrompts();
    expect(entries.length).toBe(TOWERS.length + ENEMIES.length + ITEM_CATALOG.length);
  });

  it("every entry has a unique key matching the spriteKey convention", () => {
    entries = allArtPrompts();
    const keys = entries.map((e) => e.key);
    expect(new Set(keys).size).toBe(keys.length);
    const tower = TOWERS[0];
    expect(keys).toContain(spriteKey("tower", tower.id));
  });

  it("every entry has the matching public path and a non-empty prompt", () => {
    entries = allArtPrompts();
    const tower = TOWERS[0];
    const towerEntry = entries.find((e) => e.key === spriteKey("tower", tower.id))!;
    expect(towerEntry.path).toBe(spritePath("tower", tower.id));
    expect(towerEntry.prompt.length).toBeGreaterThan(40);
  });
});
