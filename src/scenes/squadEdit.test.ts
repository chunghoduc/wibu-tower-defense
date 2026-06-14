import { describe, it, expect } from "vitest";
import {
  squadAdd,
  squadRemove,
  squadPlaceAt,
  autoFillSquad,
  clearSquad,
  charSquadScore,
  SQUAD_MAX,
} from "./squadEdit.ts";

const empty = (): (string | null)[] => Array.from({ length: SQUAD_MAX }, () => null);

describe("squadAdd", () => {
  it("adds to the first empty slot", () => {
    const r = squadAdd(["a", null, null, null, null, null, null], "b");
    expect(r.slots).toEqual(["a", "b", null, null, null, null, null]);
    expect(r.changed).toBe(true);
    expect(r.reason).toBe("added");
  });
  it("is a no-op when the char is already in the squad", () => {
    const start = ["a", "b", null, null, null, null, null];
    const r = squadAdd(start, "a");
    expect(r.changed).toBe(false);
    expect(r.reason).toBe("noop");
    expect(r.slots).toEqual(start);
  });
  it("is a no-op with reason 'full' when all slots are filled", () => {
    const full = ["a", "b", "c", "d", "e", "f", "g"];
    const r = squadAdd(full, "h");
    expect(r.changed).toBe(false);
    expect(r.reason).toBe("full");
    expect(r.slots).toEqual(full);
  });
  it("does not mutate the input array", () => {
    const start = empty();
    squadAdd(start, "x");
    expect(start).toEqual(empty());
  });
});

describe("squadRemove", () => {
  it("removes the char wherever it sits", () => {
    const r = squadRemove(["a", "b", "c", null, null, null, null], "b");
    expect(r.slots).toEqual(["a", null, "c", null, null, null, null]);
    expect(r.changed).toBe(true);
    expect(r.reason).toBe("removed");
  });
  it("is a no-op when the char is absent", () => {
    const start = ["a", null, null, null, null, null, null];
    const r = squadRemove(start, "z");
    expect(r.changed).toBe(false);
    expect(r.slots).toEqual(start);
  });
});

describe("squadPlaceAt", () => {
  it("places into a specific empty slot", () => {
    const r = squadPlaceAt(empty(), "a", 3);
    expect(r.slots[3]).toBe("a");
    expect(r.reason).toBe("placed");
  });
  it("moves an already-slotted char (no duplicate)", () => {
    const r = squadPlaceAt(["a", null, null, null, null, null, null], "a", 4);
    expect(r.slots[0]).toBe(null);
    expect(r.slots[4]).toBe("a");
    expect(r.slots.filter((s) => s === "a")).toHaveLength(1);
  });
  it("overwrites a filled target slot (swap semantics)", () => {
    const r = squadPlaceAt(["a", "b", null, null, null, null, null], "c", 1);
    expect(r.slots[1]).toBe("c");
  });
});

describe("autoFillSquad", () => {
  it("fills only empty slots, in order, from the candidate list", () => {
    const r = autoFillSquad(["a", null, null, null, null, null, null], ["b", "c"]);
    expect(r.slots).toEqual(["a", "b", "c", null, null, null, null]);
    expect(r.filled).toBe(2);
    expect(r.reason).toBe("added");
  });
  it("never duplicates a char already in the squad", () => {
    const r = autoFillSquad(["a", null, null, null, null, null, null], ["a", "b"]);
    expect(r.slots).toEqual(["a", "b", null, null, null, null, null]);
    expect(r.filled).toBe(1);
  });
  it("never disturbs filled slots and stops when full", () => {
    const r = autoFillSquad(["a", "b", "c", "d", "e", "f", null], ["g", "h", "i"]);
    expect(r.slots).toEqual(["a", "b", "c", "d", "e", "f", "g"]);
    expect(r.filled).toBe(1);
  });
  it("is a safe no-op when there are no candidates", () => {
    const start = ["a", null, null, null, null, null, null];
    const r = autoFillSquad(start, []);
    expect(r.changed).toBe(false);
    expect(r.filled).toBe(0);
  });
});

describe("clearSquad", () => {
  it("empties every slot", () => {
    const r = clearSquad(["a", "b", null, null, null, null, null]);
    expect(r.slots).toEqual(empty());
    expect(r.reason).toBe("cleared");
    expect(r.changed).toBe(true);
  });
  it("is a no-op when already empty", () => {
    const r = clearSquad(empty());
    expect(r.changed).toBe(false);
  });
});

describe("charSquadScore", () => {
  it("ranks higher rarity above lower regardless of stars", () => {
    expect(charSquadScore("Legendary", 0)).toBeGreaterThan(charSquadScore("Rare", 5));
  });
  it("ranks more stars higher within the same rarity", () => {
    expect(charSquadScore("Rare", 3)).toBeGreaterThan(charSquadScore("Rare", 1));
  });
});
