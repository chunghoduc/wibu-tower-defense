/**
 * Generate base sprites via local Ollama. Resumable; skips existing PNGs.
 *
 *   npm run gen:sprites -- --id=tower__zoran-thricedraw   # one sprite (smoke)
 *   npm run gen:sprites -- --only=item                    # all items
 *   npm run gen:sprites                                   # everything missing
 *   npm run gen:sprites -- --force --model=gemma4:latest
 */
import { mkdirSync, existsSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { allArtPrompts } from "../src/data/artPrompts.ts";
import { spriteKey, spritePath, type ArtKind } from "../src/data/artSpec.ts";
import { TOWERS } from "../src/data/towers.ts";
import { ENEMIES } from "../src/data/enemies.ts";
import { ITEM_CATALOG } from "../src/data/items.ts";
import { paletteFor, type Rgba } from "../src/art/palette.ts";
import { buildGridPrompt } from "../src/art/gridPrompt.ts";
import { generate } from "../src/art/ollamaClient.ts";
import { encodePng } from "../src/art/pngEncoder.ts";
import {
  parseGridLines, sanitizeGrid, mirrorHorizontal, validateGrid, type SpriteGrid,
} from "../src/art/spriteGrid.ts";
import type { Rarity } from "../src/data/schema.ts";

// Generation grid sizes (small for coherence; render upscales).
const GEN_DIMS: Record<ArtKind, { w: number; h: number }> = {
  tower: { w: 16, h: 16 },
  hero: { w: 16, h: 16 },
  enemy: { w: 16, h: 16 },
  boss: { w: 24, h: 24 },
  item: { w: 12, h: 12 },
};
const MIRROR_KINDS = new Set<ArtKind>(["tower", "hero", "enemy", "boss"]);

interface Job {
  key: string;
  path: string; // public-relative
  kind: ArtKind;
  rarity: Rarity;
  subject: string;
}

function buildJobs(): Job[] {
  const jobs: Job[] = [];
  const rarityByTower = new Map(TOWERS.map((t) => [t.id, t.rarity]));
  const rarityByItem = new Map(ITEM_CATALOG.map((i) => [i.id, i.rarity]));

  for (const e of allArtPrompts()) {
    const [kind, id] = e.key.split("__") as [ArtKind, string];
    let rarity: Rarity = "Common";
    if (kind === "tower") rarity = rarityByTower.get(id) ?? "Common";
    else if (kind === "item") rarity = rarityByItem.get(id) ?? "Common";
    else {
      const en = ENEMIES.find((x) => x.id === id);
      rarity = en && en.archetype === "Boss" ? "Legendary" : "Common";
    }
    jobs.push({ key: e.key, path: e.path, kind, rarity, subject: e.prompt });
  }

  // Hero (not in catalogs): synthesize a job.
  const heroSubject =
    "the player's heroic RPG warrior, mobile castle defender, balanced armour and a weapon, noble stance";
  jobs.push({
    key: spriteKey("hero", "hero"),
    path: spritePath("hero", "hero"),
    kind: "hero",
    rarity: "Legendary",
    subject: heroSubject,
  });

  return jobs;
}

function gridToRgba(grid: SpriteGrid, w: number, h: number, pal: Record<string, Rgba>): Uint8Array {
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sym = grid[y]?.[x] ?? ".";
      const [r, g, b, a] = pal[sym] ?? pal["."];
      const o = (y * w + x) * 4;
      out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = a;
    }
  }
  return out;
}

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : undefined;
}
function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function generateOne(job: Job, model: string, retries: number): Promise<void> {
  const dims = GEN_DIMS[job.kind];
  const pal = paletteFor({ kind: job.kind, rarity: job.rarity });
  const allowed = new Set(Object.keys(pal));
  const prompt = buildGridPrompt({ subject: job.subject, width: dims.w, height: dims.h, palette: pal });

  let best: SpriteGrid | null = null;
  let bestScore = Infinity; // lower = better (blobFrac)
  for (let attempt = 1; attempt <= retries; attempt++) {
    let raw: string;
    try {
      raw = await generate({ model, prompt, temperature: 0.7, timeoutMs: 180_000 });
    } catch (err) {
      console.log(`    attempt ${attempt} error: ${(err as Error).message}`);
      continue;
    }
    let grid = sanitizeGrid(parseGridLines(raw), dims.w, dims.h, allowed);
    if (MIRROR_KINDS.has(job.kind)) grid = mirrorHorizontal(grid, dims.w);
    const verdict = validateGrid(grid);
    if (verdict.ok) { best = grid; break; }
    if (verdict.blobFrac < bestScore) { bestScore = verdict.blobFrac; best = grid; }
    console.log(`    attempt ${attempt} rejected (transparent ${verdict.transparentFrac.toFixed(2)}, blob ${verdict.blobFrac.toFixed(2)})`);
  }
  if (!best) best = sanitizeGrid([], dims.w, dims.h, allowed); // never throw

  const rgba = gridToRgba(best, dims.w, dims.h, pal);
  const png = encodePng(rgba, dims.w, dims.h);
  const outPath = join("public", job.path);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, png);
}

async function main(): Promise<void> {
  const model = arg("model") ?? "gemma4:latest";
  const retries = Number(arg("retries") ?? "3");
  const only = arg("only");
  const id = arg("id");
  const force = flag("force");

  let jobs = buildJobs();
  if (only) jobs = jobs.filter((j) => j.kind === only);
  if (id) jobs = jobs.filter((j) => j.key === id);
  if (!force) jobs = jobs.filter((j) => !existsSync(join("public", j.path)));

  console.log(`Generating ${jobs.length} sprites with ${model} (retries=${retries})`);
  let done = 0;
  for (const job of jobs) {
    done++;
    console.log(`[${done}/${jobs.length}] ${job.key}`);
    await generateOne(job, model, retries);
  }
  console.log("Done.");
}

main().catch((e) => { console.error(e); process.exit(1); });
