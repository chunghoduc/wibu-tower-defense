import { describe, it, expect } from "vitest";
import { fitLabel, type Measure } from "../src/scenes/labelFit.ts";

// Synthetic monospace measure: each char is 0.6*fontPx wide. Deterministic.
const mono: Measure = (text, px) => text.length * px * 0.6;

describe("fitLabel", () => {
  it("keeps base font on one line for a short name", () => {
    const p = fitLabel("Iron Sword", { maxWidth: 80, maxLines: 2, basePx: 12, minPx: 8 }, mono);
    expect(p.fontPx).toBe(12);
    expect(p.lines).toEqual(["Iron Sword"]);
    expect(p.truncated).toBe(false);
  });

  it("wraps to two lines when a name is too wide for one", () => {
    // "Legendary Boss Chest" = 20 chars; at 10px*0.6=6 => 120px on one line > 78.
    const p = fitLabel(
      "Legendary Boss Chest",
      { maxWidth: 78, maxLines: 2, basePx: 10, minPx: 7 },
      mono,
    );
    expect(p.lines.length).toBe(2);
    expect(p.truncated).toBe(false);
    for (const ln of p.lines) expect(mono(ln, p.fontPx)).toBeLessThanOrEqual(78);
  });

  it("shrinks the font before wrapping/ellipsis when that lets it fit one line", () => {
    // 12 chars; base 12 => 12*12*0.6=86.4 > 60; at 8 => 12*8*0.6=57.6 <= 60.
    const p = fitLabel("Thunderbolts", { maxWidth: 60, maxLines: 1, basePx: 12, minPx: 8 }, mono);
    expect(p.fontPx).toBe(8);
    expect(p.lines).toEqual(["Thunderbolts"]);
    expect(p.truncated).toBe(false);
  });

  it("ellipsis-truncates and never exceeds bounds when nothing fits", () => {
    const p = fitLabel(
      "Supercalifragilistic Doom Blade of Eternal Night",
      { maxWidth: 50, maxLines: 2, basePx: 10, minPx: 7 },
      mono,
    );
    expect(p.truncated).toBe(true);
    expect(p.lines.length).toBeLessThanOrEqual(2);
    for (const ln of p.lines) expect(mono(ln, p.fontPx)).toBeLessThanOrEqual(50);
    expect(p.lines[p.lines.length - 1].endsWith("…")).toBe(true);
  });

  it("hard-breaks a single word wider than maxWidth", () => {
    const p = fitLabel(
      "Aaaaaaaaaaaaaaaaaaaa",
      { maxWidth: 30, maxLines: 2, basePx: 8, minPx: 8 },
      mono,
    );
    for (const ln of p.lines) expect(mono(ln, p.fontPx)).toBeLessThanOrEqual(30);
  });

  it("handles empty string", () => {
    const p = fitLabel("", { maxWidth: 50, maxLines: 2, basePx: 10, minPx: 7 }, mono);
    expect(p.lines).toEqual([""]);
    expect(p.truncated).toBe(false);
  });
});
