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
import { fadeIn, fadeToScene } from "./uiKit.ts";
import { claimableQuestCount } from "../core/questTracker.ts";
import { towerTex, itemTex, menuTex } from "../data/assetKeys.ts";

/** A menu destination: an icon-glyph button placed on the left/right/bottom edge. */
interface MenuItem {
  key: string; // glyph id (see drawMenuGlyph)
  label: string;
  scene: string;
  side: "left" | "right" | "bottom";
}

const MENU_ITEMS: MenuItem[] = [
  { key: "battle", label: "Battle", scene: "StageSelectScene", side: "left" },
  { key: "summon", label: "Summon", scene: "GachaScene", side: "left" },
  { key: "collection", label: "Codex", scene: "CollectionScene", side: "left" },
  { key: "quests", label: "Quests", scene: "QuestScene", side: "left" },
  { key: "activities", label: "Activities", scene: "ActivitiesScene", side: "left" },
  { key: "inventory", label: "Inventory", scene: "HeroScene", side: "right" },
  { key: "squad", label: "Squad", scene: "SquadScene", side: "right" },
  { key: "passive", label: "Passives", scene: "PassiveGridScene", side: "right" },
  { key: "shop", label: "Shop", scene: "ShopScene", side: "bottom" },
  { key: "skills", label: "Skills", scene: "SkillsScene", side: "bottom" },
  { key: "forge", label: "Forge", scene: "ForgeScene", side: "bottom" },
  { key: "settings", label: "Settings", scene: "SettingsScene", side: "bottom" },
];

const BTN = 58; // icon button size
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
    this.drawThrone(W, H);
    this.drawHero(W, H);
    this.drawHangers(save, W, H);
    this.drawSquad(save, W, H);
    this.drawPet(save, W, H);
    this.drawHeader(mgr, save, W);
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

  // ── procedural king's chair + dais ("the stage") ─────────────────────────────
  private drawThrone(W: number, H: number): void {
    const cx = W / 2,
      seatY = H * 0.5;
    const g = this.add.graphics().setDepth(1);
    // dais slab (the stage the squad stands on)
    g.fillStyle(0x2a2030, 1).fillRoundedRect(cx - 150, H * 0.7, 300, 30, 8);
    g.fillStyle(0x3a2c44, 1).fillRoundedRect(cx - 130, H * 0.685, 260, 16, 6);
    // chair back
    g.fillStyle(0x6a4a1c, 1).fillRoundedRect(cx - 46, seatY - 132, 92, 150, 10);
    g.fillStyle(0x8a6526, 1).fillRoundedRect(cx - 38, seatY - 124, 76, 134, 8);
    g.fillStyle(0x7a1f2a, 1).fillRoundedRect(cx - 30, seatY - 116, 60, 118, 6); // cushion
    // crown finials
    g.fillStyle(0xe8c44c, 1);
    for (const ox of [-46, 0, 46])
      g.fillTriangle(cx + ox - 9, seatY - 132, cx + ox + 9, seatY - 132, cx + ox, seatY - 156);
    // seat + arms
    g.fillStyle(0x8a6526, 1).fillRoundedRect(cx - 52, seatY - 8, 104, 22, 6);
    g.fillStyle(0x6a4a1c, 1)
      .fillRoundedRect(cx - 56, seatY - 30, 12, 44, 4)
      .fillRoundedRect(cx + 44, seatY - 30, 12, 44, 4);
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
      const g = this.add.graphics().setDepth(3);
      g.fillStyle(0x4a3a2a, 1).fillRoundedRect(cell.x - 16, cell.y - 6, 32, 6, 3); // wall bar
      g.fillStyle(0x6a5238, 1).fillCircle(cell.x, cell.y - 3, 3); // hook
      const it = items[i];
      if (!it || !this.textures.exists(it.iconKey)) return; // empty peg
      g.lineStyle(2, 0x9a8a6a, 1).lineBetween(cell.x, cell.y, cell.x, cell.y + 14); // rope
      const img = this.add
        .image(cell.x, cell.y + 14, it.iconKey)
        .setOrigin(0.5, 0)
        .setDepth(4);
      img.setScale(Math.min(34 / img.width, 34 / img.height));
      this.tweens.add({
        targets: img,
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
      const c = this.add.container(W / 2, H * 0.74).setDepth(6);
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
      const s = this.add.sprite(p.x, p.y, key).setOrigin(0.5, 0.85).setDepth(5);
      s.setScale(54 / s.height);
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

  // ── title + crystals ────────────────────────────────────────────────────────
  private drawHeader(mgr: SaveManager, save: ReturnType<SaveManager["getSave"]>, W: number): void {
    const today = new Date().toISOString().slice(0, 10);
    const granted = mgr.grantDailyLogin(today);

    // Design-team crest emblem above the title (falls back to text-only).
    let titleY = 12;
    if (this.textures.exists("ui__logo")) {
      const logo = this.add
        .image(W / 2, 6, "ui__logo")
        .setOrigin(0.5, 0)
        .setDepth(5);
      logo.setScale(58 / logo.height);
      titleY = 62;
    }
    crispText(this, W / 2, titleY, "WIBU TOWER DEFENSE", {
      fontSize: "26px",
      color: "#ffe9a8",
      fontStyle: "bold",
      stroke: "#2a1c05",
      strokeThickness: 5,
    })
      .setOrigin(0.5, 0)
      .setDepth(5);

    const crystals = crispText(this, W / 2, titleY + 34, `🪙 ${save.currency.gold}`, {
      fontSize: "18px",
      color: "#bfe4ff",
      stroke: "#0a1420",
      strokeThickness: 4,
    })
      .setOrigin(0.5, 0)
      .setDepth(5);
    if (granted > 0) {
      const bonus = crispText(this, W / 2, 80, `+${granted} daily bonus!`, {
        fontSize: "13px",
        color: "#a5f0b0",
      })
        .setOrigin(0.5, 0)
        .setDepth(5);
      this.tweens.add({
        targets: bonus,
        y: 72,
        alpha: 0,
        delay: 1400,
        duration: 900,
        onComplete: () => bonus.destroy(),
      });
    }
    void crystals;
  }

  // ── icon-button menu on the left / right / bottom edges ──────────────────────
  private drawMenu(W: number, H: number): void {
    const left = MENU_ITEMS.filter((m) => m.side === "left");
    const right = MENU_ITEMS.filter((m) => m.side === "right");
    const bottom = MENU_ITEMS.filter((m) => m.side === "bottom");

    const colY = (count: number, i: number): number => {
      const gap = 86,
        total = (count - 1) * gap;
      return H * 0.46 - total / 2 + i * gap;
    };
    left.forEach((m, i) => this.iconButton(m, 46, colY(left.length, i)));
    right.forEach((m, i) => this.iconButton(m, W - 46, colY(right.length, i)));
    bottom.forEach((m, i) => {
      const gap = 120,
        total = (bottom.length - 1) * gap;
      this.iconButton(m, W / 2 - total / 2 + i * gap, H - 50);
    });
  }

  private iconButton(item: MenuItem, x: number, y: number): void {
    const c = this.add.container(x, y).setDepth(8);
    const iconKey = menuTex(item.key);
    if (this.textures.exists(iconKey)) {
      // Painted SDXL icon (carries its own ornate frame).
      const img = this.add.image(0, -3, iconKey).setOrigin(0.5);
      img.setScale(Math.min(56 / img.width, 56 / img.height));
      c.add(img);
    } else {
      const g = this.add.graphics();
      g.fillStyle(0x101826, 0.92).fillRoundedRect(-BTN / 2, -BTN / 2, BTN, BTN, 12);
      g.lineStyle(2, 0x3a567f, 1).strokeRoundedRect(-BTN / 2, -BTN / 2, BTN, BTN, 12);
      drawMenuGlyph(g, item.key, 0, -4, 15);
      c.add(g);
    }
    c.add(
      crispText(this, 0, BTN / 2 - 6, item.label, {
        fontSize: "10px",
        color: "#ffe9c0",
        fontStyle: "bold",
        stroke: "#1a1206",
        strokeThickness: 3,
      }).setOrigin(0.5),
    );

    // Red notification badge (e.g. claimable quest count) on the top-right corner.
    const badge = this.badges[item.key] ?? 0;
    if (badge > 0) {
      const bx = BTN / 2 - 8,
        by = -BTN / 2 + 8;
      const bg = this.add.graphics();
      bg.fillStyle(0xe6312b, 1).fillCircle(bx, by, 10);
      bg.lineStyle(1.5, 0xffd9c0, 0.9).strokeCircle(bx, by, 10);
      c.add(bg);
      c.add(
        crispText(this, bx, by, `${badge}`, {
          fontSize: "11px",
          color: "#ffffff",
          fontStyle: "bold",
        }).setOrigin(0.5),
      );
    }

    const z = this.add.zone(0, 0, BTN, BTN).setInteractive({ useHandCursor: true });
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
