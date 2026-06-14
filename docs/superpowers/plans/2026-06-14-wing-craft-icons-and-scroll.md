# Craft Wings — loaded icons + scroll fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show real icons for gear and materials loaded into the Craft Wings machine, and stop tray-scroll handlers from stacking across dialog reopens.

**Architecture:** Three localized changes — (1) `attachDragScroll` gains a `destroy()` that removes its scene listeners; (2) `wingCraftTray.destroy()` calls it; (3) `wingCraftDialog` draws real item/material icons in the machine. Pure math modules are untouched.

**Tech Stack:** Phaser 3, TypeScript, Vitest.

---

### Task 1: `attachDragScroll` teardown (TDD)

**Files:**
- Modify: `src/scenes/scrollDrag.ts`
- Test: `tests/scrollDrag.test.ts`

- [ ] **Step 1: Write the failing test** — append to `tests/scrollDrag.test.ts`:

```ts
import { attachDragScroll } from "../src/scenes/scrollDrag.ts";

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
    expect(offset).toBe(1); // dragged up one row

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
```

- [ ] **Step 2: Run it — expect FAIL** (`handle.destroy is not a function`):

Run: `npx vitest run tests/scrollDrag.test.ts`

- [ ] **Step 3: Implement** — in `src/scenes/scrollDrag.ts`:
  - Add `destroy: () => void;` to `DragScrollHandle`.
  - Name the pointer handlers and register/unregister them:

```ts
  const onPointerDown = (p: Phaser.Input.Pointer) => { /* existing body */ };
  const onPointerMove = (p: Phaser.Input.Pointer) => { /* existing body */ };
  const onPointerCancel = () => { tracking = false; samples = []; stopFling(); };

  scene.input.on("pointerdown", onPointerDown);
  scene.input.on("pointermove", onPointerMove);
  scene.input.on("pointerup", endGesture);
  scene.input.on("pointercancel", onPointerCancel);
  scene.events.once("shutdown", stopFling);
  scene.events.once("destroy", stopFling);

  const destroy = (): void => {
    stopFling();
    scene.input.off("pointerdown", onPointerDown);
    scene.input.off("pointermove", onPointerMove);
    scene.input.off("pointerup", endGesture);
    scene.input.off("pointercancel", onPointerCancel);
    scene.events.off("shutdown", stopFling);
    scene.events.off("destroy", stopFling);
  };

  return { didScroll: () => scrolled, destroy };
```

- [ ] **Step 4: Run — expect PASS.** Run: `npx vitest run tests/scrollDrag.test.ts`

- [ ] **Step 5: Commit** `feat(forge): attachDragScroll teardown to stop handler stacking`

---

### Task 2: tray calls `scroll.destroy()`

**Files:** Modify `src/scenes/wingCraftTray.ts`

- [ ] In `destroy`, tear down the scroll first:

```ts
    destroy: () => {
      scroll.destroy();
      chipLayer.destroy();
      gridLayer.destroy();
    },
```

- [ ] Build check: `npm run build`. Commit `fix(forge): tear down wing-tray scroll on dialog close`.

---

### Task 3: loaded gear + material icons

**Files:** Modify `src/scenes/wingCraftDialog.ts`

- [ ] Add imports: `itemTex` (already importing `materialTex` from assetKeys — add `itemTex`), and `makeFitIcon` from `./itemIcon.ts`.

- [ ] Replace the one-time material-icon block with persistent, state-driven icons created **before** the count texts (so the count badge stays on top); store `jewelIcon`/`featherIcon` refs.

- [ ] In `renderSockets()`, set `jewelIcon?.setAlpha(jewels > 0 ? 1 : 0.4)` / `featherIcon?.setAlpha(feather ? 1 : 0.4)`, and drop the redundant `◈`/`✦` from the count text when the icon exists (keep the glyph as fallback).

- [ ] Rewrite `renderLoaded()` to draw a rarity backing + ring + `makeFitIcon(scene, p.x, p.y, itemTex(it.defId), 24, letter)` instead of the letter chip; keep the tap-to-unload zone.

- [ ] Verify + CDP screenshot, commit `feat(forge): real icons for loaded gear + materials in Craft Wings`.

---

### Task 4: Verify whole

- [ ] `tsc --noEmit && vite build` clean; `npx vitest run` all green; `npm run lint` + `npm run lint:cycles` clean.
- [ ] CDP: open Forge → Craft Wings, Auto-fill, screenshot — loaded gear + sockets show icons; reopen dialog ×3 and confirm drag-scroll still tracks 1:1.
