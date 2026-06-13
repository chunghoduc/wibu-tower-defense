import { describe, expect, it } from "vitest";
import { MATERIALS_MAP, JEWEL_OF_CHAOS, FEATHER } from "../src/data/materials.ts";
import { MATERIAL_ICON_IDS } from "../src/data/materialIconManifest.ts";

describe("wing-craft materials", () => {
  it("Jewel of Chaos exists with its own id (NOT the Entropy id)", () => {
    expect(JEWEL_OF_CHAOS).toBe("jewel-of-chaos");
    const m = MATERIALS_MAP.get(JEWEL_OF_CHAOS)!;
    expect(m.name).toBe("Jewel of Chaos");
    expect(m.kind).toBe("jewel");
    expect(m.icon).toBe("jewel-of-chaos");
  });

  it("Feather exists", () => {
    expect(FEATHER).toBe("feather");
    const m = MATERIALS_MAP.get(FEATHER)!;
    expect(m.name).toBe("Feather");
  });

  it("both new materials get painted icons (non-box ⇒ in MATERIAL_ICON_IDS)", () => {
    expect(MATERIAL_ICON_IDS).toContain("jewel-of-chaos");
    expect(MATERIAL_ICON_IDS).toContain("feather");
  });
});
