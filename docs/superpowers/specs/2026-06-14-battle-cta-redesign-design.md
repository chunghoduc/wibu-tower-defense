# Battle CTA Redesign — Design Spec

**Date:** 2026-06-14
**Status:** Approved (full-auto; self-reviewed)
**Topic:** Redesign the ugly main-menu BATTLE button into a high-contrast, tactile hero call-to-action.

## Problem

The home screen's primary BATTLE button (`drawPrimaryButton` in `src/scenes/homeBarFx.ts`)
is a flat, two-tone **amber** rounded rectangle with a tiny `▶` triangle, a bold label, an
idle alpha pulse, and a hover scale-up. It is the single most important action on the home
screen, yet:

1. **It blends in.** The fill is the same gold family as the two resource pills and the
   gold key-light / god-rays of the throne-hall backdrop ([[project_menu_backdrop]]). The
   primary action should have the *highest* contrast and a *distinct* hue from the chrome
   around it — right now it has neither.
2. **It reads flat.** A single solid fill with one hairline stroke. No depth, no material,
   no sense of a physical, pressable button — unlike the ornate painted SDXL nav icons it
   sits among, which carry rich frames.
3. **The "go fight" intent is weak.** A small `▶` glyph is the only combat signal. There's
   no martial emblem, no energy.

## Goal

Make BATTLE unmistakably the hero action: a **tactile, layered, crimson-ember war button**
with a gold-forged bevel, a real SDXL combat emblem, and a living sheen sweep — distinct in
hue from the gold chrome, with clear press feedback. No mechanic change; pure presentation.

## Design Decisions

### Visual language

- **Hue shift to crimson-ember, gold-forged trim.** Body is a vertical two-tone crimson→ember
  (deep `#7a1410` base → bright `#e0461f`/`#ff7a2e` face), framed by a bright forged-gold
  bevel (`#ffe9a8` highlight rim + `#7a4b12` shadow lip). Crimson is the universal "combat"
  signal and sits opposite the gold pills/backdrop, so the CTA pops as the brightest, most
  saturated element on screen.
- **Layered depth (top → bottom):** drop shadow → outer gold bevel → crimson body face →
  a soft top **gloss band** (white, low alpha, upper third) → four corner **rivets** (small
  gold studs) → emblem + label. This gives a forged-metal war-plate read that matches the
  ornate painted nav icons.
- **SDXL combat emblem (honors the standing "always use SDXL flow for icons" directive).**
  A single new SDXL emblem — **crossed swords over a flame/shield war sigil** — rendered on
  the LEFT of the button (replacing the tiny `▶`). Generated through the SOLE art pipeline
  (`scripts/sdart/`, [[project_art_pipeline_sdxl]]), mirroring the roleicon/achievement
  flow end-to-end ([[project_achievement_medallions]], [[project_role_icons]]). Texture key
  built ONLY in `assetKeys.ts` ([[project_asset_key_registry]]). Rendered behind a
  `textures.exists()` gate so a missing PNG degrades to no-emblem (never the `__MISSING` box).
- **Label.** `BATTLE` in bold ivory (`#fff4e0`) with a dark crimson stroke for punch, sized
  up from the surrounding chrome.

### Motion

- **Sheen sweep** — a diagonal bright band travels left→right across the face on a slow loop
  (~2.4s, long pause between sweeps). Replaces the flat alpha pulse; reads as "powered up / a
  live blade" rather than "fading". Clipped to the button's rounded body.
- **Hover:** scale 1.05 + brighten (Back.easeOut), as today but slightly punchier.
- **Press:** depress to 0.95 with a quick yoyo, then `fadeToScene` to StageSelect (unchanged).

### Prominence (layout)

- Bump the primary CTA height `PRIMARY_H` 42 → **52** in `homeLayout.ts` so the hero action
  is physically larger than the 46px secondary row. The home dock panel auto-grows
  (`panelH` already derives from `PRIMARY_H`), so the rest of the layout follows. Pure +
  test-covered.

## Architecture (isolation & testability)

Three units, each with one job:

1. **`src/scenes/battleCta.ts` — pure, Phaser-free, unit-tested.**
   `battleCtaPlan(r: Rect): BattleCtaPlan` computes the full layered geometry from the button
   rect: `body` (face rect), `bevel` lip thickness, `gloss` band rect (upper third), four
   `rivets` ({x,y}), `emblem` ({x,y,size}) anchored left, `label` ({x,y}) centered in the
   remaining space, and `sheen` travel range ({x0,x1,y,w,angle}). Deterministic; no Phaser
   import. This is the TDD seam — geometry is asserted (emblem left of label, gloss inside
   body, rivets in corners inset, sheen spans the body, plan scales with rect).
2. **`drawBattleCta(scene, label, targetScene, r)` in `homeBarFx.ts`** (renames/replaces
   `drawPrimaryButton`) — thin presenter that paints the plan: shadow, bevel, body, gloss,
   rivets, SDXL emblem (exists-gated), label, and wires the sheen tween + hover/press. Keeps
   `homeBarFx.ts` under the 500-line cap; if it would exceed, the CTA presenter moves to its
   own `battleCtaFx.ts`.
3. **SDXL emblem** — `prompts.mjs` `BATTLE_EMBLEM_VISUAL` + style/negative (declared in
   `prompts.d.mts`); `sdgen.mjs` job `kind: "battle"` (768 → cut 128) into
   `public/assets/sprites/ui/battle-emblem.png`; `assetKeys.ts` `battleEmblemTex()`;
   `PreloadScene` `load.image`. `ASSET_VERSION` bumped (art regen → redeploy).

`MainMenuScene.drawMenu` swaps `drawPrimaryButton` → `drawBattleCta` (one call-site change).

## Out of scope (YAGNI)

- No change to the nav rails, resource pills, backdrop, or any scene transition/mechanic.
- No new sound. No particle system (sheen is a single clipped tween).
- Only ONE new emblem icon (not a set).

## Testing

- **Unit (RED→GREEN):** `tests/battleCta.test.ts` — `battleCtaPlan` geometry invariants
  (emblem left of label & inside body; gloss in upper body; 4 rivets inset in corners; sheen
  spans body width; plan scales linearly with rect; label centered in text column).
- **Layout guard:** extend `tests/homeLayout.test.ts` for `PRIMARY_H = 52` (primary taller
  than bottom cells; panel grows to contain primary + row).
- **Drift guard:** `tests/battleEmblemPrompt.test.ts` — `BATTLE_EMBLEM_VISUAL` non-empty &
  `battleEmblemTex() === "ui__battle-emblem"`.
- **Live CDP repro:** `scripts/playtest/repro_battle_cta.mjs` — open MainMenuScene, assert the
  emblem texture loaded and the CTA container carries shadow+body+gloss+rivets+emblem+label,
  screenshot for the eye. VERDICT PASS/FAIL.
- Full gates: `tsc`, vitest suite, ESLint (max-lines 500), `npm run build`.

## Ship

Bump `ASSET_VERSION` (art regen), commit per milestone, push, `npm run build` +
`npx firebase-tools deploy --only hosting` (local-only; CI deploy broken). Send before/after
screenshots to chat.
