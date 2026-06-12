import { describe, expect, it, vi } from "vitest";
import { FxPool } from "../src/scenes/fxPool.ts";

type Stub = Record<string, ReturnType<typeof vi.fn>> & { destroyed: boolean };
function stubShape(): Stub {
  const s = { destroyed: false } as Stub;
  for (const m of [
    "setPosition",
    "setFillStyle",
    "setStrokeStyle",
    "setAlpha",
    "setScale",
    "setAngle",
    "setOrigin",
    "setVisible",
    "setActive",
    "setDepth",
    "setBlendMode",
    "setSize",
  ])
    s[m] = vi.fn().mockReturnValue(s);
  s.destroy = vi.fn(() => {
    s.destroyed = true;
  });
  return s;
}
function stubFactory() {
  const made: Stub[] = [];
  const make = () => {
    const s = stubShape();
    made.push(s);
    return s;
  };
  return { made, fac: { circle: make, rectangle: make, star: make } };
}

describe("FxPool", () => {
  it("creates on first acquire, reuses after release", () => {
    const { made, fac } = stubFactory();
    const pool = new FxPool(fac as never);
    const a = pool.circle(1, 2, 3, 0xff0000, 1);
    pool.release(a as never);
    const b = pool.circle(9, 9, 5, 0x00ff00, 0.5);
    expect(b).toBe(a); // reused, not re-created
    expect(made.length).toBe(1);
  });

  it("resets full state on reuse", () => {
    const { fac } = stubFactory();
    const pool = new FxPool(fac as never);
    const a = pool.circle(1, 2, 3, 0xff0000, 1) as never as Stub;
    pool.release(a as never);
    pool.circle(9, 8, 7, 0x123456, 0.5);
    expect(a.setPosition).toHaveBeenLastCalledWith(9, 8);
    expect(a.setAlpha).toHaveBeenLastCalledWith(1);
    expect(a.setScale).toHaveBeenLastCalledWith(1);
    expect(a.setAngle).toHaveBeenLastCalledWith(0);
    expect(a.setStrokeStyle).toHaveBeenCalled(); // stroke cleared
    expect(a.setBlendMode).toHaveBeenLastCalledWith(0); // ADD glow cleared
    expect(a.setVisible).toHaveBeenLastCalledWith(true);
    expect(a.setFillStyle).toHaveBeenLastCalledWith(0x123456, 0.5);
  });

  it("destroys (not pools) beyond the cap, and destroys unknown objects", () => {
    const { fac } = stubFactory();
    const pool = new FxPool(fac as never, 1);
    const a = pool.circle(0, 0, 1);
    const b = pool.circle(0, 0, 1);
    pool.release(a as never);
    pool.release(b as never); // over cap → destroy
    expect((b as never as Stub).destroyed).toBe(true);
    const foreign = stubShape();
    pool.release(foreign as never); // not pool-made → destroy
    expect(foreign.destroyed).toBe(true);
  });

  it("pools circles, rects and stars independently", () => {
    const { fac } = stubFactory();
    const pool = new FxPool(fac as never);
    const c = pool.circle(0, 0, 1);
    pool.release(c as never);
    const r = pool.rect(0, 0, 2, 2, 0xffffff);
    expect(r).not.toBe(c); // a released circle never serves a rect request
    pool.release(r as never);
    const s = pool.star(0, 0, 5, 2, 4, 0xffffff);
    expect(s).not.toBe(r);
  });
});
