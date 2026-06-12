# Tower active-skill VFX — shape archetypes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every tower active skill a distinct, lively cast by adding an orthogonal **shape** axis (mechanical motion + delivery) on top of the existing **element** axis (palette + substance), so the 52 tower actives no longer collapse into just 7 elemental looks.

**Architecture:** A pure, role-derived classifier `towerSkillShape(def)` → one of 8 `SkillShape`s, indexed once from the tower catalog into `SKILL_SHAPE[id]`. The tower branch of `SkillVfx.cast` now picks its source-delivery from the shape (`deliveryForShape`) and, on arrival, layers a small structural **motion flourish** (`renderTowerShape`) under the existing elemental substance renderer. Heroes (bespoke signatures) are untouched. Presentation-only — no gameplay change.

**Tech Stack:** TypeScript, Phaser 3 (procedural shapes/tweens, no art assets), Vitest.

---

## File Structure

- **Modify** `src/data/attackStyle.ts` — add `SkillShape`, `SKILL_SHAPES`, `towerSkillShape(def)`. (~131 → ~175 lines.)
- **Modify** `src/data/skillVfxMeta.ts` — add `deliveryForShape(shape)` next to the existing `deliveryForStyle` (keeps all delivery mapping in one module; imports `SkillShape` — same dependency arrow as the existing `SkillStyle` import).
- **Create** `src/data/towerSkillShapeIndex.ts` — builds `SKILL_SHAPE: Record<string, SkillShape>` from `TOWERS` + exports `skillShapeFor(id)`. (Separate file so `attackStyle.ts` never imports the catalog.)
- **Create** `src/scenes/towerSkillFx.ts` — `renderTowerShape(d, shape, at, palette, radius)` with 8 flourishes on the shared `VfxDraw` kit.
- **Modify** `src/scenes/skillVfx.ts` — tower branch: delivery from shape + flourish call + shape-weighted shake.
- **Modify** `tests/skillVfx.test.ts` — pure-data tests for shape mapping, coverage, variety, delivery.

---

### Task 1: Shape classifier + delivery mapping (pure data)

**Files:**

- Modify: `src/data/attackStyle.ts` (append after the existing skill-style block, ~line 126-131)
- Modify: `src/data/skillVfxMeta.ts` (append after `deliveryForStyle`, ~line 181-185)
- Test: `tests/skillVfx.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `tests/skillVfx.test.ts` (top imports already pull from `../src/data/attackStyle.ts` and `../src/data/skillVfxMeta.ts` — extend them):

```ts
import { towerSkillShape, SKILL_SHAPES, type SkillShape } from "../src/data/attackStyle.ts";
import { deliveryForShape } from "../src/data/skillVfxMeta.ts";
import { DELIVERY_KINDS } from "../src/data/skillVfxMeta.ts";
import type { CharacterDef } from "../src/data/schema.ts";

// minimal def factory — only the fields towerSkillShape reads
const defOf = (role: CharacterDef["role"], active: string | null): CharacterDef =>
  ({ role, active }) as unknown as CharacterDef;

describe("tower skill shape", () => {
  it("maps each role to its base shape", () => {
    expect(towerSkillShape(defOf("splash", "explosion"))).toBe("nova");
    expect(towerSkillShape(defOf("chain", "chain-lightning"))).toBe("chain");
    expect(towerSkillShape(defOf("dot", "plague-cloud"))).toBe("cloud");
    expect(towerSkillShape(defOf("debuff", "blizzard"))).toBe("cloud");
    expect(towerSkillShape(defOf("support", "war-cry"))).toBe("aura");
    expect(towerSkillShape(defOf("tanker", "fortress-smash"))).toBe("slam");
  });

  it("refines the damage role by keyword into beam / barrage / bolt", () => {
    expect(towerSkillShape(defOf("damage", "kamefist-wave"))).toBe("beam");
    expect(towerSkillShape(defOf("damage", "hollow-purple"))).toBe("beam");
    expect(towerSkillShape(defOf("damage", "serious-punch"))).toBe("beam");
    expect(towerSkillShape(defOf("damage", "rapid-volley"))).toBe("barrage");
    expect(towerSkillShape(defOf("damage", "missile-salvo"))).toBe("barrage");
    expect(towerSkillShape(defOf("damage", "siege-bolt"))).toBe("barrage");
    expect(towerSkillShape(defOf("damage", "spirit-ball"))).toBe("beam"); // "ball" → ki/spirit beam
    expect(towerSkillShape(defOf("damage", "final-flash"))).toBe("beam");
  });

  it("deliveryForShape returns a known delivery kind for every shape", () => {
    for (const shape of SKILL_SHAPES) {
      expect(DELIVERY_KINDS).toContain(deliveryForShape(shape));
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/skillVfx.test.ts -t "tower skill shape"`
Expected: FAIL — `towerSkillShape`, `SKILL_SHAPES`, `deliveryForShape` not exported.

- [ ] **Step 3: Implement in `src/data/attackStyle.ts`**

Append at the end of the file:

```ts
/**
 * Mechanical-motion archetype for a tower ACTIVE skill — orthogonal to the
 * element (`SkillStyle`). Element = substance + colour; shape = how it moves and
 * arrives. Together they de-collapse the 52 tower actives from 7 looks into many.
 */
export type SkillShape = "nova" | "chain" | "barrage" | "beam" | "cloud" | "slam" | "aura" | "bolt";

/** Runtime list of every shape (keep in sync with `SkillShape`). */
export const SKILL_SHAPES: readonly SkillShape[] = [
  "nova",
  "chain",
  "barrage",
  "beam",
  "cloud",
  "slam",
  "aura",
  "bolt",
];

/**
 * Shape for a tower's active skill, derived from its ROLE (reliable structured
 * data). Only the `damage` role is ambiguous, so it's refined by skill-name
 * keyword into a focused beam, a rapid barrage, or a plain charged bolt.
 */
export function towerSkillShape(def: CharacterDef): SkillShape {
  switch (def.role) {
    case "splash":
      return "nova";
    case "chain":
      return "chain";
    case "dot":
      return "cloud";
    case "debuff":
      return "cloud";
    case "support":
      return "aura";
    case "tanker":
      return "slam";
    case "damage": {
      const s = (def.active ?? "").toLowerCase();
      if (
        has(
          s,
          "wave",
          "flash",
          "hollow",
          "purple",
          "palm",
          "kame",
          "serious",
          "punch",
          "fist",
          "ki",
          "ball",
          "spirit",
          "beam",
          "ray",
          "dimensional",
        )
      )
        return "beam";
      if (
        has(
          s,
          "volley",
          "salvo",
          "missile",
          "rapid",
          "spin",
          "siege",
          "shot",
          "barrage",
          "fusillade",
        )
      )
        return "barrage";
      return "bolt";
    }
    default:
      return "bolt";
  }
}
```

- [ ] **Step 4: Implement in `src/data/skillVfxMeta.ts`**

Add the import for `SkillShape` to the existing `attackStyle.ts` import line:

```ts
import type { SkillStyle, SkillShape } from "./attackStyle.ts";
```

Append after `deliveryForStyle`:

```ts
/** Source-delivery for a tower-skill SHAPE (the "fly-from-source" beat). */
export function deliveryForShape(shape: SkillShape): DeliveryKind {
  switch (shape) {
    case "nova":
      return "skyfall";
    case "beam":
      return "beam";
    case "cloud":
      return "ground";
    case "slam":
      return "ground";
    case "aura":
      return "cast";
    case "chain":
      return "bolt";
    case "barrage":
      return "bolt";
    case "bolt":
      return "bolt";
  }
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run tests/skillVfx.test.ts -t "tower skill shape"`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/data/attackStyle.ts src/data/skillVfxMeta.ts tests/skillVfx.test.ts
git commit -m "feat(vfx): role-derived tower-skill shape classifier + delivery mapping

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Catalog shape index + coverage / variety guard

**Files:**

- Create: `src/data/towerSkillShapeIndex.ts`
- Test: `tests/skillVfx.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `tests/skillVfx.test.ts`:

```ts
import { SKILL_SHAPE, skillShapeFor } from "../src/data/towerSkillShapeIndex.ts";
import { TOWERS } from "../src/data/towers.ts";

describe("tower skill shape index", () => {
  it("resolves a known shape for every tower active id (no surprise default)", () => {
    const actives = [...new Set(TOWERS.map((t) => t.active).filter((a): a is string => !!a))];
    for (const id of actives) {
      expect(SKILL_SHAPES).toContain(SKILL_SHAPE[id]);
    }
  });

  it("exercises at least 6 of the 8 shapes across the live roster (de-collapsed)", () => {
    const used = new Set(Object.values(SKILL_SHAPE));
    expect(used.size).toBeGreaterThanOrEqual(6);
  });

  it("falls back to bolt for unknown / undefined ids", () => {
    expect(skillShapeFor(undefined)).toBe("bolt");
    expect(skillShapeFor("not-a-real-skill")).toBe("bolt");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/skillVfx.test.ts -t "tower skill shape index"`
Expected: FAIL — `../src/data/towerSkillShapeIndex.ts` does not exist.

- [ ] **Step 3: Create `src/data/towerSkillShapeIndex.ts`**

```ts
// src/data/towerSkillShapeIndex.ts
//
// id → SkillShape for every tower active skill, computed ONCE from the tower
// catalog at module load. Lives apart from attackStyle.ts so the classifier
// (towerSkillShape) stays free of a catalog import — this is the only module
// that pulls TOWERS in for the lookup. The VFX layer only has the skill-id
// string at cast time, so it looks the shape up here.
import { TOWERS } from "./towers.ts";
import { towerSkillShape, type SkillShape } from "./attackStyle.ts";

/** Every tower active id mapped to its mechanical-motion shape. */
export const SKILL_SHAPE: Record<string, SkillShape> = (() => {
  const m: Record<string, SkillShape> = {};
  for (const def of TOWERS) {
    if (def.active) m[def.active] = towerSkillShape(def);
  }
  return m;
})();

/** Shape for a skill id — falls back to "bolt" for hero/unknown/undefined ids. */
export function skillShapeFor(id: string | undefined): SkillShape {
  return (id ? SKILL_SHAPE[id] : undefined) ?? "bolt";
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/skillVfx.test.ts -t "tower skill shape index"`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/data/towerSkillShapeIndex.ts tests/skillVfx.test.ts
git commit -m "feat(vfx): catalog-built SKILL_SHAPE index + skillShapeFor lookup

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Shape motion flourishes (renderer)

**Files:**

- Create: `src/scenes/towerSkillFx.ts`

Renderer coverage is enforced at **compile time** by the exhaustive `Record<SkillShape, ShapeFn>` — a missing shape fails `tsc`. No runtime render test (mirrors the hero-signature pattern); the CDP smoke in Task 5 confirms it runs.

- [ ] **Step 1: Create `src/scenes/towerSkillFx.ts`**

```ts
// src/scenes/towerSkillFx.ts
//
// Structural "motion flourishes" for tower active skills — the mechanical-shape
// half of the element×shape system. Each shape draws a small, element-tinted
// set-piece (rings / links / strikes / shards / pillars / orb) that reads as the
// skill's MECHANIC, layered UNDER the elemental substance particles in
// SkillVfx.cast. Built on the shared VfxDraw kit; pure presentation, no assets.
import { VfxDraw, type V } from "./vfxDraw.ts";
import type { SkillShape } from "../data/attackStyle.ts";

type Palette = { core: number; hot: number; deep: number };
type ShapeFn = (d: VfxDraw, at: V, p: Palette, radius: number) => void;

// splash — three staged concentric shock-rings punch outward from a hot core.
const nova: ShapeFn = (d, at, p, radius) => {
  d.disc(at, 20, p.hot, 0.85, 2.0, 220);
  [0, 90, 180].forEach((ms, i) =>
    d.after(ms, () => d.ring(at, radius * (0.5 + i * 0.28), i ? p.hot : p.core, 460, 4 - i)),
  );
};

// chain — jagged links leap out in sequence to orbit points, each sparking.
const chain: ShapeFn = (d, at, p, radius) => {
  for (let i = 0; i < 4; i++) {
    const a = (Math.PI * 2 * i) / 4 + 0.4;
    const to = { x: at.x + Math.cos(a) * radius * 0.95, y: at.y + Math.sin(a) * radius * 0.95 };
    d.after(i * 55, () => {
      d.crack(at, a, radius * 0.95, p.hot, 200);
      d.spark(to, p.core, 5, 12);
    });
  }
  d.ring(at, radius * 0.6, p.core, 320, 2);
};

// barrage — four stutter muzzle-strikes in a row, each spitting a tracer.
const barrage: ShapeFn = (d, at, p, radius) => {
  for (let i = 0; i < 4; i++)
    d.after(i * 55, () => {
      const off = { x: at.x + (i - 1.5) * 9, y: at.y };
      d.disc(off, 8, p.hot, 0.9, 1.6, 150);
      d.beam(off, 0, radius, p.core, 3, 180);
    });
};

// beam — a bright focused pop + a cross-gleam: a converged single strike.
const beam: ShapeFn = (d, at, p, radius) => {
  d.disc(at, 16, p.hot, 0.9, 2.4, 240);
  d.ring(at, radius, p.core, 420, 3);
  d.gleam(at, 0, radius * 1.4, p.hot, 4);
};

// cloud — a slow swelling haze ring + drifting motes that linger over the field.
const cloud: ShapeFn = (d, at, p, radius) => {
  d.disc(at, radius * 0.55, p.deep, 0.4, 1.6, 620);
  d.ring(at, radius * 0.9, p.deep, 700, 3);
  d.motes(at, radius, 10, () => (Math.random() < 0.5 ? p.core : p.deep), -1);
};

// slam — a ring of erupting shards + a heavy ground ring + smoke + a short shake.
const slam: ShapeFn = (d, at, p, radius) => {
  d.shards(at, 8, radius, p.core);
  d.ring(at, radius * 1.05, p.deep, 520, 5);
  d.smoke(at, p.deep, 10);
  d.shake(150, 0.006);
};

// aura — staggered radiant rings + rising light motes: a supportive bloom.
const aura: ShapeFn = (d, at, p, radius) => {
  d.ring(at, radius, p.core, 560, 3);
  for (let i = 0; i < 3; i++)
    d.after(i * 80, () => d.ring(at, radius * (0.45 + i * 0.25), p.hot, 460, 2));
  d.motes(at, radius, 8, () => p.hot, -1);
};

// bolt — the default: a single charged orb-pop, a ring, and a spark spray.
const bolt: ShapeFn = (d, at, p, radius) => {
  d.disc(at, 14, p.hot, 0.9, 2.0, 220);
  d.ring(at, radius * 0.9, p.core, 420, 3);
  d.spark(at, p.hot, 8, 18);
};

const SHAPES: Record<SkillShape, ShapeFn> = { nova, chain, barrage, beam, cloud, slam, aura, bolt };

/** Render the structural motion flourish for a tower-skill `shape` at `at`. */
export function renderTowerShape(
  d: VfxDraw,
  shape: SkillShape,
  at: V,
  palette: Palette,
  radius: number,
): void {
  SHAPES[shape](d, at, palette, radius);
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (exhaustive `Record<SkillShape, ShapeFn>` compiles; no unused-symbol errors).

- [ ] **Step 3: Commit**

```bash
git add src/scenes/towerSkillFx.ts
git commit -m "feat(vfx): 8 tower-skill shape motion flourishes (towerSkillFx)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Wire the tower branch of SkillVfx.cast

**Files:**

- Modify: `src/scenes/skillVfx.ts` (imports + the tower fallback in `cast`, ~lines 9-13 and 50-68)

- [ ] **Step 1: Add imports**

In `src/scenes/skillVfx.ts`, extend the data import and add two new ones:

```ts
import { SKILL_STYLE_COLOR, skillStyleFor, type SkillStyle } from "../data/attackStyle.ts";
import { skillVfxSpec, deliveryForShape } from "../data/skillVfxMeta.ts";
import { skillShapeFor } from "../data/towerSkillShapeIndex.ts";
import { renderTowerShape } from "./towerSkillFx.ts";
```

(Remove `deliveryForStyle` from the `skillVfxMeta` import — the tower branch no longer uses it; the hero branch never did. `renderSignature`, `renderDelivery`, `VfxDraw` imports stay.)

- [ ] **Step 2: Rewrite the tower fallback branch**

Replace the body after the hero `if (spec) { … return; }` block (current lines 50-68) with:

```ts
// Tower active (or any id without a bespoke hero signature): element × shape.
// element → palette + substance particles; shape → delivery + motion flourish.
const style = skillStyleFor(skillId);
const color = SKILL_STYLE_COLOR[style];
const accent = ACCENT[style];
const shape = skillShapeFor(skillId);
renderDelivery(
  draw,
  deliveryForShape(shape),
  from,
  at,
  { core: color, hot: accent.hot, deep: accent.deep },
  radius,
  () => {
    this.baseBurst(at, color, radius, skillId);
    renderTowerShape(draw, shape, at, { core: color, hot: accent.hot, deep: accent.deep }, radius); // structural motion (under particles)
    switch (
      style // elemental substance (on top)
    ) {
      case "fire":
        this.fire(at, color, radius);
        break;
      case "ice":
        this.ice(at, color, radius);
        break;
      case "lightning":
        this.lightning(at, color, radius);
        break;
      case "arcane":
        this.arcane(at, color, radius);
        break;
      case "poison":
        this.poison(at, color, radius);
        break;
      case "heal":
        this.heal(at, color, radius);
        break;
      case "slash":
        this.slash(at, color, radius);
        break;
    }
    // One weighted shake by SHAPE (heavy blasts/slams shake hardest); never double.
    const heavy = shape === "nova" || shape === "slam";
    const med = shape === "chain" || shape === "beam";
    if (source === "hero" || heavy || med || style === "lightning") {
      this.scene.cameras.main.shake(heavy ? 200 : 130, heavy ? 0.007 : 0.004);
    }
  },
);
```

Note: `slam` (towerSkillFx) already calls `d.shake` for its own impact; that's the tank's body-slam thump and is fine to stack with the weighted shake (both are short). If it reads as too much during playtest, drop the `d.shake` line from `slam` in towerSkillFx.ts.

- [ ] **Step 3: Typecheck + full suite**

Run: `npx tsc --noEmit && npx vitest run tests/skillVfx.test.ts`
Expected: PASS — tsc clean, all skillVfx tests green.

- [ ] **Step 4: Commit**

```bash
git add src/scenes/skillVfx.ts
git commit -m "feat(vfx): wire tower casts through element×shape (delivery + flourish)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Verify whole + playtest + memory

**Files:**

- Modify: `memory/project_skill_vfx_signatures.md`, `memory/MEMORY.md`

- [ ] **Step 1: Full verification**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: tsc clean; entire suite green (existing + new); build succeeds (pre-existing chunk-size warning only).

- [ ] **Step 2: File-size guard**

Run: `for f in src/data/attackStyle.ts src/data/skillVfxMeta.ts src/data/towerSkillShapeIndex.ts src/scenes/towerSkillFx.ts src/scenes/skillVfx.ts; do wc -l "$f"; done`
Expected: every file < 500 lines.

- [ ] **Step 3: CDP smoke — force a representative cast per shape**

Run the playtest harness to BattleScene and, via `bs.fx.play({type:"cast", from, at, radius, source:"tower", skillId})`, fire one skill per shape (`explosion`→nova, `chain-lightning`→chain, `rapid-volley`→barrage, `kamefist-wave`→beam, `plague-cloud`→cloud, `fortress-smash`→slam, `war-cry`→aura, `siege-bolt`→barrage, plus `spirit-ball`→beam). Assert `errors === 0` and capture a screenshot.

```bash
bash scripts/playtest/snap.sh --scene Battle --place --wait 1200 \
  --out /tmp/tower-vfx.png \
  --eval 'const bs=window.__game.scene.getScene("BattleScene"); let n=0; const ids=["explosion","chain-lightning","rapid-volley","kamefist-wave","plague-cloud","fortress-smash","war-cry","spirit-ball"]; ids.forEach((id,i)=>setTimeout(()=>{bs.fx.play({type:"cast",from:{x:200,y:480},at:{x:480+((i%4)*90),y:230+((i>>2)*90)},radius:70,damageType:"Physical",source:"tower",skillId:id});n++;},i*80)); return {scheduled:ids.length};'
```

Expected: command exits 0; harness reports 0 runtime errors; `/tmp/tower-vfx.png` written. (Exact flags per `scripts/playtest/snap.sh`; adjust `from`/`at`/timings as needed.)

- [ ] **Step 4: Update memory**

In `memory/project_skill_vfx_signatures.md`, prepend a short paragraph noting the **element×shape** system for tower actives: `towerSkillShape(def)` (role-derived, `damage` keyword-refined) → `SKILL_SHAPE` index (`towerSkillShapeIndex.ts`) → `deliveryForShape` + `renderTowerShape` (`towerSkillFx.ts`, 8 flourishes) layered under the existing elemental substance in `SkillVfx.cast`; heroes keep bespoke signatures; presentation-only. Update the `MEMORY.md` Skill-VFX hook line to mention tower actives now read by element×shape (8 shapes), not just 7 elements.

- [ ] **Step 5: Commit**

```bash
git add memory/project_skill_vfx_signatures.md memory/MEMORY.md
git commit -m "docs(vfx): record tower-skill element×shape system

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**

- Two-axis element×shape → Tasks 1+4. ✓
- Role-derived shape, `damage` keyword-refined → Task 1 `towerSkillShape`. ✓
- Catalog-built `SKILL_SHAPE` index, `bolt` default → Task 2. ✓
- `deliveryForShape` per shape → Task 1. ✓
- 8 flourishes, compile-time coverage → Task 3. ✓
- Pipeline: delivery-by-shape + flourish-under-substance + single shape-weighted shake → Task 4. ✓
- Tests: coverage, role mapping, damage refinement, variety (≥6), delivery validity → Tasks 1-2. ✓
- Files < 500 lines, no new art, heroes untouched → enforced in Task 5 / by construction. ✓

**Placeholder scan:** none — every step has full code or an exact command.

**Type consistency:** `SkillShape`, `SKILL_SHAPES`, `towerSkillShape`, `deliveryForShape`, `SKILL_SHAPE`, `skillShapeFor`, `renderTowerShape`, `Palette` ({core,hot,deep}) used identically across tasks. `VfxDraw` primitive signatures (`ring/disc/spark/motes/beam/crack/shards/smoke/gleam/shake`) match `vfxDraw.ts`. The tower branch reuses the existing private `fire/ice/lightning/arcane/poison/heal/slash` and `baseBurst` on `this`.

**Note on `spirit-ball`:** the spec table listed it as `bolt`; the test/classifier place it as `beam` (the `ball`/`spirit` keyword reads as a ki-orb projectile, which the beam flourish renders well). Intentional — the keyword list is the source of truth and is easily tuned.
