import { describe, it, expect } from "vitest";
import { resolveSkeleton } from "../src/data/heroSkeleton.ts";
import { placeWorn, partsForSlot, WORN_GEAR_SLOTS } from "../src/data/heroWornRig.ts";

const bones = resolveSkeleton({ size: 100, hover: 0, facing: 1, deltas: {} });

describe("heroWornRig", () => {
  it("re-exports the four body-worn slots", () => {
    expect([...WORN_GEAR_SLOTS]).toEqual(["Helmet", "BodyArmor", "Gloves", "Boots"]);
  });

  it("phase-1 (whole-piece): one placement per slot", () => {
    const ps = placeWorn(bones, 100, 1, false);
    expect(ps.filter((p) => p.slot === "Boots")).toHaveLength(1);
    expect(ps.filter((p) => p.slot === "Gloves")).toHaveLength(1);
    expect(new Set(ps.map((p) => p.slot)).size).toBe(4);
  });

  it("phase-2 (per-limb): boots & gloves split into L/R, one mirrored", () => {
    const ps = placeWorn(bones, 100, 1, true);
    const boots = ps.filter((p) => p.slot === "Boots");
    expect(boots).toHaveLength(2);
    expect(boots.map((b) => b.part).sort()).toEqual(["L", "R"]);
    expect(boots.find((b) => b.part === "L")!.flipX).toBe(true);
    expect(boots.find((b) => b.part === "R")!.flipX).toBe(false);
    expect(ps.filter((p) => p.slot === "Gloves")).toHaveLength(2);
    expect(ps.filter((p) => p.slot === "Helmet")).toHaveLength(1);
  });

  it("partsForSlot matches the parts placeWorn actually emits (no orphan sprite)", () => {
    for (const perLimb of [false, true]) {
      const ps = placeWorn(bones, 100, 1, perLimb);
      for (const slot of WORN_GEAR_SLOTS) {
        const emitted = ps.filter((p) => p.slot === slot).map((p) => p.part).sort();
        const declared = [...partsForSlot(slot, perLimb)].sort();
        expect(declared).toEqual(emitted);
      }
    }
  });

  it("anchors each piece near its bone (helmet at head, boots at feet)", () => {
    const ps = placeWorn(bones, 100, 1, false);
    const helmet = ps.find((p) => p.slot === "Helmet")!;
    const boots = ps.find((p) => p.slot === "Boots")!;
    expect(helmet.y).toBeLessThan(boots.y);
  });

  it("orders behind→front by depth", () => {
    const ps = placeWorn(bones, 100, 1, false);
    const d = Object.fromEntries(ps.map((p) => [p.slot, p.depth]));
    expect(d.BodyArmor).toBeLessThan(d.Helmet);
    expect(d.Boots).toBeLessThan(d.BodyArmor);
  });

  it("scales each piece to its body part (not uniform)", () => {
    const ps = placeWorn(bones, 100, 1, false);
    const sizes = new Set(ps.map((p) => Math.round(p.displayH)));
    expect(sizes.size).toBeGreaterThan(1);
  });
});
