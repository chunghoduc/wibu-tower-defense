# Wing-Craft Result Reveal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After a Craft Wings attempt, show a result-reveal overlay — the minted wing with its stats on success, a clear "dissolved into chaos" beat on failure — instead of the bare one-line toast.

**Architecture:** A pure, tested view-model builder (`core/wingCraftResultView.ts`) turns the existing `CraftWingsResult` into a discriminated success/failure VM (name, rarity color, icon, stat rows). A thin Phaser presenter (`scenes/wingCraftResultOverlay.ts`) renders it as a modal mirroring `SummonResultOverlay`. `ForgeScene` opens the overlay after its lead-in `playForgeFx`, with `rebuild()` moved into the overlay's dismiss callback. No mechanic, art, or save changes.

**Tech Stack:** TypeScript, Phaser 3, Vitest. Reuses `rewardIcon.itemInstanceIcon`, `itemDisplay.itemStatRows`, `itemIcon.makeFitIcon`, `namePlate.addNamePlate`, and `uiKit` (`dimBackdrop`/`closeModal`/`popIn`/`button`/`accentPanel`/`COLORS`).

---

## File Structure

- **Create** `src/core/wingCraftResultView.ts` — pure VM builder (Phaser-free).
- **Create** `tests/wing-craft-result-view.test.ts` — unit tests for the VM.
- **Create** `src/scenes/wingCraftResultOverlay.ts` — presenter (< 500 lines).
- **Modify** `src/scenes/ForgeScene.ts` — wire the overlay into the confirm handler.

---

## Task 1: Pure result view-model (`wingCraftResultView.ts`)

**Files:**
- Create: `src/core/wingCraftResultView.ts`
- Test: `tests/wing-craft-result-view.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/wing-craft-result-view.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { wingCraftResultView } from "../src/core/wingCraftResultView.ts";
import { itemInstanceIcon } from "../src/data/rewardIcon.ts";
import type { CraftWingsResult } from "../src/core/wingCraft.ts";
import type { ItemInstanceSave } from "../src/core/save.ts";

// A minted Common skywings (worn-skywings exists in the catalog).
function wing(over: Partial<ItemInstanceSave> = {}): ItemInstanceSave {
  return {
    id: "w1",
    defId: "worn-skywings",
    acquiredLevel: 1,
    rolledStats: { maxHp: 40 },
    rolledPrimaryAffix: 5,
    rolledAffixes: [],
    enhanceLevel: 0,
    ...over,
  };
}

describe("wingCraftResultView", () => {
  it("maps a successful craft to a success VM with name, rarity, color and stat rows", () => {
    const result: CraftWingsResult = { ok: true, success: true, rarity: "Common", item: wing() };
    const vm = wingCraftResultView(result);
    expect(vm.kind).toBe("success");
    if (vm.kind !== "success") throw new Error("expected success");
    expect(vm.name.length).toBeGreaterThan(0);
    expect(vm.rarity).toBe("Common");
    expect(typeof vm.color).toBe("number");
    expect(vm.statRows.length).toBeGreaterThan(0);
  });

  it("agrees with itemInstanceIcon for the same item (single source of truth)", () => {
    const item = wing();
    const vm = wingCraftResultView({ ok: true, success: true, rarity: "Common", item });
    if (vm.kind !== "success") throw new Error("expected success");
    const icon = itemInstanceIcon(item);
    expect(vm.iconKey).toBe(icon.iconKey);
    expect(vm.emoji).toBe(icon.emoji);
    expect(vm.color).toBe(icon.color);
  });

  it("maps a rolled failure to a failure VM", () => {
    const vm = wingCraftResultView({ ok: true, success: false });
    expect(vm.kind).toBe("failure");
  });

  it("degrades a malformed success (no item) to failure without throwing", () => {
    const vm = wingCraftResultView({ ok: true, success: true, rarity: "Common" });
    expect(vm.kind).toBe("failure");
  });

  it("degrades a success whose def is missing from the catalog to failure", () => {
    const vm = wingCraftResultView({
      ok: true,
      success: true,
      rarity: "Common",
      item: wing({ defId: "no-such-def" }),
    });
    expect(vm.kind).toBe("failure");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/wing-craft-result-view.test.ts`
Expected: FAIL — `wingCraftResultView` is not exported / module not found.

- [ ] **Step 3: Write minimal implementation**

Create `src/core/wingCraftResultView.ts`:

```ts
/**
 * Pure view-model for the wing-craft result reveal. Turns the CraftWingsResult
 * returned by craftWings() into a discriminated success/failure VM the overlay
 * renders. No Phaser — just data, so it's unit-testable and the reveal agrees
 * with tooltips/inventory (same itemInstanceIcon + itemStatRows sources).
 */
import type { CraftWingsResult } from "./wingCraft.ts";
import { ITEM_CATALOG_MAP } from "../data/items.ts";
import { itemInstanceIcon } from "../data/rewardIcon.ts";
import { itemStatRows, type ItemStatRow } from "../data/itemDisplay.ts";
import type { Rarity } from "../data/schema.ts";

export type WingCraftResultVM =
  | {
      kind: "success";
      name: string;
      rarity: Rarity;
      color: number;
      iconKey: string;
      emoji: string;
      statRows: ItemStatRow[];
    }
  | { kind: "failure" };

export function wingCraftResultView(result: CraftWingsResult): WingCraftResultVM {
  if (result.ok && result.success && result.item) {
    const def = ITEM_CATALOG_MAP.get(result.item.defId);
    if (def) {
      const icon = itemInstanceIcon(result.item);
      return {
        kind: "success",
        name: def.name,
        rarity: result.rarity ?? def.rarity,
        color: icon.color,
        iconKey: icon.iconKey,
        emoji: icon.emoji,
        statRows: itemStatRows(result.item, def),
      };
    }
  }
  return { kind: "failure" };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/wing-craft-result-view.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/wingCraftResultView.ts tests/wing-craft-result-view.test.ts
git commit -m "feat(forge): pure wingCraftResultView VM (TDD)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Result reveal overlay presenter (`wingCraftResultOverlay.ts`)

**Files:**
- Create: `src/scenes/wingCraftResultOverlay.ts`
- Reference: `src/scenes/summonResultOverlay.ts` (reveal pattern), `src/scenes/uiKit.ts` (helpers), `src/scenes/namePlate.ts`, `src/scenes/itemIcon.ts`, `src/data/itemDisplay.ts` (`SOURCE_COLOR`/`QUALITY_COLOR`).

This task is a Phaser presenter; it is verified by build + live playtest (Task 3), not unit tests (house practice — Phaser GameObjects can't run headless). Keep the file under 500 code lines.

- [ ] **Step 1: Read the reference presenters**

Read `src/scenes/summonResultOverlay.ts` (backdrop glow + rays + open burst), `src/scenes/uiKit.ts` (`dimBackdrop`, `closeModal`, `popIn`, `button`, `accentPanel`, `COLORS`, `DUR`), and `src/scenes/namePlate.ts` (`addNamePlate`) so the new overlay matches their idioms (depths, tween durations, ADD-blend usage).

- [ ] **Step 2: Write the presenter**

Create `src/scenes/wingCraftResultOverlay.ts`:

```ts
/**
 * Wing-craft result reveal — the payoff modal after a Craft Wings attempt.
 * Success: a rarity-tinted glow + open burst + framed card with the wing icon,
 * auto-fit name, rarity badge and rolled stat lines. Failure: an ashen card and
 * "dissolved into chaos…" beat. Mirrors summonResultOverlay's reveal idiom and
 * reuses uiKit scaffolding so it matches every other dialog. Presentation only.
 */
import Phaser from "phaser";
import { crispText } from "./ui.ts";
import { COLORS, DUR, dimBackdrop, closeModal, popIn, button, accentPanel } from "./uiKit.ts";
import { makeFitIcon } from "./itemIcon.ts";
import { addNamePlate } from "./namePlate.ts";
import { SOURCE_COLOR, QUALITY_COLOR } from "../data/itemDisplay.ts";
import type { WingCraftResultVM } from "../core/wingCraftResultView.ts";

const OVERLAY_DEPTH = 380; // above forge FX (360)
const CARD_W = 300;

export function openWingCraftResultOverlay(
  scene: Phaser.Scene,
  vm: WingCraftResultVM,
  onDone: () => void,
): Phaser.GameObjects.Container {
  const { width: W, height: H } = scene.scale;
  const cx = W / 2;
  const cy = H / 2;

  const root = scene.add.container(0, 0).setDepth(OVERLAY_DEPTH);
  let closed = false;
  const finish = () => {
    if (closed) return;
    closed = true;
    closeModal(scene, root, onDone);
  };
  dimBackdrop(scene, root, finish);

  const accent = vm.kind === "success" ? vm.color : 0x8a8f99;

  if (vm.kind === "success") {
    buildGlow(scene, root, cx, cy, accent);
  }

  // Card height scales with how many stat rows we show (success only).
  const rowCount = vm.kind === "success" ? Math.min(vm.statRows.length, 8) : 0;
  const cardH = vm.kind === "success" ? 200 + rowCount * 22 : 200;
  const cardTop = cy - cardH / 2;
  const card = accentPanel(scene, cx, cy, CARD_W, cardH, accent);
  root.add(card);

  if (vm.kind === "success") {
    buildSuccess(scene, root, vm, cx, cardTop);
    openBurst(scene, root, cx, cardTop + 70, accent);
  } else {
    buildFailure(scene, root, cx, cardTop);
  }

  const btnLabel = vm.kind === "success" ? "Claim" : "Close";
  const btn = button(scene, cx, cardTop + cardH - 30, btnLabel, finish, {
    color: vm.kind === "success" ? COLORS.gold : COLORS.sub,
  });
  btn.setAlpha(0);
  root.add(btn);
  scene.tweens.add({ targets: btn, alpha: 1, delay: 380, duration: DUR.fade });

  return root;
}

function buildGlow(
  scene: Phaser.Scene,
  root: Phaser.GameObjects.Container,
  cx: number,
  cy: number,
  color: number,
): void {
  const glow = scene.add.circle(cx, cy, 200, color, 0.16).setBlendMode(Phaser.BlendModes.ADD);
  root.add(glow);
  scene.tweens.add({
    targets: glow,
    scale: 1.18,
    alpha: 0.28,
    duration: 900,
    yoyo: true,
    repeat: -1,
    ease: "Sine.inOut",
  });
  const rays = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  rays.fillStyle(color, 0.1);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    rays.slice(cx, cy, 230, a - 0.12, a + 0.12).fillPath();
  }
  root.add(rays);
  scene.tweens.add({ targets: rays, angle: 360, duration: 16000, repeat: -1 });
}

function openBurst(
  scene: Phaser.Scene,
  root: Phaser.GameObjects.Container,
  x: number,
  y: number,
  color: number,
): void {
  const flash = scene.add.circle(x, y, 50, 0xffffff, 0.9).setBlendMode(Phaser.BlendModes.ADD);
  root.add(flash);
  scene.tweens.add({
    targets: flash,
    scale: 2.4,
    alpha: 0,
    duration: 420,
    ease: "Cubic.out",
    onComplete: () => flash.destroy(),
  });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const spark = scene.add
      .circle(x, y, 3, color, 1)
      .setBlendMode(Phaser.BlendModes.ADD);
    root.add(spark);
    scene.tweens.add({
      targets: spark,
      x: x + Math.cos(a) * 90,
      y: y + Math.sin(a) * 90,
      alpha: 0,
      duration: 520,
      ease: "Cubic.out",
      onComplete: () => spark.destroy(),
    });
  }
}

function buildSuccess(
  scene: Phaser.Scene,
  root: Phaser.GameObjects.Container,
  vm: Extract<WingCraftResultVM, { kind: "success" }>,
  cx: number,
  cardTop: number,
): void {
  const icon = makeFitIcon(scene, cx, cardTop + 70, vm.iconKey, 96, vm.emoji);
  icon.setScale(0);
  root.add(icon);
  popIn(scene, icon);

  const plate = scene.add.container(0, 0);
  root.add(plate);
  addNamePlate(scene, plate, vm.name, {
    width: CARD_W - 40,
    topY: cardTop + 122,
    height: 26,
    radius: 8,
    accent: vm.color,
    color: COLORS.text,
  });

  const badge = crispText(scene, cx, cardTop + 152, vm.rarity, {
    fontSize: "13px",
    color: hex(vm.color),
  }).setOrigin(0.5);
  root.add(badge);

  let y = cardTop + 178;
  for (const r of vm.statRows.slice(0, 8)) {
    const line = `${r.before}${r.value}${r.after}${r.bonus ? " " + r.bonus : ""}`;
    const t = crispText(scene, cx - (CARD_W - 50) / 2, y, line, {
      fontSize: "12px",
      color: r.source === "base" ? SOURCE_COLOR.base : SOURCE_COLOR[r.source],
    }).setOrigin(0, 0.5);
    // tint the embedded value by roll quality for base/primary rows
    void QUALITY_COLOR; // quality coloring reserved; single-color line keeps it simple
    root.add(t);
    y += 22;
  }
}

function buildFailure(
  scene: Phaser.Scene,
  root: Phaser.GameObjects.Container,
  cx: number,
  cardTop: number,
): void {
  const glyph = crispText(scene, cx, cardTop + 64, "💔", { fontSize: "56px" }).setOrigin(0.5);
  glyph.setScale(0);
  root.add(glyph);
  popIn(scene, glyph);

  const ashes = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  root.add(ashes);

  const title = crispText(scene, cx, cardTop + 128, "The wings dissolved into chaos…", {
    fontSize: "15px",
    color: hex(0xb0464b),
    align: "center",
    wordWrap: { width: CARD_W - 40 },
  }).setOrigin(0.5);
  root.add(title);

  const sub = crispText(scene, cx, cardTop + 164, "Your materials were consumed.", {
    fontSize: "12px",
    color: COLORS.sub,
    align: "center",
  }).setOrigin(0.5);
  root.add(sub);
}

function hex(n: number): string {
  return "#" + n.toString(16).padStart(6, "0");
}
```

NOTE: confirm the exact `button` / `accentPanel` / `crispText` / `addNamePlate` /
`makeFitIcon` signatures against their source while implementing (Step 1 read);
adjust option keys to match. If the file approaches 500 lines, move `buildGlow` +
`openBurst` into a sibling `wingCraftResultFx.ts` and import them.

- [ ] **Step 3: Type-check the new file**

Run: `npx tsc --noEmit`
Expected: no errors referencing `wingCraftResultOverlay.ts`. Fix signature
mismatches (option key names, return types) until clean.

- [ ] **Step 4: Lint (file-size + style)**

Run: `npm run lint`
Expected: no NEW errors in `wingCraftResultOverlay.ts`; in particular no
`max-lines` error (must stay < 500 code lines). Split into `wingCraftResultFx.ts`
if needed.

- [ ] **Step 5: Commit**

```bash
git add src/scenes/wingCraftResultOverlay.ts
git commit -m "feat(forge): wing-craft result reveal overlay presenter

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Wire the overlay into ForgeScene + verify

**Files:**
- Modify: `src/scenes/ForgeScene.ts` (imports + confirm handler, around lines 25 and 266-279)

- [ ] **Step 1: Add imports**

In `src/scenes/ForgeScene.ts`, after the existing `openWingCraftDialog` import,
add:

```ts
import { openWingCraftResultOverlay } from "./wingCraftResultOverlay.ts";
import { wingCraftResultView } from "../core/wingCraftResultView.ts";
```

- [ ] **Step 2: Replace the confirm handler's result feedback**

Replace the existing confirm body:

```ts
      confirm: (selectedIds, j) => {
        const r = this.mgr.craftWings(selectedIds, j);
        if (!r.ok) {
          this.showToast("Craft failed — check materials.");
          return;
        }
        playForgeFx(this, W / 2, this.scale.height / 2, forgeFxSpec("wings", !!r.success));
        if (r.success && r.item) {
          this.showToast(`✦ Forged ${ITEM_CATALOG_MAP.get(r.item.defId)?.name ?? "Wings"}!`);
        } else {
          this.showToast("The wings dissolved into chaos…");
        }
        dialog.destroy();
        this.rebuild();
      },
```

with:

```ts
      confirm: (selectedIds, j) => {
        const r = this.mgr.craftWings(selectedIds, j);
        if (!r.ok) {
          this.showToast("Craft failed — check materials.");
          return;
        }
        playForgeFx(this, W / 2, this.scale.height / 2, forgeFxSpec("wings", !!r.success));
        dialog.destroy();
        openWingCraftResultOverlay(this, wingCraftResultView(r), () => this.rebuild());
      },
```

- [ ] **Step 3: Prune the now-unused import if needed**

If `ITEM_CATALOG_MAP` is no longer referenced anywhere else in `ForgeScene.ts`,
remove it from the import on line 25. Check first:

Run: `grep -n "ITEM_CATALOG_MAP" src/scenes/ForgeScene.ts`
If the only hit was the line you deleted, drop the import; otherwise keep it.

- [ ] **Step 4: Type-check + lint + full test suite**

Run: `npx tsc --noEmit && npm run lint && npx vitest run`
Expected: tsc clean; lint reports no NEW errors (the pre-existing
`scripts/playtest/repro_achievement_icons.mjs` `no-useless-assignment` error is
unrelated); all tests pass (including the 5 new VM tests).

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: `tsc --noEmit && vite build` both succeed.

- [ ] **Step 6: Cycle guard**

Run: `npm run lint:cycles`
Expected: 0 runtime cycles.

- [ ] **Step 7: Live playtest**

Start the dev server and drive the game via CDP (`window.__game`) per
`reference_playtest_and_art`: open Forge → Craft Wings, select 5+ items + a
Feather + a Jewel, craft repeatedly until BOTH a success and a failure are
observed. Confirm:
- Success shows the wing icon, rarity-tinted name-plate, rarity badge, and stat
  lines, with a glow + burst, and Claim dismisses + refreshes the grid.
- Failure shows the 💔 + "dissolved into chaos…" beat, and Close dismisses +
  refreshes.
- No console errors; overlay sits above the forge particle burst.

If materials are unavailable in the save, grant them via the debug hooks the same
way other playtests seed state, or temporarily craft from a save that has them.

- [ ] **Step 8: Commit**

```bash
git add src/scenes/ForgeScene.ts
git commit -m "feat(forge): show result reveal overlay after Craft Wings

Replaces the bare success/failure toast with a reveal of the minted wing
(icon + name + rarity + stat lines) or a 'dissolved into chaos' failure beat.
rebuild() moves into the overlay's dismiss callback.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review Notes

- **Spec coverage:** Task 1 = pure VM (success/failure, name/rarity/color/icon/
  statRows). Task 2 = overlay (glow/burst/card/name-plate/badge/stat lines +
  failure beat). Task 3 = wiring (lead-in FX kept, toast replaced, rebuild on
  dismiss) + full verify + playtest. All spec sections covered.
- **Type consistency:** `WingCraftResultVM` defined in Task 1 is consumed
  unchanged in Tasks 2–3; `wingCraftResultView` and `openWingCraftResultOverlay`
  names are stable across tasks.
- **Risk — file size:** Task 2 Steps 4 explicitly checks `max-lines`; split path
  (`wingCraftResultFx.ts`) is pre-authorized.
- **Known caveat:** `ItemStatRow` quality-coloring of the embedded value is
  simplified to a single source color per line to keep the overlay compact; full
  per-segment coloring is intentionally out of scope (matches tooltip *content*,
  not its exact multi-color styling).
