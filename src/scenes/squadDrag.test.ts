import { describe, it, expect } from "vitest";
import { createSquadDrag, type SquadDragDeps } from "./squadDrag.ts";

// A stand-in for a dragged squad tile. Phaser nulls `input` when a GameObject is
// destroyed — which is exactly what a SquadScene redraw (dyn/slotLayer
// removeAll(true)) does to the tile under the pointer.
interface FakeTile {
  input: object | null;
  charId: string | null;
  fromSlot: number | null;
}

interface Harness {
  drag: ReturnType<typeof createSquadDrag<FakeTile, number>>;
  log: string[];
  assigned: Array<{ id: string; slot: number }>;
  removed: string[];
  dragging: boolean;
  flushDeferred: () => void;
}

function harness(over: Partial<SquadDragDeps<FakeTile, number>> = {}): Harness {
  const log: string[] = [];
  const deferred: Array<() => void> = [];
  const h: Harness = {
    dragging: false,
    log,
    assigned: [],
    removed: [],
    flushDeferred: () => deferred.splice(0).forEach((f) => f()),
    drag: createSquadDrag<FakeTile, number>({
      lift: () => log.push("lift"),
      move: () => log.push("move"),
      charId: (o) => o.charId,
      slotOf: (z) => z,
      fromSlot: (o) => o.fromSlot,
      assign: (id, slot) => {
        log.push("assign");
        h.assigned.push({ id, slot });
      },
      removeFromSquad: (id) => {
        log.push("remove");
        h.removed.push(id);
      },
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
//   emit('drop'); if (obj.input && obj.input.enabled) emit('dragend');
// The dragend emit is GUARDED by the object still having `input` — so if the
// drop handler destroyed the object (input -> null), dragend is silently skipped.
function phaserDropSequence(h: Harness, obj: FakeTile, zone: number): void {
  h.drag.drop(obj, zone);
  if (obj.input) h.drag.dragEnd(obj, true);
}

describe("squad drag lifecycle", () => {
  it("on drop, assigns the slot but never rebuilds the view", () => {
    // Rebuilding during `drop` would destroy the dragged tile mid-gesture and
    // make Phaser skip dragend. The assignment is fine; the redraw is not.
    const h = harness();
    h.drag.drop({ input: {}, charId: "kira", fromSlot: null }, 2);
    expect(h.assigned).toEqual([{ id: "kira", slot: 2 }]);
    expect(h.log).not.toContain("refresh");
  });

  // THE REGRESSION: after a successful drag-to-slot the tap-guard must end up
  // false, so the next character tap is registered. This only holds if `drop`
  // leaves the tile alive long enough for Phaser to emit dragend.
  it("clears the tap-guard through a full drag-to-slot, even though the redraw destroys the tile", () => {
    const obj: FakeTile = { input: {}, charId: "kira", fromSlot: null };
    const h = harness({
      // refresh models a real SquadScene redraw: removeAll(true) nulls the tile.
      refresh: () => {
        obj.input = null;
      },
    });

    h.drag.dragStart(obj);
    expect(h.dragging).toBe(true);

    phaserDropSequence(h, obj, 2);

    // The dragged tile survived `drop` (redraw deferred to dragend), so Phaser
    // emitted dragend and the guard reset got scheduled.
    h.flushDeferred();
    expect(h.dragging).toBe(false);
  });

  it("drag-off (drop outside any slot) removes the slotted char, rebuilds, clears guard", () => {
    const h = harness();
    h.drag.dragStart({ input: {}, charId: "kira", fromSlot: 3 });
    h.drag.dragEnd({ input: {}, charId: "kira", fromSlot: 3 }, false); // dropped === false
    expect(h.removed).toEqual(["kira"]);
    expect(h.log).toContain("refresh");
    h.flushDeferred();
    expect(h.dragging).toBe(false);
  });

  it("snap-back of a grid tile (not from a slot) rebuilds but removes nothing", () => {
    const h = harness();
    h.drag.dragStart({ input: {}, charId: "kira", fromSlot: null });
    h.drag.dragEnd({ input: {}, charId: "kira", fromSlot: null }, false);
    expect(h.removed).toEqual([]);
    expect(h.log).toContain("refresh");
    h.flushDeferred();
    expect(h.dragging).toBe(false);
  });
});
