# Art Pipeline — Phase 4

8-bit / pixel-art, AI-generated, authored **after** the data catalogs (which are
complete). The pipeline is data-driven: prompts are generated from the catalogs
so art stays consistent with mechanics and the whole roster can be regenerated
in one pass.

## How it works

```
src/data/artSpec.ts      canonical dimensions, palette, sprite-key convention
src/data/artPrompts.ts   pure prompt generators (towerPrompt/enemyPrompt/itemPrompt)
scripts/genArtPrompts.ts emits docs/art/prompts.md
src/scenes/PreloadScene  loads every sprite that exists; missing = silent fallback
```

## Generating sprites

1. Regenerate prompts after any catalog change:

   ```bash
   npm run gen:art-prompts > docs/art/prompts.md
   ```

2. Feed each prompt in `docs/art/prompts.md` to an image model (Midjourney,
   DALL·E, Stable Diffusion). Every entry lists the exact path to save to.

3. Save each PNG to its listed path under `public/`, e.g.
   `public/assets/sprites/tower/zoran-thricedraw.png`.

4. Run the game. `PreloadScene` loads whatever exists; renderers light up
   automatically. No code change is needed to add art.

## Conventions

| Class | Dimensions | Path                            |
| ----- | ---------- | ------------------------------- |
| tower | 32×32      | `assets/sprites/tower/<id>.png` |
| enemy | 24×24      | `assets/sprites/enemy/<id>.png` |
| boss  | 48×48      | `assets/sprites/boss/<id>.png`  |
| hero  | 32×32      | `assets/sprites/hero/<id>.png`  |
| item  | 16×16      | `assets/sprites/item/<id>.png`  |

- **Texture key:** `spriteKey(kind, id)` → `"<kind>__<id>"` (e.g. `tower__karu-sunfist`).
- **Animation frames:** `idle, attack, hit, death` (single static frame accepted for v1).
- **Rarity reads at a glance:** palette accent + frame/glow per rarity
  (see `RARITY_PALETTE` in `artSpec.ts`), matching the UI rarity colours.
- **Missing files are never fatal** — `PreloadScene` swallows load errors and
  `hasSprite(scene, key)` reports `false`, so the placeholder-shape renderer is used.

## Remaining work

- **Render integration:** wire `hasSprite()` / `spriteKey()` into `BattleScene`
  (and the collection/gacha card scenes) so a loaded texture replaces the
  placeholder shape. Deferred until at least one real asset exists to verify
  against — rendering integration is only meaningful to test with art in hand.
- **Audio + UX polish** (transitions, juice) — later in Phase 4.
