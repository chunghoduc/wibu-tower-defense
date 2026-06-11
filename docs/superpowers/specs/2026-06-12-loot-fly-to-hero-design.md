# Loot Flies to the Hero — Design Spec

**Date:** 2026-06-12
**Status:** Approved (full-auto session — author is decision-maker)

## Problem

When an enemy dies, its rewards are credited silently. Gold coins currently
pop and fly to the **HUD gold counter** in the top corner; the item/box drops
only show floating text ("★ Loot!", "📦 … Box!"). There is no sense that the
*hero* is the one collecting the spoils. The request:

> When an item is dropped from an enemy, show a visual effect of that item
> slowly flying to the hero (including gold, diamond, materials and boxes).

We want an ARPG-style "loot magnet": every dropped reward visibly ejects from
the kill spot and drifts into the hero, with a small absorb pop on arrival.

## What actually drops per kill (ground truth)

`killEnemy()` (`src/core/battleDamage.ts`) + `processEnemyKill()`
(`src/core/killRewards.ts`) are the only per-enemy-death award sites. Per kill:

| Reward  | Source event        | Frequency                          | Has art? |
|---------|---------------------|------------------------------------|----------|
| Gold    | `loot`              | every kill                         | coin shape |
| XP      | `killReward`        | every kill                         | text only |
| Item    | `killReward`        | 2% normal / 50% boss               | `item__<defId>` |
| Box     | `killReward`        | guaranteed on **elite** kills      | `box__<boxId>` |

Diamonds and non-box materials have **no per-kill drop source** in battle, so
nothing flies for them today. The feature is built generically (one fly helper,
icon-key driven) so a future diamond/material drop animates for free — but this
spec does not invent a drop that doesn't exist. XP stays as floating text (it is
not a physical object the hero "picks up").

So the things that fly to the hero: **gold, dropped items, elite boxes.**

## Design

### Trajectory — a lifted arc into the hero

A flown object travels from the kill point `from` to the hero `to` along a
**quadratic bézier** whose control point is the midpoint raised upward by a
`lift`. This gives the loot a gentle "hop up, then home in" arc rather than a
straight slide — reads as "slowly flying" per the request.

Two pure, Phaser-free functions (the unit-tested core):

```ts
// src/scenes/lootFlyArc.ts
export function arcControl(from: Vec2, to: Vec2, lift: number): Vec2;   // midpoint, raised by `lift`
export function bezierPoint(from: Vec2, ctrl: Vec2, to: Vec2, t: number): Vec2;
```

Invariants (the RED tests):
- `bezierPoint(from, ctrl, from→to, 0)` == `from`; at `t=1` == `to`.
- `arcControl` returns the x-midpoint and a y strictly above (`< `) both
  endpoints' min y by `lift` (screen y grows downward).
- midpoint of the curve sits higher than the straight-line midpoint (the arc).

### Renderer — `LootFlyFx`

A new focused module `src/scenes/lootFlyFx.ts` (keeps `fx.ts` lean — it's
already 337 lines, hard 500 cap). One public method:

```ts
fly(from: Vec2, to: Vec2, kind: "coin" | "icon", opts: { iconKey?: string; fallbackColor?: number; delay?: number }): void
```

Animation per flown object:
1. **Eject (≈160 ms):** spawn at `from`, scatter to a small random offset and
   pop slightly larger (`Quad.easeOut`) — the "burst out of the corpse" beat.
2. **Fly (≈700–850 ms, "slowly"):** drive a `{ t: 0 → 1 }` proxy tween with
   `Sine.easeInOut`; each frame set the object's position from
   `bezierPoint(ejectPos, arcControl(ejectPos, heroNow, lift), heroNow, t)`.
   Scale eases from 1 → ~0.5 as it nears the hero.
3. **Absorb (on arrival):** a quick white flash + scale-down at the hero, then
   destroy. (Reuses the existing spark/flash idiom from `fx.ts`.)

`kind: "coin"` draws the existing gold-coin circle (matches `coinPop`'s look).
`kind: "icon"` draws `scene.add.image(iconKey)` scaled to a battlefield-sane
size (~22 px longest edge via the shared `iconFitScale` from `itemIcon.ts`), or
a `fallbackColor` circle when the texture is missing — so a looted item shows
its *real* inventory art flying in, consistent with the loot-icon fix already
shipped.

### Hero target — snapshot at emit time

The hero moves, but a fly lasts <1 s and the hero drifts slowly, so we snapshot
`this.hero.pos` into the fx event at emit time (no live re-targeting needed —
simpler, and the small lag actually looks fine as the loot "leads" slightly).
The hero position is in the same world-coord space the events already use
(`heroSprite.setPosition(h.pos.x, h.pos.y)`).

### Event plumbing (core → scene)

Extend the existing fx events rather than adding parallel ones, so the floating
text and the fly stay in sync from one emit:

- `loot`: add `to: Vec2` (hero snapshot). `coinPop` is **retargeted** to fly
  coins to the hero instead of the HUD gold anchor. The `+N` gold text stays.
- `killReward`: add `to: Vec2` (hero snapshot) and `itemDefId: string | null`.
  When `itemDefId` is set, fly an `item__<defId>` icon to the hero; when `box`
  is set, fly a `box__<boxId>` icon to the hero. The "★ Loot!" / "📦 Box!"
  floating text stays as the textual confirmation.

`FxLayer` owns a `LootFlyFx` instance and calls it from the `loot` /
`killReward` cases. `FxLayer` already receives the world layer + scene, so the
flown objects render in battle world-space like every other fx.

### Files

| File | Change |
|------|--------|
| `src/scenes/lootFlyArc.ts` | **new** — pure `arcControl` + `bezierPoint` |
| `tests/lootFlyArc.test.ts` | **new** — RED→GREEN arc invariants |
| `src/scenes/lootFlyFx.ts` | **new** — `LootFlyFx` renderer |
| `src/scenes/fx.ts` | own a `LootFlyFx`; retarget gold to hero; fly item/box icons |
| `src/core/battleTypes.ts` | add `to` to `loot`; add `to` + `itemDefId` to `killReward` |
| `src/core/battleDamage.ts` | emit hero snapshot + dropped item defId |

## Testing

- **Unit (pure):** `tests/lootFlyArc.test.ts` — endpoints, arc lift, monotonic
  parameterization. This is the TDD RED gate.
- **Type:** `tsc --noEmit` clean (event-shape changes ripple to fx.ts).
- **Suite:** full `vitest run` stays green.
- **Manual:** CDP playtest — drive a battle to a kill (and an elite kill for the
  box), screenshot mid-flight to confirm gold/icon arcing into the hero.

## Non-goals / YAGNI

- No live hero re-targeting mid-flight (snapshot is enough).
- No new drop types (diamonds/materials per kill) — only render what drops.
- No change to the HUD gold counter logic (gold is still credited the same; only
  the *coin visual* destination changes from HUD corner to the hero).
- XP keeps its floating text (not a physical pickup).
