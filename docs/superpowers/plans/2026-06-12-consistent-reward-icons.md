# Consistent Reward Icons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Lucky Spin reel render the same real reward textures (gold/diamond/material/jewel) that every other loot surface shows, via one shared reward→icon resolver, so identical rewards look identical across screens.

**Architecture:** Extract the per-kind `{iconKey, emoji, color}` mapping currently inlined in `src/data/rewardTiles.ts` into a new pure module `src/data/rewardIcon.ts` (the single source of truth). `rewardTiles` consumes it (its tile output is unchanged, guarded by `tests/rewardPanel.test.ts`). Add `rewardPrimaryIcon(reward)` for single-icon callers. The spin reel (`src/scenes/spinReel.ts`) renders the resolved texture through the existing `makeFitIcon` helper, falling back to the resolver's emoji when a texture is missing.

**Tech Stack:** TypeScript, Phaser 3, Vitest. Pure data modules under `src/data/`, scene glue under `src/scenes/`.

---

### Task 1: Pure reward-icon resolver (`rewardIcon.ts`)

**Files:**
- Create: `src/data/rewardIcon.ts`
- Test: `tests/rewardIcon.test.ts`

Reference values (must match the current `rewardTiles.ts` exactly so the panel is unchanged):
- `RARITY_INT`: Common `0x9e9e9e`, Magic `0x2196f3`, Rare `0x9c27b0`, Legendary `0xff9800`, Unique `0xf44336`
- `GOLD_INT = 0xffcf4d`, `DIAMOND_INT = 0x7ec8ff`, `MAT_INT = 0xa5d6a7`, `XP_INT = 0x9cc6ff`
- `RARITY_ORDER = ["Common","Magic","Rare","Legendary","Unique"]`
- Box materials (`def.kind === "box"`) → `box__<id>` + `RARITY_INT[RARITY_ORDER[def.rarity-1]]`; other materials → `material__<id>` + `MAT_INT`.

- [ ] **Step 1: Write the failing test**

Create `tests/rewardIcon.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  goldIcon, diamondIcon, xpIcon, itemIcon, jewelIcon, materialIcon, rewardPrimaryIcon,
  RARITY_INT, GOLD_INT, DIAMOND_INT, MAT_INT,
} from "../src/data/rewardIcon.ts";
import { SPIN_WHEEL } from "../src/core/spin.ts";
import { battleLootTiles } from "../src/data/rewardTiles.ts";
import type { Reward } from "../src/core/rewards.ts";

describe("per-kind icon resolvers", () => {
  it("gold/diamond/xp use the shared UI icon keys", () => {
    expect(goldIcon()).toEqual({ iconKey: "icon__gold", emoji: "🪙", color: GOLD_INT });
    expect(diamondIcon()).toEqual({ iconKey: "icon__gem", emoji: "💎", color: DIAMOND_INT });
    expect(xpIcon().iconKey).toBe("icon__xp");
  });

  it("item/jewel keys follow the texture convention with rarity color", () => {
    expect(itemIcon("Legendary", "dawnbreaker")).toEqual({ iconKey: "item__dawnbreaker", emoji: "📦", color: RARITY_INT.Legendary });
    expect(jewelIcon("Rare", "ruby")).toEqual({ iconKey: "jewel__ruby", emoji: "💠", color: RARITY_INT.Rare });
  });

  it("non-box material → material__<id> + MAT color", () => {
    expect(materialIcon("bless-jewel")).toEqual({ iconKey: "material__bless-jewel", emoji: "💠", color: MAT_INT });
  });
});

describe("rewardPrimaryIcon", () => {
  it("picks the single salient icon by kind", () => {
    expect(rewardPrimaryIcon({ gold: 200 }).iconKey).toBe("icon__gold");
    expect(rewardPrimaryIcon({ diamonds: 15 }).iconKey).toBe("icon__gem");
    expect(rewardPrimaryIcon({ materials: { "soul-jewel": 1 } }).iconKey).toBe("material__soul-jewel");
  });

  it("ranks a material/box bundle above bare currency and returns sparkle for empty", () => {
    expect(rewardPrimaryIcon({ gold: 5, materials: { "soul-jewel": 1 } }).iconKey).toBe("material__soul-jewel");
    expect(rewardPrimaryIcon({}).emoji).toBe("✨");
    expect(rewardPrimaryIcon({ materials: { "soul-jewel": 0 } }).iconKey).toBe(""); // zero-count ignored → empty bundle
  });

  // Anti-drift guard: the spin and the post-battle panel must agree on every wheel prize.
  it("agrees with the reward panel's iconKey for every SPIN_WHEEL prize", () => {
    for (const prize of SPIN_WHEEL) {
      const reward: Reward = prize.reward;
      const summary = {
        outcome: "won" as const, isFirstClear: false, xp: 0, gold: reward.gold ?? 0,
        diamonds: reward.diamonds ?? 0, items: [], jewels: [], skills: [], characters: [],
        materials: reward.materials ?? {},
      };
      const panelKeys = battleLootTiles(summary).map((t) => t.iconKey);
      expect(panelKeys).toContain(rewardPrimaryIcon(reward).iconKey);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/rewardIcon.test.ts`
Expected: FAIL — `Cannot find module '../src/data/rewardIcon.ts'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/data/rewardIcon.ts`:

```ts
// src/data/rewardIcon.ts
//
// THE single source of truth mapping a reward (or one of its components) to its
// on-screen icon: { iconKey, emoji, color }. Both the post-battle reward panel
// (via rewardTiles.ts) and the Lucky Spin reel (spinReel.ts) consume these so a
// given reward looks identical everywhere — real texture when loaded, emoji
// fallback when not. Phaser-free so it is unit-testable.
import type { Reward } from "../core/rewards.ts";
import type { Rarity } from "./schema.ts";
import { MATERIALS_MAP } from "./materials.ts";

export interface RewardIconView {
  /** Texture key to draw when loaded (e.g. "material__soul-jewel"). "" = no texture. */
  iconKey: string;
  /** Emoji fallback when the texture is missing. */
  emoji: string;
  /** Frame / accent color (hex int). */
  color: number;
}

export const RARITY_ORDER: Rarity[] = ["Common", "Magic", "Rare", "Legendary", "Unique"];
export const RARITY_INT: Record<Rarity, number> = {
  Common: 0x9e9e9e, Magic: 0x2196f3, Rare: 0x9c27b0, Legendary: 0xff9800, Unique: 0xf44336,
};
export const GOLD_INT = 0xffcf4d, DIAMOND_INT = 0x7ec8ff, MAT_INT = 0xa5d6a7, XP_INT = 0x9cc6ff;

export function goldIcon(): RewardIconView { return { iconKey: "icon__gold", emoji: "🪙", color: GOLD_INT }; }
export function diamondIcon(): RewardIconView { return { iconKey: "icon__gem", emoji: "💎", color: DIAMOND_INT }; }
export function xpIcon(): RewardIconView { return { iconKey: "icon__xp", emoji: "⭐", color: XP_INT }; }

export function itemIcon(rarity: Rarity, defId: string): RewardIconView {
  return { iconKey: `item__${defId}`, emoji: "📦", color: RARITY_INT[rarity] };
}
export function jewelIcon(rarity: Rarity, defId: string): RewardIconView {
  return { iconKey: `jewel__${defId}`, emoji: "💠", color: RARITY_INT[rarity] };
}

/** Material or boss-box icon. Boxes ship a box__<id> texture + rarity color; other materials use material__<id>. */
export function materialIcon(id: string): RewardIconView {
  const def = MATERIALS_MAP.get(id);
  if (def?.kind === "box") {
    const rarity = RARITY_ORDER[(def.rarity ?? 1) - 1] ?? "Common";
    return { iconKey: `box__${id}`, emoji: "🎁", color: RARITY_INT[rarity] };
  }
  return { iconKey: `material__${id}`, emoji: "💠", color: MAT_INT };
}

/** Salience rank for picking the dominant material in a bundle. Boxes rank by rarity tier; others mid. */
function materialRank(id: string): number {
  const def = MATERIALS_MAP.get(id);
  if (def?.kind === "box") return 10 + (def.rarity ?? 1);
  return 5;
}

const SPARKLE: RewardIconView = { iconKey: "", emoji: "✨", color: MAT_INT };

/**
 * The single most salient icon for a reward bundle, for callers that show ONE
 * icon (the spin reel cell, a one-line toast). Priority: rarest material/box >
 * diamonds > gold. Returns a sparkle for an empty bundle.
 */
export function rewardPrimaryIcon(reward: Reward): RewardIconView {
  const mats = reward.materials ?? {};
  const ids = Object.keys(mats).filter((id) => (mats[id] ?? 0) > 0);
  if (ids.length) {
    const best = ids.reduce((a, b) => (materialRank(b) > materialRank(a) ? b : a));
    return materialIcon(best);
  }
  if (reward.diamonds) return diamondIcon();
  if (reward.gold) return goldIcon();
  return SPARKLE;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/rewardIcon.test.ts`
Expected: PASS (all assertions). If the anti-drift test fails, the bundle→key logic here disagrees with `rewardTiles` — reconcile here, not in the test.

- [ ] **Step 5: Commit**

```bash
git add src/data/rewardIcon.ts tests/rewardIcon.test.ts
git commit -m "feat(icons): pure reward→icon resolver (single source of truth)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Refactor `rewardTiles.ts` to consume the shared resolver (no output change)

**Files:**
- Modify: `src/data/rewardTiles.ts`
- Test (regression, must stay green): `tests/rewardPanel.test.ts`

This is a pure DRY refactor: the tile builders keep their tooltip/label logic but get their `iconKey`/`emoji`/`color` from `rewardIcon.ts`. The visible output is identical, so `tests/rewardPanel.test.ts` is the guard.

- [ ] **Step 1: Run the existing panel tests to capture the green baseline**

Run: `npx vitest run tests/rewardPanel.test.ts`
Expected: PASS (baseline before refactor).

- [ ] **Step 2: Replace the local color constants + per-kind icon fields with imports**

In `src/data/rewardTiles.ts`:

a) Replace the local `RARITY_INT`, `GOLD_INT/DIAMOND_INT/MAT_INT/XP_INT`, and `RARITY_ORDER` definitions. Delete these lines:

```ts
const RARITY_ORDER: Rarity[] = ["Common", "Magic", "Rare", "Legendary", "Unique"];
const RARITY_INT: Record<Rarity, number> = {
  Common: 0x9e9e9e, Magic: 0x2196f3, Rare: 0x9c27b0, Legendary: 0xff9800, Unique: 0xf44336,
};
export const GOLD_INT = 0xffcf4d, DIAMOND_INT = 0x7ec8ff, MAT_INT = 0xa5d6a7, XP_INT = 0x9cc6ff;
```

and add, next to the other imports:

```ts
import {
  goldIcon, diamondIcon, xpIcon, itemIcon, jewelIcon, materialIcon,
  RARITY_INT, GOLD_INT, DIAMOND_INT, MAT_INT, XP_INT,
} from "./rewardIcon.ts";
```

Keep the existing local `RARITY_HEX` (used only by tooltips) and re-export the color ints for any external caller:

```ts
export { GOLD_INT, DIAMOND_INT, MAT_INT, XP_INT };
```

b) Rewrite the four currency/xp builders to source their icon fields from the resolver (tooltip text unchanged). Example — `goldTile`:

```ts
function goldTile(n: number): RewardTileSpec {
  const v = goldIcon();
  return {
    iconKey: v.iconKey, emoji: v.emoji, label: `+${n}`, color: v.color,
    tooltip: { kind: "info", data: { title: "Gold", titleColor: hex(GOLD_INT), borderColor: GOLD_INT, subtitle: `+${n}`, body: "Everyday currency — spend it in the Shop and on upgrades." } },
  };
}
```

Apply the same pattern to `diamondTile` (`diamondIcon()`) and `xpTile` (`xpIcon()`), reusing the resolver's `iconKey`/`emoji`/`color` and leaving the tooltip strings exactly as they are.

c) Rewrite `itemTile` and `jewelTile` to use the resolver:

```ts
function itemTile(inst: ItemInstanceSave): RewardTileSpec {
  const def = ITEM_CATALOG_MAP.get(inst.defId);
  const rarity = def?.rarity ?? "Common";
  const v = itemIcon(rarity, inst.defId);
  return { iconKey: v.iconKey, emoji: v.emoji, label: rarity, color: v.color, tooltip: { kind: "item", inst } };
}

function jewelTile(inst: JewelInstanceSave): RewardTileSpec {
  const def = JEWEL_CATALOG_MAP.get(inst.defId);
  const rarity = def?.rarity ?? "Common";
  const v = jewelIcon(rarity, inst.defId);
  return {
    iconKey: v.iconKey, emoji: v.emoji, label: rarity, color: v.color,
    tooltip: { kind: "info", data: { title: def?.name ?? "Jewel", titleColor: RARITY_HEX[rarity], borderColor: v.color, subtitle: `${rarity} Jewel`, body: def?.description } },
  };
}
```

d) Rewrite `materialTile` to use the resolver for the icon + color (keeping box subtitle/odds body):

```ts
function materialTile(id: string, n: number): RewardTileSpec {
  const def = MATERIALS_MAP.get(id);
  const isBox = def?.kind === "box";
  const v = materialIcon(id);
  const subtitle = isBox ? `Tier ${boxOdds(id).tier} Boss Chest · ×${n}` : `×${n}`;
  const body = isBox ? boxOddsBody(id, def?.description) : def?.description;
  return {
    iconKey: v.iconKey, emoji: v.emoji, label: `×${n}`, color: v.color,
    tooltip: { kind: "info", data: { title: def?.name ?? id, titleColor: hex(v.color), borderColor: v.color, subtitle, body } },
  };
}
```

Note: `skillTile` and `characterTile` keep using `RARITY_INT` (now imported) and `skillIconKey`/`tower__` keys — unchanged. Leave the `import type { Rarity }` line; if `Rarity` becomes unused after removing the local maps, drop it to satisfy `tsc`.

- [ ] **Step 3: Run the panel regression tests**

Run: `npx vitest run tests/rewardPanel.test.ts tests/rewardIcon.test.ts`
Expected: PASS — every `iconKey`/order assertion (`icon__gold`, `icon__gem`, `icon__xp`, `item__<id>`, `jewel__<id>`, `material__bless-jewel`, `box__<id>`) unchanged, and the anti-drift test still green.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (If `Rarity` import is now unused, remove it.)

- [ ] **Step 5: Commit**

```bash
git add src/data/rewardTiles.ts
git commit -m "refactor(icons): rewardTiles sources icons from shared resolver (no output change)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Render real icons on the Lucky Spin reel

**Files:**
- Modify: `src/scenes/spinReel.ts`

The reel cell currently draws a hand-picked emoji (`prizeGlyph`) and an ad-hoc accent (`cellAccent`). Swap to the shared resolver + `makeFitIcon` so each cell shows the real `material__`/`icon__gold`/`icon__gem` texture (emoji fallback when missing). This task is a scene-glue change verified by `tsc` + build + playtest (no unit test — `makeFitIcon` needs a live Phaser texture cache).

- [ ] **Step 1: Update imports**

In `src/scenes/spinReel.ts`, replace the materials import block

```ts
import {
  BLESS_JEWEL, SOUL_JEWEL, SUMMON_SCROLL, AWAKENING_CRYSTAL,
} from "../data/materials.ts";
```

with

```ts
import { rewardPrimaryIcon } from "../data/rewardIcon.ts";
import { makeFitIcon } from "./itemIcon.ts";
```

- [ ] **Step 2: Delete `prizeGlyph` and `cellAccent`**

Remove both helper functions (lines ~28–46): the `prizeGlyph(prize)` emoji switch and the `cellAccent(prize)` color switch. Their roles move into the resolver.

- [ ] **Step 3: Rewrite `buildCell` to draw the resolved texture**

Replace the body of `buildCell` with:

```ts
function buildCell(
  scene: Phaser.Scene, strip: Phaser.GameObjects.Container,
  prize: SpinPrize, cx: number,
): Phaser.GameObjects.Container {
  const view = rewardPrimaryIcon(prize.reward);
  // Rare prizes keep the signature magenta-gold glow; others use the reward's own accent.
  const accent = prize.rare ? 0xff5bd0 : view.color;
  const cell = scene.add.container(cx, 0);
  const g = scene.add.graphics();
  g.fillStyle(0x10151f, 1).fillRoundedRect(-CELL_W / 2, -52, CELL_W, 104, 12);
  g.lineStyle(2, accent, prize.rare ? 1 : 0.6).strokeRoundedRect(-CELL_W / 2, -52, CELL_W, 104, 12);
  cell.add(g);
  cell.add(makeFitIcon(scene, 0, -14, view.iconKey, 56, view.emoji));
  cell.add(crispText(scene, 0, 30, prize.label, {
    fontSize: "12px", color: "#ffe9b0", fontStyle: "bold", align: "center",
    stroke: "#0a0d14", strokeThickness: 3, wordWrap: { width: CELL_W - 12 },
  }).setOrigin(0.5));
  strip.add(cell);
  return cell;
}
```

- [ ] **Step 4: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: no type errors; build succeeds (the pre-existing >500 kB chunk warning is fine). Confirms `BLESS_JEWEL` et al. are no longer referenced (would otherwise be an unused-import error under the strict config) and that `SPIN_WHEEL` / `SpinPrize` are still used by `playSpinReel`.

- [ ] **Step 5: Commit**

```bash
git add src/scenes/spinReel.ts
git commit -m "feat(icons): Lucky Spin reel shows real reward icons, not emoji

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Verify whole + playtest

**Files:** none (verification only).

- [ ] **Step 1: Full typecheck + test suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS — the prior 886 tests plus the new `rewardIcon` tests, 0 failures.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: success (only the known large-chunk warning).

- [ ] **Step 3: Playtest the spin reel via CDP**

Run the project's playtest harness to open the Activities scene and trigger a spin, capturing a screenshot. Use the established `scripts/playtest/snap.sh` with `--scene=` / `--eval=` flags (give the save free diamonds + a free spin, call `spinFree`/`spinPaid` through `window.__game`, and let `playSpinReel` run). Capture `/tmp/spin-icons.png`.

Expected: the reel cells show the real gold/diamond/jewel/scroll textures (not flat emoji), framed in the reward's accent color; 0 runtime exceptions in the page console.

- [ ] **Step 4: Confirm file sizes under the limit**

Run: `wc -l src/data/rewardIcon.ts src/data/rewardTiles.ts src/scenes/spinReel.ts`
Expected: all three well under 500 lines.

- [ ] **Step 5: Update memory**

Add a `project` memory file documenting: `rewardIcon.ts` is the single source of truth for reward→icon (iconKey/emoji/color); `rewardTiles` and `spinReel` both consume it; the anti-drift test guards that the spin and the post-battle panel agree; equipment-item icons were already consistent (audit finding); link `[[project_loot_fly_to_hero]]`. Add the one-line pointer to `MEMORY.md`.

---

## Self-Review

**1. Spec coverage:**
- Spec "Unit 1 — rewardIcon.ts (pure resolver)" → Task 1. ✓
- Spec "Unit 2 — spinReel renders real icons" → Task 3. ✓
- Spec "rewardTiles refactored to consume the shared helpers (DRY, both agree)" → Task 2. ✓
- Spec "Testing: rewardIcon tests + cross-check anti-drift guard + rewardTiles stays green" → Task 1 (resolver + anti-drift), Task 2 (panel regression). ✓
- Spec "Final: tsc, vitest, build, CDP playtest of the spin" → Task 4. ✓
- Spec non-goals (no equipment-icon change, no itemIconKey wing helper, no reward-burst change, no resizing) → respected; no task touches those. ✓

**2. Placeholder scan:** No TBD/TODO/"handle edge cases"/"similar to" — every code step shows full code. ✓

**3. Type consistency:**
- `RewardIconView { iconKey, emoji, color }` defined in Task 1 and used identically in Tasks 2–3. ✓
- Resolver names `goldIcon/diamondIcon/xpIcon/itemIcon/jewelIcon/materialIcon/rewardPrimaryIcon` are consistent across Tasks 1–3. ✓
- `itemIcon(rarity, defId)` / `jewelIcon(rarity, defId)` signatures match their call sites in Task 2. ✓
- `makeFitIcon(scene, x, y, key, fit, fallback)` matches the real signature in `src/scenes/itemIcon.ts`. ✓
- Color constants `GOLD_INT/DIAMOND_INT/MAT_INT/XP_INT/RARITY_INT` moved to `rewardIcon.ts` and imported (+ re-exported) by `rewardTiles.ts`; no external importer relies on them (verified via grep). ✓
