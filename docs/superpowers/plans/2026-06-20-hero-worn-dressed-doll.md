# Hero Worn Look — Dressed Paper-Doll Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make equipped gear visibly *worn* on the hero — composite gear at body-region anchors on the two fixed hero figures (equipment paper-doll + home throne), with purpose-built SDXL worn art swapping in over the existing icons.

**Architecture:** One PURE layout module (`heroDressLayout.ts`) maps `equipped` + a body box → ordered worn-layer placements. Two thin presenters (HeroScene doll, MainMenuScene throne) consume it. Worn texture keys resolve via `wornTex(id)` with an `itemTex(id)` icon fallback, so a new `worn` SDXL art kind (Phase B) swaps in exists-gated. The animated battle hero is untouched.

**Tech Stack:** TypeScript, Phaser 3.80, Vite, Vitest. Offline art = `scripts/sdart/` (z-image-turbo) `sdgen.mjs`.

## Global Constraints

- Never leave a source file > 500 CODE lines (ESLint `max-lines` 500 = error).
- `src/data/assetKeys.ts` is the SOLE place a `<ns>__<id>` texture key is built.
- SDXL (`scripts/sdart/`) is the SOLE sprite-art pipeline; `spriteManifest.ts` is hand-maintained / synced via `scripts/sdart/sync_manifest.mjs`.
- No `Math.random` / `Date.now` in pure modules (they throw in tests).
- BUMP `ASSET_VERSION` (`src/data/assetVersion.ts`) ONLY when generated art is regenerated AND redeployed (Phase B only, not Phase A).
- `lint:cycles` (madge) must stay 0.
- Phaser `Zone` lacks Alpha — never tween a zone's alpha.
- Read a file in the current turn before editing it.

---

## Phase A — Dressed compositing with existing icons (no new art)

### Task 1: Pure `heroDressLayout` module

**Files:**
- Create: `src/data/heroDressLayout.ts`
- Test: `tests/heroDressLayout.test.ts`

**Interfaces:**
- Consumes: `InventorySave` (`src/core/save.ts`), `ItemSlot` (`src/data/schema.ts`), `ITEM_CATALOG_MAP` (`src/data/items.ts`), `itemTex` + `wornTex` (`src/data/assetKeys.ts` — `wornTex` added in Task 2; for Task 1 use a local placeholder constant then switch — see Step 3).
- Produces: `interface WornLayer { slot: ItemSlot; key: string; iconKey: string; cx: number; cy: number; scale: number; depth: number; behind: boolean }` and `function heroDressLayout(inventory: InventorySave, body: { x: number; y: number; w: number; h: number }): WornLayer[]`.

A pure function: for each body-reading slot that is equipped, emit one placement with a body-region anchor (normalized within `body`), a slot-sized scale fraction (of `body.h`), a back→front depth, and a `behind` flag. Accessories (Ring1/Ring2/Amulet) are excluded (they don't read as worn on a body). `key` is the worn texture key, `iconKey` the inventory-icon fallback — the presenter picks whichever texture exists.

- [ ] **Step 1: Write the failing test**

```ts
// tests/heroDressLayout.test.ts
import { describe, it, expect } from "vitest";
import { heroDressLayout, type WornLayer } from "../src/data/heroDressLayout.ts";
import { ITEM_CATALOG } from "../src/data/items.ts";
import type { InventorySave } from "../src/core/save.ts";

const BODY = { x: 0, y: 0, w: 300, h: 300 };

// Build an inventory equipping one item per slot, using real catalog defs.
function equip(slots: Record<string, string>): InventorySave {
  const items = Object.entries(slots).map(([slot, defId]) => ({
    id: `inst-${slot}`,
    defId,
    level: 1,
    affixes: [],
  }));
  const equipped: Record<string, string> = {};
  for (const [slot, _] of Object.entries(slots)) equipped[slot] = `inst-${slot}`;
  return { items, equipped, materials: {} } as unknown as InventorySave;
}

const bySlot = (s: string, wt?: string) =>
  ITEM_CATALOG.find((d) => d.slot === s && (!wt || d.weaponType === wt))!;

describe("heroDressLayout", () => {
  it("emits a worn layer for each equipped body slot, none for accessories", () => {
    const inv = equip({
      Weapon: bySlot("Weapon").id,
      Helmet: bySlot("Helmet").id,
      BodyArmor: bySlot("BodyArmor").id,
      Gloves: bySlot("Gloves").id,
      Boots: bySlot("Boots").id,
      Ring1: bySlot("Ring").id,
      Amulet: bySlot("Amulet").id,
    });
    const layers = heroDressLayout(inv, BODY);
    const slots = layers.map((l) => l.slot).sort();
    expect(slots).toEqual(["BodyArmor", "Boots", "Gloves", "Helmet", "Weapon"]);
  });

  it("anchors every layer inside the body box", () => {
    const inv = equip({ Helmet: bySlot("Helmet").id, Boots: bySlot("Boots").id });
    for (const l of heroDressLayout(inv, BODY)) {
      expect(l.cx).toBeGreaterThanOrEqual(BODY.x);
      expect(l.cx).toBeLessThanOrEqual(BODY.x + BODY.w);
      expect(l.cy).toBeGreaterThanOrEqual(BODY.y);
      expect(l.cy).toBeLessThanOrEqual(BODY.y + BODY.h);
    }
  });

  it("orders helmet above feet (head higher = smaller y) and body in between", () => {
    const inv = equip({
      Helmet: bySlot("Helmet").id,
      BodyArmor: bySlot("BodyArmor").id,
      Boots: bySlot("Boots").id,
    });
    const m = Object.fromEntries(heroDressLayout(inv, BODY).map((l) => [l.slot, l]));
    expect(m.Helmet.cy).toBeLessThan(m.BodyArmor.cy);
    expect(m.BodyArmor.cy).toBeLessThan(m.Boots.cy);
  });

  it("sizes layers to body parts (helmet smaller than body armor)", () => {
    const inv = equip({ Helmet: bySlot("Helmet").id, BodyArmor: bySlot("BodyArmor").id });
    const m = Object.fromEntries(heroDressLayout(inv, BODY).map((l) => [l.slot, l]));
    expect(m.Helmet.scale).toBeLessThan(m.BodyArmor.scale);
  });

  it("provides a worn key and an icon fallback key per layer", () => {
    const inv = equip({ Helmet: bySlot("Helmet").id });
    const l = heroDressLayout(inv, BODY)[0];
    expect(l.key).toMatch(/^worn__/);
    expect(l.iconKey).toMatch(/^item__/);
  });

  it("marks wings as behind the body", () => {
    const wing = ITEM_CATALOG.find((d) => d.slot === "Wing");
    if (!wing) return; // catalog may omit wings; guard
    const inv = equip({ Wing: wing.id });
    const l = heroDressLayout(inv, BODY).find((x) => x.slot === "Wing")!;
    expect(l.behind).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/heroDressLayout.test.ts`
Expected: FAIL — cannot find module `heroDressLayout.ts`.

- [ ] **Step 3: Implement**

```ts
// src/data/heroDressLayout.ts
//
// Pure paper-doll dressing: map an equipped loadout to ordered worn-layer
// placements (helmet on the head, breastplate on the torso, weapon in hand,
// boots at the feet, wings behind), normalized to a body box. The single source
// of truth for both the equipment-screen doll and the home throne hero.
// Accessories (rings/amulet) and the pet are excluded — they don't read as worn
// on a body. Phaser-free, tested. See
// docs/superpowers/specs/2026-06-20-hero-worn-dressed-doll-design.md.
import type { ItemSlot } from "./schema.ts";
import type { InventorySave } from "../core/save.ts";
import { ITEM_CATALOG_MAP } from "./items.ts";
import { itemTex, wornTex } from "./assetKeys.ts";

export interface WornLayer {
  slot: ItemSlot;
  key: string; // preferred worn-art key (worn__<id>)
  iconKey: string; // fallback inventory icon (item__<id>)
  cx: number;
  cy: number;
  scale: number; // fraction of body height
  depth: number; // back→front
  behind: boolean; // drawn behind the body
}

// Body-region anchor (normalized within the body box), scale (× body height),
// depth, and behind flag per worn slot. Tuned to a front-facing full body.
interface Anchor {
  nx: number;
  ny: number;
  scale: number;
  depth: number;
  behind?: boolean;
}
const ANCHORS: Partial<Record<ItemSlot, Anchor>> = {
  Wing: { nx: 0.5, ny: 0.42, scale: 0.62, depth: 0, behind: true },
  BodyArmor: { nx: 0.5, ny: 0.46, scale: 0.42, depth: 3 },
  Helmet: { nx: 0.5, ny: 0.17, scale: 0.24, depth: 5 },
  Boots: { nx: 0.5, ny: 0.86, scale: 0.26, depth: 4 },
  Gloves: { nx: 0.74, ny: 0.56, scale: 0.18, depth: 6 },
  Weapon: { nx: 0.24, ny: 0.52, scale: 0.46, depth: 7 },
};

// Order matters only for stable output; depth drives draw order.
const WORN_SLOTS: ItemSlot[] = ["Wing", "BodyArmor", "Helmet", "Boots", "Gloves", "Weapon"];

function defFor(inventory: InventorySave, slot: ItemSlot) {
  const instId = inventory.equipped[slot];
  if (!instId) return null;
  const inst = inventory.items.find((i) => i.id === instId);
  if (!inst) return null;
  return ITEM_CATALOG_MAP.get(inst.defId) ?? null;
}

export function heroDressLayout(
  inventory: InventorySave,
  body: { x: number; y: number; w: number; h: number },
): WornLayer[] {
  const out: WornLayer[] = [];
  for (const slot of WORN_SLOTS) {
    const a = ANCHORS[slot];
    if (!a) continue;
    const def = defFor(inventory, slot);
    if (!def) continue;
    out.push({
      slot,
      key: wornTex(def.id),
      iconKey: itemTex(def.id),
      cx: body.x + a.nx * body.w,
      cy: body.y + a.ny * body.h,
      scale: a.scale,
      depth: a.depth,
      behind: a.behind ?? false,
    });
  }
  return out;
}
```

NOTE: this needs `wornTex` from `assetKeys.ts` (Task 2). To keep Task 1 green standalone, do Task 2 FIRST if executing strictly; the test for Task 1 asserts `key` matches `/^worn__/` so `wornTex` must exist. Reorder: run Task 2 Step 3 (add `wornTex`) before Task 1 Step 4.

- [ ] **Step 4: Run test to verify it passes** (after `wornTex` exists)

Run: `npx vitest run tests/heroDressLayout.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/heroDressLayout.ts tests/heroDressLayout.test.ts src/data/assetKeys.ts
git commit -m "feat(hero): pure heroDressLayout — equipped gear → worn body-layer placements"
```

---

### Task 2: `wornTex` asset key

**Files:**
- Modify: `src/data/assetKeys.ts`
- Test: `src/data/assetKeys.test.ts`

**Interfaces:**
- Produces: `export const wornTex = (id: string): string => \`worn__${id}\``.

- [ ] **Step 1: Add a failing test** — append to `src/data/assetKeys.test.ts`:

```ts
import { wornTex } from "./assetKeys.ts";
it("builds a worn-overlay key", () => {
  expect(wornTex("iron-sword")).toBe("worn__iron-sword");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/data/assetKeys.test.ts`
Expected: FAIL — `wornTex` is not exported.

- [ ] **Step 3: Implement** — in `src/data/assetKeys.ts`, beside `heroPoseTex`:

```ts
/** Worn-on-body overlay art for a gear item (transparent, slot-framed). */
export const wornTex = (id: string): string => `worn__${id}`;
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/data/assetKeys.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit** (folded into Task 1's commit if done together).

```bash
git add src/data/assetKeys.ts src/data/assetKeys.test.ts
git commit -m "feat(assets): wornTex key builder for worn-on-body overlays"
```

---

### Task 3: Dress the equipment-screen doll

**Files:**
- Modify: `src/scenes/HeroScene.ts` (the doll render block ~138-186 and the equipped-tiles loop ~330-340)
- Modify: `src/data/heroDoll.ts` (keep `DOLL_SLOTS` for drop-zones; no behavior change)

**Interfaces:**
- Consumes: `heroDressLayout`, `WornLayer` (Task 1).

Render worn layers over the mannequin instead of square icon tiles for *equipped* slots. Keep: the panel, the spotlight, the per-slot **drop Zones**, empty-slot ghost markers + labels (so equipping still works and empty slots are discoverable). Add a soft contact shadow under each worn layer to kill flatness.

- [ ] **Step 1:** Read `src/scenes/HeroScene.ts` fully (current turn) to locate the doll block and the `rebuild()`/equipped-tiles loop.

- [ ] **Step 2:** In the doll block, keep the empty-slot frame/label/zone, but stop drawing the 40px item tile for equipped slots in `rebuild()`. Instead, after computing the doll panel, build worn layers:

```ts
// inside create(), after DOLL_BASE_KEY image; store body box for rebuild()
this.dollBody = { x: dp.x, y: dp.y, w: dp.w, h: dp.h };
```

Add field: `private dollBody = { x: 0, y: 0, w: 0, h: 0 };` and a container `private dress!: Phaser.GameObjects.Container;` created with `.setDepth(2)` (above mannequin depth 1, below labels depth 5).

- [ ] **Step 3:** In `rebuild()`, replace the equipped-tile placement on the doll with worn-layer rendering:

```ts
// Dress the mannequin with worn gear (worn art if present, else inventory icon).
this.dress.removeAll(true);
for (const L of heroDressLayout(save.inventory, this.dollBody)) {
  const key = this.textures.exists(L.key) ? L.key : L.iconKey;
  if (!this.textures.exists(key)) continue;
  const img = this.add.image(L.cx, L.cy, key).setOrigin(0.5);
  const targetH = L.scale * this.dollBody.h;
  img.setScale(targetH / img.height);
  img.setDepth(L.behind ? 1.5 : 2 + L.depth * 0.01);
  this.dress.add(img);
}
```

(Empty slots still show their ghost frame + label from `create()`; equipped slots are now worn on the body. Keep the existing stat-panel + bag code unchanged.)

- [ ] **Step 4: Verify** — `npx tsc --noEmit` clean; `npx vitest run` green; `npm run lint` (HeroScene under 500 lines — if it crosses, extract the doll-dress helper into `src/scenes/heroDollDress.ts`).

- [ ] **Step 5: Commit**

```bash
git add src/scenes/HeroScene.ts src/data/heroDoll.ts
git commit -m "feat(hero): equipment doll wears gear on the body (worn layers, icon fallback)"
```

---

### Task 4: Dress the home throne hero

**Files:**
- Modify: `src/scenes/MainMenuScene.ts` (hero render ~120-134)
- Delete: `src/scenes/dressHero.ts` (superseded by `heroDressLayout`)

**Interfaces:**
- Consumes: `heroDressLayout` (Task 1).

The throne hero already shows a weapon-family pose. Compose worn armor/boots/gloves/wings over it using the hero figure's on-screen box. The pose already shows the weapon, so EXCLUDE `Weapon` here (pass a filter) to avoid a double weapon.

- [ ] **Step 1:** Read `src/scenes/MainMenuScene.ts` (current turn) around the hero block; capture the hero sprite's screen box (`hero.x`, top `hero.y - HERO_H/2`, width ≈ `HERO_H*0.7`, height `HERO_H`).

- [ ] **Step 2:** After creating `hero`, dress it:

```ts
const body = { x: hero.x - HERO_H * 0.35, y: hero.y - HERO_H / 2, w: HERO_H * 0.7, h: HERO_H };
for (const L of heroDressLayout(save.inventory, body)) {
  if (L.slot === "Weapon") continue; // the pose already holds the weapon
  const key = this.textures.exists(L.key) ? L.key : L.iconKey;
  if (!this.textures.exists(key)) continue;
  const img = this.add.image(L.cx, L.cy, key).setOrigin(0.5);
  img.setScale((L.scale * body.h) / img.height);
  img.setDepth(hero.depth + (L.behind ? -1 : 1));
}
```

- [ ] **Step 3:** Remove the now-dead `dressHero` import (already unused) and delete `src/scenes/dressHero.ts`. Confirm no other references: `grep -rn dressHero src/`.

- [ ] **Step 4: Verify** — `npx tsc --noEmit`; `npx vitest run`; `npm run lint`; `npm run lint:cycles` (0).

- [ ] **Step 5: Commit**

```bash
git add src/scenes/MainMenuScene.ts && git rm src/scenes/dressHero.ts
git commit -m "feat(hero): throne hero wears equipped armor/boots/wings (shared dress layout)"
```

---

### Task 5: Phase A verification (CDP repro)

**Files:**
- Modify: `scripts/playtest/repro_hero_worn.mjs` (already drafted) — add PASS assertions.

- [ ] **Step 1:** Extend the repro to assert, after equipping a full loadout: the HeroScene has worn-layer images on the doll (count ≥ 3) and the MainMenuScene throne hero has ≥ 2 dress images. Print `VERDICT: PASS/FAIL`.

- [ ] **Step 2:** Run via a dev server on a FREE port (kill stale vite first):

```bash
pkill -9 -f "[v]ite"; sleep 2
nohup npx vite --port 4188 --strictPort >/tmp/wt_vite.log 2>&1 &
nohup google-chrome --headless=new --disable-gpu --no-sandbox --remote-debugging-port=9222 about:blank >/tmp/wt_chrome.log 2>&1 &
# wait until curl localhost:4188 returns, then:
node scripts/playtest/repro_hero_worn.mjs --port=4188 --dir=/tmp
```

Expected: VERDICT PASS; screenshots show a dressed hero on both screens.

- [ ] **Step 3: Commit** the repro updates + send screenshots to the chat.

---

## Phase B — Purpose-built worn art (the "tons of art")

### Task 6: `worn` SDXL job kind

**Files:**
- Modify: `scripts/sdart/sdgen.mjs` (add the `worn` job kind + a slot-framed prompt)
- Modify: `scripts/sdart/prompts.mjs` (export a `wornFraming(slot)` helper)
- Reference: `scripts/sdart/itemVisual.json` (per-item `look` + `slot`)

**Interfaces:**
- Produces: PNGs at `public/assets/sprites/worn/<id>.png`, transparent-cut to 96px, for body-slot items only.

- [ ] **Step 1:** In `prompts.mjs`, add slot-specific worn framing wrappers:

```js
// Worn-on-body framing: render the gear alone, front-facing, transparent, so it
// composites cleanly onto a hero figure (NOT an inventory 3/4 hero shot).
export const WORN_FRAMING = {
  Weapon: "held upright front-facing, centered, full length in frame",
  Helmet: "a front-facing helmet/headgear only, centered, sized to fit a head",
  BodyArmor: "a front-facing chest breastplate/robe torso piece only, centered",
  Gloves: "a single front-facing gauntlet/glove, centered",
  Boots: "a front-facing pair of boots, centered",
  Wing: "a symmetric pair of wings spread, front-facing, centered",
};
export function wornPrompt(look, slot) {
  return `${look}, ${WORN_FRAMING[slot] || "centered front-facing"}, plain flat studio lighting, no character, no body, no background, transparent background, game asset`;
}
```

- [ ] **Step 2:** In `sdgen.mjs`, after the item jobs, push `worn` jobs for body slots:

```js
const WORN_SLOTS = new Set(["Weapon", "Helmet", "BodyArmor", "Gloves", "Boots", "Wing"]);
for (const it of itemVisual) {
  if (!WORN_SLOTS.has(it.slot)) continue;
  jobs.push({
    kind: "worn",
    id: it.id,
    file: `worn/${it.id}.png`,
    prompt: wornPrompt(it.look, it.slot),
    seed: seedOf("worn-" + it.id),
    w: 768, h: 768, size: 96,
  });
}
```

Ensure the writer creates `public/assets/sprites/worn/` and the cut step transparent-cuts to 96px (mirror the item kind). Support `--only=worn` and an `--slot=<Slot>` filter for phased batches.

- [ ] **Step 3:** Smoke-generate ONE item to validate framing:

Run: `node scripts/sdart/sdgen.mjs --only=worn --slot=BodyArmor --limit=1` (add a `--limit` guard if absent).
Expected: a transparent `public/assets/sprites/worn/<id>.png` ~96px. Eyeball it.

- [ ] **Step 4: Commit** the generator (not the art yet).

```bash
git add scripts/sdart/sdgen.mjs scripts/sdart/prompts.mjs scripts/sdart/prompts.d.mts
git commit -m "feat(art): worn SDXL job kind — slot-framed worn overlays from item appearance"
```

---

### Task 7: Manifest + preload wiring for worn art

**Files:**
- Modify: `scripts/sdart/sync_manifest.mjs` (scan `worn/` → `kind:"worn"` entries)
- Modify: `src/data/spriteManifest.ts` (generated entries)
- Modify: `src/scenes/PreloadScene.ts` (load `kind:"worn"` as plain images, no anims)

**Interfaces:**
- Consumes: `wornTex(id)` (Task 2) for the texture key (`worn__<id>`).

- [ ] **Step 1:** Teach `sync_manifest.mjs` to emit `{key: wornTex(id), kind:"worn", id, path:"assets/sprites/worn/<id>.png", frameWidth:96, frameHeight:96, frames:1, names:["worn"]}`.

- [ ] **Step 2:** In `PreloadScene.ts`, the existing manifest loop loads each entry's image; ensure `kind:"worn"` entries are loaded as static images and SKIPPED by the anim-builder loop (like `hero-pose`). Add `"worn"` to whatever kind-guard excludes single-frame poses from anim creation.

- [ ] **Step 3:** Run `node scripts/sdart/sync_manifest.mjs` after generating art (Task 8); verify worn entries appear in `spriteManifest.ts`.

- [ ] **Step 4: Verify + Commit**

Run: `npx tsc --noEmit`; `npx vitest run` (asset-key discipline test stays green — keys come from `wornTex`).

```bash
git add scripts/sdart/sync_manifest.mjs src/data/spriteManifest.ts src/scenes/PreloadScene.ts
git commit -m "feat(art): load worn overlays via manifest (static images, no anims)"
```

---

### Task 8: Generate the worn-art batches + ship

**Files:**
- Create (generated): `public/assets/sprites/worn/*.png`
- Modify: `src/data/assetVersion.ts` (bump), `src/data/spriteManifest.ts` (synced)

- [ ] **Step 1:** Generate by slot, highest silhouette impact first (re-run repro between batches to eyeball quality):

```bash
node scripts/sdart/sdgen.mjs --only=worn --slot=BodyArmor   # 48
node scripts/sdart/sdgen.mjs --only=worn --slot=Helmet      # 37
node scripts/sdart/sdgen.mjs --only=worn --slot=Weapon      # 106
node scripts/sdart/sdgen.mjs --only=worn --slot=Gloves      # 27
node scripts/sdart/sdgen.mjs --only=worn --slot=Boots       # 22
node scripts/sdart/sdgen.mjs --only=worn --slot=Wing
node scripts/sdart/sync_manifest.mjs
```

- [ ] **Step 2:** Bump `ASSET_VERSION` in `src/data/assetVersion.ts` (e.g. `2026-06-20c`).

- [ ] **Step 3:** Full verify: `npx tsc --noEmit`; `npx vitest run`; `npm run lint`; `npm run lint:cycles`; `npm run build`; run `repro_hero_worn.mjs` → screenshots show crisp worn gear.

- [ ] **Step 4: Commit + deploy**

```bash
git add public/assets/sprites/worn src/data/spriteManifest.ts src/data/assetVersion.ts
git commit -m "art(hero): worn overlays for all body-slot gear + ASSET_VERSION bump"
npm run build && npx firebase-tools deploy --only hosting
```

---

## Self-Review

- **Spec coverage:** Phase A (heroDressLayout + doll + throne) = Tasks 1-4; Phase A verify = Task 5; Phase B (worn art kind + manifest + gen + version) = Tasks 6-8. Battle-hero out-of-scope honored (untouched). Accessories excluded (Task 1). ✅
- **Placeholder scan:** all code steps contain real code; gen commands concrete. ✅
- **Type consistency:** `WornLayer` fields (`slot,key,iconKey,cx,cy,scale,depth,behind`) used identically in Tasks 1/3/4; `wornTex` signature consistent across Tasks 2/6/7. ✅
- **Ordering note:** Task 2 (`wornTex`) must land before Task 1's test passes — flagged in Task 1 Step 3.
