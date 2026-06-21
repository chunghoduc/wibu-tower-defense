import { describe, it, expect } from "vitest";
import { battleWingKeys, BATTLE_WING_IDS } from "../src/data/heroWingArt.ts";
import { heroWingTex, heroWingUpTex } from "../src/data/assetKeys.ts";

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
