/**
 * forgeStations — pure (Phaser-free) view-models for the Forge's redesigned
 * station grid. Turns SaveManager/data primitives into icon descriptors so both
 * the station cards and the focused forge dialog render a visual INPUT → OUTPUT
 * instead of a text line + one button. No crafting logic lives here — only the
 * shape of what goes in and what comes out.
 */
import { ALCHEMY_RECIPES, COPIES_PER_CRYSTAL } from "../data/alchemy.ts";
import { AWAKENING_CRYSTAL, JEWEL_OF_CHAOS, MATERIALS_MAP } from "../data/materials.ts";
import { MAX_AWAKENING, awakeningCost } from "./awakening.ts";
import { materialIcon, towerIcon } from "../data/rewardIcon.ts";

/** One slot in a forge transformation (a material/tower/currency with a count). */
export interface ForgeIngredient {
  iconKey: string; // assetKeys texture; "" → use emoji
  emoji: string; // fallback glyph
  color: number; // tint (hex int)
  qty: number; // amount consumed/produced
  have?: number; // owned (inputs only) → drives short-of-target coloring
  label?: string; // short name under the tile
}

/** A single craftable transformation: its inputs, outputs and whether it's ready. */
export interface ForgeRecipeVM {
  id: string;
  label: string;
  inputs: ForgeIngredient[];
  outputs: ForgeIngredient[];
  canCraft: boolean;
  note?: string;
}

export type StationId = "awaken" | "alchemy" | "copies" | "wings" | "spark";

/** A station tile on the grid: emblem + readiness + its recipes + a mini preview. */
export interface StationVM {
  id: StationId;
  title: string;
  emoji: string;
  accent: number;
  ready: boolean;
  badge: string;
  recipes: ForgeRecipeVM[];
  preview: { input: ForgeIngredient; output: ForgeIngredient } | null;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const EMPTY: ForgeIngredient = { iconKey: "", emoji: "•", color: 0x6b7a8d, qty: 0 };

function matIngredient(id: string, qty: number, have?: number): ForgeIngredient {
  const ic = materialIcon(id);
  return {
    iconKey: ic.iconKey,
    emoji: ic.emoji,
    color: ic.color,
    qty,
    have,
    label: MATERIALS_MAP.get(id)?.name ?? id,
  };
}

function towerIngredient(id: string, name: string, qty = 1, have?: number): ForgeIngredient {
  const ic = towerIcon(id);
  return { iconKey: ic.iconKey, emoji: ic.emoji, color: ic.color, qty, have, label: name };
}

export function alchemyRecipeVMs(haves: Record<string, number>): ForgeRecipeVM[] {
  return ALCHEMY_RECIPES.map((r) => {
    const inputs = Object.entries(r.inputs).map(([m, n]) => matIngredient(m, n, haves[m] ?? 0));
    const outputs = Object.entries(r.outputs).map(([m, n]) => matIngredient(m, n));
    return {
      id: r.id,
      // Drop the "Transmute " prefix so selector chips stay short; the input→output
      // lane already shows the full transformation.
      label: r.name.replace(/^Transmute\s+/i, ""),
      inputs,
      outputs,
      canCraft: inputs.every((i) => (i.have ?? 0) >= i.qty),
    };
  });
}

export interface AwakenTowerInput {
  id: string;
  name: string;
  rank: number;
  crystalsHave: number;
}

export function awakeningVMs(rows: AwakenTowerInput[]): ForgeRecipeVM[] {
  return rows.map((t) => {
    const max = t.rank >= MAX_AWAKENING;
    const cost = max ? 0 : (awakeningCost(t.rank) ?? 0);
    return {
      id: t.id,
      label: t.name,
      inputs: max ? [] : [matIngredient(AWAKENING_CRYSTAL, cost, t.crystalsHave)],
      outputs: [towerIngredient(t.id, t.name)],
      canCraft: !max && t.crystalsHave >= cost,
      note: max
        ? "Fully Awakened (+30% atk/hp)"
        : `✦${t.rank} → ✦${t.rank + 1}   ·   +10% atk/hp`,
    };
  });
}

export interface CopyTowerInput {
  id: string;
  name: string;
  copies: number;
}

export function copyExchangeVMs(rows: CopyTowerInput[]): ForgeRecipeVM[] {
  return rows
    .filter((t) => t.copies >= COPIES_PER_CRYSTAL)
    .sort((a, b) => b.copies - a.copies)
    .map((t) => ({
      id: t.id,
      label: t.name,
      inputs: [
        { ...towerIngredient(t.id, t.name, COPIES_PER_CRYSTAL, t.copies), label: `${t.name} copies` },
      ],
      outputs: [matIngredient(AWAKENING_CRYSTAL, 1)],
      canCraft: true,
      note: `You have ${t.copies} banked copies`,
    }));
}

export function sparkVM(
  sparks: number,
  pity: number,
  featuredId: string,
  featuredName: string,
): ForgeRecipeVM {
  const can = sparks >= pity;
  return {
    id: "spark",
    label: "Spark Guarantee",
    inputs: [{ iconKey: "", emoji: "✦", color: 0xffe07a, qty: pity, have: sparks, label: "Sparks" }],
    outputs: [{ ...towerIngredient(featuredId, featuredName), label: featuredName }],
    canCraft: can,
    note: can ? "Claim a guaranteed featured Unique!" : `${pity - sparks} more sparks needed`,
  };
}

export function wingsStationVM(jewels: number, feathers: number, gearCount: number): StationVM {
  const ready = jewels >= 1 && feathers >= 1 && gearCount >= 5;
  return {
    id: "wings",
    title: "Craft Wings",
    emoji: "🪽",
    accent: 0x9a59d6,
    recipes: [],
    ready,
    badge: ready ? "Ready" : "Gather mats",
    preview: {
      input: { ...matIngredient(JEWEL_OF_CHAOS, 1, jewels) },
      output: { iconKey: "", emoji: "🪽", color: 0xe9b8ff, qty: 1, label: "Wings" },
    },
  };
}

/** The lead input + lead output of the most-actionable recipe, for the card preview. */
export function stationPreview(
  recipes: ForgeRecipeVM[],
): { input: ForgeIngredient; output: ForgeIngredient } | null {
  if (recipes.length === 0) return null;
  const r = recipes.find((x) => x.canCraft) ?? recipes[0];
  return { input: r.inputs[0] ?? EMPTY, output: r.outputs[0] ?? EMPTY };
}

/** Assemble a recipe-backed station (everything except Wings). */
export function stationFromRecipes(
  id: StationId,
  title: string,
  emoji: string,
  accent: number,
  recipes: ForgeRecipeVM[],
): StationVM {
  const readyCount = recipes.filter((r) => r.canCraft).length;
  return {
    id,
    title,
    emoji,
    accent,
    recipes,
    ready: readyCount > 0,
    badge:
      recipes.length === 0
        ? "—"
        : readyCount === 0
          ? "Locked"
          : readyCount > 1
            ? `${readyCount} ready`
            : "Ready",
    preview: stationPreview(recipes),
  };
}

/** A 2-column card grid in scene space (mirrors the home nav layout's feel). */
export function forgeGridLayout(count: number, width: number, top: number): Rect[] {
  const cols = 2;
  const pad = 24;
  const gap = 14;
  const cardW = (width - pad * 2 - gap) / cols;
  const cardH = 88;
  const rects: Rect[] = [];
  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    rects.push({
      x: pad + col * (cardW + gap),
      y: top + row * (cardH + gap),
      w: cardW,
      h: cardH,
    });
  }
  return rects;
}
