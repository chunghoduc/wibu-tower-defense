/**
 * PreloadScene — first scene in boot order. Loads every pixel-art sprite sheet
 * from the generated manifest and builds Phaser animations from each sheet's
 * frame names. Missing files are non-fatal (loaderror swallowed); renderers fall
 * back to placeholder shapes via hasSprite().
 */
import Phaser from "phaser";
import { SPRITE_MANIFEST, SPRITE_BY_KEY } from "../data/spriteManifest.ts";
import { TERRAIN_ASSETS, TERRAIN_TEX_SIZE } from "../data/terrainManifest.ts";
import { SKILL_ICON_IDS } from "../data/skillIconManifest.ts";
import { JEWEL_ICON_IDS } from "../data/jewelIconManifest.ts";
import { BG_IMAGES, bgKey } from "../data/bgManifest.ts";
import { UI_SVGS, UI_IMAGES } from "../data/uiManifest.ts";
import { FX_IDS } from "../data/fxManifest.ts";
import { ITEM_CATALOG } from "../data/items.ts";
import { MATERIAL_ICON_IDS } from "../data/materialIconManifest.ts";
import { bakeBossWalks } from "./bossWalkBake.ts";
import { skillTex, jewelTex, menuTex, fxTex, materialTex, itemTex, HERODOLL_BASE_TEX, CASTLE_TEX, CASTLE_DAMAGED_TEX, roleTex } from "../data/assetKeys.ts";
import { TOWER_ROLES } from "../data/schemaEnums.ts";
import { versioned } from "../data/assetVersion.ts";

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super("PreloadScene");
  }

  preload(): void {
    this.load.on("loaderror", (file: Phaser.Loader.File) => void file);
    for (const e of SPRITE_MANIFEST) {
      this.load.spritesheet(e.key, versioned(e.path), { frameWidth: e.frameWidth, frameHeight: e.frameHeight });
    }
    // Terrain map art (T13): Phaser rasterizes the .svg to a texture in-browser.
    for (const t of TERRAIN_ASSETS) {
      this.load.svg(t.key, versioned(t.path), { width: TERRAIN_TEX_SIZE, height: TERRAIN_TEX_SIZE });
    }
    // Painted skill ability icons (96×96). Skip ids already in the manifest so a
    // future `gen.mjs --only=manifest` that folds them in won't double-load.
    for (const id of SKILL_ICON_IDS) {
      const key = skillTex(id);
      if (SPRITE_BY_KEY.has(key)) continue;
      this.load.spritesheet(key, versioned(`assets/sprites/skill/${id}.png`), { frameWidth: 96, frameHeight: 96 });
    }
    // Painted skill-jewel gem icons (96×96).
    for (const id of JEWEL_ICON_IDS) {
      const key = jewelTex(id);
      if (SPRITE_BY_KEY.has(key)) continue;
      this.load.spritesheet(key, versioned(`assets/sprites/jewel/${id}.png`), { frameWidth: 96, frameHeight: 96 });
    }
    // Scene backgrounds: main-menu hall + per-chapter battlefield backdrops.
    for (const id of BG_IMAGES) {
      this.load.image(bgKey(id), versioned(`assets/bg/${id}.png`));
    }
    // Design-team UI art set (icons, frames, buttons, badges, per-stage
    // backdrops, logo) — catalogued in public/assets/ui/uiManifest.json.
    for (const e of UI_SVGS) this.load.svg(e.key, versioned(e.path), { width: e.w, height: e.h });
    for (const e of UI_IMAGES) this.load.image(e.key, versioned(e.path));
    // Painted main-menu button icons (SDXL).
    for (const id of ["battle", "summon", "collection", "inventory", "squad", "passive", "shop", "skills", "settings"]) {
      this.load.image(menuTex(id), versioned(`assets/ui/menu/${id}.png`));
    }
    // Inventory paper-doll mannequin (equipment slots map onto its body).
    this.load.image(HERODOLL_BASE_TEX, versioned("assets/ui/hero-doll/hero-base.png"));
    // Battle-world castle sprite — intact + battle-damaged states (SDXL). A
    // missing file degrades to the BattleScene rectangle fallback (no crash).
    this.load.image(CASTLE_TEX, versioned("assets/sprites/structure/castle.png"));
    this.load.image(CASTLE_DAMAGED_TEX, versioned("assets/sprites/structure/castle__damaged.png"));
    // Per-role tower badge emblems (SDXL). A missing file degrades to the
    // legacy sword/arrow glyph drawn by BattleScene (no crash).
    for (const r of TOWER_ROLES) {
      this.load.image(roleTex(r), versioned(`assets/sprites/roleicon/${r}.png`));
    }
    // Additive-blend VFX textures (box-open burst/glow/sparkle).
    for (const id of FX_IDS) this.load.image(fxTex(id), versioned(`assets/sprites/fx/${id}.png`));
    // Crafting-material icons (enhance jewels + summon scroll).
    for (const id of MATERIAL_ICON_IDS) this.load.image(materialTex(id), versioned(`assets/sprites/material/${id}.png`));
    // Every catalog item's 96×96 inventory icon (worn on the hero + shown in
    // inventory). Driven by the catalog so newly-added items load without a
    // manifest regen; skip any already provided by the sprite manifest.
    for (const it of ITEM_CATALOG) {
      const key = itemTex(it.id);
      if (SPRITE_BY_KEY.has(key)) continue;
      this.load.spritesheet(key, versioned(`assets/sprites/item/${it.id}.png`), { frameWidth: 96, frameHeight: 96 });
    }
  }

  create(): void {
    for (const e of SPRITE_MANIFEST) {
      if (!this.textures.exists(e.key) || e.frames <= 1) continue;
      const idx = (re: RegExp) => e.names.map((n, i) => ({ n, i })).filter((x) => re.test(x.n)).map((x) => x.i);
      const mk = (suffix: string, frames: number[], frameRate: number, repeat: number) => {
        if (!frames.length) return;
        const key = `${e.key}_${suffix}`;
        if (this.anims.exists(key)) return;
        this.anims.create({ key, frames: frames.map((f) => ({ key: e.key, frame: f })), frameRate, repeat });
      };
      // Per-kind FPS: the hero gets the smoothest motion (more frames, faster).
      const k = e.kind;
      const idleFps = k === "hero" ? 5 : 4;
      const walkFps = k === "hero" ? 10 : 7;
      const atkFps = k === "hero" ? 12 : k === "boss" ? 9 : 11;
      mk("idle", idx(/idle/), idleFps, -1);
      mk("walk", idx(/walk/), walkFps, -1);
      mk("attack", idx(/atk/), atkFps, 0);   // basic attack frames only
      mk("skill", idx(/skill/), 10, 0);      // active-skill frames
      mk("hurt", idx(/hurt/), 8, 0);
    }
    // Enemies walk via the procedural transform (enemyWalkTransform.ts) on their
    // single static sprite — no baked walk frames (the wide warp sheet could flash
    // as a strip and its frames were near-identical anyway). Bosses keep a baked
    // stomp on a SEPARATE texture key (their base sheet stays for atk/skill poses).
    bakeBossWalks(this);  // synthesize the heavy 4-frame stomp stride for bosses
    this.scene.start("MainMenuScene");
  }
}

/** True when a generated sprite texture is loaded for `key` (e.g. "tower__karu-sunfist"). */
export function hasSprite(scene: Phaser.Scene, key: string): boolean {
  return scene.textures.exists(key);
}

/** Frame count for a sprite key (1 if static / unknown). */
export function spriteFrames(key: string): number {
  return SPRITE_BY_KEY.get(key)?.frames ?? 1;
}
