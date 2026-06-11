# Throne-Room Home Screen Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `MainMenuScene` into a throne-room diorama — bare hero on a king's chair, equipped gear on wall hangers, selected squad on the stage (or a "Set Squad" button when empty), and the equipped pet flying above.

**Architecture:** All layout math + decisions move into a new Phaser-free pure module `src/scenes/homeRoom.ts` (unit-tested with Vitest). `MainMenuScene` becomes a thin presenter that consumes it and draws procedural throne/dais/hanger graphics. `dressHero` is no longer called here.

**Tech Stack:** TypeScript, Phaser 3, Vitest. No new art (throne/hangers procedural).

---

## File Structure

- **Create** `src/scenes/homeRoom.ts` — pure layout/decision functions (no Phaser import).
- **Create** `tests/homeRoom.test.ts` — Vitest coverage of the pure module.
- **Modify** `src/scenes/MainMenuScene.ts` — consume `homeRoom`, draw throne/hangers/squad/pet, drop `dressHero`.

---

## Task 1: Pure `homeRoom` module (TDD)

**Files:**
- Create: `src/scenes/homeRoom.ts`
- Test: `tests/homeRoom.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/homeRoom.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  HANGER_SLOTS, hangerLayout, equippedHangers,
  squadStand, squadStandPoints, petWander,
} from "../src/scenes/homeRoom.ts";
import { createFreshSave, type HeroSave } from "../src/core/save.ts";
import { ITEM_CATALOG } from "../src/data/items.ts";

const W = 960, H = 540;

function equip(save: HeroSave, slot: string, defId: string, instId: string): void {
  save.inventory.items.push({ id: instId, defId } as never);
  (save.inventory.equipped as Record<string, string>)[slot] = instId;
}

describe("homeRoom hangers", () => {
  it("exposes the 9 non-pet slots, pet excluded", () => {
    expect(HANGER_SLOTS).toHaveLength(9);
    expect(HANGER_SLOTS).not.toContain("Pet");
    expect(HANGER_SLOTS).toContain("Weapon");
    expect(HANGER_SLOTS).toContain("Wing");
  });

  it("lays out one cell per slot, split across two side walls inside the menu columns", () => {
    const cells = hangerLayout(W, H);
    expect(cells).toHaveLength(HANGER_SLOTS.length);
    const xs = new Set(cells.map((c) => c.x));
    expect(xs.size).toBe(2); // exactly two wall columns
    for (const c of cells) {
      expect(c.x).toBeGreaterThan(60);   // clear of the left edge buttons (x≈46)
      expect(c.x).toBeLessThan(W - 60);  // clear of the right edge buttons (x≈914)
      expect(c.y).toBeGreaterThan(0);
      expect(c.y).toBeLessThan(H);
    }
  });

  it("pairs equipped items to hangers and leaves empty pegs as null", () => {
    const save = createFreshSave();
    const some = ITEM_CATALOG.find((d) => d.slot === "Weapon")!;
    equip(save, "Weapon", some.id, "inst-w");
    const hangers = equippedHangers(save.inventory);
    expect(hangers).toHaveLength(HANGER_SLOTS.length);
    const w = hangers[HANGER_SLOTS.indexOf("Weapon")];
    expect(w).not.toBeNull();
    expect(w!.iconKey).toBe(`item__${some.id}`);
    // an unequipped slot is a null (empty peg)
    expect(hangers[HANGER_SLOTS.indexOf("Boots")]).toBeNull();
  });
});

describe("homeRoom squad", () => {
  it("uses save.squad with NO owned fallback and flags Set Squad when empty", () => {
    const save = createFreshSave();
    save.squad = [];
    save.collection = { "some-tower": { level: 1 } } as never; // owned but not in squad
    const empty = squadStand(save);
    expect(empty.members).toEqual([]);
    expect(empty.showSetSquad).toBe(true);

    save.squad = ["a", "b", "c"];
    const filled = squadStand(save);
    expect(filled.members).toEqual(["a", "b", "c"]);
    expect(filled.showSetSquad).toBe(false);
  });

  it("places n stand points on the stage within screen bounds", () => {
    for (const n of [1, 4, 7]) {
      const pts = squadStandPoints(n, W, H);
      expect(pts).toHaveLength(n);
      for (const p of pts) {
        expect(p.x).toBeGreaterThan(0);
        expect(p.x).toBeLessThan(W);
        expect(p.y).toBeGreaterThan(H * 0.6); // on the lower stage
        expect(p.y).toBeLessThan(H);
      }
    }
  });
});

describe("homeRoom pet wander", () => {
  it("stays inside the box above the throne for a full period and flips facing", () => {
    let sawLeft = false, sawRight = false;
    for (let ms = 0; ms <= 20000; ms += 50) {
      const p = petWander(ms, W, H);
      expect(p.x).toBeGreaterThanOrEqual(W * 0.40 - 0.001);
      expect(p.x).toBeLessThanOrEqual(W * 0.60 + 0.001);
      expect(p.y).toBeGreaterThanOrEqual(H * 0.18 - 0.001);
      expect(p.y).toBeLessThanOrEqual(H * 0.34 + 0.001);
      if (p.faceLeft) sawLeft = true; else sawRight = true;
    }
    expect(sawLeft && sawRight).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/homeRoom.test.ts`
Expected: FAIL — cannot resolve `../src/scenes/homeRoom.ts`.

- [ ] **Step 3: Write minimal implementation**

Create `src/scenes/homeRoom.ts`:

```ts
/**
 * homeRoom — pure layout + decision math for the throne-room home screen.
 * Phaser-free so it can be unit-tested. MainMenuScene is the presenter that
 * turns these into sprites/graphics.
 */
import type { HeroSave, InventorySave } from "../core/save.ts";
import type { ItemSlot } from "../data/schema.ts";
import { ITEM_CATALOG_MAP } from "../data/items.ts";

/** The 9 equipped slots shown on wall hangers (Pet is excluded — it flies). */
export const HANGER_SLOTS: ItemSlot[] = [
  "Weapon", "Helmet", "BodyArmor", "Gloves", "Boots",
  "Amulet", "Ring1", "Ring2", "Wing",
];
const LEFT_COUNT = 5; // 5 hangers on the left wall, the rest on the right wall

export interface HangerCell { slot: ItemSlot; x: number; y: number; }

/** Peg positions: two vertical wall columns just inside the edge menu buttons. */
export function hangerLayout(W: number, H: number): HangerCell[] {
  const leftX = W * 0.13, rightX = W * 0.87;
  const top = H * 0.20, bot = H * 0.64;
  return HANGER_SLOTS.map((slot, i) => {
    const onLeft = i < LEFT_COUNT;
    const col = onLeft ? leftX : rightX;
    const idx = onLeft ? i : i - LEFT_COUNT;
    const count = onLeft ? LEFT_COUNT : HANGER_SLOTS.length - LEFT_COUNT;
    const t = count > 1 ? idx / (count - 1) : 0.5;
    return { slot, x: col, y: top + t * (bot - top) };
  });
}

export interface HangerItem { slot: ItemSlot; defId: string; iconKey: string; }

/** Per HANGER_SLOTS index: the equipped item to hang, or null (empty peg). */
export function equippedHangers(inv: InventorySave): (HangerItem | null)[] {
  return HANGER_SLOTS.map((slot) => {
    const instId = inv.equipped[slot];
    if (!instId) return null;
    const inst = inv.items.find((it) => it.id === instId);
    const def = inst ? ITEM_CATALOG_MAP.get(inst.defId) : undefined;
    if (!def) return null;
    const iconKey = slot === "Wing" && def.appearanceRef ? def.appearanceRef : `item__${def.id}`;
    return { slot, defId: def.id, iconKey };
  });
}

export interface SquadStand { members: string[]; showSetSquad: boolean; }

/** The selected squad to stand on the stage. No owned-tower fallback. */
export function squadStand(save: HeroSave): SquadStand {
  const members = (save.squad ?? []).slice(0, 7);
  return { members, showSetSquad: members.length === 0 };
}

export interface StandPoint { x: number; y: number; }

/** Up to n arced standing positions on the lower stage. */
export function squadStandPoints(n: number, W: number, H: number): StandPoint[] {
  const out: StandPoint[] = [];
  for (let i = 0; i < n; i++) {
    const tt = n > 1 ? i / (n - 1) : 0.5;
    out.push({ x: W * 0.16 + tt * W * 0.68, y: H * 0.74 + Math.sin(tt * Math.PI) * -10 });
  }
  return out;
}

/** Bounded lissajous wander for the pet, in a box above the throne. */
export function petWander(elapsedMs: number, W: number, H: number): {
  x: number; y: number; faceLeft: boolean;
} {
  const t = elapsedMs / 1000;
  const cx = W * 0.50, cy = H * 0.26;
  const ax = W * 0.10, ay = H * 0.08;
  const x = cx + Math.sin(t * 0.6) * ax;
  const y = cy + Math.sin(t * 0.9 + 1.3) * ay;
  return { x, y, faceLeft: Math.cos(t * 0.6) < 0 };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/homeRoom.test.ts`
Expected: PASS (all groups). If `makeNewSave`/`ITEM_CATALOG` import names differ, check `src/core/save.ts` and `src/data/items.ts` exports and adjust the test imports — do not change the module to match a wrong test.

- [ ] **Step 5: Commit**

```bash
git add src/scenes/homeRoom.ts tests/homeRoom.test.ts
git commit -m "feat: pure homeRoom layout module (hangers/squad/pet, TDD)"
```

---

## Task 2: Wire `MainMenuScene` to the throne room

**Files:**
- Modify: `src/scenes/MainMenuScene.ts`

> Read the current file first. Replace the `dressHero` import with `homeRoom`
> imports and `fadeToScene` is already imported. Keep `drawBackdrop`,
> `drawHeader`, `drawMenu`, `drawMenuGlyph`, `star4`, `P` unchanged.

- [ ] **Step 1: Swap imports**

Remove:
```ts
import { dressHero } from "./dressHero.ts";
```
Add:
```ts
import { hangerLayout, equippedHangers, squadStand, squadStandPoints, petWander } from "./homeRoom.ts";
import { ITEM_CATALOG_MAP } from "../data/items.ts";
```

- [ ] **Step 2: Add re-entry-safe fields + pet update state**

Inside the class, replace the `private badges` field block with:
```ts
  private badges: Record<string, number> = {};
  private pet?: Phaser.GameObjects.Image; // re-init in create()
  private elapsed = 0;
```
At the top of `create()`, after `const mgr ...` reset the per-entry state (scene reuse rule):
```ts
    this.pet = undefined;
    this.elapsed = 0;
```

- [ ] **Step 3: Replace `drawHeroAndSquad` with throne + bare hero + hangers + squad + pet**

Replace the whole `drawHeroAndSquad(...)` method body with calls, and in `create()`
change the call site from `this.drawHeroAndSquad(save, W, H);` to:
```ts
    this.drawThrone(W, H);
    this.drawHero(W, H);
    this.drawHangers(save, W, H);
    this.drawSquad(save, W, H);
    this.drawPet(save, W, H);
```

Add these methods (delete the old `drawHeroAndSquad`):

```ts
  // ── procedural king's chair + dais ("the stage") ─────────────────────────────
  private drawThrone(W: number, H: number): void {
    const cx = W / 2, seatY = H * 0.50;
    const g = this.add.graphics().setDepth(1);
    // dais slab (the stage the squad stands on)
    g.fillStyle(0x2a2030, 1).fillRoundedRect(cx - 150, H * 0.70, 300, 30, 8);
    g.fillStyle(0x3a2c44, 1).fillRoundedRect(cx - 130, H * 0.685, 260, 16, 6);
    // chair back
    g.fillStyle(0x6a4a1c, 1).fillRoundedRect(cx - 46, seatY - 132, 92, 150, 10);
    g.fillStyle(0x8a6526, 1).fillRoundedRect(cx - 38, seatY - 124, 76, 134, 8);
    g.fillStyle(0x7a1f2a, 1).fillRoundedRect(cx - 30, seatY - 116, 60, 118, 6); // cushion
    // crown finials
    g.fillStyle(0xe8c44c, 1);
    for (const ox of [-46, 0, 46]) g.fillTriangle(cx + ox - 9, seatY - 132, cx + ox + 9, seatY - 132, cx + ox, seatY - 156);
    // seat + arms
    g.fillStyle(0x8a6526, 1).fillRoundedRect(cx - 52, seatY - 8, 104, 22, 6);
    g.fillStyle(0x6a4a1c, 1).fillRoundedRect(cx - 56, seatY - 30, 12, 44, 4).fillRoundedRect(cx + 44, seatY - 30, 12, 44, 4);
  }

  private drawHero(W: number, H: number): void {
    if (!this.textures.exists("hero__hero")) return;
    const HERO_H = 104, cy = H * 0.50;
    const hero = this.add.sprite(W / 2, cy, "hero__hero").setOrigin(0.5, 0.85).setDepth(2);
    hero.setScale(HERO_H / hero.height);
    if (this.anims.exists("hero__hero_idle")) hero.play("hero__hero_idle");
    // NOTE: bare hero — no dressHero. Equipped gear is shown on the wall hangers.
  }

  // ── equipped gear hanging on the two side walls ─────────────────────────────
  private drawHangers(save: ReturnType<SaveManager["getSave"]>, W: number, H: number): void {
    const cells = hangerLayout(W, H);
    const items = equippedHangers(save.inventory);
    cells.forEach((cell, i) => {
      // peg + rope
      const g = this.add.graphics().setDepth(3);
      g.fillStyle(0x4a3a2a, 1).fillRoundedRect(cell.x - 16, cell.y - 6, 32, 6, 3); // wall bar
      g.fillStyle(0x6a5238, 1).fillCircle(cell.x, cell.y - 3, 3);                    // hook
      const it = items[i];
      if (!it || !this.textures.exists(it.iconKey)) return; // empty peg
      g.lineStyle(2, 0x9a8a6a, 1).lineBetween(cell.x, cell.y, cell.x, cell.y + 14);  // rope
      const img = this.add.image(cell.x, cell.y + 14, it.iconKey).setOrigin(0.5, 0).setDepth(4);
      img.setScale(Math.min(34 / img.width, 34 / img.height));
      // gentle sway
      this.tweens.add({ targets: img, angle: { from: -4, to: 4 }, duration: 1600 + i * 90, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    });
  }

  // ── selected squad on the stage, or a Set Squad call-to-action ───────────────
  private drawSquad(save: ReturnType<SaveManager["getSave"]>, W: number, H: number): void {
    const stand = squadStand(save);
    if (stand.showSetSquad) {
      const c = this.add.container(W / 2, H * 0.74).setDepth(6);
      const g = this.add.graphics();
      g.fillStyle(0x1c2740, 0.95).fillRoundedRect(-92, -22, 184, 44, 10);
      g.lineStyle(2, 0x4f7bd6, 1).strokeRoundedRect(-92, -22, 184, 44, 10);
      c.add(g);
      c.add(crispText(this, 0, 0, "⚔ Set Squad", { fontSize: "16px", color: "#cfe0ff", fontStyle: "bold" }).setOrigin(0.5));
      const z = this.add.zone(0, 0, 184, 44).setInteractive({ useHandCursor: true });
      c.add(z);
      z.on("pointerover", () => this.tweens.add({ targets: c, scale: 1.08, duration: 120 }));
      z.on("pointerout", () => this.tweens.add({ targets: c, scale: 1, duration: 120 }));
      z.on("pointerdown", () => this.tweens.add({ targets: c, scale: 0.92, duration: 70, yoyo: true, onComplete: () => fadeToScene(this, "SquadScene") }));
      return;
    }
    const pts = squadStandPoints(stand.members.length, W, H);
    stand.members.forEach((id, i) => {
      const key = `tower__${id}`;
      if (!this.textures.exists(key)) return;
      const p = pts[i];
      const s = this.add.sprite(p.x, p.y, key).setOrigin(0.5, 0.85).setDepth(5);
      s.setScale(54 / s.height);
      if (this.anims.exists(`${key}_idle`)) s.play(`${key}_idle`);
    });
  }

  // ── equipped pet flying above the throne ─────────────────────────────────────
  private drawPet(save: ReturnType<SaveManager["getSave"]>, W: number, H: number): void {
    const instId = save.inventory.equipped["Pet"];
    if (!instId) return;
    const inst = save.inventory.items.find((it) => it.id === instId);
    const def = inst ? ITEM_CATALOG_MAP.get(inst.defId) : undefined;
    const key = def ? `item__${def.id}` : "";
    if (!def || !this.textures.exists(key)) return;
    const p = petWander(0, W, H);
    this.pet = this.add.image(p.x, p.y, key).setOrigin(0.5).setDepth(7);
    this.pet.setScale(Math.min(40 / this.pet.width, 40 / this.pet.height));
  }

  update(_t: number, dtMs: number): void {
    if (!this.pet) return;
    this.elapsed += dtMs;
    const W = this.scale.width, H = this.scale.height;
    const p = petWander(this.elapsed, W, H);
    this.pet.setPosition(p.x, p.y);
    this.pet.setFlipX(p.faceLeft);
  }
```

- [ ] **Step 4: Typecheck + full suite + build**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: tsc clean, all tests PASS, build succeeds. Fix any type errors (e.g. the
`save` parameter type uses `ReturnType<SaveManager["getSave"]>` consistent with the
existing `drawHeader`).

- [ ] **Step 5: Commit**

```bash
git add src/scenes/MainMenuScene.ts
git commit -m "feat: throne-room home screen (bare hero, gear hangers, squad on stage, flying pet)"
```

---

## Task 3: CDP playtest + polish

**Files:** none unless polish needed.

- [ ] **Step 1: Playtest via CDP** — start dev server + headless Chrome, open the
  game, navigate to MainMenuScene. Via `window.__game`: confirm (a) hangers show
  equipped icons + empty pegs, (b) squad stands on the stage when `save.squad` is
  set, (c) pet image position changes across two `requestAnimationFrame` samples and
  stays in-box, (d) clearing `save.squad` then re-entering shows the **Set Squad**
  button and tapping routes to `SquadScene`, (e) 0 console errors. Verify layout by
  measured object `x/y`, NOT the headless screenshot (`crispText` blows up without
  system fonts).

- [ ] **Step 2: Commit any polish** (spacing/scale tweaks only) with a `polish:` message.

---

## Self-Review

- **Spec coverage:** bare hero (Task 2 drawHero, no dressHero ✓), king chair (drawThrone ✓), gear on hangers (homeRoom hangerLayout/equippedHangers + drawHangers, Pet excluded ✓), squad on stage (squadStand/squadStandPoints + drawSquad ✓), Set Squad button when empty (showSetSquad ✓), pet flying above (petWander + drawPet/update ✓), scene-reentry reset (Task 2 step 2 ✓), <500-line guard (scene ~+150 lines over 229 → ~380, under cap ✓).
- **Placeholder scan:** none — all steps carry full code.
- **Type consistency:** `HANGER_SLOTS`, `hangerLayout`, `equippedHangers`, `squadStand`, `squadStandPoints`, `petWander` names identical across module, tests, and scene. `iconKey`/`faceLeft`/`showSetSquad`/`members` property names consistent.
```
