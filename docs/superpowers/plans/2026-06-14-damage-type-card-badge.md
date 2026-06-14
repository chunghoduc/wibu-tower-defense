# Damage-type Card Badge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a small procedural badge on each tower card distinguishing Physical (steel blade glyph) vs Magic (violet sparkle glyph) damage.

**Architecture:** A pure, Phaser-free module (`damageBadge.ts`) owns the damage→color map, the card-relative placement geometry, and the normalized glyph outlines — fully unit-tested. A thin presenter (`damageBadgeFx.ts`) draws a disc + glyph with `Graphics`. Three existing card presenters (build-bar card, squad tile, squad info panel) each add one call. No new texture, no `ASSET_VERSION` bump, no deploy.

**Tech Stack:** TypeScript, Phaser 3, vitest. Mirrors the existing `roleBadge.ts` pure-module + presenter split.

---

### Task 1: Pure `damageBadge.ts` module + tests

**Files:**
- Create: `src/scenes/damageBadge.ts`
- Test: `tests/damageBadge.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/damageBadge.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { ATTACK_DAMAGE_TYPES } from "../src/data/schemaEnums.ts";
import {
  DAMAGE_BADGE_COLOR,
  damageBadgeOnCard,
  damageGlyphPoints,
} from "../src/scenes/damageBadge.ts";

describe("DAMAGE_BADGE_COLOR", () => {
  it("is total over the damage types with two distinct colors", () => {
    for (const dt of ATTACK_DAMAGE_TYPES) {
      expect(typeof DAMAGE_BADGE_COLOR[dt]).toBe("number");
    }
    expect(DAMAGE_BADGE_COLOR.Physical).not.toBe(DAMAGE_BADGE_COLOR.Magic);
  });
});

describe("damageBadgeOnCard", () => {
  it("pins the badge to the card's upper-left, inside the half-width", () => {
    const w = 66;
    const g = damageBadgeOnCard(w);
    expect(g.x).toBeLessThan(0); // left of center
    expect(g.y).toBeLessThan(0); // above center
    expect(g.x).toBeGreaterThan(-w / 2); // still inside the card
    expect(g.diameter).toBeGreaterThan(0);
  });
  it("scales diameter monotonically with card width", () => {
    expect(damageBadgeOnCard(80).diameter).toBeGreaterThan(damageBadgeOnCard(40).diameter);
  });
});

describe("damageGlyphPoints", () => {
  it("returns in-bounds, non-empty outlines that differ per damage type", () => {
    const phys = damageGlyphPoints("Physical");
    const magic = damageGlyphPoints("Magic");
    expect(phys.length).toBeGreaterThan(2);
    expect(magic.length).toBeGreaterThan(2);
    for (const p of [...phys, ...magic]) {
      expect(Math.abs(p.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(p.y)).toBeLessThanOrEqual(1);
    }
    // Distinct silhouettes (blade vs spark have different point counts here).
    expect(phys.length).not.toBe(magic.length);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/damageBadge.test.ts`
Expected: FAIL — `damageBadge.ts` does not exist / exports undefined.

- [ ] **Step 3: Write minimal implementation**

Create `src/scenes/damageBadge.ts`:

```ts
/**
 * Pure (Phaser-free) helpers for the per-tower DAMAGE-TYPE badge. The badge tells
 * Physical from Magic at a glance on a tower card: a steel blade glyph vs a violet
 * sparkle. This module is the single source for the damage->color map, the badge
 * placement geometry (mirror of roleBadge's, but upper-LEFT), and the normalized
 * glyph outlines, so the presenter (damageBadgeFx) and tests agree.
 */
import type { AttackDamageType } from "../data/schema.ts";

export type Vec2 = { x: number; y: number };

/** Tint for each damage type's badge glyph + ring. Steel blue vs arcane violet,
 *  chosen to not clash with the role-badge tints. Dual-coded with the glyph shape. */
export const DAMAGE_BADGE_COLOR: Record<AttackDamageType, number> = {
  Physical: 0x9fb4cc,
  Magic: 0xc18cff,
};

/** Badge placement on a tower card (local coords, card centered at 0,0). Mirror of
 *  roleBadgeOnCard — pinned to the card's upper-LEFT so it never overlaps the role
 *  emblem on the upper-right. */
export function damageBadgeOnCard(cardWidth: number): { x: number; y: number; diameter: number } {
  const diameter = Math.round(cardWidth * 0.22); // ~15px on the 66px build-bar card
  return { x: -(cardWidth / 2) + 9, y: -8, diameter };
}

/** Normalized glyph outline (points in unit space, |x|<=1 and |y|<=1) for the given
 *  damage type. Physical = an upright sword silhouette; Magic = a 4-point sparkle.
 *  The presenter scales by the badge radius and translates to the badge center. */
export function damageGlyphPoints(dt: AttackDamageType): Vec2[] {
  if (dt === "Magic") {
    // 4-point sparkle: alternating outer tips / inner waist.
    return [
      { x: 0, y: -1 },
      { x: 0.22, y: -0.22 },
      { x: 1, y: 0 },
      { x: 0.22, y: 0.22 },
      { x: 0, y: 1 },
      { x: -0.22, y: 0.22 },
      { x: -1, y: 0 },
      { x: -0.22, y: -0.22 },
    ];
  }
  // Physical: upright sword (tip up, crossguard, handle).
  return [
    { x: 0, y: -1 },
    { x: 0.18, y: -0.55 },
    { x: 0.18, y: 0.15 },
    { x: 0.5, y: 0.15 },
    { x: 0.5, y: 0.32 },
    { x: 0.12, y: 0.32 },
    { x: 0.12, y: 1 },
    { x: -0.12, y: 1 },
    { x: -0.12, y: 0.32 },
    { x: -0.5, y: 0.32 },
    { x: -0.5, y: 0.15 },
    { x: -0.18, y: 0.15 },
    { x: -0.18, y: -0.55 },
  ];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/damageBadge.test.ts`
Expected: PASS (3 describe blocks green).

- [ ] **Step 5: Commit**

```bash
git add src/scenes/damageBadge.ts tests/damageBadge.test.ts
git commit -m "feat(damage-badge): pure damageBadge module — color/geometry/glyphs (TDD)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Presenter `damageBadgeFx.ts`

**Files:**
- Create: `src/scenes/damageBadgeFx.ts`

This is a thin Phaser draw helper (no separate unit test — Phaser `Graphics` needs a
real context; the geometry it consumes is already locked by Task 1).

- [ ] **Step 1: Write the presenter**

Create `src/scenes/damageBadgeFx.ts`:

```ts
/**
 * Thin presenter for the damage-type badge. Draws a small dark disc with a colored
 * ring and the damage-type glyph filled in the damage color, returning the Graphics
 * so the caller can add it to its own container at the chosen center. Pure draw, no
 * state — geometry/color/glyph all come from the pure damageBadge module.
 */
import Phaser from "phaser";
import type { AttackDamageType } from "../data/schema.ts";
import { DAMAGE_BADGE_COLOR, damageGlyphPoints } from "./damageBadge.ts";

/** Draw a damage badge centered at (cx, cy) with the given diameter. */
export function drawDamageBadge(
  scene: Phaser.Scene,
  cx: number,
  cy: number,
  diameter: number,
  dt: AttackDamageType,
): Phaser.GameObjects.Graphics {
  const r = diameter / 2;
  const color = DAMAGE_BADGE_COLOR[dt];
  const g = scene.add.graphics();
  // Disc backing + colored ring.
  g.fillStyle(0x141b28, 1).fillCircle(cx, cy, r);
  g.lineStyle(Math.max(1, r * 0.18), color, 1).strokeCircle(cx, cy, r);
  // Glyph: scale the normalized outline to ~62% of the radius, translate to center.
  const s = r * 0.62;
  const pts = damageGlyphPoints(dt).map((p) => new Phaser.Geom.Point(cx + p.x * s, cy + p.y * s));
  g.fillStyle(color, 1).fillPoints(pts, true);
  return g;
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: no errors (clean).

- [ ] **Step 3: Commit**

```bash
git add src/scenes/damageBadgeFx.ts
git commit -m "feat(damage-badge): damageBadgeFx presenter (disc + ring + glyph)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Wire the badge into the three card surfaces

**Files:**
- Modify: `src/scenes/BattleScene.ts` (build-bar card, after the role-emblem block ~line 480)
- Modify: `src/scenes/squadTiles.ts` (roster tile, after the role-emblem block ~line 85)
- Modify: `src/scenes/squadInfoPanel.ts` (info-panel card, after the role-emblem block ~line 102)

- [ ] **Step 1: BattleScene build-bar card — add import**

At the top of `src/scenes/BattleScene.ts`, next to the existing
`import { roleBadgeTex, roleBadgeOnCard } from "./roleBadge.ts";` line (~line 38), add:

```ts
import { damageBadgeOnCard } from "./damageBadge.ts";
import { drawDamageBadge } from "./damageBadgeFx.ts";
```

- [ ] **Step 2: BattleScene build-bar card — draw the badge**

In `buildBuildBar()`, immediately AFTER the role-emblem block that ends with
`c.add(emblem); }` (the `if (this.textures.exists(rbKey)) { ... }` block, ~line 480),
insert:

```ts
      // Damage-type badge on the card's upper-LEFT (mirror of the role emblem).
      const dg = damageBadgeOnCard(TW - 8);
      c.add(drawDamageBadge(this, dg.x, dg.y, dg.diameter, def.damageType));
```

- [ ] **Step 3: squadTiles roster tile — add import + draw**

At the top of `src/scenes/squadTiles.ts`, next to
`import { roleBadgeTex } from "./roleBadge.ts";` (~line 12), add:

```ts
import { drawDamageBadge } from "./damageBadgeFx.ts";
```

In the tile builder, immediately AFTER the role-emblem block
(`const rbKey = roleBadgeTex(t.role); if (scene.textures.exists(rbKey)) { ... c.add(emblem); }`,
~line 85), insert (mirror of the emblem's lower-right at (14,6) → lower-LEFT):

```ts
  // Damage-type badge on the portrait's lower-left, mirroring the role emblem.
  c.add(drawDamageBadge(scene, -14, 6, 15, t.damageType));
```

- [ ] **Step 4: squadInfoPanel card — add import + draw**

At the top of `src/scenes/squadInfoPanel.ts`, next to
`import { roleBadgeTex } from "./roleBadge.ts";` (~line 16), add:

```ts
import { drawDamageBadge } from "./damageBadgeFx.ts";
```

Immediately AFTER the role-emblem block (`const rbKey = roleBadgeTex(def.role); if (...) { ... add(c, emblem); }`,
~line 102), insert (role emblem is at (x+48, y+48) lower-right → put damage at lower-LEFT of the portrait):

```ts
  // Damage-type badge on the portrait's lower-left (role emblem is lower-right).
  add(c, drawDamageBadge(scene, x + 8, y + 48, 16, def.damageType));
```

- [ ] **Step 5: Verify the squadTiles `t` has `damageType`**

Run: `grep -n "damageType" src/scenes/squadTiles.ts; grep -n "t:" src/scenes/squadTiles.ts | head`
The tile's `t` is a `CharacterDef`-like view. Confirm it exposes `damageType`. If the
tile's `t` type is a narrower view WITHOUT `damageType`, instead pass the damage type
from the same source the role comes from. Open the file and check the `t` parameter's
type at the function signature (~line 50-62). `t.role` is already read at line 80, and
on `CharacterDef` `damageType` sits beside `role`, so `t.damageType` is expected to be
available. If the type is a custom subset, add `damageType: AttackDamageType` to that
view type and populate it at the call site (search for where the tile builder is called).

Expected: `t.damageType` resolves. (If it does not, this step's fallback wires it through.)

- [ ] **Step 6: Typecheck + full test suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc clean; all tests pass (the new `damageBadge.test.ts` included).

- [ ] **Step 7: Commit**

```bash
git add src/scenes/BattleScene.ts src/scenes/squadTiles.ts src/scenes/squadInfoPanel.ts
git commit -m "feat(damage-badge): show physical/magic badge on tower cards

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Verify whole + live repro + memory

**Files:**
- Possibly modify: a CDP playtest under `scripts/playtest/` (best-effort visual check)
- Modify: `memory/...` index + a project memory note

- [ ] **Step 1: Full verification gates**

Run each and confirm green:
```bash
npx tsc --noEmit
npx vitest run
npx eslint src/scenes/damageBadge.ts src/scenes/damageBadgeFx.ts src/scenes/BattleScene.ts src/scenes/squadTiles.ts src/scenes/squadInfoPanel.ts tests/damageBadge.test.ts
npm run lint:cycles
npm run build
```
Expected: tsc clean; all tests pass; eslint clean on the changed files; 0 cycles; build succeeds.

- [ ] **Step 2: Live playtest (CDP)**

Start the dev server and a headless Chrome, open a battle, and screenshot the build
bar to visually confirm both glyph types render and read distinctly. Use the existing
playtest harness conventions (`npm run dev -- --port 4188 --strictPort`, Chrome on
:9222, `window.__game`). Capture `/tmp/damage_badge.png`. This is a best-effort visual
check; the Task 1 unit test is the authoritative gate.

- [ ] **Step 3: Update memory**

Add a short project memory file describing the damage-type card badge (procedural,
upper-left mirror of the role badge, Physical=blade/steel, Magic=spark/violet, three
card surfaces, no art/no ASSET_VERSION bump) and add its one-line pointer to
`memory/MEMORY.md`. Link `[[project_role_icons]]`.

- [ ] **Step 4: Final clean-tree check + send screenshot**

Run: `git status --porcelain` (expect clean after committing memory) and emit
`[[send: /tmp/damage_badge.png]]` in the completion report.

```bash
git add memory && git commit -m "docs(memory): damage-type card badge note

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- Source of truth (`def.damageType`) → Task 3 reads it at each site. ✓
- Procedural, no SDXL / no ASSET_VERSION → Tasks 1–2 use Graphics only. ✓
- Dual-coded shape+color → `damageGlyphPoints` + `DAMAGE_BADGE_COLOR` (Task 1). ✓
- Upper-left placement, no role collision → `damageBadgeOnCard` returns x<0 (Task 1, locked by test). ✓
- Three card surfaces → Task 3 steps 2–4. ✓
- Pure unit test → Task 1. ✓
- No field-tower badge → not wired (only the three card sites). ✓

**Placeholder scan:** No TBD/TODO; every code step shows full code. Task 3 Step 5 is a
guard/verification step with an explicit fallback, not a placeholder.

**Type consistency:** `damageBadgeOnCard`, `damageGlyphPoints`, `DAMAGE_BADGE_COLOR`,
`drawDamageBadge(scene, cx, cy, diameter, dt)` are used with identical signatures in
Tasks 2–3. `AttackDamageType` is the shared type from `schema.ts`. `Vec2` is local to
`damageBadge.ts`.
