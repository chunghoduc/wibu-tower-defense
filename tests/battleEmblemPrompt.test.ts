import { describe, it, expect } from "vitest";
import { battleEmblemTex, endlessEmblemTex } from "../src/data/assetKeys.ts";
import {
  BATTLE_EMBLEM_VISUAL,
  battleEmblemStyle,
  ENDLESS_EMBLEM_VISUAL,
  endlessEmblemStyle,
} from "../scripts/sdart/prompts.mjs";

describe("battle-emblem prompt", () => {
  it("has a non-empty visual description", () => {
    expect(typeof BATTLE_EMBLEM_VISUAL).toBe("string");
    expect(BATTLE_EMBLEM_VISUAL.trim().length).toBeGreaterThan(0);
  });
  it("injects the visual into the style template", () => {
    const s = battleEmblemStyle(BATTLE_EMBLEM_VISUAL);
    expect(s).toContain(BATTLE_EMBLEM_VISUAL);
    expect(s.toLowerCase()).toContain("white background");
  });
});

describe("battleEmblemTex key builder", () => {
  it("namespaces the emblem under ui__", () => {
    expect(battleEmblemTex()).toBe("ui__battle-emblem");
  });
});

describe("endless-emblem prompt (home ENDLESS CTA twin)", () => {
  it("has a non-empty visual description", () => {
    expect(typeof ENDLESS_EMBLEM_VISUAL).toBe("string");
    expect(ENDLESS_EMBLEM_VISUAL.trim().length).toBeGreaterThan(0);
  });
  it("injects the visual into the style template, isolated background", () => {
    const s = endlessEmblemStyle(ENDLESS_EMBLEM_VISUAL);
    expect(s).toContain(ENDLESS_EMBLEM_VISUAL);
    expect(s.toLowerCase()).toContain("white background");
  });
  it("namespaces the endless emblem under ui__", () => {
    expect(endlessEmblemTex()).toBe("ui__endless-emblem");
  });
});
