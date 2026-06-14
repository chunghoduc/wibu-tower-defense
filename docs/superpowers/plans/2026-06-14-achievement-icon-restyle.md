# Achievement Icon Restyle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the 20 achievement icons from flat "trophy-medal clipart" to the game's house cel-shaded anime game-asset look, then regenerate and ship them.

**Architecture:** Prompt-only change to the SDXL flow. Rewrite the `ACHIEVEMENT_STYLE`/`ACHIEVEMENT_NEG` wrapper strings in `scripts/sdart/prompts.mjs` to mirror `ITEM_STYLE`'s painted-asset language, lightly reword the 20 motif strings, regenerate the PNGs, bump `ASSET_VERSION`. Runtime (scene, keys, catalog) is untouched.

**Tech Stack:** Node SDXL pipeline (`scripts/sdart/sdgen.mjs` → local z-image server on `127.0.0.1:8765`), Vitest, Phaser 3, CDP playtest.

---

## File Structure

- `scripts/sdart/prompts.mjs` — MODIFY: `ACHIEVEMENT_STYLE`, `ACHIEVEMENT_NEG`, and the `ACHIEVEMENT_VISUAL` motif strings (keys unchanged).
- `tests/achievementIconPrompts.test.ts` — MODIFY: add a house-style guard `describe` block.
- `src/data/assetVersion.ts` — MODIFY: bump `ASSET_VERSION`.
- `public/assets/sprites/achievement/*.png` — REGENERATE: 20 files (build artifacts).
- `scripts/playtest/repro_achievement_icons.mjs` — REUSE as-is for visual proof.

---

### Task 1: Restyle the achievement prompt wrapper (TDD)

**Files:**
- Modify: `tests/achievementIconPrompts.test.ts`
- Modify: `scripts/sdart/prompts.mjs:324-332` (`ACHIEVEMENT_STYLE`, `ACHIEVEMENT_NEG`) and `277-323` (`ACHIEVEMENT_VISUAL`)

- [ ] **Step 1: Write the failing test**

Add this block to the END of `tests/achievementIconPrompts.test.ts` (and add the import to the existing prompts import line so it reads `import { ACHIEVEMENT_VISUAL, achievementIconStyle } from "../scripts/sdart/prompts.mjs";`):

```ts
describe("achievement-icon house style", () => {
  const sample = achievementIconStyle("a gold medal of a star");

  it("uses the house cel-shaded game-asset language", () => {
    expect(sample).toContain("cel-shaded anime game asset");
    expect(sample).toContain("soft rim light");
  });

  it("drops the flat-clipart UI-badge framing", () => {
    expect(sample).not.toContain("flat cel-shaded game UI icon");
    expect(sample).not.toContain("trophy medal badge");
    expect(sample).not.toContain("ribbon tab");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/achievementIconPrompts.test.ts`
Expected: FAIL — "house style" block fails because the current `ACHIEVEMENT_STYLE` contains "trophy medal badge", "ribbon tab", and "flat cel-shaded game UI icon", and lacks "cel-shaded anime game asset" / "soft rim light". The pre-existing blocks still PASS.

- [ ] **Step 3: Rewrite the wrapper strings**

In `scripts/sdart/prompts.mjs`, replace `ACHIEVEMENT_STYLE` (currently lines ~324-325):

```js
const ACHIEVEMENT_STYLE =
  "a single ornate cel-shaded anime game trophy medallion award icon, {V}, sculpted metallic relief with real depth, glossy highlights and soft rim light, clean cel-shaded anime game asset, bold clean outline, centered, isolated on a plain solid light grey background, no shadow, no text, no numbers";
```

Replace `ACHIEVEMENT_NEG` (currently lines ~326-327):

```js
const ACHIEVEMENT_NEG =
  "flat sticker, flat clipart, flat vector icon, 2d sticker, ribbon tab, lanyard, character, person, creature, hero, knight figure, full body, anime girl, realistic, photo, complex scene, landscape, multiple medals, multiple objects, busy, gradient background, drop shadow, watermark, text, letters, numbers, signature, frame, border";
```

- [ ] **Step 4: Reword the 20 motif strings (keep them distinct, keys unchanged)**

In `scripts/sdart/prompts.mjs`, within `ACHIEVEMENT_VISUAL`, replace every occurrence of the substring `" embossed with "` (it appears in all 20 values) with `" sculpted in raised relief with "`. Use an editor replace-all on that exact substring. Do NOT touch the keys (the achievement ids) or the tier-metal words (bronze/silver/gold/obsidian). Example result:

```js
  "clear-stage-3":
    "a bronze medal sculpted in raised relief with a single blood-dripping dagger crossing a small round shield, crimson accents",
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/achievementIconPrompts.test.ts`
Expected: PASS — all four blocks (one-per-id, non-empty, distinct, key-namespacing, AND the new house-style block) green. The reword keeps all 20 values distinct, so the "distinct emblem description" test still passes.

- [ ] **Step 6: Commit**

```bash
git add scripts/sdart/prompts.mjs tests/achievementIconPrompts.test.ts
git commit -m "feat(art): restyle achievement icons to the house cel-shaded game-asset look (TDD)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Regenerate the 20 PNGs + bump ASSET_VERSION

**Files:**
- Regenerate: `public/assets/sprites/achievement/*.png`
- Modify: `src/data/assetVersion.ts:17`

- [ ] **Step 1: Confirm the SD server is up**

Run: `curl -s -m 3 -X POST http://127.0.0.1:8765/generate -H 'Content-Type: application/json' -d '{}' -o /dev/null -w "%{http_code}\n"`
Expected: `422` (endpoint exists, validates). If `000`/connection refused, the z-image server is not running — start it before continuing.

- [ ] **Step 2: Regenerate only the achievement kind, forcing overwrite**

Run: `npm run gen:sprites -- --only achievement --force`
Expected: 20 jobs `[n/20] achievement/<id>.png` complete; files refreshed under `public/assets/sprites/achievement/`.

- [ ] **Step 3: Sanity-check the output PNGs are 128px and non-empty**

Run: `for f in public/assets/sprites/achievement/*.png; do python3 -c "from PIL import Image; im=Image.open('$f'); print('$f', im.size)"; done | head`
Expected: each prints `... (128, 128)`. (Cut size is 128 per `sdgen.mjs`.)

- [ ] **Step 4: Bump ASSET_VERSION**

In `src/data/assetVersion.ts`, change line 17 from `export const ASSET_VERSION = "2026-06-14i";` to:

```ts
export const ASSET_VERSION = "2026-06-14j";
```

- [ ] **Step 5: Commit**

```bash
git add public/assets/sprites/achievement src/data/assetVersion.ts
git commit -m "feat(art): regenerate achievement icons in house style + bump ASSET_VERSION

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Verify + visual proof

**Files:**
- Reuse: `scripts/playtest/repro_achievement_icons.mjs`

- [ ] **Step 1: Full typecheck + test suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc clean; all tests PASS (including `achievementIconPrompts.test.ts`).

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: build succeeds (only the routine >500kB chunk-size warning).

- [ ] **Step 3: Build a contact sheet of the 20 regenerated icons**

Run:
```bash
python3 - <<'PY'
from PIL import Image
import glob, os
files = sorted(glob.glob("public/assets/sprites/achievement/*.png"))
cols, cell = 5, 140
rows = (len(files)+cols-1)//cols
sheet = Image.new("RGBA", (cols*cell, rows*cell), (40,44,52,255))
for i,f in enumerate(files):
    im = Image.open(f).convert("RGBA").resize((128,128))
    x=(i%cols)*cell+6; y=(i//cols)*cell+6
    sheet.alpha_composite(im,(x,y))
sheet.save("/tmp/achievement_contact_sheet.png")
print("wrote /tmp/achievement_contact_sheet.png", len(files), "icons")
PY
```
Expected: writes `/tmp/achievement_contact_sheet.png` with 20 icons.

- [ ] **Step 4: Live in-scene proof (best effort)**

If a dev server + headless Chrome are available, run the existing repro:
```bash
npx vite --port 4188 >/tmp/vite_ach.log 2>&1 &
/usr/bin/google-chrome --headless=new --remote-debugging-port=9222 --no-sandbox about:blank >/tmp/chrome_ach.log 2>&1 &
sleep 4
node scripts/playtest/repro_achievement_icons.mjs --port=4188 --shot=/tmp/achievement_board.png
```
Expected: `VERDICT: PASS` (>=4 medallion images, 0 MISSING). Kill the `[v]ite` and chrome procs after (`pkill -f '[v]ite --port 4188'`). If headless infra is unavailable, the contact sheet from Step 3 is sufficient proof.

- [ ] **Step 5: Send the contact sheet to chat**

Emit in the message: `[[send: /tmp/achievement_contact_sheet.png]]` (and `[[send: /tmp/achievement_board.png]]` if Step 4 produced it).

---

### Task 4: Ship + record

- [ ] **Step 1: Push**

```bash
git push origin main
```
Expected: commits land on `github.com:chunghoduc/wibu-tower-defense.git` `main`.

- [ ] **Step 2: Deploy (local — CI deploy is broken)**

```bash
npx firebase-tools deploy --only hosting
```
Expected: "Deploy complete!" — live at https://wibu-tower-defense-d8b1c.web.app with the new `ASSET_VERSION` cache-bust.

- [ ] **Step 3: Update memory**

Update `memory/project_achievement_medallions.md` to note the 2026-06-14 restyle (flat UI-badge → house cel-shaded game-asset look; prompt-only + regen; ASSET_VERSION j). Keep the MEMORY.md pointer one line.
