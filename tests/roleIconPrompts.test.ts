import { describe, it, expect } from "vitest";
import { TOWER_ROLES } from "../src/data/schemaEnums.ts";
import { ROLE_VISUAL } from "../scripts/sdart/prompts.mjs";

describe("role-icon emblem prompts", () => {
  it("defines exactly one emblem per TowerRole (none missing, none dead)", () => {
    const promptKeys = Object.keys(ROLE_VISUAL).sort();
    const roleKeys = [...TOWER_ROLES].sort();
    expect(promptKeys).toEqual(roleKeys);
  });

  it("gives every role a non-empty emblem description", () => {
    for (const role of TOWER_ROLES) {
      const v = (ROLE_VISUAL as Record<string, string>)[role];
      expect(typeof v).toBe("string");
      expect(v.trim().length).toBeGreaterThan(0);
    }
  });

  it("uses a distinct emblem description for every role (no two icons collide)", () => {
    const values = TOWER_ROLES.map((r) => (ROLE_VISUAL as Record<string, string>)[r]);
    expect(new Set(values).size).toBe(TOWER_ROLES.length);
  });
});
