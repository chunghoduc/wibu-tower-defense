import { describe, expect, it } from "vitest";
import { MATERIAL_ICON_IDS, materialIconKey } from "../src/data/materialIconManifest.ts";
import { BLESS_JEWEL, SOUL_JEWEL, SUMMON_SCROLL, CHAOS_JEWEL, boxIdForTier } from "../src/data/materials.ts";

describe("material icon manifest", () => {
  it("covers the enhance jewels + summon scroll + chaos jewel", () => {
    expect(MATERIAL_ICON_IDS).toContain(BLESS_JEWEL);
    expect(MATERIAL_ICON_IDS).toContain(SOUL_JEWEL);
    expect(MATERIAL_ICON_IDS).toContain(SUMMON_SCROLL);
    expect(MATERIAL_ICON_IDS).toContain(CHAOS_JEWEL); // reforge material — icon must ship
  });

  it("excludes boxes (they use their own box__ chest art)", () => {
    expect(MATERIAL_ICON_IDS).not.toContain(boxIdForTier(1));
    expect(MATERIAL_ICON_IDS).not.toContain(boxIdForTier(5));
  });

  it("builds the material__<id> texture key", () => {
    expect(materialIconKey(BLESS_JEWEL)).toBe("material__bless-jewel");
  });
});
