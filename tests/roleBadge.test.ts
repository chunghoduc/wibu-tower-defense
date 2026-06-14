import { describe, it, expect } from "vitest";
import { TOWER_ROLES } from "../src/data/schemaEnums.ts";
import {
  roleBadgeTex,
  ROLE_BADGE,
  ROLE_BADGE_COLOR,
  roleBadgeOnCard,
} from "../src/scenes/roleBadge.ts";

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

describe("roleBadgeOnCard", () => {
  it("pins the emblem to the upper-right inside the card", () => {
    const g = roleBadgeOnCard(66); // build-bar card inner width
    expect(g.x).toBeGreaterThan(0); // right of center
    expect(g.y).toBeLessThan(0); // above center
    expect(g.x + g.diameter / 2).toBeLessThanOrEqual(33); // inside the right edge (half-width)
    expect(g.diameter).toBeGreaterThan(0);
  });

  it("scales the emblem with card width", () => {
    expect(roleBadgeOnCard(80).diameter).toBeGreaterThan(roleBadgeOnCard(40).diameter);
  });
});
