# Tower Role-Icon Redesign — Design Spec

**Date:** 2026-06-14
**Status:** Approved (full-auto session)
**Supersedes the emblem concepts in:** `2026-06-12-tower-role-icons-design.md`
(the architecture from that spec stays; only the emblem *vocabulary* changes)

## Problem

Every tower wears an SDXL role emblem in its upper-right corner (and on build-bar
cards, squad tiles, and the squad info panel). The emblems exist and are wired
correctly, but two issues remain:

1. **`damage` uses a plain upright sword.** A sword reads as *a weapon / melee*,
   not as the **role** "single-target precision DPS." It collides with the
   melee-vs-ranged signal the badge ring already carries, so it tells the player
   nothing new.
2. **Several emblems share a rounded blob silhouette** at 16 px (droplet, star,
   shield all read as "a colored lump"), so the 7 roles are not instantly
   distinguishable at the size they actually render. The roles are exactly the
   information the player needs and they are the least legible.

## Goal

Redesign the **emblem vocabulary** so all 7 `TowerRole`s have **maximally distinct
silhouettes** that each *describe what the tower does*, regenerate them through the
existing SDXL `roleicon` flow, and lock the role→icon assignment behind a test so
no role can ship without (or with the wrong) emblem.

No architecture change: the badge is still a managed `roleicon__<role>` `Image`
tinted by `ROLE_BADGE_COLOR`, loaded in `PreloadScene`, rendered in
`battleSceneSprites` / build-bar / squad tiles via `roleBadgeTex(role)`. The
melee/ranged ring stays. Mechanics untouched — purely presentational.

## The redesigned emblems

`TowerRole = damage | splash | chain | dot | support | debuff | tanker`.
Silhouettes are chosen to be pairwise distinct: a **scope ring**, a **spiky
burst**, an **angular fork**, a **teardrop**, an **up-arrow**, a **down-arrow**,
and a **shield** — seven shapes no two of which collapse into each other at 16 px.

| role    | meaning                       | NEW emblem (silhouette)                                   | why it reads as the role                      | color (unchanged) |
| ------- | ----------------------------- | -------------------------------------------------------- | --------------------------------------------- | ----------------- |
| damage  | single-target precision DPS   | **targeting crosshair / scope reticle** (ring + cross + center dot) | "locks one target, precise" — not a weapon | `0x4fc3f7` sky    |
| splash  | area-of-effect burst          | **spiky explosion burst** with radiating shards          | a boom that throws shards = hits an area      | `0xff8a65` coral  |
| chain   | bounces between targets        | **forked lightning** splitting into two jagged prongs    | the fork = arcs/jumps to multiple targets     | `0xba68c8` violet |
| dot     | damage over time (poison/burn) | **venom droplet** with a small rising bubble + drip      | a dripping toxic drop = lingering damage      | `0x9ccc65` toxic  |
| support | buff aura                      | **bold upward arrow** (thick, rising)                    | buffs allies **up**                           | `0xfff176` gold   |
| debuff  | slow / weaken                  | **bold downward arrow** (thick, falling)                 | weakens enemies **down** — clean mirror of support | `0x4db6ac` teal |
| tanker  | frontline HP wall              | **knight heater shield** with a center boss stud         | a shield = a wall that holds the line         | `0x90a4ae` steel  |

The `damage` swap (sword → crosshair) and the `splash`/`chain`/`dot` sharpening
are the substantive changes; `support`/`debuff` become a deliberate up/down mirror
pair (opposite meanings, opposite arrows) and `tanker` is kept as a shield but
re-prompted bolder.

## Architecture (what actually changes)

1. **`scripts/sdart/prompts.mjs` — `ROLE_VISUAL`.** Rewrite all 7 emblem
   descriptions per the table. Keep `roleIconStyle()` / `ROLEICON_NEGATIVE` and
   the "ONE simple solid shape, readable at 16 px" framing as-is — only the
   per-role `{V}` strings change.

2. **Regenerate art.** `npm run gen:sprites -- --only=roleicon` re-emits the 7
   `public/assets/sprites/roleicon/<role>.png` cutouts (768→64 px transparent).
   No manifest churn (hand-loaded images, like the previous pass).

3. **Cache-bust.** Bump `ASSET_VERSION` in `src/data/assetVersion.ts` (art regen
   + redeploy rule) so returning players refetch the new emblems instead of the
   poisoned `immutable` cache.

4. **No runtime-code change.** `roleBadge.ts`, the renderers, and preload keep
   working — the texture keys are identical (`roleicon__<role>`), only the pixels
   behind them change.

## Testing (TDD)

The art is the deliverable, but the *assignment* is testable and is exactly what
the user asked to get right. RED-first:

- **New `tests/roleIconPrompts.test.ts`** (imports the build-script `ROLE_VISUAL`
  + `TOWER_ROLES`):
  - every `TowerRole` has a `ROLE_VISUAL` entry — no role ships emblem-less;
  - no extra/dead `ROLE_VISUAL` keys beyond the real roles — guards against a
    stale emblem mapping to nothing;
  - all 7 emblem descriptions are distinct (no two roles share a prompt → no two
    roles can render the same icon).
- Existing `roleBadge.test.ts` (every role → distinct `roleicon__<role>` key) and
  `assetKeyDiscipline` stay green — the wiring contract is unchanged.

This guard is what makes "assign the icon to tower cards correctly" enforceable:
the card/tile/badge all resolve `roleBadgeTex(def.role)`, and the test proves the
mapping is total and collision-free.

## Verification

- `vitest run` (new + existing suites green), `tsc --noEmit`, `eslint`,
  `vite build` clean.
- Regenerate the 7 PNGs; eyeball the SDXL output (and re-run a role if a prompt
  yields a muddy/illegible emblem).
- Live `scripts/playtest/repro_role_icons.mjs` — asserts every build-bar card
  carries its `roleicon__<role>` emblem and screenshots the bar for the eye.

## Out of scope

- Changing role mechanics or the `TowerRole` set.
- Re-theming text role labels (`ROLE_LABEL`) — already clear.
- Animating the badge; per-tower (non-role) icons.
