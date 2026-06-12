# Fix Broken Tower Art Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore all 7 sub-8-frame tower sprites to clean, consistent, vibrant 8-frame sheets at parity with the other 46 towers.

**Architecture:** Harden the slice pipeline (ghost-frame guard), regenerate the 7 sheets through a bounded seed-retry harness until each yields exactly 8 opaque frames, sync the 7 `spriteManifest.ts` entries, and lock the result with a Vitest manifest-contract test.

**Tech Stack:** TypeScript + Vitest, Node `.mjs` regen scripts, Python `sliceanim.py` (rembg/PIL), local z-image-turbo SD server at `127.0.0.1:8765`.

---

## Target towers (frames today → 8)

`seren-skyfall` (1), `auriel-wardlight` (2), `lyran-ricochet` (2), `vesska-venombolt` (3), `rivka-rebound` (4), `aya-dawnshot` (5), `garron-unbreaking-pillar` (7). All cell size 128.

## File structure

- Create `tests/towerSpriteManifest.test.ts` — manifest-contract test (the TDD anchor).
- Modify `scripts/sdart/sliceanim.py` — add ghost-frame opacity guard + `--min-frames` reject.
- Create `scripts/sdart/regen_towers.mjs` — bounded seed-retry regen for an explicit id list.
- Modify `public/assets/sprites/tower/<id>.png` + `<id>.json` (×7) — regenerated assets.
- Modify `src/data/spriteManifest.ts` — sync 7 tower entries to `frames:8` + names.

---

### Task 1: Manifest-contract test (RED)

**Files:**
- Test: `tests/towerSpriteManifest.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { SPRITE_MANIFEST } from "../src/data/spriteManifest.ts";

const CANONICAL_8 = ["idle1", "idle2", "atk1", "atk2", "atk3", "skill1", "skill2", "skill3"];

describe("tower sprite manifest contract", () => {
  const towers = SPRITE_MANIFEST.filter((e) => e.kind === "tower");

  it("has the expected tower roster size", () => {
    expect(towers.length).toBe(53);
  });

  for (const e of towers) {
    it(`${e.id} has a full 8-frame sheet`, () => {
      expect(e.frames, `${e.id} frames`).toBe(8);
      expect(e.names.length, `${e.id} names length`).toBe(e.frames);
      expect(e.names, `${e.id} names pattern`).toEqual(CANONICAL_8);
    });
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/towerSpriteManifest.test.ts`
Expected: FAIL — 7 cases fail (`auriel-wardlight`, `aya-dawnshot`, `garron-unbreaking-pillar`, `lyran-ricochet`, `rivka-rebound`, `seren-skyfall`, `vesska-venombolt`); 46 pass.

- [ ] **Step 3: Commit the RED test**

```bash
git add tests/towerSpriteManifest.test.ts
git commit -m "test(tower-art): lock 8-frame manifest contract (RED)"
```

> Note: the canonical names assertion requires regen to also produce exactly `["idle1","idle2","atk1","atk2","atk3","skill1","skill2","skill3"]`. `sliceanim._frame_names(8)` already yields this (2 idle + 3 atk + 3 skill) for n=8, so a clean 8-frame slice satisfies it.

---

### Task 2: Ghost-frame guard in sliceanim.py

**Files:**
- Modify: `scripts/sdart/sliceanim.py` (the `main()` figure-filter block, ~lines 81–99)

- [ ] **Step 1: Add an opacity guard helper + apply it after the portrait filter**

After the existing `boxes = [...]` portrait filter and BEFORE the single-frame
fallback, drop figures that are mostly transparent (the ghost cutouts). Insert:

```python
    # Ghost-frame guard: a partial/failed cutout packs as a faint semi-transparent
    # figure. Reject boxes whose mean alpha over the bbox is below a floor so we
    # never emit a ghost frame (this caused rivka/vesska faded frames).
    def _solid(b):
        x0, y0, x1, y1 = b
        sub = alpha[y0:y1 + 1, x0:x1 + 1]
        return sub.size > 0 and (sub > 30).mean() >= 0.20 and sub.mean() >= 60
    boxes = [b for b in boxes if _solid(b)]
```

(`alpha` is already in scope from `alpha = np.asarray(cut)[:, :, 3]`.)

- [ ] **Step 2: Add a `--min-frames` reject so the harness can detect short slices**

In `main()` signature change `def main(inp, outp, cell=128, max_frames=12):` to
`def main(inp, outp, cell=128, max_frames=12, min_frames=1):`. After `n = len(boxes)`
and the `if n == 0` check, add:

```python
    if n < min_frames:
        print(f"TOO FEW FRAMES: {n} < {min_frames}")
        return n
```

And in the CLI arg loop add:

```python
        elif args[i] == "--min-frames": kw["min_frames"] = int(args[i+1]); i += 2
```

- [ ] **Step 3: Sanity-run on an existing GOOD sheet's source is not needed; just byte-compile**

Run: `python3 -c "import ast; ast.parse(open('scripts/sdart/sliceanim.py').read()); print('ok')"`
Expected: `ok`

- [ ] **Step 4: Commit**

```bash
git add scripts/sdart/sliceanim.py
git commit -m "feat(sdart): reject ghost/faint frames in sliceanim + --min-frames"
```

---

### Task 3: Seed-retry regen harness

**Files:**
- Create: `scripts/sdart/regen_towers.mjs`

- [ ] **Step 1: Write the harness**

```js
// Regenerate clean 8-frame sheets for an explicit tower id list. For each id, try
// a sequence of seeds and KEEP the first sheet that slices to exactly 8 opaque
// frames (sliceanim --min-frames 8 ghost-guarded). Records winning seeds to
// scripts/sdart/regen_seeds.json for reproducibility.
// Usage: vite-node scripts/sdart/regen_towers.mjs --ids=a,b,c [--tries=10]
import { mkdirSync, existsSync, writeFileSync, readFileSync, copyFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { TOWER_VISUAL, charSheetPrompt, SHEET_NEGATIVE } from "./animprompts.mjs";

const SD = "http://127.0.0.1:8765/generate";
const SLICE = "scripts/sdart/sliceanim.py";
const RAW = "/tmp/sdraw";
const GAME = "public/assets/sprites/tower";
const SEEDFILE = "scripts/sdart/regen_seeds.json";
mkdirSync(RAW, { recursive: true });

const arg = (n) => { const h = process.argv.find((a) => a.startsWith(`--${n}=`)); return h ? h.split("=").slice(1).join("=") : undefined; };
const ids = (arg("ids") || "").split(",").map((s) => s.trim()).filter(Boolean);
const tries = parseInt(arg("tries") || "12", 10);
if (!ids.length) { console.error("need --ids="); process.exit(1); }

function seedOf(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) % 1000000; }

async function sd(prompt, neg, seed, w, h) {
  for (let a = 1; a <= 2; a++) {
    try {
      const r = await fetch(SD, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, negative_prompt: neg, steps: 34, width: w, height: h, seed }) });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const b = Buffer.from(await r.arrayBuffer());
      if (b[0] !== 0x89) throw new Error("not PNG");
      return b;
    } catch (e) { console.log("   gen fail " + a + ": " + e.message); }
  }
  return null;
}

function sliceFrames(raw, out) {
  // returns frame count produced (0 if short/failed). --min-frames 8 makes a short
  // slice return its (small) n and NOT overwrite a good prior result.
  try {
    const o = execFileSync("python3", [SLICE, raw, out, "--cell", "128", "--max-frames", "8", "--min-frames", "8"], { encoding: "utf8" });
    const m = o.match(/sliced (\d+) frames/);
    return m ? parseInt(m[1], 10) : 0;
  } catch { return 0; }
}

const seeds = existsSync(SEEDFILE) ? JSON.parse(readFileSync(SEEDFILE, "utf8")) : {};

for (const id of ids) {
  const v = TOWER_VISUAL[id];
  if (!v) { console.log(`SKIP ${id}: no TOWER_VISUAL`); continue; }
  const prompt = charSheetPrompt(v);
  const out = `${GAME}/${id}.png`;
  const tmpOut = `/tmp/sdraw/slice__${id}.png`;
  let won = null;
  for (let t = 0; t < tries; t++) {
    const seed = (seedOf("a" + id) + t * 97 + 1) % 1000000;
    console.log(`[${id}] try ${t + 1}/${tries} seed ${seed}`);
    const buf = await sd(prompt, SHEET_NEGATIVE, seed, 1536, 640);
    if (!buf) continue;
    const raw = `${RAW}/regen__${id}.png`;
    writeFileSync(raw, buf);
    const n = sliceFrames(raw, tmpOut);
    console.log(`   -> ${n} frames`);
    if (n === 8) { won = { seed, raw, tmpOut }; break; }
  }
  if (!won) { console.log(`[${id}] FAILED to reach 8 frames in ${tries} tries — leaving existing art`); continue; }
  // promote: copy slice png + its json sidecar over the live asset
  copyFileSync(won.tmpOut, out);
  copyFileSync(won.tmpOut.replace(/\.png$/, ".json"), out.replace(/\.png$/, ".json"));
  seeds[id] = won.seed;
  writeFileSync(SEEDFILE, JSON.stringify(seeds, null, 2));
  console.log(`[${id}] DONE seed ${won.seed}`);
}
console.log("regen complete");
```

- [ ] **Step 2: Byte-check the script parses**

Run: `node --check scripts/sdart/regen_towers.mjs && echo ok`
Expected: `ok`

- [ ] **Step 3: Commit the harness (before running it)**

```bash
git add scripts/sdart/regen_towers.mjs
git commit -m "feat(sdart): bounded seed-retry regen harness for tower sheets"
```

---

### Task 4: Regenerate the 7 sheets

**Files:**
- Modify (generated): `public/assets/sprites/tower/{seren-skyfall,auriel-wardlight,lyran-ricochet,vesska-venombolt,rivka-rebound,aya-dawnshot,garron-unbreaking-pillar}.png` + `.json`
- Create (generated): `scripts/sdart/regen_seeds.json`

- [ ] **Step 1: Confirm SD server is up**

Run: `curl -s -m 5 http://127.0.0.1:8765/health`
Expected: JSON containing `"ready":true`.

- [ ] **Step 2: Run the harness for all 7**

Run:
```bash
npx vite-node scripts/sdart/regen_towers.mjs \
  --ids=seren-skyfall,auriel-wardlight,lyran-ricochet,vesska-venombolt,rivka-rebound,aya-dawnshot,garron-unbreaking-pillar \
  --tries=14
```
Expected: each id logs `DONE seed <n>`. If any logs `FAILED`, re-run that id alone with a higher `--tries` (e.g. 24). Do NOT proceed for an id still short of 8.

- [ ] **Step 3: Verify every regenerated json reports 8 frames**

Run:
```bash
for f in seren-skyfall auriel-wardlight lyran-ricochet vesska-venombolt rivka-rebound aya-dawnshot garron-unbreaking-pillar; do
  python3 -c "import json;d=json.load(open('public/assets/sprites/tower/$f.json'));print('$f',d['frames'],d['names'])"
done
```
Expected: every line ends with `8 ['idle1', 'idle2', 'atk1', 'atk2', 'atk3', 'skill1', 'skill2', 'skill3']`.

- [ ] **Step 4: Visual QA montage (all 8 frames of each regenerated tower)**

Render a montage (reuse the `/tmp/tower_broken_frames.png` script pattern) and view it.
Confirm: 8 distinct frames each, consistent character across frames, no ghost/faded
frames, vibrant. If any tower still looks inconsistent (e.g. a frame is a different
character), re-run just that id (new tries shift the seed) until clean.

- [ ] **Step 5: Commit the regenerated assets + seeds**

```bash
git add public/assets/sprites/tower/*.png public/assets/sprites/tower/*.json scripts/sdart/regen_seeds.json
git commit -m "art(tower-art): regenerate 7 broken towers to clean 8-frame sheets"
```

---

### Task 5: Sync spriteManifest.ts (GREEN)

**Files:**
- Modify: `src/data/spriteManifest.ts` (7 tower entries)

- [ ] **Step 1: Patch the 7 entries from their regenerated json sidecars**

Run this sync script (rewrites only the 7 entries' `frames`/`names` in place):

```bash
python3 - <<'PY'
import re, json
ids=["seren-skyfall","auriel-wardlight","lyran-ricochet","vesska-venombolt","rivka-rebound","aya-dawnshot","garron-unbreaking-pillar"]
p="src/data/spriteManifest.ts"; src=open(p).read()
for tid in ids:
    d=json.load(open(f"public/assets/sprites/tower/{tid}.json"))
    names=json.dumps(d["names"])
    # update frames
    src=re.sub(r'("key":"tower__'+re.escape(tid)+r'".*?"frames":)\d+', r'\g<1>'+str(d["frames"]), src)
    # update names array for this entry
    src=re.sub(r'("key":"tower__'+re.escape(tid)+r'".*?"names":)\[[^\]]*\]', r'\g<1>'+names, src)
open(p,"w").write(src)
print("patched", ids)
PY
```

- [ ] **Step 2: Verify the manifest now reads 8 frames for all 7**

Run:
```bash
node -e "const m=require('fs').readFileSync('src/data/spriteManifest.ts','utf8');for(const id of ['seren-skyfall','auriel-wardlight','lyran-ricochet','vesska-venombolt','rivka-rebound','aya-dawnshot','garron-unbreaking-pillar']){const e=m.match(new RegExp('\"key\":\"tower__'+id+'\".*?\\\\}'));console.log(id, /\"frames\":8/.test(e[0]))}"
```
Expected: every line ends `true`.

- [ ] **Step 3: Run the contract test — now GREEN**

Run: `npx vitest run tests/towerSpriteManifest.test.ts`
Expected: PASS (all tower cases green).

- [ ] **Step 4: Commit**

```bash
git add src/data/spriteManifest.ts
git commit -m "fix(tower-art): sync manifest to regenerated 8-frame sheets (GREEN)"
```

---

### Task 6: Full verification + playtest + deliverables

**Files:** none (verification only)

- [ ] **Step 1: Typecheck**

Run: `npm run typecheck`
Expected: clean (no errors).

- [ ] **Step 2: Full test suite**

Run: `npx vitest run`
Expected: all files pass (≥ prior 922 tests + the new contract test).

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: clean.

- [ ] **Step 4: In-game playtest (WebGL)**

Launch `vite preview` + headless chrome with software WebGL
(`--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --remote-debugging-port=9222`),
drive `window.__game` into a battle, place a couple of the regenerated towers (e.g.
`seren-skyfall`, `auriel-wardlight`), confirm via CDP that their texture key has 8
frames and the idle/attack anims exist, and screenshot. Confirm no floating-strip /
ghost / inconsistent frame in the captured frame.

- [ ] **Step 5: Before/after montage to chat + update memory**

Render an after-montage of the 7 towers' 8 frames; send before (`/tmp/tower_broken_frames.png`)
and after to chat via `[[send: ...]]`. Update `project_role_icons` neighbor memory or
add a short note in `project_procedural_sprite_animation` if a durable fact emerged
(e.g. the ghost-frame guard + regen harness). Index it in `MEMORY.md`.

- [ ] **Step 6: Final tree check**

Run: `git status --short`
Expected: clean except the pre-existing unrelated ` D .claude/scheduled_tasks.lock`.

---

## Self-review

- **Spec coverage:** verification (done pre-plan) ✓; ghost-frame guard (Task 2) ✓;
  seed-retry harness + recorded seeds (Task 3) ✓; regen 7 sheets (Task 4) ✓; manifest
  sync (Task 5) ✓; TDD contract RED→GREEN (Tasks 1,5) ✓; full verify + montage (Task 6) ✓.
- **Placeholders:** none — every code/command step is concrete.
- **Type consistency:** `--min-frames` added in Task 2 is consumed by the harness in
  Task 3; `regen_seeds.json` written in Task 3 committed in Task 4; canonical names
  string identical in Tasks 1 and 5.
- **Fallback:** Task 4 Step 2 handles a tower that can't reach 8 (re-run higher tries);
  the harness never overwrites good art with a short slice (`--min-frames 8`).
