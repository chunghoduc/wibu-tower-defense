---
name: generate-sprite
description: Generate a single Phaser-ready sprite PNG for one entity in the Wibu TD roster using the local Z-Image-Turbo API. Use when asked to create or regenerate the art for one tower, enemy, boss, item, or vfx entity.
metadata:
  type: project-skill
  project: wibu-td-designer
---

# Skill: generate-sprite

Generates one sprite for the Wibu Tower Defense game using the local image API, applies
the pixel-art post-processing pipeline, and writes the PNG to the game's asset directory.

## Pre-flight (run before generating)

1. **Check the image API is ready:**
   ```bash
   curl -s http://127.0.0.1:8765/health
   ```
   If `ready` is `false`, tell the user the GPU model is warming up. Do not proceed.

2. **Look up the entity** in the game catalog:
   ```bash
   node src/cli.ts prompts | grep -A3 "<entity-id>"
   ```
   Copy the exact prompt. Never write a prompt from memory — it must come from the catalog.

3. **Look up the output spec** in the manifest:
   ```bash
   node src/cli.ts manifest | grep "<entity-id>"
   ```
   Note `frameWidth`, `frameHeight`, `frames`.

4. **For animated entities (tower/hero/boss):** invoke `pixel-art-animator` before
   generating to plan the 7-frame sequence, establish the seed discipline, and confirm
   the correct `cast1/cast2` vs `atkUp/atkHit` frame names for this entity.

## Generation

For **animated entities** (tower, hero, boss — 7 frames):
- Generate **7 individual 1024×1024 images** — one per frame name.
- Name them `<id>-idle1.png`, `<id>-idle2.png`, … `<id>-hurt.png` in a temp dir.
- Use `seed + frame_index` to maintain consistent character across frames.
- Use the same prompt base for all frames; append the specific action to each:
  - `idle1` → "relaxed idle pose, weight on back foot"
  - `idle2` → "idle breathing variation, slight lean"
  - `walk1` → "mid-stride step, leading foot forward"
  - `walk2` → "opposite stride, trailing foot forward"
  - `cast1` / `atkUp` → "wind-up, weapon raised or stance loaded"
  - `cast2` / `atkHit` → "release, attack or spell discharge"
  - `hurt` → "recoil, damaged expression, slight knockback"

For **static sprites** (enemy 1-frame, item, vfx):
- Generate a single 1024×1024 image.

## Post-processing pipeline

Run the toolkit's sharp pipeline:
```bash
node src/cli.ts generate <kind>__<id>
```

This handles automatically:
1. Background removal (white → transparent)
2. Nearest-neighbor downscale to target size
3. Palette quantization to 64 colors (NES/SNES aesthetic)
4. For animated: horizontal strip packing (frame0 | frame1 | … | frame6)
5. PNG write to `../wibu-tower-defense/public/assets/sprites/<kind>/<id>.png`

**After the CLI pipeline:** invoke `pixel-art-cleanup` to check anti-aliasing removal,
palette discipline, and frame-to-frame colour consistency. This step is required before
any sprite is accepted — the CLI's quantization alone does not catch all edge bleed.

## Phaser integration

After `verify` passes, invoke `phaser-sprite-integration` to wire the sprite into
`spriteManifest.ts`, confirm animation config, and run the Playwright smoke test.

## Verification (mandatory — see `superpowers:verification-before-completion`)

```bash
node src/cli.ts verify <kind>__<id>
```

Must report: ✓ dimensions match manifest, ✓ frame count correct, ✓ alpha channel present.
Do NOT claim the sprite is done without running this and seeing all three ✓.

## Delivery to chat

Send the generated sprite to the user:
```
[[send: samples/<id>-preview.png]]
```

A preview PNG (upscaled 4× nearest-neighbor, no palette quantization) is written to
`samples/` automatically by the verify step. This is what the user reviews.

## If the result is poor quality

- Adjust prompt specificity: add role silhouette description, rarity accent color, lore detail.
- Change `seed` for variation.
- Increase `steps` to 11 (max useful for this model).
- For characters that come out too complex for 32×32: simplify by removing background
  environment cues from the prompt ("no environment, character only, centered on white").
- Do NOT accept a result that fails `verify` — regenerate.
