# Character Attack Poses Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the 56 orphaned single-frame combat-stance PNGs (52 tower `__attack`, 4 hero weapon poses) into the game so towers shift into their dramatic pose while fighting and the home throne hero shows a weapon-class pose.

**Architecture:** Pure decision modules (`attackPose.ts`, `heroPose.ts`, two `assetKeys.ts` helpers) are TDD-tested. A generator script appends 56 single-frame manifest entries that `PreloadScene` auto-loads (single-frame ⇒ no anim synthesized). Rendering is thin, `textures.exists()`-gated swaps in `battleSceneSprites.ts` (tower) and `MainMenuScene.ts` (hero) that fall back to current behavior when art is absent.

**Tech Stack:** TypeScript, Phaser 3, Vitest, Vite. Sprite keys are built ONLY in `src/data/assetKeys.ts` (enforced by `tests/assetKeyDiscipline.test.ts`).

---

### Task 1: Asset-key helpers

**Files:**
- Modify: `src/data/assetKeys.ts`
- Test: `src/data/assetKeys.test.ts` (create if absent; else append)

- [ ] **Step 1: Write the failing test**

Create/append `src/data/assetKeys.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { towerAttackTex, heroPoseTex, towerTex } from "./assetKeys.ts";

describe("pose asset keys", () => {
  it("towerAttackTex appends __attack to the tower key", () => {
    expect(towerAttackTex("akagan-ashen")).toBe("tower__akagan-ashen__attack");
    expect(towerAttackTex("zoran-thricedraw")).toBe(`${towerTex("zoran-thricedraw")}__attack`);
  });
  it("heroPoseTex builds the hero weapon-pose key", () => {
    expect(heroPoseTex("bow")).toBe("hero__bow");
    expect(heroPoseTex("staff")).toBe("hero__staff");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/assetKeys.test.ts`
Expected: FAIL — `towerAttackTex`/`heroPoseTex` not exported.

- [ ] **Step 3: Add the helpers**

In `src/data/assetKeys.ts`, after the `towerTex` line (line 14) add:

```ts
/** Single-frame combat-stance pose for a tower character (shown while engaged). */
export const towerAttackTex = (id: string): string => `tower__${id}__attack`;
```

After the `HERODOLL_BASE_TEX` block (near line 42) add:

```ts
/** Single-frame hero weapon-class pose (bow|fist|gun|staff) — home throne hero. */
export const heroPoseTex = (family: string): string => `hero__${family}`;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/data/assetKeys.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/assetKeys.ts src/data/assetKeys.test.ts
git commit -m "feat(assets): towerAttackTex + heroPoseTex key builders

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: `heroPose.ts` pure module

Maps an equipped weapon's `WeaponType` to a pose family, but only the four that have art.

**Files:**
- Create: `src/data/heroPose.ts`
- Test: `src/data/heroPose.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { heroPoseFamily } from "./heroPose.ts";

describe("heroPoseFamily", () => {
  it("maps the four art-backed weapon types to a family", () => {
    expect(heroPoseFamily("Bow")).toBe("bow");
    expect(heroPoseFamily("Fist")).toBe("fist");
    expect(heroPoseFamily("Gun")).toBe("gun");
    expect(heroPoseFamily("Staff")).toBe("staff");
  });
  it("returns null for weapon types with no pose art", () => {
    expect(heroPoseFamily("Sword")).toBeNull();
    expect(heroPoseFamily("Tome")).toBeNull();
    expect(heroPoseFamily("Any")).toBeNull();
  });
  it("returns null when no weapon is equipped", () => {
    expect(heroPoseFamily(null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/heroPose.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/data/heroPose.ts`:

```ts
// Pure: which hero weapon-class pose (if any) to show for an equipped weapon.
// Only bow/fist/gun/staff have pose art; everything else falls back to the
// animated hero__hero idle. Phaser-free, tested.
import type { WeaponType } from "./schema.ts";

export type HeroPoseFamily = "bow" | "fist" | "gun" | "staff";

const POSE_BY_WEAPON: Partial<Record<WeaponType, HeroPoseFamily>> = {
  Bow: "bow",
  Fist: "fist",
  Gun: "gun",
  Staff: "staff",
};

/** The pose family for an equipped weapon's type, or null if none has art. */
export function heroPoseFamily(weaponType: WeaponType | null | undefined): HeroPoseFamily | null {
  return (weaponType && POSE_BY_WEAPON[weaponType]) ?? null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/data/heroPose.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/heroPose.ts src/data/heroPose.test.ts
git commit -m "feat(hero): heroPoseFamily weapon-type -> pose mapping (pure)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: `attackPose.ts` pure module

Engaged-window predicate + posed display scale for the tower combat-stance swap.

**Files:**
- Create: `src/scenes/attackPose.ts`
- Test: `src/scenes/attackPose.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import {
  ENGAGED_MS,
  POSE_FILL_BOOST,
  POSE_ORIGIN_Y,
  IDLE_ORIGIN_Y,
  isEngaged,
  towerDisplayScale,
} from "./attackPose.ts";

describe("attackPose", () => {
  it("engaged window outlasts the ~1s attack cadence", () => {
    expect(ENGAGED_MS).toBeGreaterThan(1000);
  });
  it("isEngaged is true until engagedUntil passes", () => {
    expect(isEngaged(1500, 1000)).toBe(true);
    expect(isEngaged(1000, 1000)).toBe(false);
    expect(isEngaged(0, 1000)).toBe(false);
  });
  it("idle scale fits a 192 frame to ~50px at level 0", () => {
    // 50 / 192 ~= 0.260
    expect(towerDisplayScale(192, 0, false)).toBeCloseTo(50 / 192, 5);
  });
  it("posed scale boosts to compensate the pose's larger margin", () => {
    expect(towerDisplayScale(320, 0, true)).toBeCloseTo((50 * POSE_FILL_BOOST) / 320, 5);
  });
  it("upgrade level grows both idle and posed scale by 5% per level", () => {
    expect(towerDisplayScale(192, 4, false)).toBeCloseTo((50 / 192) * 1.2, 5);
  });
  it("pose feet sit lower in frame than the idle origin", () => {
    expect(POSE_ORIGIN_Y).toBeGreaterThan(IDLE_ORIGIN_Y);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/scenes/attackPose.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/scenes/attackPose.ts`:

```ts
// Pure helpers for the tower combat-stance swap. A tower shows its single-frame
// __attack pose while "engaged" (recently attacked), then relaxes to its idle
// sprite. Phaser-free and tested; the presenter (battleSceneSprites) does the
// texture swap and feeds these numbers into setScale/setOrigin.

/** How long after the last attack a tower keeps its combat stance (ms). */
export const ENGAGED_MS = 1100;
/** Battlefield display height (px) a tower body targets — mirrors manageSprites. */
export const TOWER_DISPLAY_H = 50;
/** Per-upgrade-level scale growth — mirrors animateTower's (1 + 0.05*level). */
export const LEVEL_GROWTH = 0.05;
/**
 * The pose art fills a smaller fraction of its 320 canvas than the idle body
 * fills its 192 canvas, so the posed body is scaled up to match idle body size.
 */
export const POSE_FILL_BOOST = 1.18;
/** Idle sprite anchor (mirrors ensureSprite's 0.78). */
export const IDLE_ORIGIN_Y = 0.78;
/** Posed sprite anchor — feet sit lower in the taller pose frame. */
export const POSE_ORIGIN_Y = 0.86;

/** True while the tower is still in its post-attack combat-stance window. */
export function isEngaged(engagedUntil: number, now: number): boolean {
  return engagedUntil > now;
}

/** Scale to apply to a sprite of frame height `frameH`, given upgrade level + posed. */
export function towerDisplayScale(frameH: number, level: number, posed: boolean): number {
  const target = TOWER_DISPLAY_H * (posed ? POSE_FILL_BOOST : 1);
  return (target / frameH) * (1 + LEVEL_GROWTH * level);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/scenes/attackPose.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/scenes/attackPose.ts src/scenes/attackPose.test.ts
git commit -m "feat(battle): attackPose pure module (engaged window + posed scale)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Manifest entries for the 56 poses

A one-shot generator appends single-frame `SpriteEntry` records so `PreloadScene` loads the PNGs. Single-frame (`frames: 1`) means `PreloadScene` synthesizes no animation (it `continue`s on `frames <= 1`).

**Files:**
- Create: `scripts/sdart/add_pose_manifest.mjs`
- Modify (by script): `src/data/spriteManifest.ts`
- Test: `src/data/spriteManifest.poses.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { SPRITE_MANIFEST } from "./spriteManifest.ts";

describe("pose manifest entries", () => {
  const byKey = new Map(SPRITE_MANIFEST.map((e) => [e.key, e]));
  it("registers all 4 hero weapon poses as single 320 frames", () => {
    for (const fam of ["bow", "fist", "gun", "staff"]) {
      const e = byKey.get(`hero__${fam}`);
      expect(e, fam).toBeTruthy();
      expect(e!.frames).toBe(1);
      expect(e!.frameWidth).toBe(320);
      expect(e!.frameHeight).toBe(320);
      expect(e!.path).toBe(`assets/sprites/hero/hero__${fam}.png`);
    }
  });
  it("registers a __attack pose for akagan-ashen as a single 320 frame", () => {
    const e = byKey.get("tower__akagan-ashen__attack");
    expect(e).toBeTruthy();
    expect(e!.frames).toBe(1);
    expect(e!.path).toBe("assets/sprites/tower/akagan-ashen__attack.png");
  });
  it("registers exactly 52 tower attack poses", () => {
    const n = SPRITE_MANIFEST.filter((e) => e.key.endsWith("__attack")).length;
    expect(n).toBe(52);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/spriteManifest.poses.test.ts`
Expected: FAIL — no `__attack` / `hero__bow` entries yet.

- [ ] **Step 3: Write the generator script**

Create `scripts/sdart/add_pose_manifest.mjs`:

```js
// One-shot: append single-frame SpriteEntry records for the orphaned pose PNGs
// (52 tower __attack + 4 hero weapon poses) to src/data/spriteManifest.ts.
// Idempotent: skips any key already present. Inserts before the closing "];".
import { readFileSync, writeFileSync, readdirSync } from "node:fs";

const MAN = "src/data/spriteManifest.ts";
const SPR = "public/assets/sprites";

const pngSize = (path) => {
  const d = readFileSync(path);
  return { w: d.readUInt32BE(16), h: d.readUInt32BE(20) };
};

const entries = [];
// Tower attack poses.
for (const f of readdirSync(`${SPR}/tower`).filter((f) => f.endsWith("__attack.png")).sort()) {
  const id = f.replace(/\.png$/, ""); // "<char>__attack"
  const { w, h } = pngSize(`${SPR}/tower/${f}`);
  entries.push({
    key: `tower__${id}`,
    kind: "tower",
    id,
    path: `assets/sprites/tower/${f}`,
    frameWidth: w,
    frameHeight: h,
    frames: 1,
    names: ["pose"],
  });
}
// Hero weapon poses.
for (const fam of ["bow", "fist", "gun", "staff"]) {
  const { w, h } = pngSize(`${SPR}/hero/hero__${fam}.png`);
  entries.push({
    key: `hero__${fam}`,
    kind: "hero",
    id: fam,
    path: `assets/sprites/hero/hero__${fam}.png`,
    frameWidth: w,
    frameHeight: h,
    frames: 1,
    names: ["pose"],
  });
}

let text = readFileSync(MAN, "utf8");
const fresh = entries.filter((e) => !text.includes(`"${e.key}"`));
if (fresh.length === 0) {
  console.log("manifest already has all pose entries — no change");
  process.exit(0);
}
const json = fresh.map((e) => JSON.stringify(e)).join(",");
const close = text.lastIndexOf("];");
if (close < 0) throw new Error("could not find closing `];` of SPRITE_MANIFEST");
text = text.slice(0, close) + "," + json + text.slice(close);
writeFileSync(MAN, text);
console.log(`appended ${fresh.length} pose entries to ${MAN}`);
```

- [ ] **Step 4: Run the generator, then format**

Run:
```bash
node scripts/sdart/add_pose_manifest.mjs
npx prettier --write src/data/spriteManifest.ts || true
```
Expected: `appended 56 pose entries to src/data/spriteManifest.ts`.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/data/spriteManifest.poses.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add scripts/sdart/add_pose_manifest.mjs src/data/spriteManifest.ts src/data/spriteManifest.poses.test.ts
git commit -m "feat(art): register 56 pose sprites in the manifest (single frame)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Wire the tower combat-stance swap

Stamp `engagedUntil` on attack; swap texture/origin by engaged state in `manageSprites`; feed posed scale into `animateTower`.

**Files:**
- Modify: `src/scenes/battleSceneSprites.ts` (imports; `playFx` ~line 44; `manageSprites` ~line 463; `animateTower` ~line 428)

- [ ] **Step 1: Add imports**

At the top of `src/scenes/battleSceneSprites.ts`, extend the assetKeys import and add the attackPose import:

```ts
import { towerTex, towerAttackTex } from "../data/assetKeys.ts";
import {
  ENGAGED_MS,
  isEngaged,
  towerDisplayScale,
  POSE_ORIGIN_Y,
  IDLE_ORIGIN_Y,
} from "./attackPose.ts";
```

- [ ] **Step 2: Stamp the engaged window on attack**

In `playFx`, the `ev.type === "attack"` / non-hero branch (currently lines 44-46), add the stamp:

```ts
        const ts = this.towerSprites.get(ev.uid) ?? null;
        ts?.setData("atkUntil", this.time.now + TOWER_STRIKE_MS); // procedural recoil punch
        ts?.setData("engagedUntil", this.time.now + ENGAGED_MS); // combat-stance pose window
        this.playSpriteOneShot(ts, ["attack"], "idle");
```

- [ ] **Step 3: Swap texture by engaged state in `manageSprites`**

In `manageSprites`, replace the `if (s) { ... animateTower ... }` block (currently lines 471-477) with:

```ts
      if (s) {
        s.setAlpha(t.disabledTimer > 0 ? 0.5 : 1);
        // Combat-stance swap: show the dramatic __attack pose while engaged, if
        // art exists; else the animated idle sheet. One swap per state change.
        const attackKey = towerAttackTex(t.def.id);
        const engaged =
          isEngaged((s.getData("engagedUntil") as number) ?? 0, this.time.now) &&
          this.textures.exists(attackKey);
        const desiredKey = engaged ? attackKey : towerTex(t.def.id);
        if (s.texture.key !== desiredKey) {
          s.setTexture(desiredKey);
          s.setOrigin(0.5, engaged ? POSE_ORIGIN_Y : IDLE_ORIGIN_Y);
          if (!engaged && this.anims.exists(`${desiredKey}_idle`)) s.play(`${desiredKey}_idle`);
        }
        if (s.height) {
          const base = towerDisplayScale(s.height, t.battleLevel, engaged);
          this.animateTower(s, t, base);
        }
      }
```

- [ ] **Step 4: Verify type-check + existing battle tests pass**

Run: `npx tsc --noEmit && npx vitest run src/scenes/attackPose.test.ts`
Expected: no type errors; PASS. (Rendering is exercised live in Task 7.)

- [ ] **Step 5: Commit**

```bash
git add src/scenes/battleSceneSprites.ts
git commit -m "feat(battle): towers shift into __attack pose while engaged

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Wire the hero weapon-class pose on the home throne

**Files:**
- Modify: `src/scenes/MainMenuScene.ts` (`drawHero` ~line 117 and its call ~line 83)

- [ ] **Step 1: Add imports**

At the top of `src/scenes/MainMenuScene.ts` add:

```ts
import { resolveHeroLayers } from "./heroEquipVisuals.ts";
import { heroPoseFamily } from "../data/heroPose.ts";
import { heroPoseTex } from "../data/assetKeys.ts";
```

- [ ] **Step 2: Pass the save into `drawHero` and swap the pose**

Change the call (line 83) from `this.drawHero(W, H);` to:

```ts
    this.drawHero(save, W, H);
```

Replace the whole `drawHero` method (lines 117-128) with:

```ts
  private drawHero(save: ReturnType<SaveManager["getSave"]>, W: number, H: number): void {
    const family = heroPoseFamily(resolveHeroLayers(save.inventory).weaponType);
    const poseKey = family ? heroPoseTex(family) : null;
    // Weapon-class pose if the equipped weapon has pose art; else animated idle.
    const key = poseKey && this.textures.exists(poseKey) ? poseKey : "hero__hero";
    if (!this.textures.exists(key)) return;
    const HERO_H = 104,
      cy = H * 0.5;
    const hero = this.add
      .sprite(W / 2, cy, key)
      .setOrigin(0.5, 0.85)
      .setDepth(2);
    hero.setScale(HERO_H / hero.height);
    // Only the multi-frame base sheet animates; the single-frame pose stays still.
    if (key === "hero__hero" && this.anims.exists("hero__hero_idle")) hero.play("hero__hero_idle");
  }
```

- [ ] **Step 3: Verify type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/scenes/MainMenuScene.ts
git commit -m "feat(home): throne hero shows equipped weapon-class pose

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Verify, playtest, deploy

**Files:**
- Modify: `src/data/assetVersion.ts` (bump `ASSET_VERSION`)

- [ ] **Step 1: Full verification suite**

Run:
```bash
npx tsc --noEmit
npx vitest run
npm run lint
npm run build
```
Expected: all green. If `lint:cycles` or `max-lines` complains, fix before proceeding.

- [ ] **Step 2: CDP self-playtest**

Use the `window.__game` CDP playtest flow (see `reference_playtest_and_art` memory). Confirm:
- Start a battle; a placed tower whose character has `__attack` art visibly shifts to its combat-stance pose while enemies are in range, and relaxes to the idle sprite ~1.1s after the lane clears.
- On the home screen, equip a Bow/Gun/Staff/Fist weapon and confirm the throne hero shows the matching weapon-class pose; equip a Sword and confirm it falls back to the animated `hero__hero` idle.
- No `__MISSING` boxes anywhere.

- [ ] **Step 3: Bump ASSET_VERSION**

The restyled achievement medallions (changed in place, committed, never deployed) plus the new pose sprites ship now. In `src/data/assetVersion.ts` bump:

```ts
export const ASSET_VERSION = "2026-06-20b";
```

- [ ] **Step 4: Commit the bump**

```bash
git add src/data/assetVersion.ts
git commit -m "chore(assets): bump ASSET_VERSION for pose sprites + restyled medallions

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **Step 5: Deploy + push (standing rule)**

```bash
npm run build
npx firebase-tools deploy --only hosting
git push -u origin wip/sprite-art-restyle
```
Expected: deploy succeeds (live at wibu-tower-defense-d8b1c.web.app); branch pushed.

- [ ] **Step 6: Record memory**

Add a `project` memory note for the character-attack-pose system (tower combat-stance swap + home hero weapon pose) and update `MEMORY.md`.

---

## Self-Review Notes

- **Spec coverage:** Tower combat-stance swap → Tasks 3+5. Hero throne pose → Tasks 2+6. Key
  discipline → Task 1. Manifest load → Task 4. Gating/fallback → exists() checks in Tasks 5/6.
  Verify/deploy/ASSET_VERSION → Task 7. All spec sections covered.
- **Type consistency:** `towerAttackTex`/`heroPoseTex` (Task 1) used verbatim in Tasks 4-6.
  `heroPoseFamily` (Task 2) consumed in Task 6. `isEngaged`/`towerDisplayScale`/`ENGAGED_MS`/
  `POSE_ORIGIN_Y`/`IDLE_ORIGIN_Y` (Task 3) consumed in Task 5. `resolveHeroLayers(...).weaponType`
  matches `heroEquipVisuals.ts:10,23`.
- **No placeholders:** every code step shows complete code.
```
