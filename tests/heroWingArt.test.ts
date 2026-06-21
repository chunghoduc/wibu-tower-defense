import { describe, it, expect } from "vitest";
import { battleWingKeys, BATTLE_WING_IDS } from "../src/data/heroWingArt.ts";
import { heroWingTex, heroWingUpTex } from "../src/data/assetKeys.ts";
import { heroWingFlap } from "../src/data/heroWingFlap.ts";

describe("battleWingKeys", () => {
  it("resolves down/up frame keys for a wing with battle art", () => {
    const k = battleWingKeys("tempest-wings");
    expect(k).toEqual({
      downKey: heroWingTex("tempest-wings"),
      upKey: heroWingUpTex("tempest-wings"),
    });
    expect(k!.downKey).toBe("herowing__tempest-wings");
    expect(k!.upKey).toBe("herowing__tempest-wings__up");
  });

  it("covers every advertised wing id", () => {
    for (const id of BATTLE_WING_IDS) expect(battleWingKeys(id)).not.toBeNull();
  });

  it("returns null for unknown ids and nullish input", () => {
    expect(battleWingKeys("not-a-wing")).toBeNull();
    expect(battleWingKeys(null)).toBeNull();
    expect(battleWingKeys(undefined)).toBeNull();
    expect(battleWingKeys("")).toBeNull();
  });
});

describe("heroWingFlap", () => {
  it("rests on the down frame at the start of the beat", () => {
    const f = heroWingFlap(0);
    expect(f.rise).toBeCloseTo(0, 6);
    expect(f.downAlpha).toBeCloseTo(1, 6);
    expect(f.upAlpha).toBeCloseTo(0, 6);
    expect(f.scaleX).toBeCloseTo(1, 6);
    expect(f.scaleY).toBeCloseTo(1, 6);
  });

  it("peaks on the up frame at mid-beat", () => {
    const f = heroWingFlap(450); // half of the default 900ms period
    expect(f.rise).toBeCloseTo(1, 6);
    expect(f.upAlpha).toBeCloseTo(1, 6);
    expect(f.downAlpha).toBeCloseTo(0, 6);
    expect(f.scaleX).toBeLessThan(1);
    expect(f.scaleY).toBeGreaterThan(1);
  });

  it("keeps the two crossfade alphas summing to 1 and in range across the cycle", () => {
    for (let ms = -2000; ms <= 2000; ms += 37) {
      const f = heroWingFlap(ms);
      expect(f.upAlpha + f.downAlpha).toBeCloseTo(1, 6);
      expect(f.upAlpha).toBeGreaterThanOrEqual(0);
      expect(f.upAlpha).toBeLessThanOrEqual(1);
      expect(f.rise).toBeGreaterThanOrEqual(-1e-9);
      expect(f.rise).toBeLessThanOrEqual(1 + 1e-9);
    }
  });

  it("is periodic", () => {
    const a = heroWingFlap(123);
    const b = heroWingFlap(123 + 900);
    expect(b.rise).toBeCloseTo(a.rise, 6);
    expect(b.upAlpha).toBeCloseTo(a.upAlpha, 6);
  });
});
