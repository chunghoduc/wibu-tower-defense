/**
 * Pure resolution of "choose one" passive nodes. A node with `choices` carries
 * its stats inside the options; the player's pick (stored in save.hero.nodeChoices)
 * selects which option's stats apply. `effectiveNode` is the single seam the stat
 * pipeline consumes — it returns a node whose flat/increased/more reflect the pick,
 * falling back to the first option when nothing valid is recorded.
 */
import type { PassiveChoiceOption, PassiveNodeDef } from "../data/schema.ts";

/** The chosen option for a choice node, or null (not a choice node / unrecorded). */
export function selectedChoice(
  node: PassiveNodeDef,
  nodeChoices: Record<string, string>,
): PassiveChoiceOption | null {
  if (!node.choices || node.choices.length === 0) return null;
  const id = nodeChoices[node.id];
  if (id === undefined) return null;
  return node.choices.find((c) => c.id === id) ?? null;
}

/**
 * A node whose flat/increased/more reflect the chosen option. Non-choice nodes are
 * returned unchanged (same reference). For a choice node, falls back to the first
 * option when the recorded pick is missing or unknown.
 */
export function effectiveNode(
  node: PassiveNodeDef,
  nodeChoices: Record<string, string>,
): PassiveNodeDef {
  if (!node.choices || node.choices.length === 0) return node;
  const option = selectedChoice(node, nodeChoices) ?? node.choices[0];
  return {
    ...node,
    flat: option.flat,
    increased: option.increased,
    more: option.more,
  };
}
