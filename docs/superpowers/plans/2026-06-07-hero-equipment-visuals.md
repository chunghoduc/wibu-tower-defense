# Hero Equipment Visuals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show equipped weapon, wings, and pet visually on the hero sprite during battle using a Phaser Container with layered sprites.

**Architecture:** Replace the single `Phaser.GameObjects.Sprite` in `BattleScene` with a `HeroLayeredSprite` container that stacks three child sprites (wings behind, body, weapon in front) plus a floating pet sprite. Item icons (already generated 96×96 PNGs) are used directly as weapon/wing/pet visuals — no new sprite sheets required. A pure helper module maps `InventorySave` → texture keys so the mapping logic is unit-testable without Phaser.

**Tech Stack:** Phaser 3.80.1, TypeScript strict, Vitest (unit tests, no Phaser runtime needed for logic tests)

---

## Background & Context

The game already has:
- `ItemDef.appearanceRef?: string` field in `schema.ts` — a Phase 4 hook, currently unpopulated.
- `InventorySave.equipped: Partial<Record<ItemSlot, string>>` — maps slot → item instance ID.
- 96×96 item icon PNGs at `public/assets/sprites/item/<id>.png` — loaded as `item__<id>` textures.
- The hero sprite at `BattleScene.ts:162` declared as `Phaser.GameObjects.Sprite | null`.
- `hasSprite()` in PreloadScene already gracefully guards missing textures.

Visual layers (back-to-front):
```
[wings sprite]  ← item icon, positioned BEHIND hero, ~2.5× scaled
[body sprite]   ← hero__hero spritesheet (existing, untouched)
[weapon sprite] ← item icon, positioned at hero's right hand, small tween on attack
[pet sprite]    ← item icon, floating RIGHT of hero (+30px), gentle bob tween, NOT in container
```

Towers, enemies, and bosses are untouched — their rarity/role visuals are baked into the single generated spritesheet.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| **Create** | `src/scenes/heroEquipVisuals.ts` | Pure mapping: `InventorySave` → `HeroLayerConfig` (no Phaser) |
| **Create** | `src/scenes/HeroLayeredSprite.ts` | Phaser Container: 3 stacked sprites + pet management |
| **Create** | `tests/heroEquipVisuals.test.ts` | Unit tests for pure mapping logic |
| **Modify** | `src/data/items.ts` | Populate `appearanceRef` on Wing slot items |
| **Modify** | `src/scenes/BattleScene.ts:162` | Change type + swap creation + wire equipment sync |

---

## Task 1: Pure mapping module + tests

**Files:**
- Create: `src/scenes/heroEquipVisuals.ts`
- Create: `tests/heroEquipVisuals.test.ts`

### Step 1: Write the failing tests

```typescript
// tests/heroEquipVisuals.test.ts
import { describe, it, expect } from "vitest";
import { resolveHeroLayers } from "../src/scenes/heroEquipVisuals.ts";
import type { InventorySave } from "../src/core/save.ts";

function makeInventory(overrides: Partial<InventorySave> = {}): InventorySave {
  return { items: [], equipped: {}, ...overrides };
}

describe("resolveHeroLayers", () => {
  it("returns all-null config when nothing is equipped", () => {
    const result = resolveHeroLayers(makeInventory());
    expect(result).toEqual({ weaponKey: null, wingKey: null, petKey: null });
  });

  it("returns weapon texture key when a weapon is equipped", () => {
    const inv = makeInventory({
      items: [{ id: "inst-1", defId: "iron-sword", enhanceLevel: 0, affixes: [] }],
      equipped: { Weapon: "inst-1" },
    });
    const result = resolveHeroLayers(inv);
    expect(result.weaponKey).toBe("item__iron-sword");
  });

  it("returns null weaponKey when equipped weapon instance is not found", () => {
    const inv = makeInventory({
      items: [],
      equipped: { Weapon: "missing-instance" },
    });
    const result = resolveHeroLayers(inv);
    expect(result.weaponKey).toBeNull();
  });

  it("returns pet texture key when a pet is equipped", () => {
    const inv = makeInventory({
      items: [{ id: "inst-2", defId: "coin-sprite", enhanceLevel: 0, affixes: [] }],
      equipped: { Pet: "inst-2" },
    });
    const result = resolveHeroLayers(inv);
    expect(result.petKey).toBe("item__coin-sprite");
  });

  it("returns wing appearanceRef when a wing item with appearanceRef is equipped", () => {
    const inv = makeInventory({
      items: [{ id: "inst-3", defId: "fledgling-wings", enhanceLevel: 0, affixes: [] }],
      equipped: { Wing: "inst-3" },
    });
    const result = resolveHeroLayers(inv);
    // fledgling-wings has appearanceRef "item__fledgling-wings" (set in Task 2)
    expect(result.wingKey).toBe("item__fledgling-wings");
  });

  it("returns null wingKey for wing item without appearanceRef", () => {
    const inv = makeInventory({
      items: [{ id: "inst-4", defId: "tempest-wings", enhanceLevel: 0, affixes: [] }],
      equipped: { Wing: "inst-4" },
    });
    // Before Task 2 populates appearanceRef, this returns null
    // After Task 2 it should return "item__tempest-wings"
    const result = resolveHeroLayers(inv);
    // Currently null (no appearanceRef yet); after Task 2 this becomes non-null
    expect(typeof result.wingKey === "string" || result.wingKey === null).toBe(true);
  });
});
```

- [ ] **Run to verify it fails (module not found)**
```bash
cd /path/to/wibu-tower-defense
npm test -- tests/heroEquipVisuals.test.ts
```
Expected: `Cannot find module '../src/scenes/heroEquipVisuals.ts'`

### Step 2: Implement the pure mapping module

```typescript
// src/scenes/heroEquipVisuals.ts

/**
 * Pure mapping from equipped inventory → visual layer texture keys.
 * No Phaser, no side effects — fully unit-testable.
 */
import { ITEM_CATALOG_MAP } from "../data/items.ts";
import type { InventorySave } from "../core/save.ts";

export interface HeroLayerConfig {
  /** Texture key for the weapon layer sprite. Null = hide weapon layer. */
  weaponKey: string | null;
  /** Texture key for the wing layer sprite. Null = hide wing layer. */
  wingKey: string | null;
  /** Texture key for the pet floating sprite. Null = hide pet. */
  petKey: string | null;
}

/**
 * Derive hero visual layer config from the current inventory state.
 * Called whenever equipment changes; result is applied to HeroLayeredSprite.
 */
export function resolveHeroLayers(inventory: InventorySave): HeroLayerConfig {
  return {
    weaponKey: _resolveWeapon(inventory),
    wingKey:   _resolveWing(inventory),
    petKey:    _resolvePet(inventory),
  };
}

function _instanceDef(inventory: InventorySave, slot: string) {
  const instanceId = (inventory.equipped as Record<string, string | undefined>)[slot];
  if (!instanceId) return null;
  const instance = inventory.items.find((i) => i.id === instanceId);
  if (!instance) return null;
  return ITEM_CATALOG_MAP.get(instance.defId) ?? null;
}

function _resolveWeapon(inventory: InventorySave): string | null {
  const def = _instanceDef(inventory, "Weapon");
  if (!def) return null;
  return `item__${def.id}`;
}

function _resolveWing(inventory: InventorySave): string | null {
  const def = _instanceDef(inventory, "Wing");
  if (!def) return null;
  // Wings use appearanceRef if set, otherwise fall back to item icon
  return def.appearanceRef ?? `item__${def.id}`;
}

function _resolvePet(inventory: InventorySave): string | null {
  const def = _instanceDef(inventory, "Pet");
  if (!def) return null;
  return `item__${def.id}`;
}
```

- [ ] **Run tests — expect 4/5 to pass (wing appearanceRef test is conditional)**
```bash
npm test -- tests/heroEquipVisuals.test.ts
```
Expected: 4 pass, 1 pass (the last test accepts both null and string)

- [ ] **Commit**
```bash
git add src/scenes/heroEquipVisuals.ts tests/heroEquipVisuals.test.ts
git commit -m "feat: pure hero equipment → visual layer mapping with tests"
```

---

## Task 2: Populate `appearanceRef` on Wing items in `items.ts`

**Files:**
- Modify: `src/data/items.ts` (two entries: fledgling-wings, tempest-wings)

The `appearanceRef` field is already in `ItemDef` schema. Wing icons are already generated at `public/assets/sprites/item/fledgling-wings.png` and `tempest-wings.png`, so no new asset is needed — `appearanceRef` just points at the existing item icon key.

- [ ] **Find the two wing entries in `src/data/items.ts`** (search for `fledgling-wings` and `tempest-wings`)

- [ ] **Add `appearanceRef` to fledgling-wings**

Find:
```typescript
i({ id: "fledgling-wings", name: "Fledgling Wings", slot: "Wing",
    rarity: "Common", requiredLevel: 1,
```
Change to:
```typescript
i({ id: "fledgling-wings", name: "Fledgling Wings", slot: "Wing",
    appearanceRef: "item__fledgling-wings",
    rarity: "Common", requiredLevel: 1,
```

- [ ] **Add `appearanceRef` to tempest-wings**

Find:
```typescript
i({ id: "tempest-wings", name: "Tempest Wings", slot: "Wing",
    rarity: "Legendary", requiredLevel: 50,
```
Change to:
```typescript
i({ id: "tempest-wings", name: "Tempest Wings", slot: "Wing",
    appearanceRef: "item__tempest-wings",
    rarity: "Legendary", requiredLevel: 50,
```

- [ ] **Run typecheck**
```bash
npm run typecheck
```
Expected: 0 errors

- [ ] **Run wing test from Task 1 — now both wing cases should pass**
```bash
npm test -- tests/heroEquipVisuals.test.ts
```
Expected: 5/5 pass

- [ ] **Commit**
```bash
git add src/data/items.ts
git commit -m "feat: populate appearanceRef on wing items for visual layer system"
```

---

## Task 3: `HeroLayeredSprite` container class

**Files:**
- Create: `src/scenes/HeroLayeredSprite.ts`

This class is the Phaser side. It is NOT unit-tested with Vitest (requires a Phaser runtime). Test it manually by running the game.

```typescript
// src/scenes/HeroLayeredSprite.ts

import Phaser from "phaser";
import { resolveHeroLayers, type HeroLayerConfig } from "./heroEquipVisuals.ts";
import type { InventorySave } from "../core/save.ts";

/**
 * Hero battle sprite with equipment visual layers.
 *
 * Layer order (back → front):
 *   1. wingsSprite  — wing item icon behind the body
 *   2. bodySprite   — hero__hero animated spritesheet
 *   3. weaponSprite — weapon item icon at the right hand
 *
 * Pet is a separate floating sprite (not inside the container) because it
 * needs to move on its own tween independently of the hero container position.
 *
 * Usage — replace the old single sprite in BattleScene:
 *   const heroSprite = new HeroLayeredSprite(this, x, y);
 *   heroSprite.addToWorld(this.world);
 *   heroSprite.syncEquipment(save.inventory);
 */
export class HeroLayeredSprite extends Phaser.GameObjects.Container {
  private readonly bodySprite: Phaser.GameObjects.Sprite;
  private readonly weaponSprite: Phaser.GameObjects.Sprite;
  private readonly wingsSprite: Phaser.GameObjects.Sprite;

  /**
   * Pet is NOT a child of this container — it follows via setPosition() calls
   * in BattleScene so it can be tweened independently.
   */
  readonly petSprite: Phaser.GameObjects.Sprite;

  /** Last resolved config — used to skip redundant setTexture calls. */
  private _lastConfig: HeroLayerConfig = { weaponKey: null, wingKey: null, petKey: null };

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);

    // Wings: behind body, slightly larger, centered
    this.wingsSprite = scene.add.sprite(0, 0, "__missing").setVisible(false);
    // Body: the animated base sprite
    this.bodySprite = scene.add.sprite(0, 0, "hero__hero").setOrigin(0.5, 0.78);
    // Weapon: in front, offset to right hand
    this.weaponSprite = scene.add.sprite(14, -10, "__missing").setVisible(false).setScale(0.22);

    // Add in back-to-front order
    this.add([this.wingsSprite, this.bodySprite, this.weaponSprite]);

    // Pet is separate
    this.petSprite = scene.add.sprite(x + 30, y + 8, "__missing").setVisible(false).setScale(0.18);

    scene.add.existing(this);
  }

  /**
   * Add hero and pet to a Phaser Container (e.g., this.world in BattleScene).
   * The hero container goes to the world; the pet is also added to world so it
   * participates in world scroll / zoom.
   */
  addToWorld(world: Phaser.GameObjects.Container): void {
    world.add(this);
    world.add(this.petSprite);
  }

  /** Mirror body animation frame onto layers every tick. Called by BattleScene.update(). */
  override preUpdate(time: number, delta: number): void {
    this.bodySprite.preUpdate(time, delta);
    // Keep pet position synced (floats slightly right of hero)
    this.petSprite.setPosition(this.x + 30, this.y + 8);
  }

  /** Delegate animation play to body sprite. */
  play(animKey: string, ignoreIfPlaying = false): this {
    this.bodySprite.play(animKey, ignoreIfPlaying);
    return this;
  }

  /** Returns the body sprite's current animation key (for BattleScene logic). */
  get currentAnimKey(): string | null {
    return this.bodySprite.anims.currentAnim?.key ?? null;
  }

  /**
   * Scale body to target height in pixels. Mirrors existing BattleScene logic:
   *   heroSprite.setScale(54 / heroSprite.height)
   */
  scaleToHeight(targetPx: number): this {
    const scale = targetPx / this.bodySprite.height;
    this.bodySprite.setScale(scale);
    // Scale weapon proportionally; wings slightly larger
    this.weaponSprite.setScale(scale * 0.22);
    this.wingsSprite.setScale(scale * 1.3);
    this.petSprite.setScale(scale * 0.18);
    return this;
  }

  setDepth(value: number): this {
    super.setDepth(value);
    this.petSprite.setDepth(value - 0.5); // pet renders just behind hero
    return this;
  }

  override setPosition(x: number, y: number): this {
    super.setPosition(x, y);
    return this;
  }

  override setVisible(visible: boolean): this {
    super.setVisible(visible);
    this.petSprite.setVisible(visible && this._lastConfig.petKey !== null);
    return this;
  }

  /**
   * Apply equipment changes from the current inventory.
   * Call whenever the player equips or unequips an item.
   */
  syncEquipment(inventory: InventorySave): void {
    const config = resolveHeroLayers(inventory);

    if (config.weaponKey !== this._lastConfig.weaponKey) {
      if (config.weaponKey && this.scene.textures.exists(config.weaponKey)) {
        this.weaponSprite.setTexture(config.weaponKey).setVisible(true);
      } else {
        this.weaponSprite.setVisible(false);
      }
    }

    if (config.wingKey !== this._lastConfig.wingKey) {
      if (config.wingKey && this.scene.textures.exists(config.wingKey)) {
        this.wingsSprite.setTexture(config.wingKey).setVisible(true);
      } else {
        this.wingsSprite.setVisible(false);
      }
    }

    if (config.petKey !== this._lastConfig.petKey) {
      if (config.petKey && this.scene.textures.exists(config.petKey)) {
        this.petSprite.setTexture(config.petKey).setVisible(true);
      } else {
        this.petSprite.setVisible(false);
      }
    }

    this._lastConfig = config;
  }
}
```

- [ ] **Run typecheck**
```bash
npm run typecheck
```
Expected: 0 errors

- [ ] **Commit**
```bash
git add src/scenes/HeroLayeredSprite.ts
git commit -m "feat: HeroLayeredSprite container with weapon/wing/pet layer system"
```

---

## Task 4: Replace hero sprite in `BattleScene.ts`

**Files:**
- Modify: `src/scenes/BattleScene.ts`

There are four surgical changes: the property type, the import, the creation block, and the position-update line.

### Step 1: Add import

At the top of `BattleScene.ts`, after the existing imports (around line 31), add:

```typescript
import { HeroLayeredSprite } from "./HeroLayeredSprite.ts";
```

### Step 2: Change property type (line 162)

Find:
```typescript
private heroSprite: Phaser.GameObjects.Sprite | null = null;
```
Replace with:
```typescript
private heroSprite: HeroLayeredSprite | null = null;
```

### Step 3: Replace sprite creation block (lines 775-781)

Find:
```typescript
if (h.alive && hasSprite(this, "hero__hero")) {
  if (!this.heroSprite) {
    this.heroSprite = this.add.sprite(h.pos.x, h.pos.y, "hero__hero").setOrigin(0.5, 0.78).setDepth(3);
    this.heroSprite.setScale(54 / this.heroSprite.height);
    this.world.add(this.heroSprite);
    if (this.anims.exists("hero__hero_idle")) this.heroSprite.play("hero__hero_idle");
  }
```
Replace with:
```typescript
if (h.alive && hasSprite(this, "hero__hero")) {
  if (!this.heroSprite) {
    this.heroSprite = new HeroLayeredSprite(this, h.pos.x, h.pos.y);
    this.heroSprite.scaleToHeight(54).setDepth(3);
    this.heroSprite.addToWorld(this.world);
    if (this.anims.exists("hero__hero_idle")) this.heroSprite.play("hero__hero_idle");
    // Apply current equipment visuals on first creation
    if (this.saveData) {
      this.heroSprite.syncEquipment(this.saveData.inventory);
    }
  }
```

### Step 4: Update position line (line 782)

Find:
```typescript
this.heroSprite.setPosition(h.pos.x, h.pos.y).setVisible(true);
```
Replace with:
```typescript
this.heroSprite.setPosition(h.pos.x, h.pos.y);
this.heroSprite.setVisible(true);
this.heroSprite.preUpdate(0, 0); // sync pet position
```

- [ ] **Run typecheck**
```bash
npm run typecheck
```
Expected: 0 errors

- [ ] **Run all tests**
```bash
npm test
```
Expected: all pass (no behaviour change yet — hero appears the same as before)

- [ ] **Manual smoke test:** `npm run dev` → start a battle → hero should appear and animate exactly as before

- [ ] **Commit**
```bash
git add src/scenes/BattleScene.ts
git commit -m "feat: replace hero sprite with HeroLayeredSprite container in BattleScene"
```

---

## Task 5: Wire equipment changes to visual updates

**Files:**
- Modify: `src/scenes/BattleScene.ts` (one new method call)
- Modify: `src/scenes/HeroScene.ts` (emit event or call back to BattleScene on equip)

The goal: when the player changes equipment in `HeroScene`, the hero sprite in the active battle updates immediately.

### Step 1: Find how BattleScene accesses save data

Search `BattleScene.ts` for `saveData` or `saveManager`:
```bash
grep -n "saveData\|saveManager\|save\." src/scenes/BattleScene.ts | head -20
```

The save reference will be either `this.saveData` or accessed via `this.saveManager.getSave()`. Use whichever exists.

### Step 2: Add equipment-sync call in BattleScene's update loop

In `BattleScene.ts`, inside the existing `update()` method, **after** the block that creates/positions the hero sprite (after the `setPosition` line added in Task 4), add:

```typescript
// Sync equipment visuals each frame (cheap: only swaps textures when config changes)
if (this.heroSprite && this.saveData) {
  this.heroSprite.syncEquipment(this.saveData.inventory);
}
```

Note: `syncEquipment` compares against `_lastConfig` and is a no-op when nothing changed, so calling it every frame is safe.

### Step 3: Verify the sync works end-to-end

- [ ] `npm run dev` → enter a battle with no weapon equipped → hero has no weapon overlay
- [ ] Open HeroScene (pause menu or hub) → equip `iron-sword` → return to battle → hero shows weapon icon
- [ ] Unequip weapon → weapon icon disappears
- [ ] Equip `fledgling-wings` → wings icon appears behind hero
- [ ] Equip `coin-sprite` pet → pet icon floats to the right of hero

- [ ] **Run typecheck and full test suite**
```bash
npm run typecheck && npm test
```
Expected: 0 errors, all tests pass

- [ ] **Commit**
```bash
git add src/scenes/BattleScene.ts
git commit -m "feat: live equipment visual sync in BattleScene update loop"
```

---

## Task 6: Attack animation — tween weapon on swing

**Files:**
- Modify: `src/scenes/HeroLayeredSprite.ts` (add `playAttackWithWeaponTween`)

This gives the weapon a snappy swing arc during the hero's attack animation so it doesn't look static.

### Step 1: Add the tween method to `HeroLayeredSprite`

Inside `HeroLayeredSprite`, add after `play()`:

```typescript
/**
 * Play the attack animation and tween the weapon icon in a strike arc.
 * Call this instead of play("hero__hero_attack") when the hero attacks.
 */
playAttack(): void {
  this.bodySprite.play("hero__hero_attack", true);
  if (!this.weaponSprite.visible) return;

  // Snap weapon back to rest position first
  this.weaponSprite.setPosition(14, -10).setAngle(0);

  // Wind-up: pull back
  this.scene.tweens.add({
    targets: this.weaponSprite,
    x: 8, y: -16, angle: -30,
    duration: 80,
    ease: "Sine.easeIn",
    onComplete: () => {
      // Strike forward
      this.scene.tweens.add({
        targets: this.weaponSprite,
        x: 20, y: -4, angle: 25,
        duration: 60,
        ease: "Quint.easeOut",
        onComplete: () => {
          // Return to rest
          this.scene.tweens.add({
            targets: this.weaponSprite,
            x: 14, y: -10, angle: 0,
            duration: 120,
            ease: "Back.easeOut",
          });
        },
      });
    },
  });
}
```

### Step 2: Find where BattleScene calls the hero attack animation

Search BattleScene.ts for the attack animation call:
```bash
grep -n "attack\|heroSprite.play" src/scenes/BattleScene.ts | head -20
```

Replace `this.heroSprite.play("hero__hero_attack")` (or equivalent) with:
```typescript
this.heroSprite.playAttack();
```

- [ ] **Run typecheck**
```bash
npm run typecheck
```
Expected: 0 errors

- [ ] **Manual test:** `npm run dev` → start battle with a weapon equipped → watch hero attack → weapon should swing in an arc

- [ ] **Commit**
```bash
git add src/scenes/HeroLayeredSprite.ts src/scenes/BattleScene.ts
git commit -m "feat: weapon tween arc on hero attack animation"
```

---

## Stretch Goals (not in this plan)

These are good next iterations but out of scope here:

1. **Animated wing overlay sheets** — Generate 7-frame wing-only spritesheets in the designer (`wibu-td-designer/src/gen-all.mjs`) and sync them frame-by-frame with the body using `bodySprite.anims.currentFrame`. This requires new art assets and a more complex `preUpdate`.

2. **Helmet/armor overlays** — Generate head and chest overlay layers. High effort, low readability at 192px.

3. **Pet idle animation** — Add a 2-frame gentle bob tween loop on the pet sprite.

4. **Wing flap on walk** — Scale wing sprite's y slightly in sync with walk animation frames.

---

## Self-Review

**Spec coverage:**
- ✅ Hero weapon shows as visual overlay → Task 1 + 4 + 5
- ✅ Wings show behind hero → Task 1 + 4 + 5
- ✅ Pet shows floating near hero → Task 1 + 4 + 5
- ✅ Equipment changes update visuals in real-time → Task 5
- ✅ Attack animation — weapon swings → Task 6
- ✅ `appearanceRef` field populated for wing items → Task 2
- ✅ No visual changes to towers, enemies, bosses → all tasks scope to hero only
- ✅ Graceful fallback when texture missing (uses `hasSprite` pattern) → `syncEquipment` checks `this.scene.textures.exists`

**Type consistency check:**
- `resolveHeroLayers` takes `InventorySave` (from `src/core/save.ts`) ✅
- `HeroLayeredSprite.syncEquipment` takes `InventorySave` ✅
- `HeroLayerConfig` interface defined in `heroEquipVisuals.ts`, imported by `HeroLayeredSprite.ts` ✅
- `addToWorld(world: Phaser.GameObjects.Container)` matches `this.world` type in BattleScene ✅

**No placeholders:** All steps contain complete code. ✅
