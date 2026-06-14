import Phaser from "phaser";
import type { SaveManager } from "../core/saveManager.ts";
import { music } from "./audio.ts";
import {
  hangerLayout,
  equippedHangers,
  squadStand,
  squadStandPoints,
  petWander,
} from "./homeRoom.ts";
import { ITEM_CATALOG_MAP } from "../data/items.ts";
import { bgKey } from "../data/bgManifest.ts";
import { buildMenuAtmosphere } from "./menuAtmosphere.ts";
import { MenuBackdropFx } from "./menuBackdropFx.ts";
import { crispText } from "./ui.ts";
import { homeTopBar, homeNavLayout } from "./homeLayout.ts";
import { drawPill, drawBattleCta } from "./homeBarFx.ts";
import { fadeIn, fadeToScene } from "./uiKit.ts";
import { claimableQuestCount } from "../core/questTracker.ts";
import { towerTex, itemTex, menuTex } from "../data/assetKeys.ts";

/** A menu destination: a painted icon button in the bottom navigation dock. */
interface MenuItem {
  key: string; // painted icon id (+ drawMenuGlyph fallback id)
  label: string;
  scene: string;
}

// BATTLE is the hero call-to-action — a wide primary button in the bottom dock.
// The rest frame the diorama: a loadout rail on the left, an economy rail on the
// right, and a daily/system row across the bottom. Order within each list is the
// render order (rails top→bottom, bottom row left→right).
const PRIMARY_ITEM: MenuItem = { key: "battle", label: "BATTLE", scene: "StageSelectScene" };
const LEFT_ITEMS: MenuItem[] = [
  { key: "squad", label: "Squad", scene: "SquadScene" },
  { key: "inventory", label: "Inventory", scene: "HeroScene" },
  { key: "skills", label: "Skills", scene: "SkillsScene" },
  { key: "passive", label: "Passives", scene: "PassiveGridScene" },
];
const RIGHT_ITEMS: MenuItem[] = [
  { key: "summon", label: "Summon", scene: "GachaScene" },
  { key: "shop", label: "Shop", scene: "ShopScene" },
  { key: "forge", label: "Forge", scene: "ForgeScene" },
  { key: "collection", label: "Codex", scene: "CollectionScene" },
];
const BOTTOM_ITEMS: MenuItem[] = [
  { key: "quests", label: "Quests", scene: "QuestScene" },
  { key: "activities", label: "Activities", scene: "ActivitiesScene" },
  { key: "achievements", label: "Achievements", scene: "AchievementScene" },
  { key: "settings", label: "Settings", scene: "SettingsScene" },
];

const ATMOSPHERE_SEED = 4242; // stable look every time the menu is entered

export class MainMenuScene extends Phaser.Scene {
  private badges: Record<string, number> = {};
  private pet?: Phaser.GameObjects.Image; // re-init in create() (scene reuse)
  private backdropFx?: MenuBackdropFx; // re-init in create() (scene reuse)
  private elapsed = 0;

  constructor() {
    super("MainMenuScene");
  }

  create(): void {
    const mgr: SaveManager = this.registry.get("saveManager");
    const today = new Date().toISOString().slice(0, 10);
    mgr.refreshQuests(today); // midnight rollover before we read claimable counts
    const save = mgr.getSave();
    this.badges = { quests: claimableQuestCount(save), activities: mgr.activityBadgeCount() };
    const W = this.scale.width,
      H = this.scale.height;
    this.pet = undefined; // scene instances are reused — reset per-entry state
    this.backdropFx = undefined; // drawBackdrop rebuilds it
    this.elapsed = 0;
    fadeIn(this);

    // Start the ambient music bed on the first gesture (Web Audio needs one).
    const set = mgr.getSettings();
    if (set.musicEnabled && !set.muted) this.input.once("pointerdown", () => music.start());

    this.drawBackdrop(W, H);
    this.drawHero(W, H);
    this.drawHangers(save, W, H);
    this.drawSquad(save, W, H);
    this.drawPet(save, W, H);
    this.drawTopBar(mgr, save, W, H);
    this.drawMenu(W, H);
  }

  /** Pet wanders above the throne each frame (see homeRoom.petWander). */
  update(t: number, dtMs: number): void {
    this.elapsed += dtMs;
    this.backdropFx?.update(t);
    if (!this.pet) return;
    const p = petWander(this.elapsed, this.scale.width, this.scale.height);
    this.pet.setPosition(p.x, p.y);
    this.pet.setFlipX(p.faceLeft);
  }

  // ── backdrop ──────────────────────────────────────────────────────────────
  private drawBackdrop(W: number, H: number): void {
    if (this.textures.exists(bgKey("menu-hall"))) {
      this.add
        .image(W / 2, H / 2, bgKey("menu-hall"))
        .setDisplaySize(W, H)
        .setDepth(-10);
    } else {
      this.add.graphics().setDepth(-10).fillStyle(0x161b28, 1).fillRect(0, 0, W, H);
    }
    // Living throne-hall atmosphere: god-rays, dust, embers, key light, vignette.
    // Also darkens the painted hall so the lit diorama (throne + hero) reads as
    // the single focal subject (fixes the old double-throne clutter).
    this.backdropFx = new MenuBackdropFx(this, buildMenuAtmosphere(W, H, ATMOSPHERE_SEED));
  }

  private drawHero(W: number, H: number): void {
    if (!this.textures.exists("hero__hero")) return;
    const HERO_H = 104,
      cy = H * 0.5;
    const hero = this.add
      .sprite(W / 2, cy, "hero__hero")
      .setOrigin(0.5, 0.85)
      .setDepth(2);
    hero.setScale(HERO_H / hero.height);
    if (this.anims.exists("hero__hero_idle")) hero.play("hero__hero_idle");
    // NOTE: bare hero — no dressHero. Equipped gear is shown on the wall hangers.
  }

  // ── equipped gear hanging on the two side walls ─────────────────────────────
  private drawHangers(save: ReturnType<SaveManager["getSave"]>, W: number, H: number): void {
    const cells = hangerLayout(W, H);
    const items = equippedHangers(save.inventory);
    cells.forEach((cell, i) => {
      const it = items[i];
      if (!it || !this.textures.exists(it.iconKey)) return; // empty peg
      // Soft drop shadow under the floating gear (no procedural bar/rope).
      const shadow = this.add
        .image(cell.x, cell.y + 16, it.iconKey)
        .setOrigin(0.5, 0)
        .setDepth(3)
        .setTint(0x000000)
        .setAlpha(0.3);
      shadow.setScale(Math.min(34 / shadow.width, 34 / shadow.height));
      const img = this.add
        .image(cell.x, cell.y + 14, it.iconKey)
        .setOrigin(0.5, 0)
        .setDepth(4);
      img.setScale(Math.min(34 / img.width, 34 / img.height));
      this.tweens.add({
        targets: [img, shadow],
        angle: { from: -4, to: 4 },
        duration: 1600 + i * 90,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    });
  }

  // ── selected squad on the stage, or a Set Squad call-to-action ───────────────
  private drawSquad(save: ReturnType<SaveManager["getSave"]>, W: number, H: number): void {
    const stand = squadStand(save);
    if (stand.showSetSquad) {
      // Sit on the empty squad stage (the band where members would stand),
      // clear of the bottom dock and the hero above.
      const c = this.add.container(W / 2, H * 0.58).setDepth(6);
      const g = this.add.graphics();
      g.fillStyle(0x1c2740, 0.95).fillRoundedRect(-92, -22, 184, 44, 10);
      g.lineStyle(2, 0x4f7bd6, 1).strokeRoundedRect(-92, -22, 184, 44, 10);
      c.add(g);
      c.add(
        crispText(this, 0, 0, "⚔ Set Squad", {
          fontSize: "16px",
          color: "#cfe0ff",
          fontStyle: "bold",
        }).setOrigin(0.5),
      );
      const z = this.add.zone(0, 0, 184, 44).setInteractive({ useHandCursor: true });
      c.add(z);
      z.on("pointerover", () => this.tweens.add({ targets: c, scale: 1.08, duration: 120 }));
      z.on("pointerout", () => this.tweens.add({ targets: c, scale: 1, duration: 120 }));
      z.on("pointerdown", () =>
        this.tweens.add({
          targets: c,
          scale: 0.92,
          duration: 70,
          yoyo: true,
          onComplete: () => fadeToScene(this, "SquadScene"),
        }),
      );
      return;
    }
    const pts = squadStandPoints(stand.members.length, W, H);
    stand.members.forEach((id, i) => {
      const key = towerTex(id);
      if (!this.textures.exists(key)) return;
      const p = pts[i];
      // Depth by closeness (5.85..6.0) so front members occlude back members
      // cleanly — still below the pet (7) and the bottom dock (7/8).
      const s = this.add.sprite(p.x, p.y, key).setOrigin(0.5, 0.85).setDepth(5 + p.scale);
      s.setScale((54 * p.scale) / s.height);
      if (this.anims.exists(`${key}_idle`)) s.play(`${key}_idle`);
    });
  }

  // ── equipped pet flying above the throne ─────────────────────────────────────
  private drawPet(save: ReturnType<SaveManager["getSave"]>, W: number, H: number): void {
    const instId = save.inventory.equipped["Pet"];
    if (!instId) return;
    const inst = save.inventory.items.find((it) => it.id === instId);
    const def = inst ? ITEM_CATALOG_MAP.get(inst.defId) : undefined;
    const key = def ? itemTex(def.id) : "";
    if (!def || !this.textures.exists(key)) return;
    const p = petWander(0, W, H);
    this.pet = this.add.image(p.x, p.y, key).setOrigin(0.5).setDepth(7);
    this.pet.setScale(Math.min(40 / this.pet.width, 40 / this.pet.height));
  }

  // ── top resource bar (compact brand + framed gold/diamond pills) ─────────────
  private drawTopBar(
    mgr: SaveManager,
    save: ReturnType<SaveManager["getSave"]>,
    W: number,
    H: number,
  ): void {
    const today = new Date().toISOString().slice(0, 10);
    const granted = mgr.grantDailyLogin(today);
    const bar = homeTopBar(W, H);

    // Compact brand crest at top-left (falls back to a small wordmark).
    if (this.textures.exists("ui__logo")) {
      const logo = this.add.image(bar.brand.x, bar.brand.y, "ui__logo").setOrigin(0, 0).setDepth(5);
      logo.setScale(40 / logo.height);
    } else {
      crispText(this, bar.brand.x, bar.brand.y, "WIBU TD", {
        fontSize: "18px",
        color: "#ffe9a8",
        fontStyle: "bold",
        stroke: "#2a1c05",
        strokeThickness: 4,
      })
        .setOrigin(0, 0)
        .setDepth(5);
    }

    drawPill(this, bar.diamonds, "💎", `${save.currency.diamonds}`, "#bfe0ff");
    drawPill(this, bar.gold, "🪙", `${save.currency.gold}`, "#ffe6a8");

    if (granted > 0) {
      const bonus = crispText(
        this,
        bar.gold.x + bar.gold.w / 2,
        bar.gold.y + bar.gold.h + 6,
        `+${granted} daily bonus!`,
        { fontSize: "13px", color: "#a5f0b0" },
      )
        .setOrigin(0.5, 0)
        .setDepth(6);
      this.tweens.add({
        targets: bonus,
        y: bonus.y - 8,
        alpha: 0,
        delay: 1400,
        duration: 900,
        onComplete: () => bonus.destroy(),
      });
    }
  }

  // ── nav: side rails framing the diorama + bottom dock (primary + system row) ──
  private drawMenu(W: number, H: number): void {
    const lay = homeNavLayout(
      { left: LEFT_ITEMS.length, right: RIGHT_ITEMS.length, bottom: BOTTOM_ITEMS.length },
      W,
      H,
    );
    const p = lay.panel;
    this.add
      .graphics()
      .setDepth(7)
      .fillStyle(0x0c1120, 0.82)
      .fillRoundedRect(p.x, p.y, p.w, p.h, 16)
      .lineStyle(2, 0x3a567f, 0.9)
      .strokeRoundedRect(p.x, p.y, p.w, p.h, 16);
    drawBattleCta(this, PRIMARY_ITEM.label, PRIMARY_ITEM.scene, lay.primary);
    LEFT_ITEMS.forEach((m, i) => this.iconButton(m, lay.left[i].x, lay.left[i].y));
    RIGHT_ITEMS.forEach((m, i) => this.iconButton(m, lay.right[i].x, lay.right[i].y));
    BOTTOM_ITEMS.forEach((m, i) => this.iconButton(m, lay.bottom[i].x, lay.bottom[i].y));
  }

  private iconButton(item: MenuItem, x: number, y: number): void {
    const c = this.add.container(x, y).setDepth(8);
    const iconKey = menuTex(item.key);
    if (this.textures.exists(iconKey)) {
      // Painted SDXL icon (carries its own ornate frame).
      const img = this.add.image(0, -8, iconKey).setOrigin(0.5);
      img.setScale(Math.min(44 / img.width, 44 / img.height));
      c.add(img);
    } else {
      const g = this.add.graphics();
      g.fillStyle(0x101826, 0.92).fillRoundedRect(-22, -30, 44, 44, 10);
      g.lineStyle(2, 0x3a567f, 1).strokeRoundedRect(-22, -30, 44, 44, 10);
      drawMenuGlyph(g, item.key, 0, -8, 13);
      c.add(g);
    }
    c.add(
      crispText(this, 0, 18, item.label, {
        fontSize: "12px",
        color: "#ffe9c0",
        fontStyle: "bold",
        stroke: "#1a1206",
        strokeThickness: 3,
      }).setOrigin(0.5),
    );

    // Red notification badge (e.g. claimable quest count) on the top-right corner.
    const badge = this.badges[item.key] ?? 0;
    if (badge > 0) {
      const bx = 20,
        by = -28;
      const bg = this.add.graphics();
      bg.fillStyle(0xe6312b, 1).fillCircle(bx, by, 9);
      bg.lineStyle(1.5, 0xffd9c0, 0.9).strokeCircle(bx, by, 9);
      c.add(bg);
      c.add(
        crispText(this, bx, by, `${badge}`, {
          fontSize: "10px",
          color: "#ffffff",
          fontStyle: "bold",
        }).setOrigin(0.5),
      );
    }

    const z = this.add.zone(0, -4, 120, 56).setInteractive({ useHandCursor: true });
    c.add(z);
    z.on("pointerover", () =>
      this.tweens.add({ targets: c, scale: 1.12, duration: 130, ease: "Back.easeOut" }),
    );
    z.on("pointerout", () =>
      this.tweens.add({ targets: c, scale: 1, duration: 130, ease: "Sine.easeOut" }),
    );
    z.on("pointerdown", () => {
      this.tweens.add({
        targets: c,
        scale: 0.9,
        duration: 80,
        yoyo: true,
        onComplete: () => fadeToScene(this, item.scene),
      });
    });
  }
}

// ── procedural menu glyphs (white line/fill art, no assets) ────────────────────
function drawMenuGlyph(
  g: Phaser.GameObjects.Graphics,
  key: string,
  x: number,
  y: number,
  s: number,
): void {
  const W = 0xffe9a8,
    A = 0x8fd0ff;
  switch (key) {
    case "battle": // crossed swords
      g.lineStyle(2.4, W, 1)
        .lineBetween(x - s, y + s, x + s, y - s)
        .lineBetween(x + s, y + s, x - s, y - s);
      g.fillStyle(W, 1)
        .fillCircle(x - s, y + s, 2)
        .fillCircle(x + s, y + s, 2);
      break;
    case "summon": // gacha orb + sparkle
      g.fillStyle(A, 1).fillCircle(x, y, s * 0.8);
      g.fillStyle(0xffffff, 0.9).fillCircle(x - s * 0.3, y - s * 0.3, s * 0.22);
      g.fillStyle(W, 1).fillPoints(star4(x + s * 0.7, y - s * 0.7, s * 0.4, s * 0.16), true);
      break;
    case "collection": // open book
      g.fillStyle(0xcfe0f5, 1)
        .fillRect(x - s, y - s * 0.7, s * 0.95, s * 1.4)
        .fillRect(x + s * 0.05, y - s * 0.7, s * 0.95, s * 1.4);
      g.lineStyle(1.5, 0x44607f, 1).lineBetween(x, y - s * 0.7, x, y + s * 0.7);
      break;
    case "shop": // cart / bag
      g.fillStyle(W, 1).fillRoundedRect(x - s * 0.8, y - s * 0.4, s * 1.6, s * 1.1, 3);
      g.lineStyle(2, W, 1).beginPath();
      g.arc(x, y - s * 0.4, s * 0.5, Math.PI, 0);
      g.strokePath();
      break;
    case "passive": // node tree
      g.lineStyle(2, A, 1)
        .lineBetween(x, y - s, x - s * 0.7, y + s * 0.6)
        .lineBetween(x, y - s, x + s * 0.7, y + s * 0.6);
      g.fillStyle(W, 1)
        .fillCircle(x, y - s, 3)
        .fillCircle(x - s * 0.7, y + s * 0.6, 3)
        .fillCircle(x + s * 0.7, y + s * 0.6, 3);
      break;
    case "hero": // helmet
      g.fillStyle(0xd6dded, 1).fillPoints(
        [
          P(x - s * 0.8, y - s * 0.2),
          P(x - s * 0.5, y - s),
          P(x + s * 0.5, y - s),
          P(x + s * 0.8, y - s * 0.2),
          P(x + s * 0.8, y + s * 0.6),
          P(x - s * 0.8, y + s * 0.6),
        ],
        true,
      );
      g.fillStyle(0x101826, 1).fillRect(x - s * 0.15, y - s * 0.2, s * 0.3, s * 0.8);
      break;
    case "squad": // three figures
      for (const ox of [-s * 0.7, 0, s * 0.7]) {
        g.fillStyle(ox === 0 ? W : A, 1).fillCircle(x + ox, y - s * 0.4, s * 0.28);
        g.fillRect(x + ox - s * 0.26, y - s * 0.1, s * 0.52, s * 0.7);
      }
      break;
    case "quests": // scroll with a checkmark
      g.fillStyle(0xf2e2b8, 1).fillRoundedRect(x - s * 0.7, y - s * 0.9, s * 1.4, s * 1.8, 3);
      g.lineStyle(1.5, 0xb89a5e, 1).strokeRoundedRect(
        x - s * 0.7,
        y - s * 0.9,
        s * 1.4,
        s * 1.8,
        3,
      );
      for (let i = -1; i <= 1; i++)
        g.lineStyle(1.4, 0x9a7d4a, 1).lineBetween(
          x - s * 0.45,
          y + i * s * 0.4,
          x + s * 0.45,
          y + i * s * 0.4,
        );
      g.lineStyle(2.6, 0x3fae5a, 1).beginPath();
      g.moveTo(x - s * 0.35, y + s * 0.05);
      g.lineTo(x - s * 0.05, y + s * 0.4);
      g.lineTo(x + s * 0.5, y - s * 0.45);
      g.strokePath();
      break;
    case "activities": // calendar/star burst
      g.fillStyle(0xf2e2b8, 1).fillRoundedRect(x - s * 0.8, y - s * 0.7, s * 1.6, s * 1.4, 3);
      g.lineStyle(1.4, 0xb89a5e, 1).strokeRoundedRect(
        x - s * 0.8,
        y - s * 0.7,
        s * 1.6,
        s * 1.4,
        3,
      );
      g.fillStyle(W, 1).fillPoints(star4(x, y, s * 0.5, s * 0.2), true);
      g.lineStyle(1.4, 0x9a7d4a, 1).lineBetween(
        x - s * 0.8,
        y - s * 0.35,
        x + s * 0.8,
        y - s * 0.35,
      );
      break;
    case "forge": // anvil + spark
      g.fillStyle(0x9aa0ac, 1).fillRect(x - s * 0.7, y + s * 0.2, s * 1.4, s * 0.4);
      g.fillStyle(0x6a7079, 1).fillRect(x - s * 0.3, y + s * 0.55, s * 0.6, s * 0.35);
      g.fillStyle(W, 1).fillPoints(star4(x + s * 0.3, y - s * 0.4, s * 0.4, s * 0.16), true);
      break;
    case "achievements": { // trophy cup
      g.fillStyle(W, 1).fillRoundedRect(x - s * 0.55, y - s * 0.7, s * 1.1, s * 0.8, 3);
      g.lineStyle(2, W, 1).beginPath();
      g.arc(x - s * 0.75, y - s * 0.35, s * 0.32, Math.PI * 0.5, Math.PI * 1.5);
      g.strokePath();
      g.beginPath();
      g.arc(x + s * 0.75, y - s * 0.35, s * 0.32, Math.PI * 1.5, Math.PI * 0.5);
      g.strokePath();
      g.fillStyle(0xd6dded, 1).fillRect(x - s * 0.18, y + s * 0.1, s * 0.36, s * 0.5);
      g.fillStyle(W, 1).fillRect(x - s * 0.5, y + s * 0.6, s * 1.0, s * 0.22);
      break;
    }
    case "settings": // gear
      g.lineStyle(3.4, 0xd6dded, 1).strokeCircle(x, y, s * 0.55);
      for (let i = 0; i < 8; i++) {
        const a = (Math.PI / 4) * i;
        g.lineBetween(
          x + Math.cos(a) * s * 0.55,
          y + Math.sin(a) * s * 0.55,
          x + Math.cos(a) * s,
          y + Math.sin(a) * s,
        );
      }
      break;
    default:
      g.fillStyle(W, 1).fillCircle(x, y, s * 0.6);
  }
}
const P = (x: number, y: number) => new Phaser.Geom.Point(x, y);
function star4(x: number, y: number, outer: number, inner: number): Phaser.Geom.Point[] {
  const pts: Phaser.Geom.Point[] = [];
  for (let i = 0; i < 8; i++) {
    const r = i % 2 ? inner : outer;
    const a = (Math.PI / 4) * i - Math.PI / 2;
    pts.push(P(x + Math.cos(a) * r, y + Math.sin(a) * r));
  }
  return pts;
}
