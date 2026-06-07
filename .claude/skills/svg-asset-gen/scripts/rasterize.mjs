// rasterize — turn an SVG string into a transparent PNG using headless Chrome.
//
// This is an OPTIONAL path: most game engines (Phaser's load.svg, CSS, etc.)
// rasterise SVG themselves, so prefer shipping the .svg. Reach for this only
// when a consumer truly needs a baked PNG (sprite atlas tooling, image hosts).
//
// It shells out to a Chrome/Chromium binary in --headless --screenshot mode,
// loading the SVG via a data: URL inside a transparent, exactly-sized page.

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME_CANDIDATES = [
  process.env.CHROME_BIN,
  "google-chrome", "google-chrome-stable", "chromium", "chromium-browser",
].filter(Boolean);

function findChrome() {
  for (const bin of CHROME_CANDIDATES) {
    try { execFileSync(bin, ["--version"], { stdio: "ignore" }); return bin; }
    catch { /* try next */ }
  }
  throw new Error("no Chrome/Chromium found (set CHROME_BIN); SVG output still works without --png");
}

/** Rasterise an SVG string to a PNG Buffer at width×height with transparency. */
export async function rasterize(svg, width, height) {
  const chrome = findChrome();
  const work = mkdtempSync(join(tmpdir(), "svgraster-"));
  try {
    const html =
      `<!doctype html><meta charset="utf-8">` +
      `<style>html,body{margin:0;padding:0;background:transparent}` +
      `svg{display:block}</style>${svg}`;
    const htmlFile = join(work, "page.html");
    const outFile = join(work, "out.png");
    writeFileSync(htmlFile, html);
    execFileSync(chrome, [
      "--headless", "--disable-gpu", "--hide-scrollbars",
      "--default-background-color=00000000",
      `--screenshot=${outFile}`,
      `--window-size=${width},${height}`,
      `--force-device-scale-factor=1`,
      `file://${htmlFile}`,
    ], { stdio: "ignore" });
    return readFileSync(outFile);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}
