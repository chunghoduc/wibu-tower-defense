import { describe, it, expect } from "vitest";
import {
  itemTex, towerTex, jewelTex, materialTex, boxTex, skillTex, menuTex, fxTex,
  GOLD_TEX, GEM_TEX, XP_TEX, HERODOLL_BASE_TEX,
} from "../src/data/assetKeys.ts";

describe("assetKeys derivation", () => {
  it("derives namespaced entity keys", () => {
    expect(itemTex("iron-sword")).toBe("item__iron-sword");
    expect(towerTex("karu-sunfist")).toBe("tower__karu-sunfist");
    expect(jewelTex("ruby")).toBe("jewel__ruby");
    expect(materialTex("soul-jewel")).toBe("material__soul-jewel");
    expect(boxTex("boss-box-t3")).toBe("box__boss-box-t3");
    expect(skillTex("fireball")).toBe("skill__fireball");
    expect(menuTex("shop")).toBe("menu__shop");
    expect(fxTex("burst")).toBe("fx__burst");
  });
  it("exposes fixed currency / singleton keys as named constants", () => {
    expect(GOLD_TEX).toBe("icon__gold");
    expect(GEM_TEX).toBe("icon__gem");
    expect(XP_TEX).toBe("icon__xp");
    expect(HERODOLL_BASE_TEX).toBe("herodoll__base");
  });
});
