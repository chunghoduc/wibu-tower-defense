# Tower Role Icons — Design Spec

**Date:** 2026-06-12
**Status:** Approved (full-auto session)

## Problem

Every placed tower wears a small badge in its upper-right corner
(`battleSceneRender.drawTypeBadge`). Today that badge is hand-drawn immediate-mode
Graphics: a dark disc, a ring tinted by **kind** (melee/ranged), an inner fill
tinted by **role**, and a tiny sword (melee) or arrow (ranged) glyph.

The glyph communicates *melee vs ranged* clearly, but the tower's **role** —
the thing that actually tells the player what the tower DOES (single-target DPS,
splash, chain, damage-over-time, support aura, debuff, tank) — is conveyed only
by a faint 50%-alpha color fill. At a glance you cannot tell a `splash` tower
from a `chain` tower. With 7 roles in play this is the real information the
player needs and it is the least legible.

## Goal

Replace the generic sword/arrow glyph with a **distinct, instantly-readable role
emblem per `TowerRole`**, generated through the existing SDXL art pipeline
(`scripts/sdart/`). Keep the melee/ranged signal (as the badge ring color) so no
information is lost.

## The seven roles & their emblems

`TowerRole` = `damage | splash | chain | dot | support | debuff | tanker`.
Each emblem is a bold, flat, high-contrast icon that reads at ~16 px, tinted to
match its existing `ROLE_COLOR` for reinforcement:

| role     | meaning                       | emblem concept                              | color (existing) |
|----------|-------------------------------|---------------------------------------------|------------------|
| damage   | single-target precision DPS   | target reticle pierced by an arrowhead      | `0x4fc3f7` sky   |
| splash   | area-of-effect burst          | radiating starburst / explosion             | `0xff8a65` coral |
| chain    | bouncing lightning            | forked lightning bolt                       | `0xba68c8` violet|
| dot      | damage over time (poison/burn)| dripping venom droplet                      | `0x9ccc65` toxic |
| support  | buff aura                     | upward chevrons inside a radiant halo       | `0xfff176` gold  |
| debuff   | slow / weaken                 | downward arrow over a cracked hourglass     | `0x4db6ac` teal  |
| tanker   | frontline HP wall             | heater shield                               | `0x90a4ae` steel*|

\* `tanker` is currently **absent** from `ROLE_COLOR` (falls back to white) — this
work adds a steel color for it. (`economy`, a dead key, is left untouched.)

## Architecture

Mirror the **castle sprite** precedent (a recent, working pattern):

1. **New SDXL kind `roleicon`.** `scripts/sdart/prompts.mjs` gains a `ROLE_VISUAL`
   map (role → emblem description), a flat-emblem `roleIconStyle()` and a
   `ROLEICON_NEGATIVE` (bans characters, scenes, 3D, background — these are flat
   UI glyphs, not creatures, so they need their own style + negative just like
   `structure` did). `sdgen.mjs buildJobs()` emits one job per role →
   `public/assets/sprites/roleicon/<role>.png`. Generated ~256→**64 px** cutout
   on a transparent background.

2. **Asset keys.** `src/data/assetKeys.ts` gains
   `export const roleTex = (role: string) => \`roleicon__${role}\`;`
   (the sole place this key is built; the discipline test regex is extended to
   cover `roleicon`).

3. **Pure helper `src/scenes/roleBadge.ts`** (Phaser-free, unit-tested):
   - `roleBadgeTex(role: TowerRole): string` → the texture key via `roleTex`.
   - re-exports / owns nothing stateful; just the role→key mapping plus the
     badge geometry constants (radius, offset) so the renderer and tests agree.

4. **Preload.** `PreloadScene` loads all 7 emblems via `this.load.image(roleTex(r), …)`
   for every `r` of `TOWER_ROLES`. Missing files are non-fatal (loaderror is
   already swallowed) — the renderer falls back (see 6).

5. **Render — managed badge Image.** The badge becomes a managed
   `Phaser.GameObjects.Image` (textures cannot be drawn by immediate-mode
   Graphics). A new `roleBadges = new Map<number, Image>()` on `BattleScene`,
   created/positioned/culled alongside `towerSprites` inside `manageSprites()`
   (exact same lifecycle: ensure on living tower, `destroy()+delete` when the
   tower is gone, cleared in the scene-reset that already clears `towerSprites`).
   The badge sits at `tower.pos + (offset)` (upper-right), depth just above the
   tower, scaled to a fixed pixel diameter, and tinted with `ROLE_COLOR`.

6. **Fallback (no art / GPU-less tests).** `drawTypeBadge` keeps drawing the dark
   disc + kind-colored ring every frame (cheap, immediate-mode) — that's the
   frame. **If** the role emblem texture exists, the managed Image rides on top
   showing the role; **if not**, `drawTypeBadge` also draws the legacy sword/arrow
   glyph as before. So build + the full test suite stay green before art is
   generated and in headless/WebGL-less environments, exactly like the castle.

## What stays the same

- Badge position (upper-right of the avatar), the dark disc, and the
  melee/ranged **ring color** (`KIND_COLOR`) — melee/ranged stays legible.
- No sprite-manifest churn (these are hand-loaded images like `fx`/`material`/
  `structure`, not manifest spritesheets).
- Campaign / battle logic untouched — purely presentational.

## Testing (TDD)

- `roleBadge.test.ts` — every `TowerRole` maps to a distinct `roleicon__<role>`
  key; geometry constants are sane (positive radius/offset).
- `assetKeys.test.ts` — `roleTex` coverage.
- `assetKeyDiscipline.test.ts` — regex now includes `roleicon`.
- Renderer fallback invariant is preserved (texture-existence guard), so the
  existing suite stays green with no generated art.

## Out of scope

- Changing what a role *does* mechanically.
- Re-theming the squad/collection role labels (`ROLE_LABEL`) — those are text
  and already clear.
- Animating the badge.
