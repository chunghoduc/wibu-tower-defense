import { describe, expect, it } from "vitest";
import { TOWERS } from "../src/data/towers.ts";
import { PASSIVE_SKILLS, TOWER_ACTIVES } from "../src/data/passiveSkills.ts";

describe("character codex metadata", () => {
  it("every tower has complete meta (homage, outfit, weapon)", () => {
    for (const t of TOWERS) {
      expect(t.meta, `${t.id} missing meta`).toBeDefined();
      expect(t.meta!.homage.length, `${t.id} homage`).toBeGreaterThan(3);
      expect(t.meta!.outfit.length, `${t.id} outfit`).toBeGreaterThan(3);
      expect(t.meta!.weapon.length, `${t.id} weapon`).toBeGreaterThan(3);
    }
  });

  it("every tower active + passive skill referenced is catalogued (so it has an icon key)", () => {
    for (const t of TOWERS) {
      if (t.active) expect(TOWER_ACTIVES[t.active], `${t.id} active ${t.active}`).toBeDefined();
      for (const pid of t.passives) expect(PASSIVE_SKILLS[pid], `${t.id} passive ${pid}`).toBeDefined();
    }
  });
});
