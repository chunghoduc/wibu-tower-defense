# Plan — Achievement SDXL Icons

Spec: ../specs/2026-06-14-achievement-sdxl-icons-design.md

## M1 — Drift guard + key (RED→GREEN)
- [ ] `tests/achievementIconPrompts.test.ts`: `ACHIEVEMENT_VISUAL` keys === `ACHIEVEMENTS` ids,
      non-empty, distinct.
- [ ] extend `tests/` for `achievementTex` (or fold into existing assetKeys test).
- [ ] add `achievementTex` to `src/data/assetKeys.ts`.
- [ ] add `ACHIEVEMENT_VISUAL` / `ACHIEVEMENT_NEGATIVE` / `achievementIconStyle` to
      `scripts/sdart/prompts.mjs` + declarations in `prompts.d.mts`.

## M2 — Generator job
- [ ] `sdgen.mjs` imports + `buildJobs()` achievement loop (kind achievement, 768→cut 128).

## M3 — Wire into game
- [ ] `PreloadScene`: load every `achievementTex(id)`.
- [ ] `AchievementScene.drawCard`: 64px medallion left, text shifted right, exists() fallback.

## M4 — Generate + verify + ship
- [ ] `npm run gen:sprites --only=achievement` (SD server on :8765).
- [ ] `npm test`, `tsc --noEmit`, `vite build`.
- [ ] bump `ASSET_VERSION` (art regen), build, deploy hosting.
- [ ] commit per milestone; update memory.
