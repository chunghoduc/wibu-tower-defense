/**
 * boxOpenTimings — the single source of truth for the box-open reveal sequence's
 * timing (pure, no Phaser, so it's unit-testable). The overlay presenter drives
 * its delayedCalls and tween delays off these numbers.
 *
 * The key invariant: tap-to-close is armed only once EVERY reward tile has
 * finished revealing (armCloseMs >= lastTileEndMs). The old overlay armed close
 * at a fixed 1050ms — earlier than the staggered reveal finishes — so a tap in
 * that gap dismissed the chest before the player ever saw the loot.
 */
export const BOX_POP_MS = 640; // chest bursts (flash + sparkles)
export const BOX_REVEAL_MS = 1000; // reward tiles begin staggering in
export const TILE_STAGGER_MS = 110; // delay between consecutive tile reveals
export const TILE_TWEEN_MS = 280; // a single tile's pop-in duration
export const HINT_DELAY_MS = 200; // "tap to continue" appears after the tiles
export const HINT_FADE_MS = 400; // hint fade-in duration

export interface BoxOpenTimings {
  /** When the chest bursts. */
  popMs: number;
  /** When reward tiles start revealing. */
  revealMs: number;
  /** When the last reward tile has fully settled. */
  lastTileEndMs: number;
  /** When the "tap to continue" hint begins fading in. */
  hintStartMs: number;
  /** When tap-to-close becomes active (never before every tile is shown). */
  armCloseMs: number;
}

export function boxOpenTimings(entryCount: number): BoxOpenTimings {
  const n = Math.max(1, entryCount); // always at least the gold tile
  const lastTileEndMs = BOX_REVEAL_MS + (n - 1) * TILE_STAGGER_MS + TILE_TWEEN_MS;
  const hintStartMs = BOX_REVEAL_MS + n * TILE_STAGGER_MS + HINT_DELAY_MS;
  // Arm close at the later of "hint shows" and "last tile settled" so the loot
  // is always fully on screen — and dismissible — before a tap can close it.
  const armCloseMs = Math.max(hintStartMs, lastTileEndMs);
  return { popMs: BOX_POP_MS, revealMs: BOX_REVEAL_MS, lastTileEndMs, hintStartMs, armCloseMs };
}
