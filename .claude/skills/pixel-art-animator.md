---
name: pixel-art-animator
description: Plan and generate the 7-frame animation sequence for any tower, hero, or boss sprite. Use when asked to animate a character, define walk cycles, or decide frame timing. Triggered by words like "animate", "frames", "walk cycle", "idle loop", "attack animation".
metadata:
  type: project-skill
  project: wibu-td-designer
  sources:
    - https://github.com/willibrandon/pixel-plugin (pixel-art-animator SKILL.md conventions)
    - Sprite-Pipeline frame consistency rules
---

# Skill: pixel-art-animator

Defines the 7-frame animation contract for Wibu TD's animated entity classes
(tower, hero, boss) and the generation prompts for each frame.

## Frame contract

All animated entities share the same 7-frame layout in the horizontal sprite sheet:

| Index | Name | Description | FPS in game |
|-------|------|-------------|-------------|
| 0 | `idle1` | Relaxed stance, weight on back foot | 4 (ping-pong with idle2) |
| 1 | `idle2` | Breathing variation, slight chest rise | 4 |
| 2 | `walk1` | Mid-stride, leading foot forward | 8 |
| 3 | `walk2` | Opposite stride, trailing foot pushes off | 8 |
| 4 | `cast1` / `atkUp` | Wind-up: weapon raised, stance loaded | 12 (play-once) |
| 5 | `cast2` / `atkHit` | Release: attack or spell discharge | 12 |
| 6 | `hurt` | Recoil: knockback, pain expression | 8 (play-once → idle) |

**`cast` vs `atk` frame names:**
- `cast1`/`cast2` → Magic damage towers, support, debuff, DoT, chain, splash
- `atkUp`/`atkHit` → Physical damage towers (martial weapons, direct strikes)
Check `spriteManifest.ts` for the entity's exact frame names.

## Frame timing conventions (from pixel-plugin animator)

| Animation | Frames | Pattern | Duration/frame |
|-----------|--------|---------|---------------|
| Idle loop | 2 (idle1, idle2) | Ping-pong | 250ms (4 FPS) |
| Walk cycle | 2 (walk1, walk2) | Forward loop | 125ms (8 FPS) |
| Attack | 2 (cast1, cast2) | Forward, play-once | 83ms (12 FPS) |
| Hurt | 1 (hurt) | Play-once | 125ms (8 FPS) |

**Timing emphasis:** Add variable timing within attack animations for dramatic effect.
The wind-up (`cast1`) can hold longer (150ms) to build anticipation; the release
(`cast2`) should be faster (50ms) for snappy feel. Phaser's `anims.create` supports
per-frame durations via the `frames` array's `duration` field.

## Seed discipline for frame consistency

All 7 frames for one character must look like the **same character**. The correct
approach:

1. Pick a **character seed** (deterministic: `hash(entity-id) % 2^32`).
2. Generate each frame with `seed = character_seed + frame_index`.
3. The seed offset keeps each frame unique while the prompt anchors the character.

Do NOT use random seeds for multi-frame characters. Frame-to-frame character drift
is the #1 cause of rejected sprite batches.

## Prompt appendix per frame

Base prompt from the catalog → append per-frame action suffix:

```
idle1  → ", relaxed idle stance, weight on back foot, both hands at side or resting on weapon"
idle2  → ", gentle idle sway, slight forward lean, breathing posture variant"
walk1  → ", mid-stride step, leading foot forward, arms in opposition"
walk2  → ", opposite stride, trailing foot pushes off, dynamic balance"
cast1  → ", wind-up pose, weapon or hands raised and loaded, aggressive lean forward"  [magic/support]
atkUp  → ", weapon raised overhead, coiled ready-to-strike stance"                     [physical]
cast2  → ", full spell release, hands extended, energy burst forward"                   [magic/support]
atkHit → ", weapon swung through, follow-through momentum, striking pose"               [physical]
hurt   → ", recoil backward, pain expression, one arm raised defensively, knockback"
```

## Linked cel strategy (from pixel-plugin linked cels)

For idle animations specifically: if `idle1` and `idle2` differ only in a small
body part (torso, head tilt), generate `idle1` fully, then re-generate `idle2` with
the suffix ", same character, same palette, ONLY the torso/chest slightly raised for
a breathing effect, all other details identical".

This minimises palette drift between idle frames.

## Validation before assembly

Before packing frames into a horizontal sheet:
1. Line all 7 frames up side by side (the CLI gallery command does this).
2. Check:
   - [ ] Silhouette stays within the same bounding box (no character-drift pan/zoom — Sprite-Pipeline rule)
   - [ ] No colour in one frame that doesn't appear in others (palette consistency)
   - [ ] `hurt` frame clearly shows damage state (darker, recoil)
   - [ ] `cast2`/`atkHit` clearly shows the attack peak (brightest, most dynamic)
3. If any frame fails: re-generate that frame only (keep others — don't regenerate all 7).

## Aseprite / pixel-plugin workflow (if Aseprite is installed)

If Aseprite v1.3.0+ is available with the `pixel-plugin` MCP server:
- `/pixel-setup` → configure Aseprite connection
- `/pixel-new 192 192` → create canvas at tower size
- Import each generated frame as a layer (one layer per frame)
- `/pixel-export` → export as horizontal sprite sheet

This gives pixel-level manual correction ability after AI generation,
and supports the full 40+ tool set (palette editing, dithering, transforms).
Without Aseprite, the CLI's sharp pipeline is the fallback.
