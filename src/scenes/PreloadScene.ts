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
import { WORN_SLOTS } from "../data/heroDressLayout.ts";
import { MATERIAL_ICON_IDS } from "../data/materialIconManifest.ts";
import { bakeBossWalks } from "./bossWalkBake.ts";
import { createLoadingBackdrop } from "./loadingBackdropFx.ts";
import {
  skillTex,
  jewelTex,
  menuTex,
  fxTex,
  materialTex,
  itemTex,
  wornTex,
  HERODOLL_BASE_TEX,
  CASTLE_TEX,
  CASTLE_DAMAGED_TEX,
  roleTex,
  achievementTex,
  battleEmblemTex,
  rarityTex,
} from "../data/assetKeys.ts";
import { TOWER_ROLES, RARITIES } from "../data/schemaEnums.ts";
import { ACHIEVEMENTS } from "../data/achievements.ts";
import { versioned } from "../data/assetVersion.ts";

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super("PreloadScene");
  }

  preload(): void {
    this._setupLoadingBar();
    this.load.on("loaderror", (file: Phaser.Loader.File) => void file);
    for (const e of SPRITE_MANIFEST) {
      this.load.spritesheet(e.key, versioned(e.path), {
        frameWidth: e.frameWidth,
        frameHeight: e.frameHeight,
      });
    }
    // Terrain map art (T13): Phaser rasterizes the .svg to a texture in-browser.
    for (const t of TERRAIN_ASSETS) {
      this.load.svg(t.key, versioned(t.path), {
        width: TERRAIN_TEX_SIZE,
        height: TERRAIN_TEX_SIZE,
      });
    }
    // Painted skill ability icons (96×96). Skip ids already in the manifest so a
    // future `gen.mjs --only=manifest` that folds them in won't double-load.
    for (const id of SKILL_ICON_IDS) {
      const key = skillTex(id);
      if (SPRITE_BY_KEY.has(key)) continue;
      this.load.spritesheet(key, versioned(`assets/sprites/skill/${id}.png`), {
        frameWidth: 96,
        frameHeight: 96,
      });
    }
    // Painted skill-jewel gem icons (96×96).
    for (const id of JEWEL_ICON_IDS) {
      const key = jewelTex(id);
      if (SPRITE_BY_KEY.has(key)) continue;
      this.load.spritesheet(key, versioned(`assets/sprites/jewel/${id}.png`), {
        frameWidth: 96,
        frameHeight: 96,
      });
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
    for (const id of [
      "battle",
      "summon",
      "collection",
      "inventory",
      "squad",
      "passive",
      "shop",
      "skills",
      "settings",
      "quests",
      "activities",
      "forge",
    ]) {
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
    // Per-achievement trophy medallions (SDXL). A missing file degrades to no
    // icon (AchievementScene gates on textures.exists) — never a __MISSING box.
    for (const a of ACHIEVEMENTS) {
      this.load.image(achievementTex(a.id), versioned(`assets/sprites/achievement/${a.id}.png`));
    }
    // Per-rarity gem emblems (SDXL). A missing file degrades to the procedural
    // faceted gem drawn by ExpeditionScene (textures.exists gate) — never a box.
    for (const r of RARITIES) {
      this.load.image(rarityTex(r), versioned(`assets/sprites/rarity/${r}.png`));
    }
    // Combat emblem on the home BATTLE CTA (SDXL). Gated by textures.exists in
    // drawBattleCta — a missing file degrades to no emblem, never a __MISSING box.
    this.load.image(battleEmblemTex(), versioned(`assets/sprites/ui/battle-emblem.png`));
    // Additive-blend VFX textures (box-open burst/glow/sparkle).
    for (const id of FX_IDS) this.load.image(fxTex(id), versioned(`assets/sprites/fx/${id}.png`));
    // Crafting-material icons (enhance jewels + summon scroll).
    for (const id of MATERIAL_ICON_IDS)
      this.load.image(materialTex(id), versioned(`assets/sprites/material/${id}.png`));
    // Every catalog item's 96×96 inventory icon (worn on the hero + shown in
    // inventory). Driven by the catalog so newly-added items load without a
    // manifest regen; skip any already provided by the sprite manifest.
    for (const it of ITEM_CATALOG) {
      const key = itemTex(it.id);
      if (SPRITE_BY_KEY.has(key)) continue;
      this.load.spritesheet(key, versioned(`assets/sprites/item/${it.id}.png`), {
        frameWidth: 96,
        frameHeight: 96,
      });
    }
    // Purpose-built worn-on-body overlays (128×128) for body-slot gear — the
    // hero "dressed" paper-doll wears these instead of the framed inventory icon
    // (heroDressLayout prefers worn__<id>, falls back to the icon when absent).
    // Catalog-driven + loaderror-swallowed, so a partial art batch loads safely.
    const wornBodySlots = new Set<string>(WORN_SLOTS);
    for (const it of ITEM_CATALOG) {
      if (!wornBodySlots.has(it.slot)) continue;
      this.load.spritesheet(wornTex(it.id), versioned(`assets/sprites/worn/${it.id}.png`), {
        frameWidth: 128,
        frameHeight: 128,
      });
    }
  }

  private _setupLoadingBar(): void {
    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2;
    const barW = 360;
    const barH = 10;

    // Procedural painted backdrop behind the bar. Drawn before the track so it
    // renders underneath; pure Graphics (no textures — none are loaded yet).
    const backdrop = createLoadingBackdrop(this);
    const tick = this.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => backdrop.update(this.time.now / 1000),
    });

    const track = this.add.graphics();
    track.fillStyle(0x1e2030, 1);
    track.fillRoundedRect(cx - barW / 2, cy - barH / 2, barW, barH, 5);

    const bar = this.add.graphics();

    const label = this.add
      .text(cx, cy + 28, "Loading…", { fontSize: "12px", color: "#6a6880" })
      .setOrigin(0.5);

    const title = this.add
      .text(cx, cy - 36, "Wibu Tower Defense", {
        fontSize: "22px",
        color: "#f0c060",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    let lastProgress = 0;

    this.load.on("progress", (value: number) => {
      // progress can temporarily decrease when files are queued mid-load
      lastProgress = Math.max(lastProgress, value);
      bar.clear();
      bar.fillStyle(0xf0c060, 1);
      bar.fillRoundedRect(cx - barW / 2, cy - barH / 2, barW * lastProgress, barH, 5);

      // Mirror into the DOM bar (visible before canvas is ready)
      const pct = Math.round(lastProgress * 100);
      const domFill = document.getElementById("loading-bar-fill");
      if (domFill) domFill.style.width = `${pct}%`;
      const domLabel = document.getElementById("loading-label");
      if (domLabel) domLabel.textContent = `Loading… ${pct}%`;
    });

    this.load.on("complete", () => {
      tick.remove();
      backdrop.destroy();
      bar.destroy();
      track.destroy();
      label.destroy();
      title.destroy();
      document.getElementById("loading-splash")?.remove();
    });
  }

  create(): void {
    for (const e of SPRITE_MANIFEST) {
      if (!this.textures.exists(e.key) || e.frames <= 1) continue;
      const idx = (re: RegExp) =>
        e.names
          .map((n, i) => ({ n, i }))
          .filter((x) => re.test(x.n))
          .map((x) => x.i);
      const mk = (suffix: string, frames: number[], frameRate: number, repeat: number) => {
        if (!frames.length) return;
        const key = `${e.key}_${suffix}`;
        if (this.anims.exists(key)) return;
        this.anims.create({
          key,
          frames: frames.map((f) => ({ key: e.key, frame: f })),
          frameRate,
          repeat,
        });
      };
      // Per-kind FPS: the hero gets the smoothest motion (more frames, faster).
      const k = e.kind;
      const idleFps = k === "hero" ? 5 : 4;
      const walkFps = k === "hero" ? 10 : 7;
      const atkFps = k === "hero" ? 12 : k === "boss" ? 9 : 11;
      mk("idle", idx(/idle/), idleFps, -1);
      mk("walk", idx(/walk/), walkFps, -1);
      mk("attack", idx(/atk/), atkFps, 0); // basic attack frames only
      mk("skill", idx(/skill/), 10, 0); // active-skill frames
      mk("hurt", idx(/hurt/), 8, 0);
    }
    // Enemies walk via the procedural transform (enemyWalkTransform.ts) on their
    // single static sprite — no baked walk frames (the wide warp sheet could flash
    // as a strip and its frames were near-identical anyway). Bosses keep a baked
    // stomp on a SEPARATE texture key (their base sheet stays for atk/skill poses).
    bakeBossWalks(this); // synthesize the heavy 4-frame stomp stride for bosses
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
