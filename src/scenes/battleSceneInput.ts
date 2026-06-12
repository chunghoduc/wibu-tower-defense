/**
 * BattleScene input + right-panel + tower actions: pointer/keyboard handling,
 * drag-to-place ghosts, the hero/tower info-panel view models, tower
 * select/upgrade/sell flow, and the post-battle rewards screen. Methods are
 * merged onto the BattleScene prototype in `BattleScene.ts`; `this` is the scene.
 */
import Phaser from "phaser";
import type { Vec2 } from "../data/schema.ts";
import { type TowerRuntime, MANA_MAX } from "../core/battle.ts";
import { dist } from "../core/path.ts";
import { Rng } from "../core/rng.ts";
import { crispText } from "./ui.ts";
import { showBattleLootPanel } from "./rewardPanel.ts";
import { buildLootSummary } from "../data/rewardTiles.ts";
import { passiveInfo, towerActiveInfo } from "../data/passiveSkills.ts";
import { activeSkillDetail } from "../data/skillDescribe.ts";
import { upgradeSummary } from "../core/towerUpgrade.ts";
import type { HeroPanelVM, TowerPanelVM, PanelItem } from "./battleInfoPanel.ts";
import { ITEM_CATALOG_MAP } from "../data/items.ts";
import { ACTIVE_SKILLS_MAP } from "../data/skills.ts";
import { ITEM_SLOTS, type Rarity } from "../data/schema.ts";
import { WORLD_WIDTH, WORLD_HEIGHT } from "../data/stage.ts";
import { rewardLabel } from "../core/rewards.ts";
import { isoWeekKey } from "../core/meta.ts";
import { boxIdForTier } from "../data/materials.ts";
import {
  SLOT_RADIUS, RARITY_INT, statRows, HERO_STAT_KEYS, TOWER_STAT_KEYS,
} from "./battleSceneHelpers.ts";
import type { BattleScene } from "./BattleScene.ts";
import { towerTex, itemTex, skillTex } from "../data/assetKeys.ts";

export const inputMethods = {
  updateSpeedBtn(this: BattleScene): void {
    const label = this.gameSpeed === 0 ? "⏸ Paused" : `▶ ${this.gameSpeed}×`;
    this.speedBtn.setText(label).setBackgroundColor(this.gameSpeed === 0 ? "#5a3a2a" : "#243a5a");
  },

  /** Refresh the call-wave-early button each frame: show countdown + skip bounty. */
  refreshCallWaveBtn(this: BattleScene): void {
    // Early-clear auto-skip countdown takes the screen while it's running; the
    // manual ⏩ button is suppressed (getNextWaveIn returns -1) during it.
    const auto = this.battle.getAutoSkipIn();
    if (auto >= 0) this.autoSkipText.setVisible(true).setText(`Next wave in ${Math.ceil(auto)}…`);
    else this.autoSkipText.setVisible(false);

    const secs = this.battle.getNextWaveIn();
    if (secs < 0) { this.callWaveBtn.setVisible(false); return; }
    this.callWaveBtn.setVisible(true).setText(`⏩ Wave in ${Math.ceil(secs)}s  +${this.battle.skipReward()}g`);
  },

  /** Player tapped "call wave": spawn the next wave now, float the bonus gold. */
  onCallWave(this: BattleScene): void {
    const bonus = this.battle.callNextWave();
    if (bonus <= 0) return;
    this.sfx.coin();
    const pop = crispText(this, this.scale.width - 14, 56, `+${bonus}g`, { fontSize: "16px", color: "#ffe27a", fontStyle: "bold" })
      .setOrigin(1, 0).setDepth(60);
    this.ui.add(pop);
    this.tweens.add({ targets: pop, y: 38, alpha: 0, duration: 800, ease: "Cubic.out", onComplete: () => pop.destroy() });
    this.refreshCallWaveBtn();
  },

  /** WASD / arrow keys steer the hero (held = continuous movement). */
  handleKeyboardHero(this: BattleScene): void {
    const k = this.keys;
    if (!k || this.battle.outcome !== "ongoing" || !this.battle.hero.alive) return;
    let dx = 0, dy = 0;
    if (k.left.isDown || k.a.isDown) dx -= 1;
    if (k.right.isDown || k.d.isDown) dx += 1;
    if (k.up.isDown || k.w.isDown) dy -= 1;
    if (k.down.isDown || k.s.isDown) dy += 1;
    if (dx === 0 && dy === 0) return;
    const len = Math.hypot(dx, dy);
    const h = this.battle.hero.pos;
    this.battle.commandHero({
      x: Phaser.Math.Clamp(h.x + (dx / len) * 80, 4, WORLD_WIDTH - 4),
      y: Phaser.Math.Clamp(h.y + (dy / len) * 80, 4, WORLD_HEIGHT - 4),
    });
  },

  /** Drag an avatar onto the field to place its tower at a free spot (T12 + T14). */
  setupPlacementDrag(this: BattleScene): void {
    this.input.on("dragstart", (_p: Phaser.Input.Pointer, obj: Phaser.GameObjects.Container) => {
      if (!obj.getData || !obj.getData("towerId")) return;
      this.makeGhost(obj.getData("towerId"));
    });
    this.input.on("drag", (p: Phaser.Input.Pointer, obj: Phaser.GameObjects.Container, x: number, y: number) => {
      if (!obj.getData || !obj.getData("towerId")) return;
      obj.x = x; obj.y = y;
      this.updateGhost(obj.getData("towerId"), p);
    });
    this.input.on("dragend", (p: Phaser.Input.Pointer, obj: Phaser.GameObjects.Container) => {
      const id = obj.getData && obj.getData("towerId");
      if (!id) return;
      this.clearGhost();
      const wp = this.cameras.main.getWorldPoint(p.x, p.y);
      if (!this.panel.hitsPanel(p.x) && p.y < 500 && this.battle.outcome === "ongoing") {
        if (this.battle.placeTowerAt(id, { x: wp.x, y: wp.y })) this.sfx.place();
      }
      this.rebuildAvatarTiles(); // snap the dragged tile home (drag handlers stay registered)
    });
  },

  makeGhost(this: BattleScene, towerId: string): void {
    this.clearGhost();
    const g = this.add.container(0, 0).setDepth(7).setAlpha(0.7);
    const ring = this.add.graphics();
    g.add(ring); g.setData("ring", ring);
    const key = towerTex(towerId);
    if (this.textures.exists(key)) {
      const img = this.add.image(0, 0, key, 0).setOrigin(0.5, 0.78);
      img.setScale(50 / img.height); g.add(img);
    }
    this.world.add(g);
    this.placeGhost = g;
  },

  updateGhost(this: BattleScene, towerId: string, pointer: Phaser.Input.Pointer): void {
    if (!this.placeGhost) return;
    const wp = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    this.placeGhost.setPosition(wp.x, wp.y);
    const def = this.buildOrder.find((d) => d.id === towerId);
    const ok = pointer.y < 500 && this.battle.canPlaceAt({ x: wp.x, y: wp.y }) && !!def && this.battle.gold >= def.cost;
    const range = def ? this.battle.previewPlaceRange(def.id) : 130;
    const ring = this.placeGhost.getData("ring") as Phaser.GameObjects.Graphics;
    ring.clear();
    ring.lineStyle(1.5, ok ? 0x66ff88 : 0xff5a5a, 0.4).strokeCircle(0, 0, range);   // coverage preview
    ring.fillStyle(ok ? 0x66ff88 : 0xff5a5a, 0.06).fillCircle(0, 0, range);
    ring.lineStyle(2, ok ? 0x66ff88 : 0xff5a5a, 0.95).strokeCircle(0, 0, 16);        // footprint
  },

  clearGhost(this: BattleScene): void {
    this.placeGhost?.destroy(true);
    this.placeGhost = null;
  },

  bindInput(this: BattleScene): void {
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => { this.tapX = pointer.x; this.tapY = pointer.y; });
    // Command on RELEASE, and only for a genuine tap — so a drag-to-pan, a pinch,
    // a wheel-zoom or a tower-placement drag never also walks the hero.
    this.input.on("pointerup", (pointer: Phaser.Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[]) => {
      if (this.battle.outcome !== "ongoing") return;
      if (this.camCtl?.consumedGesture) return;                                   // pan / pinch / zoom gesture
      if (Math.hypot(pointer.x - this.tapX, pointer.y - this.tapY) > 8) return;    // a drag, not a tap
      // A tap on any interactive HUD/UI widget (speed & mute buttons, zoom
      // buttons, build-bar avatars, tower panel) must NOT command the hero.
      // Towers aren't interactive objects (tapped via towerAt), so tapping a
      // tower still falls through to the panel logic below.
      if (currentlyOver && currentlyOver.length > 0) return;
      if (this.panel.hitsPanel(pointer.x) || this.panel.hitsTab(pointer.x, pointer.y)) return; // over the panel / its tab
      if (pointer.y >= 500) return;          // bottom build-bar strip
      const wp = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const world: Vec2 = { x: wp.x, y: wp.y };

      // Tap a tower → show it in the panel + on-map quick actions. Tap empty
      // ground → revert the panel to the hero view and walk the hero there.
      const tower = this.towerAt(world);
      if (tower) { this.selectTower(tower.uid); return; }
      this.deselectTower();
      this.battle.commandHero(world);
    });
  },

  /** ＋ / − zoom buttons on the left edge (HUD camera; fixed while the view pans). */
  addZoomButtons(this: BattleScene): void {
    const mk = (y: number, label: string, onTap: () => void) => {
      const b = crispText(this, 14, y, label, { fontSize: "22px", color: "#fff", backgroundColor: "#243a5a", fontStyle: "bold" })
        .setOrigin(0, 0.5).setPadding(9, 3, 9, 5).setDepth(50).setInteractive({ useHandCursor: true });
      b.on("pointerdown", onTap);
      this.ui.add(b);
    };
    mk(this.scale.height - 150, "+", () => this.camCtl?.zoomStep(true));
    mk(this.scale.height - 110, "−", () => this.camCtl?.zoomStep(false));
  },

  /** The alive tower under a tap, if any. */
  towerAt(this: BattleScene, world: Vec2): TowerRuntime | null {
    for (const t of this.battle.towers) {
      if (t.alive && dist(world, t.pos) <= SLOT_RADIUS) return t;
    }
    return null;
  },

  /** Convert a world point to its on-screen pixel position under the battle camera. */
  worldToScreen(this: BattleScene, wx: number, wy: number): { x: number; y: number } {
    const cam = this.cameras.main;
    return { x: (wx - cam.worldView.x) * cam.zoom + cam.x, y: (wy - cam.worldView.y) * cam.zoom + cam.y };
  },

  /** Build the hero view model (the default panel content). */
  heroVM(this: BattleScene): HeroPanelVM {
    const save = this.saveManager.getSave();
    const h = this.battle.hero;
    const items: Record<string, PanelItem> = {};
    for (const slot of ITEM_SLOTS) {
      const instId = save.inventory.equipped[slot];
      const inst = instId ? save.inventory.items.find((it) => it.id === instId) : undefined;
      const def = inst ? ITEM_CATALOG_MAP.get(inst.defId) : undefined;
      if (!inst || !def) continue;
      items[slot] = { iconKey: itemTex(inst.defId), name: def.name, plus: inst.enhanceLevel ?? 0, rarityColor: RARITY_INT[def.rarity as Rarity] };
    }
    const skills = save.hero.equippedSkillIds
      .map((id) => ({ id, def: ACTIVE_SKILLS_MAP.get(id) }))
      .filter((e) => e.def)
      .map((e) => ({ label: `⚡ ${e.def!.name}`, desc: e.def!.description, color: "#a8d8ff", iconKey: skillTex(e.id) }));
    return {
      kind: "hero", name: "Hero", level: save.hero.level,
      hp: h.hp, maxHp: h.stats.maxHp, mana: h.mana, maxMana: MANA_MAX,
      stats: statRows(h.stats as unknown as Record<string, number>, HERO_STAT_KEYS),
      items, skills,
    };
  },

  /** Build a tower view model from its runtime. */
  towerVM(this: BattleScene, t: TowerRuntime): TowerPanelVM {
    const skills: { label: string; desc: string; color: string; iconKey?: string }[] = [];
    if (t.def.active) { const a = towerActiveInfo(t.def.active); skills.push({ label: `⚡ ${a.name}`, desc: activeSkillDetail(t.def, t.stats), color: "#a8d8ff", iconKey: skillTex(t.def.active) }); }
    for (const pid of t.def.passives) { const p = passiveInfo(pid); skills.push({ label: `• ${p.name}`, desc: p.description, color: "#cdd6e6", iconKey: skillTex(pid) }); }
    skills.push({ label: "▲ Upgrades", desc: upgradeSummary(t.def.role), color: "#ffd86a" });
    return {
      kind: "tower", uid: t.uid, name: t.def.name, iconKey: towerTex(t.def.id),
      stars: t.battleLevel + 1, // ★1 freshly placed → ★3 maxed
      hp: t.hp, maxHp: t.stats.maxHp, mana: t.mana, maxMana: t.def.role !== "support" ? MANA_MAX : 0,
      stats: statRows(t.stats as unknown as Record<string, number>, TOWER_STAT_KEYS),
      skills,
      upgradeCost: this.battle.upgradeCost(t.uid), sellValue: this.battle.sellValue(t.uid),
      maxed: this.battle.upgradeCost(t.uid) === 0,
    };
  },

  showTowerPanel(this: BattleScene, t: TowerRuntime): void {
    const uid = t.uid;
    this.panel.showTower(this.towerVM(t), {
      onUpgrade: () => this.doUpgrade(uid),
      onSell: () => this.confirmSell(uid),
      onUpgradeHover: (over) => { this.rangePreviewUid = over ? uid : -1; },
    });
  },

  /** Toggle button on the panel edge: collapse, or expand (showing the hero by default). */
  togglePanel(this: BattleScene): void {
    if (this.panel.isOpen()) { this.panel.setOpen(false); }
    else { if (this.selectedTowerUid < 0) this.panel.showHero(this.heroVM()); this.panel.setOpen(true); }
  },

  /** Select a tower: open the panel with its info + on-map quick-action icons. */
  selectTower(this: BattleScene, uid: number): void {
    const t = this.battle.towers.find((x) => x.uid === uid && x.alive);
    if (!t) return;
    this.selectedTowerUid = uid;
    this.showTowerPanel(t);
    this.panel.setOpen(true);
    this.buildQuickActions(t);
  },

  /** Drop the tower selection: revert the panel to the hero view + remove quick actions. */
  deselectTower(this: BattleScene): void {
    if (this.selectedTowerUid < 0) return;
    this.selectedTowerUid = -1;
    this.rangePreviewUid = -1;
    this.quickActions?.destroy(true);
    this.quickActions = null;
    this.panel.showHero(this.heroVM());
  },

  doUpgrade(this: BattleScene, uid: number): void {
    if (this.battle.upgradeTower(uid)) {
      const t = this.battle.towers.find((x) => x.uid === uid);
      if (t) { this.fx.starUp(t.pos, t.battleLevel); this.sfx.place(); this.showTowerPanel(t); this.buildQuickActions(t); }
    }
  },

  /** Ask before selling a tower — selling is irreversible and refunds < cost. */
  confirmSell(this: BattleScene, uid: number): void {
    const t = this.battle.towers.find((x) => x.uid === uid && x.alive);
    if (!t) return;
    this.confirmDialog?.destroy(true);
    const W = this.scale.width, H = this.scale.height;
    const refund = this.battle.sellValue(uid);
    const c = this.add.container(0, 0).setDepth(70);

    const dim = this.add.graphics();
    dim.fillStyle(0x000000, 0.55).fillRect(0, 0, W, H);
    const dimZone = this.add.zone(W / 2, H / 2, W, H).setInteractive().on("pointerup", () => this.closeConfirm());
    c.add([dim, dimZone]);

    const bw = 300, bh = 132, bx = (W - bw) / 2, by = (H - bh) / 2;
    const panel = this.add.graphics();
    panel.fillStyle(0x141c28, 0.99).fillRoundedRect(bx, by, bw, bh, 10);
    panel.lineStyle(2, 0x7a2e2e, 1).strokeRoundedRect(bx, by, bw, bh, 10);
    const panelZone = this.add.zone(bx + bw / 2, by + bh / 2, bw, bh).setInteractive(); // swallow clicks
    c.add([panel, panelZone]);

    c.add(crispText(this, W / 2, by + 18, "Sell this tower?", { fontSize: "16px", color: "#ffffff", fontStyle: "bold" }).setOrigin(0.5, 0));
    c.add(crispText(this, W / 2, by + 44, `${t.def.name}\nRefund +${refund}g`, { fontSize: "12px", color: "#ffd6a0", align: "center" }).setOrigin(0.5, 0));

    const yes = crispText(this, bx + bw / 2 - 70, by + bh - 34, "Sell", { fontSize: "14px", color: "#fff", backgroundColor: "#7a2e2e", fixedWidth: 96, align: "center" })
      .setOrigin(0.5, 0).setPadding(0, 8, 0, 8).setInteractive({ useHandCursor: true });
    yes.on("pointerup", () => { this.closeConfirm(); this.doSell(uid); });
    const no = crispText(this, bx + bw / 2 + 70, by + bh - 34, "Cancel", { fontSize: "14px", color: "#fff", backgroundColor: "#33415a", fixedWidth: 96, align: "center" })
      .setOrigin(0.5, 0).setPadding(0, 8, 0, 8).setInteractive({ useHandCursor: true });
    no.on("pointerup", () => this.closeConfirm());
    c.add([yes, no]);

    this.ui.add(c);
    this.confirmDialog = c;
  },

  closeConfirm(this: BattleScene): void {
    this.confirmDialog?.destroy(true);
    this.confirmDialog = null;
  },

  doSell(this: BattleScene, uid: number): void {
    this.battle.sellTower(uid);
    this.time.delayedCall(0, () => this.deselectTower());
  },

  /** Two compact upgrade/sell icons floating above the selected tower (UI layer, crisp). */
  buildQuickActions(this: BattleScene, t: TowerRuntime): void {
    this.quickActions?.destroy(true);
    const s = this.worldToScreen(t.pos.x, t.pos.y - 22);
    const c = this.add.container(s.x, s.y).setDepth(48);
    const mk = (dx: number, glyph: string, cost: string, bg: number, onClick: () => void, onHover?: (over: boolean) => void): void => {
      const g = this.add.graphics();
      g.fillStyle(bg, 0.96).fillRoundedRect(dx - 19, -13, 38, 26, 5);
      g.lineStyle(1.5, 0xffffff, 0.55).strokeRoundedRect(dx - 19, -13, 38, 26, 5);
      c.add(g);
      c.add(crispText(this, dx, -11, glyph, { fontSize: "12px", color: "#fff", fontStyle: "bold" }).setOrigin(0.5, 0));
      c.add(crispText(this, dx, 2, cost, { fontSize: "8px", color: "#ffe7a0" }).setOrigin(0.5, 0));
      // Interactive zone uses CONTAINER-RELATIVE coords so the click lands on the
      // icon (and the scene's pointerdown bails on currentlyOver → hero won't move).
      const z = this.add.zone(dx, 0, 38, 26).setInteractive({ useHandCursor: true });
      z.on("pointerup", onClick);
      if (onHover) { z.on("pointerover", () => onHover(true)); z.on("pointerout", () => onHover(false)); }
      c.add(z);
    };
    const cost = this.battle.upgradeCost(t.uid);
    // Hovering the upgrade icon reveals this tower's attack range ring.
    mk(-21, "⬆", cost === 0 ? "MAX" : `${cost}g`, cost === 0 ? 0x555555 : 0x1565c0,
      () => this.doUpgrade(t.uid), (over) => { this.rangePreviewUid = over ? t.uid : -1; });
    mk(22, "✕", `+${this.battle.sellValue(t.uid)}g`, 0x7a2e2e, () => this.confirmSell(t.uid));
    this.ui.add(c);
    this.quickActions = c;
  },

  /**
   * Show the post-battle loot screen (win OR loss). It merges loot gathered
   * during the run (item/box drops + XP from kills, kept even on a loss) with
   * the stage-clear rewards (won only), rendering every reward as an icon tile
   * with hover detail. Runs once per battle.
   */
  showBattleRewards(this: BattleScene, outcome: "won" | "lost"): void {
    if (this._rewardsShown) return;
    this._rewardsShown = true;
    this._victoryProcessed = true;

    // afterBattle persists the stage-clear rewards and returns them (won only).
    const clear = outcome === "won"
      ? this.saveManager.afterBattle(this.stage.id, "won", this.battle.difficulty, new Rng(Date.now()))
      : null;

    // Special-mode payouts layered on top of the normal stage rewards.
    let modeNote = "";
    const wavesReached = Math.max(0, this.battle.waveIndex + 1);
    if (this.battleMode.kind === "challenge" && outcome === "won") {
      const r = this.saveManager.claimChallengeClear(new Date().toISOString().slice(0, 10));
      if (r) modeNote = `Daily Challenge cleared! ${rewardLabel(r)}`;
    } else if (this.battleMode.kind === "endless") {
      const { reward, isBest } = this.saveManager.claimEndlessRun(this.stage.id, wavesReached);
      const gained = rewardLabel(reward);
      modeNote = `Endless: reached wave ${wavesReached}${isBest ? " — new best!" : ""}${gained ? ` · ${gained}` : ""}`;
    } else if (this.battleMode.kind === "bossrush") {
      // Tier = bosses actually DEFEATED (fully-cleared gauntlet waves), never the
      // raw wave index — so the top weekly prize requires beating the whole rush.
      const tier = this.battle.wavesCleared;
      const r = this.saveManager.recordBossRushTier(isoWeekKey(new Date()), tier);
      modeNote = `Boss Rush: tier ${tier}${rewardLabel(r) ? ` · ${rewardLabel(r)}` : ""}`;
    }
    // F14 flawless victory → a bonus boss chest.
    if (outcome === "won" && this.battleMode.kind === "normal" && this.battle.wasFlawless()) {
      this.saveManager.addMaterial(boxIdForTier(3), 1);
      modeNote = "Flawless! +1 Rare Boss Chest";
    }

    const summary = buildLootSummary(outcome, this.battle.battleLoot, clear);
    this.ui.add(showBattleLootPanel(this, summary, this.battleW / 2, 182));
    if (modeNote) this.ui.add(crispText(this, this.battleW / 2, 150, modeNote, { fontSize: "14px", color: "#ffe07a", fontStyle: "bold", stroke: "#1a1206", strokeThickness: 4 }).setOrigin(0.5).setDepth(40));
  },
};

export type InputMethods = typeof inputMethods;
