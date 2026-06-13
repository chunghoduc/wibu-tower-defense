import { describe, it, expect } from "vitest";
import { hardenTouchInput } from "../src/core/touchInput.ts";

describe("hardenTouchInput", () => {
  it("declares full gesture ownership on the element", () => {
    const el = { style: {} as { touchAction?: string; overscrollBehavior?: string } };
    hardenTouchInput(el);
    expect(el.style.touchAction).toBe("none");
    expect(el.style.overscrollBehavior).toBe("none");
  });

  it("is idempotent", () => {
    const el = { style: {} as { touchAction?: string; overscrollBehavior?: string } };
    hardenTouchInput(el);
    hardenTouchInput(el);
    expect(el.style.touchAction).toBe("none");
    expect(el.style.overscrollBehavior).toBe("none");
  });
});
