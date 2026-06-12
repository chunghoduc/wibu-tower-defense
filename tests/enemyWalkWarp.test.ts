import { describe, it, expect } from "vitest";
import { bandWarp } from "../src/scenes/enemyWalkWarp.ts";

const HALF_PI = Math.PI / 2;

describe("bandWarp — walk", () => {
  it("alternates legs: left and right feet shear opposite directions mid-stride", () => {
    const l = bandWarp("walk", 1, -1, HALF_PI);
    const r = bandWarp("walk", 1, 1, HALF_PI);
    expect(Math.sign(l.dx)).toBe(-Math.sign(r.dx));
    expect(l.dx).not.toBe(0);
  });

  it("leg swing grows from waist (~0) to feet (max)", () => {
    const waist = Math.abs(bandWarp("walk", 0.5, 1, HALF_PI).dx);
    const knee = Math.abs(bandWarp("walk", 0.75, 1, HALF_PI).dx);
    const feet = Math.abs(bandWarp("walk", 1, 1, HALF_PI).dx);
    expect(waist).toBeLessThan(knee);
    expect(knee).toBeLessThan(feet);
    expect(waist).toBeCloseTo(0, 5);
  });

  it("neutral contact at phase 0 (no horizontal leg offset)", () => {
    expect(bandWarp("walk", 1, -1, 0).dx).toBeCloseTo(0, 6);
    expect(bandWarp("walk", 1, 1, 0).dx).toBeCloseTo(0, 6);
  });

  it("contact bob lifts the body (dy <= 0) and peaks at the passing phase", () => {
    const contact = bandWarp("walk", 0.2, 1, 0).dy; // foot planted
    const passing = bandWarp("walk", 0.2, 1, HALF_PI).dy; // mid-swing
    expect(passing).toBeLessThanOrEqual(0);
    expect(passing).toBeLessThan(contact);
  });

  it("all walk outputs finite over a full cycle", () => {
    for (let p = 0; p <= Math.PI * 2; p += 0.3)
      for (const y of [0, 0.25, 0.5, 0.75, 1])
        for (const s of [-1, 1] as const) {
          const w = bandWarp("walk", y, s, p);
          expect(Number.isFinite(w.dx)).toBe(true);
          expect(Number.isFinite(w.dy)).toBe(true);
        }
  });
});

describe("bandWarp — stomp (boss gait)", () => {
  it("alternates legs at the feet, opposite per side mid-stride", () => {
    const l = bandWarp("stomp", 1, -1, HALF_PI);
    const r = bandWarp("stomp", 1, 1, HALF_PI);
    expect(Math.sign(l.dx)).toBe(-Math.sign(r.dx));
    expect(l.dx).not.toBe(0);
  });

  it("leg swing grows from waist (~0) to feet (max)", () => {
    const waist = Math.abs(bandWarp("stomp", 0.5, 1, HALF_PI).dx);
    const feet = Math.abs(bandWarp("stomp", 1, 1, HALF_PI).dx);
    expect(waist).toBeLessThan(feet);
    expect(waist).toBeCloseTo(0, 5);
  });

  it("neutral foot contact at phase 0 (feet do not shear)", () => {
    expect(bandWarp("stomp", 1, -1, 0).dx).toBeCloseTo(0, 6);
    expect(bandWarp("stomp", 1, 1, 0).dx).toBeCloseTo(0, 6);
  });

  it("is heavier than a normal walk: bigger bob and stride", () => {
    const sBob = Math.abs(bandWarp("stomp", 0.2, 1, HALF_PI).dy);
    const wBob = Math.abs(bandWarp("walk", 0.2, 1, HALF_PI).dy);
    expect(sBob).toBeGreaterThan(wBob);
    const sStride = Math.abs(bandWarp("stomp", 1, 1, HALF_PI).dx);
    const wStride = Math.abs(bandWarp("walk", 1, 1, HALF_PI).dx);
    expect(sStride).toBeGreaterThan(wStride);
  });

  it("all stomp outputs finite over a full cycle", () => {
    for (let p = 0; p <= Math.PI * 2; p += 0.3)
      for (const y of [0, 0.25, 0.5, 0.75, 1])
        for (const s of [-1, 1] as const) {
          const w = bandWarp("stomp", y, s, p);
          expect(Number.isFinite(w.dx)).toBe(true);
          expect(Number.isFinite(w.dy)).toBe(true);
        }
  });
});

describe("bandWarp — flap", () => {
  it("no horizontal shear; wings oscillate vertically with phase", () => {
    expect(bandWarp("flap", 0.2, 1, HALF_PI).dx).toBe(0);
    const up = bandWarp("flap", 0.2, 1, HALF_PI).dy;
    const down = bandWarp("flap", 0.2, 1, -HALF_PI).dy;
    expect(up).not.toBeCloseTo(down, 3);
  });

  it("all flap outputs finite over a full cycle", () => {
    for (let p = 0; p <= Math.PI * 2; p += 0.3)
      for (const y of [0, 0.25, 0.5, 0.75, 1]) {
        const w = bandWarp("flap", y, 1, p);
        expect(Number.isFinite(w.dx)).toBe(true);
        expect(Number.isFinite(w.dy)).toBe(true);
      }
  });
});
