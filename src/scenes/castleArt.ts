// Pure, Phaser-free castle HP → art-state mapping. The render layer consumes
// this to decide which structure texture to show; unit-tested in isolation.
import { CASTLE_TEX, CASTLE_DAMAGED_TEX } from "../data/assetKeys.ts";

export type CastleState = "intact" | "damaged";

/** Castle shows its battle-damaged art once it drops to half health or below. */
export function castleArtState(hp: number, maxHp: number): CastleState {
  if (maxHp <= 0) return "intact"; // degenerate guard — no fraction to read
  return hp / maxHp <= 0.5 ? "damaged" : "intact";
}

/** The structure texture key for a given castle state. */
export function castleTexForState(state: CastleState): string {
  return state === "damaged" ? CASTLE_DAMAGED_TEX : CASTLE_TEX;
}
