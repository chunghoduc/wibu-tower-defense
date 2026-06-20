import { describe, it, expect } from "vitest";
import { rarityTex, towerAttackTex, heroPoseTex, towerTex, wornTex } from "./assetKeys.ts";

describe("rarityTex", () => {
  it("builds the rarity__<rarity> key", () => {
    expect(rarityTex("Legendary")).toBe("rarity__Legendary");
    expect(rarityTex("Common")).toBe("rarity__Common");
  });
});

describe("pose asset keys", () => {
  it("towerAttackTex appends __attack to the tower key", () => {
    expect(towerAttackTex("akagan-ashen")).toBe("tower__akagan-ashen__attack");
    expect(towerAttackTex("zoran-thricedraw")).toBe(`${towerTex("zoran-thricedraw")}__attack`);
  });
  it("heroPoseTex builds the hero weapon-pose key", () => {
    expect(heroPoseTex("bow")).toBe("hero__bow");
    expect(heroPoseTex("staff")).toBe("hero__staff");
  });
  it("wornTex builds the worn-overlay key", () => {
    expect(wornTex("iron-sword")).toBe("worn__iron-sword");
  });
});
