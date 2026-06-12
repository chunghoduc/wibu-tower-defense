import { describe, it, expect } from "vitest";
import { TOWER_ROLES } from "../src/data/schemaEnums.ts";
import { roleBadgeTex, ROLE_BADGE, ROLE_BADGE_COLOR } from "../src/scenes/roleBadge.ts";

describe("roleBadge", () => {
  it("maps every role to a distinct roleicon key", () => {
    const keys = TOWER_ROLES.map(roleBadgeTex);
    expect(new Set(keys).size).toBe(TOWER_ROLES.length);
    for (const k of keys) expect(k).toMatch(/^roleicon__/);
  });

  it("uses the asset-key registry", () => {
    expect(roleBadgeTex("chain")).toBe("roleicon__chain");
  });

  it("exposes sane badge geometry", () => {
    expect(ROLE_BADGE.diameter).toBeGreaterThan(0);
    expect(ROLE_BADGE.offsetX).toBeGreaterThan(0);
  });

  it("has a badge color for every TowerRole", () => {
    for (const r of TOWER_ROLES) expect(typeof ROLE_BADGE_COLOR[r]).toBe("number");
  });
});
