# Unique Triggered Powers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Unique items real combat *behaviours* (on-hit execute, reflect-when-struck, corpse-detonate, chain-lightning, freeze, counter-attack, echo-cast…) instead of only passive stats.

**Architecture:** A pure declarative catalog (`data/triggeredEffects.ts`) attached to each Unique Power; resolved once per battle into per-event arrays (`core/battleTriggers.ts`); thin sim handlers (`core/battleTriggerFx.ts`, merged onto the `BattleState` prototype) fired from the four existing combat choke-points (`performAttack`, `killEnemy`, `dealDamageToHero`, `castActive`). A reentrancy depth-guard (`this._triggerDepth`) ensures only the *original* attack/kill/cast procs — triggered damage never re-procs.

**Tech Stack:** TypeScript, Vitest (TDD), Phaser (display only). No new art, no save migration (powers derive from item defs), no ASSET_VERSION bump.

---

## File structure

- **Create** `src/data/triggeredEffects.ts` — `TriggerEvent`/`TriggerKind`/`TriggeredEffect` types + factory helpers + `describe()`. Pure.
- **Modify** `src/data/uniquePowers.ts` — add optional `trigger?` to `UniquePowerDef`; add trigger-bearing powers; layer triggers onto the 3 signatures; extend `ARCHETYPE_POWERS`.
- **Create** `src/core/battleTriggers.ts` — `resolveBattleTriggers(save) → BattleTriggers`. Reuses exported `equippedUniqueDefs`.
- **Modify** `src/core/uniquePowerStats.ts` — `export` `equippedUniqueDefs` (DRY).
- **Create** `src/core/battleTriggerFx.ts` — `triggerMethods` object (fireOnHit/fireOnCrit-folded/fireOnKill/fireOnHurt/fireOnCast) merged onto prototype. <500 lines.
- **Modify** `src/core/battle.ts` — declare `triggers`/`_triggerDepth` fields, init in constructor, `Object.assign(prototype, triggerMethods)`, declaration-merge `TriggerMethods`.
- **Modify** `src/core/battleDamage.ts` — call `fireOnHit` at end of `performAttack`; call `fireOnKill` in `killEnemy`; call `fireOnCast` at end of `castActive`.
- **Modify** `src/core/battleEnemies.ts` — call `fireOnHurt` in `dealDamageToHero`.
- **Modify** `src/data/itemDisplay.ts` + `src/scenes/itemTooltip.ts` — render the trigger line.
- **Create** `tests/triggeredEffects.test.ts`, `tests/battleTriggers.test.ts`, `tests/battleTriggerFx.test.ts`.

---

## Task 1: Triggered-effect catalog (pure data)

**Files:**
- Create: `src/data/triggeredEffects.ts`
- Test: `tests/triggeredEffects.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/triggeredEffects.test.ts
import { describe, expect, it } from "vitest";
import { TRIGGERED_EFFECTS } from "../src/data/triggeredEffects.ts";

describe("triggered-effect catalog", () => {
  it("every effect has an event, a kind, a sane chance, and a describe()", () => {
    for (const [id, e] of Object.entries(TRIGGERED_EFFECTS)) {
      expect(e.event, id).toMatch(/^on(Hit|Crit|Kill|Hurt|Cast)$/);
      expect(e.chance, id).toBeGreaterThan(0);
      expect(e.chance, id).toBeLessThanOrEqual(1);
      expect(typeof e.describe(), id).toBe("string");
      expect(e.describe().length, id).toBeGreaterThan(0);
    }
  });

  it("executioner is a chance-based non-boss kill; cull is a guaranteed threshold execute", () => {
    expect(TRIGGERED_EFFECTS.executioner.kind).toBe("execute");
    expect(TRIGGERED_EFFECTS.executioner.chance).toBeLessThan(1);
    expect(TRIGGERED_EFFECTS.cull.chance).toBe(1);
    expect(TRIGGERED_EFFECTS.cull.hpFrac).toBeGreaterThan(0);
  });

  it("thornmail reflects on being hit", () => {
    expect(TRIGGERED_EFFECTS.thornmail.event).toBe("onHurt");
    expect(TRIGGERED_EFFECTS.thornmail.kind).toBe("reflect");
  });
});
```

- [ ] **Step 2: Run it — expect FAIL** (`npx vitest run tests/triggeredEffects.test.ts`) — "Cannot find module".

- [ ] **Step 3: Implement the catalog**

```ts
// src/data/triggeredEffects.ts
//
// Triggered effects — the BEHAVIOUR half of a Unique Power. Where a UniquePower's
// `contribution` adds passive stats, its optional `trigger` makes the item *do*
// something at a combat event. Pure/declarative so the catalog is unit-testable;
// the battle sim (core/battleTriggerFx.ts) interprets each kind with its own
// primitives (applySplash/applyStun/addDot/applyDamage/…).
import type { DamageType } from "./schema.ts";

export type TriggerEvent = "onHit" | "onCrit" | "onKill" | "onHurt" | "onCast";

export type TriggerKind =
  | "execute" // instakill a non-boss: by chance, or guaranteed below hpFrac
  | "blast" // splash AoE around the target/corpse
  | "chain" // lightning to the N nearest foes
  | "freeze" // stun for `seconds`
  | "poison" // DoT scaling with the source's attack
  | "heal" // hero heals (hpFrac of maxHp, or dmgFrac of damage dealt)
  | "gold" // burst bonus gold on kill
  | "contagion" // copy the victim's DoTs onto nearby foes
  | "reflect" // onHurt: frac of incoming back to the attacker
  | "riposte" // onHurt: hero counter-attacks the attacker
  | "echo" // onCast: re-apply the burst once
  | "cinder"; // onCast: burning field (DoT) on enemies in radius

export interface TriggeredEffect {
  event: TriggerEvent;
  chance: number; // 0..1 ; 1 = guaranteed (the sim skips the RNG roll)
  kind: TriggerKind;
  type?: DamageType; // damage type for blast/chain/reflect/poison (default Magic)
  hpFrac?: number; // execute threshold / heal % maxHp / blast % victim maxHp
  atkFrac?: number; // damage as a fraction of source atk
  dmgFrac?: number; // fraction of damage dealt (heal) / taken (reflect)
  radius?: number; // blast / cinder / contagion radius (world units)
  targets?: number; // chain bounce count
  falloff?: number; // chain damage falloff per bounce
  seconds?: number; // freeze / poison / cinder duration
  describe(): string;
}

const pct = (v: number) => `${Math.round(v * 100)}%`;
const mk = (e: Omit<TriggeredEffect, "describe">, text: string): TriggeredEffect => ({
  ...e,
  describe: () => text,
});

/** The catalog. Keys are referenced by data/uniquePowers.ts. Numbers are starting
 *  points — they fire from EVERY player attack (towers + hero), so keep them low. */
export const TRIGGERED_EFFECTS: Record<string, TriggeredEffect> = {
  // — onHit —
  executioner: mk(
    { event: "onHit", chance: 0.03, kind: "execute" },
    `On hit: ${pct(0.03)} chance to instantly slay a non-boss enemy`,
  ),
  cull: mk(
    { event: "onHit", chance: 1, kind: "execute", hpFrac: 0.08 },
    `On hit: instantly slay any non-boss below ${pct(0.08)} health`,
  ),
  stormcaller: mk(
    { event: "onHit", chance: 0.15, kind: "chain", type: "Magic", targets: 3, falloff: 0.6 },
    `On hit: ${pct(0.15)} chance to arc lightning through 3 nearby foes`,
  ),
  permafrost: mk(
    { event: "onHit", chance: 0.12, kind: "freeze", seconds: 0.6 },
    `On hit: ${pct(0.12)} chance to freeze the target for 0.6s`,
  ),
  venomstrike: mk(
    { event: "onHit", chance: 0.25, kind: "poison", type: "Magic", atkFrac: 0.4, seconds: 3 },
    `On hit: ${pct(0.25)} chance to poison for ${pct(0.4)} attack/s over 3s`,
  ),
  soulrend: mk(
    { event: "onHit", chance: 0.15, kind: "heal", dmgFrac: 0.5 },
    `On hit: ${pct(0.15)} chance to heal the hero for ${pct(0.5)} of damage dealt`,
  ),
  // — onCrit —
  shatterblow: mk(
    { event: "onCrit", chance: 1, kind: "blast", type: "Physical", atkFrac: 0.6, radius: 70 },
    `On critical hit: detonate a blast for ${pct(0.6)} attack around the target`,
  ),
  // — onKill —
  detonate: mk(
    { event: "onKill", chance: 1, kind: "blast", type: "Magic", hpFrac: 0.25, radius: 80 },
    `On kill: the corpse explodes for ${pct(0.25)} of its max health as AoE`,
  ),
  bloodfeast: mk(
    { event: "onKill", chance: 1, kind: "heal", hpFrac: 0.04 },
    `On kill: heal the hero for ${pct(0.04)} of max health`,
  ),
  goldfinger: mk(
    { event: "onKill", chance: 0.2, kind: "gold", dmgFrac: 1 },
    `On kill: ${pct(0.2)} chance to drop bonus gold`,
  ),
  contagion: mk(
    { event: "onKill", chance: 1, kind: "contagion", radius: 90 },
    `On kill: spread the victim's burns & poisons to nearby foes`,
  ),
  // — onHurt —
  thornmail: mk(
    { event: "onHurt", chance: 1, kind: "reflect", type: "Physical", dmgFrac: 0.3 },
    `When struck: reflect ${pct(0.3)} of the damage back to the attacker`,
  ),
  riposte: mk(
    { event: "onHurt", chance: 0.25, kind: "riposte" },
    `When struck: ${pct(0.25)} chance to instantly counter-attack`,
  ),
  // — onCast —
  echo: mk(
    { event: "onCast", chance: 0.2, kind: "echo" },
    `On cast: ${pct(0.2)} chance the active skill fires a second time`,
  ),
  cinderbloom: mk(
    { event: "onCast", chance: 1, kind: "cinder", type: "Magic", atkFrac: 0.3, radius: 80, seconds: 3 },
    `On cast: leave a burning field that scorches enemies for 3s`,
  ),
};
```

- [ ] **Step 4: Run — expect PASS.**
- [ ] **Step 5: Commit** `git add src/data/triggeredEffects.ts tests/triggeredEffects.test.ts && git commit -m "feat(items): triggered-effect catalog (pure data)"`

---

## Task 2: Attach triggers to Unique Powers

**Files:**
- Modify: `src/data/uniquePowers.ts`
- Test: append to `tests/triggeredEffects.test.ts`

- [ ] **Step 1: Failing test (assignment is deterministic + signatures carry their trigger)**

```ts
// append to tests/triggeredEffects.test.ts
import { uniquePowerFor } from "../src/data/uniquePowers.ts";

describe("unique power → trigger assignment", () => {
  const u = (id: string, archetype?: string) =>
    uniquePowerFor({ id, rarity: "Unique", primaryAffix: { type: "atk" }, archetype: archetype as never });

  it("signatures carry both their stat power and a trigger", () => {
    expect(u("dawnbreaker")?.trigger?.kind).toBe("execute");
    expect(u("aegis-of-dawn")?.trigger?.kind).toBe("reflect");
    expect(u("midas-paw")?.trigger?.kind).toBe("gold");
    // stat half preserved
    expect(u("dawnbreaker")?.contribution({ uniqueCount: 1 }).more?.atk).toBeGreaterThan(0);
  });

  it("a procedural unique resolves to a power deterministically (stable across calls)", () => {
    const a = u("mythic-stormpiece", "magic");
    const b = u("mythic-stormpiece", "magic");
    expect(a?.id).toBe(b?.id);
  });

  it("non-uniques never get a power", () => {
    expect(uniquePowerFor({ id: "x", rarity: "Legendary", primaryAffix: { type: "atk" } })).toBeNull();
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (`trigger` undefined on signatures).

- [ ] **Step 3: Edit `src/data/uniquePowers.ts`**

3a. Add import at top (after existing imports):

```ts
import { TRIGGERED_EFFECTS, type TriggeredEffect } from "./triggeredEffects.ts";
```

3b. Add `trigger?` to the interface:

```ts
export interface UniquePowerDef {
  id: string;
  name: string;
  describe(ctx: UniquePowerContext): string;
  contribution(ctx: UniquePowerContext): UniquePowerContribution;
  /** Optional combat BEHAVIOUR (see data/triggeredEffects.ts). */
  trigger?: TriggeredEffect;
}
```

3c. Layer triggers onto the 3 signature powers (add a `trigger:` line to each existing def):

```ts
  sunflare: {
    id: "sunflare",
    name: "Sunflare",
    describe: () => `+${pct(0.18)} more Attack and +${pct(0.25)} Critical Damage`,
    contribution: () => ({ more: { atk: 0.18 }, flat: { critDamage: 0.25 } }),
    trigger: TRIGGERED_EFFECTS.executioner,
  },
  bulwark: {
    id: "bulwark",
    name: "Aegis Bulwark",
    describe: () => `+${pct(0.2)} more Max Health and +${pct(0.08)} Damage Reduction`,
    contribution: () => ({ more: { maxHp: 0.2 }, flat: { damageReduction: 0.08 } }),
    trigger: TRIGGERED_EFFECTS.thornmail,
  },
  midas: {
    id: "midas",
    name: "Midas Touch",
    describe: () => `+${pct(0.5)} more Gold Found`,
    contribution: () => ({ more: { goldFind: 0.5 } }),
    trigger: TRIGGERED_EFFECTS.goldfinger,
  },
```

3d. Add new pure-trigger powers to the `UNIQUE_POWERS` record (a trigger power may have an empty `contribution`). Insert before the closing `}` of `UNIQUE_POWERS`:

```ts
  // — Trigger powers (procedural pool) —
  stormlord: {
    id: "stormlord",
    name: "Stormlord",
    describe: () => TRIGGERED_EFFECTS.stormcaller.describe(),
    contribution: () => ({}),
    trigger: TRIGGERED_EFFECTS.stormcaller,
  },
  venomous: {
    id: "venomous",
    name: "Venomfang",
    describe: () => TRIGGERED_EFFECTS.venomstrike.describe(),
    contribution: () => ({}),
    trigger: TRIGGERED_EFFECTS.venomstrike,
  },
  detonator: {
    id: "detonator",
    name: "Detonator",
    describe: () => TRIGGERED_EFFECTS.detonate.describe(),
    contribution: () => ({}),
    trigger: TRIGGERED_EFFECTS.detonate,
  },
  frostbrand: {
    id: "frostbrand",
    name: "Frostbrand",
    describe: () => TRIGGERED_EFFECTS.permafrost.describe(),
    contribution: () => ({}),
    trigger: TRIGGERED_EFFECTS.permafrost,
  },
  echoing: {
    id: "echoing",
    name: "Echoing Sigil",
    describe: () => TRIGGERED_EFFECTS.echo.describe(),
    contribution: () => ({}),
    trigger: TRIGGERED_EFFECTS.echo,
  },
  ember_aura: {
    id: "ember_aura",
    name: "Emberbloom",
    describe: () => TRIGGERED_EFFECTS.cinderbloom.describe(),
    contribution: () => ({}),
    trigger: TRIGGERED_EFFECTS.cinderbloom,
  },
  thorned: {
    id: "thorned",
    name: "Thornward",
    describe: () => TRIGGERED_EFFECTS.thornmail.describe(),
    contribution: () => ({}),
    trigger: TRIGGERED_EFFECTS.thornmail,
  },
  riposting: {
    id: "riposting",
    name: "Riposte Guard",
    describe: () => TRIGGERED_EFFECTS.riposte.describe(),
    contribution: () => ({}),
    trigger: TRIGGERED_EFFECTS.riposte,
  },
  sanguine: {
    id: "sanguine",
    name: "Sanguine Crest",
    describe: () => TRIGGERED_EFFECTS.bloodfeast.describe(),
    contribution: () => ({}),
    trigger: TRIGGERED_EFFECTS.bloodfeast,
  },
  reaper: {
    id: "reaper",
    name: "Reaper's Mark",
    describe: () => TRIGGERED_EFFECTS.cull.describe(),
    contribution: () => ({}),
    trigger: TRIGGERED_EFFECTS.cull,
  },
  plaguebearer: {
    id: "plaguebearer",
    name: "Plaguebearer",
    describe: () => TRIGGERED_EFFECTS.contagion.describe(),
    contribution: () => ({}),
    trigger: TRIGGERED_EFFECTS.contagion,
  },
  shatterer: {
    id: "shatterer",
    name: "Shatterer",
    describe: () => TRIGGERED_EFFECTS.shatterblow.describe(),
    contribution: () => ({}),
    trigger: TRIGGERED_EFFECTS.shatterblow,
  },
```

3e. Extend `ARCHETYPE_POWERS` so procedural uniques can roll these (mix triggers into the existing pools):

```ts
const ARCHETYPE_POWERS: Record<ItemArchetype, string[]> = {
  physical: ["deadeye", "bloodthirst", "warlord", "reaper", "detonator", "stormlord"],
  magic: ["arcane_overflow", "frostbrand", "echoing", "ember_aura", "stormlord"],
  defense: ["juggernaut", "bulwark", "thorned", "riposting", "sanguine"],
  utility: ["tempest", "fortune", "venomous", "plaguebearer"],
  hybrid: ["colossus", "warlord", "shatterer", "detonator"],
};
```

- [ ] **Step 4: Run — expect PASS** (`npx vitest run tests/triggeredEffects.test.ts`).
- [ ] **Step 5: Commit** `git add src/data/uniquePowers.ts tests/triggeredEffects.test.ts && git commit -m "feat(items): attach triggers to unique powers + archetype pools"`

---

## Task 3: Resolve equipped uniques → BattleTriggers

**Files:**
- Modify: `src/core/uniquePowerStats.ts` (export `equippedUniqueDefs`)
- Create: `src/core/battleTriggers.ts`
- Test: `tests/battleTriggers.test.ts`

- [ ] **Step 1: Failing test**

```ts
// tests/battleTriggers.test.ts
import { describe, expect, it } from "vitest";
import { resolveBattleTriggers } from "../src/core/battleTriggers.ts";
import { createFreshSave } from "../src/core/save.ts";

describe("resolveBattleTriggers", () => {
  it("is empty when nothing is equipped", () => {
    const t = resolveBattleTriggers(createFreshSave());
    expect(t.onHit.length + t.onKill.length + t.onHurt.length + t.onCast.length + t.onCrit.length).toBe(0);
  });

  it("buckets an equipped signature unique by its trigger event", () => {
    const save = createFreshSave();
    save.inventory.items.push({
      id: "inst1", defId: "aegis-of-dawn", rarity: "Unique",
      affixes: [], rolledPrimaryAffix: { type: "damageReduction", value: 0.1 },
    } as never);
    save.inventory.equipped.BodyArmor = "inst1";
    const t = resolveBattleTriggers(save);
    expect(t.onHurt.map((e) => e.kind)).toContain("reflect");
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (module missing).

- [ ] **Step 3a: Export the walker in `src/core/uniquePowerStats.ts`** — change `function equippedUniqueDefs` to `export function equippedUniqueDefs`.

- [ ] **Step 3b: Create `src/core/battleTriggers.ts`**

```ts
// src/core/battleTriggers.ts
//
// Resolve the hero's equipped Unique items into the triggered effects that fire
// during battle, bucketed by event so the hot loops can early-out on length.
// Built ONCE in the BattleState constructor (this.triggers).
import type { HeroSave } from "./save.ts";
import type { TriggeredEffect, TriggerEvent } from "../data/triggeredEffects.ts";
import { uniquePowerFor } from "../data/uniquePowers.ts";
import { equippedUniqueDefs } from "./uniquePowerStats.ts";

export interface BattleTriggers {
  onHit: TriggeredEffect[];
  onCrit: TriggeredEffect[];
  onKill: TriggeredEffect[];
  onHurt: TriggeredEffect[];
  onCast: TriggeredEffect[];
}

export const EMPTY_TRIGGERS: BattleTriggers = {
  onHit: [], onCrit: [], onKill: [], onHurt: [], onCast: [],
};

export function resolveBattleTriggers(save: HeroSave): BattleTriggers {
  const out: BattleTriggers = { onHit: [], onCrit: [], onKill: [], onHurt: [], onCast: [] };
  for (const def of equippedUniqueDefs(save)) {
    const trig = uniquePowerFor(def)?.trigger;
    if (trig) out[trig.event as TriggerEvent].push(trig);
  }
  return out;
}
```

- [ ] **Step 4: Run — expect PASS.** (If the fake item shape mismatches, copy the real shape from an existing test that pushes to `save.inventory.items`.)
- [ ] **Step 5: Commit** `git add src/core/battleTriggers.ts src/core/uniquePowerStats.ts tests/battleTriggers.test.ts && git commit -m "feat(battle): resolve equipped uniques into per-event triggers"`

---

## Task 4: Sim handlers + wiring (the behaviour)

**Files:**
- Create: `src/core/battleTriggerFx.ts`
- Modify: `src/core/battle.ts`, `src/core/battleDamage.ts`, `src/core/battleEnemies.ts`
- Test: `tests/battleTriggerFx.test.ts`

- [ ] **Step 1: Failing integration test**

```ts
// tests/battleTriggerFx.test.ts
import { describe, expect, it } from "vitest";
import { TRIGGERED_EFFECTS } from "../src/data/triggeredEffects.ts";
import { BattleState } from "../src/core/battle.ts";
import { makeWorld } from "./fixtures.ts"; // use the repo's existing battle test harness

// These tests inject triggers directly onto battle.triggers (bypassing equipment)
// so they exercise the sim handlers deterministically.
describe("trigger sim handlers", () => {
  it("guaranteed cull kills a low-HP non-boss the moment it is hit", () => {
    const b = makeWorld(); // a world with one tower + one weak grunt in range
    b.triggers.onHit.push(TRIGGERED_EFFECTS.cull);
    const e = b.enemies[0];
    e.hp = e.stats.maxHp * 0.05; // below the 8% threshold
    for (let i = 0; i < 40 && e.alive; i++) b.tick(0.05);
    expect(e.alive).toBe(false);
  });

  it("thornmail reflects damage back to an attacking enemy", () => {
    const b = makeWorld({ enemyAttacksHero: true });
    b.triggers.onHurt.push(TRIGGERED_EFFECTS.thornmail);
    const e = b.enemies[0];
    const hp0 = e.hp;
    for (let i = 0; i < 60; i++) b.tick(0.05);
    expect(e.hp).toBeLessThan(hp0); // it took reflected damage
  });
});
```

> NOTE for the implementer: `makeWorld` is illustrative — wire these to the **actual** harness in `tests/fixtures.ts` / `tests/battle.test.ts` (`world(enemies, towers, stage, opts)`). Pick an enemy weak enough that one tower hit lands, and a stage with `castleHp: 1e9`. If a clean enemy-hits-hero setup is awkward, assert thornmail via a direct `b.fireOnHurt(enemy, 100)` unit call instead.

- [ ] **Step 2: Run — expect FAIL** (`b.triggers`/handlers undefined).

- [ ] **Step 3a: Create `src/core/battleTriggerFx.ts`**

```ts
// src/core/battleTriggerFx.ts
//
// Sim-side interpreters for triggered Unique-item effects. Merged onto the
// BattleState prototype (see battle.ts). Every public fire* method is gated by
// this._triggerDepth so triggered damage can never re-proc a trigger — only the
// ORIGINAL basic attack / kill / hit / cast does. Chance < 1 rolls the shared
// RNG; chance >= 1 is guaranteed and skips the roll (keeps the loot/crit stream
// identical to a no-unique run for deterministic effects).
import { dist } from "./path.ts";
import type { DamageType, Stats, Vec2 } from "../data/schema.ts";
import type { TriggeredEffect } from "../data/triggeredEffects.ts";
import type { BattleState } from "./battle.ts";
import type { EnemyRuntime } from "./battleTypes.ts";

const TYPE = (e: TriggeredEffect): DamageType => e.type ?? "Magic";

export const triggerMethods = {
  _rollTrigger(this: BattleState, e: TriggeredEffect): boolean {
    return e.chance >= 1 ? true : this.rng.chance(e.chance);
  },

  /** Run a handler body with the reentrancy guard raised. */
  _withTrigger(this: BattleState, body: () => void): void {
    this._triggerDepth++;
    try {
      body();
    } finally {
      this._triggerDepth--;
    }
  },

  fireOnHit(
    this: BattleState,
    unit: { stats: Stats },
    fromPos: Vec2,
    target: EnemyRuntime,
    dealt: number,
    didCrit: boolean,
  ): void {
    if (this._triggerDepth > 0) return;
    if (this.triggers.onHit.length === 0 && (!didCrit || this.triggers.onCrit.length === 0)) return;
    this._withTrigger(() => {
      for (const e of this.triggers.onHit) {
        if (this._rollTrigger(e)) this.applyTriggerEffect(e, unit.stats, fromPos, target, dealt);
      }
      if (didCrit) {
        for (const e of this.triggers.onCrit) {
          if (this._rollTrigger(e)) this.applyTriggerEffect(e, unit.stats, fromPos, target, dealt);
        }
      }
    });
  },

  fireOnKill(this: BattleState, victim: EnemyRuntime): void {
    if (this._triggerDepth > 0 || this.triggers.onKill.length === 0) return;
    this._withTrigger(() => {
      for (const e of this.triggers.onKill) {
        if (this._rollTrigger(e)) this.applyKillEffect(e, victim);
      }
    });
  },

  fireOnHurt(this: BattleState, attacker: EnemyRuntime, incoming: number): void {
    if (this._triggerDepth > 0 || this.triggers.onHurt.length === 0 || !attacker.alive) return;
    this._withTrigger(() => {
      for (const e of this.triggers.onHurt) {
        if (!this._rollTrigger(e)) continue;
        if (e.kind === "reflect") {
          this.applyDamage(attacker, TYPE(e), incoming * (e.dmgFrac ?? 0.3), 0, 0, false, true);
        } else if (e.kind === "riposte") {
          const h = this.hero;
          this.performAttack(h, h.pos, h.stats.atk, h.damageType, attacker, "hero", "hero", -1, "slash");
        }
      }
    });
  },

  fireOnCast(this: BattleState, attacker: Stats, center: Vec2, burst: number, type: DamageType): void {
    if (this._triggerDepth > 0 || this.triggers.onCast.length === 0) return;
    this._withTrigger(() => {
      for (const e of this.triggers.onCast) {
        if (!this._rollTrigger(e)) continue;
        if (e.kind === "echo") {
          this.applyBurstInRadius(center, this.SPLASH(), burst, type, attacker);
        } else if (e.kind === "cinder") {
          this.forEnemiesInRadius(center, e.radius ?? 80, (en) =>
            this.addDot(en, TYPE(e), attacker.atk * (e.atkFrac ?? 0.3), e.seconds ?? 3, attacker),
          );
        }
      }
    });
  },

  /** onHit/onCrit dispatch (target is alive at call time unless a prior effect killed it). */
  applyTriggerEffect(
    this: BattleState,
    e: TriggeredEffect,
    srcStats: Stats,
    fromPos: Vec2,
    target: EnemyRuntime,
    dealt: number,
  ): void {
    if (!target.alive && e.kind !== "heal") return;
    switch (e.kind) {
      case "execute":
        if (!target.def.boss && (e.hpFrac === undefined || target.hp <= target.stats.maxHp * e.hpFrac)) {
          this.killEnemy(target);
        }
        break;
      case "blast":
        this.applySplash(srcStats, TYPE(e), srcStats.atk * (e.atkFrac ?? 0.5), target.pos, target, e.radius ?? 70);
        break;
      case "chain":
        this.triggerChain(srcStats, TYPE(e), srcStats.atk * (e.atkFrac ?? 1), target, e.targets ?? 3, e.falloff ?? 0.6);
        break;
      case "freeze":
        this.applyStun(target, e.seconds ?? 0.6, 1);
        break;
      case "poison":
        this.addDot(target, TYPE(e), srcStats.atk * (e.atkFrac ?? 0.4), e.seconds ?? 3, srcStats);
        break;
      case "heal":
        if (dealt > 0) this.healHero(dealt * (e.dmgFrac ?? 0.5));
        break;
      default:
        break;
    }
  },

  /** onKill dispatch — uses only the victim + hero (no killer needed). */
  applyKillEffect(this: BattleState, e: TriggeredEffect, victim: EnemyRuntime): void {
    switch (e.kind) {
      case "blast":
        this.applySplash(this.hero.stats, TYPE(e), victim.stats.maxHp * (e.hpFrac ?? 0.25), victim.pos, victim, e.radius ?? 80);
        break;
      case "heal":
        this.healHero(this.hero.stats.maxHp * (e.hpFrac ?? 0.04));
        break;
      case "gold": {
        const bonus = Math.max(1, Math.round(victim.def.bounty * 0.5));
        this.gold += bonus;
        this.waveGold += bonus;
        this.emit({ type: "loot", at: { x: victim.pos.x, y: victim.pos.y }, to: { x: this.hero.pos.x, y: this.hero.pos.y }, gold: bonus });
        break;
      }
      case "contagion":
        if (victim.dots.length) {
          this.forEnemiesInRadius(victim.pos, e.radius ?? 90, (en) => {
            if (en !== victim) for (const d of victim.dots) en.dots.push({ ...d });
          });
        }
        break;
      default:
        break;
    }
  },

  // — small shared primitives —
  healHero(this: BattleState, amount: number): void {
    const h = this.hero;
    if (h.alive) h.hp = Math.min(h.stats.maxHp, h.hp + amount);
  },

  forEnemiesInRadius(this: BattleState, center: Vec2, radius: number, fn: (e: EnemyRuntime) => void): void {
    for (const en of this.enemies) if (en.alive && dist(en.pos, center) <= radius) fn(en);
  },

  applyBurstInRadius(this: BattleState, center: Vec2, radius: number, amount: number, type: DamageType, src: Stats): void {
    this.forEnemiesInRadius(center, radius, (en) =>
      this.applyDamage(en, type, amount, src.armorPen, src.magicPen, true, true),
    );
  },

  triggerChain(this: BattleState, src: Stats, type: DamageType, dmg0: number, primary: EnemyRuntime, bounces: number, falloff: number): void {
    let from = primary;
    let dmg = dmg0 * falloff;
    const hit = new Set<number>([primary.uid]);
    for (let i = 0; i < bounces; i++) {
      let next: EnemyRuntime | null = null;
      for (const en of this.enemies) {
        if (!en.alive || hit.has(en.uid)) continue;
        if (dist(from.pos, en.pos) <= this.SPLASH() * 1.5 && (!next || dist(from.pos, en.pos) < dist(from.pos, next.pos))) next = en;
      }
      if (!next) break;
      this.emit({ type: "chain", from: { x: from.pos.x, y: from.pos.y }, to: { x: next.pos.x, y: next.pos.y } });
      this.applyDamage(next, type, dmg, src.armorPen, src.magicPen, false, true);
      hit.add(next.uid);
      from = next;
      dmg *= falloff;
    }
  },

  SPLASH(this: BattleState): number {
    return 60; // matches SPLASH_RADIUS in battleTypes.ts
  },
};

export type TriggerMethods = typeof triggerMethods;
```

> Implementer notes:
> - Confirm `EnemyRuntime` exposes `def.boss`, `def.bounty`, `stats.maxHp`, `dots`, `uid`, `pos`, `alive`. (All used by existing code in battleDamage.ts.) If `def.boss` is absent, use `victim.def.archetype === "Boss"`.
> - Replace the local `SPLASH()` (60) by importing `SPLASH_RADIUS` from `./battleTypes.ts` and using it directly — drop the method if cleaner. Keep the file < 500 lines.
> - `this.rng.chance(p)` is the same API `applyStun` uses.

- [ ] **Step 3b: Wire fields + prototype in `src/core/battle.ts`**

Add imports:
```ts
import { triggerMethods, type TriggerMethods } from "./battleTriggerFx.ts";
import { resolveBattleTriggers, EMPTY_TRIGGERS, type BattleTriggers } from "./battleTriggers.ts";
```
Add declared fields on the class (next to the other public fields):
```ts
  triggers: BattleTriggers;
  /** @internal reentrancy guard — triggered damage must not re-proc triggers. */
  _triggerDepth = 0;
```
In the constructor (after `this._heroSave` is assigned), init:
```ts
    this.triggers = this._heroSave ? resolveBattleTriggers(this._heroSave) : EMPTY_TRIGGERS;
```
Add to the declaration-merge `interface BattleState extends … {}` list: `TriggerMethods`.
Add to the `Object.assign(BattleState.prototype, …)` call: `triggerMethods`.

> Follow the EXACT pattern the file already uses for `damageMethods`/`heroMethods`/`towerMethods` (declaration merging + Object.assign). Mirror it.

- [ ] **Step 3c: Call the hooks**

In `src/core/battleDamage.ts`:
- End of `performAttack` (after the omnivamp `if`): 
  ```ts
  this.fireOnHit(unit, fromPos, target, dealt, didCrit);
  ```
- In `killEnemy`, immediately after `e.alive = false;`:
  ```ts
  this.fireOnKill(e);
  ```
- At the end of `castActive` (after the enemy splash loop):
  ```ts
  this.fireOnCast(attacker, center, burst, damageType);
  ```

In `src/core/battleEnemies.ts` `dealDamageToHero`, replace the damage line so `incoming` is captured, then fire:
```ts
    const incoming = mitigatedDamage(packet, this.hero.stats);
    this.hero.hp -= incoming;
    this.logEnemyHit(attacker, "hero", packet, this.hero.stats, this.hero.hp);
    if (this.hero.hp <= 0) this.hero.alive = false;
    else this.fireOnHurt(attacker, incoming);
```

- [ ] **Step 4: Run the targeted test, then the full suite.**
  `npx vitest run tests/battleTriggerFx.test.ts` → PASS
  `npx tsc --noEmit` → clean
  `npx vitest run` → all green

- [ ] **Step 5: Commit** `git add src/core/battleTriggerFx.ts src/core/battle.ts src/core/battleDamage.ts src/core/battleEnemies.ts tests/battleTriggerFx.test.ts && git commit -m "feat(battle): fire triggered unique-item effects from combat hooks"`

---

## Task 5: Show the trigger in tooltips

**Files:**
- Modify: `src/data/itemDisplay.ts`, `src/scenes/itemTooltip.ts`

- [ ] **Step 1:** Read `src/data/itemDisplay.ts` `uniquePowerLine` and `src/scenes/itemTooltip.ts` to match their existing style.

- [ ] **Step 2:** In `itemDisplay.ts`, add a helper that returns the trigger description for a def:
```ts
export function uniqueTriggerLine(def: Parameters<typeof uniquePowerFor>[0]): string | null {
  const trig = uniquePowerFor(def)?.trigger;
  return trig ? `⚡ ${trig.describe()}` : null;
}
```
(Import `uniquePowerFor` if not already imported.)

- [ ] **Step 3:** In `itemTooltip.ts`, where the gold `◆ <power>` row is rendered, add a second row when `uniqueTriggerLine(def)` is non-null, in a cyan/amber accent (reuse the nearby color constant). Mirror the existing `uniquePowerLine` rendering block exactly.

- [ ] **Step 4:** `npx tsc --noEmit` clean; `npm run build` green. (No unit test — pure presenter; verified in playtest.)

- [ ] **Step 5: Commit** `git add src/data/itemDisplay.ts src/scenes/itemTooltip.ts && git commit -m "feat(ui): show a unique item's triggered effect in its tooltip"`

---

## Task 6: Verify, playtest, ship

- [ ] **Step 1:** Full gate: `npx tsc --noEmit && npx vitest run && npx eslint src/data/triggeredEffects.ts src/data/uniquePowers.ts src/core/battleTriggers.ts src/core/battleTriggerFx.ts src/core/battle.ts && npm run build`
- [ ] **Step 2:** CDP playtest: grant + equip `aegis-of-dawn` (Thornmail) and a procedural execute/detonate unique, start a battle, confirm in the runtime log / on screen that procs fire (chain/blast fx appear; equip tooltip shows the ⚡ line). Screenshot.
- [ ] **Step 3:** Confirm **no** ASSET_VERSION change is needed (pure mechanics + text). Do NOT bump.
- [ ] **Step 4:** `git push` then deploy: `npm run build && npx firebase-tools deploy --only hosting`.
- [ ] **Step 5:** Write `memory/project_unique_triggered_powers.md` + one-line index entry in `MEMORY.md`.

---

## Self-review notes
- **Spec coverage:** catalog (T1) ✓, attach/assign incl. signatures + pools (T2) ✓, resolve once (T3) ✓, four hooks + depth-guard + dispatch onto existing primitives (T4) ✓, display (T5) ✓, verify/ship/no-bump/zero-migration (T6) ✓.
- **Recursion:** single `_triggerDepth` guard gates all four `fire*` entry points; triggered damage (blast/chain/reflect/riposte/echo/cinder) runs at depth>0 and cannot re-proc. ✓
- **Determinism:** `chance >= 1` skips the RNG (matches `applyStun`); only chance<1 procs touch the shared stream. ✓
- **File sizes:** new files are small; battleTriggerFx.ts must stay < 500 (it is ~200). ✓
- **Naming consistency:** `fireOnHit/fireOnKill/fireOnHurt/fireOnCast`, `applyTriggerEffect`, `applyKillEffect`, `triggers`, `_triggerDepth` used identically across T3/T4. ✓
