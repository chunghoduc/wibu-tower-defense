# The Antihero Gallery, Reforged — Visual Redesign

**Date:** 2026-06-12
**Status:** Design approved (full-auto, owner standing approval)
**Author:** Claude (game-designer lens)
**Follows:** `2026-06-12-antihero-bosses-design.md` (the 10 bosses already ship; this is a pure *look & feel* pass)

## The request

> "redesign the look of 10 new bosses make them look super cool and walking lively with powerful skill and impressive skill visual effects"

Three concrete asks, each a pillar below: **(1)** cooler/more-detailed boss sprites, **(2)** a *lively* walk, **(3)** powerful, *impressive* skill VFX.

## Why this matters (the real problem)

The 10 Antihero bosses are mechanically rich but visually flat:

- **Sprites** were sliced from a single SDXL sheet with inconsistent yield — `crimsonlord` got **1** frame, `fallenward` **2**, several only 4. Descriptors are competent but not *cinematic* (no battle aura, no dramatic rim light, no epic-scale read).
- **Walk** is fake. The manifest renames the first two SDXL `idle*` poses to `walk1/walk2`, so a boss "walks" by toggling two near-identical standing poses — and `crimsonlord` (1 frame) is **fully static**, sliding down the lane. This is exactly the "floating" failure the enemy roster already solved.
- **Skill VFX** is one generic effect for all four skill types. `fx.ts:bossCast()` draws the *same* expanding ring + core + 14 radial dots for `quake`, `rally`, `barrier`, and `summon-surge` — only the color changes. A boss "force-choking" your towers looks identical to one healing its horde. No spectacle, no readability.

The bosses are the climax of every stage. They should *look* like legends.

## Design principles

- **Zero engine/sim change.** Mirror the original feature's ethos: this is art + presentation only. The pure-core `castBossSkill` already emits a `bossCast` event with `{skill, radius, name}` — everything new hangs off that. Sim stays headless and testable.
- **Reuse what already works.** The codebase already has (a) a proven procedural **walk bake** that synthesizes a real striding gait from one sprite (`enemyWalkBake.ts` + pure `enemyWalkWarp.ts` — the technique that "fixed floating"), and (b) a per-skill **VFX signature** system for hero abilities (`skillVfxMeta.ts` → `skillSignatures.ts`). The redesign extends *both* to bosses rather than inventing new infra.
- **Name-free homages stay name-free.** Richer prompts, same rule: the real anti-hero lives only in `// homage:` comments.
- **<500 lines per file.** New presentation lives in its own module(s).

---

## Pillar 1 — Cooler, more detailed sprites

Rewrite all 10 `BOSS_VISUAL` descriptors (`scripts/sdart/prompts.mjs`) to read as **epic boss art**, not a roster portrait. Every descriptor gains, woven naturally into its existing homage silhouette:

- a **signature battle aura / energy** cue (e.g. crownfall's golden ki flare, fallenward's crimson-blade glow, ashghost's fire-wreathed chains, mawborn's glistening symbiote ooze),
- **dramatic rim lighting + high contrast** so the silhouette pops on the battlefield and slices cleanly,
- an **imposing-scale / low-angle, powerful stance** read,
- preserved recognizability of the homage (Guts greatsword, Punisher skull, Scar's red sigil arm, etc.).

The sheet prompt (`charSheetPrompt`) is also nudged to emphasize **clearly separated, evenly spaced full-body frames** to raise slice yield. We accept that the bake (Pillar 2) makes the *walk* robust regardless of SDXL frame count — so a low-yield slice is no longer fatal; it just costs attack/skill one-shot frames, not the gait.

Regenerated via the existing SDXL flow (`npm run gen:sprites:anim -- --only=boss --force`), re-sliced, manifest entries refreshed. 160×160 cell retained.

## Pillar 2 — Lively walking (the keystone fix)

Extend the procedural walk **bake** to bosses. Today `bakeEnemyWalks()` runs only over `ENEMIES`; bosses are skipped and fall back to their fake 2-frame loop.

- Add `bakeBossWalks(scene)`, called alongside `bakeEnemyWalks` in `PreloadScene.create()`, reusing the same canvas band-warp machinery.
- Add a **`"stomp"` MotionProfile** to the pure `enemyWalkWarp.ts`: a *heavier, weightier* gait than rank-and-file `walk` — larger vertical bob, a slower-feeling stride, and a subtle whole-torso lateral sway (a boss "lumbers"). Bosses use `"stomp"`; this is the one new bit of pure, unit-tested math.
- Result: **every** boss — including 1-frame `crimsonlord` — gets a genuine 4-frame striding cycle synthesized from its base sprite. No more sliding. The runtime (`animateEnemy`) already couples step cadence to ground speed and plays `${key}_walk` for bosses with zero new wiring.

**Critical difference from the enemy baker — preserve the one-shot frames.** The enemy `bakeOne()` does `textures.remove(key)` then `addCanvas(key)`, which *destroys* the original sliced frames. For enemies that's harmless (their walk is the only anim that matters). For bosses it would break the `atk*/skill*` one-shots (Pillar 3 needs `_skill`). So `bakeBossWalks` must **not** remove the original texture: it bakes the 4-frame stride into a **separate canvas texture key** (`boss__<id>__walk`) and builds the `boss__<id>_walk` anim from *that* key, leaving the original `boss__<id>` texture (with its `atk*/skill*` frames + the `_attack`/`_skill` anims built at preload) intact. Phaser anim frames each carry their own `textureKey`, so the sprite transparently swaps textures between the walk loop and a one-shot. The walk-anim build must run **after** PreloadScene's manifest anim-creation loop (it already does — `bakeEnemyWalks`/`bakeBossWalks` are called at the end of `create()`).

## Pillar 3 — Impressive, distinct skill VFX

Replace the single generic `bossCast` ring with **four bespoke signature effects**, one per skill type, mirroring the hero `skillSignatures` pattern. New scene-side module `bossSkillVfx.ts`; `fx.ts:bossCast()` dispatches by `skill` type and falls back to the current ring for any unknown type.

| Skill | Bosses | Signature — reads as… |
|---|---|---|
| **quake** | gravemourn, sundermark, ashghost | **"the earth shatters"** — radial ground fissures crack outward from the boss, dust/debris columns rise, rock shards launch and fall, a slamming impact ring, heavy double screen-shake. |
| **rally** | unkilling, crimsonlord | **"they're rallying / healing"** — a war-roar: concentric red shock-rings, rising battle chevrons, each ally in radius flashes a red empowerment/heal aura, a brief red screen-vignette pulse. |
| **barrier** | crownfall, fallenward | **"shielded — burst it"** — hexagonal plates assemble and spin into a translucent crystalline **dome** around the boss that shimmers and locks; allies inside flash a shield rim. |
| **summon-surge** | mawborn, devourer, ashghost | **"more are coming"** — a dark **rift** tears open: jagged portal with a violet event-horizon glow, a spiraling summon-glyph, ember motes + grasping claw-silhouettes converging, then adds erupt outward. |

Plus, on every `bossCast`, the boss **sprite plays its `_skill` one-shot** (if present) so the *body* poses with the effect — "powerful skill" body language, not just particles. Returns to the walk loop automatically (the runtime already guards one-shots).

Skill-type→signature mapping is a tiny pure function (`bossSkillSignature(skill): SignatureName`) — unit-testable, mirroring `skillVfxMeta`.

---

## Architecture & files

**Pure / data (testable):**
- `src/scenes/enemyWalkWarp.ts` — add `"stomp"` to `MotionProfile` + its band-warp branch (heavier bob, torso sway). *(pure, unit-tested)*
- `src/data/bossSkillVfx.ts` *(or inline in the scene module)* — `bossSkillSignature(skillType)` pure mapping + signature metadata (color, label). *(pure, unit-tested)*
- `scripts/sdart/prompts.mjs` — 10 rewritten `BOSS_VISUAL` descriptors. *(art source of truth)*

**Scene-side (Phaser, not unit-tested — same boundary as the enemy bake & hero signatures):**
- `src/scenes/enemyWalkBake.ts` → add `bakeBossWalks(scene)` (or generalize `bakeOne` to take a key prefix + profile). Keep it under 500 lines; split a `bossWalkBake.ts` if it grows.
- `src/scenes/bossSkillSignatures.ts` — the four signature renderers (`quake/rally/barrier/summon-surge`) + a dispatch entry. Modeled on `skillSignatures.ts`.
- `src/scenes/fx.ts` — `bossCast()` dispatches to the new signatures; triggers the boss sprite `_skill` one-shot.
- `src/scenes/PreloadScene.ts` — call `bakeBossWalks(this)`.

**Art / manifest:**
- Regenerated `public/assets/sprites/boss/<id>.{png,json}` (10).
- `src/data/spriteManifest.ts` — refreshed 10 boss entries.

## Data flow

```
sim (unchanged):  castBossSkill → emit bossCast{skill,radius,name,uid,at}
scene fx.ts:      onEvent(bossCast) →
                    bossSkillSignatures.play(skillType, at, radius, name)   // bespoke VFX
                    + bossSprite.play(`${key}_skill`)                        // body pose
preload:          bakeEnemyWalks + bakeBossWalks  → `boss__<id>_walk` (4-frame stomp)
runtime render:   animateEnemy plays `${key}_walk`, cadence ∝ ground speed (already wired)
```

## Testing plan

- **Unit (pure):**
  - `enemyWalkWarp.test.ts` — `"stomp"` profile: feet shear opposite per side, body bobs, heavier amplitude than `"walk"`, continuous at the waist (no seam), zero displacement at phase 0.
  - new `bossSkillVfx.test.ts` — `bossSkillSignature()` returns the right signature for each of the 4 skill types + a safe fallback for unknown; every Antihero boss's skill type maps to a defined signature.
- **Regression:** full existing suite (850) stays green; no sim/data change touches them.
- **Manual / CDP playtest:** spawn all 10 bosses live, force each skill cast, confirm: (a) each boss *strides* (no sliding), (b) the four VFX are visually distinct and dramatic, (c) the boss body poses on cast, (d) **0** console errors in `logs/runtime.log`. Capture a montage.

## Risks & cheapest falsification

- **Bake clobbers attack/skill frames.** Mitigated by design: `bakeBossWalks` writes to a *separate* texture key and never removes the original. *Falsify cheapest:* after wiring, assert `boss__<id>_walk` AND `boss__<id>_skill` both exist for a multi-frame boss (e.g. `crownfall`) in a quick scene check / playtest before doing all 10.
- **`"stomp"` looks like a wobble, not weight.** *Falsify:* unit-test amplitudes first, then eyeball one boss in playtest before committing the prompt regen.
- **SDXL reprompt regresses a recognizable homage** (e.g. dark coat defeats the slicer again — happened to crimsonlord). *Mitigation:* the bake makes walk robust to low yield; keep descriptors bright/high-contrast; re-slice check per boss.
- **VFX too busy / tanks FPS.** Particle counts kept in the same order as the existing `bossCast` (≤ ~24 short-lived objects per cast, all tweened to destroy). Playtest watches frame health.

## Out of scope (YAGNI)

- No new boss mechanics, stats, or placement changes (the gameplay feature is done).
- No per-boss unique VFX (4 signatures keyed by skill type covers all 10; per-boss would be 10× the art for marginal read).
- No new sim events or schema fields.
