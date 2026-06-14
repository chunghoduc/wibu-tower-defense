# Skill VFX Literal-Motif Redesign — Design Spec

**Date:** 2026-06-14
**Status:** Approved (full-auto, self-approved)

## Problem

In-battle active-skill VFX are abstract bursts decoupled from what the skill
*says* it does. The clearest example: **Tri-Shot** — _"Fire three bolts in a
wide spread"_ — currently uses the generic `bolt` delivery, which draws **one**
glowing orb flying to the target, then a `triple-volley` burst at the impact
point. The player never sees three arrows leave the hero. The same gap hits
**Rapid Fire** ("burst of five rapid shots" → one orb), **Spirit Bolt**,
**Concussion Round**, and **Piercing Arrow** ("an arrow that passes through every
enemy in a line" → a generic beam, not an arrow).

The request: rescan every skill, read its description, and make the VFX literally
depict it — the right *number* of the right *projectile*, fired *from the hero*,
plus an impact that matches the described effect.

## Root cause

The cast pipeline has two orthogonal beats:

1. **Delivery** (`skillDelivery.ts`) — how the cast travels from caster→target.
   The five kinds (`bolt`/`beam`/`skyfall`/`ground`/`cast`) are generic: `bolt`
   always draws a single `orbTravel` regardless of the skill's narrative.
2. **Signature** (`skillSignatures.ts`) — a bespoke impact set-piece per hero
   skill. `triple-volley` *does* draw three green strokes, but only at the
   destination, as an afterthought — not as projectiles that fly from the hero.

So the literal "N projectiles fired from the hero" idea has no home. Delivery is
where it belongs, and delivery is currently identity-blind.

## Goals

- Each hero skill whose description implies **projectiles** shows the correct
  **count** and **shape** of projectile flying **from the hero** to the
  target(s), as the delivery beat.
- Each skill whose description implies a **melee / area / sky / curse** effect
  keeps a delivery + signature that matches that verb (sweep, slam, rain, sigil,
  expanding ring) — audited and corrected where the current art contradicts the
  words.
- Tower actives reuse the same literal-projectile delivery where their shape is a
  projectile archetype (`barrage`, `bolt`, `chain`, `beam`), so a "volley"/"shot"
  tower also fires real projectiles instead of one orb.
- No regression to the depth invariant (skill FX render *under* units), the FxPool
  reuse, or the fixed-timestep/pendingFx draw model.
- Pure, tested geometry; no new texture assets (these are procedural Phaser
  shapes, consistent with the whole VFX system — no SDXL, no ASSET_VERSION bump).

## Non-goals

- Boss casts. They are themed set-pieces keyed to four boss *skill types*
  (quake/rally/barrier/summon-surge), not prose-described player skills; they
  already match their archetype. Out of scope.
- Replacing the signature set-pieces wholesale. Signatures that already match
  their description (valiant-sweep, arcane-supernova, earthshatter, hex-sigil…)
  are kept; only the impact of projectile skills is trimmed so it reads as
  "the projectiles landing", and a few contradictory ones are corrected.
- New sprite/animation frames. "Draw frames" here means procedural tween frames
  (the established VFX idiom), not spritesheets.

## Design

### 1. A skill **motif** — the literal thing that flies

New pure module `src/data/skillMotif.ts`:

```ts
export type MotifKind = "arrow" | "bolt" | "bullet" | "orb" | "blade" | "none";
export type MotifSpread = "single" | "fan" | "stream" | "pierce";

export interface SkillMotif {
  kind: MotifKind;     // what shape is drawn flying from the hero
  count: number;       // how many (1 for single, 3 for tri-shot, 5 for rapid-fire)
  spread: MotifSpread; // fan = angular spread, stream = staggered same-line,
                       // pierce = single shaft through a line, single = one shot
}

export const NO_MOTIF: SkillMotif = { kind: "none", count: 0, spread: "single" };
```

- **Hero skills:** the motif is authored explicitly as a new field on
  `SkillVfxSpec` (`skillVfxMeta.ts`). It is the single source of truth; the test
  asserts the literal counts (tri-shot→3, rapid-fire→5, piercing-arrow→1 pierce,
  area/melee skills→`none`).
- **Tower skills:** `skillMotif()` derives a motif from the tower's `SkillShape`
  (no prose to author against): `barrage`→bullet×4 stream, `chain`→orb×3 stream,
  `bolt`→orb×1, `beam`→bolt×1 pierce, and the area shapes (`nova`/`slam`/`cloud`/
  `aura`)→`none` (the effect erupts at the target, nothing is "fired").

`skillMotif(skillId)` resolves hero-first (spec field), else tower (shape), and
returns `NO_MOTIF` when nothing should fly.

### 2. Authored hero motif table

| Skill | Description verb | Motif |
|---|---|---|
| valiant-strike | "sweeping blow, all nearby" | none (melee sweep) |
| spirit-bolt | "Hurl a bolt … bursts on impact" | orb ×1 single |
| iron-cleave | "wide arc that cleaves nearby" | none (melee arc) |
| stone-bash | "overhead blow" | none (overhead slam) |
| execute-slash | "finishing blow" | none (skyfall guillotine) |
| **tri-shot** | **"Fire three bolts in a wide spread"** | **arrow ×3 fan** |
| piercing-arrow | "arrow that passes through every enemy in a line" | arrow ×1 pierce |
| mana-burst | "Release a burst of raw magical energy" | orb ×1 single |
| arcane-nova | "expanding ring of arcane force" | none (nova) |
| **rapid-fire** | **"burst of five rapid shots"** | **bullet ×5 stream** |
| concussion-round | "heavy round that stuns on impact" | bullet ×1 single |
| shadow-curse | "Apply a weakening curse" | none (ground sigil) |
| true-strike | "technique perfected beyond all defences" | none (pure slash) |
| void-palm | "palm strike that tears through reality" | none (palm + rift) |

### 3. Literal projectile-volley delivery

New pure geometry `src/scenes/projectileVolley.ts` (Phaser-free, tested):

```ts
export interface VolleyShot {
  from: Vec2;   // launch point (jittered around the hero for stream/fan)
  to: Vec2;     // landing point (fanned around the target for fan)
  angle: number; // radians, from→to heading (orients the glyph)
  delay: number; // ms stagger (0 for fan, ramped for stream)
}
export function planVolley(from: Vec2, at: Vec2, motif: SkillMotif): VolleyShot[];
```

- **fan** — `count` shots sharing one launch point, landing points fanned ±θ
  around the target (tri-shot's "wide spread"); no stagger.
- **stream** — `count` shots along the same line, ramped `delay` so they read as
  a rapid burst (rapid-fire); slight launch jitter.
- **pierce** — one shot whose `to` is extended *past* the target along the
  from→at ray (passes through the line).
- **single** — one shot, no spread.

A new renderer beat `renderVolley(d: VfxDraw, motif, shots, palette, onArrive)`
draws, per shot, the motif glyph traveling `from→to`:
- `arrow` — a slim shaft + chevron head (triangle) oriented to `angle`, with a
  fletched light trail.
- `bullet` — a short hot tracer streak + muzzle spark at the launch point.
- `orb` — the existing charged orb (reuses `orbTravel`).
- `blade` — a thin crescent (used by tower `cast`-style shots if any).

`onArrive` fires after the **last** shot lands, then the impact signature plays —
so the sequence reads launch → travel → land → effect.

### 4. Wiring (`skillVfx.ts`)

`SkillVfx.cast()` resolves `motif = skillMotif(skillId)`:
- **motif.kind !== "none"** → `renderVolley(...)` with `planVolley(from, at, motif)`,
  then on arrive run `baseBurst` + (hero) `renderSignature` / (tower)
  `renderTowerShape` + element. This replaces the generic `bolt`/`beam` delivery
  for projectile skills.
- **motif.kind === "none"** → unchanged: existing `renderDelivery` for the spec's
  `delivery` (cast/ground/skyfall/beam), then the signature. Melee/area/curse/sky
  skills keep their matching choreography.

### 5. Signature audits (small corrections only)

- **triple-volley** signature trims to *three small landing sparks* fanned at the
  target (the arrows now fly in via the volley), instead of three full beams.
- **muzzle-barrage** signature trims to *impact spits* at the target (the five
  tracers now come from the volley).
- **iron-cleave / steel-cross** → ensure it reads as a **wide single arc** cleave
  (description says "wide arc"), keeping the spark shock.
- **void-palm / void-rift** → add a brief **palm-thrust** gleam from the hero
  before the rift tears (description: "palm strike").
- All other signatures unchanged.

## Units & boundaries

| Unit | Purpose | Depends on | Tested |
|---|---|---|---|
| `skillMotif.ts` (data) | skillId → literal SkillMotif | skillVfxMeta spec, towerSkillShapeIndex | ✅ pure |
| `SkillVfxSpec.motif` field | authored hero motifs | — | ✅ via coverage test |
| `projectileVolley.ts` (scenes, pure) | from/at/motif → VolleyShot[] frames | Vec2 only | ✅ pure |
| `renderVolley` (in skillDelivery.ts or projectileVolleyFx.ts) | draw glyphs along shots | VfxDraw | visual (CDP) |
| `SkillVfx.cast` wiring | pick volley vs delivery | skillMotif, planVolley | existing plumbing test |

File-size watch: `skillElementFx.ts` is already 544 lines (pre-existing, untouched).
Keep new renderer in its own `projectileVolleyFx.ts` rather than growing
`skillDelivery.ts`; keep `skillMotif.ts` and `projectileVolley.ts` small and pure.

## Testing

- **Pure unit (Vitest):**
  - `skillMotif`: tri-shot→arrow/3/fan, rapid-fire→bullet/5/stream,
    piercing-arrow→arrow/1/pierce, concussion-round→bullet/1, spirit-bolt→orb/1,
    valiant-strike/arcane-nova/shadow-curse→none. Tower `barrage`→bullet stream,
    `nova`→none. Every hero skill resolves (no undefined).
  - `planVolley`: fan returns `count` shots with distinct `to` and equal `from`;
    stream returns ramped non-decreasing `delay`; pierce extends `to` beyond `at`
    (|from→to| > |from→at|); single returns exactly one shot heading at `at`.
  - Coverage guard: every `ACTIVE_SKILLS` id has a `motif` on its `SKILL_VFX`
    spec; counts match the authored table.
- **Visual (CDP):** a repro that triggers casts via `window.__game` and screenshots
  the board, proving 3 arrows fan for tri-shot and 5 tracers stream for rapid-fire,
  with skill FX still under units.
- **Regression:** full `npx tsc --noEmit && npx vitest run` + `npm run build`.

## Risks

- **Over-busy frame:** five tracers + impact could clutter. Mitigate with short
  travel time and trimmed impact signatures.
- **Depth:** volley draws through `VfxDraw` at the skill depth band, same as the
  current delivery — no new depth surface, invariant preserved.
- **Tower false-positives:** deriving motif from shape could fire projectiles for
  an aura/cloud tower. Mitigated by mapping all area shapes to `none`.
