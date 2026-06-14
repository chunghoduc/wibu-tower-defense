/**
 * Pure drag-lifecycle controller for the inventory paper-doll.
 *
 * THE BUG THIS PREVENTS: Phaser's `InputPlugin.processDragUpEvent` emits `drop`
 * and then `dragend` for the same object in a single pass, but it guards the
 * `dragend` emit behind `gameObject.input && gameObject.input.enabled`
 * (InputPlugin.js ~L1506). Destroying the dragged object inside the `drop`
 * handler — which a full inventory rebuild (`tiles.removeAll(true)`) does to the
 * tile under the pointer — nulls its `input`, so Phaser SILENTLY SKIPS `dragend`.
 * Any state reset only in `dragend` then stays stuck. The old code reset the
 * `didDrag` tap-guard in `dragend` but rebuilt the view in `drop`, so after a
 * successful equip-drop the guard stayed `true` forever and every later bag-item
 * tap was swallowed.
 *
 * THE FIX, encoded as this module's contract: `drop` performs the data mutation
 * ONLY. The view rebuild (which destroys the dragged tile) and the guard reset
 * live in `dragend`, which always fires because nothing destroyed the object
 * during `drop`. This mirrors the snap-back path, which always worked.
 *
 * Pure / Phaser-free: side effects are injected, so the lifecycle is unit-tested
 * against a faithful model of Phaser's drag-up ordering.
 */

export interface DragLifecycleDeps<Obj, Zone> {
  /** Raise the dragged tile and hide any tooltip at gesture start. */
  lift(obj: Obj): void;
  /** Follow the pointer during the drag. */
  move(obj: Obj, x: number, y: number): void;
  /**
   * Apply the equip/unequip mutation for a drop on `zone`.
   * MUST NOT rebuild the view — doing so destroys the dragged tile mid-gesture
   * and makes Phaser skip the trailing `dragend` (see file header).
   */
  applyDrop(obj: Obj, zone: Zone): void;
  /** Rebuild the inventory view (destroys + recreates tiles). */
  refresh(): void;
  /** Toggle the "a drag happened" tap-guard (`didDrag`). */
  setDragging(active: boolean): void;
  /** Run `fn` on the next tick (Phaser `time.delayedCall(0, fn)`). */
  defer(fn: () => void): void;
}

export interface DragLifecycle<Obj, Zone> {
  dragStart(obj: Obj): void;
  drag(obj: Obj, x: number, y: number): void;
  drop(obj: Obj, zone: Zone): void;
  dragEnd(obj: Obj, dropped: boolean): void;
}

export function createDragLifecycle<Obj, Zone>(
  deps: DragLifecycleDeps<Obj, Zone>,
): DragLifecycle<Obj, Zone> {
  return {
    dragStart(obj) {
      deps.lift(obj);
      deps.setDragging(true);
    },
    drag(obj, x, y) {
      deps.move(obj, x, y);
    },
    drop(obj, zone) {
      // Mutation ONLY. Rebuilding here would destroy `obj` mid-drag and make
      // Phaser skip the dragend emit (see file header) → tap-guard stuck true.
      deps.applyDrop(obj, zone);
    },
    dragEnd(_obj, _dropped) {
      // Always rebuild here — successful equip-drop and snap-back alike — then
      // clear the tap-guard one tick later so the drag's trailing pointerup is
      // not registered as a tap on the tile under the cursor.
      deps.refresh();
      deps.defer(() => deps.setDragging(false));
    },
  };
}
