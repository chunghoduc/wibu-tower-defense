# Endless in-battle wave counter — design

**Date:** 2026-06-14
**Status:** Approved (full-auto session)

## Problem

In endless survival the in-battle HUD wave readout is wrong/meaningless, and players
read it as "the highest wave isn't being stored".

`battleSceneRender.ts` renders the wave counter as:

```
Wave ${b.waveIndex + 1}/${this.stage.waves.length}
```

For a **campaign** stage `stage.waves.length` is the real number of waves (e.g. 20) — correct.

For **endless** the battlefield is `endlessArenaStage(base, …)`, a clone of the cleared
campaign stage (`...base`, so `stage.waves` is preserved). Endless is infinite — the actual
waves come from the procedural `endlessWave()` generator, **not** `stage.waves`. So the
denominator is a frozen campaign number (e.g. 20). A player who reaches wave 25 sees
`Wave 25/20`, which looks like the run isn't tracking progress against any real target.

The user's ask: the in-battle wave number should show **current wave / highest wave
achieved**, and when the current wave passes the stored best, the two numbers should be
identical (e.g. `26/26`).

## What is NOT broken

Persistence at run settle is correct and stays untouched:

- `endlessArenaStage` spreads `...base`, so `stage.id` is the campaign stage id — the same
  key Activities uses (`bestEndlessWave(cleared.id)`). No key mismatch.
- On loss, `battleSceneRender` → `showBattleRewards("lost")` → `claimEndlessRun(stage.id, wavesReached)`
  records the new best. The "credit the wave you fall on" reward crediting is **by design**
  (see memory `project_endless_wave_credit_nonfix`) and must not change.

So this is a **display** fix, not a storage-write change. We must not write the best wave
live during the run, because `claimEndlessRun` reads the prior best as the lower bound of the
reward band — bumping it mid-run would zero out the run's rewards.

## Design

### Pure seam — `src/core/waveCounter.ts`

```ts
export interface WaveCounterInput {
  endless: boolean;
  current: number; // 1-based current wave (Math.max(0, waveIndex + 1))
  total: number;   // stage.waves.length — campaign denominator
  best: number;    // stored historical best endless wave for this stage
}

/** "Wave 5/20" for campaign; "Wave 5/22" (best) or "Wave 23/23" (surpassed) for endless. */
export function waveCounterLabel(i: WaveCounterInput): string {
  const denom = i.endless ? Math.max(i.best, i.current) : i.total;
  return `Wave ${i.current}/${denom}`;
}
```

- Endless denominator = `max(best, current)`. While the player is below their record they see
  progress toward it (`5/22`); the moment they surpass it the denominator equals the current
  wave (`23/23`) — the requested "two identical numbers".
- Non-endless behaviour is byte-for-byte identical to today (`current/total`).
- Pure, Phaser-free, unit-tested.

### Scene wiring — `src/scenes/battleSceneRender.ts`

Replace the inline template with a call to `waveCounterLabel`, sourcing `best` live from the
save (a cheap dict lookup; no new mutable scene field, so nothing to reset on scene re-entry):

```ts
const endless = this.battleMode.kind === "endless";
const best = endless ? this.saveManager.bestEndlessWave(this.stage.id) : 0;
// …
waveCounterLabel({
  endless,
  current: Math.max(0, b.waveIndex + 1),
  total: this.stage.waves.length,
  best,
})
```

Because the best is read from the save each frame and `claimEndlessRun` only persists at
settle, within a single run the denominator is driven purely by `max(storedBest, current)` —
it climbs with the player once they pass their record, and resets to the (now higher) stored
best on the next run.

## Testing

`tests/waveCounter.test.ts`:

- campaign: `endless:false` → `current/total`, ignores `best`.
- endless below best: `current=5, best=22` → `Wave 5/22`.
- endless equals best: `current=22, best=22` → `Wave 22/22`.
- endless surpasses best: `current=30, best=22` → `Wave 30/30` (identical numbers).
- endless fresh (best 0): `current=1, best=0` → `Wave 1/1`.

## Out of scope

- Reward crediting / `claimEndlessRun` (works as designed).
- Save schema / migration (no new fields).
- Boss Rush and Challenge HUDs (unchanged).
