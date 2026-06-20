# Passive Tree Massive Expansion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Grow the passive tree from 78 to ~950 nodes via a pure deterministic generator that *extends* (never replaces) the existing authored nodes, so a max-level player (~100 points) can complete only one region lobe and never allocate even 1/5 of the tree — with a pan/zoom UI to navigate it.

**Architecture:** Keep the 78 authored nodes verbatim as `BASE_NODES`. A pure builder `buildExtendedPassiveTree(BASE_NODES)` grows each of the 8 regions outward from its farthest authored node along a long spine (deep outer keystone) with side branches (notables/jewels/masteries), laid out on a polar grid per angular sector. Zero save migration (no authored ID/stat/position changes). The scene gains a scrollable/zoomable tree camera plus a fixed UI camera for the side panel.

**Tech Stack:** TypeScript, Phaser 3 (cameras), Vitest, deterministic `core/rng.ts Rng`.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `src/data/passiveTreeSpec.ts` (new) | Per-region growth specs: stat pools, outer-keystone + mastery flavor, GEN constants, `CENTER`. Pure data. |
| `src/data/passiveTreeGen.ts` (new) | `buildExtendedPassiveTree`, lobe growth, polar placement. Pure. |
| `tests/passiveTreeGen.test.ts` (new) | Structural + commitment + coverage + determinism invariants. |
| `src/data/passiveGrid.ts` (modify) | `BASE_NODES` = current literal array; `PASSIVE_NODES = buildExtendedPassiveTree(BASE_NODES)`. Map/reachable/canForget unchanged. |
| `src/scenes/passiveTreeCamera.ts` (new) | Pure pan/zoom clamp + tree bounds + frontier-center math. |
| `tests/passiveTreeCamera.test.ts` (new) | Camera math invariants. |
| `src/scenes/passiveGridPanel.ts` (new) | Side-panel presenter extracted from the scene (keeps scene < 500 lines). |
| `src/scenes/PassiveGridScene.ts` (modify) | Wire tree camera + UI camera + world-space hit-test; delegate panel to `passiveGridPanel.ts`. |

All files must stay < 500 code lines (ESLint `max-lines`).

---

## Task 1: Region growth specs (data)

**Files:**
- Create: `src/data/passiveTreeSpec.ts`
- Test: (covered by Task 2 tests)

- [ ] **Step 1: Write the spec data module**

```ts
// src/data/passiveTreeSpec.ts
// Compact per-region growth descriptors consumed by passiveTreeGen.ts. Pure data:
// stat pools for travel/notable nodes, the deep outer keystone, and one mastery
// choice node per region. Anchor + sector angle are DERIVED at build time from each
// region's farthest authored node (see passiveTreeGen.ts) — not stored here.
import type { Stats } from "./schema.ts";
import type { PassiveRegion } from "./schemaEnums.ts";

export const CENTER = { x: 12, y: 9 } as const;

// Lobe shape. Tuned so: outer keystone sits at BFS depth ≥ ~56 from grid-start
// (anchorDepth ~4-9 + SPINE_LEN), making TWO regions' keystones (> 100 pts)
// unaffordable at the 100-point cap; and each lobe is ~110 nodes (× 8 ≈ 880+).
export const GEN = {
  spineLen: 52, // travel nodes from anchor out to the outer keystone
  branchEvery: 2, // attach a side branch off every Nth spine node
  branchMin: 1,
  branchMax: 3,
  masteryAt: 12, // spine index that carries the mastery choice node
  jewelAt: [8, 28, 46], // spine indices that carry a jewel socket off-branch
  ringStep: 1, // grid rings advanced per spine node
  angleJitter: 0.05, // radians of deterministic wobble inside the sector
  branchAngle: 0.14, // radians a branch peels off the spine
} as const;

type Pair = [keyof Stats, number];

export interface RegionGrowth {
  region: PassiveRegion;
  /** Travel nodes pick one entry (increased%). */
  travel: Pair[];
  /** Notable bag (increased%). */
  notable: Partial<Stats>;
  /** Deep outer keystone. */
  keystone: { name: string; desc: string; effectId: string; more: Partial<Stats> };
  /** One mastery choice node per lobe. */
  mastery: {
    name: string;
    effectId: string;
    choices: { id: string; label: string; increased?: Partial<Stats>; flat?: Partial<Stats> }[];
  };
}

export const REGION_GROWTH: RegionGrowth[] = [
  {
    region: "brawler",
    travel: [["atk", 0.04], ["critRate", 0.03], ["critDamage", 0.05], ["armorPen", 0.03]],
    notable: { atk: 0.14, critRate: 0.06 },
    keystone: { name: "Warlord's Ruin", desc: "Hits vs full-HP enemies deal ×1.6 damage.", effectId: "gen-brawler-keystone", more: { atk: 0.6 } },
    mastery: { name: "Brawler Focus", effectId: "gen-brawler-mastery", choices: [
      { id: "edge", label: "Edge  +25% Crit Dmg", increased: { critDamage: 0.25 } },
      { id: "rend", label: "Rend  +18% Armor Pen", increased: { armorPen: 0.18 } },
      { id: "might", label: "Might  +15% ATK", increased: { atk: 0.15 } } ] },
  },
  {
    region: "arcane",
    travel: [["skillPower", 0.05], ["magicPen", 0.03], ["manaOnHit" as keyof Stats, 0] as Pair].filter((p) => p[1] !== 0) as Pair[],
    notable: { skillPower: 0.16, magicPen: 0.08 },
    keystone: { name: "Archmage Ascendant", desc: "Every 4th cast deals ×2.5 skill damage.", effectId: "gen-arcane-keystone", more: { skillPower: 1.2 } },
    mastery: { name: "Arcane Focus", effectId: "gen-arcane-mastery", choices: [
      { id: "potency", label: "Potency  +20% Skill Power", increased: { skillPower: 0.2 } },
      { id: "pierce", label: "Pierce  +14% Magic Pen", increased: { magicPen: 0.14 } },
      { id: "siphon", label: "Siphon  +6 Mana/Hit", flat: { manaOnHit: 6 } } ] },
  },
  {
    region: "warden",
    travel: [["maxHp", 0.04], ["armor", 0.05], ["magicResist", 0.05], ["damageReduction", 0.02]],
    notable: { maxHp: 0.16, armor: 0.1 },
    keystone: { name: "Unbreakable", desc: "Take 25% less damage while above 80% HP.", effectId: "gen-warden-keystone", more: { damageReduction: 0.25 } },
    mastery: { name: "Warden Focus", effectId: "gen-warden-mastery", choices: [
      { id: "wall", label: "Wall  +18% Damage Reduction", increased: { damageReduction: 0.18 } },
      { id: "ward", label: "Ward  +22% Magic Resist", increased: { magicResist: 0.22 } },
      { id: "life", label: "Life  +18% Max HP", increased: { maxHp: 0.18 } } ] },
  },
  {
    region: "predator",
    travel: [["critRate", 0.04], ["critDamage", 0.06], ["atk", 0.03], ["armorPen", 0.03]],
    notable: { critRate: 0.1, critDamage: 0.12 },
    keystone: { name: "Apex Hunter", desc: "Crits deal ×1.5 damage and pierce 20% more armor.", effectId: "gen-predator-keystone", more: { critDamage: 0.5 } },
    mastery: { name: "Predator Focus", effectId: "gen-predator-mastery", choices: [
      { id: "lethal", label: "Lethal  +30% Crit Dmg", increased: { critDamage: 0.3 } },
      { id: "keen", label: "Keen  +12% Crit Rate", increased: { critRate: 0.12 } },
      { id: "savage", label: "Savage  +15% Armor Pen", increased: { armorPen: 0.15 } } ] },
  },
  {
    region: "tactician",
    travel: [["goldFind", 0.03], ["skillPower", 0.04], ["manaOnKill" as keyof Stats, 0] as Pair, ["moveSpeed", 0.03]].filter((p) => p[1] !== 0) as Pair[],
    notable: { skillPower: 0.1, goldFind: 0.08 },
    keystone: { name: "Grand Strategist", desc: "Towers near the hero gain +20% attack damage.", effectId: "gen-tactician-keystone", more: { skillPower: 0.4 } },
    mastery: { name: "Tactician Focus", effectId: "gen-tactician-mastery", choices: [
      { id: "command", label: "Command  +16% Skill Power", increased: { skillPower: 0.16 } },
      { id: "fortune", label: "Fortune  +14% Gold Find", increased: { goldFind: 0.14 } },
      { id: "haste", label: "Haste  +10% Move Speed", increased: { moveSpeed: 0.1 } } ] },
  },
  {
    region: "phantom",
    travel: [["moveSpeed", 0.04], ["critRate", 0.03], ["tenacity", 0.03], ["atk", 0.03]],
    notable: { moveSpeed: 0.1, critRate: 0.07 },
    keystone: { name: "Untouchable", desc: "Gain 15% tenacity; the first hit each wave is avoided.", effectId: "gen-phantom-keystone", more: { moveSpeed: 0.3 } },
    mastery: { name: "Phantom Focus", effectId: "gen-phantom-mastery", choices: [
      { id: "swift", label: "Swift  +12% Move Speed", increased: { moveSpeed: 0.12 } },
      { id: "elusive", label: "Elusive  +15% Tenacity", increased: { tenacity: 0.15 } },
      { id: "strike", label: "Strike  +10% Crit Rate", increased: { critRate: 0.1 } } ] },
  },
  {
    region: "conduit",
    travel: [["skillPower", 0.05], ["magicPen", 0.03], ["maxHp", 0.03], ["hpRegen", 0.05]],
    notable: { skillPower: 0.12, magicPen: 0.07 },
    keystone: { name: "Stormbound", desc: "Skill hits chain to 2 extra enemies for 50% damage.", effectId: "gen-conduit-keystone", more: { skillPower: 0.8 } },
    mastery: { name: "Conduit Focus", effectId: "gen-conduit-mastery", choices: [
      { id: "surge", label: "Surge  +18% Skill Power", increased: { skillPower: 0.18 } },
      { id: "flow", label: "Flow  +12% HP Regen", increased: { hpRegen: 0.12 } },
      { id: "spark", label: "Spark  +12% Magic Pen", increased: { magicPen: 0.12 } } ] },
  },
  {
    region: "prestige",
    travel: [["atk", 0.03], ["skillPower", 0.03], ["maxHp", 0.03], ["critDamage", 0.04]],
    notable: { atk: 0.08, skillPower: 0.08, maxHp: 0.08 },
    keystone: { name: "Paragon", desc: "All stats +10%. The crown of any path.", effectId: "gen-prestige-keystone", more: { atk: 0.2, skillPower: 0.2, maxHp: 0.2 } },
    mastery: { name: "Prestige Focus", effectId: "gen-prestige-mastery", choices: [
      { id: "war", label: "War  +12% ATK", increased: { atk: 0.12 } },
      { id: "magi", label: "Magi  +12% Skill Power", increased: { skillPower: 0.12 } },
      { id: "ward", label: "Ward  +12% Max HP", increased: { maxHp: 0.12 } } ] },
  },
];
```

> Note: the two `.filter(...)` lines are a tidy way to drop the placeholder `manaOnHit`/`manaOnKill` zero-entries — they exist only to document intent. Implementers may instead just list the non-zero travel pairs directly. Keep at least 3 travel pairs per region.

- [ ] **Step 2: Commit**

```bash
git add src/data/passiveTreeSpec.ts
git commit -m "feat(passive): per-region growth specs for tree expansion"
```

---

## Task 2: Pure generator + structural tests (TDD)

**Files:**
- Create: `src/data/passiveTreeGen.ts`
- Test: `tests/passiveTreeGen.test.ts`

- [ ] **Step 1: Write failing structural tests**

```ts
// tests/passiveTreeGen.test.ts
import { describe, it, expect } from "vitest";
import { buildExtendedPassiveTree } from "../src/data/passiveTreeGen.ts";
import { PASSIVE_NODES as BASE_HINT } from "../src/data/passiveGrid.ts";

// Build directly from the authored base so the test is independent of wiring order.
import { BASE_NODES } from "../src/data/passiveGrid.ts";

describe("buildExtendedPassiveTree", () => {
  const tree = buildExtendedPassiveTree(BASE_NODES);
  const byId = new Map(tree.map((n) => [n.id, n]));

  it("produces a massive tree (>= 880 nodes)", () => {
    expect(tree.length).toBeGreaterThanOrEqual(880);
  });

  it("keeps every authored node with identical stats", () => {
    for (const b of BASE_NODES) {
      const got = byId.get(b.id);
      expect(got, `missing authored ${b.id}`).toBeTruthy();
      expect(got!.flat).toEqual(b.flat);
      expect(got!.increased).toEqual(b.increased);
      expect(got!.more).toEqual(b.more);
      expect(got!.gridX).toBe(b.gridX);
      expect(got!.gridY).toBe(b.gridY);
    }
  });

  it("generated ids never collide with authored ids", () => {
    const authored = new Set(BASE_NODES.map((n) => n.id));
    const gen = tree.filter((n) => n.id.startsWith("gen-"));
    for (const g of gen) expect(authored.has(g.id)).toBe(false);
    expect(gen.length).toBeGreaterThanOrEqual(800);
  });

  it("all neighbor references resolve and are bidirectional", () => {
    for (const n of tree)
      for (const nb of n.neighbors) {
        const other = byId.get(nb);
        expect(other, `${n.id} -> missing ${nb}`).toBeTruthy();
        expect(other!.neighbors, `${nb} not back-linked to ${n.id}`).toContain(n.id);
      }
  });

  it("no two nodes share a grid cell", () => {
    const seen = new Set<string>();
    for (const n of tree) {
      const key = `${n.gridX},${n.gridY}`;
      expect(seen.has(key), `dup cell ${key} (${n.id})`).toBe(false);
      seen.add(key);
    }
  });

  it("whole graph is connected to grid-start", () => {
    const seen = new Set(["grid-start"]);
    const q = ["grid-start"];
    while (q.length) {
      const cur = byId.get(q.pop()!)!;
      for (const nb of cur.neighbors) if (!seen.has(nb)) { seen.add(nb); q.push(nb); }
    }
    expect(seen.size).toBe(tree.length);
  });

  it("is deterministic (two builds deep-equal)", () => {
    const a = buildExtendedPassiveTree(BASE_NODES);
    const b = buildExtendedPassiveTree(BASE_NODES);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
```

- [ ] **Step 2: Run, expect failure**

Run: `npx vitest run tests/passiveTreeGen.test.ts`
Expected: FAIL — `buildExtendedPassiveTree` / `BASE_NODES` not exported yet.

- [ ] **Step 3: Implement the generator**

```ts
// src/data/passiveTreeGen.ts
// Pure, deterministic builder that EXTENDS the authored passive nodes outward into
// large per-region lobes. Authored nodes are cloned (never mutated in place) so the
// imported BASE array is untouched; anchors gain back-links to their first gen child.
import type { PassiveNodeDef } from "./schema.ts";
import type { PassiveRegion, Stats } from "./schema.ts";
import { validatePassiveNode } from "./schema.ts";
import { Rng } from "../core/rng.ts";
import { CENTER, GEN, REGION_GROWTH, type RegionGrowth } from "./passiveTreeSpec.ts";

function seedFor(region: string): number {
  let h = 2166136261;
  for (let i = 0; i < region.length; i++) h = Math.imul(h ^ region.charCodeAt(i), 16777619);
  return h >>> 0;
}

function dist2(n: { gridX: number; gridY: number }): number {
  const dx = n.gridX - CENTER.x;
  const dy = n.gridY - CENTER.y;
  return dx * dx + dy * dy;
}

/** Farthest authored node of a region = the lobe's anchor + sector direction. */
function anchorFor(base: PassiveNodeDef[], region: PassiveRegion): PassiveNodeDef {
  let best: PassiveNodeDef | null = null;
  for (const n of base)
    if (n.region === region && (!best || dist2(n) > dist2(best))) best = n;
  return best ?? base[0];
}

interface Ctx {
  out: PassiveNodeDef[];
  byId: Map<string, PassiveNodeDef>;
  occupied: Set<string>;
}

function link(a: PassiveNodeDef, b: PassiveNodeDef): void {
  if (!a.neighbors.includes(b.id)) a.neighbors.push(b.id);
  if (!b.neighbors.includes(a.id)) b.neighbors.push(a.id);
}

/** Place at (ring, theta); deterministic spiral nudge to the first free cell. */
function place(ctx: Ctx, ring: number, theta: number): { x: number; y: number } {
  for (let dr = 0; dr <= 6; dr++)
    for (const rs of dr === 0 ? [0] : [dr, -dr])
      for (let dt = 0; dt <= 6; dt++)
        for (const ts of dt === 0 ? [0] : [dt, -dt]) {
          const r = ring + rs;
          const th = theta + ts * 0.06;
          const x = Math.round(CENTER.x + r * Math.cos(th));
          const y = Math.round(CENTER.y + r * Math.sin(th));
          const key = `${x},${y}`;
          if (!ctx.occupied.has(key)) {
            ctx.occupied.add(key);
            return { x, y };
          }
        }
  // Extremely unlikely fallback — push far out radially.
  let r = ring + 8;
  for (;;) {
    const x = Math.round(CENTER.x + r * Math.cos(theta));
    const y = Math.round(CENTER.y + r * Math.sin(theta));
    const key = `${x},${y}`;
    if (!ctx.occupied.has(key)) { ctx.occupied.add(key); return { x, y }; }
    r++;
  }
}

function pathNode(ctx: Ctx, id: string, region: PassiveRegion, cell: { x: number; y: number }, increased: Partial<Stats>): PassiveNodeDef {
  const node: PassiveNodeDef = {
    id, type: "path", region, name: "Path", description: "A step along the path.",
    gridX: cell.x, gridY: cell.y, neighbors: [], increased,
  };
  ctx.out.push(node); ctx.byId.set(id, node);
  return node;
}

function growBranch(ctx: Ctx, spec: RegionGrowth, from: PassiveNodeDef, ring: number, theta: number, rng: Rng, tag: string): void {
  const len = GEN.branchMin + Math.floor(rng.next() * (GEN.branchMax - GEN.branchMin + 1));
  const side = rng.next() < 0.5 ? 1 : -1;
  let prev = from;
  let rr = ring;
  let th = theta + side * GEN.branchAngle;
  for (let j = 0; j < len; j++) {
    rr += rng.next() < 0.5 ? 0 : 1;
    th += side * GEN.angleJitter;
    const cell = place(ctx, rr, th);
    const last = j === len - 1;
    const id = `gen-${spec.region}-${tag}-${j}`;
    let node: PassiveNodeDef;
    if (last) {
      node = {
        id, type: "notable", region: spec.region, name: spec.keystone.name === "" ? "Notable" : "Notable",
        description: "A cluster of focused power.", gridX: cell.x, gridY: cell.y, neighbors: [],
        increased: { ...spec.notable },
      };
      node.name = "Notable";
      ctx.out.push(node); ctx.byId.set(id, node);
    } else {
      const [k, v] = spec.travel[Math.floor(rng.next() * spec.travel.length)];
      node = pathNode(ctx, id, spec.region, cell, { [k]: v } as Partial<Stats>);
    }
    link(prev, node);
    prev = node;
  }
}

function growLobe(ctx: Ctx, base: PassiveNodeDef[], spec: RegionGrowth): void {
  const anchor = ctx.byId.get(anchorFor(base, spec.region).id)!;
  const baseAngle = Math.atan2(anchor.gridY - CENTER.y, anchor.gridX - CENTER.x);
  const rng = new Rng(seedFor(spec.region));
  let prev = anchor;
  let ring = Math.sqrt(dist2(anchor));

  for (let i = 0; i < GEN.spineLen; i++) {
    ring += GEN.ringStep;
    const theta = baseAngle + (rng.next() - 0.5) * 2 * GEN.angleJitter;
    const cell = place(ctx, ring, theta);
    const id = `gen-${spec.region}-s-${i}`;
    let node: PassiveNodeDef;
    if (i === GEN.masteryAt) {
      node = {
        id, type: "mastery", region: spec.region, name: spec.mastery.name,
        description: "Choose one focus.", gridX: cell.x, gridY: cell.y, neighbors: [],
        effectId: spec.mastery.effectId, choices: spec.mastery.choices,
      };
      ctx.out.push(node); ctx.byId.set(id, node);
    } else {
      const [k, v] = spec.travel[Math.floor(rng.next() * spec.travel.length)];
      node = pathNode(ctx, id, spec.region, cell, { [k]: v } as Partial<Stats>);
    }
    link(prev, node);
    prev = node;

    if (i > 0 && i % GEN.branchEvery === 0) growBranch(ctx, spec, node, ring, theta, rng, `b${i}`);
    if (GEN.jewelAt.includes(i)) {
      const jcell = place(ctx, ring, theta + GEN.branchAngle);
      const jid = `gen-${spec.region}-j-${i}`;
      const jewel: PassiveNodeDef = {
        id: jid, type: "jewel-socket", region: spec.region, name: "Jewel Socket",
        description: "Insert a Jewel to empower your hero and towers.",
        gridX: jcell.x, gridY: jcell.y, neighbors: [],
      };
      ctx.out.push(jewel); ctx.byId.set(jid, jewel);
      link(node, jewel);
    }
  }

  // Deep outer keystone — the lobe's capstone.
  ring += GEN.ringStep;
  const kcell = place(ctx, ring, baseAngle);
  const kid = `gen-${spec.region}-K`;
  const keystone: PassiveNodeDef = {
    id: kid, type: "keystone", region: spec.region, name: spec.keystone.name,
    description: spec.keystone.desc, gridX: kcell.x, gridY: kcell.y, neighbors: [],
    effectId: spec.keystone.effectId, more: spec.keystone.more,
  };
  ctx.out.push(keystone); ctx.byId.set(kid, keystone);
  link(prev, keystone);
}

export function buildExtendedPassiveTree(base: PassiveNodeDef[]): PassiveNodeDef[] {
  const clones = base.map((b) => ({ ...b, neighbors: [...b.neighbors] }));
  const ctx: Ctx = {
    out: clones,
    byId: new Map(clones.map((n) => [n.id, n])),
    occupied: new Set(clones.map((n) => `${n.gridX},${n.gridY}`)),
  };
  for (const spec of REGION_GROWTH) growLobe(ctx, clones, spec);
  return ctx.out.map(validatePassiveNode);
}
```

- [ ] **Step 4: Wire `BASE_NODES` export in passiveGrid.ts (minimal, to satisfy the test import)**

In `src/data/passiveGrid.ts`, rename the current `export const PASSIVE_NODES: PassiveNodeDef[] = [ ... ];` literal to `export const BASE_NODES: PassiveNodeDef[] = [ ... ];` and temporarily add below it:

```ts
export const PASSIVE_NODES: PassiveNodeDef[] = BASE_NODES; // replaced in Task 4
```

(Full switch to `buildExtendedPassiveTree` happens in Task 4 so the generator tests can run first.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/passiveTreeGen.test.ts`
Expected: PASS (all 7). If `>= 880` fails, raise `GEN.spineLen` / `branchMax`; if a cell-dup asserts, the spiral nudge already prevents it — investigate only if it fires.

- [ ] **Step 6: Commit**

```bash
git add src/data/passiveTreeGen.ts tests/passiveTreeGen.test.ts src/data/passiveGrid.ts
git commit -m "feat(passive): pure deterministic tree generator (~950 nodes)"
```

---

## Task 3: Commitment + coverage invariants (TDD)

**Files:**
- Test: `tests/passiveTreeGen.test.ts` (append)

- [ ] **Step 1: Append the headline-requirement tests**

```ts
// append to tests/passiveTreeGen.test.ts
import { PASSIVE_NODES } from "../src/data/passiveGrid.ts";

const MAX_POINTS = 100; // 1/level, level cap 100 (hero.ts) — the only point source

function bfsDepth(tree: typeof PASSIVE_NODES, fromId: string): Map<string, number> {
  const byId = new Map(tree.map((n) => [n.id, n]));
  const depth = new Map<string, number>([[fromId, 0]]);
  const q = [fromId];
  while (q.length) {
    const cur = byId.get(q.shift()!)!;
    const d = depth.get(cur.id)!;
    for (const nb of cur.neighbors)
      if (!depth.has(nb)) { depth.set(nb, d + 1); q.push(nb); }
  }
  return depth;
}

describe("passive tree build commitment", () => {
  const tree = buildExtendedPassiveTree(BASE_NODES);
  const depth = bfsDepth(tree, "grid-start");

  // Cheapest # of nodes to allocate to reach a region's deep outer keystone.
  const outerCost = (region: string) =>
    depth.get(`gen-${region}-K`) ?? Infinity; // hops from start == nodes to buy

  const regions = REGION_GROWTH.map((r) => r.region);

  it("reaching one lobe's capstone costs most of the budget (>= 45)", () => {
    for (const r of regions) expect(outerCost(r)).toBeGreaterThanOrEqual(45);
  });

  it("two different lobes' capstones cannot both be afforded at max", () => {
    const costs = regions.map(outerCost).sort((a, b) => a - b);
    expect(costs[0] + costs[1]).toBeGreaterThan(MAX_POINTS);
  });

  it("100 points is less than 1/5 of the tree (headline requirement)", () => {
    expect(MAX_POINTS / PASSIVE_NODES.length).toBeLessThan(0.2);
  });
});
```

(Import `REGION_GROWTH` at the top of the test file: add it to the existing imports —
`import { REGION_GROWTH } from "../src/data/passiveTreeSpec.ts";`.)

- [ ] **Step 2: Run, verify pass (tune if needed)**

Run: `npx vitest run tests/passiveTreeGen.test.ts`
Expected: PASS. If "two lobes" fails (sum ≤ 100), the spine is too short — raise `GEN.spineLen` (e.g. 52→60) in `passiveTreeSpec.ts` and re-run. If "1/5" fails, raise node count the same way. Re-run until green.

- [ ] **Step 3: Commit**

```bash
git add tests/passiveTreeGen.test.ts src/data/passiveTreeSpec.ts
git commit -m "test(passive): commitment + <1/5 coverage invariants (green)"
```

---

## Task 4: Activate the extended tree

**Files:**
- Modify: `src/data/passiveGrid.ts`

- [ ] **Step 1: Replace the temporary alias with the real build**

In `src/data/passiveGrid.ts`, change:

```ts
export const PASSIVE_NODES: PassiveNodeDef[] = BASE_NODES; // replaced in Task 4
```

to:

```ts
import { buildExtendedPassiveTree } from "./passiveTreeGen.ts";

export const PASSIVE_NODES: PassiveNodeDef[] = buildExtendedPassiveTree(BASE_NODES);
```

(Keep `PASSIVE_NODES_MAP`, `getReachableNodes`, `canForgetNode` exactly as they are — they
already derive from `PASSIVE_NODES`.)

- [ ] **Step 2: Verify no runtime import cycle**

Run: `npx madge --circular --extensions ts src/ 2>&1 | tail -3`
Expected: "No circular dependency found" (passiveTreeGen imports schema + rng + spec only;
passiveGrid imports passiveTreeGen — one direction).

- [ ] **Step 3: Run the full suite**

Run: `npx vitest run`
Expected: PASS — existing `passiveChoice`, `heroStatsChoice`, `saveManager`,
`getReachableNodes`, `canForgetNode` tests stay green (authored nodes unchanged; generated
nodes are inert until allocated).

- [ ] **Step 4: Commit**

```bash
git add src/data/passiveGrid.ts
git commit -m "feat(passive): activate ~950-node extended tree"
```

---

## Task 5: Pure pan/zoom camera math (TDD)

**Files:**
- Create: `src/scenes/passiveTreeCamera.ts`
- Test: `tests/passiveTreeCamera.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// tests/passiveTreeCamera.test.ts
import { describe, it, expect } from "vitest";
import { clampZoom, treeBounds, clampScroll, frontierCenter, ZOOM_MIN, ZOOM_MAX } from "../src/scenes/passiveTreeCamera.ts";

const toPixel = (gx: number, gy: number) => ({ x: gx * 28, y: gy * 28 });
const nodes = [
  { id: "a", gridX: 0, gridY: 0 },
  { id: "b", gridX: 10, gridY: 6 },
  { id: "grid-start", gridX: 12, gridY: 9 },
];

describe("passiveTreeCamera", () => {
  it("clamps zoom to [ZOOM_MIN, ZOOM_MAX]", () => {
    expect(clampZoom(99)).toBe(ZOOM_MAX);
    expect(clampZoom(0.01)).toBe(ZOOM_MIN);
    expect(clampZoom(1)).toBe(1);
  });

  it("computes pixel bounds with margin", () => {
    const b = treeBounds(nodes, toPixel, 100);
    expect(b.minX).toBe(0 - 100);
    expect(b.maxX).toBe(12 * 28 + 100);
  });

  it("clamps scroll so the camera stays within bounds", () => {
    const b = treeBounds(nodes, toPixel, 0);
    const s = clampScroll(99999, -99999, b, 800, 540, 1);
    expect(s.scrollX).toBeLessThanOrEqual(b.maxX);
    expect(s.scrollY).toBeGreaterThanOrEqual(b.minY - 540);
  });

  it("frontier center is the centroid of unlocked nodes", () => {
    const c = frontierCenter(nodes, ["a", "b"], toPixel);
    expect(c.x).toBeCloseTo((0 + 10 * 28) / 2);
  });

  it("frontier center falls back to grid-start when nothing unlocked", () => {
    const c = frontierCenter(nodes, [], toPixel);
    expect(c.x).toBe(12 * 28);
    expect(c.y).toBe(9 * 28);
  });
});
```

- [ ] **Step 2: Run, expect failure**

Run: `npx vitest run tests/passiveTreeCamera.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

```ts
// src/scenes/passiveTreeCamera.ts
// Pure helpers for the scrollable/zoomable passive-tree camera. No Phaser imports —
// the scene feeds in node coords + a toPixel fn and applies the results to its camera.
export const ZOOM_MIN = 0.4;
export const ZOOM_MAX = 1.6;

export function clampZoom(z: number): number {
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
}

interface XY { x: number; y: number }
type ToPixel = (gx: number, gy: number) => XY;
interface NodeLite { id: string; gridX: number; gridY: number }
export interface Bounds { minX: number; minY: number; maxX: number; maxY: number }

export function treeBounds(nodes: NodeLite[], toPixel: ToPixel, margin = 120): Bounds {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of nodes) {
    const p = toPixel(n.gridX, n.gridY);
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX: minX - margin, minY: minY - margin, maxX: maxX + margin, maxY: maxY + margin };
}

/** Clamp camera scroll (top-left world coord) so the viewport stays over the tree. */
export function clampScroll(
  scrollX: number, scrollY: number, b: Bounds, viewW: number, viewH: number, zoom: number,
): { scrollX: number; scrollY: number } {
  const vw = viewW / zoom;
  const vh = viewH / zoom;
  const maxX = Math.max(b.minX, b.maxX - vw);
  const maxY = Math.max(b.minY, b.maxY - vh);
  return {
    scrollX: Math.max(b.minX, Math.min(maxX, scrollX)),
    scrollY: Math.max(b.minY, Math.min(maxY, scrollY)),
  };
}

/** Centroid of allocated nodes in pixel space, or grid-start when none allocated. */
export function frontierCenter(nodes: NodeLite[], unlockedIds: string[], toPixel: ToPixel): XY {
  const set = new Set(unlockedIds);
  const picked = nodes.filter((n) => set.has(n.id));
  if (picked.length === 0) {
    const start = nodes.find((n) => n.id === "grid-start") ?? nodes[0];
    return toPixel(start.gridX, start.gridY);
  }
  let sx = 0, sy = 0;
  for (const n of picked) { const p = toPixel(n.gridX, n.gridY); sx += p.x; sy += p.y; }
  return { x: sx / picked.length, y: sy / picked.length };
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npx vitest run tests/passiveTreeCamera.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/scenes/passiveTreeCamera.ts tests/passiveTreeCamera.test.ts
git commit -m "feat(passive): pure pan/zoom camera math"
```

---

## Task 6: Extract the side panel presenter (refactor, no behavior change)

**Files:**
- Create: `src/scenes/passiveGridPanel.ts`
- Modify: `src/scenes/PassiveGridScene.ts`

**Why:** `PassiveGridScene.ts` is already ~545 lines. Adding camera wiring will exceed the
500-line limit, so move the side-panel text objects + `refreshPanel` logic into a presenter.

- [ ] **Step 1: Create `passiveGridPanel.ts`**

Move, verbatim, from `PassiveGridScene.ts`: the panel `Text`/button GameObject creation
(currently in `create()` from `this.panelPoints` through `this.removeBtn`, plus the
`jewelOverlay`/`choicePanel` construction), and the `refreshPanel`, `socketedJewelDef`,
`openSocketPicker`, `confirmRemoveSocket`, `tryUnlock`, `tryForget`, `tryResetAll`,
`disarmReset` methods. Wrap them in:

```ts
// src/scenes/passiveGridPanel.ts
import Phaser from "phaser";
import type { SaveManager } from "../core/saveManager.ts";
import type { PassiveNodeDef } from "../data/schema.ts";
import { canForgetNode } from "../data/passiveGrid.ts";
import { formatStatBonuses } from "./passiveGridFormat.ts";
import { JewelOverlay } from "./jewelOverlay.ts";
import { JEWEL_CATALOG_MAP } from "../data/jewels.ts";
import { OBLIVION_ORB } from "../data/materials.ts";
import { RESPEC_DIAMOND_COST } from "../core/saveManager.ts";
import { MasteryChoicePanel } from "./masteryChoicePanel.ts";

const PANEL_X = 545;
const PANEL_W = 400;

export class PassiveGridPanel {
  // ...all the panel Text/button fields moved from the scene...
  readonly objects: Phaser.GameObjects.GameObject[] = []; // for camera.ignore wiring

  constructor(
    private scene: Phaser.Scene,
    private mgr: SaveManager,
    private getSelected: () => PassiveNodeDef | null,
    private setSelected: (n: PassiveNodeDef | null) => void,
    private redraw: () => void,
  ) {}

  create(): void { /* moved object creation; push each created object into this.objects */ }
  refresh(unlockedSet: Set<string>, reachableSet: Set<string>, heroLevel: number, skillPoints: number): void { /* moved refreshPanel body */ }
  // moved: tryUnlock/tryForget/tryResetAll/disarmReset/openSocketPicker/confirmRemoveSocket/socketedJewelDef
  isModalOpen(): boolean { return this.jewelOverlay.isOpen(); }
}
```

Replace `this.selectedNode` reads inside moved methods with `this.getSelected()` and writes
with `this.setSelected(...)`. Keep `PANEL_X`/`PANEL_W` here; the scene keeps its own copy for
the click-area guard.

- [ ] **Step 2: Slim `PassiveGridScene.ts` to delegate**

The scene keeps: camera/grid drawing (`redraw`, `drawNode`, `toPixel`, color/radius consts),
selection state, and `handleGridClick`. It constructs `this.panel = new PassiveGridPanel(this, this.mgr, () => this.selectedNode, (n) => { this.selectedNode = n; }, () => this.redraw())`,
calls `this.panel.create()` in `create()`, and `this.panel.refresh(...)` at the end of
`redraw()`. The pointer guard uses `this.panel.isModalOpen()`.

- [ ] **Step 3: Verify behavior unchanged**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS / no type errors. (No test asserts panel internals; this is a pure move.)

Run: `npx eslint src/scenes/PassiveGridScene.ts src/scenes/passiveGridPanel.ts`
Expected: 0 errors (both < 500 lines).

- [ ] **Step 4: Commit**

```bash
git add src/scenes/passiveGridPanel.ts src/scenes/PassiveGridScene.ts
git commit -m "refactor(passive): extract side-panel presenter (scene < 500 lines)"
```

---

## Task 7: Wire the pan/zoom tree camera into the scene

**Files:**
- Modify: `src/scenes/PassiveGridScene.ts`

- [ ] **Step 1: Add a fixed UI camera + make the main camera the tree camera**

In `create()`, after building the graphics + panel:

```ts
const { width, height } = this.scale;
// UI camera renders the fixed side panel + back button + title; it ignores the tree.
this.uiCam = this.cameras.add(0, 0, width, height);
this.uiCam.setScroll(0, 0);
this.uiCam.ignore(this.gfx);            // tree graphics live only on the main camera
this.cameras.main.ignore(this.panel.objects); // panel lives only on the UI camera
this.cameras.main.ignore(this.uiOnlyObjects);  // back button + title (collect these)
this.uiCam.ignore(this.treeOnlyObjects);        // (empty for now; gfx already ignored)

// Center on the player's frontier.
const save = this.mgr.getSave();
const c = frontierCenter(PASSIVE_NODES, save.hero.unlockedNodes, (gx, gy) => toPixel(gx, gy));
this.cameras.main.centerOn(c.x, c.y);
this.bounds = treeBounds(PASSIVE_NODES, (gx, gy) => toPixel(gx, gy));
```

Add fields: `private uiCam!: Phaser.Cameras.Scene2D.Camera; private bounds!: Bounds;
private uiOnlyObjects: Phaser.GameObjects.GameObject[] = []; private treeOnlyObjects: Phaser.GameObjects.GameObject[] = [];`
Push the back-button + title Text into `uiOnlyObjects` when created. Import `frontierCenter,
treeBounds, clampZoom, clampScroll, type Bounds` from `./passiveTreeCamera.ts` and
`PASSIVE_NODES` is already imported.

- [ ] **Step 2: Drag-to-pan + tap detection**

Replace the existing `this.input.on("pointerdown", ...)` block with drag-aware handlers:

```ts
import { TAP_SLOP_PX } from "./gesture.ts";
// fields:
private dragging = false;
private dragStart = { x: 0, y: 0, scrollX: 0, scrollY: 0 };
private movedPx = 0;

this.input.on("pointerdown", (ptr: Phaser.Input.Pointer) => {
  if (this.panel.isModalOpen()) return;
  if (ptr.x > PANEL_X) return; // right panel handled by its own buttons
  this.dragging = true;
  this.movedPx = 0;
  this.dragStart = { x: ptr.x, y: ptr.y, scrollX: this.cameras.main.scrollX, scrollY: this.cameras.main.scrollY };
});

this.input.on("pointermove", (ptr: Phaser.Input.Pointer) => {
  if (!this.dragging) return;
  const dx = ptr.x - this.dragStart.x;
  const dy = ptr.y - this.dragStart.y;
  this.movedPx = Math.max(this.movedPx, Math.hypot(dx, dy));
  const zoom = this.cameras.main.zoom;
  const s = clampScroll(
    this.dragStart.scrollX - dx / zoom, this.dragStart.scrollY - dy / zoom,
    this.bounds, this.scale.width, this.scale.height, zoom,
  );
  this.cameras.main.setScroll(s.scrollX, s.scrollY);
});

this.input.on("pointerup", (ptr: Phaser.Input.Pointer) => {
  const wasDrag = this.movedPx > TAP_SLOP_PX;
  this.dragging = false;
  if (this.panel.isModalOpen() || ptr.x > PANEL_X) return;
  if (!wasDrag) {
    const wp = this.cameras.main.getWorldPoint(ptr.x, ptr.y);
    this.handleGridClick(wp.x, wp.y);
  }
});
```

`handleGridClick` already compares against `toPixel(node)` (world pixels) — feeding it the
world point is correct. No change to its body.

- [ ] **Step 3: Wheel zoom + on-screen zoom buttons (mobile)**

```ts
this.input.on("wheel", (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
  const cam = this.cameras.main;
  cam.zoom = clampZoom(cam.zoom * (dy > 0 ? 0.9 : 1.1));
  const s = clampScroll(cam.scrollX, cam.scrollY, this.bounds, this.scale.width, this.scale.height, cam.zoom);
  cam.setScroll(s.scrollX, s.scrollY);
});

// Two zoom buttons in the bottom-left (UI camera only — push into uiOnlyObjects).
const mkZoom = (label: string, x: number, factor: number) => {
  const btn = this.add.text(x, this.scale.height - 34, label, {
    fontSize: "20px", color: "#ffffff", backgroundColor: "#1a5276",
  }).setPadding(10, 4, 10, 4).setInteractive({ useHandCursor: true });
  btn.on("pointerdown", () => {
    const cam = this.cameras.main;
    cam.zoom = clampZoom(cam.zoom * factor);
  });
  this.uiOnlyObjects.push(btn);
};
mkZoom("－", 20, 0.85);
mkZoom("＋", 64, 1.18);
```

(Create the zoom buttons BEFORE the `this.cameras.main.ignore(this.uiOnlyObjects)` line in
Step 1, or move that ignore call to the end of `create()`. Simplest: call all `ignore(...)`
wiring at the very end of `create()` after every object exists.)

- [ ] **Step 4: tsc + lint + full suite**

Run: `npx tsc --noEmit && npx eslint src/scenes/PassiveGridScene.ts && npx vitest run`
Expected: no type errors; 0 lint (scene still < 500 lines — if not, move the `mkZoom` helper
into `passiveGridPanel.ts` or a small `passiveTreeControls.ts`); all tests green.

- [ ] **Step 5: Commit**

```bash
git add src/scenes/PassiveGridScene.ts
git commit -m "feat(passive): pan/zoom tree camera + fixed UI camera"
```

---

## Task 8: Verify whole + live playtest + memory + ship

**Files:**
- Create: `scripts/playtest/repro_passive_tree.mjs`
- Modify: memory files

- [ ] **Step 1: Full verification gate**

Run, expecting all green:
```bash
npx tsc --noEmit
npx vitest run
npx eslint src/ --max-warnings 0
npx madge --circular --extensions ts src/
npm run build
```

- [ ] **Step 2: CDP live playtest**

Write `scripts/playtest/repro_passive_tree.mjs` (model it on the existing
`scripts/playtest/repro_expedition_icons.mjs` CDP harness): start the game, run
`window.__game.scene.start("PassiveGridScene")`, then assert via `Runtime.evaluate`:
- `PASSIVE_NODES.length` is ~950 (read through a tiny debug hook or count rendered nodes ≥ 880),
- the scene has two cameras (`s.cameras.cameras.length >= 2`),
- simulate a wheel/zoom: set `cam.zoom`, read it back within [0.4,1.6],
- pan: set `cam.scrollX`, confirm clamped within bounds,
- screenshot to `/tmp/passive_tree.png`.

Run it with a self-contained `.sh` wrapper (mirror `scripts/playtest/run_attack_speed_cap.sh`:
launch `vite preview` + headless Chrome on 9222, run the mjs, tear down) via Bash with
`dangerouslyDisableSandbox: true`. Expected: `VERDICT: PASS`. Attach the screenshot to chat
with `[[send: /tmp/passive_tree.png]]`.

- [ ] **Step 3: No ASSET_VERSION bump**

Confirm no files under `public/` or generated art changed (`git status`). Nodes are
vector-drawn — no art, so `ASSET_VERSION` stays as-is.

- [ ] **Step 4: Update memory**

Add `memory/project_passive_tree_expansion.md` (the design + generator seam + invariants +
"BASE_NODES preserved, no migration") and a one-line pointer at the top of `memory/MEMORY.md`.
Cross-link `[[project_mastery_choice_pick]]`.

- [ ] **Step 5: Commit, push, deploy**

```bash
git add scripts/playtest/repro_passive_tree.mjs scripts/playtest/run_passive_tree.sh \
        memory/project_passive_tree_expansion.md memory/MEMORY.md
git commit -m "test(passive): CDP repro of ~950-node tree + pan/zoom; memory"
git push
npm run build && npx firebase-tools deploy --only hosting
```

Expected: push succeeds; Firebase "Deploy complete!". Report the live URL.

---

## Self-Review

- **Spec coverage:** ≥880 nodes (T2) ✓; one-path commitment (T3 two-lobe > 100) ✓; <1/5
  coverage (T3) ✓; zero migration / authored preserved (T2 "identical stats") ✓; pan/zoom UI
  (T5–T7) ✓; <500-line files (T6 extraction) ✓; deterministic / no Math.random (T2
  determinism, seeded Rng) ✓; no art / no ASSET_VERSION (T8 step 3) ✓; no stat-pipeline /
  save-schema change (generated nodes are ordinary `PassiveNodeDef`s) ✓.
- **Placeholder scan:** all code blocks concrete; the one "moved verbatim" instruction in T6
  is a mechanical move of named methods, with the wrapper class shown.
- **Type consistency:** `buildExtendedPassiveTree(base)` signature consistent T2/T3/T4;
  `clampZoom/treeBounds/clampScroll/frontierCenter/Bounds` names consistent T5/T7;
  `BASE_NODES`/`PASSIVE_NODES` exports consistent T2→T4; `PassiveGridPanel.objects` used by
  T7 camera-ignore wiring.
- **Risk note:** if T3 "two lobes" or "≥880" fails on first run, the single knob is
  `GEN.spineLen` in `passiveTreeSpec.ts` — raise and re-run (tests are the oracle).
```
