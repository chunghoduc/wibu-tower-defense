# UI / Icon / Background Art Assets

Hand-authored SVG UI art + AI-generated raster backgrounds for Wibu Tower Defense.
All assets are catalogued in `uiManifest.json` (key → path → intrinsic size) so the
loader can preload them in a single loop, mirroring the `spriteManifest.ts` pattern.

## How to wire into the game (developer note)

In `PreloadScene`, import `uiManifest.json` and loop each category:

```ts
import uiManifest from "../../public/assets/ui/uiManifest.json";
// SVGs: load with { width, height } so they rasterize crisply at intrinsic size
for (const e of [...uiManifest.icons, ...uiManifest.frames, ...uiManifest.buttons,
                 ...uiManifest.panels, ...uiManifest.passive, ...uiManifest.badges]) {
  this.load.svg(e.key, e.path, { width: e.w, height: e.h });
}
for (const e of [...uiManifest.logo, ...uiManifest.backgrounds]) {
  this.load.image(e.key, e.path);
}
```

Then reference by key, e.g. `this.add.image(x, y, "icon__gold")`,
`this.add.image(640, 360, "bg__stage-1")`, `this.add.image(x, y, "frame__rare")`.

## Categories

| Category   | Count | Folder              | Format | Notes |
|------------|-------|---------------------|--------|-------|
| Currency   | 5     | `icons/`            | SVG 64 | gold, gem, mana, energy, material |
| Damage type| 3     | `icons/`            | SVG 48 | physical, magic, true |
| Status fx  | 9     | `icons/`            | SVG 40 | burn, freeze, poison, stun, slow, shield, heal, atkup, speedup |
| Rarity frame| 5    | `frames/`           | SVG 200×260 | 9-slice card borders, transparent center |
| Buttons    | 3     | `buttons/`          | SVG 220×64 | primary, secondary, danger (9-slice) |
| Panels     | 2     | `ui/`               | SVG | panel 320×240, banner 360×80 (9-slice) |
| Passive    | 8     | `passive/`          | SVG 80 | one medallion per passive-grid region |
| Badges     | 8     | `badges/`           | SVG 72 | achievement medals |
| Logo       | 1     | `ui/logo.png`       | PNG 512 | crest emblem (use over main-menu bg) |
| Backgrounds| 13    | `backgrounds/`      | PNG | 10 stage backdrops (1280×720) + main-menu + loading + gacha |

## Stage background mapping

`bg__stage-1` … `bg__stage-10` map to stage array indices 0–9
(Greywood Trailhead → Wardens' Gate). See `stageIndex` / `stageName` in the manifest.

## Conventions

- Texture keys use the `category__name` pattern (double underscore), matching the
  existing `tower__`, `enemy__`, `vfx__` sprite-key convention.
- Frames/buttons/panels are designed for Phaser 9-slice (`this.add.nineslice`)
  so they scale to any card/button size without distortion. Suggested 9-slice
  insets: frames 18px, buttons 20px, panel 20px.
- All SVGs use a transparent background; backgrounds are opaque.
