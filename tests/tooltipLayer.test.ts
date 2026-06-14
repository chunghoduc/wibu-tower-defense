import { describe, expect, it, vi } from "vitest";
import { TOOLTIP_DEPTH, floatTooltip } from "../src/scenes/tooltipLayer.ts";

// Highest dialog/overlay depth currently in the codebase is 320 (wingCraftDialog).
const HIGHEST_OTHER_UI_DEPTH = 320;

describe("tooltipLayer", () => {
  it("reserves a depth strictly above every dialog/overlay layer", () => {
    expect(TOOLTIP_DEPTH).toBeGreaterThan(HIGHEST_OTHER_UI_DEPTH);
    expect(TOOLTIP_DEPTH).toBeGreaterThanOrEqual(1000); // comfortable headroom for future UI
  });

  it("floatTooltip bumps the container to the top layer", () => {
    const c = { setDepth: vi.fn(), parentContainer: null };
    floatTooltip(c);
    expect(c.setDepth).toHaveBeenCalledWith(TOOLTIP_DEPTH);
  });

  it("floatTooltip raises a nested tooltip within its parent too", () => {
    const bringToTop = vi.fn();
    const c = { setDepth: vi.fn(), parentContainer: { bringToTop } };
    floatTooltip(c);
    expect(c.setDepth).toHaveBeenCalledWith(TOOLTIP_DEPTH);
    expect(bringToTop).toHaveBeenCalledWith(c);
  });

  it("floatTooltip is safe on a top-level container (no parent)", () => {
    const c = { setDepth: vi.fn(), parentContainer: null };
    expect(() => floatTooltip(c)).not.toThrow();
  });
});
