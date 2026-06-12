# Skill VFX — Source-Delivery + Multi-Beat Choreography

**Date:** 2026-06-12
**Status:** Approved (full-auto: author judgment stands in for user approval)
**Author:** Claude (Opus 4.8)

## Request

> "Update all skill VFX visual skill to make sure the visual of all skills look cool,
> impressive and lively. The skill should fly from the source (such as from hero, or
> fall down from sky, or grow up from ground, etc...). Update this and generate at
> least 4 frames for each skill visual effect to make them beautiful. Update the skill
> visual effect for all hero skills."

## Interpretation & Assumptions

Two concrete asks, plus a quality bar:

1. **Source delivery** — every skill must visibly _arrive_ from somewhere: fly from the
   caster, fall from the sky, erupt from the ground, beam from the caster, etc. Today the
   cast set-piece simply _appears_ at the target with no sense of origin or travel.
2. **"At least 4 frames" per effect** — In this codebase, VFX is **100% procedural Phaser
   shapes + tweens, deliberately asset-free** (see memory `project_skill_vfx_signatures`,
   `project_art_pipeline_sdxl`; the SDXL pipeline is for sprites/icons, never battle VFX).
   Rendering a sprite-sheet of diffusion frames per skill would break that architecture and
   the file-size/perf budget. **Assumption (stated, proceeding):** "4 frames" means each
   effect is choreographed into **≥4 distinct sequenced beats** — a real animation timeline
   (anticipation → travel → impact → aftermath), not four static raster frames. This is the
   right reading for a tween-driven engine and delivers exactly the "lively, beautiful"
   intent.
3. **Scope** — all **14 hero active skills**. Tower active fallbacks (the 7 elemental
   styles) get the same delivery treatment for free since they share the renderer; that is a
   welcome bonus, not the focus. No gameplay/damage/timing-of-damage change.

## Background (current system)

- `src/data/skillVfxMeta.ts` — data: `SkillVfxSpec { signature, palette, appearance }`, one
  per skill, 1:1 with `ACTIVE_SKILLS` (test-enforced).
- `src/scenes/skillSignatures.ts` — a `VfxDraw` kit + 14 bespoke `SigFn` set-pieces drawn at
  the **target** point. 353 lines.
- `src/scenes/skillVfx.ts` — `SkillVfx.cast(at, radius, skillId, source)`: hero skills →
  `baseBurst` + `renderSignature`; tower skills → keyword elemental style. 314 lines.
- The `cast` FxEvent (`battleTypes.ts`) carries `at` (target), `source`, `skillId` — **but
  not the caster's position**, so "fly from source" is currently impossible to render.
- `castActive` (`battleDamage.ts`) emits the event; called from `battle.ts` (hero, `h.pos`
  available) and `battleTowers.ts` (tower, `t.pos` available).

## Design

### 1. Plumb the caster position (`from`) to the renderer

The single missing fact. Thread the caster's world position end-to-end:

- `battleTypes.ts`: add `from: Vec2` to the `cast` event.
- `battleDamage.ts` `castActive(...)`: add a `from: Vec2` parameter; include it in `emit`.
- `battle.ts` hero cast: pass `h.pos`. `battleTowers.ts` tower cast: pass `t.pos`.
- `fx.ts`: pass `e.from` into `skillVfx.cast`.
- `skillVfx.ts`: `cast(from, at, radius, skillId, source)`.

Damage still lands at `at` (target) — unchanged. `from` is presentation-only.

### 2. Delivery archetypes (the "fly from source" layer)

A new **delivery** concept: _how the skill travels from its origin to the impact point_,
played **before** the existing impact signature. Five reusable choreographies, each ≥2 beats,
so combined with the impact + aftermath every skill clears the ≥4-beat bar:

| kind      | origin           | motion (beats)                                                              |
| --------- | ---------------- | --------------------------------------------------------------------------- |
| `bolt`    | caster           | ① charge-glow gathers at caster → ② glowing orb + trail flies caster→target |
| `beam`    | caster           | ① charge-flash at caster → ② instant tapering lance/streak caster→target    |
| `skyfall` | sky above target | ① target ground-marker telegraph blooms → ② body plummets sky→target        |
| `ground`  | below target     | ① cracks telegraph at target → ② energy/shards erupt upward from ground     |
| `cast`    | caster (melee)   | ① wind-up glow at caster → ② quick draw-streak caster→target                |

On the delivery's final beat it invokes `onArrive()`, which fires beat ③ **impact** (the
existing per-skill signature set-piece) and the signature's own beat ④ **aftermath** (linger
ring / drifting motes / afterimage — already present in most signatures; thin ones get a beat
added).

### 3. Data: assign a delivery per skill

Add `delivery: DeliveryKind` to `SkillVfxSpec`. `DeliveryKind` is declared in
`skillVfxMeta.ts` (data layer; the scene delivery module imports it — no upward dependency).

| skill            | signature        | delivery  | rationale                  |
| ---------------- | ---------------- | --------- | -------------------------- |
| valiant-strike   | valiant-sweep    | `cast`    | hero sword sweep           |
| spirit-bolt      | spirit-comet     | `bolt`    | a comet flies out          |
| iron-cleave      | steel-cross      | `cast`    | thrown cross-blades        |
| stone-bash       | earthshatter     | `ground`  | erupts from earth          |
| execute-slash    | guillotine       | `skyfall` | blade drops from sky       |
| tri-shot         | triple-volley    | `bolt`    | arrows fly from archer     |
| piercing-arrow   | piercing-lance   | `beam`    | instant lance-beam         |
| mana-burst       | mana-detonation  | `bolt`    | charged orb lobbed         |
| arcane-nova      | arcane-supernova | `skyfall` | supernova falls into place |
| rapid-fire       | muzzle-barrage   | `bolt`    | tracer stream from gun     |
| concussion-round | concussion-blast | `skyfall` | shell falls from sky       |
| shadow-curse     | hex-sigil        | `ground`  | sigil blooms from ground   |
| true-strike      | pure-technique   | `beam`    | instant iai draw-line      |
| void-palm        | void-rift        | `beam`    | void lances from palm      |

Tower fallback: a pure `deliveryForStyle(style)` map (lightning→`skyfall`, slash→`cast`,
rest→`bolt`) so tower actives also arrive from their source.

### 4. Module layout (respecting the 500-line limit)

- **`src/scenes/vfxDraw.ts` (NEW)** — extract `VfxDraw` from `skillSignatures.ts` verbatim,
  add a few travel primitives (`orbTravel`, `chargeGlow`, `fallStreak`, `riser`, `marker`).
  Shared by signatures + delivery. (`skillSignatures.ts` drops to ~220 lines.)
- **`src/scenes/skillDelivery.ts` (NEW)** — `DeliveryFn` per kind + `renderDelivery(d, kind,
from, at, palette, radius, onArrive)`.
- **`src/data/skillVfxMeta.ts`** — `DeliveryKind` type, `delivery` field on each spec,
  `deliveryForStyle`.
- **`src/scenes/skillVfx.ts`** — `cast(from, at, ...)`: run `renderDelivery(...)` →
  `onArrive` fires `baseBurst` + `renderSignature` (hero) or the element method (tower).
- **`src/scenes/skillSignatures.ts`** — import `VfxDraw` from `vfxDraw.ts`; top up the three
  thinnest signatures (triple-volley, piercing-lance, muzzle-barrage) to a clear aftermath beat.

### 5. Testing strategy (TDD)

VFX rendering is presentation (Phaser) and not unit-testable, but the data + plumbing are:

- **`tests/skillVfx.test.ts`** (extend): every `ACTIVE_SKILLS` skill has a `delivery` ∈ the
  known `DELIVERY_KINDS`; `deliveryForStyle` returns a valid kind for every `SkillStyle`.
- **`tests/skillVfx.test.ts`** (extend): the `cast` FxEvent now carries a `from` equal to the
  hero's position (assert `fx.from` is the hero `pos` on a hero cast). This guards the new
  end-to-end plumbing — the part that actually makes "fly from source" possible.
- Existing tests (signature uniqueness, palette, damage-type, leveling) must stay green.
- **Playtest** via CDP `snap.sh`: force a hero cast of several skills, capture frames mid-
  delivery and at impact, confirm 0 runtime errors and visible source→target travel.

## Non-Goals

- No sprite/diffusion VFX assets (architecture is procedural by design).
- No change to damage, splash radius, mana, timing of damage application, or which enemies are
  hit. Delivery is cosmetic and resolves within the same cast event.
- No new skills, no boss-VFX changes (boss casts have their own bespoke system).

## Risks & Mitigations

- **Delivery delays the impact visual** → keep deliveries short (≤220 ms) so the burst still
  reads as instant; damage already applies on the same tick regardless of visuals.
- **More tweened objects per cast** → each beat self-destroys on completion (existing pattern);
  object counts stay in the low dozens, same order as today.
- **File-size limit** → the `VfxDraw` extraction is the mechanism that keeps every touched
  file well under 500 lines.
- **Type layering** (`DeliveryKind` in data, used by a scene) → declare the type in the data
  module so the scene depends downward only, matching `SkillSignature`'s existing pattern.
