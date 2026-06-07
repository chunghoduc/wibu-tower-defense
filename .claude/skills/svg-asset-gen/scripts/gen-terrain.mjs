#!/usr/bin/env node
// gen-terrain — write terrain SVG variants to an output directory.
//
// Usage:
//   node gen-terrain.mjs --out <dir> [--variants N] [--size PX] [--types a,b,c]
//                        [--png] [--manifest <file.json>]
//
//   --out       destination directory (created if missing)            [required]
//   --variants  how many seeded variants per type (default 3)
//   --size      square viewport size in px (default 128)
//   --types     comma list to restrict output (default: all)
//   --png       also rasterise each SVG to PNG via headless chrome (optional;
//               only needed when the consumer can't render SVG itself — Phaser's
//               load.svg() rasterises in-browser, so the game does NOT need this)
//   --manifest  also write a JSON index of {key,type,variant,svg[,png]} files
//
// Output files are named "<type>-<variant>.svg" so consumers can address them by
// a stable convention without parsing the manifest.

import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { TERRAIN_TYPES, terrainSVG } from "./terrain.mjs";
import { rasterize } from "./rasterize.mjs";

// Supports both "--name=value" and "--name value"; a bare "--name" not followed
// by a value (or followed by another flag) is treated as a boolean flag.
const argv = process.argv.slice(2);
const arg = (n, d) => {
  const i = argv.findIndex((a) => a === `--${n}` || a.startsWith(`--${n}=`));
  if (i === -1) return d;
  const a = argv[i];
  if (a.includes("=")) return a.split("=").slice(1).join("=");
  const next = argv[i + 1];
  if (next != null && !next.startsWith("--")) return next;
  return true; // boolean flag
};

const outDir = arg("out");
if (typeof outDir !== "string") { console.error("error: --out <dir> is required"); process.exit(1); }
const num = (name, d) => {
  const v = arg(name, d);
  const n = Number(v);
  if (v === true || !Number.isFinite(n)) { console.error(`error: --${name} needs a number`); process.exit(1); }
  return n;
};
const variants = num("variants", 3);
const size = num("size", 128);
const wantPng = Boolean(arg("png", false));
const manifestPath = arg("manifest", null);
const types = (arg("types", null) ? String(arg("types")).split(",") : TERRAIN_TYPES)
  .map((t) => t.trim()).filter(Boolean);

const dir = resolve(outDir);
mkdirSync(dir, { recursive: true });

const manifest = [];
for (const type of types) {
  for (let v = 1; v <= variants; v++) {
    const svg = terrainSVG(type, { seed: v, size });
    const name = `${type}-${v}`;
    const svgFile = join(dir, `${name}.svg`);
    writeFileSync(svgFile, svg);
    const entry = { key: `terrain__${type}_${v}`, type, variant: v, svg: `${name}.svg` };
    if (wantPng) {
      const png = await rasterize(svg, size, size);
      const pngFile = join(dir, `${name}.png`);
      writeFileSync(pngFile, png);
      entry.png = `${name}.png`;
    }
    manifest.push(entry);
    console.log(`${name}${wantPng ? " (+png)" : ""}`);
  }
}

if (manifestPath) {
  writeFileSync(resolve(manifestPath), JSON.stringify(manifest, null, 2));
  console.log(`manifest: ${manifest.length} entries -> ${manifestPath}`);
}
console.log(`done: ${manifest.length} svg${wantPng ? "+png" : ""} in ${dir}`);
