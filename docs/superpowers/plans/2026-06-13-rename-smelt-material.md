# Rename Smelt Material (Jewel of Chaos → Jewel of Entropy) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the player-facing name of the smelt/reforge material from "Jewel of Chaos" to "Jewel of Entropy" (short label "Entropy"), freeing the name "Jewel of Chaos" for a future feature — without any save migration or art change.

**Architecture:** Display-only rename. The save id `chaos-jewel`, the `CHAOS_JEWEL` constant, the `icon: "chaos"` key, the crimson icon art, and the numeric `chaos` field all stay UNCHANGED (they are invisible to players and renaming the id would orphan existing player stacks). Only player-visible strings and a few naming doc-comments change.

**Tech Stack:** TypeScript, Vitest, Phaser. Spec: `docs/superpowers/specs/2026-06-13-rename-smelt-material-design.md`.

---

### Task 1: Guard test pins the new name (TDD RED)

**Files:**
- Create: `tests/materialName.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { MATERIALS, MATERIALS_MAP, CHAOS_JEWEL } from "../src/data/materials.ts";

describe("smelt material name", () => {
  it("the smelt/reforge material is named Jewel of Entropy", () => {
    expect(MATERIALS_MAP.get(CHAOS_JEWEL)!.name).toBe("Jewel of Entropy");
  });

  it('no material is named "Jewel of Chaos" — the name is free for reuse', () => {
    expect(MATERIALS.some((m) => m.name === "Jewel of Chaos")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/materialName.test.ts`
Expected: FAIL — current name is still "Jewel of Chaos" (first assertion fails, second fails).

- [ ] **Step 3: (no impl yet — Task 2 makes it pass)**

### Task 2: Rename the material display name (TDD GREEN)

**Files:**
- Modify: `src/data/materials.ts:66`

- [ ] **Step 1: Change the name**

In `src/data/materials.ts`, in the `CHAOS_JEWEL` entry, change:

```ts
    name: "Jewel of Chaos",
```

to:

```ts
    name: "Jewel of Entropy",
```

Leave `id: CHAOS_JEWEL`, `icon: "chaos"`, and the `description` exactly as-is (the description has no "chaos" word).

- [ ] **Step 2: Run the guard test to verify it passes**

Run: `npx vitest run tests/materialName.test.ts`
Expected: PASS (both assertions).

- [ ] **Step 3: Commit**

```bash
git add src/data/materials.ts tests/materialName.test.ts
git commit -m "feat(materials): rename smelt material to Jewel of Entropy

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 3: Update player-facing strings in ShopScene

**Files:**
- Modify: `src/scenes/ShopScene.ts` (lines ~3, ~33, ~427, ~480, ~493, ~520)

- [ ] **Step 1: Update the four player-visible "Chaos" strings**

Make these exact replacements (the `❖ ${...}` counters with no trailing word are left untouched):

1. `Recycled ${r.count} items → ❖ ${r.chaos} Chaos` → replace trailing `Chaos` with `Entropy`:
```ts
          r.count > 0 ? `Recycled ${r.count} items → ❖ ${r.chaos} Entropy` : "Nothing to recycle",
```

2. The Smelt button label:
```ts
    const smelt = crispText(this, W / 2, by + 66, `🔨 Smelt  →  ❖ ${chaos} Entropy`, {
```

3. The smelt-success flash:
```ts
      this.flash(r.ok ? `Smelted → ❖ ${r.chaos} Entropy` : "Couldn't smelt", r.ok);
```

4. The reforge shortfall flash:
```ts
          this.flash("Not enough gold or entropy", false);
```

- [ ] **Step 2: Update the two naming doc-comments (accuracy only)**

Header comment (line ~3): change `destroy → Jewels of Chaos, the` to `destroy → Jewels of Entropy, the`.

`CHAOS_COL` comment (line ~33): change `// crimson-magenta — matches the Jewel of Chaos icon` to `// crimson-magenta — matches the Jewel of Entropy icon`.

(Leave the `CHAOS_COL` and `CHAOS_JEWEL` identifiers, and the `chaos` local variables, unchanged.)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

### Task 4: Update the auto-recycle dialog preview line

**Files:**
- Modify: `src/scenes/autoRecycleDialog.ts:108`

- [ ] **Step 1: Update the preview string**

Change:
```ts
    previewText.setText(`Smelt ${p.count} item${p.count === 1 ? "" : "s"}  →  ❖ ${p.chaos} Chaos`);
```
to use `Entropy` as the trailing word:
```ts
    previewText.setText(`Smelt ${p.count} item${p.count === 1 ? "" : "s"}  →  ❖ ${p.chaos} Entropy`);
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

### Task 5: Update smelt/reforge doc-comments naming the material

**Files:**
- Modify: `src/core/smelt.ts:2`
- Modify: `src/core/reforge.ts:2`

- [ ] **Step 1: smelt.ts header comment**

Change `Smelt — recycle gear into Jewel of Chaos (the Reforge material).` to `Smelt — recycle gear into Jewel of Entropy (the Reforge material).`

- [ ] **Step 2: reforge.ts header comment**

Change `Reforge — re-roll a Rare+ item's affixes for gold + Jewel of Chaos.` to `Reforge — re-roll a Rare+ item's affixes for gold + Jewel of Entropy.`

(Leave all code — `chaos` fields, `CHAOS_JEWEL`, costs — unchanged.)

- [ ] **Step 3: Commit**

```bash
git add src/scenes/ShopScene.ts src/scenes/autoRecycleDialog.ts src/core/smelt.ts src/core/reforge.ts
git commit -m "feat(ui): show smelt material as Entropy across shop + recycle

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 6: Verify whole + grep proof

**Files:** none (verification only)

- [ ] **Step 1: Full typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Full test suite**

Run: `npx vitest run`
Expected: all green, including `tests/materialName.test.ts`, `tests/smelt.test.ts`, `tests/reforge.test.ts`, `tests/materialIcons.test.ts`.

- [ ] **Step 3: Lint touched files**

Run: `npx eslint src/data/materials.ts src/scenes/ShopScene.ts src/scenes/autoRecycleDialog.ts src/core/smelt.ts src/core/reforge.ts`
Expected: clean.

- [ ] **Step 4: Grep proof — no player-facing "Jewel of Chaos" / " Chaos" remains**

Run: `rg -n "Jewel of Chaos|\bChaos\b" src/`
Expected: ZERO matches in `src/` (the `chaos-jewel` id, `CHAOS_JEWEL`, `CHAOS_COL`, and lowercase `chaos` field names are all intentionally retained and do NOT match this pattern).

---

## Notes

- **No `ASSET_VERSION` bump** — no art changed.
- **Do NOT stage** the protected out-of-scope dirty files (tower sprite `.json`/`.png`, `src/data/spriteManifest.ts`, `src/core/gacha.ts`, `scripts/sdart/*`, the `.claude/scheduled_tasks.lock` deletion). Stage only the files named in each commit.
