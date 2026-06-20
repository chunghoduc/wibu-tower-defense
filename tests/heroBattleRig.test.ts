import { describe, it, expect } from "vitest";
import { heroBattleRig, WORN_GEAR_SLOTS } from "../src/data/heroBattleRig.ts";

const base = { bodyH: 54, bodyW: 54, hover: 0, facing: 1 };

describe("heroBattleRig", () => {
  it("places one entry per worn-gear slot, in stable order", () => {
    const r = heroBattleRig(base);
    expect(r.map((p) => p.slot)).toEqual([...WORN_GEAR_SLOTS]);
  });

  it("stacks the body vertically: helmet above torso above boots", () => {
    const r = heroBattleRig(base);
    const y = (s: string) => r.find((p) => p.slot === s)!.y;
    expect(y("Helmet")).toBeLessThan(y("BodyArmor"));
    expect(y("BodyArmor")).toBeLessThan(y("Boots"));
  });

  it("keeps centered slots on the body axis regardless of facing", () => {
    for (const facing of [1, -1]) {
      const r = heroBattleRig({ ...base, facing });
      for (const s of ["Helmet", "BodyArmor", "Boots"]) {
        expect(r.find((p) => p.slot === s)!.x).toBeCloseTo(0, 6);
      }
    }
  });

  it("mirrors off-axis slots and flips the sprite when facing left", () => {
    const right = heroBattleRig({ ...base, facing: 1 }).find((p) => p.slot === "Gloves")!;
    const left = heroBattleRig({ ...base, facing: -1 }).find((p) => p.slot === "Gloves")!;
    expect(right.x).toBeGreaterThan(0);
    expect(left.x).toBeCloseTo(-right.x, 6);
    expect(right.flipX).toBe(false);
    expect(left.flipX).toBe(true);
  });

  it("offsets every layer vertically by hover (gear tracks the body bob)", () => {
    const flat = heroBattleRig({ ...base, hover: 0 });
    const lifted = heroBattleRig({ ...base, hover: -8 });
    for (const p of flat) {
      const q = lifted.find((x) => x.slot === p.slot)!;
      expect(q.y - p.y).toBeCloseTo(-8, 6);
    }
  });

  it("scales display height as a fraction of body height", () => {
    const r = heroBattleRig({ ...base, bodyH: 100 });
    const body = r.find((p) => p.slot === "BodyArmor")!;
    expect(body.displayH).toBeGreaterThan(0);
    expect(body.displayH).toBeLessThan(100);
  });
});
