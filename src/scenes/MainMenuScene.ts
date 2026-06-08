import Phaser from "phaser";
import type { SaveManager } from "../core/saveManager.ts";
import { music } from "./audio.ts";
import { dressHero } from "./dressHero.ts";
import { bgKey } from "../data/bgManifest.ts";
import { crispText } from "./ui.ts";
import { fadeIn, fadeToScene } from "./uiKit.ts";
import { claimableQuestCount } from "../core/questTracker.ts";

/** A menu destination: an icon-glyph button placed on the left/right/bottom edge. */
interface MenuItem {
  key: string;            // glyph id (see drawMenuGlyph)
  label: string;
  scene: string;
  side: "left" | "right" | "bottom";
}

const MENU_ITEMS: MenuItem[] = [
  { key: "battle", label: "Battle", scene: "StageSelectScene", side: "left" },
  { key: "summon", label: "Summon", scene: "GachaScene", side: "left" },
  { key: "collection", label: "Codex", scene: "CollectionScene", side: "left" },
  { key: "quests", label: "Quests", scene: "QuestScene", side: "left" },
  { key: "inventory", label: "Inventory", scene: "HeroScene", side: "right" },
  { key: "squad", label: "Squad", scene: "SquadScene", side: "right" },
  { key: "passive", label: "Passives", scene: "PassiveGridScene", side: "right" },
  { key: "shop", label: "Shop", scene: "ShopScene", side: "bottom" },
  { key: "skills", label: "Skills", scene: "SkillsScene", side: "bottom" },
  { key: "settings", label: "Settings", scene: "SettingsScene", side: "bottom" },
];

const BTN = 58; // icon button size

export class MainMenuScene extends Phaser.Scene {
  private badges: Record<string, number> = {};

  constructor() {
    super("MainMenuScene");
  }

  create(): void {
    const mgr: SaveManager = this.registry.get("saveManager");
    const today = new Date().toISOString().slice(0, 10);
    mgr.refreshQuests(today); // midnight rollover before we read claimable counts
    const save = mgr.getSave();
    this.badges = { quests: claimableQuestCount(save) };
    const W = this.scale.width, H = this.scale.height;
    fadeIn(this);

    // Start the ambient music bed on the first gesture (Web Audio needs one).
    const set = mgr.getSettings();
    if (set.musicEnabled && !set.muted) this.input.once("pointerdown", () => music.start());

    this.drawBackdrop(W, H);
    this.drawHeroAndSquad(save, W, H);
    this.drawHeader(mgr, save, W);
    this.drawMenu(W, H);
  }

  // ── backdrop ──────────────────────────────────────────────────────────────
  private drawBackdrop(W: number, H: number): void {
    if (this.textures.exists(bgKey("menu-hall"))) {
      this.add.image(W / 2, H / 2, bgKey("menu-hall")).setDisplaySize(W, H).setDepth(-10);
    } else {
      this.add.graphics().fillStyle(0x161b28, 1).fillRect(0, 0, W, H);
    }
    // gentle vignette/darken at edges so UI reads on top
    const v = this.add.graphics().setDepth(-9);
    v.fillStyle(0x05070c, 0.35).fillRect(0, 0, W, 70).fillRect(0, H - 96, W, 96);
  }

  // ── hero on the throne + squad standing in the hall ─────────────────────────
  private drawHeroAndSquad(save: ReturnType<SaveManager["getSave"]>, W: number, H: number): void {
    // Hero on the throne (centre dais), wearing the player's equipped outfit.
    if (this.textures.exists("hero__hero")) {
      const HERO_H = 104, cy = H * 0.45, originY = 0.8;
      const hero = this.add.sprite(W / 2, cy, "hero__hero").setOrigin(0.5, originY).setDepth(2);
      hero.setScale(HERO_H / hero.height);
      if (this.anims.exists("hero__hero_idle")) hero.play("hero__hero_idle");
      // Overlay equipped weapon / wings / armour / boots / gloves / pet on the body.
      dressHero(this, save.inventory, W / 2, cy - HERO_H * originY, HERO_H, 2);
    }

    // Up to 7 squad members in a shallow arc across the foreground hall.
    const owned = Object.keys(save.collection);
    const squad = (save.squad?.length ? save.squad : owned).slice(0, 7);
    const n = squad.length;
    squad.forEach((id, i) => {
      const key = `tower__${id}`;
      if (!this.textures.exists(key)) return;
      const tt = n > 1 ? i / (n - 1) : 0.5;          // 0..1 across the row
      const x = W * 0.16 + tt * W * 0.68;
      const y = H * 0.74 + Math.sin(tt * Math.PI) * -10; // slight arc
      const s = this.add.sprite(x, y, key).setOrigin(0.5, 0.85).setDepth(3);
      s.setScale(54 / s.height);
      if (this.anims.exists(`${key}_idle`)) s.play(`${key}_idle`);
    });
  }

  // ── title + crystals ────────────────────────────────────────────────────────
  private drawHeader(mgr: SaveManager, save: ReturnType<SaveManager["getSave"]>, W: number): void {
    const today = new Date().toISOString().slice(0, 10);
    const granted = mgr.grantDailyLogin(today);

    // Design-team crest emblem above the title (falls back to text-only).
    let titleY = 12;
    if (this.textures.exists("ui__logo")) {
      const logo = this.add.image(W / 2, 6, "ui__logo").setOrigin(0.5, 0).setDepth(5);
      logo.setScale(58 / logo.height);
      titleY = 62;
    }
    crispText(this, W / 2, titleY, "WIBU TOWER DEFENSE", { fontSize: "26px", color: "#ffe9a8", fontStyle: "bold", stroke: "#2a1c05", strokeThickness: 5 }).setOrigin(0.5, 0).setDepth(5);

    const crystals = crispText(this, W / 2, titleY + 34, `🪙 ${save.currency.gold}}`, { fontSize: "18px", color: "#bfe4ff", stroke: "#0a1420", strokeThickness: 4 }).setOrigin(0.5, 0).setDepth(5);
    if (granted > 0) {
      const bonus = crispText(this, W / 2, 80, `+${granted} daily bonus!`, { fontSize: "13px", color: "#a5f0b0" }).setOrigin(0.5, 0).setDepth(5);
      this.tweens.add({ targets: bonus, y: 72, alpha: 0, delay: 1400, duration: 900, onComplete: () => bonus.destroy() });
    }
    void crystals;
  }

  // ── icon-button menu on the left / right / bottom edges ──────────────────────
  private drawMenu(W: number, H: number): void {
    const left = MENU_ITEMS.filter((m) => m.side === "left");
    const right = MENU_ITEMS.filter((m) => m.side === "right");
    const bottom = MENU_ITEMS.filter((m) => m.side === "bottom");

    const colY = (count: number, i: number): number => {
      const gap = 86, total = (count - 1) * gap;
      return H * 0.46 - total / 2 + i * gap;
    };
    left.forEach((m, i) => this.iconButton(m, 46, colY(left.length, i)));
    right.forEach((m, i) => this.iconButton(m, W - 46, colY(right.length, i)));
    bottom.forEach((m, i) => {
      const gap = 120, total = (bottom.length - 1) * gap;
      this.iconButton(m, W / 2 - total / 2 + i * gap, H - 50);
    });
  }

  private iconButton(item: MenuItem, x: number, y: number): void {
    const c = this.add.container(x, y).setDepth(8);
    const iconKey = `menu__${item.key}`;
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
    c.add(crispText(this, 0, BTN / 2 - 6, item.label, { fontSize: "10px", color: "#ffe9c0", fontStyle: "bold", stroke: "#1a1206", strokeThickness: 3 }).setOrigin(0.5));

    // Red notification badge (e.g. claimable quest count) on the top-right corner.
    const badge = this.badges[item.key] ?? 0;
    if (badge > 0) {
      const bx = BTN / 2 - 8, by = -BTN / 2 + 8;
      const bg = this.add.graphics();
      bg.fillStyle(0xe6312b, 1).fillCircle(bx, by, 10);
      bg.lineStyle(1.5, 0xffd9c0, 0.9).strokeCircle(bx, by, 10);
      c.add(bg);
      c.add(crispText(this, bx, by, `${badge}`, { fontSize: "11px", color: "#ffffff", fontStyle: "bold" }).setOrigin(0.5));
    }

    const z = this.add.zone(0, 0, BTN, BTN).setInteractive({ useHandCursor: true });
    c.add(z);
    z.on("pointerover", () => this.tweens.add({ targets: c, scale: 1.12, duration: 130, ease: "Back.easeOut" }));
    z.on("pointerout", () => this.tweens.add({ targets: c, scale: 1, duration: 130, ease: "Sine.easeOut" }));
    z.on("pointerdown", () => {
      this.tweens.add({ targets: c, scale: 0.9, duration: 80, yoyo: true, onComplete: () => fadeToScene(this, item.scene) });
    });
  }
}

// ── procedural menu glyphs (white line/fill art, no assets) ────────────────────
function drawMenuGlyph(g: Phaser.GameObjects.Graphics, key: string, x: number, y: number, s: number): void {
  const W = 0xffe9a8, A = 0x8fd0ff;
  switch (key) {
    case "battle": // crossed swords
      g.lineStyle(2.4, W, 1).lineBetween(x - s, y + s, x + s, y - s).lineBetween(x + s, y + s, x - s, y - s);
      g.fillStyle(W, 1).fillCircle(x - s, y + s, 2).fillCircle(x + s, y + s, 2); break;
    case "summon": // gacha orb + sparkle
      g.fillStyle(A, 1).fillCircle(x, y, s * 0.8); g.fillStyle(0xffffff, 0.9).fillCircle(x - s * 0.3, y - s * 0.3, s * 0.22);
      g.fillStyle(W, 1).fillPoints(star4(x + s * 0.7, y - s * 0.7, s * 0.4, s * 0.16), true); break;
    case "collection": // open book
      g.fillStyle(0xcfe0f5, 1).fillRect(x - s, y - s * 0.7, s * 0.95, s * 1.4).fillRect(x + s * 0.05, y - s * 0.7, s * 0.95, s * 1.4);
      g.lineStyle(1.5, 0x44607f, 1).lineBetween(x, y - s * 0.7, x, y + s * 0.7); break;
    case "shop": // cart / bag
      g.fillStyle(W, 1).fillRoundedRect(x - s * 0.8, y - s * 0.4, s * 1.6, s * 1.1, 3);
      g.lineStyle(2, W, 1).beginPath(); g.arc(x, y - s * 0.4, s * 0.5, Math.PI, 0); g.strokePath(); break;
    case "passive": // node tree
      g.lineStyle(2, A, 1).lineBetween(x, y - s, x - s * 0.7, y + s * 0.6).lineBetween(x, y - s, x + s * 0.7, y + s * 0.6);
      g.fillStyle(W, 1).fillCircle(x, y - s, 3).fillCircle(x - s * 0.7, y + s * 0.6, 3).fillCircle(x + s * 0.7, y + s * 0.6, 3); break;
    case "hero": // helmet
      g.fillStyle(0xd6dded, 1).fillPoints([P(x - s * 0.8, y - s * 0.2), P(x - s * 0.5, y - s), P(x + s * 0.5, y - s), P(x + s * 0.8, y - s * 0.2), P(x + s * 0.8, y + s * 0.6), P(x - s * 0.8, y + s * 0.6)], true);
      g.fillStyle(0x101826, 1).fillRect(x - s * 0.15, y - s * 0.2, s * 0.3, s * 0.8); break;
    case "squad": // three figures
      for (const ox of [-s * 0.7, 0, s * 0.7]) { g.fillStyle(ox === 0 ? W : A, 1).fillCircle(x + ox, y - s * 0.4, s * 0.28); g.fillRect(x + ox - s * 0.26, y - s * 0.1, s * 0.52, s * 0.7); } break;
    case "quests": // scroll with a checkmark
      g.fillStyle(0xf2e2b8, 1).fillRoundedRect(x - s * 0.7, y - s * 0.9, s * 1.4, s * 1.8, 3);
      g.lineStyle(1.5, 0xb89a5e, 1).strokeRoundedRect(x - s * 0.7, y - s * 0.9, s * 1.4, s * 1.8, 3);
      for (let i = -1; i <= 1; i++) g.lineStyle(1.4, 0x9a7d4a, 1).lineBetween(x - s * 0.45, y + i * s * 0.4, x + s * 0.45, y + i * s * 0.4);
      g.lineStyle(2.6, 0x3fae5a, 1).beginPath(); g.moveTo(x - s * 0.35, y + s * 0.05); g.lineTo(x - s * 0.05, y + s * 0.4); g.lineTo(x + s * 0.5, y - s * 0.45); g.strokePath(); break;
    case "settings": // gear
      g.lineStyle(3.4, 0xd6dded, 1).strokeCircle(x, y, s * 0.55);
      for (let i = 0; i < 8; i++) { const a = (Math.PI / 4) * i; g.lineBetween(x + Math.cos(a) * s * 0.55, y + Math.sin(a) * s * 0.55, x + Math.cos(a) * s, y + Math.sin(a) * s); } break;
    default:
      g.fillStyle(W, 1).fillCircle(x, y, s * 0.6);
  }
}
const P = (x: number, y: number) => new Phaser.Geom.Point(x, y);
function star4(x: number, y: number, outer: number, inner: number): Phaser.Geom.Point[] {
  const pts: Phaser.Geom.Point[] = [];
  for (let i = 0; i < 8; i++) { const r = i % 2 ? inner : outer; const a = (Math.PI / 4) * i - Math.PI / 2; pts.push(P(x + Math.cos(a) * r, y + Math.sin(a) * r)); }
  return pts;
}
