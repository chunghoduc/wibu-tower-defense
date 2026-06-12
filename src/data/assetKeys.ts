// src/data/assetKeys.ts
//
// THE single point where any "<namespace>__<id>" texture key is derived. Every
// scene, manifest, and resolver imports from here instead of hand-building the
// string, so a naming-convention change is a one-line edit and a stray inline
// key is caught by tests/assetKeyDiscipline.test.ts (which forbids inline
// "<ns>__${" templates anywhere else). Pure / Phaser-free — these keys resolve
// INTO Phaser's global Texture Manager, which shows the __MISSING sentinel on a
// bad key rather than failing silently.

/** Inventory/worn icon for a gear item (96×96 spritesheet). */
export const itemTex = (id: string): string => `item__${id}`;
/** Character/tower sprite sheet. */
export const towerTex = (id: string): string => `tower__${id}`;
/** Skill-jewel gem icon (96×96). */
export const jewelTex = (id: string): string => `jewel__${id}`;
/** Crafting-material icon (non-box: enhance jewels, scroll, …). */
export const materialTex = (id: string): string => `material__${id}`;
/** Boss loot-box chest art. */
export const boxTex = (id: string): string => `box__${id}`;
/** Active/passive skill ability icon (96×96). */
export const skillTex = (id: string): string => `skill__${id}`;
/** Main-menu button icon. */
export const menuTex = (id: string): string => `menu__${id}`;
/** Additive-blend VFX texture. */
export const fxTex = (id: string): string => `fx__${id}`;
/** Battle-world structure sprite (castle, …). */
export const structureTex = (id: string): string => `structure__${id}`;
/** Per-role tower badge emblem (damage, splash, chain, …). */
export const roleTex = (role: string): string => `roleicon__${role}`;

/** Fixed singleton currency / UI keys (named so they are never magic strings). */
export const GOLD_TEX = "icon__gold";
export const GEM_TEX = "icon__gem";
export const XP_TEX = "icon__xp";
export const HERODOLL_BASE_TEX = "herodoll__base";
export const CASTLE_TEX = structureTex("castle");
export const CASTLE_DAMAGED_TEX = structureTex("castle__damaged");
