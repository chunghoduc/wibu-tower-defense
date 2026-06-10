/**
 * SquadScene (T4) — build the battle squad. A row of 7 ordered squad SLOTS, a
 * Hero card, a filter/sort bar, and an inventory grid of every collected
 * character on the left; a CHARACTER INFO panel on the right.
 *
 * Interaction: CLICK a character (hero card, slot, or grid tile) to SELECT it and
 * show its info in the right panel. DRAG-DROP a grid character onto a slot to add
 * or swap squad members; drop a slotted character anywhere off the slots to
 * remove it. A compact active-skill picker sits at the bottom.
 */
import Phaser from "phaser";
import { fadeIn, fadeToScene } from "./uiKit.ts";
import type { SaveManager } from "../core/saveManager.ts";
import { getTowerStars, getTowerCopies, starUpCost } from "../core/collection.ts";
import { TOWERS } from "../data/towers.ts";
import { ACTIVE_SKILLS_MAP } from "../data/skills.ts";
import { TOWER_ROLES, type Rarity, type TowerRole, type CharacterDef } from "../data/schema.ts";
import { crispText } from "./ui.ts";
import { renderCharInfo, renderHeroInfo } from "./squadInfoPanel.ts";

const RARITY_HEX: Record<Rarity, string> = {
  Common: "#9e9e9e", Magic: "#2196f3", Rare: "#9c27b0", Legendary: "#ff9800", Unique: "#f44336",
};
const RARITY_INT: Record<Rarity, number> = {
  Common: 0x9e9e9e, Magic: 0x2196f3, Rare: 0x9c27b0, Legendary: 0xff9800, Unique: 0xf44336,
};
const RARITY_ORDER: Record<Rarity, number> = { Common: 0, Magic: 1, Rare: 2, Legendary: 3, Unique: 4 };
// Damage-type accent colours: a coloured frame around a skill chip tells the
// player at a glance whether it deals Physical, Magic or True damage.
const DMG_INT: Record<string, number> = { Physical: 0xff8a65, Magic: 0xb39ddb, True: 0xfff176 };
const ROLE_LABEL: Record<TowerRole, string> = {
  damage: "Dmg", splash: "Splash", chain: "Chain", dot: "DoT", debuff: "Debuff", support: "Support", tanker: "Tank",
};
const SQUAD_MAX = 7;
const HERO_SEL = "__hero__";
type SortKey = "rarity" | "name";

// Layout: left column for slots + grid, right column for the info panel.
const PANEL_X = 726, PANEL_W = 226, PANEL_Y = 36, PANEL_H = 466;

export class SquadScene extends Phaser.Scene {
  private mgr!: SaveManager;
  private slots: (string | null)[] = [];
  private roleFilter: TowerRole | null = null;
  private sortKey: SortKey = "rarity";
  private didDrag = false;
  private selectedId: string = HERO_SEL;
  private dyn!: Phaser.GameObjects.Container;
  private slotLayer!: Phaser.GameObjects.Container;
  private panel!: Phaser.GameObjects.Container;
  private filterTabs: Phaser.GameObjects.Text[] = [];
  private slotZones: Phaser.GameObjects.Zone[] = [];

  constructor() { super("SquadScene"); }

  /** Where "Back" returns — the stage-select if we came from a pre-battle
   *  loadout edit, otherwise the main menu. Consumed (cleared) on read. */
  private backScene(): string {
    const back = (this.registry.get("loadoutReturnScene") as string) ?? "MainMenuScene";
    this.registry.set("loadoutReturnScene", undefined);
    return back;
  }

  create(): void {
    fadeIn(this);
    this.mgr = this.registry.get("saveManager");
    const save = this.mgr.getSave();
    this.slots = Array.from({ length: SQUAD_MAX }, (_, i) => save.squad?.[i] ?? null);
    this.roleFilter = null; this.sortKey = "rarity"; this.didDrag = false;
    this.selectedId = HERO_SEL;
    this.filterTabs = []; this.slotZones = [];
    this.input.dragDistanceThreshold = 8;
    const W = this.scale.width;

    this.add.text(W / 2, 8, "Battle Squad", { fontFamily: '"Trebuchet MS", sans-serif', fontSize: "22px", color: "#ffd700", fontStyle: "bold" }).setOrigin(0.5, 0);
    this.add.text(20, 8, "← Back", { fontSize: "15px", color: "#90caf9" })
      .setInteractive({ useHandCursor: true }).on("pointerup", () => fadeToScene(this, this.backScene()));

    // Right info panel backdrop.
    const pg = this.add.graphics();
    pg.fillStyle(0x0d1420, 0.96).fillRoundedRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H, 8);
    pg.lineStyle(2, 0x2a3a56, 1).strokeRoundedRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H, 8);

    // 7 squad slots (drop zones) along the top.
    crispText(this, 24, 34, "Squad — click to inspect · drag to add/swap:", { fontSize: "11px", color: "#90a4bb" });
    for (let i = 0; i < SQUAD_MAX; i++) {
      const { x, y, w, h } = this.slotRect(i);
      const z = this.add.zone(x, y, w, h).setOrigin(0).setRectangleDropZone(w, h);
      z.setData("slot", i);
      this.slotZones.push(z);
    }

    // Filter + sort bar.
    const FY = 116;
    crispText(this, 24, FY + 3, "Filter:", { fontSize: "11px", color: "#90a4bb" });
    const roles: (TowerRole | null)[] = [null, ...TOWER_ROLES];
    roles.forEach((role, i) => {
      const t = crispText(this, 74 + i * 64, FY, role ? ROLE_LABEL[role] : "All", { fontSize: "11px", color: "#fff", backgroundColor: "#1a2a3a" })
        .setPadding(7, 4, 7, 4).setInteractive({ useHandCursor: true });
      t.setData("role", role ?? "");
      t.on("pointerup", () => { if (!this.didDrag) { this.roleFilter = role; this.redraw(); } });
      this.filterTabs.push(t);
    });
    const sortBtn = crispText(this, PANEL_X - 8, FY, "", { fontSize: "11px", color: "#fff", backgroundColor: "#243a5a" })
      .setOrigin(1, 0).setPadding(8, 4, 8, 4).setInteractive({ useHandCursor: true });
    sortBtn.setData("sort", true);
    sortBtn.on("pointerup", () => { if (!this.didDrag) { this.sortKey = this.sortKey === "rarity" ? "name" : "rarity"; this.redraw(); } });
    this.filterTabs.push(sortBtn);

    this.slotLayer = this.add.container(0, 0);
    this.dyn = this.add.container(0, 0);
    this.panel = this.add.container(0, 0);

    this.setupDrag();
    this.redraw();
  }

  private slotRect(i: number): { x: number; y: number; w: number; h: number } {
    const w = 94, h = 48, x0 = 24, y0 = 50, gap = 4;
    return { x: x0 + i * (w + gap), y: y0, w, h };
  }

  private setupDrag(): void {
    this.input.on("dragstart", (_p: Phaser.Input.Pointer, obj: Phaser.GameObjects.Container) => { obj.setDepth(50); this.didDrag = true; });
    this.input.on("drag", (_p: Phaser.Input.Pointer, obj: Phaser.GameObjects.Container, x: number, y: number) => { obj.x = x; obj.y = y; });
    this.input.on("drop", (_p: Phaser.Input.Pointer, obj: Phaser.GameObjects.Container, zone: Phaser.GameObjects.Zone) => {
      const id = obj.getData("charId") as string;
      const slot = zone.getData("slot") as number;
      if (id != null && slot != null) this.assignToSlot(id, slot);
    });
    this.input.on("dragend", (_p: Phaser.Input.Pointer, obj: Phaser.GameObjects.Container, dropped: boolean) => {
      // A slotted character dragged off all slot zones is removed from the squad.
      if (!dropped && obj.getData("fromSlot") != null) {
        const id = obj.getData("charId") as string;
        const idx = this.slots.indexOf(id);
        if (idx >= 0) { this.slots[idx] = null; this.persist(); }
      }
      if (!dropped) this.redraw();
      this.time.delayedCall(0, () => { this.didDrag = false; });
    });
  }

  // ---- squad mutations -----------------------------------------------------

  private persist(): void { this.mgr.setSquad(this.slots.filter((s): s is string => Boolean(s))); }

  private assignToSlot(id: string, slot: number): void {
    const cur = this.slots.indexOf(id);
    if (cur >= 0) this.slots[cur] = null; // move (no duplicates)
    this.slots[slot] = id;
    this.persist(); this.select(id);
  }

  private select(id: string): void { this.selectedId = id; this.redraw(); }

  private _feedback?: Phaser.GameObjects.Text;
  /** Transient toast for ascension results (survives the redraw that follows). */
  private flashMsg(msg: string, ok: boolean): void {
    this._feedback?.destroy();
    this._feedback = this.add.text(this.scale.width / 2, 508, msg, {
      fontSize: "13px", color: ok ? "#a5d6a7" : "#ff9b9b", backgroundColor: "#10202c",
    }).setOrigin(0.5).setPadding(8, 4, 8, 4).setDepth(60);
    this.time.delayedCall(1600, () => this._feedback?.setVisible(false));
  }

  // ---- rendering -----------------------------------------------------------

  private redraw(): void {
    this.slotLayer.removeAll(true);
    this.dyn.removeAll(true);
    this.panel.removeAll(true);
    const save = this.mgr.getSave();
    for (const t of this.filterTabs) {
      const r = t.getData("role");
      if (t.getData("sort")) { t.setText(`Sort: ${this.sortKey === "rarity" ? "Rarity" : "Name"}`); continue; }
      const active = (r === "" ? null : r) === this.roleFilter;
      t.setBackgroundColor(active ? "#2a4a6a" : "#1a2a3a").setAlpha(active ? 1 : 0.65);
    }

    this.drawSlots();
    this.drawGrid(save);
    this.drawSkillPicker(save);
    this.drawPanel(save);
  }

  private drawSlots(): void {
    for (let i = 0; i < SQUAD_MAX; i++) {
      const { x, y, w, h } = this.slotRect(i);
      const id = this.slots[i];
      const def = id ? TOWERS.find((t) => t.id === id) : undefined;
      const selected = def != null && id === this.selectedId;
      const g = this.add.graphics();
      g.fillStyle(def ? 0x21314a : 0x141c28, 1).fillRoundedRect(x, y, w, h, 6);
      g.lineStyle(selected ? 3 : def ? 2.5 : 1.5, selected ? 0x7ec8ff : def ? 0xffd24a : 0x3a4a64, 1).strokeRoundedRect(x, y, w, h, 6);
      this.slotLayer.add(g);
      this.slotLayer.add(crispText(this, x + 5, y + 2, `${i + 1}`, { fontSize: "9px", color: "#6c7a90" }));
      if (def) {
        this.slotLayer.add(this.makeSlotTile(def, i, x, y, w, h));
      } else {
        this.slotLayer.add(crispText(this, x + w / 2, y + h / 2, "empty", { fontSize: "10px", color: "#4c5a70" }).setOrigin(0.5));
      }
    }
    this.slotLayer.add(crispText(this, 24, 96, `${this.slots.filter(Boolean).length}/${SQUAD_MAX} chosen`, { fontSize: "11px", color: "#cfe0f5" }));
  }

  /** A slotted character: draggable (to swap/remove) + clickable (to inspect). */
  private makeSlotTile(def: CharacterDef, slot: number, x: number, y: number, w: number, h: number): Phaser.GameObjects.Container {
    const c = this.add.container(x + w / 2, y + h / 2).setSize(w, h);
    const key = `tower__${def.id}`;
    if (this.textures.exists(key)) {
      const img = this.add.image(-w / 2 + 22, 0, key).setOrigin(0.5);
      img.setScale(38 / img.height); c.add(img);
    }
    c.add(crispText(this, -w / 2 + 44, -10, def.name, { fontSize: "8px", color: RARITY_HEX[def.rarity], wordWrap: { width: w - 48 } }));
    c.setData("charId", def.id); c.setData("fromSlot", slot);
    c.setInteractive({ useHandCursor: true, draggable: true });
    c.on("pointerup", () => { if (!this.didDrag) this.select(def.id); });
    return c;
  }

  private drawGrid(save: ReturnType<SaveManager["getSave"]>): void {
    let owned = TOWERS.filter((t) => t.id in save.collection);
    if (this.roleFilter) owned = owned.filter((t) => t.role === this.roleFilter);
    owned = owned.slice().sort((a, b) =>
      this.sortKey === "name" ? a.name.localeCompare(b.name) : (RARITY_ORDER[b.rarity] - RARITY_ORDER[a.rarity]) || a.name.localeCompare(b.name));

    if (owned.length === 0) {
      this.dyn.add(crispText(this, 24, 162, "No characters here — summon some in the Summon Hall!", { fontSize: "12px", color: "#90a4bb" }));
    }
    const COLS = 7, CW = 98, CH = 74, X0 = 24, Y0 = 150, BOTTOM = 470;
    owned.forEach((t, idx) => {
      const cx = X0 + (idx % COLS) * CW, cy = Y0 + Math.floor(idx / COLS) * CH;
      if (cy + CH - 8 > BOTTOM) return; // clip overflow
      this.dyn.add(this.makeCharTile(t, cx, cy, CW - 8, CH - 8, getTowerStars(save, t.id), getTowerCopies(save, t.id), this.slots.includes(t.id)));
    });
  }

  private drawSkillPicker(save: ReturnType<SaveManager["getSave"]>): void {
    const skills = save.hero.obtainedSkills;
    crispText(this, 24, 482, "Hero skill:", { fontSize: "11px", color: "#ffd86a" });
    if (skills.length === 0) {
      this.dyn.add(crispText(this, 92, 482, "none yet (skills drop from battles)", { fontSize: "10px", color: "#90a4bb" }));
    }
    skills.slice(0, 6).forEach((entry, idx) => {
      const def = ACTIVE_SKILLS_MAP.get(entry.skillId);
      if (!def) return;
      const equipped = save.hero.equippedSkillIds.includes(entry.skillId);
      const chipX = 92 + idx * 104, chipY = 480;
      const chip = crispText(this, chipX, chipY, `${def.name} L${entry.level}`, {
        fontSize: "10px", color: equipped ? "#fff" : RARITY_HEX[def.rarity], backgroundColor: equipped ? "#5a2a7a" : "#1a2230",
      }).setPadding(6, 3, 6, 3).setInteractive({ useHandCursor: true });
      // Damage-type frame around the chip (Physical / Magic / True).
      const frame = this.add.graphics();
      frame.lineStyle(1.5, DMG_INT[def.damageType] ?? 0x9fb0c4, 1)
        .strokeRoundedRect(chipX - 1, chipY - 1, chip.width + 2, chip.height + 2, 4);
      this.dyn.add(frame);
      chip.on("pointerup", () => {
        if (this.didDrag) return;
        if (equipped) this.mgr.unequipSkill(entry.skillId); else this.mgr.equipSkill(entry.skillId);
        this.redraw();
      });
      this.dyn.add(chip);
    });
  }

  private makeCharTile(t: CharacterDef, cx: number, cy: number, w: number, h: number, stars: number, copies: number, inSquad: boolean): Phaser.GameObjects.Container {
    const selected = t.id === this.selectedId;
    const c = this.add.container(cx + w / 2, cy + h / 2).setSize(w, h);
    const g = this.add.graphics();
    g.fillStyle(inSquad ? 0x23344a : 0x18202c, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 6);
    g.lineStyle(selected ? 3 : inSquad ? 2.5 : 1.5, selected ? 0x7ec8ff : inSquad ? 0xffd24a : RARITY_INT[t.rarity], selected || inSquad ? 1 : 0.85).strokeRoundedRect(-w / 2, -h / 2, w, h, 6);
    c.add(g);
    const key = `tower__${t.id}`;
    if (this.textures.exists(key)) {
      const img = this.add.image(0, -8, key).setOrigin(0.5);
      img.setScale(40 / img.height); c.add(img);
    }
    c.add(crispText(this, 0, h / 2 - 16, t.name, { fontSize: "8px", color: RARITY_HEX[t.rarity], align: "center", wordWrap: { width: w - 8 } }).setOrigin(0.5, 0));
    if (stars > 0) c.add(crispText(this, -w / 2 + 4, -h / 2 + 3, "★".repeat(stars), { fontSize: "9px", color: "#ffd24a" }));
    if (inSquad) c.add(crispText(this, w / 2 - 6, -h / 2 + 3, "✓", { fontSize: "12px", color: "#a5d6a7", fontStyle: "bold" }).setOrigin(1, 0));

    // Ascension progress bar along the bottom edge: copies toward the next star,
    // gold when maxed, green when enough copies are banked to upgrade.
    const cost = starUpCost(stars);
    const bw = w - 10, bx = -bw / 2, by = h / 2 - 4;
    const bar = this.add.graphics();
    bar.fillStyle(0x0b1018, 1).fillRoundedRect(bx, by, bw, 3, 1.5);
    if (!cost) {
      bar.fillStyle(0xffd24a, 1).fillRoundedRect(bx, by, bw, 3, 1.5); // maxed
    } else {
      const frac = Math.max(0, Math.min(1, copies / cost.copies));
      if (frac > 0) bar.fillStyle(copies >= cost.copies ? 0x52c878 : 0x4a78c8, 1).fillRoundedRect(bx, by, bw * frac, 3, 1.5);
    }
    c.add(bar);

    c.setData("charId", t.id);
    c.setInteractive({ useHandCursor: true, draggable: true });
    c.on("pointerup", () => { if (!this.didDrag) this.select(t.id); });
    return c;
  }

  /** Right-side info panel: the hero card + the selected character's details. */
  private drawPanel(save: ReturnType<SaveManager["getSave"]>): void {
    // Hero selector card at the top of the panel.
    const heroSel = this.selectedId === HERO_SEL;
    const hg = this.add.graphics();
    hg.fillStyle(heroSel ? 0x24344e : 0x16202e, 1).fillRoundedRect(PANEL_X + 8, PANEL_Y + 8, PANEL_W - 16, 30, 6);
    hg.lineStyle(2, heroSel ? 0x7ec8ff : 0x3a4a64, 1).strokeRoundedRect(PANEL_X + 8, PANEL_Y + 8, PANEL_W - 16, 30, 6);
    this.panel.add(hg);
    this.panel.add(crispText(this, PANEL_X + PANEL_W / 2, PANEL_Y + 14, "⚔  Your Hero", { fontSize: "12px", color: heroSel ? "#fff" : "#9fb0c4", fontStyle: "bold" }).setOrigin(0.5, 0));
    const hz = this.add.zone(PANEL_X + 8, PANEL_Y + 8, PANEL_W - 16, 30).setOrigin(0).setInteractive({ useHandCursor: true });
    hz.on("pointerup", () => { if (!this.didDrag) this.select(HERO_SEL); });
    this.panel.add(hz);

    const bodyY = PANEL_Y + 46;
    if (heroSel) {
      renderHeroInfo(this, this.panel, PANEL_X + 12, bodyY, PANEL_W - 24, save);
    } else {
      const def = TOWERS.find((t) => t.id === this.selectedId);
      if (def) {
        const e = save.collection[def.id];
        const entry = { stars: e?.stars ?? 0, copies: e?.copies ?? 0 };
        renderCharInfo(this, this.panel, PANEL_X + 12, bodyY, PANEL_W - 24, def, entry, save.currency.gold, () => {
          const r = this.mgr.upgradeTowerStar(def.id);
          this.flashMsg(r.message, r.success);
          this.redraw();
        });
      }
    }
  }
}
