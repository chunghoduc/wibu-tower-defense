# Art & animation design (8-bit pixel)

The game's art direction is **8-bit / pixel-art**, AI-generated, authored after the
data exists. This skill produces a **sprite spec + a reusable AI-generation prompt**
and an **animation plan** — not the final pixels. Consistency across the roster is
the whole game; follow these conventions so every character looks like it belongs.

## Canonical sprite spec

- **Base canvas:** 48×48 px per frame (towers/characters). Bosses/large units may
  use 64×64. Keep the character centered with ~4 px of headroom.
- **Resolution feel:** true 8-bit — chunky pixels, no anti-aliasing, hard edges.
- **Palette:** limited, ~16 colors per character. Pick a small, cohesive palette
  that signals the character's element (fire = warm reds/oranges, ice = cyan/white,
  poison = sickly greens/purples, etc.).
- **Silhouette first:** the shape must read at a glance and signal the **role** —
  e.g., a bow/long barrel for ranged `damage`, a bomb/cannon bulk for `splash`, a
  staff/orb for casters, a banner/instrument for `support`. A player should guess
  the role from the silhouette alone.
- **Rarity tell:** encode rarity in a consistent accent — a colored outline/aura by
  rarity (Common grey, Magic blue, Rare purple, Legendary gold, Unique rainbow/
  prismatic). Keep it subtle so it doesn't break the silhouette.
- **Facing:** default facing right (the lane runs left→right toward the castle);
  the renderer can flip as needed.

## AI-generation prompt template

Fill the brackets and reuse this so outputs stay on-model:

```
8-bit pixel art sprite, 48x48, of [original character name] — [one-line visual
description: build, outfit, signature weapon/effect], [element] theme.
Limited ~16-color palette dominated by [palette colors]. Strong readable
silhouette, hard pixel edges, no anti-aliasing, transparent background, centered,
facing right. [rarity] accent outline ([rarity color]). Single idle frame.
Style: retro 8-bit JRPG, consistent with a tower-defense roster.
NEGATIVE: realistic, smooth shading, blurry, text, watermark, real-person likeness.
```

Generate the idle frame first; once approved, generate the other states (below)
matching the same palette and proportions.

## Animation plan

Specify these states with frame counts and timing. Tie the **attack** animation to
the character's `attackSpeed` so the swing/cast reads in rhythm with how often it
actually fires (a 0.5/s attacker has a slow, weighty animation; a 1.4/s attacker a
snappy one).

| State | Frames | Notes |
|-------|--------|-------|
| `idle` | 2–4 | gentle loop (bre/float); always playing when not acting |
| `attack` | 3–6 | wind-up → release → recover; duration ≈ 1 / attackSpeed |
| `hit` | 1–2 | brief flinch/flash when the tower takes damage (towers are destructible) |
| `death` | 4–6 | one-shot; play on destruction before the sprite is removed |
| `active-cast` | 4–8 | the signature-skill flourish, fired when the mana bar fills |

Also note any **projectile / effect** sprite the role implies (arrow, bomb burst,
lightning arc, frost ring, petal scatter, buff aura pulse) and its color, so VFX
stay consistent with the character's palette.

## Deliverable from Stages 5–6

- A filled-in AI-gen prompt for the idle frame.
- A short sprite spec: dimensions, palette list, silhouette/role read, rarity tell.
- The animation table above with this character's actual frame counts + timing.
- Set `artRef` on the CharacterDef (placeholder string until the asset is produced;
  use a stable kebab id, e.g. the character's `id`).
