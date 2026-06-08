import { describe, expect, it } from "vitest";
import { DOLL_SLOTS } from "../src/data/heroDoll.ts";

const bySlot = (s: string) => DOLL_SLOTS.find((d) => d.slot === s)!;

describe("inventory paper-doll layout", () => {
  it("Wing sits on the head's row, to the upper right", () => {
    const head = bySlot("Helmet");
    const wing = bySlot("Wing");
    expect(wing.ny).toBeCloseTo(head.ny, 5); // same row as head
    expect(wing.nx).toBeGreaterThan(0.5);    // right side
  });

  it("Pet sits on the head's row, to the upper left", () => {
    const head = bySlot("Helmet");
    const pet = bySlot("Pet");
    expect(pet.ny).toBeCloseTo(head.ny, 5);  // same row as head
    expect(pet.nx).toBeLessThan(0.5);        // left side
  });

  it("both ring slots are labeled 'Ring' with no numeral", () => {
    expect(bySlot("Ring1").label).toBe("Ring");
    expect(bySlot("Ring2").label).toBe("Ring");
  });
});
