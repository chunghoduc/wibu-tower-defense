import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// The ONLY source file allowed to build a "<namespace>__${...}" texture key.
// Every other file must derive keys via src/data/assetKeys.ts so the naming
// convention lives in exactly one place (no per-screen drift).
const ALLOWED = new Set(["src/data/assetKeys.ts"]);
// Registry-owned namespaces. (vfx__ is skillVfx's own VFX namespace, not owned
// by the asset-key registry, so it is deliberately excluded.)
const RE = /`(item|tower|jewel|material|box|skill|menu|fx)__\$\{/;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith(".ts")) out.push(p);
  }
  return out;
}

describe("asset-key discipline", () => {
  it("no source file except assetKeys.ts builds a registry texture key inline", () => {
    const offenders: string[] = [];
    for (const dir of ["src/data", "src/scenes"]) {
      for (const file of walk(dir)) {
        const rel = file.replace(/\\/g, "/");
        if (ALLOWED.has(rel)) continue;
        if (RE.test(readFileSync(file, "utf8"))) offenders.push(rel);
      }
    }
    expect(offenders).toEqual([]);
  });
});
