# Home Screen Redesign — "The Throne Room"

**Date:** 2026-06-12
**Scope:** `MainMenuScene` (the home/hub screen) + one new pure module.

## Goal

Turn the home screen from "hero wearing its gear, standing in a hall" into a
readable **throne room diorama** that shows the player's whole loadout at a glance:

- The **hero sits on a king's chair** in the centre, drawn **bare** (no worn gear).
- The player's **equipped gear hangs on wall hangers** around the room.
- The **selected battle squad stands on the stage** below the throne.
- The **equipped pet flies** in a lazy wander **above the throne**.
- If **no squad is selected**, a **"Set Squad" button** appears where the squad would
  stand, routing to `SquadScene`.

The edge icon-button navigation, header (title/gold/daily bonus), and SDXL
`menu-hall` backdrop are kept as-is.

## Why

Today `dressHero` paints the equipped weapon/wings/pet onto the throne hero, and
the squad falls back to _owned_ towers when no squad is set. The redesign makes the
home screen a status display of the player's _choices_: gear you equipped is on
show (hangers), the squad you picked is on stage, the pet you chose is your
companion — and an empty squad is surfaced as a call-to-action instead of being
silently auto-filled.

## Layout (960×540 logical)

```
            WIBU TOWER DEFENSE  / 🪙 gold        (header, depth 5)
 [Battle]                                              [Inventory]
 [Summon]   (·pet wanders·)        ⌐ hanger ⌐         [Squad]
 [Codex]    ╔═══════════╗          ⌐ hanger ⌐         [Passives]
 [Quests]   ║  throne   ║   hero   ⌐ hanger ⌐
 [Activ.]   ╚═══════════╝          ⌐ hanger ⌐
 (left wall hangers)   ▓▓▓ STAGE ▓▓▓   (right wall hangers)
            squad ◇ ◇ ◇ ◇  (or  [ Set Squad ] )
        [Shop]   [Skills]   [Forge]   [Settings]
```

- **Throne + dais ("the stage"):** drawn procedurally (Phaser `Graphics`, no new
  art) behind the hero — a gold-framed high-backed chair on a raised dais slab. The
  dais is the "stage" the squad stands on. Centred at `x = W/2`, hero feet near
  `y ≈ H*0.52`.
- **Hero:** existing `hero__hero` sprite + idle anim, **bare** — `dressHero` is no
  longer called here. Centred on the throne seat.
- **Gear hangers:** the **9 non-pet equipped slots** (Weapon, Helmet, BodyArmor,
  Gloves, Boots, Amulet, Ring1, Ring2, Wing) hang on two inner side walls — 5 on the
  left wall, 4 on the right — just _inside_ the edge menu columns so they never
  overlap a nav button. Each hanger = a small peg + short rope + the item icon,
  with a gentle idle sway. Empty slots draw an empty peg (so the wall reads as a
  rack, not a gap). The Pet slot is excluded — the pet flies instead.
- **Squad on stage:** `save.squad` only (no owned-tower fallback). Members stand in
  a row on the dais, ordered, slightly arced, at `y ≈ H*0.74`.
- **Set Squad button:** when `save.squad` is empty, a single button occupies the
  squad row centre → `fadeToScene("SquadScene")`.
- **Pet flight:** the equipped Pet item sprite floats above the throne on a bounded
  lissajous wander (deterministic from elapsed time), within a box above the hero's
  head (roughly `x ∈ [W*0.40, W*0.60], y ∈ [H*0.18, H*0.34]`), with a soft bob and
  slight facing flip at the turn-arounds. If no pet equipped, nothing flies.

## Architecture

Follow the project's **pure-logic-in-core / presenter-in-scene** split so the layout
math and the squad/hanger/pet decisions are unit-testable without Phaser.

### New pure module: `src/scenes/homeRoom.ts` (Phaser-free)

> Lives under `scenes/` next to other Phaser-free presenters' helpers
> (`heroStatRows.ts`, `lootFlyArc.ts`), imports only data/types.

```ts
export const HANGER_SLOTS: ItemSlot[]; // the 9 non-pet slots, render order
export interface HangerCell {
  slot: ItemSlot;
  x: number;
  y: number;
}
export function hangerLayout(W: number, H: number): HangerCell[];
//   → 9 fixed peg positions: 5 left wall, 4 right wall (inside the menu columns).

export interface HangerItem {
  slot: ItemSlot;
  defId: string;
  iconKey: string;
}
export function equippedHangers(inv: InventorySave): (HangerItem | null)[];
//   → per HANGER_SLOTS index: the equipped item to hang, or null (empty peg).
//     Wing uses appearanceRef icon when present (mirrors dressHero).

export interface SquadStand {
  members: string[];
  showSetSquad: boolean;
}
export function squadStand(save: HeroSave): SquadStand;
//   → members = save.squad (NO owned fallback); showSetSquad = members.length===0.

export interface StandPoint {
  x: number;
  y: number;
}
export function squadStandPoints(n: number, W: number, H: number): StandPoint[];
//   → up to 7 arced positions on the stage (extracted from current inline math).

export function petWander(
  elapsedMs: number,
  W: number,
  H: number,
): { x: number; y: number; faceLeft: boolean };
//   → bounded lissajous point in the box above the throne; faceLeft from x-velocity sign.
```

All five functions are **pure and deterministic** → straightforward Vitest coverage
of: hanger count/sides, equipped→hanger pairing incl. empty pegs and Wing
appearanceRef, squad no-fallback + showSetSquad flag, stand-point count/bounds, and
**petWander staying inside its box for all t** (sampled across a full period).

### `MainMenuScene` changes (presenter)

- Drop the `dressHero` import/call.
- `drawThrone(W,H)` — procedural chair + dais graphics behind the hero.
- `drawHero` — bare sprite only.
- `drawHangers(save,W,H)` — consume `hangerLayout` + `equippedHangers`; draw peg +
  rope + icon (or empty peg); add a small sway tween per occupied hanger.
- `drawSquad(save,W,H)` — consume `squadStand`; either place members via
  `squadStandPoints` or draw the Set Squad button.
- `update(_, dtMs)` — accumulate elapsed; reposition the pet sprite via `petWander`.
- Keep `drawBackdrop`, `drawHeader`, `drawMenu` unchanged.

**File-size guard (hard rule <500 lines):** `MainMenuScene` is 229 lines today.
The pure module absorbs the math. If the scene approaches the cap, extract the
throne/hanger drawing into `src/scenes/menuRoomDraw.ts`. Target both files < 500.

## Scene re-entry safety

Per the project's Phaser scene-reuse rule, any new array/sprite fields the scene
keeps (e.g. the pet sprite handle, elapsed accumulator) must be **re-initialised in
`create()`**, not just declared, or re-entering the menu crashes on real WebGL.

## Testing

- **Unit (Vitest, RED→GREEN):** `tests/homeRoom.test.ts` covering the five pure
  functions as above. This is the TDD core.
- **Integration:** `tsc` clean, full suite green, `npm run build` succeeds.
- **CDP playtest** (`window.__game`): seed a save with a partial loadout + a 3-tower
  squad + a pet; confirm hangers show equipped icons and empty pegs, squad stands on
  the stage, pet sprite moves between frames and stays in-box, 0 console errors. Then
  clear `save.squad` and confirm the Set Squad button appears and routes to
  `SquadScene`. (Note: `crispText` renders blown-up in headless screenshots — verify
  layout by measured coords/positions, not the screenshot.)

## Out of scope / non-goals

- No new SDXL art (throne/hangers/dais are procedural graphics).
- No change to navigation, header, backdrop, or any other scene.
- Multiple simultaneous pets — one equipped Pet flies (the game equips a single pet);
  "pets" is honoured as a continuously wandering companion, extensible later.
- Worn-armour rendering on the hero is intentionally removed from the home screen
  (gear now lives on hangers).

```

```
