import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Guard: stable-named generated media (sprites, backgrounds, audio) must NOT be
// served with `immutable`, or a regenerated asset re-deployed under the same
// filename is pinned in returning players' caches and breaks against the fresh
// manifest. Content-hashed build output (js/css/woff2) may stay immutable.
// Root cause + fix: docs/superpowers/specs/2026-06-12-asset-cache-busting-design.md

const cfg = JSON.parse(
  readFileSync(fileURLToPath(new URL("../firebase.json", import.meta.url)), "utf8"),
);

const MEDIA_EXTS = ["png", "jpg", "jpeg", "gif", "svg", "webp", "mp3", "ogg", "wav"];

const headers: Array<{ source: string; headers: Array<{ key: string; value: string }> }> =
  cfg.hosting.headers;

const cacheControlFor = (source: string): string | undefined =>
  headers
    .find((h) => h.source === source)
    ?.headers.find((x) => x.key.toLowerCase() === "cache-control")?.value;

describe("firebase hosting cache policy", () => {
  it("never marks a stable-named media glob as immutable", () => {
    for (const h of headers) {
      const cc = h.headers.find((x) => x.key.toLowerCase() === "cache-control")?.value ?? "";
      const matchesMedia = MEDIA_EXTS.some((e) => h.source.includes(e));
      if (matchesMedia) {
        expect(cc, `media glob "${h.source}" must revalidate`).not.toMatch(/immutable/);
        expect(cc).toMatch(/must-revalidate/);
      }
    }
  });

  it("keeps content-hashed build output cacheable long-term", () => {
    const cc = cacheControlFor("**/*.@(js|css|woff2)");
    expect(cc).toMatch(/immutable/);
    expect(cc).toMatch(/max-age=31536000/);
  });

  it("serves index.html with no-cache so new bundle hashes are seen", () => {
    expect(cacheControlFor("/index.html")).toMatch(/no-cache/);
  });
});
