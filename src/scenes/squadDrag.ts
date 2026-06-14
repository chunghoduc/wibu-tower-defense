/**
 * Pure drag-lifecycle controller for SquadScene's slots + character grid.
 *
 * THE BUG THIS PREVENTS (identical to the inventory paper-doll, see
 * `inventoryDragLifecycle.ts`): Phaser's `processDragUpEvent` emits `drop` then
 * `dragend` for the same object, but guards the `dragend` emit behind
 * `gameObject.input && gameObject.input.enabled`. SquadScene's `drop` handler
 * used to call `assignToSlot` → `select` → `redraw`, and the redraw's
 * `removeAll(true)` DESTROYS the dragged tile under the pointer, nulling its
 * `input`, so Phaser SILENTLY SKIPS `dragend`. The `didDrag` tap-guard is reset
 * only in `dragend`, so after a successful drag-to-slot it stayed `true` forever
 * and every later character/slot tap was swallowed ("can't pick another tower").
 *
 * THE FIX: `drop` performs the data mutation ONLY (assign the slot). The view
 * rebuild (which destroys the dragged tile) and the guard reset live in
 * `dragend`, which always fires because nothing destroyed the object during
 * `drop`. The off-slot "drag a slotted char out to remove it" mutation also runs
 * in `dragend` (before the rebuild). Composes the unit-tested
 * `createDragLifecycle` so the subtle drag-up ordering is not re-derived.
 */
import { createDragLifecycle } from "./inventoryDragLifecycle.ts";

export interface SquadDragDeps<Obj, Zone> {
  /** Raise the dragged tile at gesture start. */
  lift(obj: Obj): void;
  /** Follow the pointer during the drag. */
  move(obj: Obj, x: number, y: number): void;
  /** The dragged tile's character id (null if absent). */
  charId(obj: Obj): string | null;
  /** The slot index a drop zone represents (null if absent). */
  slotOf(zone: Zone): number | null;
  /** The slot index a slotted tile was dragged FROM (null for grid tiles). */
  fromSlot(obj: Obj): number | null;
  /**
   * Assign `id` to `slot` (data mutation only). MUST NOT rebuild the view —
   * doing so destroys the dragged tile mid-gesture and makes Phaser skip the
   * trailing `dragend` (see file header).
   */
  assign(id: string, slot: number): void;
  /** Remove `id` from the squad (data mutation only). */
  removeFromSquad(id: string): void;
  /** Rebuild the squad view (destroys + recreates tiles). */
  refresh(): void;
  /** Toggle the "a drag happened" tap-guard (`didDrag`). */
  setDragging(active: boolean): void;
  /** Run `fn` on the next tick (Phaser `time.delayedCall(0, fn)`). */
  defer(fn: () => void): void;
}

export interface SquadDrag<Obj, Zone> {
  dragStart(obj: Obj): void;
  drag(obj: Obj, x: number, y: number): void;
  drop(obj: Obj, zone: Zone): void;
  dragEnd(obj: Obj, dropped: boolean): void;
}

export function createSquadDrag<Obj, Zone>(
  deps: SquadDragDeps<Obj, Zone>,
): SquadDrag<Obj, Zone> {
  const base = createDragLifecycle<Obj, Zone>({
    lift: deps.lift,
    move: deps.move,
    applyDrop: (obj, zone) => {
      const id = deps.charId(obj);
      const slot = deps.slotOf(zone);
      if (id != null && slot != null) deps.assign(id, slot);
    },
    refresh: deps.refresh,
    setDragging: deps.setDragging,
    defer: deps.defer,
  });
  return {
    dragStart: base.dragStart,
    drag: base.drag,
    drop: base.drop,
    dragEnd(obj, dropped) {
      // A slotted character dropped off all slot zones leaves the squad. Mutate
      // BEFORE the rebuild that base.dragEnd performs.
      if (!dropped && deps.fromSlot(obj) != null) {
        const id = deps.charId(obj);
        if (id != null) deps.removeFromSquad(id);
      }
      base.dragEnd(obj, dropped);
    },
  };
}
