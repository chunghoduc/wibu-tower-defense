// Type declarations for the pure JS prompt-descriptor module (consumed by the
// generator script and by tests/roleIconPrompts.test.ts under tsc --noEmit).
// Only the role-icon surface is declared precisely; the rest is the same JS
// shape the generator relies on.
export const NEGATIVE: string;
export function style(visual: string): string;
export const POSE: Record<string, string>;
export const TOWER_VISUAL: Record<string, string>;
export const HERO_BASE: string;
export const HERO_WEAPON: Record<string, string>;
export const ENEMY_VISUAL: Record<string, string>;
export const BOSS_VISUAL: Record<string, string>;
export const STRUCTURE_VISUAL: Record<string, string>;
export const STRUCTURE_STATE: Record<string, string>;
export const STRUCTURE_NEGATIVE: string;
export function structureStyle(visual: string, state: string): string;
/** One flat emblem description per TowerRole, keyed by the role string. */
export const ROLE_VISUAL: Record<string, string>;
export const ROLEICON_NEGATIVE: string;
export function roleIconStyle(visual: string): string;
/** One trophy-medallion emblem description per achievement id. */
export const ACHIEVEMENT_VISUAL: Record<string, string>;
export const ACHIEVEMENT_NEGATIVE: string;
export function achievementIconStyle(visual: string): string;
export function itemStyle(v: string): string;
export function itemStyleFor(look: string, rarity: string): string;
export function skillStyleFor(look: string, rarity: string): string;
export const ITEM_VISUAL: Record<string, string>;
