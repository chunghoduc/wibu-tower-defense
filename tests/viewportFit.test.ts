import { describe, it, expect } from "vitest";
import {
  viewportChanged,
  visibleSize,
  installViewportFit,
  type Size,
  type ViewportWindow,
} from "../src/core/viewportFit.ts";

describe("viewportChanged", () => {
  const s = (width: number, height: number): Size => ({ width, height });

  it("is false for identical sizes", () => {
    expect(viewportChanged(s(844, 390), s(844, 390))).toBe(false);
  });

  it("ignores sub-epsilon jitter (default 1px)", () => {
    expect(viewportChanged(s(844, 390), s(844.4, 389.7))).toBe(false);
  });

  it("is true when height shrinks past epsilon (toolbar appears)", () => {
    // The whole bug: visible height drops when the browser toolbar shows.
    expect(viewportChanged(s(844, 390), s(844, 330))).toBe(true);
  });

  it("is true when width changes past epsilon (rotation)", () => {
    expect(viewportChanged(s(390, 844), s(844, 390))).toBe(true);
  });

  it("respects a custom epsilon", () => {
    expect(viewportChanged(s(0, 100), s(0, 104), 5)).toBe(false);
    expect(viewportChanged(s(0, 100), s(0, 106), 5)).toBe(true);
  });
});

describe("visibleSize", () => {
  it("reads the visualViewport when present (the visible area, not the layout one)", () => {
    const src = {
      visualViewport: { width: 800, height: 360 },
      innerWidth: 800,
      innerHeight: 412, // layout viewport is taller — must NOT be used
    };
    expect(visibleSize(src)).toEqual({ width: 800, height: 360 });
  });

  it("falls back to innerWidth/innerHeight when visualViewport is absent", () => {
    const src = { visualViewport: null, innerWidth: 1280, innerHeight: 720 };
    expect(visibleSize(src)).toEqual({ width: 1280, height: 720 });
  });
});

describe("installViewportFit", () => {
  function fakeWindow(initial: Size) {
    const handlers: Record<string, Array<() => void>> = {};
    const vvHandlers: Record<string, Array<() => void>> = {};
    const vv = {
      width: initial.width,
      height: initial.height,
      addEventListener: (t: string, cb: () => void) => (vvHandlers[t] ??= []).push(cb),
      removeEventListener: (t: string, cb: () => void) => {
        vvHandlers[t] = (vvHandlers[t] ?? []).filter((h) => h !== cb);
      },
    };
    const win = {
      visualViewport: vv,
      innerWidth: initial.width,
      innerHeight: initial.height,
      addEventListener: (t: string, cb: () => void) => (handlers[t] ??= []).push(cb),
      removeEventListener: (t: string, cb: () => void) => {
        handlers[t] = (handlers[t] ?? []).filter((h) => h !== cb);
      },
    } as unknown as ViewportWindow;
    return {
      win,
      vv,
      fire: (t: string) => (vvHandlers[t] ?? []).forEach((h) => h()),
      fireWin: (t: string) => (handlers[t] ?? []).forEach((h) => h()),
      vvCount: (t: string) => (vvHandlers[t] ?? []).length,
    };
  }

  it("refreshes Phaser (deferred) when the visible viewport actually shrinks", () => {
    const f = fakeWindow({ width: 844, height: 390 });
    let refreshes = 0;
    const pending: Array<() => void> = [];
    installViewportFit({ scale: { refresh: () => refreshes++ } }, f.win, (fn) => pending.push(fn));

    f.vv.height = 320; // toolbar appears
    f.fire("resize");
    expect(refreshes).toBe(0); // deferred, not synchronous (dvh relayout must flush first)
    pending.splice(0).forEach((fn) => fn());
    expect(refreshes).toBe(1);
  });

  it("does NOT refresh on sub-epsilon jitter (e.g. iOS scroll wobble)", () => {
    const f = fakeWindow({ width: 844, height: 390 });
    let refreshes = 0;
    const pending: Array<() => void> = [];
    installViewportFit({ scale: { refresh: () => refreshes++ } }, f.win, (fn) => pending.push(fn));

    f.vv.height = 390.3;
    f.fire("scroll");
    pending.splice(0).forEach((fn) => fn());
    expect(refreshes).toBe(0);
  });

  it("disposer detaches the visualViewport listeners", () => {
    const f = fakeWindow({ width: 844, height: 390 });
    const dispose = installViewportFit({ scale: { refresh: () => {} } }, f.win, (fn) => fn());
    expect(f.vvCount("resize")).toBe(1);
    dispose();
    expect(f.vvCount("resize")).toBe(0);
  });
});
