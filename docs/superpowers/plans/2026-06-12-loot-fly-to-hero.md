# Loot Flies to the Hero — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On enemy death, the dropped reward (gold coins, item, elite box) visibly ejects from the kill spot and arcs into the hero with an absorb pop.

**Architecture:** A pure arc-math module (`lootFlyArc.ts`) provides a lifted quadratic bézier; a Phaser renderer (`LootFlyFx`) animates flown objects along it; `FxLayer` owns the renderer and calls it from the existing `loot` (gold) and `killReward` (item/box) fx cases. Core emits a snapshot of the hero position and the dropped item's defId in those events.

**Tech Stack:** TypeScript, Phaser 3, Vitest.

---

### Task 1: Pure arc math (`lootFlyArc.ts`)

**Files:**

- Create: `src/scenes/lootFlyArc.ts`
- Test: `tests/lootFlyArc.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/lootFlyArc.test.ts
import { describe, expect, it } from "vitest";
import { arcControl, bezierPoint } from "../src/scenes/lootFlyArc.ts";

describe("lootFlyArc", () => {
  const from = { x: 100, y: 200 };
  const to = { x: 300, y: 180 };

  it("bezier starts at `from` and ends at `to`", () => {
    const ctrl = arcControl(from, to, 40);
    expect(bezierPoint(from, ctrl, to, 0)).toEqual(from);
    const end = bezierPoint(from, ctrl, to, 1);
    expect(end.x).toBeCloseTo(to.x);
    expect(end.y).toBeCloseTo(to.y);
  });

  it("control point is the x-midpoint lifted above both endpoints (screen y grows down)", () => {
    const ctrl = arcControl(from, to, 40);
    expect(ctrl.x).toBeCloseTo(200); // (100+300)/2
    expect(ctrl.y).toBeLessThan(Math.min(from.y, to.y)); // raised up
  });

  it("the curve's midpoint sits higher than the straight-line midpoint (it arcs)", () => {
    const ctrl = arcControl(from, to, 40);
    const mid = bezierPoint(from, ctrl, to, 0.5);
    const straightMidY = (from.y + to.y) / 2;
    expect(mid.y).toBeLessThan(straightMidY);
  });

  it("guards a zero-length hop without NaN", () => {
    const ctrl = arcControl(from, from, 40);
    const p = bezierPoint(from, ctrl, from, 0.5);
    expect(Number.isFinite(p.x)).toBe(true);
    expect(Number.isFinite(p.y)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lootFlyArc.test.ts`
Expected: FAIL — `Cannot find module '../src/scenes/lootFlyArc.ts'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/scenes/lootFlyArc.ts
/**
 * Pure trajectory math for the "loot flies to the hero" effect. A flown reward
 * travels from the kill spot to the hero along a quadratic bézier whose control
 * point is the horizontal midpoint raised UP by `lift` (screen y grows down),
 * so the loot hops up and homes in rather than sliding in a straight line.
 */
import type { Vec2 } from "../data/schema.ts";

/** Control point: x-midpoint of from→to, raised above the higher of the two ends. */
export function arcControl(from: Vec2, to: Vec2, lift: number): Vec2 {
  return { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - lift };
}

/** Quadratic bézier B(t) for t in [0,1]. t=0 → from, t=1 → to. */
export function bezierPoint(from: Vec2, ctrl: Vec2, to: Vec2, t: number): Vec2 {
  const u = 1 - t;
  const a = u * u,
    b = 2 * u * t,
    c = t * t;
  return {
    x: a * from.x + b * ctrl.x + c * to.x,
    y: a * from.y + b * ctrl.y + c * to.y,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lootFlyArc.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/scenes/lootFlyArc.ts tests/lootFlyArc.test.ts
git commit -m "feat: pure lifted-bezier arc math for loot-fly effect

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: `LootFlyFx` renderer

**Files:**

- Create: `src/scenes/lootFlyFx.ts`

No new unit test — this is Phaser rendering, exercised via the pure arc test (Task 1) and the manual playtest (Task 5). Keep it under the 500-line cap (it will be ~80 lines).

- [ ] **Step 1: Write the renderer**

```ts
// src/scenes/lootFlyFx.ts
/**
 * Animates a dropped reward flying from the kill spot into the hero: it ejects
 * with a small pop, arcs along a lifted bezier (lootFlyArc), shrinks as it
 * nears the hero, then absorbs in a quick flash. Stateless between calls — each
 * flown object is cleaned up by its own tween. Used by FxLayer for gold coins
 * and item/box icons so a kill's spoils visibly fly to the hero.
 */
import Phaser from "phaser";
import type { Vec2 } from "../data/schema.ts";
import { arcControl, bezierPoint } from "./lootFlyArc.ts";
import { iconFitScale } from "./itemIcon.ts";

export interface LootFlyOpts {
  iconKey?: string; // when set + loaded, fly the real art (item__/box__)
  fallbackColor?: number; // circle colour when no icon/texture
  delay?: number; // stagger multiple coins
  iconFit?: number; // longest-edge px for an icon (default 22)
}

export class LootFlyFx {
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly fac: Phaser.GameObjects.GameObjectFactory,
    private readonly depth: number,
  ) {}

  /** Fly one reward object from `from` to the hero at `to`. */
  fly(from: Vec2, to: Vec2, kind: "coin" | "icon", opts: LootFlyOpts = {}): void {
    const obj = this.makeObject(from, kind, opts);
    const delay = opts.delay ?? 0;

    // 1) Eject: scatter to a small offset and pop slightly larger.
    const ex = from.x + Phaser.Math.Between(-14, 14);
    const ey = from.y - Phaser.Math.Between(10, 24);
    const baseScale = obj.scale;
    this.scene.tweens.add({
      targets: obj,
      x: ex,
      y: ey,
      scale: baseScale * 1.15,
      duration: 160,
      delay,
      ease: "Quad.easeOut",
      onComplete: () => this.flyToHero({ x: ex, y: ey }, to, obj, baseScale),
    });
  }

  /** Drive a {t} proxy along the bezier, scaling down toward the hero. */
  private flyToHero(
    start: Vec2,
    to: Vec2,
    obj: Phaser.GameObjects.Components.Transform & Phaser.GameObjects.GameObject,
    baseScale: number,
  ): void {
    const ctrl = arcControl(start, to, 46);
    const proxy = { t: 0 };
    this.scene.tweens.add({
      targets: proxy,
      t: 1,
      duration: 760,
      ease: "Sine.easeInOut",
      onUpdate: () => {
        const p = bezierPoint(start, ctrl, to, proxy.t);
        obj.setPosition(p.x, p.y);
        obj.setScale(baseScale * (1 - 0.5 * proxy.t));
      },
      onComplete: () => {
        this.absorb(to);
        obj.destroy();
      },
    });
  }

  /** A quick white flash where the loot meets the hero. */
  private absorb(at: Vec2): void {
    const flash = this.fac.circle(at.x, at.y, 7, 0xffffff, 0.85).setDepth(this.depth + 3);
    this.scene.tweens.add({
      targets: flash,
      scale: 1.9,
      alpha: 0,
      duration: 220,
      ease: "Quad.easeOut",
      onComplete: () => flash.destroy(),
    });
  }

  private makeObject(
    from: Vec2,
    kind: "coin" | "icon",
    opts: LootFlyOpts,
  ): Phaser.GameObjects.Components.Transform & Phaser.GameObjects.GameObject {
    if (kind === "icon" && opts.iconKey && this.scene.textures.exists(opts.iconKey)) {
      const img = this.fac.image(from.x, from.y, opts.iconKey).setDepth(this.depth + 2);
      img.setScale(iconFitScale(img.width, img.height, opts.iconFit ?? 22));
      return img;
    }
    return this.fac
      .circle(from.x, from.y, 5, opts.fallbackColor ?? 0xffd34d)
      .setStrokeStyle(1, 0xa9722a)
      .setDepth(this.depth + 2);
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors (file compiles; not yet referenced).

- [ ] **Step 3: Commit**

```bash
git add src/scenes/lootFlyFx.ts
git commit -m "feat: LootFlyFx — animate a reward ejecting and arcing into the hero

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Plumb hero target + item defId through the fx events

**Files:**

- Modify: `src/core/battleTypes.ts:50-51`
- Modify: `src/core/battleDamage.ts:294,303`

- [ ] **Step 1: Extend the event types**

In `src/core/battleTypes.ts`, replace the `loot` and `killReward` lines:

```ts
  | { type: "loot"; at: Vec2; to: Vec2; gold: number }
  | { type: "killReward"; at: Vec2; to: Vec2; xp: number; item: boolean; itemDefId: string | null; box: string | null }
```

- [ ] **Step 2: Emit the hero snapshot + item defId in `killEnemy`**

In `src/core/battleDamage.ts`, replace the `loot` emit (line ~294):

```ts
this.emit({
  type: "loot",
  at: { x: e.pos.x, y: e.pos.y },
  to: { x: this.hero.pos.x, y: this.hero.pos.y },
  gold: reward,
});
```

and the `killReward` emit (line ~303):

```ts
this.emit({
  type: "killReward",
  at: { x: e.pos.x, y: e.pos.y - 14 },
  to: { x: this.hero.pos.x, y: this.hero.pos.y },
  xp: kr.xp,
  item: kr.itemDropped !== null,
  itemDefId: kr.itemDropped?.defId ?? null,
  box: kr.boxDropped,
});
```

- [ ] **Step 3: Typecheck — expect the consumer to break**

Run: `npx tsc --noEmit`
Expected: errors in `src/scenes/fx.ts` where `coinPop`/`xpPop` are called (missing `to`/new fields are fine, but the call sites still compile — confirm only the new required `to`/`itemDefId` reads are missing). If tsc is clean, that is also acceptable (fields are additive). Proceed to Task 4 which uses them.

- [ ] **Step 4: Run the suite to confirm no logic regressed**

Run: `npx vitest run`
Expected: PASS (event shape is additive; existing tests don't assert on `to`).

- [ ] **Step 5: Commit**

```bash
git add src/core/battleTypes.ts src/core/battleDamage.ts
git commit -m "feat: emit hero target + dropped item defId on loot/killReward fx

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Wire `FxLayer` — fly gold/item/box to the hero

**Files:**

- Modify: `src/scenes/fx.ts` (constructor, `play` cases, `coinPop`)

- [ ] **Step 1: Own a `LootFlyFx` and import it**

Add the import near the other scene imports at the top of `src/scenes/fx.ts`:

```ts
import { LootFlyFx } from "./lootFlyFx.ts";
```

Add a field beside `impact`:

```ts
  /** Loot-magnet VFX: dropped rewards fly from the kill into the hero. */
  private readonly lootFly: LootFlyFx;
```

Initialise it at the end of the constructor (after `this.impact = ...`):

```ts
this.lootFly = new LootFlyFx(scene, this.fac, this.depth);
```

- [ ] **Step 2: Pass `to` into the `loot` / `killReward` cases**

In `play`, replace the `loot` and `killReward` cases:

```ts
      case "loot":
        this.coinPop(e.at, e.to, e.gold);
        break;
      case "killReward":
        this.xpPop(e.at, e.xp, e.item, e.box);
        if (e.itemDefId) this.lootFly.fly(e.at, e.to, "icon", { iconKey: `item__${e.itemDefId}`, fallbackColor: 0xffe07a });
        if (e.box) this.lootFly.fly(e.at, e.to, "icon", { iconKey: `box__${e.box}`, fallbackColor: 0xd9a441, delay: 90 });
        break;
```

- [ ] **Step 3: Retarget `coinPop` to fly coins to the hero**

Replace the whole `coinPop` method. The `+N` gold text is unchanged; the coins now arc to the hero via `LootFlyFx` instead of looping to the HUD anchor:

```ts
  private coinPop(at: Vec2, to: Vec2, gold: number): void {
    if (gold <= 0) return;
    const n = Math.min(4, 1 + Math.floor(gold / 12));
    for (let i = 0; i < n; i++) {
      this.lootFly.fly(at, to, "coin", { fallbackColor: 0xffd34d, delay: i * 45 });
    }
    const txt = this.fac.text(at.x, at.y - 6, `+${gold}`, {
      fontSize: "11px", color: "#ffd86a", fontStyle: "bold", stroke: "#10131c", strokeThickness: 3,
    }).setOrigin(0.5).setDepth(this.depth + 2);
    this.scene.tweens.add({ targets: txt, y: at.y - 26, alpha: 0, duration: 560, ease: "Quad.easeOut", onComplete: () => txt.destroy() });
  }
```

Note: the `goldAnchor` field is now unused by `coinPop`. Leave the field/constructor param in place (other call sites construct `FxLayer` with it) but it no longer drives coins. If `tsc` flags `goldAnchor` as unused under `noUnusedLocals`, prefix with `_` or remove the field and the constructor param + its callers — check `grep -rn "goldAnchor" src/` first and follow whatever keeps tsc clean.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Run the suite**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/scenes/fx.ts
git commit -m "feat: dropped gold/item/box loot now flies into the hero on a kill

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Verify whole + playtest

**Files:** none (verification only).

- [ ] **Step 1: Full typecheck + suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc clean; all tests pass (incl. `lootFlyArc.test.ts`).

- [ ] **Step 2: CDP playtest — capture a kill mid-flight**

Use the playtest harness (`scripts/playtest/snap.sh` / `playtest.mjs`) to launch a battle, let towers kill enemies, and capture a screenshot during the loot flight. For an elite/box drop, force an elite kill if a debug hook exists; otherwise confirm gold + item flight visually. Save to `/tmp/loot_fly.png`.

Expected: coins/icon visibly arcing from the kill point toward the hero sprite, with the absorb flash near the hero.

- [ ] **Step 3: Final commit (only if the playtest required tweaks)**

```bash
git add -A
git commit -m "chore: loot-fly playtest tuning

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

- **Spec coverage:** arc math (Task 1) ✓; renderer with eject/fly/absorb (Task 2) ✓; hero snapshot + item defId plumbing (Task 3) ✓; gold→hero + item/box icons flying (Task 4) ✓; tests + playtest (Tasks 1,5) ✓. Diamonds/non-box materials: spec declares no per-kill source → intentionally no task. XP stays text → no task. ✓
- **Placeholders:** none — every code step shows full code.
- **Type consistency:** `arcControl`/`bezierPoint` signatures match across Tasks 1–2; `LootFlyFx.fly(from, to, kind, opts)` matches its call sites in Task 4; event fields `to`/`itemDefId` added in Task 3 are exactly the ones read in Task 4; `iconFitScale` reused from existing `itemIcon.ts`.
