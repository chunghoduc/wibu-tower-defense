import { describe, expect, it } from "vitest";
import { createFreshSave } from "../src/core/save.ts";
import { spin, freeSpinAvailable, SPIN_PITY, SPIN_WHEEL } from "../src/core/spin.ts";
import { Rng } from "../src/core/rng.ts";

describe("F4 lucky spin", () => {
  it("free spin is available on a fresh save and consumed for the day", () => {
    const s = createFreshSave();
    expect(freeSpinAvailable(s, "2026-06-09")).toBe(true);
    spin(s, "2026-06-09", new Rng(1), true);
    expect(freeSpinAvailable(s, "2026-06-09")).toBe(false);
    expect(freeSpinAvailable(s, "2026-06-10")).toBe(true);
  });

  it("grants the prize's reward", () => {
    const s = createFreshSave();
    const before = s.currency.gold + s.currency.diamonds;
    const res = spin(s, "2026-06-09", new Rng(3), true);
    const after =
      s.currency.gold + s.currency.diamonds + Object.values(s.materials).reduce((a, b) => a + b, 0);
    expect(after).toBeGreaterThan(before);
    expect(SPIN_WHEEL.some((p) => p.id === res.prize.id)).toBe(true);
  });

  it("pity forces a rare-band prize after SPIN_PITY non-rare spins", () => {
    const s = createFreshSave();
    s.meta.spin.pityCount = SPIN_PITY - 1;
    const res = spin(s, "2026-06-09", new Rng(99), false);
    expect(res.pityTriggered).toBe(true);
    expect(res.prize.rare).toBe(true);
    expect(s.meta.spin.pityCount).toBe(0); // reset after a rare
  });

  it("rare result resets pity, non-rare increments it", () => {
    const s = createFreshSave();
    s.meta.spin.pityCount = 0;
    const res = spin(s, "2026-06-09", new Rng(7), false);
    if (res.prize.rare) expect(s.meta.spin.pityCount).toBe(0);
    else expect(s.meta.spin.pityCount).toBe(1);
  });
});
