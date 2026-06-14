# Loading-Screen Key-Art Background Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate a cinematic anime loading-screen background composed from the tower + boss visual metadata via the SDXL flow, and display it instantly on the DOM splash behind the title/progress bar.

**Architecture:** A pure prompt-assembly module (`loadingPrompt.mjs`) condenses real `TOWER_VISUAL`/`BOSS_VISUAL` descriptors into a battlefield key-art scene prompt; a generator (`genLoadingBackground.mjs`) feeds it to the local Z-Image API and downscales to `public/assets/bg/loading.png`. A pure CSS helper (`loadingSplash.ts`) builds the splash `background` shorthand (dark gradient over the image); `main.ts` applies it at boot using `versioned()`.

**Tech Stack:** TypeScript, Vite, Vitest, Node ESM scripts, local Z-Image-Turbo HTTP API (`127.0.0.1:8765`), PIL (downscale).

---

### Task 1: Pure prompt-assembly module (TDD)

**Files:**
- Create: `scripts/sdart/loadingPrompt.mjs`
- Test: `tests/loadingPrompt.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/loadingPrompt.test.ts
import { describe, it, expect } from "vitest";
import { essence, buildLoadingPrompt } from "../scripts/sdart/loadingPrompt.mjs";

describe("essence", () => {
  it("keeps the first two comma clauses of a descriptor", () => {
    const d = "a cheerful spiky black-haired martial artist in an orange gi with a blue belt, energetic fighting stance, glowing golden ki around fists";
    expect(essence(d)).toBe(
      "a cheerful spiky black-haired martial artist in an orange gi with a blue belt, energetic fighting stance",
    );
  });
  it("returns a short descriptor unchanged", () => {
    expect(essence("a simple straight iron longsword")).toBe("a simple straight iron longsword");
  });
});

describe("buildLoadingPrompt", () => {
  const heroes = [
    "a cheerful spiky black-haired martial artist in an orange gi, glowing golden ki",
    "a dramatic crimson mage girl with a large pointed witch hat, raising an ornate glowing staff",
    "a determined young archer princess with long bright red hair, drawing a slender hunting bow",
  ];
  const boss = "a vengeful pale ash-skinned warrior with twin chained blades wreathed in roaring fire, flying embers";
  const { prompt, negative } = buildLoadingPrompt({ heroes, boss });

  it("weaves every hero essence into the prompt", () => {
    for (const h of heroes) expect(prompt).toContain(essence(h));
  });
  it("includes the boss and looming framing", () => {
    expect(prompt).toContain(essence(boss));
    expect(prompt.toLowerCase()).toMatch(/loom|towering|behind/);
  });
  it("frames it as an anime battlefield key-art scene", () => {
    expect(prompt.toLowerCase()).toContain("anime");
    expect(prompt.toLowerCase()).toMatch(/key art|splash|poster|battlefield/);
  });
  it("negative bans the isolated-on-white sprite framing", () => {
    expect(negative.toLowerCase()).toContain("white background");
    expect(negative.toLowerCase()).toMatch(/isolated|single character|sprite/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/loadingPrompt.test.ts`
Expected: FAIL — cannot resolve `../scripts/sdart/loadingPrompt.mjs` / exports undefined.

- [ ] **Step 3: Write minimal implementation**

```js
// scripts/sdart/loadingPrompt.mjs
// Pure assembly of the loading-screen KEY-ART prompt from character descriptors.
// A SCENE (not an isolated sprite): a heroic trio rallying before a looming boss.
// No API calls, no Phaser — unit-tested in tests/loadingPrompt.test.ts.

/** Condense a character descriptor to its silhouette essence (first 2 clauses)
 *  so a multi-character scene prompt stays readable instead of blurring. */
export function essence(descriptor) {
  const parts = descriptor.split(",").map((s) => s.trim());
  return parts.slice(0, 2).join(", ");
}

const WRAPPER =
  "epic anime battlefield key art splash poster, dramatic low hero angle, " +
  "dusk war-torn battlefield, volumetric god-ray light shafts, drifting embers " +
  "and smoke, rim light, cinematic composition with clear foreground and " +
  "background depth, fantasy anime game illustration, highly detailed, painterly, " +
  "vibrant saturated colors";

const NEG =
  "isolated on white background, white background, plain background, single " +
  "character, sprite, character sheet, multiple panels, thumbnails, duplicate " +
  "faces, extra limbs, extra fingers, fused bodies, merged characters, blurry " +
  "faces, user interface, UI, hud, text, words, watermark, logo, signature, " +
  "frame, border, lowres, jpeg artifacts, deformed";

/** Build the loading key-art prompt from a hero trio + one boss descriptor. */
export function buildLoadingPrompt({ heroes, boss }) {
  const trio = heroes.map(essence);
  const foreground =
    "In the lower foreground three heroic champions stand together " +
    "shoulder to shoulder facing the viewer: " +
    trio.map((h, i) => `${["first", "second", "third"][i] ?? "another"}, ${h}`).join("; ") +
    ".";
  const background =
    "Rising and looming in the smoky background towers a single colossal boss: " +
    `${essence(boss)}.`;
  const prompt = `${WRAPPER}. ${foreground} ${background}`;
  return { prompt, negative: NEG };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/loadingPrompt.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/sdart/loadingPrompt.mjs tests/loadingPrompt.test.ts
git commit -m "feat(loading): pure key-art prompt assembly from tower+boss metadata"
```

---

### Task 2: Pure splash-background CSS helper (TDD)

**Files:**
- Create: `src/core/loadingSplash.ts`
- Test: `tests/loadingSplash.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/loadingSplash.test.ts
import { describe, it, expect } from "vitest";
import { loadingSplashBackground } from "../src/core/loadingSplash.ts";

describe("loadingSplashBackground", () => {
  const css = loadingSplashBackground("assets/bg/loading.png?v=2026-06-14c");

  it("embeds the url in a url(...) layer", () => {
    expect(css).toContain('url("assets/bg/loading.png?v=2026-06-14c")');
  });
  it("covers and centers the image", () => {
    expect(css).toContain("center");
    expect(css).toContain("cover");
    expect(css).toContain("no-repeat");
  });
  it("layers a dark readability gradient before the image", () => {
    expect(css.indexOf("linear-gradient")).toBeLessThan(css.indexOf("url("));
    expect(css).toMatch(/rgba\(\s*5\s*,\s*7\s*,\s*12/);
  });
  it("passes the url through verbatim (cache-bust query preserved)", () => {
    expect(loadingSplashBackground("a/b.png?v=X")).toContain('url("a/b.png?v=X")');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/loadingSplash.test.ts`
Expected: FAIL — cannot find module `../src/core/loadingSplash.ts`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/core/loadingSplash.ts
/**
 * Pure CSS for the DOM loading splash (#loading-splash) backdrop. Layers a dark
 * top-to-bottom gradient OVER the painted key-art image so the gold title and
 * progress bar stay legible. Phaser-free; consumed by main.ts at boot.
 */

/** `background` shorthand: dark readability gradient over a cover-fit image. */
export function loadingSplashBackground(url: string): string {
  return (
    `linear-gradient(rgba(5, 7, 12, 0.55), rgba(5, 7, 12, 0.78)), ` +
    `url("${url}") center / cover no-repeat`
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/loadingSplash.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/loadingSplash.ts tests/loadingSplash.test.ts
git commit -m "feat(loading): pure splash-background CSS helper (gradient over key art)"
```

---

### Task 3: Wire splash background into boot

**Files:**
- Modify: `src/main.ts` (after `installLogger();`, before `new Phaser.Game`)
- Modify: `src/data/assetVersion.ts:17` (bump token)

- [ ] **Step 1: Apply the splash background at boot**

In `src/main.ts`, add the imports near the other core imports:

```ts
import { loadingSplashBackground } from "./core/loadingSplash.ts";
import { versioned } from "./data/assetVersion.ts";
```

Then immediately after `installLogger();` insert:

```ts
// Paint the SDXL key-art behind the DOM loading splash the instant boot runs
// (before Phaser mounts) so the first frame the player sees is the roster, not
// a flat panel. Versioned so an art regen busts the immutable cache.
{
  const splash = document.getElementById("loading-splash");
  if (splash) {
    splash.style.background = loadingSplashBackground(versioned("assets/bg/loading.png"));
  }
}
```

- [ ] **Step 2: Bump the asset version**

In `src/data/assetVersion.ts`, change line 17:

```ts
export const ASSET_VERSION = "2026-06-14c";
```

- [ ] **Step 3: Verify typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: no type errors; build succeeds (pre-existing chunk-size warning only).

- [ ] **Step 4: Commit**

```bash
git add src/main.ts src/data/assetVersion.ts
git commit -m "feat(loading): paint SDXL key-art behind the DOM splash at boot"
```

---

### Task 4: SDXL generator script

**Files:**
- Create: `scripts/sdart/genLoadingBackground.mjs`

- [ ] **Step 1: Write the generator**

```js
// scripts/sdart/genLoadingBackground.mjs
// Generate the loading-screen KEY-ART background from the tower + boss visual
// metadata. Full-scene (no white cutout) like genBackgrounds.mjs: render 16:9 at
// 1024x576 (API needs multiples of 32) and downscale to the 960x540 canvas.
// Usage: vite-node scripts/sdart/genLoadingBackground.mjs [--n 4]
//   Review public/assets/bg/loading-cand-<seed>.png, copy the best to loading.png.
import { writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { TOWER_VISUAL, BOSS_VISUAL } from "./prompts.mjs";
import { buildLoadingPrompt } from "./loadingPrompt.mjs";

const SD = "http://127.0.0.1:8765/generate";
const GW = 1024, GH = 576, W = 960, H = 540;
const OUT = "public/assets/bg";

// Curated cast (visually diverse silhouettes/colours/roles) pulled straight from
// the roster metadata so the poster reflects the real characters' looks.
const HERO_IDS = ["karu-sunfist", "megu-explosion-sage", "aya-dawnshot"];
const BOSS_ID = "ashghost";

const heroes = HERO_IDS.map((id) => TOWER_VISUAL[id]);
const boss = BOSS_VISUAL[BOSS_ID];
const { prompt, negative } = buildLoadingPrompt({ heroes, boss });

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : d;
};
const N = Number(arg("n", 4));

async function gen(seed) {
  const res = await fetch(SD, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      negative_prompt: negative,
      steps: 30,
      width: GW,
      height: GH,
      seed,
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf[0] !== 0x89 || buf[1] !== 0x50) throw new Error("not a PNG");
  return buf;
}

console.log("PROMPT:\n" + prompt + "\n");
const seeds = Array.from({ length: N }, (_, i) => 88000 + i * 211);
for (const s of seeds) {
  try {
    const raw = `${OUT}/loading-cand-${s}.raw.png`;
    const out = `${OUT}/loading-cand-${s}.png`;
    writeFileSync(raw, await gen(s));
    execFileSync("python3", [
      "-c",
      `from PIL import Image;import sys;Image.open(sys.argv[1]).convert("RGB").resize((${W},${H}),Image.LANCZOS).save(sys.argv[2])`,
      raw,
      out,
    ]);
    execFileSync("rm", ["-f", raw]);
    console.log(`wrote ${out}`);
  } catch (e) {
    console.log(`seed ${s} failed: ${e.message}`);
  }
}
console.log("Review candidates, then copy the best over loading.png");
```

- [ ] **Step 2: Generate candidates**

Run: `npx vite-node scripts/sdart/genLoadingBackground.mjs --n 4`
Expected: prints the composed prompt, then `wrote public/assets/bg/loading-cand-<seed>.png` for each seed (Z-Image API must be up — `curl -s http://127.0.0.1:8765/health`).

- [ ] **Step 3: Pick the best candidate**

Inspect the candidates (open the PNGs / send them to chat). Copy the strongest:

```bash
cp public/assets/bg/loading-cand-<bestseed>.png public/assets/bg/loading.png
rm -f public/assets/bg/loading-cand-*.png
```

- [ ] **Step 4: Commit the art + generator**

```bash
git add scripts/sdart/genLoadingBackground.mjs public/assets/bg/loading.png
git commit -m "art(loading): generate SDXL anime key-art loading background"
```

---

### Task 5: Verify whole + memory

**Files:** none (verification + memory)

- [ ] **Step 1: Full verification**

Run: `npx vitest run && npx tsc --noEmit && npx eslint src/core/loadingSplash.ts src/main.ts && npm run build`
Expected: all tests pass (suite + 10 new); no type errors; eslint clean; build succeeds.

- [ ] **Step 2: Confirm the splash renders the image**

Sanity-check `public/assets/bg/loading.png` exists and is a valid ~960×540 PNG:

```bash
python3 -c "from PIL import Image; im=Image.open('public/assets/bg/loading.png'); print(im.size, im.mode)"
```
Expected: `(960, 540) RGB`.

- [ ] **Step 3: Update memory**

Update `project_loading_backdrop` memory (and add a one-line index pointer if a new file is warranted): note that the DOM splash now carries an SDXL key-art background generated from tower+boss metadata (`genLoadingBackground.mjs` + pure `loadingPrompt.mjs`), applied in `main.ts` via `loadingSplash.ts` + `versioned()`; the procedural Phaser backdrop remains the under-canvas fallback.

- [ ] **Step 4: Final clean-tree check**

Run: `git status --porcelain`
Expected: empty (all committed).

---

## Self-Review

**Spec coverage:**
- Goal 1 (art from metadata) → Task 1 (prompt) + Task 4 (generator pulls real `TOWER_VISUAL`/`BOSS_VISUAL`). ✓
- Goal 2 (instant display + legible bar) → Task 2 (gradient helper) + Task 3 (boot wiring). ✓
- Goal 3 (reproducible, cache-safe, conventions, TDD) → versioned()/ASSET_VERSION bump (Task 3), TDD on both pure modules (Tasks 1–2), `<500`-line focused files, verify gate (Task 5). ✓
- Non-goals respected: procedural backdrop untouched, no new battle/menu bg, no animation.

**Placeholder scan:** No TBD/TODO; every code step shows full content. ✓

**Type consistency:** `buildLoadingPrompt({heroes, boss})` returns `{prompt, negative}` — used identically in Task 1 test and Task 4 generator. `essence()` signature consistent. `loadingSplashBackground(url: string): string` consistent between Task 2 and Task 3. `versioned()`/`ASSET_VERSION` match existing `assetVersion.ts`. ✓

**Note:** `.mjs` imported from a `.ts` Vitest test resolves under the repo's Node/Vite ESM config (other `scripts/sdart/*.mjs` are plain ESM with named exports). If Vitest cannot resolve the `.mjs` from `tests/`, fall back to importing via relative path with explicit extension (already used) — confirm at Task 1 Step 2.
