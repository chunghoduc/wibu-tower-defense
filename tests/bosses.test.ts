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

  it("every campaign stage ends in exactly one boss", () => {
    for (const stage of STAGES) {
      const lastWave = stage.waves[stage.waves.length - 1];
      const bossSpawns = lastWave.spawns.filter((s) => byId.get(s.enemyId)?.archetype === "Boss");
      expect(bossSpawns.length, stage.id).toBe(1);
    }
  });

  it("Chapter 1 fields a distinct boss for each of its ten stages", () => {
    const finals = STAGES.filter((s) => s.id.startsWith("ch1-")).map((stage) => {
      const lastWave = stage.waves[stage.waves.length - 1];
      return lastWave.spawns.find((s) => byId.get(s.enemyId)?.archetype === "Boss")!.enemyId;
    });
    expect(finals.length).toBe(10);
    expect(new Set(finals).size).toBe(10); // a distinct boss per stage in Ch.1
  });

  it("the expansion chapters (stages 11-20) all resolve to a real boss", () => {
    // Chapter 2/3 reuse the roster (elite-scaled by the progression curve), so
    // bosses need not be distinct — but every authored stage must resolve to a
    // real boss, never the silent 'overlord' fallback.
    for (const stage of STAGES.filter((s) => !s.id.startsWith("ch1-"))) {
      const lastWave = stage.waves[stage.waves.length - 1];
      const boss = lastWave.spawns.find((s) => byId.get(s.enemyId)?.archetype === "Boss");
      expect(boss, stage.id).toBeDefined();
      expect(byId.get(boss!.enemyId)!.archetype).toBe("Boss");
    }
  });
});
