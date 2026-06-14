import { describe, it, expect } from "vitest";
import { createDragLifecycle, type DragLifecycleDeps } from "./inventoryDragLifecycle.ts";

// A stand-in for a dragged tile. Phaser nulls `input` when a GameObject is
// destroyed — which is exactly what an inventory rebuild (tiles.removeAll(true))
// does to the tile under the pointer.
interface FakeTile {
  input: object | null;
}

interface Harness {
  lifecycle: ReturnType<typeof createDragLifecycle<FakeTile, string>>;
  log: string[];
  dragging: boolean;
  flushDeferred: () => void;
}

function harness(over: Partial<DragLifecycleDeps<FakeTile, string>> = {}): Harness {
  const log: string[] = [];
  const deferred: Array<() => void> = [];
  const h: Harness = {
    dragging: false,
    log,
    flushDeferred: () => {
      const fns = deferred.splice(0);
      fns.forEach((f) => f());
    },
    lifecycle: createDragLifecycle<FakeTile, string>({
      lift: () => log.push("lift"),
      move: () => log.push("move"),
      applyDrop: () => log.push("applyDrop"),
      refresh: () => log.push("refresh"),
      setDragging: (a) => {
        log.push(`setDragging:${a}`);
        h.dragging = a;
      },
      defer: (fn) => deferred.push(fn),
      ...over,
    }),
  };
  return h;
}

// Faithful model of Phaser InputPlugin.processDragUpEvent (v3.80, ~L1497/L1506):
//   emit('drop');  if (obj.input && obj.input.enabled) emit('dragend');
// The dragend emit is GUARDED by the object still having `input` — so if the
// drop handler destroyed the object (input -> null), dragend is silently skipped.
function phaserDropSequence(h: Harness, obj: FakeTile, zone: string): void {
  h.lifecycle.drop(obj, zone);
  if (obj.input) h.lifecycle.dragEnd(obj, true);
}

describe("inventory drag lifecycle", () => {
  it("on drop, applies the mutation but never rebuilds the view", () => {
    // Rebuilding during `drop` destroys the dragged tile mid-gesture, which makes
    // Phaser skip the dragend emit. The mutation is fine; the rebuild is not.
    const h = harness();
    h.lifecycle.drop({ input: {} }, "Weapon");
    expect(h.log).toContain("applyDrop");
    expect(h.log).not.toContain("refresh");
  });

  it("rebuilds the view and clears the tap-guard on dragend", () => {
    const h = harness();
    h.lifecycle.dragStart({ input: {} });
    expect(h.dragging).toBe(true);
    h.lifecycle.dragEnd({ input: {} }, true);
    expect(h.log).toContain("refresh");
    expect(h.dragging).toBe(true); // not cleared synchronously (trailing pointerup)
    h.flushDeferred();
    expect(h.dragging).toBe(false);
  });

  // The regression: after a successful equip-drop the tap-guard must end up
  // false, so the next bag-item tap is registered. This only holds if `drop`
  // leaves the tile alive long enough for Phaser to emit dragend.
  it("clears the tap-guard through a full equip-drop, even though a rebuild destroys the tile", () => {
    // `refresh` models a real inventory rebuild: it destroys the dragged tile.
    const obj: FakeTile = { input: {} };
    const h = harness({
      refresh: () => {
        obj.input = null; // tiles.removeAll(true) nulls the dragged tile's input
      },
    });

    h.lifecycle.dragStart(obj);
    expect(h.dragging).toBe(true);

    phaserDropSequence(h, obj, "Weapon");

    // The dragged tile survived `drop` (rebuild deferred to dragend), so Phaser
    // emitted dragend and the guard reset got scheduled.
    h.flushDeferred();
    expect(h.dragging).toBe(false);
  });

  it("snap-back (drop outside any zone) also rebuilds and clears the guard", () => {
    const h = harness();
    h.lifecycle.dragStart({ input: {} });
    h.lifecycle.dragEnd({ input: {} }, false); // dropped === false
    expect(h.log).toContain("refresh");
    h.flushDeferred();
    expect(h.dragging).toBe(false);
  });
});
