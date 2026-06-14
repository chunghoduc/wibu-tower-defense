# Skill VFX Literal-Motif Redesign — Implementation Plan

> REQUIRED SUB-SKILL: superpowers:test-driven-development for every code task.
> Spec: `docs/superpowers/specs/2026-06-14-skill-vfx-literal-motif-design.md`.

**Goal:** Make active-skill VFX literally depict their description — the right
number/shape of projectiles fired *from the hero* (tri-shot = 3 arrows fanning),
with impacts trimmed to match. Procedural Phaser shapes only; no assets, no
ASSET_VERSION bump.

**Architecture:** Add a literal "motif" (what flies, how many, in what spread) per
skill. A pure `planVolley` turns `(from, at, motif)` into per-projectile travel
frames; a new `renderVolley` draws literal arrows/bullets/orbs along them. `SkillVfx.cast`
uses the volley when a skill has a projectile motif, else keeps the existing
delivery+signature. A few signatures get small corrections.

---

## File Structure

- `src/data/skillVfxMeta.ts` — MODIFY: add `MotifKind`/`MotifSpread`/`SkillMotif`/`NO_MOTIF`
  types + a `motif` field on every `SKILL_VFX` entry.
- `src/data/skillMotif.ts` — NEW (pure): `skillMotif(skillId)` resolver (hero spec
  field → else tower-shape derivation → else `NO_MOTIF`) + `motifForShape(shape)`.
- `src/scenes/projectileVolley.ts` — NEW (pure, Phaser-free): `planVolley(from, at, motif)`
  → `VolleyShot[]` (per-shot from/to/angle/delay).
- `src/scenes/projectileVolleyFx.ts` — NEW (presenter): `renderVolley(...)` draws the
  literal glyphs traveling along the shots, fires `onArrive` after the last lands.
- `src/scenes/skillVfx.ts` — MODIFY: branch on `skillMotif` — volley vs. existing delivery.
- `src/scenes/skillSignatures.ts` — MODIFY: trim `tripleVolley`/`muzzleBarrage` to
  landing impacts; widen `steelCross` to a clear arc; add a palm-thrust to `voidRift`.
- `tests/skillMotif.test.ts` — NEW: motif resolution + coverage.
- `tests/projectileVolley.test.ts` — NEW: volley geometry.
- `tests/skillVfx.test.ts` — MODIFY: assert every hero spec carries a `motif`.

---

### Task 1: Pure motif data + resolver (TDD)

**Files:** `src/data/skillVfxMeta.ts`, `src/data/skillMotif.ts`, `tests/skillMotif.test.ts`,
`tests/skillVfx.test.ts`

- [ ] **Step 1 — RED.** Write `tests/skillMotif.test.ts`:
  - `skillMotif("tri-shot")` → `{ kind: "arrow", count: 3, spread: "fan" }`
  - `skillMotif("rapid-fire")` → `{ kind: "bullet", count: 5, spread: "stream" }`
  - `skillMotif("piercing-arrow")` → `{ kind: "arrow", count: 1, spread: "pierce" }`
  - `skillMotif("concussion-round")` → `{ kind: "bullet", count: 1, ... }`
  - `skillMotif("spirit-bolt").kind` === `"orb"`; `mana-burst` → orb
  - `skillMotif("valiant-strike"/"arcane-nova"/"shadow-curse"/"true-strike"/"void-palm"/"stone-bash"/"execute-slash"/"iron-cleave").kind` === `"none"`
  - Every `ACTIVE_SKILLS` id resolves to a defined motif with `count >= 0`.
  - Tower derivation via `motifForShape`: `barrage` → `bullet`/stream, `bolt` → `orb`,
    `chain` → `orb`/stream, `beam` → `bolt`/pierce, and `nova`/`slam`/`cloud`/`aura` → `none`.
  - `skillMotif("not-a-skill")` → `NO_MOTIF` (kind "none").
  Also extend `tests/skillVfx.test.ts` "skill VFX metadata" with: every `ACTIVE_SKILLS`
  spec has a `motif` whose `kind` is one of the known kinds.
  Run `npx vitest run tests/skillMotif.test.ts` → FAIL (module + field missing).

- [ ] **Step 2 — GREEN.** In `skillVfxMeta.ts` add above `SkillVfxSpec`:
  ```ts
  export type MotifKind = "arrow" | "bolt" | "bullet" | "orb" | "blade" | "none";
  export type MotifSpread = "single" | "fan" | "stream" | "pierce";
  export interface SkillMotif { kind: MotifKind; count: number; spread: MotifSpread; }
  export const NO_MOTIF: SkillMotif = { kind: "none", count: 0, spread: "single" };
  ```
  Add `motif: SkillMotif;` to `SkillVfxSpec`, and a `motif` to each of the 14 entries
  per the spec's authored table (tri-shot arrow/3/fan, rapid-fire bullet/5/stream,
  piercing-arrow arrow/1/pierce, concussion-round bullet/1/single, spirit-bolt &
  mana-burst orb/1/single, all others `{ ...NO_MOTIF }`).
  Create `src/data/skillMotif.ts`:
  ```ts
  import { SKILL_VFX, NO_MOTIF, type SkillMotif } from "./skillVfxMeta.ts";
  import { skillShapeFor } from "./towerSkillShapeIndex.ts";
  import type { SkillShape } from "./attackStyle.ts";

  export function motifForShape(shape: SkillShape): SkillMotif { /* switch */ }
  export function skillMotif(skillId: string | undefined): SkillMotif {
    const hero = skillId ? SKILL_VFX[skillId]?.motif : undefined;
    if (hero) return hero;
    if (!skillId) return NO_MOTIF;
    return motifForShape(skillShapeFor(skillId));
  }
  ```
  `motifForShape`: barrage→{bullet,4,stream}, bolt→{orb,1,single}, chain→{orb,3,stream},
  beam→{bolt,1,pierce}, nova/slam/cloud/aura→NO_MOTIF.
  Run the two tests → PASS. Run `npx vitest run tests/skillVfx.test.ts` → PASS.

- [ ] **Step 3 — Commit** `feat(vfx): per-skill literal projectile motif (count + shape + spread)`.

---

### Task 2: Pure volley geometry (TDD)

**Files:** `src/scenes/projectileVolley.ts`, `tests/projectileVolley.test.ts`

- [ ] **Step 1 — RED.** `tests/projectileVolley.test.ts` for `planVolley(from, at, motif)`:
  - `none`/count 0 → `[]`.
  - `single` → length 1; shot `to` ≈ `at`; `angle` ≈ atan2(at-from).
  - `fan` count 3 → length 3; all `from` equal the caster; three DISTINCT `to`
    points spread around `at` (the middle one ≈ `at`); all `delay` === 0.
  - `stream` count 5 → length 5; `delay` strictly non-decreasing and `delay[4] > 0`.
  - `pierce` → length 1; `|from→to| > |from→at|` (passes through), same heading as `at`.
  Run → FAIL (module missing).

- [ ] **Step 2 — GREEN.** Implement `planVolley`. `VolleyShot = { from, to, angle, delay }`.
  Fan: base heading h = atan2(at-from); spread total ≈ 0.5 rad across count; each shot
  heading h + offset, `to` = at rotated by offset around `from` at radius |from→at|
  (keep mid at `at`). Stream: same line, `delay = i * 70`, small perpendicular jitter
  via index parity (deterministic — no RNG in the pure planner). Pierce: `to` = from +
  unit(at-from) * |from→at| * 1.6. Single: one shot to `at`. Run → PASS.

- [ ] **Step 3 — Commit** `feat(vfx): pure projectile-volley geometry (fan/stream/pierce/single)`.

---

### Task 3: Volley renderer + wiring + signature trims

**Files:** `src/scenes/projectileVolleyFx.ts`, `src/scenes/skillVfx.ts`,
`src/scenes/skillSignatures.ts`

- [ ] **Step 1.** Create `projectileVolleyFx.ts` — `renderVolley(scene, fac, depth, pool,
  motif, shots, palette, onArrive)`. For each shot, at `shot.delay`:
  - `arrow` — a slim shaft (rect, origin 0,0.5) + chevron head (triangle) flying
    `from→to`, rotated to `angle`, with a short fading trail; reuse VfxDraw.spark at `to`.
  - `bullet` — a hot tracer streak (rect) snapping `from→to` + a muzzle `spark` at `from`.
  - `orb` — delegate to `VfxDraw.orbTravel(from, to, …)`.
  - `blade` — a thin `crescent` flung along the line.
  Track completions; call `onArrive` once after the LAST shot's travel completes
  (use the max `delay`+duration, counting tween completes to be safe). Build on a
  `VfxDraw` instance for orb/spark/trail; use `fac.triangle` for the arrowhead.

- [ ] **Step 2.** Wire `SkillVfx.cast`:
  ```ts
  const motif = skillMotif(skillId);
  // hero branch: if motif.kind !== "none" → renderVolley(... planVolley(from, at, motif) ...,
  //   onArrive = baseBurst + renderSignature); else existing renderDelivery(spec.delivery,…).
  // tower branch: if motif.kind !== "none" → renderVolley(...) with the element palette,
  //   onArrive = baseBurst + renderTowerShape + elements.render + shake; else existing
  //   renderDelivery(deliveryForShape(shape), …).
  ```
  Keep the shake logic identical, fired in onArrive. No depth surface change (volley
  draws through VfxDraw at the skill depth band).

- [ ] **Step 3.** Signature trims in `skillSignatures.ts`:
  - `tripleVolley` → drop the three full beams; keep three small landing sparks fanned
    at `at` + the settling motes (arrows now arrive via the volley).
  - `muzzleBarrage` → drop the five tracer beams; keep the muzzle/impact discs + gunsmoke
    at `at` (tracers now come via the volley).
  - `steelCross` → make the lead arc a single WIDE cleave (one broad crescent) before the
    cross spark, matching "a wide arc that cleaves".
  - `voidRift` → prepend a brief palm-thrust `gleam` from toward `at` before the rift swells.
  (Other signatures unchanged.)

- [ ] **Step 4 — Verify + Commit.** `npx tsc --noEmit && npx vitest run` green;
  `npm run build` succeeds. Commit
  `feat(vfx): fire literal projectiles from the caster (arrows/bullets/orbs) + trim impacts`.

---

### Task 4: Visual proof + verify + memory

- [ ] **Step 1.** CDP repro (reuse/extend an existing playtest harness) that, via
  `window.__game`, forces a hero to cast tri-shot and rapid-fire and screenshots the
  board; confirm multiple distinct projectiles render and skill FX stay under units.
  If headless infra is unavailable, capture a browserless note and rely on the build +
  unit suites.
- [ ] **Step 2.** Final `npx tsc --noEmit && npx vitest run && npm run build`.
- [ ] **Step 3.** Update `memory/` — extend the skill VFX signatures memory with the
  literal-motif layer (skillMotif + planVolley + renderVolley; projectiles now fly from
  the caster with real counts). Keep the MEMORY.md pointer one line.
- [ ] **Step 4.** Push (`git push origin main`). Deploy is optional (no asset change;
  pure code) — leave to normal release flow unless trivially safe.
