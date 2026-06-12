// src/scenes/labelFit.ts
//
// Pure, Phaser-free text-fit planner for tile "name plates". Given a name and a
// bounded band (maxWidth x maxLines), it picks the largest font in [minPx,basePx]
// whose greedy word-wrap fits; failing that it wraps at minPx and ellipsis-
// truncates the last kept line so the text NEVER exceeds the band. Width is
// resolved through an injected `measure` so this stays pure and unit-testable.

export interface FitOpts {
  maxWidth: number;
  maxLines: number;
  basePx: number;
  minPx: number;
}
export interface FitPlan {
  fontPx: number;
  lines: string[];
  truncated: boolean;
}
export type Measure = (text: string, fontPx: number) => number;

const ELLIPSIS = "…";

/** Greedy word-wrap; words wider than maxWidth are hard-broken at the char level. */
function wrap(text: string, maxWidth: number, px: number, measure: Measure): string[] {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let line = "";
  const pushWord = (w: string) => {
    // Hard-break a single oversized word.
    if (measure(w, px) > maxWidth) {
      if (line) {
        lines.push(line);
        line = "";
      }
      let chunk = "";
      for (const ch of w) {
        if (chunk && measure(chunk + ch, px) > maxWidth) {
          lines.push(chunk);
          chunk = ch;
        } else chunk += ch;
      }
      line = chunk;
      return;
    }
    const next = line ? line + " " + w : w;
    if (measure(next, px) > maxWidth) {
      if (line) lines.push(line);
      line = w;
    } else line = next;
  };
  for (const w of words) pushWord(w);
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

/** Trim a line until it (plus an ellipsis) fits maxWidth. */
function ellipsize(line: string, maxWidth: number, px: number, measure: Measure): string {
  let s = line.trimEnd();
  while (s.length > 0 && measure(s + ELLIPSIS, px) > maxWidth) s = s.slice(0, -1).trimEnd();
  return s + ELLIPSIS;
}

/** Pure: y-baseline for each of `n` lines, vertically centered in a band that
 *  spans [topY, topY+height]. Shared by the name-plate presenter and its tests. */
export function plateLineLayout(topY: number, height: number, n: number, fontPx: number): number[] {
  const lineH = fontPx * 1.18;
  const blockH = n * lineH;
  const top = topY + (height - blockH) / 2 + lineH / 2;
  return Array.from({ length: n }, (_, i) => top + i * lineH);
}

export function fitLabel(text: string, opts: FitOpts, measure: Measure): FitPlan {
  const { maxWidth, maxLines, basePx, minPx } = opts;
  if (text.trim().length === 0) return { fontPx: basePx, lines: [""], truncated: false };

  for (let px = basePx; px >= minPx; px--) {
    const lines = wrap(text, maxWidth, px, measure);
    const fits = lines.length <= maxLines && lines.every((ln) => measure(ln, px) <= maxWidth);
    if (fits) return { fontPx: px, lines, truncated: false };
  }

  // Nothing fits: wrap at the floor, keep maxLines, ellipsize the last kept line.
  const wrapped = wrap(text, maxWidth, minPx, measure);
  const kept = wrapped.slice(0, maxLines);
  if (wrapped.length > maxLines || measure(kept[kept.length - 1], minPx) > maxWidth) {
    kept[kept.length - 1] = ellipsize(kept[kept.length - 1], maxWidth, minPx, measure);
  }
  return { fontPx: minPx, lines: kept, truncated: true };
}
