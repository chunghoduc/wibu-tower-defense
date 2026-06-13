import { describe, expect, it } from "vitest";
import { MATERIALS, MATERIALS_MAP, CHAOS_JEWEL } from "../src/data/materials.ts";

describe("smelt material name", () => {
  it("the smelt/reforge material is named Jewel of Entropy", () => {
    expect(MATERIALS_MAP.get(CHAOS_JEWEL)!.name).toBe("Jewel of Entropy");
  });

  it('no material is named "Jewel of Chaos" — the name is free for reuse', () => {
    expect(MATERIALS.some((m) => m.name === "Jewel of Chaos")).toBe(false);
  });
});
