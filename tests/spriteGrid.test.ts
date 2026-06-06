import { describe, expect, it } from "vitest";
import {
  parseGridLines,
  sanitizeGrid,
  mirrorHorizontal,
  validateGrid,
} from "../src/art/spriteGrid.ts";

const ALLOWED = new Set([".", "K", "A", "W"]);

describe("parseGridLines", () => {
  it("strips code fences and prose, keeping grid-like lines", () => {
    const text = "Here is the sprite:\n```\n.K.\nKAK\n.K.\n```\nDone!";
    expect(parseGridLines(text)).toEqual([".K.", "KAK", ".K."]);
  });
});

describe("sanitizeGrid", () => {
  it("pads short lines and truncates long lines to width", () => {
    const grid = sanitizeGrid(["K", "KAAAA"], 3, 2, ALLOWED);
    expect(grid).toEqual(["K..", "KAA"]);
  });

  it("pads missing rows with transparent and drops extra rows", () => {
    const grid = sanitizeGrid(["KKK"], 3, 2, ALLOWED);
    expect(grid).toEqual(["KKK", "..."]);
    const grid2 = sanitizeGrid(["AAA", "AAA", "AAA"], 3, 2, ALLOWED);
    expect(grid2.length).toBe(2);
  });

  it("maps unknown symbols to transparent (case-insensitive match first)", () => {
    const grid = sanitizeGrid(["kaZ"], 3, 1, ALLOWED);
    expect(grid).toEqual(["KA."]); // k->K, a->A, Z->.
  });
});

describe("mirrorHorizontal", () => {
  it("mirrors the left half onto the right", () => {
    expect(mirrorHorizontal(["KA.", "..."], 3)).toEqual(["KAK", "..."]);
  });
});

describe("validateGrid", () => {
  it("flags an all-transparent grid as empty", () => {
    expect(validateGrid(["...", "..."]).ok).toBe(false);
  });

  it("flags a single-symbol blob", () => {
    expect(validateGrid(["AAA", "AAA"]).ok).toBe(false);
  });

  it("accepts a mixed grid", () => {
    expect(validateGrid(["KAW", ".K."]).ok).toBe(true);
  });
});
