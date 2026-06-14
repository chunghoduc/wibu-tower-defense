// tests/scrollDrag.test.ts
import { describe, it, expect } from "vitest";
import { dragOffset, offsetFromPixels, attachDragScroll } from "../src/scenes/scrollDrag.ts";

class FakeEmitter {
  handlers: Record<string, ((...a: unknown[]) => void)[]> = {};
  on(ev: string, fn: (...a: unknown[]) => void) {
    (this.handlers[ev] ??= []).push(fn);
  }
  once(ev: string, fn: (...a: unknown[]) => void) {
    this.on(ev, fn);
  }
  off(ev: string, fn: (...a: unknown[]) => void) {
    this.handlers[ev] = (this.handlers[ev] ?? []).filter((h) => h !== fn);
  }
  emit(ev: string, ...args: unknown[]) {
    (this.handlers[ev] ?? []).slice().forEach((h) => h(...args));
  }
  count(ev: string) {
    return (this.handlers[ev] ?? []).length;
  }
}

function makeScene() {
  return { input: new FakeEmitter(), events: new FakeEmitter(), time: { now: 0 } };
}

const ROW = 50;

describe("dragOffset", () => {
  it("keeps the offset when the drag is shorter than a row", () => {
    expect(dragOffset(2, 300, 280, ROW, 9)).toBe(2); // 20px < ROW → rounds to 0 rows
  });

  it("scrolls the list down (offset up) when dragging the finger up", () => {
    // finger up by 2 rows → reveal lower rows
    expect(dragOffset(0, 300, 200, ROW, 9)).toBe(2);
  });

  it("scrolls the list up (offset down) when dragging the finger down", () => {
    expect(dragOffset(5, 200, 300, ROW, 9)).toBe(3);
  });

  it("clamps at the top", () => {
    expect(dragOffset(1, 100, 400, ROW, 9)).toBe(0); // would be negative
  });

  it("clamps at the bottom (maxOffset)", () => {
    expect(dragOffset(7, 400, 100, ROW, 9)).toBe(9); // 7 + 6 rows = 13 → clamp to 9
  });

  it("anchors to startOffset so a continued drag is absolute, not incremental", () => {
    // Same gesture (startY=300, startOffset=0) at successive Y positions.
    expect(dragOffset(0, 300, 250, ROW, 9)).toBe(1);
    expect(dragOffset(0, 300, 200, ROW, 9)).toBe(2);
    expect(dragOffset(0, 300, 150, ROW, 9)).toBe(3);
  });
});

describe("attachDragScroll teardown", () => {
  it("tracks a drag, then destroy() removes every scene listener", () => {
    let offset = 0;
    const scene = makeScene();
    const handle = attachDragScroll(scene as never, {
      rect: () => ({ x: 0, y: 0, w: 100, h: 100 }),
      rowH: 50,
      maxOffset: () => 9,
      getOffset: () => offset,
      setOffset: (n) => {
        offset = n;
      },
      onChange: () => {},
    });

    scene.input.emit("pointerdown", { x: 10, y: 80, isDown: true });
    scene.input.emit("pointermove", { x: 10, y: 30, isDown: true });
    expect(offset).toBe(1); // dragged finger up one row

    handle.destroy();
    for (const ev of ["pointerdown", "pointermove", "pointerup", "pointercancel"]) {
      expect(scene.input.count(ev)).toBe(0);
    }

    offset = 0;
    scene.input.emit("pointerdown", { x: 10, y: 80, isDown: true });
    scene.input.emit("pointermove", { x: 10, y: 30, isDown: true });
    expect(offset).toBe(0); // inert after destroy
  });
});

describe("offsetFromPixels", () => {
  it("converts a positive pixel scroll (content moves up) into row offset", () => {
    // 120px of upward content travel at 50px/row, from offset 0 => +2 rows
    expect(offsetFromPixels(0, 120, 50, 9)).toBe(2);
  });

  it("converts a negative pixel scroll back toward the top", () => {
    expect(offsetFromPixels(5, -100, 50, 9)).toBe(3);
  });

  it("clamps at the top (0)", () => {
    expect(offsetFromPixels(1, -500, 50, 9)).toBe(0);
  });

  it("clamps at maxOffset", () => {
    expect(offsetFromPixels(7, 1000, 50, 9)).toBe(9);
  });
});
