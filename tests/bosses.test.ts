import { describe, expect, it } from "vitest";
import { ENEMIES } from "../src/data/enemies.ts";
import { STAGES } from "../src/data/stage.ts";

const byId = new Map(ENEMIES.map((e) => [e.id, e]));
const bosses = ENEMIES.filter((e) => e.archetype === "Boss");

describe("boss roster", () => {
  it("has at least 10 bosses", () => {
    expect(bosses.length).toBeGreaterThanOrEqual(10);
  });

  it("every boss has at least one boss mechanic", () => {
    for (const b of bosses) {
      expect(b.boss).toBeDefined();
      const m = b.boss!;
      expect(Boolean(m.enrage || m.summon || m.towerDisable)).toBe(true);
    }
  });

  it("the new anime-homage bosses all exist and are bosses", () => {
    for (const id of ["zabro", "ryomen", "kura", "akai", "mukade", "madarok", "meruon"]) {
      const e = byId.get(id);
      expect(e, id).toBeDefined();
      expect(e!.archetype).toBe("Boss");
    }
  });

  it("each of the 10 stages ends in exactly one boss, and they are distinct across stages", () => {
    const finals: string[] = [];
    for (const stage of STAGES) {
      const lastWave = stage.waves[stage.waves.length - 1];
      const bossSpawns = lastWave.spawns.filter((s) => byId.get(s.enemyId)?.archetype === "Boss");
      expect(bossSpawns.length, stage.id).toBe(1);
      finals.push(bossSpawns[0].enemyId);
    }
    expect(finals.length).toBe(10);
    expect(new Set(finals).size).toBe(10); // a distinct boss per stage
  });
});
