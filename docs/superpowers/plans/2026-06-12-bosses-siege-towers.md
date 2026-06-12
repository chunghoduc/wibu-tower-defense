# Bosses Siege Towers + Tank-Hold Rebalance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make ground bosses halt and siege the nearest tower in range (instead of steamrolling past), and scale a boss's damage _against towers only_ down so a tank tower can hold a boss for a meaningful window before falling.

**Architecture:** Two surgical levers, no new files or data edits. (A) The boss branch of `enemyTowerAttack()` returns `whileMoving: def.flying === true` so ground bosses become _blocking_ — the sim already turns `whileMoving:false` into "stop and demolish" via `chooseEnemyAction`, so no loop change is needed. (B) A new `BOSS_TOWER_DAMAGE_MULT` constant is multiplied into `dealDamageToTower()` only when the attacker is a boss, leaving boss-vs-hero/castle damage untouched.

**Tech Stack:** TypeScript, Vitest. Pure/sim tests via the existing `tests/fixtures.ts` battle world.

---

### Task 1: Ground bosses halt to siege towers

**Files:**

- Modify: `src/core/enemyCombat.ts:30-52` (boss branch + doc comment)
- Test: `tests/enemyCombat.test.ts:64-73` (update the boss-profile expectation)

- [ ] **Step 1: Update the failing test**

In `tests/enemyCombat.test.ts`, the existing test "derives a boss's reach from its weapon and never halts it" asserts `whileMoving` is `true`. Replace that block (lines 64-73) with two tests — a ground boss now halts, a flying boss still passes:

```ts
it("derives a ground boss's reach from its weapon and HALTS it to siege the tower", () => {
  const boss = mkEnemy({
    archetype: "Boss",
    weapon: { family: "thrown", display: "magma fists" },
    boss: { enrage: { belowHpPct: 0.4, atkMult: 1.5, speedMult: 1.5 } },
  });
  const p = enemyTowerAttack(boss)!;
  expect(p.range).toBe(weaponBaseRange({ family: "thrown", display: "" }));
  expect(p.whileMoving).toBe(false); // ground boss stops to siege
});

it("lets a FLYING boss strike towers in passing (never halts mid-air)", () => {
  const boss = mkEnemy({
    archetype: "Boss",
    flying: true,
    weapon: { family: "thrown", display: "storm bolts" },
    boss: { enrage: { belowHpPct: 0.4, atkMult: 1.5, speedMult: 1.5 } },
  });
  const p = enemyTowerAttack(boss)!;
  expect(p.whileMoving).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/enemyCombat.test.ts`
Expected: the ground-boss test FAILS — current code returns `whileMoving:true`, so `expect(p.whileMoving).toBe(false)` fails.

- [ ] **Step 3: Flip the boss branch**

In `src/core/enemyCombat.ts`, in the `if (def.boss)` branch, change the return so ground bosses block and flyers pass, and update the comment:

```ts
if (def.boss) {
  // Bosses siege towers based on their weapon's reach. Ground bosses HALT to
  // demolish the tower (a tank tower can wall them for a while); flying bosses
  // (none today, future-proofed) strike in passing like flyer tower-killers.
  const range = def.weapon ? weaponBaseRange(def.weapon) : BOSS_DEFAULT_TOWER_RANGE;
  return { range, whileMoving: def.flying === true };
}
```

Also update the file's top doc-comment line that reads
`*   - every boss reaches as far as its weapon and never halts (it steamrolls),`
to:
`*   - a ground boss halts to siege the nearest tower (flyers strike in passing),`

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/enemyCombat.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/enemyCombat.ts tests/enemyCombat.test.ts
git commit -m "feat(bosses): ground bosses halt to siege towers instead of steamrolling"
```

---

### Task 2: Boss→tower damage scalar (the tank-hold lever)

**Files:**

- Modify: `src/core/battleTypes.ts` (add `BOSS_TOWER_DAMAGE_MULT` near `MELEE_TOWER_RANGE`)
- Modify: `src/core/battleEnemies.ts:306-317` (`dealDamageToTower`)
- Test: `tests/bossSiege.test.ts` (create)

- [ ] **Step 1: Write the failing tests**

Create `tests/bossSiege.test.ts`. Three behaviors: the constant is a real fraction; a boss halts on a tower (distance plateaus); a tank-ish tower survives a meaningful number of boss hits yet eventually dies.

```ts
import { describe, expect, it } from "vitest";
import { makeStats } from "../src/data/schema.ts";
import { BOSS_TOWER_DAMAGE_MULT } from "../src/core/battleTypes.ts";
import { mkEnemy, mkStage, mkTower, oneWave, world } from "./fixtures.ts";

describe("boss→tower damage scalar", () => {
  it("is a real fraction (boss hits towers for less than full, more than nothing)", () => {
    expect(BOSS_TOWER_DAMAGE_MULT).toBeGreaterThan(0);
    expect(BOSS_TOWER_DAMAGE_MULT).toBeLessThan(1);
  });
});

describe("boss sieges a tower", () => {
  // A boss marching the lane with a tower in reach should STOP (its distance
  // along the route plateaus while the tower lives), not walk past it.
  function siegeWorld(towerHp: number) {
    const boss = mkEnemy({
      archetype: "Boss",
      boss: { enrage: { belowHpPct: 0.0, atkMult: 1, speedMult: 1 } },
      weapon: { family: "sword", display: "greatblade" },
      castleDamage: 0,
      baseStats: makeStats({ maxHp: 1e9, moveSpeed: 30, atk: 60, attackSpeed: 1 }),
    });
    const tower = mkTower({
      id: "wall",
      role: "tanker",
      baseStats: makeStats({ atk: 0, attackSpeed: 0, range: 0, maxHp: towerHp, armor: 30 }),
    });
    // Tower planted right on the lane so the boss's weapon reach covers it.
    const b = world(
      [boss],
      [tower],
      mkStage(oneWave("grunt", 1), { castleHp: 1e9, slots: [{ x: 150, y: 0 }] }),
      {
        hero: { stats: makeStats({ maxHp: 100 }), startPos: { x: -2000, y: -2000 } },
      },
    );
    expect(b.placeTower("wall", 0)).toBe(true);
    return b;
  }

  it("halts on the tower (distance along the route plateaus while the tower lives)", () => {
    const b = siegeWorld(1e9); // unbreakable wall — boss can never pass
    // March up to the tower.
    for (let i = 0; i < 200; i++) b.tick(0.05);
    const e = b.enemies[0]!;
    const d1 = e.distanceAlong;
    for (let i = 0; i < 100; i++) b.tick(0.05);
    const d2 = e.distanceAlong;
    expect(b.towers.length).toBe(1); // wall still standing
    expect(d2 - d1).toBeLessThan(1); // boss is stuck, not advancing
  });

  it("a tank tower holds the boss for a meaningful window, then falls", () => {
    const b = siegeWorld(1200);
    let hitsWhileAlive = 0;
    const boss = b.enemies[0]!;
    let lastCd = boss.attackCd;
    for (let i = 0; i < 2000 && b.towers.length > 0; i++) {
      b.tick(0.05);
      // count a landed hit each time the boss's attack cooldown resets upward
      if (boss.attackCd > lastCd + 0.01) hitsWhileAlive++;
      lastCd = boss.attackCd;
    }
    expect(b.towers.length).toBe(0); // eventually destroyed — not an infinite wall
    expect(hitsWhileAlive).toBeGreaterThanOrEqual(8); // survived "a while" (≥8 boss hits)
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/bossSiege.test.ts`
Expected: FAIL — `BOSS_TOWER_DAMAGE_MULT` is not exported yet (import error), and the boss does not yet halt/scale damage.

- [ ] **Step 3: Add the constant**

In `src/core/battleTypes.ts`, next to `MELEE_TOWER_RANGE`/`BOSS_DEFAULT_TOWER_RANGE`, add:

```ts
/**
 * A boss's per-hit damage is scaled by this when it strikes a TOWER (not the hero
 * or castle), so a tank tower can wall a sieging boss for a while before it falls.
 * Bosses now halt on towers (see enemyCombat.ts); without this softening even the
 * tankiest tower would pop in ~2-3 hits and the siege would feel pointless.
 */
export const BOSS_TOWER_DAMAGE_MULT = 0.4;
```

- [ ] **Step 4: Apply the scalar in `dealDamageToTower`**

In `src/core/battleEnemies.ts`, import the constant (add `BOSS_TOWER_DAMAGE_MULT` to the existing import from `./battleTypes.ts`) and multiply the mitigated damage when the attacker is a boss:

```ts
  dealDamageToTower(this: BattleState, attacker: EnemyRuntime, tower: TowerRuntime): void {
    const packet: DamagePacket = {
      amount: this.enemyAtk(attacker),
      type: attacker.def.damageType,
      armorPen: attacker.stats.armorPen,
      magicPen: attacker.stats.magicPen,
    };
    this.emit({ type: "enemyAttack", uid: attacker.uid, at: { x: attacker.pos.x, y: attacker.pos.y }, targetAt: { x: tower.pos.x, y: tower.pos.y }, target: "tower" });
    const bossMul = attacker.def.boss ? BOSS_TOWER_DAMAGE_MULT : 1;
    tower.hp -= mitigatedDamage(packet, tower.stats) * bossMul;
    this.logEnemyHit(attacker, `tower:${tower.uid}`, packet, tower.stats, tower.hp);
    if (tower.hp <= 0) tower.alive = false;
  },
```

- [ ] **Step 5: Run tests; tune the multiplier if needed**

Run: `npx vitest run tests/bossSiege.test.ts`
Expected: all PASS. If "holds … then falls" fails because the tower survives too few hits, lower `BOSS_TOWER_DAMAGE_MULT` (e.g. 0.35); if it never dies inside 2000 ticks (100s), raise it. Re-run until both the ≥8-hits and the eventual-death assertions hold with margin. Record the final value.

- [ ] **Step 6: Commit**

```bash
git add src/core/battleTypes.ts src/core/battleEnemies.ts tests/bossSiege.test.ts
git commit -m "balance(bosses): scale boss damage vs towers so a tank tower holds the siege"
```

---

### Task 3: Full verification + memory

**Files:** none (verification only), plus a project-memory update.

- [ ] **Step 1: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Full test suite**

Run: `npm test`
Expected: all green, including the updated `enemyCombat.test.ts` and new `bossSiege.test.ts`. If any existing test assumed bosses steamroll past towers or delete them at full damage, inspect it — update only if its assumption is exactly the behavior we intentionally changed (and note it in the commit).

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Update the enemy-tower-attack memory**

The `project_enemy_tower_attack_rules` memory says bosses "swipe towers in passing". Update that file (and its MEMORY.md hook if needed) to record that ground bosses now HALT to siege, and that `BOSS_TOWER_DAMAGE_MULT` softens boss-vs-tower damage so tank towers can hold. Keep it one fact per file.

- [ ] **Step 5: Spot-check the math**

Confirm by hand from the test output: the tank tower took ≥8 boss hits before dying, and the boss's distance-along plateaued while the wall stood — i.e. bosses now siege and a tank holds them a while, exactly the goal.
