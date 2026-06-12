# Phase 4c — Local-LLM Art Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A dependency-free Node harness that drives the local Ollama server to design each sprite as a palette-indexed pixel grid, rasterizes it to a PNG, and writes the 71 base sprites to `public/assets/sprites/` where the existing `PreloadScene` loads them.

**Architecture:** Five pure/IO modules under `src/art/` (palette, spriteGrid, pngEncoder, ollamaClient, gridPrompt) plus a `scripts/genSprites.ts` orchestrator. Pure modules are unit-tested with Vitest; the model call is validated by a real smoke run, not asserted in CI. Generation is resumable (skips existing PNGs) and the model is a CLI flag.

**Tech Stack:** TypeScript, Node built-ins only (`zlib`, global `fetch`, `node:fs`), Vitest, `vite-node` for running scripts.

---

## File Map

| Action | Path                       | Responsibility                                       |
| ------ | -------------------------- | ---------------------------------------------------- |
| Create | `src/art/pngEncoder.ts`    | RGBA buffer → PNG bytes (zlib + CRC32, no deps)      |
| Create | `src/art/palette.ts`       | Palette symbol → RGBA; `paletteFor(entry)`           |
| Create | `src/art/spriteGrid.ts`    | parse / sanitize / mirror / validate model grid text |
| Create | `src/art/ollamaClient.ts`  | POST to Ollama `/api/generate` with timeout          |
| Create | `src/art/gridPrompt.ts`    | Build the strict grid-output prompt per entity       |
| Create | `scripts/genSprites.ts`    | Orchestrator: generate → sanitize → encode → save    |
| Create | `tests/pngEncoder.test.ts` | PNG signature, IHDR, IDAT round-trip                 |
| Create | `tests/spriteGrid.test.ts` | Sanitize ragged input, validate, mirror              |
| Create | `tests/palette.test.ts`    | `paletteFor` returns transparent+outline+accent      |

---

## Task 1 — PNG Encoder

**Files:** Create `src/art/pngEncoder.ts`, `tests/pngEncoder.test.ts`

- [ ] **Step 1: Write the failing test** — create `tests/pngEncoder.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { inflateSync } from "node:zlib";
import { encodePng } from "../src/art/pngEncoder.ts";

const SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

// 2x1 image: red opaque, green opaque
function sampleRgba(): Uint8Array {
  return Uint8Array.from([255, 0, 0, 255, 0, 255, 0, 255]);
}

describe("encodePng", () => {
  it("starts with the PNG signature", () => {
    const png = encodePng(sampleRgba(), 2, 1);
    expect(Array.from(png.slice(0, 8))).toEqual(SIG);
  });

  it("encodes width and height in the IHDR chunk", () => {
    const png = encodePng(sampleRgba(), 2, 1);
    // IHDR data starts at offset 16 (8 sig + 4 len + 4 type)
    const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
    expect(view.getUint32(16)).toBe(2); // width
    expect(view.getUint32(20)).toBe(1); // height
    expect(png[24]).toBe(8); // bit depth
    expect(png[25]).toBe(6); // color type RGBA
  });

  it("IDAT inflates back to filtered scanlines (filter 0 + pixels)", () => {
    const png = encodePng(sampleRgba(), 2, 1);
    // Find IDAT: scan for ascii "IDAT"
    let idatStart = -1;
    for (let i = 0; i < png.length - 4; i++) {
      if (png[i] === 0x49 && png[i + 1] === 0x44 && png[i + 2] === 0x41 && png[i + 3] === 0x54) {
        idatStart = i + 4;
        break;
      }
    }
    expect(idatStart).toBeGreaterThan(0);
    const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
    const lenView = view.getUint32(idatStart - 8); // length precedes type
    const idat = png.slice(idatStart, idatStart + lenView);
    const raw = inflateSync(Buffer.from(idat));
    // one scanline: filter byte 0, then 8 bytes of RGBA
    expect(raw[0]).toBe(0);
    expect(Array.from(raw.slice(1))).toEqual([255, 0, 0, 255, 0, 255, 0, 255]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- tests/pngEncoder.test.ts 2>&1 | tail -5`
Expected: FAIL — cannot find module `pngEncoder.ts`.

- [ ] **Step 3: Implement** — create `src/art/pngEncoder.ts`:

```ts
/**
 * Minimal PNG encoder — truecolor + alpha (color type 6), 8-bit.
 * No third-party deps: zlib for IDAT compression, a CRC32 table for chunks.
 */
import { deflateSync } from "node:zlib";

const SIGNATURE = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function u32(n: number): Uint8Array {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n >>> 0);
  return b;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = Uint8Array.from([...type].map((ch) => ch.charCodeAt(0)));
  const body = new Uint8Array(typeBytes.length + data.length);
  body.set(typeBytes, 0);
  body.set(data, typeBytes.length);
  const out = new Uint8Array(4 + body.length + 4);
  out.set(u32(data.length), 0);
  out.set(body, 4);
  out.set(u32(crc32(body)), 4 + body.length);
  return out;
}

/** Encode an RGBA buffer (length w*h*4) into PNG bytes. */
export function encodePng(rgba: Uint8Array, width: number, height: number): Uint8Array {
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, width);
  dv.setUint32(4, height);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: truecolor + alpha
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // Filtered scanlines: filter byte 0 (none) + raw RGBA row.
  const stride = width * 4;
  const filtered = new Uint8Array((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    filtered[y * (stride + 1)] = 0;
    filtered.set(rgba.subarray(y * stride, y * stride + stride), y * (stride + 1) + 1);
  }
  const idatData = new Uint8Array(deflateSync(Buffer.from(filtered)));

  const ihdrChunk = chunk("IHDR", ihdr);
  const idatChunk = chunk("IDAT", idatData);
  const iendChunk = chunk("IEND", new Uint8Array(0));

  const total = SIGNATURE.length + ihdrChunk.length + idatChunk.length + iendChunk.length;
  const png = new Uint8Array(total);
  let o = 0;
  png.set(SIGNATURE, o);
  o += SIGNATURE.length;
  png.set(ihdrChunk, o);
  o += ihdrChunk.length;
  png.set(idatChunk, o);
  o += idatChunk.length;
  png.set(iendChunk, o);
  return png;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- tests/pngEncoder.test.ts 2>&1 | tail -5`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/art/pngEncoder.ts tests/pngEncoder.test.ts
git commit -m "feat(art): dependency-free PNG encoder (RGBA, zlib + CRC32)"
```

---

## Task 2 — Palette

**Files:** Create `src/art/palette.ts`, `tests/palette.test.ts`

The palette maps single-character symbols to RGBA tuples. `paletteFor(entry)` returns
the symbol set allowed for one entity: always transparent + outline, plus families
appropriate to its kind, plus the entity's rarity accent bound to symbol `A`.

- [ ] **Step 1: Write the failing test** — create `tests/palette.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { BASE_PALETTE, paletteFor, RARITY_ACCENT } from "../src/art/palette.ts";
import { spriteKind } from "../src/data/artPrompts.ts";
import { TOWERS } from "../src/data/towers.ts";
import { ITEM_CATALOG } from "../src/data/items.ts";

describe("BASE_PALETTE", () => {
  it("maps '.' to fully transparent and 'K' to opaque outline", () => {
    expect(BASE_PALETTE["."]).toEqual([0, 0, 0, 0]);
    expect(BASE_PALETTE["K"][3]).toBe(255);
  });
});

describe("paletteFor", () => {
  it("always includes transparent, outline, and the rarity accent symbol A", () => {
    const tower = TOWERS.find((t) => t.rarity === "Unique")!;
    const pal = paletteFor({ kind: "tower", rarity: tower.rarity });
    expect(pal["."]).toBeDefined();
    expect(pal["K"]).toBeDefined();
    expect(pal["A"]).toEqual(RARITY_ACCENT.Unique);
  });

  it("returns a unique RGBA per symbol and a non-empty set", () => {
    const pal = paletteFor({ kind: "item", rarity: ITEM_CATALOG[0].rarity });
    const keys = Object.keys(pal);
    expect(keys.length).toBeGreaterThan(3);
    expect(keys).toContain("A");
  });
});

describe("spriteKind", () => {
  it("classifies a Boss enemy as boss and others as enemy", () => {
    expect(spriteKind({ archetype: "Boss" } as never)).toBe("boss");
    expect(spriteKind({ archetype: "Rusher" } as never)).toBe("enemy");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- tests/palette.test.ts 2>&1 | tail -5`
Expected: FAIL — cannot find module `palette.ts` (and `spriteKind` not yet exported; added in Task 6).

- [ ] **Step 3: Implement** — create `src/art/palette.ts`:

```ts
/**
 * Sprite palette — symbol -> RGBA. Kept tiny and named so the LLM can place
 * pixels by meaning. paletteFor() narrows the set per entity and binds the
 * rarity accent to symbol "A".
 */
import type { Rarity } from "../data/schema.ts";
import type { ArtKind } from "../data/artSpec.ts";

export type Rgba = [number, number, number, number];

export const BASE_PALETTE: Record<string, Rgba> = {
  ".": [0, 0, 0, 0], // transparent
  K: [22, 22, 30, 255], // outline (near-black)
  W: [240, 240, 245, 255], // white / highlight
  S: [232, 196, 160, 255], // skin
  D: [150, 110, 84, 255], // dark skin / leather
  M: [120, 128, 140, 255], // metal mid
  L: [180, 188, 200, 255], // metal light
  C: [70, 80, 110, 255], // cloth base
  G: [80, 160, 90, 255], // nature/green
  F: [240, 150, 50, 255], // flame
  B: [90, 170, 230, 255], // frost/blue
  P: [150, 90, 180, 255], // arcane/purple
  Y: [235, 205, 90, 255], // gold
};

export const RARITY_ACCENT: Record<Rarity, Rgba> = {
  Common: [138, 146, 160, 255],
  Magic: [47, 111, 219, 255],
  Rare: [142, 68, 173, 255],
  Legendary: [232, 144, 42, 255],
  Unique: [210, 59, 59, 255],
};

const KIND_FAMILIES: Record<ArtKind, string[]> = {
  tower: ["W", "S", "D", "M", "L", "C", "F", "B", "P"],
  hero: ["W", "S", "D", "M", "L", "C", "Y"],
  enemy: ["W", "D", "M", "C", "G", "P"],
  boss: ["W", "D", "M", "L", "C", "P", "F"],
  item: ["W", "M", "L", "Y", "P", "B"],
};

export interface PaletteRequest {
  kind: ArtKind;
  rarity: Rarity;
}

/** Allowed symbol -> RGBA for one entity, including transparent, outline, accent A. */
export function paletteFor(req: PaletteRequest): Record<string, Rgba> {
  const out: Record<string, Rgba> = { ".": BASE_PALETTE["."], K: BASE_PALETTE.K };
  for (const sym of KIND_FAMILIES[req.kind]) out[sym] = BASE_PALETTE[sym];
  out["A"] = RARITY_ACCENT[req.rarity];
  return out;
}
```

- [ ] **Step 4: Run to verify it passes** (after Task 6 adds `spriteKind`, this whole file passes; for now run only the palette describe blocks)

Run: `npm test -- tests/palette.test.ts -t "paletteFor" 2>&1 | tail -5`
Expected: PASS for the `paletteFor` and `BASE_PALETTE` blocks. The `spriteKind` block stays red until Task 6.

- [ ] **Step 5: Commit**

```bash
git add src/art/palette.ts tests/palette.test.ts
git commit -m "feat(art): sprite palette + per-entity palette resolution"
```

---

## Task 3 — Sprite Grid (parse / sanitize / mirror / validate)

**Files:** Create `src/art/spriteGrid.ts`, `tests/spriteGrid.test.ts`

- [ ] **Step 1: Write the failing test** — create `tests/spriteGrid.test.ts`:

````ts
import { describe, expect, it } from "vitest";
import {
  parseGridLines,
  sanitizeGrid,
  mirrorHorizontal,
  validateGrid,
} from "../src/art/spriteGrid.ts";

const ALLOWED = new Set([".", "K", "A", "W"]);

describe("parseGridLines", () => {
  it("strips code fences and prose, keeping grid-like lines", () => {
    const text = "Here is the sprite:\n```\n.K.\nKAK\n.K.\n```\nDone!";
    expect(parseGridLines(text)).toEqual([".K.", "KAK", ".K."]);
  });
});

describe("sanitizeGrid", () => {
  it("pads short lines and truncates long lines to width", () => {
    const grid = sanitizeGrid(["K", "KAAAA"], 3, 2, ALLOWED);
    expect(grid).toEqual(["K..", "KAA"]);
  });

  it("pads missing rows with transparent and drops extra rows", () => {
    const grid = sanitizeGrid(["KKK"], 3, 2, ALLOWED);
    expect(grid).toEqual(["KKK", "..."]);
    const grid2 = sanitizeGrid(["AAA", "AAA", "AAA"], 3, 2, ALLOWED);
    expect(grid2.length).toBe(2);
  });

  it("maps unknown symbols to transparent (case-insensitive match first)", () => {
    const grid = sanitizeGrid(["kaZ"], 3, 1, ALLOWED);
    expect(grid).toEqual(["KA."]); // k->K, a->A, Z->.
  });
});

describe("mirrorHorizontal", () => {
  it("mirrors the left half onto the right", () => {
    expect(mirrorHorizontal(["KA.", "..."], 3)).toEqual(["KAK", "..."]);
  });
});

describe("validateGrid", () => {
  it("flags an all-transparent grid as empty", () => {
    expect(validateGrid(["...", "..."]).ok).toBe(false);
  });

  it("flags a single-symbol blob", () => {
    expect(validateGrid(["AAA", "AAA"]).ok).toBe(false);
  });

  it("accepts a mixed grid", () => {
    expect(validateGrid(["KAW", ".K."]).ok).toBe(true);
  });
});
````

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- tests/spriteGrid.test.ts 2>&1 | tail -5`
Expected: FAIL — cannot find module `spriteGrid.ts`.

- [ ] **Step 3: Implement** — create `src/art/spriteGrid.ts`:

````ts
/**
 * Turn noisy LLM text into a clean W×H grid of allowed palette symbols.
 * The model drifts (ragged lines, invented symbols, prose) — every defect here
 * is recoverable so generation never hard-fails on one bad response.
 */
export type SpriteGrid = string[]; // exactly H strings, each exactly W chars

/** Keep only lines that look like grid rows (mostly symbol-ish, not prose). */
export function parseGridLines(text: string): string[] {
  const lines = text.replace(/```[a-z]*/gi, "").split(/\r?\n/);
  const candidates = lines
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    // a grid row has no spaces and few letters-as-words; allow symbol chars only
    .filter((l) => !l.includes(" ") && /^[A-Za-z.]+$/.test(l));
  return candidates;
}

/** Force lines into exactly H rows of W chars using only `allowed` symbols. */
export function sanitizeGrid(
  lines: string[],
  width: number,
  height: number,
  allowed: Set<string>,
): SpriteGrid {
  const allowedUpper = new Map<string, string>();
  for (const s of allowed) allowedUpper.set(s.toUpperCase(), s);

  const rows: string[] = [];
  for (let y = 0; y < height; y++) {
    const src = lines[y] ?? "";
    let row = "";
    for (let x = 0; x < width; x++) {
      const ch = src[x];
      if (ch === undefined) {
        row += ".";
        continue;
      }
      if (allowed.has(ch)) {
        row += ch;
        continue;
      }
      const up = allowedUpper.get(ch.toUpperCase());
      row += up ?? ".";
    }
    rows.push(row);
  }
  return rows;
}

/** Mirror the left ceil(W/2) columns onto the right for symmetric characters. */
export function mirrorHorizontal(grid: SpriteGrid, width: number): SpriteGrid {
  const half = Math.ceil(width / 2);
  return grid.map((row) => {
    const left = row.slice(0, half).split("");
    const out = [...left];
    for (let x = half; x < width; x++) out[x] = left[width - 1 - x];
    return out.join("");
  });
}

export interface GridVerdict {
  ok: boolean;
  transparentFrac: number;
  blobFrac: number;
}

/** Reject near-empty or single-colour blob grids so the orchestrator retries. */
export function validateGrid(grid: SpriteGrid): GridVerdict {
  let total = 0;
  let transparent = 0;
  const counts = new Map<string, number>();
  for (const row of grid) {
    for (const ch of row) {
      total++;
      if (ch === ".") {
        transparent++;
        continue;
      }
      counts.set(ch, (counts.get(ch) ?? 0) + 1);
    }
  }
  const nonTransparent = total - transparent;
  const transparentFrac = total === 0 ? 1 : transparent / total;
  let maxSym = 0;
  for (const c of counts.values()) maxSym = Math.max(maxSym, c);
  const blobFrac = nonTransparent === 0 ? 1 : maxSym / nonTransparent;
  const ok = transparentFrac <= 0.92 && blobFrac <= 0.85 && nonTransparent > 0;
  return { ok, transparentFrac, blobFrac };
}
````

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- tests/spriteGrid.test.ts 2>&1 | tail -5`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/art/spriteGrid.ts tests/spriteGrid.test.ts
git commit -m "feat(art): sprite-grid parse/sanitize/mirror/validate"
```

---

## Task 4 — Ollama Client

**Files:** Create `src/art/ollamaClient.ts`

No unit test (pure IO against a live server). Verified in the smoke run (Task 7).

- [ ] **Step 1: Implement** — create `src/art/ollamaClient.ts`:

```ts
/**
 * Minimal Ollama client — POST /api/generate, non-streaming, with a timeout.
 * Throws on non-200 or timeout so the orchestrator can retry.
 */
export interface GenerateOptions {
  model: string;
  prompt: string;
  temperature?: number;
  timeoutMs?: number;
  host?: string;
}

export async function generate(opts: GenerateOptions): Promise<string> {
  const host = opts.host ?? "http://localhost:11434";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 120_000);
  try {
    const res = await fetch(`${host}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: opts.model,
        prompt: opts.prompt,
        stream: false,
        options: { temperature: opts.temperature ?? 0.7 },
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
    const json = (await res.json()) as { response?: string };
    return json.response ?? "";
  } finally {
    clearTimeout(timeout);
  }
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npm run typecheck 2>&1 | tail -5`
Expected: no errors from `ollamaClient.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/art/ollamaClient.ts
git commit -m "feat(art): minimal Ollama generate client with timeout"
```

---

## Task 5 — Grid Prompt Builder

**Files:** Create `src/art/gridPrompt.ts`

- [ ] **Step 1: Implement** — create `src/art/gridPrompt.ts`:

```ts
/**
 * Build the strict grid-output prompt for one sprite. Wraps the descriptive
 * art prompt with hard formatting rules and the entity's exact allowed palette
 * so the model returns parseable rows.
 */
import type { Rgba } from "./palette.ts";

export interface GridPromptInput {
  /** Descriptive subject line, e.g. the existing artPrompts text. */
  subject: string;
  width: number;
  height: number;
  /** Allowed symbol -> RGBA (only symbol names are shown to the model). */
  palette: Record<string, Rgba>;
}

function describeSymbol(sym: string): string {
  const names: Record<string, string> = {
    ".": "transparent (empty)",
    K: "black outline",
    W: "white / highlight",
    S: "skin",
    D: "dark / leather",
    M: "metal",
    L: "light metal",
    C: "cloth",
    G: "green / nature",
    F: "flame / orange",
    B: "frost / blue",
    P: "arcane / purple",
    Y: "gold",
    A: "accent colour (rarity)",
  };
  return `${sym} = ${names[sym] ?? "colour"}`;
}

export function buildGridPrompt(input: GridPromptInput): string {
  const { subject, width, height, palette } = input;
  const legend = Object.keys(palette).map(describeSymbol).join("\n");
  return [
    `You are a pixel-art sprite designer. Design a ${width}x${height} pixel sprite.`,
    ``,
    `Subject: ${subject}`,
    ``,
    `Use ONLY these single-character palette symbols:`,
    legend,
    ``,
    `Rules:`,
    `- Output EXACTLY ${height} lines.`,
    `- Each line EXACTLY ${width} characters.`,
    `- Use ONLY the palette symbols above. No spaces. No other characters.`,
    `- Centre the subject; use "." for empty/background pixels.`,
    `- Give it a clear black "K" outline and a strong readable silhouette.`,
    `- Output ONLY the grid. No explanation, no code fences.`,
  ].join("\n");
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npm run typecheck 2>&1 | tail -5`
Expected: no errors from `gridPrompt.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/art/gridPrompt.ts
git commit -m "feat(art): strict grid-output prompt builder"
```

---

## Task 6 — Add `spriteKind` helper to artPrompts

**Files:** Modify `src/data/artPrompts.ts`

`palette.test.ts` (Task 2) imports `spriteKind` from `artPrompts.ts`; the orchestrator
also needs it to map an enemy to `enemy` vs `boss`. Extract it as a named export.

- [ ] **Step 1: Add the export** — in `src/data/artPrompts.ts`, add near the top (after imports):

```ts
import type { EnemyDef } from "./schema.ts";

/** Classify an enemy as a boss or a regular enemy sprite kind. */
export function spriteKind(def: Pick<EnemyDef, "archetype">): "enemy" | "boss" {
  return def.archetype === "Boss" ? "boss" : "enemy";
}
```

Then replace the two inline `e.archetype === "Boss" ? "boss" : "enemy"` expressions
in `enemyPrompt` and `allArtPrompts` with `spriteKind(e)` and `spriteKind(def)`
respectively (the local variable is named `kind`).

- [ ] **Step 2: Run palette + art prompt tests**

Run: `npm test -- tests/palette.test.ts tests/artPrompts.test.ts 2>&1 | tail -6`
Expected: PASS — all `palette.test.ts` blocks now green, `artPrompts.test.ts` still 10 green.

- [ ] **Step 3: Commit**

```bash
git add src/data/artPrompts.ts tests/palette.test.ts
git commit -m "feat(art): export spriteKind helper; finish palette tests"
```

---

## Task 7 — Orchestrator + smoke run

**Files:** Create `scripts/genSprites.ts`, modify `package.json`

The orchestrator builds the work list (the 70 catalog sprites from `allArtPrompts()`
plus the hero), and for each: builds the grid prompt, calls Ollama, sanitizes,
optionally mirrors, validates with retry-keep-best, rasterizes, and writes the PNG.

- [ ] **Step 1: Implement** — create `scripts/genSprites.ts`:

```ts
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
  parseGridLines,
  sanitizeGrid,
  mirrorHorizontal,
  validateGrid,
  type SpriteGrid,
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
    // e.key is "<kind>__<id>"; recover kind + id
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
      out[o] = r;
      out[o + 1] = g;
      out[o + 2] = b;
      out[o + 3] = a;
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
  const prompt = buildGridPrompt({
    subject: job.subject,
    width: dims.w,
    height: dims.h,
    palette: pal,
  });

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
    if (verdict.ok) {
      best = grid;
      break;
    }
    if (verdict.blobFrac < bestScore) {
      bestScore = verdict.blobFrac;
      best = grid;
    }
    console.log(
      `    attempt ${attempt} rejected (transparent ${verdict.transparentFrac.toFixed(2)}, blob ${verdict.blobFrac.toFixed(2)})`,
    );
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

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: Add the npm script** — in `package.json` `scripts`, after `gen:art-prompts`:

```json
    "gen:sprites": "vite-node scripts/genSprites.ts"
```

- [ ] **Step 3: Type-check**

Run: `npm run typecheck 2>&1 | tail -5`
Expected: clean.

- [ ] **Step 4: Smoke run — one tower**

Run: `npm run gen:sprites -- --id=tower__zoran-thricedraw 2>&1 | tail -8`
Expected: logs `[1/1] tower__zoran-thricedraw`, then `Done.`; file `public/assets/sprites/tower/zoran-thricedraw.png` exists.

Verify the PNG is valid:
Run: `node -e "const z=require('zlib');const fs=require('fs');const b=fs.readFileSync('public/assets/sprites/tower/zoran-thricedraw.png');console.log('sig ok', b[0]===0x89&&b[1]===0x50, 'bytes', b.length)"`
Expected: `sig ok true bytes <n>` with n > 60.

- [ ] **Step 5: Commit the harness (not the generated PNG yet)**

```bash
git add scripts/genSprites.ts package.json
git commit -m "feat(art): genSprites orchestrator — Ollama-driven base sprite generation"
```

---

## Task 8 — Full base run + commit assets

**Files:** generates `public/assets/sprites/**`

- [ ] **Step 1: Confirm `.gitignore` does not exclude `public/`**

Run: `git check-ignore public/assets/sprites/tower/zoran-thricedraw.png; echo "ignored=$?"`
Expected: `ignored=1` (NOT ignored). If it prints a path with `ignored=0`, stop and adjust `.gitignore`.

- [ ] **Step 2: Generate everything missing** (long-running; ~1–2 h)

Run: `npm run gen:sprites 2>&1 | tail -20`
Expected: iterates ~70 remaining jobs, ends `Done.`

- [ ] **Step 3: Count outputs**

Run: `find public/assets/sprites -name '*.png' | wc -l`
Expected: `71`.

- [ ] **Step 4: Spot-check a few PNG signatures**

Run: `for f in public/assets/sprites/hero/hero.png public/assets/sprites/item/iron-sword.png public/assets/sprites/boss/*.png; do node -e "const fs=require('fs');const b=fs.readFileSync('$f');process.stdout.write('$f '+(b[0]===0x89?'ok':'BAD')+'\n')"; done`
Expected: every line ends `ok`.

- [ ] **Step 5: Commit the generated assets**

```bash
git add public/assets/sprites
git commit -m "feat(art): generate 71 base sprites via local Ollama (gemma4)"
```

---

## Task 9 — Final verification

- [ ] **Step 1: Full suite + build**

Run: `npm run typecheck && npm test 2>&1 | tail -8 && npm run build 2>&1 | tail -3`
Expected: all tests pass (prior 209 + pngEncoder 3 + spriteGrid 9 + palette 3 = 224), typecheck clean, build succeeds.

- [ ] **Step 2: Confirm PreloadScene will find them** (sanity: keys vs files)

Run: `node -e "const fs=require('fs');const n=fs.readdirSync('public/assets/sprites',{recursive:true}).filter(f=>String(f).endsWith('.png')).length;console.log('png files',n)"`
Expected: `png files 71`.

- [ ] **Step 3: Log final commits**

Run: `git log --oneline -10`

---

## Notes for the implementer

- **The model is slow (~45 s/sprite).** Task 8 is a long batch. It is resumable: re-running skips existing PNGs, so an interrupted run continues where it left off.
- **Quality is retro-primitive.** Any sprite is regenerable individually with `--id=<key> --force`, or overridable by dropping a hand-made PNG at the same path.
- **No render wiring here.** Phase 4d swaps placeholder shapes for these textures and adds animation frames; this plan only produces the assets and keeps all tests/builds green.
