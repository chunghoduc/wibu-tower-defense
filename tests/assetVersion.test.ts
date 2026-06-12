import { describe, it, expect } from "vitest";
import { ASSET_VERSION, versioned } from "../src/data/assetVersion.ts";

describe("ASSET_VERSION", () => {
  it("is a non-empty token safe for a query value", () => {
    expect(typeof ASSET_VERSION).toBe("string");
    expect(ASSET_VERSION.length).toBeGreaterThan(0);
    expect(ASSET_VERSION).not.toMatch(/[\s?&#]/);
  });
});

describe("versioned", () => {
  it("appends ?v=<version> to a plain path", () => {
    expect(versioned("assets/sprites/tower/seren-skyfall.png")).toBe(
      `assets/sprites/tower/seren-skyfall.png?v=${ASSET_VERSION}`,
    );
  });

  it("uses & when the path already has a query string", () => {
    expect(versioned("assets/x.png?foo=1")).toBe(`assets/x.png?foo=1&v=${ASSET_VERSION}`);
  });

  it("leaves data: and http(s) URLs untouched", () => {
    expect(versioned("data:image/png;base64,AAAA")).toBe("data:image/png;base64,AAAA");
    expect(versioned("https://cdn.example/x.png")).toBe("https://cdn.example/x.png");
  });

  it("is idempotent — does not double-stamp an already-versioned path", () => {
    const once = versioned("assets/x.png");
    expect(versioned(once)).toBe(once);
  });
});
