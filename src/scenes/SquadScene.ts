/**
 * SquadScene (T4) — build the battle squad on a redesigned screen: a row of 7
 * ordered squad SLOTS at the top, a filter/sort bar, and an inventory grid of
 * every collected character. Drag a character onto a slot (or tap to add to the
 * first empty slot); tap a slotted character to remove it. A compact active-skill
 * picker sits at the bottom. Persists via SaveManager (setSquad / equipSkill).
 */
import Phaser from "phaser";
import type { SaveManager } from "../core/saveManager.ts";
import { getTowerStars } from "../core/collection.ts";
import { TOWERS } from "../data/towers.ts";
import { ACTIVE_SKILLS_MAP } from "../data/skills.ts";
import { TOWER_ROLES, type Rarity, type TowerRole, type CharacterDef } from "../data/schema.ts";
import { crispText } from "./ui.ts";

const RARITY_HEX: Record<Rarity, string> = {
  Common: "#9e9e9e", Magic: "#2196f3", Rare: "#9c27b0", Legendary: "#ff9800", Unique: "#f44336",
};
const RARITY_INT: Record<Rarity, number> = {
  Common: 0x9e9e9e, Magic: 0x2196f3, Rare: 0x9c27b0, Legendary: 0xff9800, Unique: 0xf44336,
};
const RARITY_ORDER: Record<Rarity, number> = { Common: 0, Magic: 1, Rare: 2, Legendary: 3, Unique: 4 };
const ROLE_LABEL: Record<TowerRole, string> = {
  damage: "Dmg", splash: "Splash", chain: "Chain", dot: "DoT", debuff: "Debuff", support: "Support",
};
const SQUAD_MAX = 7;
type SortKey = "rarity" | "name";

export class SquadScene extends Phaser.Scene {
  private mgr!: SaveManager;
  private slots: (string | null)[] = [];
  private roleFilter: TowerRole | null = null;
  private sortKey: SortKey = "rarity";
  private didDrag = false;
  private dyn!: Phaser.GameObjects.Container;
  private slotLayer!: Phaser.GameObjects.Container;
  private filterTabs: Phaser.GameObjects.Text[] = [];
  private slotZones: Phaser.GameObjects.Zone[] = [];
  private toast!: Phaser.GameObjects.Text;

  constructor() { super("SquadScene"); }

  create(): void {
    this.mgr = this.registry.get("saveManager");
    const save = this.mgr.getSave();
    this.slots = Array.from({ length: SQUAD_MAX }, (_, i) => save.squad?.[i] ?? null);
    this.roleFilter = null; this.sortKey = "rarity"; this.didDrag = false;
    this.filterTabs = []; this.slotZones = [];
    this.input.dragDistanceThreshold = 8;
    const W = this.scale.width;

    this.add.text(W / 2, 10, "Battle Squad", { fontFamily: '"Trebuchet MS", sans-serif', fontSize: "24px", color: "#ffd700", fontStyle: "bold" }).setOrigin(0.5, 0);
    this.add.text(20, 8, "← Back", { fontSize: "15px", color: "#90caf9" })
      .setInteractive({ useHandCursor: true }).on("pointerup", () => this.scene.start("MainMenuScene"));

    // 7 squad slots (drop zones) along the top.
    crispText(this, 24, 36, "Squad — drag a character into a slot, or tap a slot to clear:", { fontSize: "11px", color: "#90a4bb" });
    const SW = 122, SH = 50, SX0 = 24, SY0 = 52;
    for (let i = 0; i < SQUAD_MAX; i++) {
      const x = SX0 + i * (SW + 4), y = SY0;
      const z = this.add.zone(x, y, SW, SH).setOrigin(0).setRectangleDropZone(SW, SH);
      z.setData("slot", i);
      this.slotZones.push(z);
    }

    // Filter + sort bar.
    const FY = 124;
    crispText(this, 24, FY + 3, "Filter:", { fontSize: "11px", color: "#90a4bb" });
    const roles: (TowerRole | null)[] = [null, ...TOWER_ROLES];
    roles.forEach((role, i) => {
      const t = crispText(this, 78 + i * 72, FY, role ? ROLE_LABEL[role] : "All", { fontSize: "11px", color: "#fff", backgroundColor: "#1a2a3a" })
        .setPadding(8, 4, 8, 4).setInteractive({ useHandCursor: true });
      t.setData("role", role ?? "");
      t.on("pointerup", () => { if (!this.didDrag) { this.roleFilter = role; this.redraw(); } });
      this.filterTabs.push(t);
    });
    const sortBtn = crispText(this, W - 24, FY, "", { fontSize: "11px", color: "#fff", backgroundColor: "#243a5a" })
      .setOrigin(1, 0).setPadding(8, 4, 8, 4).setInteractive({ useHandCursor: true });
    sortBtn.setData("sort", true);
    sortBtn.on("pointerup", () => { if (!this.didDrag) { this.sortKey = this.sortKey === "rarity" ? "name" : "rarity"; this.redraw(); } });
    this.filterTabs.push(sortBtn);

    this.slotLayer = this.add.container(0, 0);
    this.dyn = this.add.container(0, 0);
    this.toast = this.add.text(W / 2, 506, "", { fontSize: "12px", color: "#ffd6a0", backgroundColor: "#2a1a1a" })
      .setOrigin(0.5).setPadding(8, 4, 8, 4).setDepth(60).setVisible(false);

    this.setupDrag();
    this.redraw();
  }

  private setupDrag(): void {
    this.input.on("dragstart", (_p: Phaser.Input.Pointer, obj: Phaser.GameObjects.Container) => { obj.setDepth(50); this.didDrag = true; });
    this.input.on("drag", (_p: Phaser.Input.Pointer, obj: Phaser.GameObjects.Container, x: number, y: number) => { obj.x = x; obj.y = y; });
    this.input.on("drop", (_p: Phaser.Input.Pointer, obj: Phaser.GameObjects.Container, zone: Phaser.GameObjects.Zone) => {
      const id = obj.getData("charId") as string;
      const slot = zone.getData("slot") as number;
      if (id != null && slot != null) this.assignToSlot(id, slot);
    });
    this.input.on("dragend", (_p: Phaser.Input.Pointer, _obj: Phaser.GameObjects.Container, dropped: boolean) => {
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
    this.persist(); this.redraw();
  }

  private addToFirstEmpty(id: string): void {
    if (this.slots.includes(id)) { this.slots[this.slots.indexOf(id)] = null; this.persist(); this.redraw(); return; }
    const empty = this.slots.indexOf(null);
    if (empty < 0) { this.showToast(`Squad is full (${SQUAD_MAX})`); return; }
    this.slots[empty] = id;
    this.persist(); this.redraw();
  }

  // ---- rendering -----------------------------------------------------------

  private redraw(): void {
    this.slotLayer.removeAll(true);
    this.dyn.removeAll(true);
    const save = this.mgr.getSave();
    for (const t of this.filterTabs) {
      const r = t.getData("role");
      if (t.getData("sort")) { t.setText(`Sort: ${this.sortKey === "rarity" ? "Rarity" : "Name"}`); continue; }
      const active = (r === "" ? null : r) === this.roleFilter;
      t.setBackgroundColor(active ? "#2a4a6a" : "#1a2a3a").setAlpha(active ? 1 : 0.65);
    }

    // Slots
    const SW = 122, SH = 50, SX0 = 24, SY0 = 52;
    for (let i = 0; i < SQUAD_MAX; i++) {
      const x = SX0 + i * (SW + 4), y = SY0;
      const id = this.slots[i];
      const def = id ? TOWERS.find((t) => t.id === id) : undefined;
      const g = this.add.graphics();
      g.fillStyle(def ? 0x21314a : 0x141c28, 1).fillRoundedRect(x, y, SW, SH, 6);
      g.lineStyle(def ? 2.5 : 1.5, def ? 0xffd24a : 0x3a4a64, 1).strokeRoundedRect(x, y, SW, SH, 6);
      this.slotLayer.add(g);
      this.slotLayer.add(crispText(this, x + 6, y + 3, `${i + 1}`, { fontSize: "10px", color: "#6c7a90" }));
      if (def) {
        const key = `tower__${def.id}`;
        if (this.textures.exists(key)) {
          const img = this.add.image(x + 26, y + SH / 2, key).setOrigin(0.5);
          img.setScale(40 / img.height); this.slotLayer.add(img);
        }
        this.slotLayer.add(crispText(this, x + 50, y + 14, def.name, { fontSize: "9px", color: RARITY_HEX[def.rarity], wordWrap: { width: SW - 56 } }));
        const hit = this.add.rectangle(x, y, SW, SH, 0, 0).setOrigin(0).setInteractive({ useHandCursor: true });
        hit.on("pointerup", () => { if (!this.didDrag) { this.slots[i] = null; this.persist(); this.redraw(); } });
        this.slotLayer.add(hit);
      } else {
        this.slotLayer.add(crispText(this, x + SW / 2, y + SH / 2, "empty", { fontSize: "10px", color: "#4c5a70" }).setOrigin(0.5));
      }
    }
    this.slotLayer.add(crispText(this, SX0 + 7 * (SW + 4) - 90, 36, `${this.slots.filter(Boolean).length}/${SQUAD_MAX} chosen`, { fontSize: "11px", color: "#cfe0f5" }));

    // Inventory grid (filtered + sorted)
    let owned = TOWERS.filter((t) => t.id in save.collection);
    if (this.roleFilter) owned = owned.filter((t) => t.role === this.roleFilter);
    owned = owned.slice().sort((a, b) =>
      this.sortKey === "name" ? a.name.localeCompare(b.name) : (RARITY_ORDER[b.rarity] - RARITY_ORDER[a.rarity]) || a.name.localeCompare(b.name));

    if (owned.length === 0) {
      this.dyn.add(crispText(this, 24, 172, "No characters here — summon some in the Summon Hall!", { fontSize: "12px", color: "#90a4bb" }));
    }
    const COLS = 9, CW = 100, CH = 76, X0 = 24, Y0 = 158, BOTTOM = 466;
    owned.forEach((t, idx) => {
      const cx = X0 + (idx % COLS) * CW, cy = Y0 + Math.floor(idx / COLS) * CH;
      if (cy + CH - 8 > BOTTOM) return; // clip overflow
      this.dyn.add(this.makeCharTile(t, cx, cy, CW - 8, CH - 8, getTowerStars(save, t.id), this.slots.includes(t.id)));
    });

    // Active-skill picker — a compact strip at the bottom.
    const skills = save.hero.obtainedSkills;
    crispText(this, 24, 480, "Hero skill:", { fontSize: "11px", color: "#ffd86a" });
    if (skills.length === 0) {
      this.dyn.add(crispText(this, 96, 480, "none yet (skills drop from battles)", { fontSize: "10px", color: "#90a4bb" }));
    }
    skills.slice(0, 7).forEach((entry, idx) => {
      const def = ACTIVE_SKILLS_MAP.get(entry.skillId);
      if (!def) return;
      const equipped = save.hero.equippedSkillId === entry.skillId;
      const chip = crispText(this, 100 + idx * 118, 478, `${def.name}`, {
        fontSize: "10px", color: equipped ? "#fff" : RARITY_HEX[def.rarity], backgroundColor: equipped ? "#5a2a7a" : "#1a2230",
      }).setPadding(6, 3, 6, 3).setInteractive({ useHandCursor: true });
      chip.on("pointerup", () => { if (!this.didDrag) { this.mgr.equipSkill(entry.skillId); this.redraw(); } });
      this.dyn.add(chip);
    });
  }

  private makeCharTile(t: CharacterDef, cx: number, cy: number, w: number, h: number, stars: number, inSquad: boolean): Phaser.GameObjects.Container {
    const c = this.add.container(cx + w / 2, cy + h / 2).setSize(w, h);
    const g = this.add.graphics();
    g.fillStyle(inSquad ? 0x23344a : 0x18202c, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 6);
    g.lineStyle(inSquad ? 3 : 1.5, inSquad ? 0xffd24a : RARITY_INT[t.rarity], inSquad ? 1 : 0.85).strokeRoundedRect(-w / 2, -h / 2, w, h, 6);
    c.add(g);
    const key = `tower__${t.id}`;
    if (this.textures.exists(key)) {
      const img = this.add.image(0, -8, key).setOrigin(0.5);
      img.setScale(40 / img.height); c.add(img);
    }
    c.add(crispText(this, 0, h / 2 - 16, t.name, { fontSize: "8px", color: RARITY_HEX[t.rarity], align: "center", wordWrap: { width: w - 8 } }).setOrigin(0.5, 0));
    if (stars > 0) c.add(crispText(this, -w / 2 + 4, -h / 2 + 3, "★".repeat(stars), { fontSize: "9px", color: "#ffd24a" }));
    if (inSquad) c.add(crispText(this, w / 2 - 6, -h / 2 + 3, "✓", { fontSize: "12px", color: "#a5d6a7", fontStyle: "bold" }).setOrigin(1, 0));
    c.setData("charId", t.id);
    c.setInteractive({ useHandCursor: true, draggable: true });
    c.on("pointerup", () => { if (!this.didDrag) this.addToFirstEmpty(t.id); });
    return c;
  }

  private showToast(msg: string): void {
    this.toast.setText(msg).setVisible(true);
    this.time.delayedCall(1500, () => this.toast.setVisible(false));
  }
}
