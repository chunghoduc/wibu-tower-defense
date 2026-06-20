/**
 * Hard ceiling on effective attack speed (attacks/second). Towers and the hero
 * can otherwise stack gear/stars/auras into double-digit attack speed, which
 * trivialises combat. The cap is applied to the FINAL effective value (after
 * buffAsPct) at each battle-sim consumption site, just before `cooldown = 1/x`.
 * Pure / Phaser-free.
 */
export const ATTACK_SPEED_CAP = 5; // attacks per second → min cooldown 0.2s

/** Clamp an effective attack speed to the cap. Only reduces; never raises a
 *  value (so the sim's existing `<= 0` guards keep working). */
export function cappedAttackSpeed(raw: number): number {
  return raw > ATTACK_SPEED_CAP ? ATTACK_SPEED_CAP : raw;
}
