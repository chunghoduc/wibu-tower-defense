// src/data/assetVersion.ts
//
// Cache-busting for GENERATED runtime assets (sprite sheets, backgrounds, UI
// art, audio) that are served under STABLE filenames. The JS bundle is
// content-hashed by Vite, so a fresh manifest always loads — but the PNGs keep
// their name, and Firebase hosting marks them `immutable` for a year. After an
// art regen a returning player would otherwise pair the NEW manifest with their
// STALE cached PNG, slicing the old image against new frame geometry → broken
// sprite animation. Appending `?v=<ASSET_VERSION>` makes the URL change with the
// content, so a poisoned `immutable` cache is bypassed (different cache key).
//
// BUMP `ASSET_VERSION` whenever generated art/audio is regenerated and
// redeployed. Any new token forces every client to refetch the assets once.
// Pure / Phaser-free.

/** Cache-bust token appended to generated-asset URLs. Bump on art redeploys. */
export const ASSET_VERSION = "2026-06-20b";

/**
 * Append the cache-bust query to a generated-asset path. No-ops for absolute
 * URLs (data:/http(s)) and for paths already carrying the current `v=` stamp, so
 * it is safe to wrap a URL more than once.
 */
export function versioned(path: string): string {
  if (/^(data:|https?:)/.test(path)) return path;
  const stamp = `v=${ASSET_VERSION}`;
  if (path.includes(stamp)) return path;
  return path + (path.includes("?") ? "&" : "?") + stamp;
}
