import { describe, it, expect } from "vitest";
import {
  wingCraftGate,
  wingMachineLayout,
  loadedSlotLayout,
  oddsBarSegments,
  type Rect,
} from "../src/core/wingCraftMachine.ts";

const base = { itemCount: 5, jewels: 1, feather: true, jewelsOwned: 4, feathersOwned: 2 };

describe("wingCraftGate", () => {
  it("locks when fewer than 5 items are loaded", () => {
    const g = wingCraftGate({ ...base, itemCount: 3 });
    expect(g.canCraft).toBe(false);
    expect(g.needItems).toBe(2);
  });

  it("unlocks at exactly 5 items + a jewel + a feather", () => {
    const g = wingCraftGate(base);
    expect(g.canCraft).toBe(true);
    expect(g.needItems).toBe(0);
    expect(g.hasJewel).toBe(true);
    expect(g.hasFeather).toBe(true);
  });

  it("locks with no jewel loaded", () => {
    const g = wingCraftGate({ ...base, jewels: 0 });
    expect(g.hasJewel).toBe(false);
    expect(g.canCraft).toBe(false);
  });

  it("locks when loaded jewels exceed owned", () => {
    const g = wingCraftGate({ ...base, jewels: 3, jewelsOwned: 2 });
    expect(g.hasJewel).toBe(false);
    expect(g.canCraft).toBe(false);
  });

  it("locks without a feather (or none owned)", () => {
    expect(wingCraftGate({ ...base, feather: false }).hasFeather).toBe(false);
    expect(wingCraftGate({ ...base, feathersOwned: 0 }).hasFeather).toBe(false);
  });

  it("never reports negative needItems above the minimum", () => {
    expect(wingCraftGate({ ...base, itemCount: 9 }).needItems).toBe(0);
  });
});

const inside = (a: Rect, b: Rect): boolean =>
  a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h;

describe("wingMachineLayout", () => {
  const L = wingMachineLayout(960, 540);

  it("nests the machine, tray, readout and craft button inside the panel", () => {
    for (const r of [L.machine, L.tray, L.readout, L.craftBtn, L.oddsBar]) {
      expect(inside(r, L.panel)).toBe(true);
    }
  });

  it("puts the tray below the machine", () => {
    expect(L.tray.y).toBeGreaterThanOrEqual(L.machine.y + L.machine.h);
  });

  it("keeps the odds bar inside the readout region", () => {
    expect(inside(L.oddsBar, L.readout)).toBe(true);
  });

  it("places jewel and feather sockets inside the machine", () => {
    expect(inside(L.jewelSocket, L.machine)).toBe(true);
    expect(inside(L.featherSocket, L.machine)).toBe(true);
  });

  it("centers the panel on screen", () => {
    expect(L.panel.x + L.panel.w / 2).toBeCloseTo(480, 0);
    expect(L.panel.y + L.panel.h / 2).toBeCloseTo(270, 0);
  });
});

describe("loadedSlotLayout", () => {
  const machine: Rect = { x: 100, y: 100, w: 400, h: 150 };

  it("returns exactly `count` points", () => {
    expect(loadedSlotLayout(7, machine)).toHaveLength(7);
    expect(loadedSlotLayout(0, machine)).toHaveLength(0);
  });

  it("keeps every slot inside the machine", () => {
    for (const p of loadedSlotLayout(12, machine, 36)) {
      expect(p.x).toBeGreaterThanOrEqual(machine.x);
      expect(p.y).toBeGreaterThanOrEqual(machine.y);
      expect(p.x).toBeLessThanOrEqual(machine.x + machine.w);
      expect(p.y).toBeLessThanOrEqual(machine.y + machine.h);
    }
  });
});

describe("oddsBarSegments", () => {
  const bar: Rect = { x: 10, y: 0, w: 300, h: 18 };
  const odds = [
    { rarity: "Common" as const, chance: 0.6 },
    { rarity: "Magic" as const, chance: 0.35 },
    { rarity: "Rare" as const, chance: 0.05 },
  ];

  it("tiles the bar exactly with no gaps and preserves order", () => {
    const segs = oddsBarSegments(odds, bar);
    expect(segs.map((s) => s.rarity)).toEqual(["Common", "Magic", "Rare"]);
    expect(segs[0].x).toBe(bar.x);
    for (let i = 1; i < segs.length; i++) {
      expect(segs[i].x).toBeCloseTo(segs[i - 1].x + segs[i - 1].w, 5);
    }
    const last = segs[segs.length - 1];
    expect(last.x + last.w).toBeCloseTo(bar.x + bar.w, 5);
  });

  it("makes widths proportional to chance", () => {
    const segs = oddsBarSegments(odds, bar);
    expect(segs[0].w).toBeGreaterThan(segs[1].w);
    expect(segs[1].w).toBeGreaterThan(segs[2].w);
  });

  it("handles a single-segment outcome", () => {
    const segs = oddsBarSegments([{ rarity: "Common", chance: 1 }], bar);
    expect(segs).toHaveLength(1);
    expect(segs[0].w).toBeCloseTo(bar.w, 5);
  });
});
