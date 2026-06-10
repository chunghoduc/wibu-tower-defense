// Mobile web: present the game in landscape, fullscreen.
//
// The game canvas is authored at 960×540 (16:9). On a phone held portrait the
// FIT scaler letterboxes it down to a useless strip, so on mobile we:
//   1. Go fullscreen + lock to landscape on the first user gesture (browsers
//      forbid both outside a gesture, and orientation.lock() only works once
//      we're fullscreen on Android Chrome).
//   2. Show a "rotate your device" overlay whenever the phone is still portrait
//      (iOS Safari can't lock orientation at all, so the prompt is the fallback).

import type Phaser from "phaser";

function isMobile(): boolean {
  // Coarse pointer covers phones/tablets; the UA sniff catches the rest.
  return (
    window.matchMedia?.("(pointer: coarse)").matches ||
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
  );
}

function isPortrait(): boolean {
  return window.innerHeight > window.innerWidth;
}

async function goLandscapeFullscreen(game: Phaser.Game): Promise<void> {
  // Fullscreen first — orientation lock is only permitted while fullscreen.
  try {
    if (!game.scale.isFullscreen) game.scale.startFullscreen();
  } catch {
    /* user can decline; ignore */
  }
  // Lock to landscape. Unsupported on iOS Safari (rejects) — the overlay covers it.
  const orientation = screen.orientation as
    | (ScreenOrientation & { lock?: (o: string) => Promise<void> })
    | undefined;
  try {
    await orientation?.lock?.("landscape");
  } catch {
    /* not supported / not allowed — fall back to the rotate prompt */
  }
}

function makeRotateOverlay(): HTMLDivElement {
  const el = document.createElement("div");
  el.id = "rotate-overlay";
  el.innerHTML =
    '<div class="rotate-icon">⟳</div>' +
    "<div class=\"rotate-text\">Rotate your device<br><span>Play in landscape</span></div>";
  const style = document.createElement("style");
  style.textContent = `
    #rotate-overlay {
      position: fixed; inset: 0; z-index: 9999;
      display: none; flex-direction: column;
      align-items: center; justify-content: center; gap: 18px;
      background: #0d0f14; color: #e7ecf3;
      font-family: system-ui, sans-serif; text-align: center;
      -webkit-user-select: none; user-select: none;
    }
    #rotate-overlay .rotate-icon {
      font-size: 64px; line-height: 1;
      animation: rotate-spin 2.4s ease-in-out infinite;
    }
    #rotate-overlay .rotate-text { font-size: 20px; font-weight: 600; }
    #rotate-overlay .rotate-text span { font-size: 14px; font-weight: 400; opacity: 0.6; }
    @keyframes rotate-spin {
      0%, 100% { transform: rotate(0deg); }
      50% { transform: rotate(90deg); }
    }
  `;
  document.head.appendChild(style);
  document.body.appendChild(el);
  return el;
}

export function installMobileLandscape(game: Phaser.Game): void {
  if (!isMobile()) return;

  const overlay = makeRotateOverlay();
  const sync = () => {
    overlay.style.display = isPortrait() ? "flex" : "none";
  };

  // First gesture anywhere: enter fullscreen + lock landscape (browsers forbid
  // both outside a user gesture). This must fire ONCE per arming, not on every
  // tap — otherwise orientation.lock() is re-invoked on each touch all session,
  // and rapid repeat calls reject/abort one another on Android. The handler
  // removes itself; we re-arm only when the browser later drops fullscreen so a
  // subsequent tap can restore it.
  const onGesture = () => {
    window.removeEventListener("pointerdown", onGesture);
    window.removeEventListener("touchstart", onGesture);
    void goLandscapeFullscreen(game);
  };
  const arm = () => {
    window.addEventListener("pointerdown", onGesture, { passive: true });
    window.addEventListener("touchstart", onGesture, { passive: true });
  };
  arm();
  game.scale.on("leavefullscreen", arm);

  window.addEventListener("resize", sync);
  window.addEventListener("orientationchange", sync);
  screen.orientation?.addEventListener?.("change", sync);
  sync();
}
