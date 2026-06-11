import { describe, expect, it } from "vitest";
import { ENEMIES } from "../src/data/enemies.ts";
import { ARCHETYPE_INFO, enemySpecialty, enemyTags } from "../src/data/enemyInfo.ts";
import { ENEMY_ARCHETYPES } from "../src/data/schemaEnums.ts";

describe("enemy info", () => {
  it("every enemy has a non-empty specialty line", () => {
    for (const e of ENEMIES) {
      expect(enemySpecialty(e), e.id).toBeTruthy();
      expect(enemySpecialty(e).length).toBeGreaterThan(8);
    }
  });

  it("ARCHETYPE_INFO covers every archetype used in the catalog", () => {
    for (const e of ENEMIES) {
      expect(ARCHETYPE_INFO[e.archetype], e.archetype).toBeTruthy();
    }
  });

  it("tags reflect flying and immunity", () => {
    const flyer = ENEMIES.find((e) => e.flying)!;
    expect(enemyTags(flyer)).toContain("Flying");
    const bulwark = ENEMIES.find((e) => e.immunity === "AoE")!;
    expect(enemyTags(bulwark)).toContain("Immune: Splash");
  });

  it("bosses are tagged with their mechanics", () => {
    const enrager = ENEMIES.find((e) => e.boss?.enrage)!;
    expect(enemyTags(enrager)).toContain("Enrages");
  });

  it("registers the five new chapter-2 elite archetypes with intel blurbs", () => {
    for (const a of ["Berserker", "Adapter", "Burster", "Dreadnought", "Disruptor"] as const) {
      expect(ENEMY_ARCHETYPES).toContain(a);
      expect(ARCHETYPE_INFO[a]).toBeTruthy();
      expect(ARCHETYPE_INFO[a].length).toBeGreaterThan(10);
    }
  });
});
