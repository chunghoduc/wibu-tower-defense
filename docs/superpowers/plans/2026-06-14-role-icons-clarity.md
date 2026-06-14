# Role-Icon Clarity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Regenerate all 7 tower role icons via the SDXL flow with bolder, small-size-legible art, and surface the role emblem everywhere it matters — the in-battle build-bar cards (currently an empty colored dot), the tower info panel, and the home Squad roster/info panel.

**Architecture:** A pure geometry helper (`roleBadgeOnCard`) in `roleBadge.ts` keeps the build-bar emblem placement testable. Presenters (`buildBuildBar`, `squadInfoPanel`, `SquadScene`) add a guarded emblem `Image` next to the existing role text/disc, reusing the `roleBadgeTex` key resolver. Art is refreshed by editing `ROLE_VISUAL`/style in `scripts/sdart/prompts.mjs` and running the generator; `ASSET_VERSION` is bumped.

**Tech Stack:** TypeScript, Phaser 3, Vitest, local Z-Image-Turbo SDXL API (`scripts/sdart/`).

---

### Task 1: Pure build-bar emblem geometry helper (TDD)

**Files:**
- Modify: `src/scenes/roleBadge.ts`
- Test: `tests/roleBadge.test.ts` (exists — add a describe block)

- [ ] **Step 1: Write the failing test**

Append to `tests/roleBadge.test.ts`:

```ts
import { roleBadgeOnCard } from "../src/scenes/roleBadge.ts";

describe("roleBadgeOnCard", () => {
  it("pins the emblem to the upper-right inside the card", () => {
    const g = roleBadgeOnCard(66); // build-bar card inner width
    // upper-right quadrant: x positive (right of center), y negative (above center)
    expect(g.x).toBeGreaterThan(0);
    expect(g.y).toBeLessThan(0);
    // stays inside the right edge (half-width = 33)
    expect(g.x + g.diameter / 2).toBeLessThanOrEqual(33);
    expect(g.diameter).toBeGreaterThan(0);
  });

  it("scales the emblem with card width", () => {
    expect(roleBadgeOnCard(80).diameter).toBeGreaterThan(roleBadgeOnCard(40).diameter);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/roleBadge.test.ts`
Expected: FAIL — `roleBadgeOnCard` is not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `src/scenes/roleBadge.ts`:

```ts
/** Emblem placement on a build-bar tower card (local coords, card centered at 0,0).
 *  Pins the role emblem to the card's upper-right — over the type-badge disc that
 *  buildBuildBar draws at ((width)/2 - 9, -8) — so the role reads on the card too. */
export function roleBadgeOnCard(cardWidth: number): { x: number; y: number; diameter: number } {
  const diameter = Math.round(cardWidth * 0.3); // ~20px on the 66px build-bar card
  return { x: cardWidth / 2 - 9, y: -8, diameter };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/roleBadge.test.ts`
Expected: PASS (both new tests + existing key/color tests).

- [ ] **Step 5: Commit**

```bash
git add src/scenes/roleBadge.ts tests/roleBadge.test.ts
git commit -m "feat(roleicon): pure roleBadgeOnCard geometry helper (TDD)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Show the role emblem on in-battle build-bar cards

**Files:**
- Modify: `src/scenes/BattleScene.ts` (`buildBuildBar`, around line 468-470)
- Modify import line in `src/scenes/BattleScene.ts` (add `roleBadgeTex, roleBadgeOnCard`)

- [ ] **Step 1: Add the imports**

Find the existing import of `roleBadge` helpers (BattleScene imports from `./battleSceneRender` / others). Add at the top of `BattleScene.ts` with the other scene imports:

```ts
import { roleBadgeTex, roleBadgeOnCard } from "./roleBadge.ts";
```

(If `roleBadgeTex` is already imported transitively, only add what's missing — check with `grep -n "roleBadge" src/scenes/BattleScene.ts` first and avoid a duplicate import.)

- [ ] **Step 2: Add the emblem Image to the card**

In `buildBuildBar()`, immediately after these existing lines:

```ts
      const badge = this.add.graphics();
      this.drawTypeBadge(badge, (TW - 8) / 2 - 9, -8, def); // melee/ranged + role (T5)
      c.add(badge);
```

insert:

```ts
      // Role emblem on top of the disc (the field-tower treatment, but for the
      // card) so the build-bar "squad list" shows the role, not a bare dot.
      const rbKey = roleBadgeTex(def.role);
      if (this.textures.exists(rbKey)) {
        const geo = roleBadgeOnCard(TW - 8);
        const emblem = this.add.image(geo.x, geo.y, rbKey);
        if (emblem.height) emblem.setScale(geo.diameter / emblem.height);
        c.add(emblem);
      }
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/scenes/BattleScene.ts
git commit -m "feat(roleicon): emblem on build-bar cards (role reads in squad list)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Show the role emblem in Squad info panel + roster

**Files:**
- Modify: `src/scenes/squadInfoPanel.ts` (the `{rarity} · {role}` text line, ~line 102-108)
- Modify: `src/scenes/SquadScene.ts` (roster tile — add emblem beside role/name)

- [ ] **Step 1: squadInfoPanel — add a guarded emblem beside the role line**

In `squadInfoPanel.ts`, add the import at the top (with the other scene imports):

```ts
import { roleBadgeTex } from "./roleBadge.ts";
```

Then, right before the existing `{def.rarity} · {ROLE_LABEL...}` `crispText` block, add:

```ts
  const rbKey = roleBadgeTex(def.role);
  if (scene.textures.exists(rbKey)) {
    const emblem = scene.add.image(x + 56, y + 27, rbKey);
    emblem.setScale(14 / (emblem.height || 14));
    add(c, emblem);
  }
```

and shift the role text right to make room — change the text's x from `x + 62` to `x + 66` on the `${def.rarity} · ${ROLE_LABEL...}` line only (leave the name line at `x + 62`).

- [ ] **Step 2: SquadScene roster tile — add a guarded emblem**

Run `grep -n "ROLE_LABEL\|def.role\|add.image\|roster\|tile" src/scenes/SquadScene.ts` to find where a roster tile renders a character. At the tile that shows the character's portrait/name, add (guarded) a small role emblem in a free corner:

```ts
import { roleBadgeTex } from "./roleBadge.ts"; // top of file

// inside the roster-tile builder, after the portrait image is added:
const rbKey = roleBadgeTex(def.role);
if (this.textures.exists(rbKey)) {
  const emblem = this.add.image(tileX + TILE_W - 12, tileY + 12, rbKey);
  emblem.setScale(16 / (emblem.height || 16));
  // add to the same container/group the tile uses
}
```

Adapt `tileX/tileY/TILE_W/def` to the actual local variable names in that builder and add the emblem to whatever container the rest of the tile uses. If the roster tile has no obvious free corner, place it next to the name text instead. Keep the `textures.exists` guard.

- [ ] **Step 3: Typecheck + full suite + lint**

Run: `npx tsc --noEmit && npx vitest run && npx eslint src/scenes/squadInfoPanel.ts src/scenes/SquadScene.ts src/scenes/roleBadge.ts src/scenes/BattleScene.ts`
Expected: clean (no type errors, all tests pass, no `max-lines` errors).

- [ ] **Step 4: Commit**

```bash
git add src/scenes/squadInfoPanel.ts src/scenes/SquadScene.ts
git commit -m "feat(roleicon): role emblem in Squad info panel + roster tiles

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Regenerate the 7 role icons (SDXL) with clearer art

**Files:**
- Modify: `scripts/sdart/prompts.mjs` (`ROLE_VISUAL` + `ROLEICON_STYLE`)
- Regenerate: `public/assets/sprites/roleicon/*.png`
- Modify: `src/data/assetVersion.ts` (bump `ASSET_VERSION`)

- [ ] **Step 1: Tighten the style string for small-size legibility**

In `scripts/sdart/prompts.mjs` replace `ROLEICON_STYLE` with:

```js
const ROLEICON_STYLE =
  "a single bold flat vector game UI emblem icon of {V}, ONE simple solid shape, very thick uniform clean outline, high contrast, flat cel-shaded, centered, no fine interior detail, instantly readable at 16 pixels, isolated on a pure plain flat white background, empty background, no text";
```

- [ ] **Step 2: Simplify the per-role descriptors**

Replace the `ROLE_VISUAL` object with:

```js
export const ROLE_VISUAL = {
  damage: "one bold solid downward strike arrowhead chevron, sky-blue",
  splash: "one bold solid eight-point explosion burst star, coral orange",
  chain: "one bold solid jagged zigzag lightning bolt, violet purple",
  dot: "one bold solid venom teardrop droplet, toxic green",
  support: "one bold solid upward double-chevron up-arrow, warm gold",
  debuff: "one bold solid downward arrow above a short minus bar, teal cyan",
  tanker: "one bold solid heater knight shield with a small center stud, steel grey",
};
```

- [ ] **Step 3: Confirm the SDXL API is up, then regenerate**

Run: `curl -s http://127.0.0.1:8765/health`
Expected: `{"status":"ok",...,"ready":true}`.

Run: `npm run gen:sprites -- --only=roleicon --force`
Expected: 7 jobs render + cutout to `public/assets/sprites/roleicon/<role>.png` (64px). One generation at a time (GPU is sequential).

- [ ] **Step 4: Visual spot-check**

Read each of the 7 PNGs (Read tool) and confirm a single bold readable shape, transparent corners, no baked text. If any role renders text/garbled, bump its `seedOf` input by re-running just that role with `--force` (re-roll), or tweak its descriptor and regenerate.

- [ ] **Step 5: Bump ASSET_VERSION**

In `src/data/assetVersion.ts` change:

```ts
export const ASSET_VERSION = "2026-06-14d";
```
to
```ts
export const ASSET_VERSION = "2026-06-14e";
```

- [ ] **Step 6: Commit**

```bash
git add scripts/sdart/prompts.mjs public/assets/sprites/roleicon src/data/assetVersion.ts
git commit -m "art(roleicon): regenerate all 7 role emblems, bolder + legible at small size

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Verify end-to-end + live playtest

**Files:**
- Create (if helpful): `scripts/playtest/repro_role_icons.mjs`

- [ ] **Step 1: Full verification gate**

Run: `npx tsc --noEmit && npx vitest run && npx eslint . && npm run build`
Expected: all clean. Note the test count.

- [ ] **Step 2: Live CDP playtest of the build bar**

Reuse the harness pattern from `scripts/playtest/repro_tap_place.mjs`. Start `BattleScene`, then for each `avatarTiles` card assert it contains a child `Image` whose texture key is `roleicon__<def.role>`:

```js
// per card: list child texture keys, expect one to be `roleicon__${def.role}`
const ok = await evalJs(`const b=${bs};
  return b.buildOrder.every((def,i)=>{
    const c=b.avatarTiles[i];
    return c.list.some(o=>o.texture && o.texture.key===('roleicon__'+def.role));
  });`);
```

Expect `true`. Screenshot the build bar (`Page.captureScreenshot`) and confirm by eye that every card shows a distinct role emblem. Run via a `/tmp/run_pt.sh` script (foreground `sleep` is blocked; ports + chrome need the sandbox disabled).

- [ ] **Step 3: Commit the repro (if created)**

```bash
git add scripts/playtest/repro_role_icons.mjs
git commit -m "test(playtest): CDP repro for build-bar role emblems

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **Step 4: Update memory**

Update `project_role_icons.md` (memory) to record: build-bar cards now carry the emblem Image (was an empty disc — the bug), squad panels show it too, and the icons were regenerated bolder/simpler for ≤16px legibility. Bump the MEMORY.md pointer hook if needed.

---

## Self-Review Notes

- **Spec coverage:** A (art regen) → Task 4; B (build-bar emblem, the core fix) → Tasks 1+2; C (squad panels) → Task 3; verification/playtest → Task 5. All spec sections covered.
- **Type consistency:** `roleBadgeOnCard(cardWidth)` defined in Task 1 and consumed with the same signature in Task 2; `roleBadgeTex` is the existing exported resolver used uniformly.
- **No placeholders:** every code step shows real code; Task 3 Step 2 is intentionally adaptive to SquadScene's local names (the one place exact line numbers can't be pinned without reading the live file) but specifies exact behavior + guard.
