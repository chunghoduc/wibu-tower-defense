# Tower active-skill VFX — shape archetypes (mechanical-motion axis)

**Date:** 2026-06-12
**Status:** approved (full-auto session — author's engineering judgment is the approval gate)
**Follows:** [2026-06-12-skill-vfx-delivery-frames](./2026-06-12-skill-vfx-delivery-frames.md) (hero skills + the source-delivery/multi-beat layer)

## Problem

The previous feature gave every cast a *source-delivery* (fly / fall / erupt / beam) and a
≥4-beat (charge → travel → impact → aftermath) shape. Hero active skills additionally got
14 **bespoke** impact signatures. Tower active skills (a different id namespace — the
`active` string on a tower def, e.g. `"chain-lightning"`, `"explosion"`, `"war-cry"`) fall
through to a **keyword-derived elemental style** (`skillStyleFor` → one of 7: fire / ice /
lightning / heal / slash / poison / arcane).

So all **52 distinct tower actives collapse into just 7 looks**. Two skills that share an
element render *identically* even when their mechanics are completely different:

- `chain-lightning` (arcs between enemies) and `thunderbolt` (one sky-strike) → both "lightning".
- `explosion` (huge AoE nova) and `spirit-ball` (single bolt) → both could be "arcane"/"fire".
- `meteor-volley`, `frag-toss`, `zap-nova`, `petal-storm` (all splash) → scattered across elements, none reads as a *blast*.

The user wants every tower skill to "look cool, impressive and lively" and read distinctly —
just like the hero skills now do. We do **not** want 52 hand-authored set-pieces (excessive,
unmaintainable, and most tower skills don't carry enough identity to justify it).

## Design — a second, orthogonal axis: **shape**

Keep the existing **element** axis (substance + palette) and add an orthogonal **shape**
axis (mechanical motion + delivery). A tower cast is then `element × shape`:

| Axis | Source | Drives |
|------|--------|--------|
| **element** | `skillStyleFor(id)` (existing, keyword) | palette + the elemental *substance* particles (embers / frost / sparks / miasma / blossoms…) |
| **shape** | `towerSkillShape(def)` (NEW, **role-derived**) | the source **delivery kind** + a structural *motion flourish* (rings / links / strikes / shards / pillars / orb) |

7 elements × 8 shapes ≈ up to 56 visually-distinct combinations from two small, pure
classifiers — and it **auto-covers all current and future towers** with no per-skill table.

### Why role-derived, not keyword-derived, for shape

The mechanical category is already structured, reliable data: every tower def has a
`role` (`"damage" | "splash" | "chain" | "dot" | "debuff" | "support" | "tanker"`). Deriving
shape from `role` is accurate and stable, where a second keyword soup (overlapping with the
element keywords) would be fragile. Keywords refine **only** the ambiguous `damage` role into
beam vs barrage vs bolt.

The VFX layer only receives the skill `id` string at cast time (not the def), so we build a
`SKILL_SHAPE: Record<string, SkillShape>` index **once** from the tower catalog at module
load (`active → towerSkillShape(def)`), and the renderer looks `id` up (defaulting to `bolt`).

### The 8 shapes

```ts
type SkillShape = "nova" | "chain" | "barrage" | "beam" | "cloud" | "slam" | "aura" | "bolt";
```

Role → shape base mapping (keyword refines `damage` only):

| role | shape | motion flourish (structural, element-tinted) | delivery |
|------|-------|----------------------------------------------|----------|
| `splash` | **nova** | three staged concentric shock-rings punching outward | `skyfall` |
| `chain` | **chain** | 3–4 arcing jagged links leaping out to orbit points | `bolt` |
| `dot` | **cloud** | a slow lingering ground-ring + drifting expand | `ground` |
| `debuff` | **cloud** | (same family — lingering field) | `ground` |
| `support` | **aura** | rising light pillars + an expanding halo | `cast` |
| `tanker` | **slam** | radial ground shards + a heavy short shake | `ground` |
| `damage` + kw `wave/flash/hollow/purple/palm/beam/ki/fist/punch` | **beam** | a lance double-line through the target | `beam` |
| `damage` + kw `volley/salvo/missile/rapid/spin/siege/shot/barrage` | **barrage** | 4 stutter muzzle-strikes in a row | `bolt` |
| `damage` (else) | **bolt** | a single charged orb-pop + ring (default) | `bolt` |

`deliveryForShape(shape)` returns the delivery column; `bolt` is the catch-all default for
any unknown id.

## Pipeline (tower branch only — heroes untouched)

`SkillVfx.cast` tower fallback becomes:

1. `style = skillStyleFor(id)` → `palette` (`SKILL_STYLE_COLOR` + `ACCENT`) — **unchanged**.
2. `shape = SKILL_SHAPE[id] ?? "bolt"` — **new**.
3. `renderDelivery(draw, deliveryForShape(shape), from, at, palette, radius, onArrive)` —
   delivery now chosen by **shape** instead of `deliveryForStyle(style)`.
4. `onArrive`:
   a. `baseBurst(at, color, radius, id)` — **unchanged** (carries the icon emblem).
   b. `renderTowerShape(shape, at, palette, radius)` — **new** structural motion flourish.
   c. the existing elemental substance renderer (`fire/ice/lightning/heal/slash/poison/arcane`)
      — **kept** (this is the material flavour; throwing it away would lose elemental readability).
   d. one camera shake, weighted by **shape** (nova/slam heavy, chain medium, else light) —
      replaces the old style-based shake so we never double-shake.

Render order b-before-c puts structural rings/links *under* the particle substance.

## Module layout (every file stays < 500 lines)

- `src/data/attackStyle.ts` — **add** `SkillShape`, `towerSkillShape(def)`, `SKILL_SHAPES`
  (the runtime list), `deliveryForShape(shape)`. (Currently ~131 lines; +~40.)
- `src/data/towerSkillShapeIndex.ts` — **new**, tiny: builds `SKILL_SHAPE: Record<string,
  SkillShape>` from the tower catalog (keeps `attackStyle.ts` free of a catalog import cycle).
- `src/scenes/towerSkillFx.ts` — **new**: `renderTowerShape(d, shape, at, palette, radius)`
  with the 8 small flourishes, built on the shared `VfxDraw` kit.
- `src/scenes/skillVfx.ts` — swap delivery source + add the `renderTowerShape` call + shape
  shake. (The elemental renderers stay.)

## Testing strategy (TDD)

Pure-data tests (no Phaser) carry the weight:

1. **Coverage** — every tower `active` id resolves to a known `SkillShape` (no surprise default).
2. **Role mapping** — `towerSkillShape` returns the documented shape for each role
   (splash→nova, chain→chain, dot/debuff→cloud, support→aura, tanker→slam, damage→bolt/beam/barrage).
3. **Damage refinement** — keyworded damage skills map to beam (`kamefist-wave`, `hollow-purple`,
   `serious-punch`) and barrage (`rapid-volley`, `missile-salvo`, `siege-bolt`); a plain one
   (`spirit-ball`) maps to bolt.
4. **Variety** — the live catalog exercises ≥6 of the 8 shapes (proves we actually
   de-collapsed the 7-look problem).
5. **Delivery** — `deliveryForShape` returns a valid `DeliveryKind` for all 8 shapes.

Renderer coverage (`renderTowerShape` handles every `SkillShape`) is enforced at **compile
time** by an exhaustive `Record<SkillShape, …>` — no runtime render test needed (mirrors the
hero signature pattern). A CDP smoke playtest force-casts a representative tower skill per
shape and asserts 0 runtime errors.

## Non-goals

- No gameplay/balance/damage change — purely presentational. Damage still lands at `at`.
- No per-skill bespoke tower set-pieces (that's the hero pattern; YAGNI for 52 towers).
- No new art assets — VFX stay 100% procedural Phaser shapes/tweens.
- Heroes' bespoke signatures are untouched.

## Risks

- **Busy/over-rendered impacts** — mitigated by keeping each shape flourish *light* (a handful
  of shapes) and rendering it *under* the elemental particles, plus a single (not double) shake.
- **Role mis-reads** — a few damage skills may pick a less-apt beam/barrage/bolt; acceptable —
  still strictly better than the 7-look collapse, and refinable by editing the keyword lists.
