// Pure helpers for the tower combat-stance swap. A tower shows its single-frame
// __attack pose while "engaged" (recently attacked), then relaxes to its idle
// sprite. Phaser-free and tested; the presenter (battleSceneSprites) does the
// texture swap and feeds these numbers into setScale/setOrigin.

/** How long after the last attack a tower keeps its combat stance (ms). */
export const ENGAGED_MS = 1100;
/** Battlefield display height (px) a tower body targets — mirrors manageSprites. */
export const TOWER_DISPLAY_H = 50;
/** Per-upgrade-level scale growth — mirrors animateTower's (1 + 0.05*level). */
export const LEVEL_GROWTH = 0.05;
/**
 * The pose art fills a smaller fraction of its 320 canvas than the idle body
 * fills its 192 canvas, so the posed body is scaled up to match idle body size.
 */
export const POSE_FILL_BOOST = 1.18;
/** Idle sprite anchor (mirrors ensureSprite's 0.78). */
export const IDLE_ORIGIN_Y = 0.78;
/** Posed sprite anchor — feet sit lower in the taller pose frame. */
export const POSE_ORIGIN_Y = 0.86;

/** True while the tower is still in its post-attack combat-stance window. */
export function isEngaged(engagedUntil: number, now: number): boolean {
  return engagedUntil > now;
}

/** Scale to apply to a sprite of frame height `frameH`, given upgrade level + posed. */
export function towerDisplayScale(frameH: number, level: number, posed: boolean): number {
  const target = TOWER_DISPLAY_H * (posed ? POSE_FILL_BOOST : 1);
  return (target / frameH) * (1 + LEVEL_GROWTH * level);
}
