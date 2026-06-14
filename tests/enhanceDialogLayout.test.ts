import { describe, expect, it } from "vitest";
import { enhanceDialogLayout, ROW_H, STATS_TOP } from "../src/scenes/enhanceDialogLayout.ts";

// Approximate rendered line height of the info text (fontSize 11-13px + outline).
const LINE_H = 16;

describe("enhanceDialogLayout", () => {
  it("places the first stat row at STATS_TOP and stacks by ROW_H", () => {
    const l = enhanceDialogLayout(3);
    expect(l.statsTop).toBe(STATS_TOP);
    expect(l.rowH).toBe(ROW_H);
  });

  it("never overlaps the Enhance button with the info text", () => {
    // The historical bug: an item with N base stats + 1 affix row rendered N+1
    // rows, but the height/button were sized for N rows, so the button landed on
    // the 'Success %' line. Guard every plausible row count.
    for (let rows = 0; rows <= 8; rows++) {
      const l = enhanceDialogLayout(rows);
      // info lines sit below the last stat row...
      const n = Math.max(1, rows);
      const statsBottom = STATS_TOP + n * ROW_H;
      expect(l.needsY).toBeGreaterThanOrEqual(statsBottom);
      expect(l.successY).toBeGreaterThanOrEqual(l.needsY + LINE_H);
      // ...and the button sits clear below the success line.
      expect(l.buttonY).toBeGreaterThanOrEqual(l.successY + LINE_H);
    }
  });

  it("contains the button (and its bottom padding) within the panel height", () => {
    for (let rows = 0; rows <= 8; rows++) {
      const l = enhanceDialogLayout(rows);
      expect(l.buttonY + l.buttonH).toBeLessThanOrEqual(l.H);
    }
  });

  it("grows the panel height by one ROW_H per extra stat row", () => {
    expect(enhanceDialogLayout(4).H - enhanceDialogLayout(3).H).toBe(ROW_H);
  });
});
