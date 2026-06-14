import { describe, it, expect } from "vitest";
import { backfillMeta, defaultMeta } from "./meta.ts";

describe("expedition daily-dispatch defaults", () => {
  it("defaultMeta seeds a full daily dispatch allowance", () => {
    const m = defaultMeta();
    expect(m.expedition.dispatchesLeft).toBe(5);
    expect(m.expedition.dispatchDay).toBe("");
  });

  it("backfillMeta seeds a full daily dispatch allowance", () => {
    const m = backfillMeta(undefined);
    expect(m.expedition.dispatchesLeft).toBe(5);
    expect(m.expedition.dispatchDay).toBe("");
  });

  it("backfillMeta preserves an existing partial dispatch counter", () => {
    const m = backfillMeta({ expedition: { dispatchesLeft: 2 } } as never);
    expect(m.expedition.dispatchesLeft).toBe(2);
    expect(m.expedition.dispatchDay).toBe("");
  });
});
