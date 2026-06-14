/**
 * Pure CSS for the DOM loading splash (#loading-splash) backdrop. Layers a dark
 * top-to-bottom gradient OVER the painted key-art image so the gold title and
 * progress bar stay legible. Phaser-free; consumed by main.ts at boot.
 */

/** `background` shorthand: dark readability gradient over a cover-fit image. */
export function loadingSplashBackground(url: string): string {
  return (
    `linear-gradient(rgba(5, 7, 12, 0.55), rgba(5, 7, 12, 0.78)), ` +
    `url("${url}") center / cover no-repeat`
  );
}
