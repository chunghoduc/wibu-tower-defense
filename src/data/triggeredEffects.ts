// src/data/triggeredEffects.ts
//
// Triggered effects — the BEHAVIOUR half of a Unique item. Where a UniquePower's
// `contribution` adds passive stats (the "affix"), a triggered effect makes the
// item *do* something at a combat event. Pure/declarative so the catalog is
// unit-testable; the battle sim (core/battleTriggerFx.ts) interprets each kind
// with its own primitives (applySplash/applyStun/addDot/applySlow/healHero/…).
//
// Each Unique INSTANCE rolls one of these from a pool suitable for the item (see
// data/uniqueTriggers.ts), seeded by the instance id — so two copies of the same
// Unique can behave differently.
import type { DamageType } from "./schema.ts";

export type TriggerEvent = "onHit" | "onCrit" | "onKill" | "onHurt" | "onCast";

export type TriggerKind =
  | "execute" // onHit: instakill a non-boss — by chance, or guaranteed below hpFrac
  | "blast" // splash AoE around the target/corpse
  | "chain" // lightning to the N nearest foes
  | "freeze" // stun the target for `seconds`
  | "slow" // heavily slow the target (time dilation)
  | "poison" // DoT scaling with the source's attack
  | "bleed" // onCrit: a heavy physical DoT
  | "heal" // hero heals (dmgFrac of damage dealt, or hpFrac of max)
  | "overkill" // onKill: heal the hero by a fraction of OVERKILL damage
  | "gold" // onKill: burst bonus gold
  | "contagion" // onKill: copy the victim's DoTs onto nearby foes
  | "frostnova" // onKill: freeze enemies around the corpse
  | "pyre" // onKill: ignite enemies around the corpse
  | "reflect" // onHurt: frac of incoming back to the attacker
  | "riposte" // onHurt: hero counter-attacks the attacker
  | "glaciate" // onHurt: freeze the attacker that struck the hero
  | "painnova" // onHurt: blast enemies around the hero
  | "frostguard" // onHurt: chill ALL nearby foes (slow aura) when struck
  | "aegisthorns" // onHurt: retaliate for a fraction of the hero's MAX HP (less vs bosses)
  | "secondwind" // onHurt: heal a chunk of max HP when struck below a low-HP threshold
  | "undying" // onHurt(lethal): once per battle, survive a fatal blow at a HP floor
  | "echo" // onCast: re-apply the burst once
  | "cinder" // onCast: burning field (DoT) on enemies in radius
  | "castnova"; // onCast: freeze enemies in the cast radius

export interface TriggeredEffect {
  event: TriggerEvent;
  chance: number; // 0..1 ; 1 = guaranteed (the sim skips the RNG roll)
  kind: TriggerKind;
  type?: DamageType; // damage type for blast/chain/reflect/poison/bleed/pyre/painnova (default Magic)
  hpFrac?: number; // execute threshold / heal % maxHp / blast % victim maxHp
  atkFrac?: number; // damage as a fraction of source atk (poison/bleed/pyre/painnova/blast/chain)
  dmgFrac?: number; // fraction of damage dealt (heal) / taken (reflect) / overkill (overkill)
  slowPct?: number; // slow magnitude 0..1 (slow)
  radius?: number; // blast / cinder / contagion / nova / pyre radius (world units)
  targets?: number; // chain bounce count
  falloff?: number; // chain damage falloff per bounce
  seconds?: number; // freeze / slow / poison / bleed / cinder / nova duration
  threshold?: number; // low-HP trigger gate as a fraction of max HP (secondwind)
  describe(): string;
}

const pct = (v: number) => `${Math.round(v * 100)}%`;
/** ATK-scaled damage shown as an explicit multiplier, e.g. "×0.6 ATK" — so the
 *  player can read a damaging proc's magnitude straight off the tooltip. */
const atkx = (v: number) => `×${v} ATK`;
const mk = (e: Omit<TriggeredEffect, "describe">, text: string): TriggeredEffect => ({
  ...e,
  describe: () => text,
});

/** The catalog. Keys are referenced by data/uniqueTriggers.ts. Numbers are
 *  starting points — on-hit/on-crit procs fire from EVERY player attack (towers +
 *  hero) and are further scaled by a per-attacker proc coefficient, so keep low. */
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
    // chain seeds at ×1 ATK then falls off ×0.6 per jump → first arc lands ×0.6.
    `On hit: ${pct(0.15)} chance to arc lightning through 3 nearby foes for ${atkx(0.6)} each (fading per jump)`,
  ),
  permafrost: mk(
    { event: "onHit", chance: 0.12, kind: "freeze", seconds: 0.6 },
    `On hit: ${pct(0.12)} chance to freeze the target for 0.6s`,
  ),
  timewarp: mk(
    { event: "onHit", chance: 0.2, kind: "slow", slowPct: 0.6, seconds: 1.5 },
    `On hit: ${pct(0.2)} chance to warp time, slowing the target ${pct(0.6)} for 1.5s`,
  ),
  venomstrike: mk(
    { event: "onHit", chance: 0.25, kind: "poison", type: "Magic", atkFrac: 0.4, seconds: 3 },
    `On hit: ${pct(0.25)} chance to poison for ${atkx(0.4)}/s over 3s`,
  ),
  soulrend: mk(
    { event: "onHit", chance: 0.15, kind: "heal", dmgFrac: 0.5 },
    `On hit: ${pct(0.15)} chance to heal the hero for ${pct(0.5)} of damage dealt`,
  ),
  // — onCrit —
  shatterblow: mk(
    { event: "onCrit", chance: 1, kind: "blast", type: "Physical", atkFrac: 0.6, radius: 70 },
    `On critical hit: detonate a blast for ${atkx(0.6)} around the target`,
  ),
  deepwound: mk(
    { event: "onCrit", chance: 1, kind: "bleed", type: "Physical", atkFrac: 0.5, seconds: 4 },
    `On critical hit: inflict a deep wound bleeding for ${atkx(0.5)}/s over 4s`,
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
  overkiller: mk(
    { event: "onKill", chance: 1, kind: "overkill", dmgFrac: 0.3 },
    `On kill: heal the hero for ${pct(0.3)} of any OVERKILL damage`,
  ),
  goldfinger: mk(
    { event: "onKill", chance: 0.2, kind: "gold", dmgFrac: 1 },
    `On kill: ${pct(0.2)} chance to drop bonus gold`,
  ),
  contagion: mk(
    { event: "onKill", chance: 1, kind: "contagion", radius: 90 },
    `On kill: spread the victim's burns & poisons to nearby foes`,
  ),
  frostnova: mk(
    { event: "onKill", chance: 1, kind: "frostnova", radius: 90, seconds: 0.8 },
    `On kill: a frost nova freezes nearby foes for 0.8s`,
  ),
  pyreburst: mk(
    {
      event: "onKill",
      chance: 1,
      kind: "pyre",
      type: "Magic",
      atkFrac: 0.3,
      radius: 90,
      seconds: 3,
    },
    `On kill: ignite nearby foes, burning them for ${atkx(0.3)}/s over 3s`,
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
  glaciate: mk(
    { event: "onHurt", chance: 0.3, kind: "glaciate", seconds: 1 },
    `When struck: ${pct(0.3)} chance to freeze the attacker for 1s`,
  ),
  painnova: mk(
    { event: "onHurt", chance: 1, kind: "painnova", type: "Physical", atkFrac: 0.6, radius: 80 },
    `When struck: erupt a nova for ${atkx(0.6)} around the hero`,
  ),
  frostguard: mk(
    { event: "onHurt", chance: 1, kind: "frostguard", slowPct: 0.4, seconds: 2, radius: 90 },
    `When struck: a frost ward chills nearby foes, slowing them ${pct(0.4)} for 2s`,
  ),
  aegisthorns: mk(
    { event: "onHurt", chance: 1, kind: "aegisthorns", type: "Physical", hpFrac: 0.06 },
    `When struck: retaliate for ${pct(0.06)} of your max health (reduced vs bosses)`,
  ),
  secondwind: mk(
    { event: "onHurt", chance: 1, kind: "secondwind", hpFrac: 0.12, threshold: 0.35 },
    `When struck below ${pct(0.35)} health: recover ${pct(0.12)} of your max health`,
  ),
  undying: mk(
    { event: "onHurt", chance: 1, kind: "undying", hpFrac: 0.25 },
    `Once per battle: survive a fatal blow, recovering to ${pct(0.25)} health`,
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
    `On cast: leave a burning field that scorches enemies for ${atkx(0.3)}/s over 3s`,
  ),
  castfrost: mk(
    { event: "onCast", chance: 1, kind: "castnova", radius: 80, seconds: 0.8 },
    `On cast: freeze every enemy caught in the blast for 0.8s`,
  ),
};
