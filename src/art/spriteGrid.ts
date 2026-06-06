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
      if (ch === undefined) { row += "."; continue; }
      if (allowed.has(ch)) { row += ch; continue; }
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
      if (ch === ".") { transparent++; continue; }
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
