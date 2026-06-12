import { describe, it, expect } from "vitest";
import {
  itemTex,
  towerTex,
  jewelTex,
  materialTex,
  boxTex,
  skillTex,
  menuTex,
  fxTex,
  structureTex,
  roleTex,
  CASTLE_TEX,
  CASTLE_DAMAGED_TEX,
  GOLD_TEX,
  GEM_TEX,
  XP_TEX,
  HERODOLL_BASE_TEX,
} from "../src/data/assetKeys.ts";
import { ITEM_CATALOG } from "../src/data/items.ts";
import { TOWERS } from "../src/data/towers.ts";
import { JEWEL_CATALOG } from "../src/data/jewels.ts";
import { MATERIALS } from "../src/data/materials.ts";
import { MATERIAL_ICON_IDS } from "../src/data/materialIconManifest.ts";
import { JEWEL_ICON_IDS } from "../src/data/jewelIconManifest.ts";

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
  it("derives the structure namespace key + castle state constants", () => {
    expect(structureTex("castle")).toBe("structure__castle");
    expect(CASTLE_TEX).toBe("structure__castle");
    expect(CASTLE_DAMAGED_TEX).toBe("structure__castle__damaged");
  });
  it("builds per-role badge keys", () => {
    expect(roleTex("splash")).toBe("roleicon__splash");
    expect(roleTex("tanker")).toBe("roleicon__tanker");
  });
  it("exposes fixed currency / singleton keys as named constants", () => {
    expect(GOLD_TEX).toBe("icon__gold");
    expect(GEM_TEX).toBe("icon__gem");
    expect(XP_TEX).toBe("icon__xp");
    expect(HERODOLL_BASE_TEX).toBe("herodoll__base");
  });
});

describe("catalog → key contract", () => {
  it("every item id derives a well-formed item__ key", () => {
    for (const d of ITEM_CATALOG) expect(itemTex(d.id)).toBe(`item__${d.id}`);
  });
  it("every tower id derives a well-formed tower__ key", () => {
    for (const t of TOWERS) expect(towerTex(t.id)).toMatch(/^tower__/);
  });
  it("non-box materials are exactly the set loaded as material__ icons", () => {
    const nonBox = MATERIALS.filter((m) => m.kind !== "box")
      .map((m) => m.id)
      .sort();
    expect([...MATERIAL_ICON_IDS].sort()).toEqual(nonBox);
  });
  it("every jewel id is in the loaded jewel icon set", () => {
    const ids = new Set(JEWEL_ICON_IDS);
    for (const j of JEWEL_CATALOG) expect(ids.has(j.id)).toBe(true);
  });
});
