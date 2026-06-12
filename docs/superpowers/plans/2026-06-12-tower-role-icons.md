# Tower Role Icons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the generic sword/arrow tower badge with a distinct, SDXL-generated emblem per `TowerRole` so a tower's role is readable at a glance.

**Architecture:** A new SDXL `roleicon` art kind generates 7 flat emblems (one per role). A pure `roleBadge.ts` helper maps role→texture-key + owns badge geometry. `PreloadScene` loads the emblems; `BattleScene` renders them as managed per-tower `Image`s (mirroring `towerSprites`), keeping the immediate-mode dark disc + kind-colored ring as the frame and falling back to the legacy sword/arrow glyph when the emblem texture is absent.

**Tech Stack:** TypeScript (strict ESM, explicit `.ts` specifiers), Phaser 3, Vitest, the `scripts/sdart/` SDXL pipeline (Node + python3 cutout).

---

### Task 1: Asset key + discipline for `roleicon`

**Files:**
- Modify: `src/data/assetKeys.ts`
- Test: `tests/assetKeys.test.ts`, `tests/assetKeyDiscipline.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `tests/assetKeys.test.ts` (in the same describe block as the other `*Tex` cases):

```ts
import { roleTex } from "../src/data/assetKeys.ts";

it("builds role-icon keys", () => {
  expect(roleTex("splash")).toBe("roleicon__splash");
  expect(roleTex("tanker")).toBe("roleicon__tanker");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/assetKeys.test.ts`
Expected: FAIL — `roleTex` is not exported.

- [ ] **Step 3: Implement**

In `src/data/assetKeys.ts`, after the `structureTex` line (28):

```ts
/** Per-role tower badge emblem (damage, splash, chain, …). */
export const roleTex = (role: string): string => `roleicon__${role}`;
```

In `tests/assetKeyDiscipline.test.ts` extend the namespace alternation regex to include `roleicon` (find the `(item|tower|jewel|material|box|skill|menu|fx|structure)__\$\{` group and add `|roleicon`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/assetKeys.test.ts tests/assetKeyDiscipline.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/assetKeys.ts tests/assetKeys.test.ts tests/assetKeyDiscipline.test.ts
git commit -m "feat(role-icons): roleTex asset key + discipline coverage"
```

---

### Task 2: Pure `roleBadge.ts` helper (role→key + geometry)

**Files:**
- Create: `src/scenes/roleBadge.ts`
- Test: `tests/roleBadge.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/roleBadge.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { TOWER_ROLES } from "../src/data/schemaEnums.ts";
import { roleBadgeTex, ROLE_BADGE } from "../src/scenes/roleBadge.ts";

describe("roleBadge", () => {
  it("maps every role to a distinct roleicon key", () => {
    const keys = TOWER_ROLES.map(roleBadgeTex);
    expect(new Set(keys).size).toBe(TOWER_ROLES.length);
    for (const k of keys) expect(k).toMatch(/^roleicon__/);
  });

  it("uses the asset-key registry", () => {
    expect(roleBadgeTex("chain")).toBe("roleicon__chain");
  });

  it("exposes sane badge geometry", () => {
    expect(ROLE_BADGE.diameter).toBeGreaterThan(0);
    expect(ROLE_BADGE.offsetX).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/roleBadge.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/scenes/roleBadge.ts`:

```ts
/**
 * Pure (Phaser-free) helpers for the per-tower role badge. The badge shows a
 * tower's TowerRole as an SDXL emblem in its upper-right corner. This module is
 * the single source for the role→texture-key mapping and the badge geometry, so
 * the renderer (battleSceneSprites) and tests agree on both.
 */
import type { TowerRole } from "../data/schema.ts";
import { roleTex } from "../data/assetKeys.ts";

/** Texture key for a role's emblem (e.g. "roleicon__splash"). */
export function roleBadgeTex(role: TowerRole): string {
  return roleTex(role);
}

/** Badge placement + size, relative to the tower body center, in world px. */
export const ROLE_BADGE = {
  diameter: 15, // rendered emblem diameter
  offsetX: 13, // right of center (matches the legacy badge x)
  offsetY: -16, // above center (matches the legacy badge y)
} as const;
```

(Confirm `TowerRole` is re-exported from `../data/schema.ts`; the codebase
already imports it from there, e.g. `towerUpgrade.ts`.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/roleBadge.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/scenes/roleBadge.ts tests/roleBadge.test.ts
git commit -m "feat(role-icons): pure roleBadge helper (role->key + geometry)"
```

---

### Task 3: SDXL `roleicon` prompts + jobs

**Files:**
- Modify: `scripts/sdart/prompts.mjs`
- Modify: `scripts/sdart/sdgen.mjs`

No automated test (the SDXL scripts are Node art tooling, not covered by Vitest).
Verification is a dry build of the job list (Step 3).

- [ ] **Step 1: Add prompts**

In `scripts/sdart/prompts.mjs`, before the ITEMS section, add:

```js
// ── ROLE BADGE EMBLEMS ──────────────────────────────────────────────────────
// Flat UI glyphs (not creatures), so they get their own style + negative — the
// character STYLE/NEGATIVE ban "icon/symbol/flat" and demand a full-body figure.
export const ROLE_VISUAL = {
  damage:  "a sharp target reticle crosshair pierced by a single arrowhead, sky-blue",
  splash:  "a bold radiating explosion starburst blast, coral orange",
  chain:   "a forked lightning bolt arcing between two nodes, violet purple",
  dot:     "a single dripping venom droplet with a faint rising bubble, toxic green",
  support: "three upward chevrons rising inside a soft radiant halo ring, warm gold",
  debuff:  "a downward arrow over a cracked hourglass, teal cyan",
  tanker:  "a sturdy heater knight shield with a central boss, steel grey",
};

const ROLEICON_STYLE = "a single flat vector game UI emblem icon of {V}, bold thick clean outline, high contrast, minimal flat cel-shaded, centered, simple iconography, crisp and readable at small size, isolated on a pure plain flat white background, empty background, no text";
const ROLEICON_NEG = "character, person, creature, hero, knight figure, full body, anime girl, realistic, 3d render, photo, complex scene, landscape, multiple objects, busy, gradient background, drop shadow, watermark, text, letters, signature, frame, border";
export const ROLEICON_NEGATIVE = ROLEICON_NEG;
export function roleIconStyle(visual) { return ROLEICON_STYLE.replace("{V}", visual); }
```

- [ ] **Step 2: Wire jobs into the generator**

In `scripts/sdart/sdgen.mjs`, extend the prompts import (the existing
multiline import block) to add:

```js
  ROLE_VISUAL, roleIconStyle, ROLEICON_NEGATIVE,
```

Then in `buildJobs()`, after the `STRUCTURE_VISUAL` loop, add:

```js
  // role badge emblems — one flat icon per TowerRole, transparent-cut to 64px.
  for (const [role, v] of Object.entries(ROLE_VISUAL)) {
    jobs.push({ kind: "roleicon", id: role, file: `${role}.png`, prompt: roleIconStyle(v), seed: seedOf(role), w: 768, h: 768, size: 64, neg: ROLEICON_NEGATIVE });
  }
```

(`sdGenerate` already threads a per-job `neg`, and the `kind`-based output
directory `public/assets/sprites/roleicon/` is created on demand by `mkdirSync`
in `main()`.)

- [ ] **Step 3: Verify the job list builds (dry, no server needed)**

Run:
```bash
node -e "process.argv.push('--only=roleicon'); import('./scripts/sdart/sdgen.mjs').catch(e=>{console.log('expected (no SD server):', e.message)})" 2>&1 | head -5
```
Expected: prints `SD generating 7 sprites` then a gen-failure/connection line
(the SD server may be down). The "7 sprites" line proves the jobs build with no
JS error. If the SD server is up, the 7 PNGs are written — that's fine too.

- [ ] **Step 4: Commit**

```bash
git add scripts/sdart/prompts.mjs scripts/sdart/sdgen.mjs
git commit -m "feat(role-icons): SDXL roleicon kind — 7 per-role emblem jobs"
```

---

### Task 4: Add the `tanker` role color

**Files:**
- Modify: `src/scenes/battleSceneHelpers.ts:61-69` (the `ROLE_COLOR` map)
- Test: `tests/roleBadge.test.ts` (extend)

- [ ] **Step 1: Write the failing test**

Append to `tests/roleBadge.test.ts`:

```ts
import { ROLE_COLOR } from "../src/scenes/battleSceneHelpers.ts";

it("has a color for every TowerRole", () => {
  for (const r of TOWER_ROLES) expect(ROLE_COLOR[r]).toBeTypeOf("number");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/roleBadge.test.ts`
Expected: FAIL — `ROLE_COLOR.tanker` is `undefined` (not a number).

> Note: `battleSceneHelpers.ts` imports Phaser. If importing it in a Vitest
> (node) context throws, instead assert against a Phaser-free copy: this repo's
> tests already import `ROLE_COLOR` only where Phaser is mocked. If the import
> fails, move the `ROLE_COLOR` assertion into an existing test file that already
> imports `battleSceneHelpers` successfully, or guard with the repo's standard
> Phaser test setup. Verify by checking an existing passing test that imports
> from `battleSceneHelpers.ts` before writing this step.

- [ ] **Step 3: Implement**

In `src/scenes/battleSceneHelpers.ts`, add to the `ROLE_COLOR` object:

```ts
  tanker: 0x90a4ae,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/roleBadge.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/scenes/battleSceneHelpers.ts tests/roleBadge.test.ts
git commit -m "feat(role-icons): add tanker role color (steel)"
```

---

### Task 5: Preload role emblems

**Files:**
- Modify: `src/scenes/PreloadScene.ts`

No new unit test (PreloadScene needs a live Phaser loader; covered by the build +
the in-game playtest in Task 8).

- [ ] **Step 1: Implement**

In `src/scenes/PreloadScene.ts`:
- Add `roleTex` to the `assetKeys.ts` import line (line 19).
- Add `import { TOWER_ROLES } from "../data/schemaEnums.ts";` near the other data imports.
- After the castle-image loads (around line 65), add:

```ts
    // Per-role tower badge emblems (SDXL). A missing file degrades to the
    // legacy sword/arrow glyph drawn by BattleScene (no crash).
    for (const r of TOWER_ROLES) {
      this.load.image(roleTex(r), `assets/sprites/roleicon/${r}.png`);
    }
```

- [ ] **Step 2: Verify typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: clean (only the pre-existing chunk-size warning).

- [ ] **Step 3: Commit**

```bash
git add src/scenes/PreloadScene.ts
git commit -m "feat(role-icons): preload per-role badge emblems"
```

---

### Task 6: Render managed role-badge Images

**Files:**
- Modify: `src/scenes/BattleScene.ts` (add `roleBadges` map + clear on reset)
- Modify: `src/scenes/battleSceneSprites.ts` (manage badges in `manageSprites`)
- Modify: `src/scenes/battleSceneRender.ts` (`drawTypeBadge` fallback gating)

No new unit test (rendering needs WebGL; covered by build + playtest). The pure
mapping is already tested in Task 2.

- [ ] **Step 1: Add the badge map + reset**

In `src/scenes/BattleScene.ts`, beside `towerSprites` (line 101):

```ts
  roleBadges = new Map<number, Phaser.GameObjects.Image>();
```

In the same reset block that does `this.towerSprites.clear();` (line ~135), add:

```ts
    this.roleBadges.clear();
```

- [ ] **Step 2: Manage badges alongside tower sprites**

In `src/scenes/battleSceneSprites.ts`, add imports at the top:

```ts
import { roleBadgeTex, ROLE_BADGE } from "./roleBadge.ts";
import { roleTex } from "../data/assetKeys.ts";
import { ROLE_COLOR } from "./battleSceneHelpers.ts";
```

In `manageSprites()`, inside the `for (const t of this.battle.towers)` loop,
right after the existing `this.ensureSprite(this.towerSprites, …)` block (and
still inside `if (s) { … }` is fine, but place it after so it runs even if the
body sprite is absent), add:

```ts
      // Role badge emblem (upper-right). Managed Image; only shown when its
      // SDXL texture is loaded — otherwise BattleScene.drawTypeBadge draws the
      // legacy sword/arrow glyph as a fallback.
      const badgeKey = roleBadgeTex(t.def.role);
      if (this.textures.exists(badgeKey)) {
        let b = this.roleBadges.get(t.uid);
        if (!b) {
          b = this.add.image(0, 0, badgeKey).setDepth(6);
          if (b.height) b.setScale(ROLE_BADGE.diameter / b.height);
          b.setTint(ROLE_COLOR[t.def.role] ?? 0xffffff);
          this.world.add(b);
          this.roleBadges.set(t.uid, b);
        }
        b.setPosition(t.pos.x + ROLE_BADGE.offsetX, t.pos.y + ROLE_BADGE.offsetY);
        b.setAlpha(t.disabledTimer > 0 ? 0.5 : 1);
      }
```

After the tower-sprite cull line (`for (const [uid, s] of this.towerSprites) …`),
add a matching badge cull:

```ts
    for (const [uid, b] of this.roleBadges) if (!seenT.has(uid)) { b.destroy(); this.roleBadges.delete(uid); }
```

(Use the same `seenT` set the tower-sprite cull uses — it is populated earlier in
the same loop via `seenT.add(t.uid)`. Ensure `seenT.add(t.uid)` runs for every
living tower even when its body sprite is null: add `seenT.add(t.uid);` at the
top of the loop body, right after the `if (!t.alive) continue;` guard, if it is
not already unconditional.)

- [ ] **Step 3: Gate the legacy glyph fallback**

In `src/scenes/battleSceneRender.ts`, `drawTypeBadge` (line ~146): the dark disc
and ring always draw (they are the frame). Wrap ONLY the sword/arrow glyph so it
draws when the emblem texture is absent. Replace the `if (kind === "melee") { … }
else { … }` block with:

```ts
    // Role emblem (SDXL Image) rides on top when present; otherwise fall back to
    // the legacy melee/ranged glyph so the badge is never empty.
    if (!this.textures.exists(roleBadgeTex(def.role))) {
      if (kind === "melee") {
        g.beginPath(); g.moveTo(x, y - 4); g.lineTo(x, y + 3.2); g.strokePath();
        g.beginPath(); g.moveTo(x - 2.4, y + 1.4); g.lineTo(x + 2.4, y + 1.4); g.strokePath();
      } else {
        g.beginPath(); g.moveTo(x - 3.4, y); g.lineTo(x + 3, y); g.strokePath();
        g.beginPath(); g.moveTo(x + 0.6, y - 2.4); g.lineTo(x + 3.4, y); g.lineTo(x + 0.6, y + 2.4); g.strokePath();
      }
    }
```

Add `import { roleBadgeTex } from "./roleBadge.ts";` to `battleSceneRender.ts`.
Keep the `g.lineStyle(1.6, 0xffffff, 0.95);` line — it is harmless when no glyph
draws and needed by the fallback.

- [ ] **Step 4: Verify typecheck + build + full suite**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: tsc clean; all tests pass (the new `roleBadge`/`assetKeys` tests
included); build clean (pre-existing chunk warning only).

- [ ] **Step 5: Commit**

```bash
git add src/scenes/BattleScene.ts src/scenes/battleSceneSprites.ts src/scenes/battleSceneRender.ts
git commit -m "feat(role-icons): render managed per-role badge Images w/ glyph fallback"
```

---

### Task 7: Generate the emblem art (SDXL)

**Files:**
- Create (generated): `public/assets/sprites/roleicon/{damage,splash,chain,dot,support,debuff,tanker}.png`

- [ ] **Step 1: Confirm the SD server is reachable**

Run: `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8765/ ; echo`
Expected: any HTTP code (e.g. `404`) means the server is up and serving;
a connection error means start the SD server first.

- [ ] **Step 2: Generate**

Run: `npm run gen:sprites -- --only=roleicon --force`
Expected: `SD generating 7 sprites`, then 7 `[n/7] roleicon/<role>.png` lines,
each writing a cutout to `public/assets/sprites/roleicon/`.

- [ ] **Step 3: Eyeball the output**

Run: `ls -la public/assets/sprites/roleicon/` (expect 7 PNGs).
Open a couple (e.g. `splash.png`, `tanker.png`) and confirm each reads as the
intended emblem (a burst; a shield) on a transparent background, ~64×64.

If an emblem is wrong/ambiguous, tweak its `ROLE_VISUAL` entry in
`scripts/sdart/prompts.mjs` and re-run Step 2 for that one (the seed is stable,
so re-runs are deterministic; adjust the wording, not the seed).

- [ ] **Step 4: Commit**

```bash
git add public/assets/sprites/roleicon/
git commit -m "art(role-icons): generated SDXL per-role badge emblems"
```

---

### Task 8: Verify whole + playtest + memory

**Files:**
- Modify: `memory/MEMORY.md` (+ new `memory/project_role_icons.md`)

- [ ] **Step 1: Full verification**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: tsc clean, all tests pass, build clean.

- [ ] **Step 2: In-game playtest (CDP)**

Build + preview + headless Chrome, then drive a battle and screenshot:
```bash
npm run build
npx vite preview --port 4188 >/tmp/preview.log 2>&1 &
google-chrome --headless=new --remote-debugging-port=9222 --no-sandbox >/tmp/chrome.log 2>&1 &
sleep 3
node scripts/playtest/playtest.mjs --out=/tmp/role_badges.png --place=4 --wait=3500 \
  --eval='const bs=window.__game.scene.getScene("BattleScene"); return JSON.stringify((bs.battle.towers||[]).map(t=>({role:t.def.role, hasBadge:bs.roleBadges.has(t.uid)})));'
```
Expected: the eval prints each placed tower's role + `hasBadge:true`; the
screenshot shows distinct emblems in the towers' upper-right corners. Kill the
preview + chrome background jobs afterward.

- [ ] **Step 3: Record memory**

Create `memory/project_role_icons.md` (frontmatter per the memory format) noting:
the tower upper-right badge is now an SDXL `roleicon` emblem (one per TowerRole)
rendered as a managed `BattleScene.roleBadges` Image, with `roleBadge.ts` as the
pure role→key+geometry source and a sword/arrow glyph fallback in `drawTypeBadge`
when the texture is absent; regen via `npm run gen:sprites -- --only=roleicon`.
Link `[[project_castle_sprite]]` and `[[project_asset_key_registry]]`. Add a
one-line pointer to `memory/MEMORY.md`.

- [ ] **Step 4: Commit**

```bash
git add memory/
git commit -m "docs(role-icons): record role-badge memory"
```

---

## Self-Review

**Spec coverage:**
- New `roleicon` SDXL kind + prompts + negative → Task 3. ✓
- `roleTex` asset key + discipline → Task 1. ✓
- Pure `roleBadge.ts` (role→key + geometry) → Task 2. ✓
- `tanker` color added → Task 4. ✓
- Preload all 7 → Task 5. ✓
- Managed badge Images mirroring `towerSprites` + reset/cull → Task 6. ✓
- Fallback to legacy glyph when texture absent → Task 6 Step 3. ✓
- Kind ring color retained (untouched in `drawTypeBadge`) → Task 6 (only the
  glyph block is gated; disc + ring lines are left as-is). ✓
- Art generation → Task 7. ✓
- Tests (roleBadge, assetKeys, discipline) → Tasks 1, 2, 4. ✓

**Placeholder scan:** none — every code step shows the code.

**Type consistency:** `roleBadgeTex` / `ROLE_BADGE` / `roleTex` / `roleBadges` /
`ROLE_VISUAL` / `roleIconStyle` / `ROLEICON_NEGATIVE` used identically across
tasks. `TowerRole` sourced from `../data/schema.ts` (re-export) in the helper and
`TOWER_ROLES` from `../data/schemaEnums.ts` in tests/preload — consistent with
existing imports.
