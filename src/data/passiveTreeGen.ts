// Pure, deterministic builder that EXTENDS the authored passive nodes outward into
// large per-region lobes. Authored nodes are cloned (never mutated in place) so the
// imported BASE array is untouched; anchors gain back-links to their first gen child.
import type { PassiveNodeDef, PassiveRegion, Stats } from "./schema.ts";
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
  for (const n of base) if (n.region === region && (!best || dist2(n) > dist2(best))) best = n;
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
  // Extremely unlikely fallback — push far out radially until a cell is free.
  let r = ring + 8;
  for (;;) {
    const x = Math.round(CENTER.x + r * Math.cos(theta));
    const y = Math.round(CENTER.y + r * Math.sin(theta));
    const key = `${x},${y}`;
    if (!ctx.occupied.has(key)) {
      ctx.occupied.add(key);
      return { x, y };
    }
    r++;
  }
}

function pathNode(
  ctx: Ctx,
  id: string,
  region: PassiveRegion,
  cell: { x: number; y: number },
  increased: Partial<Stats>,
): PassiveNodeDef {
  const node: PassiveNodeDef = {
    id,
    type: "path",
    region,
    name: "Path",
    description: "A step along the path.",
    gridX: cell.x,
    gridY: cell.y,
    neighbors: [],
    increased,
  };
  ctx.out.push(node);
  ctx.byId.set(id, node);
  return node;
}

function growBranch(
  ctx: Ctx,
  spec: RegionGrowth,
  from: PassiveNodeDef,
  ring: number,
  theta: number,
  rng: Rng,
  tag: string,
): void {
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
        id,
        type: "notable",
        region: spec.region,
        name: "Notable",
        description: "A cluster of focused power.",
        gridX: cell.x,
        gridY: cell.y,
        neighbors: [],
        increased: { ...spec.notable },
      };
      ctx.out.push(node);
      ctx.byId.set(id, node);
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
        id,
        type: "mastery",
        region: spec.region,
        name: spec.mastery.name,
        description: "Choose one focus.",
        gridX: cell.x,
        gridY: cell.y,
        neighbors: [],
        effectId: spec.mastery.effectId,
        choices: spec.mastery.choices,
      };
      ctx.out.push(node);
      ctx.byId.set(id, node);
    } else {
      const [k, v] = spec.travel[Math.floor(rng.next() * spec.travel.length)];
      node = pathNode(ctx, id, spec.region, cell, { [k]: v } as Partial<Stats>);
    }
    link(prev, node);
    prev = node;

    if (i > 0 && i % GEN.branchEvery === 0) growBranch(ctx, spec, node, ring, theta, rng, `b${i}`);
    if ((GEN.jewelAt as readonly number[]).includes(i)) {
      const jcell = place(ctx, ring, theta + GEN.branchAngle);
      const jid = `gen-${spec.region}-j-${i}`;
      const jewel: PassiveNodeDef = {
        id: jid,
        type: "jewel-socket",
        region: spec.region,
        name: "Jewel Socket",
        description: "Insert a Jewel to empower your hero and towers.",
        gridX: jcell.x,
        gridY: jcell.y,
        neighbors: [],
      };
      ctx.out.push(jewel);
      ctx.byId.set(jid, jewel);
      link(node, jewel);
    }
  }

  // Deep outer keystone — the lobe's capstone.
  ring += GEN.ringStep;
  const kcell = place(ctx, ring, baseAngle);
  const kid = `gen-${spec.region}-K`;
  const keystone: PassiveNodeDef = {
    id: kid,
    type: "keystone",
    region: spec.region,
    name: spec.keystone.name,
    description: spec.keystone.desc,
    gridX: kcell.x,
    gridY: kcell.y,
    neighbors: [],
    effectId: spec.keystone.effectId,
    more: spec.keystone.more,
  };
  ctx.out.push(keystone);
  ctx.byId.set(kid, keystone);
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
