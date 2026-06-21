import { describe, it, expect } from "vitest";
import { heroPoseFamily } from "./heroPose.ts";

describe("heroPoseFamily", () => {
  it("maps the art-backed weapon types to a family", () => {
    expect(heroPoseFamily("Bow")).toBe("bow");
    expect(heroPoseFamily("Gun")).toBe("gun");
    expect(heroPoseFamily("Staff")).toBe("staff");
  });
  it("returns null for weapon types with no pose art", () => {
    expect(heroPoseFamily("Sword")).toBeNull();
    expect(heroPoseFamily("Tome")).toBeNull();
    expect(heroPoseFamily("Any")).toBeNull();
  });
  it("returns null when no weapon is equipped", () => {
    expect(heroPoseFamily(null)).toBeNull();
  });
});
