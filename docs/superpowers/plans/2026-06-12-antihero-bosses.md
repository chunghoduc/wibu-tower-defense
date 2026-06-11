# The Antihero Gallery — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 10 new anti-hero–homage bosses to the catalog and weave them into the Chapter 2–5 finale rotation (stages 11–30), cutting the current heavy boss repetition.

**Architecture:** Pure data + wiring — **zero engine/schema changes**. Each boss is an `EnemyDef` with `archetype:"Boss"` composing the existing `boss`/`special` mechanic kit. New defs live in `src/data/enemiesAntiheroes.ts` (spread into `ENEMIES`), the stage→boss map is rewritten in `stagesExpansion.ts`, the difficulty rank table is extended in `stage.ts`, and boss sprite sheets come from the SDXL pipeline.

**Tech Stack:** TypeScript, Vitest, Phaser 3 (presenter only), z-image-turbo SDXL art flow (`gen:sprites:anim`).

**Reference spec:** `docs/superpowers/specs/2026-06-12-antihero-bosses-design.md`

---

## File Structure

- **Create** `src/data/enemiesAntiheroes.ts` — exports `ANTIHERO_BOSSES: EnemyDef[]` (the 10 defs). Mirrors `enemiesBosses.ts`.
- **Modify** `src/data/enemies.ts` — import + spread `...ANTIHERO_BOSSES` into `ENEMIES` (1 import line, 1 spread line).
- **Modify** `src/data/stagesExpansion.ts` — rewrite the `BOSS_EXPANSION` array (stages 11–30).
- **Modify** `src/data/stage.ts` — extend `BOSS_HP_RANK` to the full ascending 20-id list.
- **Modify** `scripts/sdart/prompts.mjs` — add 10 entries to `BOSS_VISUAL`.
- **Modify** `src/data/spriteManifest.ts` — add 10 `boss__<id>` entries.
- **Create** `public/assets/sprites/boss/<id>.png` + `<id>.json` (×10) — generated art.
- **Create** `tests/antiheroBosses.test.ts` — catalog/validation + mechanics smoke.
- **Create** `tests/bossPlacement.test.ts` — placement, monotonic-difficulty, midBoss invariants.

---

## Task 1: The 10 boss definitions + catalog wiring (TDD)

**Files:**
- Create: `tests/antiheroBosses.test.ts`
- Create: `src/data/enemiesAntiheroes.ts`
- Modify: `src/data/enemies.ts`

- [ ] **Step 1: Write the failing catalog + mechanics test**

Create `tests/antiheroBosses.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { world, mkTower, mkStage, runFor } from "./fixtures.ts";
import { ENEMIES, castleLeakDamage, BOSS_CASTLE_DAMAGE } from "../src/data/enemies.ts";
import { ANTIHERO_BOSSES } from "../src/data/enemiesAntiheroes.ts";
import { validateEnemy } from "../src/data/schema.ts";

const IDS = [
  "gravemourn", "vindicator", "sundermark", "crownfall", "unkilling",
  "mawborn", "devourer", "crimsonlord", "fallenward", "ashghost",
];
const byId = (id: string) => ENEMIES.find((e) => e.id === id)!;

describe("Antihero Gallery — catalog integrity", () => {
  it("exports exactly the 10 new bosses", () => {
    expect(ANTIHERO_BOSSES.map((b) => b.id).sort()).toEqual([...IDS].sort());
  });
  it("all 10 are wired into ENEMIES and pass schema validation", () => {
    for (const id of IDS) {
      const def = byId(id);
      expect(def, id).toBeDefined();
      expect(() => validateEnemy(def)).not.toThrow();
    }
  });
  it("all are archetype Boss, never immune, and leak for the flat boss castle damage", () => {
    for (const id of IDS) {
      const def = byId(id);
      expect(def.archetype, id).toBe("Boss");
      expect(def.immunity, id).toBeNull();          // bosses must always be answerable
      expect(castleLeakDamage(def), id).toBe(BOSS_CASTLE_DAMAGE);
    }
  });
  it("carries each boss's designed signature mechanic", () => {
    expect(byId("gravemourn").boss?.enrage).toBeDefined();
    expect(byId("gravemourn").special?.frenzy).toBeDefined();   // double sub-50% spike
    expect(byId("vindicator").special?.attacksTowers).toBeDefined();
    expect(byId("vindicator").boss?.enrage).toBeUndefined();     // the cold gunman never enrages
    expect(byId("sundermark").boss?.towerDisable).toBeDefined();
    expect(byId("crownfall").boss?.enrage?.atkMult).toBeGreaterThanOrEqual(1.9);
    expect(byId("crownfall").boss?.skill?.type).toBe("barrier");
    expect(byId("unkilling").baseStats.hpRegen).toBeGreaterThanOrEqual(40);
    expect(byId("unkilling").special?.frenzy).toBeDefined();
    expect(byId("mawborn").special?.splitInto).toBeDefined();
    expect(byId("devourer").boss?.summon?.enemyId).toBe("brute");
    expect(byId("crimsonlord").boss?.skill?.type).toBe("rally");
    expect(byId("fallenward").boss?.towerDisable?.duration).toBeGreaterThanOrEqual(3);
    expect(byId("ashghost").boss?.enrage).toBeDefined();
    expect(byId("ashghost").boss?.summon).toBeDefined();
    expect(byId("ashghost").boss?.towerDisable).toBeDefined();
    expect(byId("ashghost").boss?.skill?.type).toBe("quake");
  });
});

describe("Antihero Gallery — mechanics fire in-sim (smoke)", () => {
  // A spawn-and-tick harness: drop the real catalog boss + a sturdy tower into a
  // long lane and tick. Asserts no throw and that summon/disable mechanics land.
  function bossWorld(bossId: string) {
    const boss = byId(bossId);
    const imp = byId("imp"), brute = byId("brute");
    // Sturdy, harmless-to-itself tower far enough to never die; high range to engage.
    const tower = mkTower({ baseStats: { ...mkTower().baseStats, atk: 20, attackSpeed: 2, range: 9999, maxHp: 1e9 } });
    const stage = mkStage([{ spawns: [{ enemyId: bossId, count: 1, interval: 1, delay: 0 }] }],
      { slots: [{ x: 60, y: 0 }], path: [{ x: 0, y: 0 }, { x: 6000, y: 0 }] });
    const b = world([boss, imp, brute, tower as never].filter(Boolean) as never, [tower], stage, { seed: 7 });
    b.placeTower("turret", 0);
    return b;
  }

  it("every boss ticks for 12s without throwing", () => {
    for (const id of IDS) {
      const b = bossWorld(id);
      expect(() => runFor(b, 12)).not.toThrow();
    }
  });
  it("devourer summons brute adds", () => {
    const b = bossWorld("devourer");
    runFor(b, 12); // summon interval 9s → at least one wave of adds
    expect(b.enemies.some((e) => e.def.id === "brute")).toBe(true);
  });
  it("sundermark disables a nearby tower", () => {
    const b = bossWorld("sundermark");
    runFor(b, 10); // towerDisable interval 9s
    expect(b.towers[0].disabledTimer).toBeGreaterThan(0);
  });
});
```

> Note: `bossWorld` builds the enemy map from `[boss, imp, brute]`. The odd
> `tower as never` filter line above is wrong — replace the `world(...)` call with the
> clean version below when you paste (kept here only so the array intent is explicit):
>
> ```ts
> const b = world([boss, imp, brute], [tower], stage, { seed: 7 });
> ```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/antiheroBosses.test.ts`
Expected: FAIL — `Cannot find module '../src/data/enemiesAntiheroes.ts'`.

- [ ] **Step 3: Create the 10 boss definitions**

Create `src/data/enemiesAntiheroes.ts`:

```ts
/**
 * The Antihero Gallery — 10 original bosses, each an homage to a beloved
 * anti-hero from anime/movies/stories. The real inspiration lives ONLY in a
 * `// homage:` comment (never shipped as data); the `name` is original. Split out
 * of `enemies.ts` to keep that file under the 500-line cap; spread into `ENEMIES`
 * there alongside HOMAGE_BOSSES. All compose the existing boss/special kit — no
 * new engine code. See docs/superpowers/specs/2026-06-12-antihero-bosses-design.md
 * and [[project_homage_field_shipped]].
 */
import { makeStats, type EnemyDef } from "./schema.ts";

export const ANTIHERO_BOSSES: EnemyDef[] = [
  {
    id: "gravemourn", name: "Gravemourn the Black Reaver", // homage: Guts (Berserk)
    archetype: "Boss", flying: false, immunity: null, damageType: "Physical",
    bounty: 90, castleDamage: 8,
    baseStats: makeStats({ maxHp: 1150, armor: 30, moveSpeed: 34, atk: 40, attackSpeed: 1.2, tenacity: 0.5 }),
    weapon: { family: "sword", display: "a slab of iron too large to be called a sword", heavy: true },
    special: { attacksTowers: { range: 100 }, frenzy: { belowHpPct: 0.5, speedMult: 1.5, atkMult: 1.5 } },
    boss: {
      enrage: { belowHpPct: 0.5, atkMult: 1.6, speedMult: 1.6 },
      skill: { id: "gravemourn-cleave", name: "Berserker Cleave", description: "A wild horizontal cleave staggers nearby towers and rends the hero.", manaCost: 95, type: "quake", radius: 150, power: 0.16 },
    },
    artRef: "placeholder",
  },
  {
    id: "vindicator", name: "The Vindicator", // homage: The Punisher (Marvel)
    archetype: "Boss", flying: false, immunity: null, damageType: "Physical",
    bounty: 110, castleDamage: 9,
    baseStats: makeStats({ maxHp: 1350, armor: 35, moveSpeed: 28, atk: 52, attackSpeed: 1.3, tenacity: 0.5 }),
    weapon: { family: "thrown", display: "a relentless barrage of gunfire" },
    special: { attacksTowers: { range: 170 } }, // outranges the line — a race to kill
    boss: {
      skill: { id: "vindicator-barrage", name: "Suppressing Fire", description: "Rakes the line with fire — stuns nearby towers and batters the hero.", manaCost: 100, type: "quake", radius: 160, power: 0.18 },
    },
    artRef: "placeholder",
  },
  {
    id: "sundermark", name: "Sundermark the Vagrant", // homage: Scar (Fullmetal Alchemist)
    archetype: "Boss", flying: false, immunity: null, damageType: "Magic",
    bounty: 120, castleDamage: 10,
    baseStats: makeStats({ maxHp: 1500, armor: 28, magicResist: 30, moveSpeed: 30, atk: 44, attackSpeed: 1.0, tenacity: 0.55 }),
    weapon: { family: "fist", display: "a destroying right hand" },
    special: { attacksTowers: { range: 110 } },
    boss: {
      towerDisable: { radius: 120, duration: 2.5, interval: 9 },
      skill: { id: "sundermark-deconstruct", name: "Deconstruction", description: "Unmakes the matter of nearby towers and savages the hero.", manaCost: 105, type: "quake", radius: 150, power: 0.18 },
    },
    artRef: "placeholder",
  },
  {
    id: "crownfall", name: "Crownfall the Proud", // homage: Vegeta (Dragon Ball)
    archetype: "Boss", flying: false, immunity: null, damageType: "Magic",
    bounty: 130, castleDamage: 10,
    baseStats: makeStats({ maxHp: 1650, armor: 32, magicResist: 28, moveSpeed: 30, atk: 46, attackSpeed: 1.0, tenacity: 0.6 }),
    weapon: { family: "fist", display: "searing fists of energy", element: "fire", enchanted: true },
    boss: {
      summon: { enemyId: "imp", count: 2, interval: 7 },
      enrage: { belowHpPct: 0.45, atkMult: 2.0, speedMult: 1.7 }, // prideful power-up
      skill: { id: "crownfall-pride", name: "Galick Pride", description: "Erupts a prideful aura, shielding itself and its minions.", manaCost: 110, type: "barrier", radius: 180, power: 0.32 },
    },
    artRef: "placeholder",
  },
  {
    id: "unkilling", name: "The Unkilling", // homage: Wolverine (X-Men)
    archetype: "Boss", flying: false, immunity: null, damageType: "Physical",
    bounty: 150, castleDamage: 11,
    baseStats: makeStats({ maxHp: 1950, armor: 34, moveSpeed: 32, atk: 42, attackSpeed: 1.3, hpRegen: 60, tenacity: 0.7 }),
    weapon: { family: "fist", display: "three slashing claws" },
    special: { frenzy: { belowHpPct: 0.4, speedMult: 1.5, atkMult: 1.6 } },
    boss: {
      enrage: { belowHpPct: 0.4, atkMult: 1.5, speedMult: 1.4 },
      skill: { id: "unkilling-mend", name: "Healing Factor", description: "Knits its wounds shut, restoring a burst of health.", manaCost: 90, type: "rally", radius: 120, power: 0.22 },
    },
    artRef: "placeholder",
  },
  {
    id: "mawborn", name: "The Hungering Other", // homage: Venom (symbiote)
    archetype: "Boss", flying: false, immunity: null, damageType: "Physical",
    bounty: 170, castleDamage: 12,
    baseStats: makeStats({ maxHp: 2250, armor: 36, moveSpeed: 28, atk: 48, attackSpeed: 1.0, tenacity: 0.6 }),
    weapon: { family: "fist", display: "lashing symbiotic tendrils" },
    special: { splitInto: { enemyId: "imp", count: 3 } },
    boss: {
      summon: { enemyId: "imp", count: 2, interval: 6 },
      enrage: { belowHpPct: 0.4, atkMult: 1.6, speedMult: 1.5 },
      skill: { id: "mawborn-swarm", name: "Spawn the Brood", description: "Splits off a writhing brood of spawn.", manaCost: 110, type: "summon-surge", power: 4, summonId: "imp" },
    },
    artRef: "placeholder",
  },
  {
    id: "devourer", name: "The Devouring Heir", // homage: Eren Yeager / the Titans (Attack on Titan)
    archetype: "Boss", flying: false, immunity: null, damageType: "Physical",
    bounty: 185, castleDamage: 13,
    baseStats: makeStats({ maxHp: 2400, armor: 40, moveSpeed: 22, atk: 54, attackSpeed: 0.85, tenacity: 0.65 }),
    weapon: { family: "fist", display: "titanic crushing fists" },
    boss: {
      summon: { enemyId: "brute", count: 1, interval: 9 }, // a wall that breeds walls
      enrage: { belowHpPct: 0.4, atkMult: 1.7, speedMult: 1.5 },
      skill: { id: "devourer-rumbling", name: "The Rumbling", description: "Calls a march of lesser titans to trample the line.", manaCost: 120, type: "summon-surge", power: 3, summonId: "brute" },
    },
    artRef: "placeholder",
  },
  {
    id: "crimsonlord", name: "The Crimson Sovereign", // homage: Alucard (Hellsing)
    archetype: "Boss", flying: false, immunity: null, damageType: "Magic",
    bounty: 200, castleDamage: 13,
    baseStats: makeStats({ maxHp: 2600, armor: 30, magicResist: 38, moveSpeed: 26, atk: 50, attackSpeed: 1.1, hpRegen: 40, tenacity: 0.65 }),
    weapon: { family: "thrown", display: "twin blessed long-barreled pistols" },
    boss: {
      summon: { enemyId: "imp", count: 2, interval: 7 }, // raises familiars
      enrage: { belowHpPct: 0.4, atkMult: 1.6, speedMult: 1.5 },
      skill: { id: "crimsonlord-drain", name: "Crimson Feast", description: "Drains vitality from the field to heal itself and its familiars.", manaCost: 105, type: "rally", radius: 190, power: 0.2 },
    },
    artRef: "placeholder",
  },
  {
    id: "fallenward", name: "The Fallen Warden", // homage: Darth Vader (Star Wars)
    archetype: "Boss", flying: false, immunity: null, damageType: "Magic",
    bounty: 230, castleDamage: 15,
    baseStats: makeStats({ maxHp: 3100, armor: 45, magicResist: 35, moveSpeed: 24, atk: 56, attackSpeed: 0.9, tenacity: 0.7 }),
    weapon: { family: "sword", display: "a humming crimson energy blade", element: "fire", enchanted: true },
    boss: {
      towerDisable: { radius: 150, duration: 3.5, interval: 10 }, // dread "force choke"
      enrage: { belowHpPct: 0.4, atkMult: 1.6, speedMult: 1.4 },
      skill: { id: "fallenward-choke", name: "Dread Choke", description: "An unseen grip silences the towers and crushes the hero.", manaCost: 115, type: "barrier", radius: 180, power: 0.34 },
    },
    artRef: "placeholder",
  },
  {
    id: "ashghost", name: "The Ashen Ghost", // homage: Kratos (God of War)
    archetype: "Boss", flying: false, immunity: null, damageType: "Physical",
    bounty: 300, castleDamage: 20,
    baseStats: makeStats({ maxHp: 4200, armor: 55, magicResist: 35, moveSpeed: 24, atk: 70, attackSpeed: 1.0, hpRegen: 16, tenacity: 0.8 }),
    weapon: { family: "thrown", display: "twin chained blades wreathed in ash", element: "fire", enchanted: true },
    boss: { // the apex: the works
      summon: { enemyId: "imp", count: 2, interval: 7 },
      towerDisable: { radius: 140, duration: 3, interval: 11 },
      enrage: { belowHpPct: 0.4, atkMult: 2.0, speedMult: 1.7 },
      skill: { id: "ashghost-rage", name: "Spartan Rage", description: "An eruption of ash and fury devastates the hero and silences nearby towers.", manaCost: 120, type: "quake", radius: 200, power: 0.24 },
    },
    artRef: "placeholder",
  },
];
```

- [ ] **Step 4: Wire the new bosses into `ENEMIES`**

In `src/data/enemies.ts`, add the import next to the existing HOMAGE_BOSSES import (near line 11):

```ts
import { HOMAGE_BOSSES } from "./enemiesBosses.ts";
import { ANTIHERO_BOSSES } from "./enemiesAntiheroes.ts";
```

Then add the spread right after `...HOMAGE_BOSSES,` (near line 438):

```ts
  // Anime-homage bosses (zabro … meruon) live in ./enemiesBosses.ts to keep this
  // file under the 500-line cap. They append after the original/expansion roster.
  ...HOMAGE_BOSSES,
  // The Antihero Gallery (gravemourn … ashghost) — 10 anti-hero homages, in
  // ./enemiesAntiheroes.ts for the same reason. See the 2026-06-12 design spec.
  ...ANTIHERO_BOSSES,
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/antiheroBosses.test.ts`
Expected: PASS (all describe blocks green).

- [ ] **Step 6: Confirm the file-size rule holds**

Run: `wc -l src/data/enemies.ts src/data/enemiesAntiheroes.ts`
Expected: `enemies.ts` ≤ 460 (it gains only 4 lines); `enemiesAntiheroes.ts` < 200.

- [ ] **Step 7: Commit**

```bash
git add src/data/enemiesAntiheroes.ts src/data/enemies.ts tests/antiheroBosses.test.ts
git commit -m "feat(bosses): the Antihero Gallery — 10 new homage boss defs (composed mechanics)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Stage placement + difficulty-rank wiring (TDD)

**Files:**
- Create: `tests/bossPlacement.test.ts`
- Modify: `src/data/stagesExpansion.ts` (`BOSS_EXPANSION`)
- Modify: `src/data/stage.ts` (`BOSS_HP_RANK`)

- [ ] **Step 1: Write the failing placement + invariant test**

Create `tests/bossPlacement.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { BOSS_BY_STAGE, midBossFor } from "../src/data/stage.ts";
import { ENEMIES } from "../src/data/enemies.ts";

const NEW = [
  "gravemourn", "vindicator", "sundermark", "crownfall", "unkilling",
  "mawborn", "devourer", "crimsonlord", "fallenward", "ashghost",
];
const hp = (id: string) => ENEMIES.find((e) => e.id === id)!.baseStats.maxHp;

describe("Antihero Gallery — stage placement", () => {
  it("BOSS_BY_STAGE covers all 30 stages", () => {
    expect(BOSS_BY_STAGE.length).toBe(30);
  });
  it("every new boss headlines at least one stage", () => {
    for (const id of NEW) expect(BOSS_BY_STAGE, id).toContain(id);
  });
  it("ashghost is the stage-30 final boss (the game's apex)", () => {
    expect(BOSS_BY_STAGE[29]).toBe("ashghost");
  });
  it("classic-boss reruns are reduced (no boss repeats more than twice)", () => {
    const counts = new Map<string, number>();
    for (const id of BOSS_BY_STAGE) counts.set(id, (counts.get(id) ?? 0) + 1);
    for (const [id, c] of counts) expect(c, id).toBeLessThanOrEqual(2);
  });
});

describe("Difficulty monotonic law", () => {
  it("within every chapter (5 stages) the finale bosses ascend by base HP", () => {
    for (let ch = 0; ch < 6; ch++) {
      const slice = BOSS_BY_STAGE.slice(ch * 5, ch * 5 + 5);
      for (let i = 1; i < slice.length; i++) {
        expect(hp(slice[i]), `ch${ch + 1} stage ${i + 1}: ${slice[i]} (${hp(slice[i])}) < ${slice[i - 1]} (${hp(slice[i - 1])})`)
          .toBeGreaterThanOrEqual(hp(slice[i - 1]));
      }
    }
  });
  it("wave-5 mid-boss never out-ranks the wave-10 finale, for all 30 stages", () => {
    for (let n = 1; n <= 30; n++) {
      const final = BOSS_BY_STAGE[n - 1];
      const mid = midBossFor(n);
      expect(hp(mid), `stage ${n}: mid ${mid} (${hp(mid)}) > final ${final} (${hp(final)})`)
        .toBeLessThanOrEqual(hp(final));
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/bossPlacement.test.ts`
Expected: FAIL — `every new boss headlines at least one stage` (current `BOSS_EXPANSION` has none of the new ids) and likely the monotonic check.

- [ ] **Step 3: Rewrite `BOSS_EXPANSION`**

In `src/data/stagesExpansion.ts`, replace the entire `export const BOSS_EXPANSION = [...]` block (and update its doc comment) with:

```ts
/**
 * Final boss for stages 11–30 (1-indexed continues from BOSS_BY_STAGE). The
 * Antihero Gallery (10 new bosses) headlines most stages, with a few classic
 * apex bosses kept as chapter climaxes. Each chapter's five finals are ordered
 * ASCENDING by base HP so the boss spike climbs stage-by-stage and the chapter
 * climaxes on its hardest boss; the progression curve then scales these by depth.
 * Base HP rank lives in BOSS_HP_RANK (stage.ts). See the 2026-06-12 antihero spec.
 */
export const BOSS_EXPANSION = [
  // Chapter 2 — Sunscar Wastes (11–15) → climax: overlord (2200)
  "gravemourn", "vindicator", "sundermark", "crownfall", "overlord",
  // Chapter 3 — Emberfall (16–20) → climax: madarok (2700)
  "unkilling", "mukade", "mawborn", "devourer", "madarok",
  // Chapter 4 — Mire Hollow (21–25) → climax: meruon (3800)
  "akai", "crimsonlord", "madarok", "fallenward", "meruon",
  // Chapter 5 — The Blight (26–30) → climax: ashghost (4200), the final boss
  "crimsonlord", "madarok", "fallenward", "meruon", "ashghost",
];
```

- [ ] **Step 4: Extend `BOSS_HP_RANK` in `stage.ts`**

In `src/data/stage.ts`, replace the `BOSS_HP_RANK` array (near line 106) with the full ascending 20-id list (do NOT touch `bossRank`/`midBossFor` logic):

```ts
const BOSS_HP_RANK = [
  // Ascending base HP — the canonical difficulty rank (keeps wave-5 ≤ wave-10).
  "champion",   // 700
  "zabro",      // 1000
  "gravemourn", // 1150
  "ryomen",     // 1200
  "vindicator", // 1350
  "kura",       // 1450
  "sundermark", // 1500
  "crownfall",  // 1650
  "warden",     // 1700
  "unkilling",  // 1950
  "akai",       // 2000
  "mukade",     // 2200
  "overlord",   // 2200
  "mawborn",    // 2250
  "devourer",   // 2400
  "crimsonlord",// 2600
  "madarok",    // 2700
  "fallenward", // 3100
  "meruon",     // 3800
  "ashghost",   // 4200
];
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/bossPlacement.test.ts`
Expected: PASS (all invariants hold).

- [ ] **Step 6: Run the existing boss/wave suites (regression guard)**

Run: `npx vitest run tests/bosses.test.ts tests/boss-skill.test.ts tests/waveStructure.test.ts tests/chapter1Waves.test.ts`
Expected: PASS (Chapter 1 is untouched; expansion bosses still resolve).

- [ ] **Step 7: Commit**

```bash
git add src/data/stagesExpansion.ts src/data/stage.ts tests/bossPlacement.test.ts
git commit -m "feat(bosses): weave the Antihero Gallery into ch2-5 finales + extend HP rank

Cuts classic-boss reruns from 3-4x to <=2x; preserves the monotonic difficulty
law (ascending per chapter, mid-boss never out-ranks the finale).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Boss sprite art (SDXL) + manifest

**Files:**
- Modify: `scripts/sdart/prompts.mjs` (`BOSS_VISUAL`)
- Create: `public/assets/sprites/boss/<id>.png` + `<id>.json` (×10)
- Modify: `src/data/spriteManifest.ts`
- Modify: `tests/antiheroBosses.test.ts` (add a manifest-key assertion)

- [ ] **Step 1: Add the 10 visual descriptors to `BOSS_VISUAL`**

In `scripts/sdart/prompts.mjs`, inside the `export const BOSS_VISUAL = { ... }` object (after `overlord:`), add (descriptors are name-free per the homage rule but visually recognizable):

```js
  gravemourn: "a towering grim black-armored swordsman boss with a single scarred eye and a prosthetic iron forearm, wielding a colossal slab-like greatsword as tall as himself, tattered dark cloak, brooding rage",
  vindicator: "a hardened militant vigilante boss in black tactical body armor bearing a stark white skull emblem across the chest, draped in ammunition belts, gripping heavy military firearms, grim and merciless",
  sundermark: "a wandering scarred warrior-assassin boss with a large X-shaped facial scar, dark dreadlocked hair and small round sunglasses, one arm wrapped in glowing red destruction sigils, flowing grey traveler's robes",
  crownfall: "a proud armored warrior-prince boss with spiked black flame-shaped hair, royal blue battle armor over a white bodysuit with white gloves and boots, crackling golden energy aura, arrogant scowl",
  unkilling: "a feral muscular berserker boss with wild dark hair drawn into two points and thick sideburns, a yellow and blue armored bodysuit, three gleaming metal claws extending from each fist, savage snarl",
  mawborn: "a hulking pitch-black symbiote monster boss with a huge fanged maw and bulging white eyes, long writhing tendrils and a massive lashing tongue, glistening alien ooze",
  devourer: "a colossal skinless titan boss of exposed steaming red musculature, long flowing dark hair framing a gaunt determined face with glowing eyes, towering and unstoppable",
  crimsonlord: "an aristocratic vampire lord boss in a long crimson coat and wide-brimmed red hat, round orange-tinted glasses and jet-black hair, wielding ornate long-barreled pistols, a fanged grin",
  fallenward: "a dread armored dark warlord boss in a flowing black cape and full obsidian plate armor, an intimidating skull-like helmet with a breathing mask, wielding a humming crimson energy blade",
  ashghost: "a vengeful pale ash-skinned spartan warrior boss with a bold red tattoo across one eye, a short dark beard and a scarred muscular body, twin chained blades wreathed in fire, cold fury",
```

- [ ] **Step 2: Generate the boss sprite sheets**

Run (the SDXL z-image-turbo API must be up at 127.0.0.1:8765; generation is resumable — existing bosses are skipped):

```bash
npm run gen:sprites:anim -- --only=boss
```

Expected: console prints `[k/N] boss/<id> (anim)` for each NEW id and writes
`public/assets/sprites/boss/<id>.png` + `public/assets/sprites/boss/<id>.json`
(the slicer's frame metadata sidecar). The 3 pre-existing ids (champion/warden/
overlord) and the 7 homage ids are skipped (already on disk).

If the API is down, start it per `memory/reference_playtest_and_art.md`, then rerun.

- [ ] **Step 3: Verify all 10 PNG+JSON pairs exist**

Run:

```bash
for id in gravemourn vindicator sundermark crownfall unkilling mawborn devourer crimsonlord fallenward ashghost; do
  test -f public/assets/sprites/boss/$id.png && test -f public/assets/sprites/boss/$id.json && echo "OK $id" || echo "MISSING $id";
done
```

Expected: `OK` for all 10. (If any failed to slice, rerun step 2 with `--force` for that case.)

- [ ] **Step 4: Append the 10 manifest entries (derived from the generated JSON)**

Generate the exact manifest lines from the sidecar JSON the slicer wrote (this guarantees `frameWidth`/`frameHeight`/`frames`/`names` match the real art), then paste them into `src/data/spriteManifest.ts` next to the existing `boss__zabro` entry:

```bash
node -e '
const fs=require("fs");
const ids=["gravemourn","vindicator","sundermark","crownfall","unkilling","mawborn","devourer","crimsonlord","fallenward","ashghost"];
for(const id of ids){
  const m=JSON.parse(fs.readFileSync(`public/assets/sprites/boss/${id}.json`,"utf8"));
  console.log(JSON.stringify({key:`boss__${id}`,kind:"boss",id,path:`assets/sprites/boss/${id}.png`,frameWidth:m.frameWidth,frameHeight:m.frameHeight,frames:m.frames,names:m.names})+",");
}'
```

`spriteManifest.ts` is a single huge line and may be too large to `Read`; insert the
printed lines after the `boss__zabro` object using a scripted insertion (mirrors how
the Escalation Five enemy entries were added). Example with `perl` (replace the
`PASTE` block with the node output above, comma-terminated, no trailing comma issues):

```bash
# 1) capture the entries
ENTRIES=$(node -e '... the snippet above ...')
# 2) insert them right after the boss__zabro entry object
perl -0777 -i -pe "s/(\{\"key\":\"boss__zabro\"[^}]*\},)/\$1$ENTRIES/" src/data/spriteManifest.ts
```

Verify insertion:

```bash
grep -o "boss__[a-z]*" src/data/spriteManifest.ts | sort -u
```

Expected: the original 10 boss keys **plus** the 10 new ones (20 total).

- [ ] **Step 5: Add a manifest-key assertion to the catalog test**

In `tests/antiheroBosses.test.ts`, add this import at the top:

```ts
import { SPRITE_MANIFEST } from "../src/data/spriteManifest.ts";
```

> If the manifest's exported symbol differs, open `src/data/spriteManifest.ts` and use
> its actual export name (e.g. `MANIFEST`/`SPRITES`). Grep: `grep -o "export const [A-Z_]*" src/data/spriteManifest.ts`.

Then add inside the `catalog integrity` describe block:

```ts
  it("each boss has a boss__<id> sprite-manifest entry", () => {
    const keys = new Set(SPRITE_MANIFEST.map((m: { key: string }) => m.key));
    for (const id of IDS) expect(keys.has(`boss__${id}`), id).toBe(true);
  });
```

- [ ] **Step 6: Run the test + typecheck**

Run: `npx vitest run tests/antiheroBosses.test.ts && npx tsc --noEmit`
Expected: PASS + no type errors.

- [ ] **Step 7: Commit (art is binary — add the PNGs/JSON explicitly)**

```bash
git add scripts/sdart/prompts.mjs src/data/spriteManifest.ts tests/antiheroBosses.test.ts public/assets/sprites/boss/
git commit -m "feat(bosses): SDXL sprite sheets + manifest for the Antihero Gallery

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Whole-system verification, playtest, document

**Files:** none new — verification + memory.

- [ ] **Step 1: Full suite + typecheck + build**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: 0 type errors; ALL tests pass (prior 835 + the new antihero/placement tests); build succeeds.

- [ ] **Step 2: File-size audit on every touched source file**

Run: `wc -l src/data/enemies.ts src/data/enemiesAntiheroes.ts src/data/stagesExpansion.ts src/data/stage.ts`
Expected: every file < 500 lines. (`stagesExpansion.ts` and `stage.ts` change only existing arrays — net line count barely moves.)

- [ ] **Step 3: CDP self-playtest — the apex boss renders and fights**

Start the dev server if needed (`npm run dev`), then drive the running game via
`window.__game` (see `memory/reference_playtest_and_art.md`). Launch stage 30
(ch5-s30, index 29), fast-forward to wave 10, and confirm `ashghost` spawns,
renders (sprite visible, not invisible), fires its mechanics, and the console is
clean. Example page-eval (adapt selectors to the project's CDP harness):

```js
const g = window.__game;
const m = await import('/src/data/stage.ts');
g.registry.set('selectedStage', m.STAGES[29]); // ch5-s30
g.scene.start('BattleScene');
// … let it run to wave 10 …
const battle = g.scene.getScene('BattleScene').battle;
const present = [...new Set(battle.enemies.map(e => e.def.id))];
({ stage: 'ch5-s30', hasAshghost: battle.enemies.some(e => e.def.id === 'ashghost'), present });
```

Also spot-check a Chapter-2 stage (ch2-s11, index 10) to confirm `gravemourn`
debuts there. Capture a screenshot to `/tmp/antihero-bosses.png` and confirm
`ERRORS none` in the console log.

- [ ] **Step 4: Quick balance sanity (TTK) on ashghost**

In the same CDP session, read `ashghost`'s scaled HP at stage 30 and confirm an
intended maxed roster's combined DPS can clear it within the wave timer (state the
assumption in the playtest note). If it reads as an unwinnable wall (e.g. > ~3× the
next-hardest finale's effective HP), reduce `ashghost` base HP toward 3800–4000 and
rerun `tests/bossPlacement.test.ts` (the monotonic invariant must still hold). One
knob at a time.

- [ ] **Step 5: Update memory**

Write `memory/project_antihero_bosses.md` (frontmatter `type: project`) documenting:
the 10 ids + their homages + signature combos, that they compose the existing kit
(no engine change), the `BOSS_EXPANSION` placement + extended `BOSS_HP_RANK`, the
`enemiesAntiheroes.ts` split, and that `ashghost` is the stage-30 apex. Link
`[[project_chapter2_elite_enemies]]`, `[[feedback_difficulty_monotonic_law]]`,
`[[project_homage_field_shipped]]`, `[[reference_playtest_and_art.md]]`. Add a
one-line pointer to `memory/MEMORY.md`.

- [ ] **Step 6: Final commit (if the playtest required a balance tweak or memory is in-repo)**

```bash
git add -A
git commit -m "test(bosses): verify + playtest the Antihero Gallery (ch2-5 + apex ashghost)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

(Memory files live outside the repo and are not committed; commit only if a balance
tweak from Step 4 changed source.)

---

## Self-Review

**Spec coverage:**
- §5 roster (10 bosses) → Task 1 (defs) ✓
- §6 placement + monotonic law + midBoss → Task 2 ✓
- §7 architecture (new file, spread, BOSS_HP_RANK, art, codex-auto) → Tasks 1–3 ✓ (codex needs no change: all `archetype:"Boss"`)
- §8 testing (validation, mechanics smoke, manifest key, placement, monotonic, midBoss, regression) → Tasks 1–3 tests ✓
- §9 risks (oppressive combo, non-monotonic, invisible boss, apex balance) → Task 2 invariant test + Task 3 manifest test + Task 4 CDP playtest & TTK ✓

**Placeholder scan:** none — every step has concrete code/commands. (Task 3 steps 4–5 note adaptive fallbacks for the manifest export name and the single-line-file insertion, with exact grep commands to resolve them — not placeholders.)

**Type consistency:** ids match across all tasks (`gravemourn … ashghost`); `BOSS_HP_RANK`/`BOSS_EXPANSION` ids match the defs; mechanic fields (`boss.enrage`, `special.frenzy`, `special.attacksTowers`, `boss.summon.enemyId`, `boss.towerDisable`, `boss.skill.type`) match `schema.ts`. `summon.enemyId` targets (`imp`, `brute`) are existing catalog enemies. The Task 1 test note flags the one deliberately-broken illustrative line and supplies the correct `world(...)` call.
