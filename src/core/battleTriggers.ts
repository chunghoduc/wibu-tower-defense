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
  onHit: [],
  onCrit: [],
  onKill: [],
  onHurt: [],
  onCast: [],
};

export function resolveBattleTriggers(save: HeroSave): BattleTriggers {
  const out: BattleTriggers = { onHit: [], onCrit: [], onKill: [], onHurt: [], onCast: [] };
  for (const def of equippedUniqueDefs(save)) {
    const trig = uniquePowerFor(def)?.trigger;
    if (trig) out[trig.event as TriggerEvent].push(trig);
  }
  return out;
}
