# Tower Role-Icon Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign all 7 tower role-badge emblems for distinct, role-descriptive silhouettes, regenerate them through the SDXL `roleicon` flow, and lock the role→icon assignment behind a coverage test.

**Architecture:** Only the emblem *vocabulary* changes. `scripts/sdart/prompts.mjs`'s `ROLE_VISUAL` is rewritten; the 7 `public/assets/sprites/roleicon/<role>.png` cutouts are regenerated; `ASSET_VERSION` is bumped for cache-busting. No runtime-code change — texture keys (`roleicon__<role>`) are identical, so `roleBadge.ts`, preload, and all renderers keep working. A new test makes the role→prompt mapping total and collision-free.

**Tech Stack:** TypeScript, Vitest, Vite, Phaser 3, SDXL/Z-Image-Turbo art flow (`scripts/sdart/`, `vite-node`).

---

### Task 1: Lock the role→emblem mapping behind a coverage test (TDD RED)

**Files:**
- Create: `tests/roleIconPrompts.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { TOWER_ROLES } from "../src/data/schemaEnums.ts";
import { ROLE_VISUAL } from "../scripts/sdart/prompts.mjs";

describe("role-icon emblem prompts", () => {
  it("defines exactly one emblem per TowerRole (none missing, none dead)", () => {
    const promptKeys = Object.keys(ROLE_VISUAL).sort();
    const roleKeys = [...TOWER_ROLES].sort();
    expect(promptKeys).toEqual(roleKeys);
  });

  it("gives every role a non-empty emblem description", () => {
    for (const role of TOWER_ROLES) {
      const v = (ROLE_VISUAL as Record<string, string>)[role];
      expect(typeof v).toBe("string");
      expect(v.trim().length).toBeGreaterThan(0);
    }
  });

  it("uses a distinct emblem description for every role (no two icons collide)", () => {
    const values = TOWER_ROLES.map((r) => (ROLE_VISUAL as Record<string, string>)[r]);
    expect(new Set(values).size).toBe(TOWER_ROLES.length);
  });
});
```

- [ ] **Step 2: Run test to verify it passes for existing data, OR fails only where intended**

Run: `npx vitest run tests/roleIconPrompts.test.ts`
Expected: PASS (the current `ROLE_VISUAL` already covers all 7 roles distinctly). This test is a **guard** — it must be green before and after the redesign. If it does not import (e.g. `.mjs` resolution), that is the RED to fix in Step 3.

- [ ] **Step 3: If the `.mjs` import fails, confirm vitest resolves it**

`scripts/sdart/prompts.mjs` is plain ESM exporting `ROLE_VISUAL`. Vitest resolves `.mjs` by default. No code change expected; if resolution fails, add no shim — instead import via the relative path exactly as written above. Re-run Step 2.

- [ ] **Step 4: Commit**

```bash
git add tests/roleIconPrompts.test.ts
git commit -m "test(roleicon): guard role->emblem mapping is total + collision-free

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Rewrite the emblem vocabulary (ROLE_VISUAL)

**Files:**
- Modify: `scripts/sdart/prompts.mjs` (the `ROLE_VISUAL` object, ~line 250)

- [ ] **Step 1: Replace the `ROLE_VISUAL` body with the redesigned descriptions**

```javascript
export const ROLE_VISUAL = {
  damage:
    "one bold targeting crosshair scope reticle, a thick ring crossed by four short tick marks with a small solid center dot, sky-blue",
  splash:
    "one bold spiky explosion burst, a solid star-shaped blast with sharp radiating shards, coral orange",
  chain:
    "one bold forked lightning bolt splitting into two jagged zigzag prongs, violet purple",
  dot: "one bold venom poison droplet teardrop with a tiny rising bubble and a small drip below, toxic green",
  support: "one bold thick solid upward pointing arrow rising, warm gold",
  debuff: "one bold thick solid downward pointing arrow falling, teal cyan",
  tanker:
    "one bold sturdy knight heater shield with a small round center boss stud, steel grey",
};
```

- [ ] **Step 2: Run the guard test — still green after the rewrite**

Run: `npx vitest run tests/roleIconPrompts.test.ts`
Expected: PASS (7 roles, all present, all distinct).

- [ ] **Step 3: Commit**

```bash
git add scripts/sdart/prompts.mjs
git commit -m "art(roleicon): redesign emblem vocabulary for distinct role-descriptive icons

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Regenerate the 7 emblem PNGs via SDXL

**Files:**
- Modify (regenerated binaries): `public/assets/sprites/roleicon/{damage,splash,chain,dot,support,debuff,tanker}.png`

- [ ] **Step 1: Confirm the SDXL HTTP API is reachable**

The art flow needs the local Z-Image-Turbo server (per `scripts/sdart/`). Verify it responds before generating; if it is down, start it per the project's art-pipeline convention.

- [ ] **Step 2: Regenerate only the role icons**

Run: `npm run gen:sprites -- --only=roleicon`
Expected: 7 jobs run (one per role), each writing `public/assets/sprites/roleicon/<role>.png` (768→64 px, transparent cutout).

- [ ] **Step 3: Inspect the output**

Open each PNG (or build a contact sheet). Each emblem must read at ~16 px as its intended shape and be the right tint family. If any is muddy/illegible, re-run just that role by temporarily narrowing the job (or tweak its `ROLE_VISUAL` string and regen) until clean.

- [ ] **Step 4: Commit the regenerated art**

```bash
git add public/assets/sprites/roleicon/
git commit -m "art(roleicon): regenerate 7 redesigned role emblems (SDXL)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Bump ASSET_VERSION for cache-busting

**Files:**
- Modify: `src/data/assetVersion.ts:17`

- [ ] **Step 1: Bump the token**

Change `export const ASSET_VERSION = "2026-06-14e";` to the next token in sequence, e.g. `"2026-06-14f"`.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/data/assetVersion.ts
git commit -m "chore(assets): bump ASSET_VERSION for role-emblem regen

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Full verification + live playtest

**Files:** none (verification only)

- [ ] **Step 1: Run the full suite**

Run: `npx vitest run`
Expected: all tests green (new guard + existing `roleBadge`, `assetKeys`, `assetKeyDiscipline`).

- [ ] **Step 2: Lint + build**

Run: `npx eslint . && npx vite build`
Expected: eslint exit 0; build clean (chunk-size advisory is benign).

- [ ] **Step 3: Live role-icon playtest**

Start the dev server + headless Chrome (CDP on 9222) per the project convention, then:
Run: `node scripts/playtest/repro_role_icons.mjs --shot=/tmp/role_icons_redesign.png`
Expected: `VERDICT: PASS` — all 7 roleicon textures load, every build-bar card carries its `roleicon__<role>` emblem. Review the screenshot to confirm the new emblems are legible and correctly assigned per card.

- [ ] **Step 4: Send the screenshot to the chat for visual confirmation**

Emit `[[send: /tmp/role_icons_redesign.png]]`.

- [ ] **Step 5: Update memory**

Append a note to the `role_icons` memory recording the 2026-06-14 emblem redesign (sword→crosshair on `damage`; sharpened splash/chain/dot; support/debuff up/down mirror; `ASSET_VERSION` bumped).

- [ ] **Step 6: Final clean-tree check**

Run: `git status`
Expected: clean working tree; all changes committed across Tasks 1-4.

---

## Self-Review

**Spec coverage:** ROLE_VISUAL rewrite (Task 2), regen (Task 3), ASSET_VERSION bump (Task 4), coverage test (Task 1), verification incl. playtest (Task 5) — every spec section maps to a task. No runtime-code change required (spec §Architecture point 4), so no task touches `roleBadge.ts` — correct.

**Placeholder scan:** No TBD/TODO; all code shown in full; commands explicit.

**Type consistency:** Test imports `TOWER_ROLES` from `schemaEnums.ts` (verified export) and `ROLE_VISUAL` from `prompts.mjs` (verified export). Texture keys unchanged, so no signature drift.
