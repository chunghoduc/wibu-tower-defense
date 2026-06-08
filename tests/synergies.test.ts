import { describe, expect, it } from "vitest";
import { TOWERS } from "../src/data/towers.ts";
import { activeSynergies, squadSynergyMul, SYNERGIES } from "../src/data/synergies.ts";
import type { CharacterDef, TowerRole } from "../src/data/schema.ts";

const byRole = (role: TowerRole, n: number): CharacterDef[] => TOWERS.filter((t) => t.role === role).slice(0, n);

describe("F8 squad synergies", () => {
  it("no synergy for a single tower", () => {
    expect(activeSynergies(byRole("damage", 1))).toEqual([]);
    expect(squadSynergyMul(byRole("damage", 1))).toEqual({ atkMul: 1, hpMul: 1, attackSpeedMul: 1 });
  });

  it("3 damage towers activate Vanguard (+12% atk)", () => {
    const squad = byRole("damage", 3);
    expect(squad).toHaveLength(3);
    const ids = activeSynergies(squad).map((s) => s.id);
    expect(ids).toContain("vanguard");
    expect(squadSynergyMul(squad).atkMul).toBeCloseTo(1.12, 5);
  });

  it("all six roles present activates Full Roster", () => {
    const roles: TowerRole[] = ["damage", "splash", "chain", "dot", "debuff", "support"];
    const squad = roles.map((r) => byRole(r, 1)[0]).filter(Boolean) as CharacterDef[];
    expect(squad).toHaveLength(6);
    const ids = activeSynergies(squad).map((s) => s.id);
    expect(ids).toContain("full-roster");
  });

  it("multiple synergies stack multiplicatively", () => {
    // 3 damage (vanguard +12% atk) + 2 chain (tempest +10% as)
    const squad = [...byRole("damage", 3), ...byRole("chain", 2)];
    const mul = squadSynergyMul(squad);
    expect(mul.atkMul).toBeGreaterThanOrEqual(1.12);
    expect(mul.attackSpeedMul).toBeCloseTo(1.10, 5);
  });

  it("every synergy has a unique id and a non-empty effect", () => {
    const ids = new Set(SYNERGIES.map((s) => s.id));
    expect(ids.size).toBe(SYNERGIES.length);
    for (const s of SYNERGIES) {
      expect(Object.keys(s.effect).length).toBeGreaterThan(0);
    }
  });
});
