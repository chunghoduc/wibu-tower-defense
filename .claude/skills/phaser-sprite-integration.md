---
name: phaser-sprite-integration
description: Verify and wire generated sprites into the Phaser 3 game correctly — manifest registration, atlas loading, animation config, and Playwright-based smoke testing. Use after any sprite is generated and before marking it as delivered.
metadata:
  type: project-skill
  project: wibu-td-designer
  sources:
    - https://github.com/OpusGameLabs/game-creator (renderSpriteSheet pattern, palette index 0 = transparent)
    - Playwright MCP (@playwright/mcp) for automated gameplay smoke tests
---

# Skill: phaser-sprite-integration

A generated PNG that looks right in a preview is not done until Phaser loads it
correctly in the game. This skill covers the full wiring — from `spriteManifest.ts`
entry through animation config through a live smoke test.

## Part 1 — Spritesheet format (OpusGameLabs renderSpriteSheet convention)

The game expects a **horizontal sprite sheet**: all frames packed left-to-right in
one PNG. Phaser slices it with `frameWidth`.

```
| frame0 | frame1 | frame2 | frame3 | frame4 | frame5 | frame6 |
← frameWidth →← frameWidth →  ...                              ← frameWidth →
```

Critical rules (from OpusGameLabs pixel-renderer):
- **Palette index 0 is always transparent** — the CLI maps this to alpha=0.
- Frame offset formula: `x = frameIndex * frameWidth`, `y = 0`.
- Total sheet width = `frameWidth * frameCount`.
- The game's `PreloadScene` loads with `frameWidth` from `spriteManifest.ts`.

## Part 2 — Manifest registration

The `spriteManifest.ts` in the game is auto-generated. After writing a new sprite:

```bash
cd ../wibu-tower-defense
node scripts/svgart/gen.mjs       # regenerates spriteManifest.ts
npm run typecheck                 # must pass before continuing
```

Verify the new entry appears:
```bash
node src/cli.ts manifest | grep "<id>"
```

Expected fields: `key`, `kind`, `id`, `path`, `frameWidth`, `frameHeight`, `frames`, `names`.

For **static sprites** (enemy/item/vfx): `frames: 1`, `names: ["idle"]`.
For **animated** (tower/hero/boss): `frames: 7`, `names` as defined in the manifest.

## Part 3 — Phaser animation config

Phaser needs an animation registered for each named sequence. In `BattleScene.ts`
or the preload helper, confirm the `anims.create` call matches the manifest frame names:

```typescript
// For a tower with names: idle1, idle2, walk1, walk2, cast1, cast2, hurt
this.anims.create({
  key: `${spriteKey}-idle`,
  frames: this.anims.generateFrameNumbers(spriteKey, { frames: [0, 1] }), // idle1, idle2
  frameRate: 4,
  repeat: -1,
});
this.anims.create({
  key: `${spriteKey}-walk`,
  frames: this.anims.generateFrameNumbers(spriteKey, { frames: [2, 3] }), // walk1, walk2
  frameRate: 8,
  repeat: -1,
});
this.anims.create({
  key: `${spriteKey}-attack`,
  frames: this.anims.generateFrameNumbers(spriteKey, { frames: [4, 5] }), // cast1, cast2
  frameRate: 12,
  repeat: 0,
});
this.anims.create({
  key: `${spriteKey}-hurt`,
  frames: this.anims.generateFrameNumbers(spriteKey, { frames: [6] }), // hurt
  frameRate: 8,
  repeat: 0,
});
```

**Frame timing guidance (from pixel-plugin animator conventions):**
- Idle: 4 FPS (2 frames, ping-pong) — breathing motion
- Walk: 8 FPS (2 frames forward loop)
- Attack/cast: 10–12 FPS (2 frames, play-once) — snappy hit feel
- Hurt: 8 FPS (1 frame, play-once then revert to idle)

## Part 4 — Playwright smoke test (requires @playwright/mcp)

If the Playwright MCP server is available (`@playwright/mcp` installed), run a live
smoke test to verify the sprite renders without error in the actual game:

**Setup (one-time):**
```bash
npm install -g @playwright/mcp
# Add to Claude Code settings: mcp server "playwright" → npx @playwright/mcp
```

**Smoke test steps:**
1. Start the game dev server: `cd ../wibu-tower-defense && npm run dev`
2. Via Playwright MCP:
   - Navigate to `http://localhost:5173`
   - Open browser console (assert no "Failed to load texture" errors)
   - Navigate to the Collection scene or SquadScene
   - Assert the new tower sprite is visible (by texture key)
   - Trigger a battle with that tower equipped; assert attack animation plays
3. If any console errors appear: investigate and fix before marking delivery done.

**When Playwright MCP is not available:**
Run the game manually with `npm run dev` and visually confirm the sprite loads.
This is the minimum acceptable check — do not skip it.

## Part 5 — Delivery checklist

Before reporting a sprite as fully integrated:

- [ ] `node src/cli.ts verify <key>` → all ✓
- [ ] `spriteManifest.ts` has the entry (`node src/cli.ts manifest | grep <id>`)
- [ ] `npm run typecheck` passes in the game repo
- [ ] Sprite visible in game dev server (Playwright or manual)
- [ ] No Phaser console errors on load
- [ ] Animation plays at correct FPS in BattleScene

Do not claim delivery until this checklist is complete with evidence.
(`superpowers:verification-before-completion` applies here without exception.)
