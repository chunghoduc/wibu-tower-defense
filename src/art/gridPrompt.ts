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

/**
 * A worked 16×16 example (a simple armoured figure) teaches the model the
 * expected density: a SOLID filled body, not a sparse scatter. Symbols used
 * here (., K, A, S, M) are in every entity palette.
 */
const EXAMPLE_16 = [
  "................",
  ".....KKKK.......",
  "....KSSSSK......",
  "....KSSSSK......",
  "....KSSSSK......",
  ".....KKKK.......",
  "...KKAAAAKK.....",
  "..KAAAAAAAAK....",
  "..KAAAAAAAAK....",
  "..KAMAAAAMAK....",
  "..KAAAAAAAAK....",
  "...KAAAAAAK.....",
  "....KK..KK......",
  "...KMK..KMK.....",
  "...KMK..KMK.....",
  "...KKK..KKK.....",
].join("\n");

export function buildGridPrompt(input: GridPromptInput): string {
  const { subject, width, height, palette } = input;
  const legend = Object.keys(palette).map(describeSymbol).join("\n");
  return [
    `You are an expert pixel-art sprite designer. Design a ${width}x${height} pixel sprite.`,
    ``,
    `Subject: ${subject}`,
    ``,
    `Use ONLY these single-character palette symbols:`,
    legend,
    ``,
    `Here is an EXAMPLE of the expected density and style (a generic figure) —`,
    `notice the body is SOLIDLY filled, with a black K outline around coloured regions:`,
    EXAMPLE_16,
    ``,
    `Now design the subject above in the SAME solid style. Rules:`,
    `- Output EXACTLY ${height} lines, each EXACTLY ${width} characters.`,
    `- Use ONLY the palette symbols above. No spaces. No other characters.`,
    `- Fill the character's BODY solidly with colour — do NOT leave it as scattered dots.`,
    `- Wrap coloured regions in a black "K" outline; use "." ONLY for the empty background.`,
    `- Centre the subject; aim for a bold, readable silhouette filling most of the canvas.`,
    `- Output ONLY the grid. No explanation, no code fences.`,
  ].join("\n");
}
