// tests/scrollDrag.test.ts
import { describe, it, expect } from "vitest";
import { dragOffset, offsetFromPixels } from "../src/scenes/scrollDrag.ts";

const ROW = 50;

describe("dragOffset", () => {
  it("keeps the offset when the drag is shorter than a row", () => {
    expect(dragOffset(2, 300, 280, ROW, 9)).toBe(2); // 20px < ROW → rounds to 0 rows
  });

  it("scrolls the list down (offset up) when dragging the finger up", () => {
    // finger up by 2 rows → reveal lower rows
    expect(dragOffset(0, 300, 200, ROW, 9)).toBe(2);
  });

  it("scrolls the list up (offset down) when dragging the finger down", () => {
    expect(dragOffset(5, 200, 300, ROW, 9)).toBe(3);
  });

  it("clamps at the top", () => {
    expect(dragOffset(1, 100, 400, ROW, 9)).toBe(0); // would be negative
  });

  it("clamps at the bottom (maxOffset)", () => {
    expect(dragOffset(7, 400, 100, ROW, 9)).toBe(9); // 7 + 6 rows = 13 → clamp to 9
  });

  it("anchors to startOffset so a continued drag is absolute, not incremental", () => {
    // Same gesture (startY=300, startOffset=0) at successive Y positions.
    expect(dragOffset(0, 300, 250, ROW, 9)).toBe(1);
    expect(dragOffset(0, 300, 200, ROW, 9)).toBe(2);
    expect(dragOffset(0, 300, 150, ROW, 9)).toBe(3);
  });
});

describe("offsetFromPixels", () => {
  it("converts a positive pixel scroll (content moves up) into row offset", () => {
    // 120px of upward content travel at 50px/row, from offset 0 => +2 rows
    expect(offsetFromPixels(0, 120, 50, 9)).toBe(2);
  });

  it("converts a negative pixel scroll back toward the top", () => {
    expect(offsetFromPixels(5, -100, 50, 9)).toBe(3);
  });

  it("clamps at the top (0)", () => {
    expect(offsetFromPixels(1, -500, 50, 9)).toBe(0);
  });

  it("clamps at maxOffset", () => {
    expect(offsetFromPixels(7, 1000, 50, 9)).toBe(9);
  });
});
