import { describe, expect, test } from "vitest";
import { forgeFxSpec, type ForgeFxKind } from "../src/core/forgeFx.ts";
import type { StationId } from "../src/core/forgeStations.ts";

const STATIONS: StationId[] = ["awaken", "alchemy", "copies", "wings", "spark"];

describe("forgeFxSpec", () => {
  test("each station maps to its documented signature kind", () => {
    const kinds: Record<string, ForgeFxKind> = {
      awaken: "ascension",
      alchemy: "transmute",
      copies: "fusion",
      spark: "starfall",
    };
    for (const [station, kind] of Object.entries(kinds)) {
      expect(forgeFxSpec(station as StationId, true).kind).toBe(kind);
    }
  });

  test("wings success vs fail picks featherstorm vs ashfall", () => {
    expect(forgeFxSpec("wings", true).kind).toBe("featherstorm");
    expect(forgeFxSpec("wings", false).kind).toBe("ashfall");
  });

  test("every spec is well-formed (positive duration, >=1 particle, valid colors)", () => {
    for (const s of STATIONS) {
      for (const success of [true, false]) {
        const spec = forgeFxSpec(s, success);
        expect(spec.durationMs).toBeGreaterThan(0);
        expect(spec.particles).toBeGreaterThanOrEqual(1);
        expect(spec.primary).toBeGreaterThanOrEqual(0);
        expect(spec.primary).toBeLessThanOrEqual(0xffffff);
        expect(spec.accent).toBeGreaterThanOrEqual(0);
        expect(spec.accent).toBeLessThanOrEqual(0xffffff);
        expect(typeof spec.glyph).toBe("string");
        expect(spec.glyph.length).toBeGreaterThan(0);
      }
    }
  });

  test("rise flag matches the motion table", () => {
    expect(forgeFxSpec("awaken", true).rise).toBe(true);
    expect(forgeFxSpec("wings", true).rise).toBe(true);
    expect(forgeFxSpec("alchemy", true).rise).toBe(false);
    expect(forgeFxSpec("copies", true).rise).toBe(false);
    expect(forgeFxSpec("spark", true).rise).toBe(false);
  });

  test("primary colors are distinct across the success signatures", () => {
    const cols = STATIONS.map((s) => forgeFxSpec(s, true).primary);
    expect(new Set(cols).size).toBe(cols.length);
  });
});
