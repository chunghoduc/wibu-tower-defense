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
    {
      event: "onCast",
      chance: 1,
      kind: "cinder",
      type: "Magic",
      atkFrac: 0.3,
      radius: 80,
      seconds: 3,
    },
    `On cast: leave a burning field that scorches enemies for 3s`,
  ),
};
