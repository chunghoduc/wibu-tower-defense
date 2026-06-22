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
import { drawPill, drawBattleSquare, drawEndlessSquare } from "./homeBarFx.ts";
import { fadeIn, fadeToScene } from "./uiKit.ts";
import { claimableQuestCount } from "../core/questTracker.ts";
import { towerTex, itemTex, menuTex } from "../data/assetKeys.ts";
import { HeroWeaponSprite } from "./HeroWeaponSprite.ts";
import { drawMenuGlyph } from "./menuGlyph.ts";
import { STAGES } from "../data/stage.ts";

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
  private heroSprite?: HeroWeaponSprite; // throne hero (battle art); re-init in create()
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
    this.heroSprite = undefined; // drawHero rebuilds it
    this.backdropFx = undefined; // drawBackdrop rebuilds it
    this.elapsed = 0;
    fadeIn(this);

    // Start the ambient music bed on the first gesture (Web Audio needs one).
    const set = mgr.getSettings();
    if (set.musicEnabled && !set.muted) this.input.once("pointerdown", () => music.start());

    this.drawBackdrop(W, H);
    this.drawHero(save, W, H);
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
    // Throne hero idles in place using the battle-hero procedural motion.
    this.heroSprite?.tick(t, false, false);
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

  private drawHero(save: ReturnType<SaveManager["getSave"]>, W: number, H: number): void {
    // The throne hero is the SAME art as the battle hero: a HeroWeaponSprite that
    // wears the equipped weapon's drawn combat art (+ wings) and animates its idle
    // procedurally — instead of the old static weapon-class pose. The pet keeps
    // its own free wander above the throne (drawPet), so we suppress this sprite's
    // built-in pet to avoid a double.
    const hero = new HeroWeaponSprite(this, W / 2, H * 0.5);
    hero.scaleToHeight(150).setDepth(2);
    hero.syncEquipment(save.inventory);
    hero.petSprite.setVisible(false);
    this.heroSprite = hero;
    // NOTE: equipped gear is also shown on the wall hangers (drawHangers).
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
    drawBattleSquare(this, PRIMARY_ITEM.label, PRIMARY_ITEM.scene, lay.battle);
    drawEndlessSquare(this, "ENDLESS", () => this.launchEndless(), lay.endless);
    LEFT_ITEMS.forEach((m, i) => this.iconButton(m, lay.left[i].x, lay.left[i].y));
    RIGHT_ITEMS.forEach((m, i) => this.iconButton(m, lay.right[i].x, lay.right[i].y));
    BOTTOM_ITEMS.forEach((m, i) => this.iconButton(m, lay.bottom[i].x, lay.bottom[i].y));
  }

  /** The most-progressed campaign stage the player has cleared on any difficulty
   *  (mirrors ActivitiesScene) — the arena endless mode reuses. */
  private latestClearedStage(): { id: string; idx: number } | null {
    const save = (this.registry.get("saveManager") as SaveManager).getSave();
    let best: { id: string; idx: number } | null = null;
    STAGES.forEach((st, i) => {
      const rec = save.progress.stageClearMap[st.id];
      if (rec && (rec.Normal || rec.Hard || rec.Nightmare)) best = { id: st.id, idx: i };
    });
    return best;
  }

  /** Launch the endless arena from the home screen: requires a cleared stage and
   *  a scaling gold entry cost. Gated paths surface a toast (the button is always
   *  visible so players discover endless mode exists). Sole entry point now that
   *  the Activities "Endless Survival" row was removed. */
  private launchEndless(): void {
    const mgr = this.registry.get("saveManager") as SaveManager;
    const cleared = this.latestClearedStage();
    if (!cleared) {
      this.showToast("Clear a campaign stage first");
      return;
    }
    const cost = mgr.endlessEntryCost(cleared.id);
    const paid = mgr.payEndlessEntry(cleared.id);
    if (paid < 0) {
      this.showToast(`Need 🪙${cost} gold to enter`);
      return;
    }
    const stage = STAGES.find((s) => s.id === cleared.id);
    if (!stage) return;
    this.registry.set("selectedStage", stage);
    this.registry.set("selectedDifficulty", "Nightmare");
    this.registry.set("battleMode", { kind: "endless" });
    fadeToScene(this, "BattleScene");
  }

  /** A brief centered toast at the bottom of the screen (gate feedback). */
  private showToast(msg: string): void {
    const t = crispText(this, this.scale.width / 2, this.scale.height - 150, msg, {
      fontSize: "15px",
      color: "#ffe6c0",
      fontStyle: "bold",
      stroke: "#1a0e08",
      strokeThickness: 4,
      align: "center",
    })
      .setOrigin(0.5)
      .setDepth(40)
      .setScale(0.7);
    this.tweens.add({ targets: t, scale: 1, duration: 200, ease: "Back.easeOut" });
    this.time.delayedCall(1700, () =>
      this.tweens.add({ targets: t, alpha: 0, duration: 400, onComplete: () => t.destroy() }),
    );
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
