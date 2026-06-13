import { describe, expect, it } from "vitest";
import { MATERIALS, MATERIALS_MAP, CHAOS_JEWEL, JEWEL_OF_CHAOS } from "../src/data/materials.ts";

describe("smelt material name", () => {
  it("the smelt/reforge material (id chaos-jewel) is named Jewel of Entropy", () => {
    expect(MATERIALS_MAP.get(CHAOS_JEWEL)!.name).toBe("Jewel of Entropy");
    expect(MATERIALS_MAP.get(CHAOS_JEWEL)!.name).not.toBe("Jewel of Chaos");
  });

  it('the ONLY "Jewel of Chaos" is the wing-craft material (id jewel-of-chaos)', () => {
    const named = MATERIALS.filter((m) => m.name === "Jewel of Chaos");
    expect(named).toHaveLength(1);
    expect(named[0].id).toBe(JEWEL_OF_CHAOS);
    expect(JEWEL_OF_CHAOS).not.toBe(CHAOS_JEWEL);
  });
});
