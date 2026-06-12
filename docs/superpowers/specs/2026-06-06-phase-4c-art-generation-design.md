# Phase 4c — Local-LLM Art Generation Design

**Date:** 2026-06-06
**Status:** Design approved (approach B: external model, driven automatically via local Ollama)
**Type:** Art asset generation pipeline

---

## 1. Goal

Generate the full sprite inventory for wibu-tower-defense automatically, using the
user's **local Ollama** server as the image source — with no external paid service
and no manual image-tool steps.

## 2. Hard Constraint (and the workaround)

Ollama serves **LLMs**, not diffusion models. Gemma4 / Qwen cannot emit raster
images. The workable path, validated by a live test against `gemma4:latest`:

> The LLM **designs each sprite as a palette-indexed pixel grid** (rows of symbols);
> our code **rasterizes** that grid to a PNG.

The model decides every pixel; we encode. Fully automated through Ollama.

**Validated reality (live test, 16×16 fire-wizard prompt):**

- The model produces a recognizable sprite grid.
- BUT raw output is noisy: line lengths drift, it invents palette symbols, ~45 s/sprite.
- Therefore the harness MUST sanitize, validate, and retry; a full run is a
  multi-hour batch (acceptable — the user delegates long sessions).

## 3. Asset Inventory

| Category            | Count | Frames each | Frame names                    |
| ------------------- | ----- | ----------- | ------------------------------ |
| Towers (characters) | 32    | 3           | idle, attack, death            |
| Enemies + minions   | 15    | 4           | walk, attack, hit, death       |
| Bosses              | 3     | 4           | walk, attack, hit, death       |
| Hero                | 1     | 5           | idle, walk, attack, hit, death |
| Item icons          | 20    | 1           | icon                           |
| Skill VFX           | ~14   | 1–2         | cast (+ impact)                |

≈ **71 base (primary-frame) sprites**, then ≈ **210 animation frames**.

**Phase 4c (this spec) covers the harness + the 71 base sprites only.** Animation
frames and render integration are Phase 4d.

## 4. Design Resolution

Generate small, upscale at render (Phaser nearest-neighbor = crisp retro):

| Class        | Generation grid | Render target (from artSpec) |
| ------------ | --------------- | ---------------------------- |
| tower / hero | 16×16           | 32×32                        |
| enemy        | 16×16           | 24×24                        |
| boss         | 24×24           | 48×48                        |
| item         | 12×12           | 16×16                        |

Small grids are markedly more coherent from an LLM and ~4× faster than 32×32.

## 5. Architecture

All harness code is dependency-free (Node built-ins only) and lives under `src/art/`.

```
src/art/palette.ts      Named palette symbol -> RGBA. Families: outline, skin,
                        metal, cloth, flame, frost, nature, shadow, gold, plus
                        rarity accents. Resolves a per-entity palette from data.
src/art/spriteGrid.ts   parseGrid(text) -> sanitizeGrid(...) -> SpriteGrid (2D
                        symbol array, exact WxH). Optional mirrorHorizontal().
                        validateGrid() rejects empty/blob output.
src/art/pngEncoder.ts   encodePng(rgba, w, h) -> Uint8Array. Hand-rolled PNG
                        (signature, IHDR, IDAT via zlib.deflateSync, IEND, CRC32).
src/art/ollamaClient.ts generate(model, prompt, opts) -> string. fetch POST to
                        http://localhost:11434/api/generate; timeout; throws on
                        non-200 so the orchestrator can retry.
src/art/gridPrompt.ts   buildGridPrompt(entry, gridW, gridH, palette) -> string.
                        Wraps the existing artPrompts.ts text with strict grid
                        output rules + the exact allowed palette symbols.
scripts/genSprites.ts   Orchestrator. CLI flags: --only=<kind>, --id=<id>,
                        --model=<name>, --retries=<n>, --force. Resumable: skips
                        existing PNGs unless --force. Logs per-sprite progress.
```

### 5.1 Sanitization rules (spriteGrid.ts)

Given raw model text and target (W, H):

1. Strip code fences / prose; keep lines that look like grid rows.
2. Take the first H grid-like lines; if fewer, pad with all-transparent rows.
3. Each line: truncate to W; if shorter, pad right with transparent.
4. Each char: if not an allowed palette symbol, map case-insensitively; if still
   unknown, set transparent.
5. `validateGrid`: reject if transparent fraction > 0.92 (empty) or any single
   non-transparent symbol > 0.85 of non-transparent cells (blob). Triggers retry.

### 5.2 Symmetry

`mirrorHorizontal(grid)` copies the left ceil(W/2) columns onto the right. Applied
to towers/hero/enemies/bosses (characters read better symmetric); NOT items/VFX.
Toggle per category in the orchestrator.

### 5.3 Retry strategy

Per sprite: up to `retries` (default 3) attempts. Keep the first grid that passes
`validateGrid`; if none pass, keep the attempt with the lowest "blobiness" score so
a file always exists. Log when a fallback was kept.

### 5.4 PNG encoding

Truecolor + alpha (color type 6), 8-bit. Scanlines use filter byte 0 (none).
Compress the filtered stream with `zlib.deflateSync`. CRC32 per chunk via a
precomputed table. No third-party packages.

## 6. Palette Resolution

`paletteFor(entry)` returns the allowed symbol→RGBA map for an entity:

- Always: `.` transparent, `K` outline (near-black).
- Character/enemy: skin/cloth/metal families + the **rarity accent** colour
  (matching RARITY_PALETTE) so rarity reads on the board.
- Item: metal/gem families + rarity accent.
- VFX: damage-type colour (Physical=steel, Magic=violet, True=white-gold) + flame/frost.

The prompt lists only that entity's symbols, so the model can't drift far.

## 7. Output Layout

`public/assets/sprites/<kind>/<id>.png` — exactly the paths `artPrompts.allArtPrompts()`
and `artSpec.spritePath()` already emit. The existing `PreloadScene` loads them with
no change. Base frame filename = `<id>.png`; Phase 4d adds `<id>__<frame>.png`.

## 8. Testing

Pure units, Vitest:

- `pngEncoder`: encode a known 2×2 RGBA → assert PNG signature, IHDR dimensions,
  decodes round-trip via `zlib.inflateSync` of IDAT to the original scanlines.
- `spriteGrid`: sanitize ragged/short/over-long/garbage input → exact W×H, only
  allowed symbols; validateGrid flags empty and blob; mirrorHorizontal is symmetric.
- `palette`: paletteFor returns transparent + outline + rarity accent for a sample
  tower; symbol set is non-empty and unique.

The Ollama call and end-to-end generation are validated by a real smoke run
(`--id` one tower), not asserted in CI (model output is non-deterministic).

## 9. Out of Scope (→ Phase 4d)

- Animation frames (walk/attack/hit/death) and Phaser animation playback.
- Swapping placeholder shapes for textures in BattleScene + card scenes.
- Hero equipment appearance overlays.
- Audio.

## 10. Risks

- **Quality:** LLM pixel art is rough. Mitigations: small grids, symmetry, tight
  palette, retry-keep-best. Accept a retro-primitive look; any sprite is regenerable
  and individually overridable later (drop a better PNG at the same path).
- **Speed:** ~45 s/sprite × 71 × retries ≈ 1–2 h. Mitigation: resumable batch,
  `--only`/`--id` for incremental runs, model is a flag (can benchmark a faster one).
- **Model drift:** strict palette + sanitizer make malformed output non-fatal.
