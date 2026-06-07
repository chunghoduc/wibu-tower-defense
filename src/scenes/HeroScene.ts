/**
 * HeroScene (T4) — game-style loadout: an equipment paper-doll (10 drop-zone
 * slots) and a draggable inventory grid. Drag an item onto its slot to equip;
 * drag an equipped item back to the bag to unequip. Hover shows a stat tooltip.
 */
import Phaser from "phaser";
import { fadeIn, fadeToScene } from "./uiKit.ts";
import type { SaveManager } from "../core/saveManager.ts";
import { ITEM_CATALOG_MAP } from "../data/items.ts";
import { itemStatRows, SOURCE_COLOR, QUALITY_COLOR } from "../data/itemDisplay.ts";
import { ITEM_SLOTS, type ItemSlot, type Rarity } from "../data/schema.ts";
import type { ItemInstanceSave } from "../core/save.ts";
import { MATERIALS, MATERIALS_MAP } from "../data/materials.ts";
import { enhanceChance, jewelForLevel, enhanceBonus, MAX_ENHANCE } from "../core/enhance.ts";
import { crispText } from "./ui.ts";

type InvFilter = "items" | "materials" | "boxes";

const RARITY_HEX: Record<Rarity, string> = {
  Common: "#9e9e9e", Magic: "#2196f3", Rare: "#9c27b0", Legendary: "#ff9800", Unique: "#f44336",
};
const RARITY_INT: Record<Rarity, number> = {
  Common: 0x9e9e9e, Magic: 0x2196f3, Rare: 0x9c27b0, Legendary: 0xff9800, Unique: 0xf44336,
};
const SLOT_LABEL: Record<ItemSlot, string> = {
  Weapon: "Weapon", Helmet: "Helmet", BodyArmor: "Body", Gloves: "Gloves", Boots: "Boots",
  Amulet: "Amulet", Ring1: "Ring I", Ring2: "Ring II", Pet: "Pet", Wing: "Wing",
};

const TILE = 52;

export class HeroScene extends Phaser.Scene {
  private mgr!: SaveManager;
  private tiles!: Phaser.GameObjects.Container;   // draggable item tiles
  private slotZones = new Map<ItemSlot, Phaser.GameObjects.Zone>();
  private slotPos = new Map<ItemSlot, { x: number; y: number }>();
  private invRect = { x: 360, y: 96, w: 580, h: 380 };
  private tooltip!: Phaser.GameObjects.Container;
  private toast!: Phaser.GameObjects.Text;
  private filter: InvFilter = "items";
  private filterTabs: Phaser.GameObjects.Text[] = [];
  private dialog!: Phaser.GameObjects.Container;   // enhance modal
  private didDrag = false;

  constructor() { super("HeroScene"); }

  create(): void {
    fadeIn(this);
    this.mgr = this.registry.get("saveManager");
    this.slotZones.clear(); this.slotPos.clear();
    this.filterTabs = [];          // reset on scene re-entry
    this.didDrag = false;
    this.input.dragDistanceThreshold = 8; // small moves = click (enhance), not drag
    const W = this.scale.width;

    this.add.text(W / 2, 12, "Hero — Loadout", { fontSize: "23px", color: "#ffd700", fontStyle: "bold" }).setOrigin(0.5, 0);
    this.add.text(20, 8, "← Back", { fontSize: "15px", color: "#90caf9" })
      .setInteractive({ useHandCursor: true }).on("pointerdown", () => fadeToScene(this, "MainMenuScene"));

    const save = this.mgr.getSave();
    this.add.text(40, 48, `Level ${save.hero.level}`, { fontSize: "14px", color: "#cfe0f5" });
    this.add.text(40, 70, "Equipment — drag items here", { fontSize: "11px", color: "#90a4bb" });
    // Inventory filter tabs (T14): Items / Materials / Boxes.
    const tabs: { id: InvFilter; label: string }[] = [
      { id: "items", label: "Items" }, { id: "materials", label: "Materials" }, { id: "boxes", label: "Boxes" },
    ];
    tabs.forEach((tab, i) => {
      const t = crispText(this, this.invRect.x + i * 96, 72, tab.label, { fontSize: "12px", color: "#fff", backgroundColor: "#1a2a3a" })
        .setPadding(10, 4, 10, 4).setInteractive({ useHandCursor: true });
      t.setData("filter", tab.id);
      t.on("pointerdown", () => { this.filter = tab.id; this.refreshTabs(); this.refresh(); });
      this.filterTabs.push(t);
    });

    // Equipment slot drop-zones (left column)
    ITEM_SLOTS.forEach((slot, i) => {
      const x = 40 + (i % 2) * 150, y = 96 + Math.floor(i / 2) * 70;
      this.slotPos.set(slot, { x: x + TILE / 2, y: y + TILE / 2 });
      const g = this.add.graphics();
      g.fillStyle(0x141c28, 1).fillRoundedRect(x, y, TILE, TILE, 6);
      g.lineStyle(1.5, 0x3a4a64, 1).strokeRoundedRect(x, y, TILE, TILE, 6);
      this.add.text(x + TILE + 6, y + 16, SLOT_LABEL[slot], { fontSize: "11px", color: "#aab8cc" });
      const zone = this.add.zone(x, y, TILE, TILE).setOrigin(0).setRectangleDropZone(TILE, TILE);
      zone.setData("slot", slot);
      this.slotZones.set(slot, zone);
    });

    // Inventory background drop-zone (unequip target)
    const invG = this.add.graphics();
    invG.fillStyle(0x0e141e, 0.6).fillRoundedRect(this.invRect.x, this.invRect.y, this.invRect.w, this.invRect.h, 8);
    invG.lineStyle(1, 0x2a3650, 1).strokeRoundedRect(this.invRect.x, this.invRect.y, this.invRect.w, this.invRect.h, 8);
    const invZone = this.add.zone(this.invRect.x, this.invRect.y, this.invRect.w, this.invRect.h)
      .setOrigin(0).setRectangleDropZone(this.invRect.w, this.invRect.h);
    invZone.setData("inv", true);

    this.tiles = this.add.container(0, 0);
    this.tooltip = this.add.container(0, 0).setDepth(200).setVisible(false);
    this.dialog = this.add.container(0, 0).setDepth(240).setVisible(false);
    this.toast = this.add.text(W / 2, 500, "", { fontSize: "13px", color: "#ffd6a0", backgroundColor: "#2a1a1a" })
      .setOrigin(0.5).setPadding(8, 4, 8, 4).setDepth(220).setVisible(false);

    this.setupDrag();
    this.refreshTabs();
    this.refresh();
  }

  private refreshTabs(): void {
    for (const t of this.filterTabs) {
      const active = t.getData("filter") === this.filter;
      t.setBackgroundColor(active ? "#2a4a6a" : "#1a2a3a").setAlpha(active ? 1 : 0.65);
    }
  }

  private setupDrag(): void {
    this.input.on("dragstart", (_p: Phaser.Input.Pointer, obj: Phaser.GameObjects.Container) => {
      obj.setDepth(150); this.hideTooltip(); this.didDrag = true;
    });
    this.input.on("drag", (_p: Phaser.Input.Pointer, obj: Phaser.GameObjects.Container, x: number, y: number) => {
      obj.x = x; obj.y = y;
    });
    this.input.on("drop", (_p: Phaser.Input.Pointer, obj: Phaser.GameObjects.Container, zone: Phaser.GameObjects.Zone) => {
      this.handleDrop(obj, zone);
    });
    this.input.on("dragend", (_p: Phaser.Input.Pointer, _obj: Phaser.GameObjects.Container, dropped: boolean) => {
      if (!dropped) this.refresh(); // snap back
      this.time.delayedCall(0, () => { this.didDrag = false; }); // reset after pointerup
    });
  }

  private handleDrop(tile: Phaser.GameObjects.Container, zone: Phaser.GameObjects.Zone): void {
    const instId = tile.getData("instanceId") as string;
    const fromSlot = tile.getData("fromSlot") as ItemSlot | null;
    const inst = this.mgr.getSave().inventory.items.find((it) => it.id === instId);
    const def = inst ? ITEM_CATALOG_MAP.get(inst.defId) : undefined;

    if (zone.getData("inv")) {
      if (fromSlot) this.mgr.unequipSlot(fromSlot);
    } else {
      const slot = zone.getData("slot") as ItemSlot;
      if (def && def.slot === slot) {
        if (!this.mgr.equipItem(instId)) this.showToast(`Requires level ${def.requiredLevel}`);
      } else if (def) {
        this.showToast(`${def.name} doesn't fit ${SLOT_LABEL[slot]}`);
      }
    }
    this.refresh();
  }

  private refresh(): void {
    this.tiles.removeAll(true);
    const save = this.mgr.getSave();

    // Equipped tiles always sit on the paper-doll.
    for (const slot of ITEM_SLOTS) {
      const instId = save.inventory.equipped[slot];
      if (!instId) continue;
      const inst = save.inventory.items.find((it) => it.id === instId);
      if (!inst) continue;
      const p = this.slotPos.get(slot)!;
      this.tiles.add(this.makeTile(inst, p.x, p.y, slot));
    }

    if (this.filter === "items") this.refreshItems(save);
    else this.refreshMaterials(save, this.filter === "boxes" ? "box" : "jewel");
  }

  private gridPos(i: number): { x: number; y: number } | null {
    const cols = Math.floor((this.invRect.w - 12) / (TILE + 6));
    const c = i % cols, r = Math.floor(i / cols);
    const x = this.invRect.x + 12 + c * (TILE + 6) + TILE / 2;
    const y = this.invRect.y + 12 + r * (TILE + 6) + TILE / 2;
    if (y > this.invRect.y + this.invRect.h - TILE / 2) return null;
    return { x, y };
  }

  private refreshItems(save: ReturnType<SaveManager["getSave"]>): void {
    const equipped = new Set(Object.values(save.inventory.equipped).filter(Boolean));
    const bag = save.inventory.items.filter((it) => !equipped.has(it.id));
    bag.forEach((inst, i) => {
      const p = this.gridPos(i);
      if (p) this.tiles.add(this.makeTile(inst, p.x, p.y, null));
    });
  }

  private refreshMaterials(save: ReturnType<SaveManager["getSave"]>, kind: "jewel" | "box"): void {
    const mats = MATERIALS.filter((m) => m.kind === kind);
    let i = 0;
    for (const m of mats) {
      const count = save.materials[m.id] ?? 0;
      if (count <= 0) continue;
      const p = this.gridPos(i++);
      if (p) this.tiles.add(this.makeMaterialTile(m.id, count, p.x, p.y, kind === "box"));
    }
    if (i === 0) {
      this.tiles.add(this.add.text(this.invRect.x + 16, this.invRect.y + 16,
        kind === "box" ? "No chests yet — beat a stage boss to earn one." : "No jewels yet — clear stages to find them.",
        { fontSize: "12px", color: "#7c8aa0" }));
    }
  }

  /** A draggable item tile centered at (x,y). */
  private makeTile(inst: ItemInstanceSave, x: number, y: number, fromSlot: ItemSlot | null): Phaser.GameObjects.Container {
    const def = ITEM_CATALOG_MAP.get(inst.defId);
    const rarity = def?.rarity ?? "Common";
    const c = this.add.container(x, y).setSize(TILE, TILE);
    const g = this.add.graphics();
    g.fillStyle(0x1c2636, 1).fillRoundedRect(-TILE / 2, -TILE / 2, TILE, TILE, 5);
    g.lineStyle(2, RARITY_INT[rarity], 1).strokeRoundedRect(-TILE / 2, -TILE / 2, TILE, TILE, 5);
    c.add(g);
    const key = `item__${inst.defId}`;
    if (this.textures.exists(key)) {
      const img = this.add.image(0, -4, key).setOrigin(0.5);
      img.setScale((TILE - 14) / img.height);
      c.add(img);
    } else {
      c.add(this.add.text(0, -4, (def?.name ?? "?").slice(0, 6), { fontSize: "8px", color: RARITY_HEX[rarity], align: "center", wordWrap: { width: TILE - 6 } }).setOrigin(0.5));
    }
    c.add(this.add.text(0, TILE / 2 - 8, def?.slot === "Weapon" ? (def.weaponType ?? "") : (def?.slot.replace(/Ring[12]/, "Ring") ?? ""), { fontSize: "7px", color: "#8aa0bb" }).setOrigin(0.5));

    // Enhancement level badge (+N) — top-right (T13).
    if ((inst.enhanceLevel ?? 0) > 0) {
      const bg = this.add.graphics();
      bg.fillStyle(0x1a1206, 0.9).fillCircle(TILE / 2 - 8, -TILE / 2 + 8, 9);
      bg.lineStyle(1.5, 0xffd34d, 1).strokeCircle(TILE / 2 - 8, -TILE / 2 + 8, 9);
      c.add(bg);
      c.add(crispText(this, TILE / 2 - 8, -TILE / 2 + 8, `+${inst.enhanceLevel}`, { fontSize: "10px", color: "#ffe07a", fontStyle: "bold" }).setOrigin(0.5));
    }

    c.setData("instanceId", inst.id).setData("fromSlot", fromSlot);
    c.setInteractive({ useHandCursor: true, draggable: true });
    c.on("pointerover", () => this.showTooltip(inst, x, y));
    c.on("pointerout", () => this.hideTooltip());
    c.on("pointerup", () => { if (!this.didDrag) this.openEnhance(inst.id); }); // tap = enhance
    return c;
  }

  /** A material/box tile showing its count; boxes are clickable to open (T15). */
  private makeMaterialTile(id: string, count: number, x: number, y: number, openable: boolean): Phaser.GameObjects.Container {
    const def = MATERIALS_MAP.get(id);
    const c = this.add.container(x, y).setSize(TILE, TILE);
    const g = this.add.graphics();
    g.fillStyle(0x1c2636, 1).fillRoundedRect(-TILE / 2, -TILE / 2, TILE, TILE, 5);
    g.lineStyle(2, openable ? 0xffb74d : 0x7ec8ff, 1).strokeRoundedRect(-TILE / 2, -TILE / 2, TILE, TILE, 5);
    c.add(g);
    c.add(this.add.text(0, -6, openable ? "🎁" : "💠", { fontSize: "22px" }).setOrigin(0.5));
    c.add(crispText(this, TILE / 2 - 4, TILE / 2 - 4, `×${count}`, { fontSize: "11px", color: "#fff", fontStyle: "bold" }).setOrigin(1));
    c.setInteractive({ useHandCursor: true });
    c.on("pointerover", () => this.showTextTooltip(def?.name ?? id, def?.description ?? "", x, y));
    c.on("pointerout", () => this.hideTooltip());
    if (openable) c.on("pointerup", () => this.openBoxAction(id));
    return c;
  }

  private openBoxAction(boxId: string): void {
    const reward = this.mgr.openBox(boxId);
    if (!reward.opened) return;
    const parts = [`+${reward.crystals}💎`];
    for (const [mid, n] of Object.entries(reward.materials)) parts.push(`${MATERIALS_MAP.get(mid)?.name ?? mid} ×${n}`);
    if (reward.item) parts.push(`📦 ${ITEM_CATALOG_MAP.get(reward.item.defId)?.name ?? "item"}`);
    this.showToast(`Opened: ${parts.join("  ·  ")}`);
    this.refresh();
  }

  /** The MU-style enhance dialog for an item (T13). */
  private openEnhance(instanceId: string): void {
    const save = this.mgr.getSave();
    const inst = save.inventory.items.find((it) => it.id === instanceId);
    const def = inst ? ITEM_CATALOG_MAP.get(inst.defId) : undefined;
    if (!inst || !def) return;
    this.hideTooltip();
    this.dialog.removeAll(true);

    const W = 340, H = 220, dx = (this.scale.width - W) / 2, dy = 150;
    const g = this.add.graphics();
    g.fillStyle(0x070b12, 0.6).fillRect(0, 0, this.scale.width, this.scale.height); // scrim
    g.fillStyle(0x141c28, 1).fillRoundedRect(dx, dy, W, H, 10);
    g.lineStyle(2, RARITY_INT[def.rarity], 1).strokeRoundedRect(dx, dy, W, H, 10);
    const scrim = this.add.zone(0, 0, this.scale.width, this.scale.height).setOrigin(0).setInteractive();
    scrim.on("pointerup", () => this.dialog.setVisible(false));
    this.dialog.add(g); this.dialog.add(scrim);

    const render = () => {
      // remove all but scrim+bg (first two)
      while (this.dialog.length > 2) this.dialog.removeAt(2, true);
      const cur = inst.enhanceLevel ?? 0;
      const jewel = jewelForLevel(cur);
      const have = save.materials[jewel] ?? 0;
      const chance = enhanceChance(cur);
      const maxed = cur >= MAX_ENHANCE;
      const add = (yy: number, txt: string, style: Phaser.Types.GameObjects.Text.TextStyle = {}) =>
        this.dialog.add(crispText(this, dx + 16, dy + yy, txt, { fontSize: "13px", color: "#dfe8f3", ...style }));
      add(14, `${def.name}  +${cur}`, { fontSize: "16px", color: RARITY_HEX[def.rarity], fontStyle: "bold" });
      add(44, `Primary stats ×${enhanceBonus(cur).toFixed(2)}  →  +${cur + 1}: ×${enhanceBonus(cur + 1).toFixed(2)}`);
      add(70, maxed ? "Maxed (+15)." : `Needs: ${MATERIALS_MAP.get(jewel)?.name} (you have ${have})`);
      add(96, maxed ? "" : `Success: ${Math.round(chance * 100)}%${cur >= 6 ? "  ·  on failure the item loses 1–5 levels" : ""}`,
        { fontSize: "11px", color: cur >= 6 ? "#ffb38a" : "#a5d6a7" });

      const canDo = !maxed && have > 0;
      const btn = crispText(this, dx + W / 2, dy + H - 54, maxed ? "MAX" : (canDo ? "⚒  Enhance" : "Need jewel"), {
        fontSize: "15px", color: "#fff", backgroundColor: canDo ? "#1565c0" : "#444",
      }).setOrigin(0.5, 0).setPadding(16, 8, 16, 8).setAlpha(canDo ? 1 : 0.6);
      if (canDo) {
        btn.setInteractive({ useHandCursor: true });
        btn.on("pointerup", () => {
          const r = this.mgr.enhanceItem(instanceId);
          if (r.ok) {
            this.showToast(r.success ? `Success! +${r.to}` : `Failed… dropped to +${r.to}`);
            render(); this.refresh();
          }
        });
      }
      this.dialog.add(btn);
      const close = crispText(this, dx + W - 14, dy + 10, "✕", { fontSize: "16px", color: "#ef9a9a" })
        .setOrigin(1, 0).setInteractive({ useHandCursor: true });
      close.on("pointerup", () => this.dialog.setVisible(false));
      this.dialog.add(close);
    };
    render();
    this.dialog.setVisible(true);
  }

  private showTextTooltip(title: string, desc: string, x: number, y: number): void {
    this.tooltip.removeAll(true);
    const w = 180, h = 44;
    const tx = Phaser.Math.Clamp(x + 30, 0, this.scale.width - w), ty = Phaser.Math.Clamp(y - 10, 0, 540 - h);
    const g = this.add.graphics();
    g.fillStyle(0x10141c, 0.97).fillRoundedRect(tx, ty, w, h, 6);
    g.lineStyle(1.5, 0x7ec8ff, 1).strokeRoundedRect(tx, ty, w, h, 6);
    this.tooltip.add(g);
    this.tooltip.add(crispText(this, tx + 8, ty + 6, title, { fontSize: "11px", color: "#cfe6ff", fontStyle: "bold" }));
    this.tooltip.add(crispText(this, tx + 8, ty + 22, desc, { fontSize: "9px", color: "#cdd9ea", wordWrap: { width: w - 16 } }));
    this.tooltip.setVisible(true);
  }

  private showTooltip(inst: ItemInstanceSave, x: number, y: number): void {
    const def = ITEM_CATALOG_MAP.get(inst.defId);
    if (!def) return;
    this.tooltip.removeAll(true);
    const rows = itemStatRows(inst, def);

    const w = 234, headerH = 36, rowH = 13, footerH = 26;
    const h = headerH + rows.length * rowH + footerH;
    const tx = Phaser.Math.Clamp(x + 30, 0, this.scale.width - w);
    const ty = Phaser.Math.Clamp(y - 10, 0, 540 - h);
    const g = this.add.graphics();
    g.fillStyle(0x10141c, 0.97).fillRoundedRect(tx, ty, w, h, 6);
    g.lineStyle(1.5, RARITY_INT[def.rarity], 1).strokeRoundedRect(tx, ty, w, h, 6);
    this.tooltip.add(g);

    // Header: name (rarity colour) + rarity/slot/enhance line.
    const enh = inst.enhanceLevel ? `  +${inst.enhanceLevel}` : "";
    this.tooltip.add(this.add.text(tx + 8, ty + 6, def.name, { fontSize: "11px", color: RARITY_HEX[def.rarity], fontStyle: "bold" }));
    this.tooltip.add(this.add.text(tx + 8, ty + 21, `${def.rarity} ${def.slot}${def.weaponType ? ` (${def.weaponType})` : ""}${enh}`, { fontSize: "9px", color: "#9fb0c4" }));

    // Stat rows. Source colour (white base / blue primary affix / purple extra
    // affix) marks where the stat comes from; value colour (green better / red
    // worse) marks roll quality. Base stats: label + right-aligned value. Affixes:
    // a full sentence with the value tinted inline (e.g. blue "Ignores " + green
    // "7%" + blue " of enemy Armor").
    let ry = ty + headerH;
    for (const r of rows) {
      const vstyle = { fontSize: "9px", color: QUALITY_COLOR[r.quality], fontStyle: "bold" };
      if (r.source === "base") {
        this.tooltip.add(this.add.text(tx + 10, ry, r.before, { fontSize: "9px", color: SOURCE_COLOR.base }));
        if (r.bonus) {
          // enhanced: "<total> (+bonus)" — bonus in a distinct enhance colour
          const bt = this.add.text(tx + w - 8, ry, r.bonus, { fontSize: "9px", color: "#7fdfff", fontStyle: "bold" }).setOrigin(1, 0);
          this.tooltip.add(bt);
          this.tooltip.add(this.add.text(tx + w - 10 - bt.width, ry, r.value, vstyle).setOrigin(1, 0));
        } else {
          this.tooltip.add(this.add.text(tx + w - 8, ry, r.value, vstyle).setOrigin(1, 0));
        }
      } else {
        const sc = { fontSize: "9px", color: SOURCE_COLOR[r.source] };
        let cx = tx + 10;
        const b = this.add.text(cx, ry, r.before, sc); this.tooltip.add(b); cx += b.width;
        const v = this.add.text(cx, ry, r.value, vstyle); this.tooltip.add(v); cx += v.width;
        this.tooltip.add(this.add.text(cx, ry, r.after, sc));
      }
      ry += rowH;
    }

    // Footer: a small colour legend (teaches the code) + required level.
    this.tooltip.add(this.add.text(tx + 8, ry + 4, "Stat", { fontSize: "8px", color: SOURCE_COLOR.base }));
    this.tooltip.add(this.add.text(tx + 34, ry + 4, "Primary", { fontSize: "8px", color: SOURCE_COLOR.primary }));
    this.tooltip.add(this.add.text(tx + 78, ry + 4, "Extra", { fontSize: "8px", color: SOURCE_COLOR.affix }));
    this.tooltip.add(this.add.text(tx + w - 8, ry + 4, `Req.Lv ${def.requiredLevel}`, { fontSize: "8px", color: "#7c8aa0" }).setOrigin(1, 0));
    this.tooltip.setVisible(true);
  }

  private hideTooltip(): void { this.tooltip.setVisible(false); }

  private showToast(msg: string): void {
    this.toast.setText(msg).setVisible(true);
    this.time.delayedCall(1600, () => this.toast.setVisible(false));
  }
}
