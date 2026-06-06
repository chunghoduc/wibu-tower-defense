/**
 * HeroScene (T4) — game-style loadout: an equipment paper-doll (10 drop-zone
 * slots) and a draggable inventory grid. Drag an item onto its slot to equip;
 * drag an equipped item back to the bag to unequip. Hover shows a stat tooltip.
 */
import Phaser from "phaser";
import type { SaveManager } from "../core/saveManager.ts";
import { ITEM_CATALOG_MAP } from "../data/items.ts";
import { ITEM_SLOTS, type ItemSlot, type Rarity } from "../data/schema.ts";
import type { ItemInstanceSave } from "../core/save.ts";

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

  constructor() { super("HeroScene"); }

  create(): void {
    this.mgr = this.registry.get("saveManager");
    this.slotZones.clear(); this.slotPos.clear();
    const W = this.scale.width;

    this.add.text(W / 2, 12, "Hero — Loadout", { fontSize: "23px", color: "#ffd700", fontStyle: "bold" }).setOrigin(0.5, 0);
    this.add.text(20, 8, "← Back", { fontSize: "15px", color: "#90caf9" })
      .setInteractive({ useHandCursor: true }).on("pointerdown", () => this.scene.start("MainMenuScene"));

    const save = this.mgr.getSave();
    this.add.text(40, 48, `Level ${save.hero.level}`, { fontSize: "14px", color: "#cfe0f5" });
    this.add.text(40, 70, "Equipment — drag items here", { fontSize: "11px", color: "#90a4bb" });
    this.add.text(this.invRect.x, 74, "Inventory — drag an item onto its slot to equip", { fontSize: "11px", color: "#90a4bb" });

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
    this.toast = this.add.text(W / 2, 500, "", { fontSize: "13px", color: "#ffd6a0", backgroundColor: "#2a1a1a" })
      .setOrigin(0.5).setPadding(8, 4, 8, 4).setDepth(220).setVisible(false);

    this.setupDrag();
    this.refresh();
  }

  private setupDrag(): void {
    this.input.on("dragstart", (_p: Phaser.Input.Pointer, obj: Phaser.GameObjects.Container) => {
      obj.setDepth(150); this.hideTooltip();
    });
    this.input.on("drag", (_p: Phaser.Input.Pointer, obj: Phaser.GameObjects.Container, x: number, y: number) => {
      obj.x = x; obj.y = y;
    });
    this.input.on("drop", (_p: Phaser.Input.Pointer, obj: Phaser.GameObjects.Container, zone: Phaser.GameObjects.Zone) => {
      this.handleDrop(obj, zone);
    });
    this.input.on("dragend", (_p: Phaser.Input.Pointer, _obj: Phaser.GameObjects.Container, dropped: boolean) => {
      if (!dropped) this.refresh(); // snap back
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

    // equipped tiles (sit on their slot)
    for (const slot of ITEM_SLOTS) {
      const instId = save.inventory.equipped[slot];
      if (!instId) continue;
      const inst = save.inventory.items.find((it) => it.id === instId);
      if (!inst) continue;
      const p = this.slotPos.get(slot)!;
      this.tiles.add(this.makeTile(inst, p.x, p.y, slot));
    }

    // inventory tiles (unequipped), grid-packed in the inventory rect
    const equipped = new Set(Object.values(save.inventory.equipped).filter(Boolean));
    const bag = save.inventory.items.filter((it) => !equipped.has(it.id));
    const cols = Math.floor((this.invRect.w - 12) / (TILE + 6));
    bag.forEach((inst, i) => {
      const c = i % cols, r = Math.floor(i / cols);
      const x = this.invRect.x + 12 + c * (TILE + 6) + TILE / 2;
      const y = this.invRect.y + 12 + r * (TILE + 6) + TILE / 2;
      if (y > this.invRect.y + this.invRect.h - TILE / 2) return; // clip overflow
      this.tiles.add(this.makeTile(inst, x, y, null));
    });
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

    c.setData("instanceId", inst.id).setData("fromSlot", fromSlot);
    c.setInteractive({ useHandCursor: true, draggable: true });
    c.on("pointerover", () => this.showTooltip(inst, x, y));
    c.on("pointerout", () => this.hideTooltip());
    return c;
  }

  private showTooltip(inst: ItemInstanceSave, x: number, y: number): void {
    const def = ITEM_CATALOG_MAP.get(inst.defId);
    if (!def) return;
    this.tooltip.removeAll(true);
    const lines = [
      `${def.name}`,
      `${def.rarity} ${def.slot}${def.weaponType ? " (" + def.weaponType + ")" : ""}`,
      `Primary: ${def.primaryAffix.type}`,
      ...Object.entries(inst.rolledStats).map(([k, v]) => `${k}: ${typeof v === "number" ? (v >= 1 ? Math.round(v) : v.toFixed(2)) : v}`),
      `Req. level ${def.requiredLevel}`,
    ];
    const w = 180, h = 16 + lines.length * 14;
    const tx = Phaser.Math.Clamp(x + 30, 0, this.scale.width - w), ty = Phaser.Math.Clamp(y - 10, 0, 540 - h);
    const g = this.add.graphics();
    g.fillStyle(0x10141c, 0.97).fillRoundedRect(tx, ty, w, h, 6);
    g.lineStyle(1.5, RARITY_INT[def.rarity], 1).strokeRoundedRect(tx, ty, w, h, 6);
    this.tooltip.add(g);
    lines.forEach((ln, i) => this.tooltip.add(this.add.text(tx + 8, ty + 6 + i * 14,
      ln, { fontSize: i === 0 ? "11px" : "9px", color: i === 0 ? RARITY_HEX[def.rarity] : "#cdd9ea", fontStyle: i === 0 ? "bold" : "normal" })));
    this.tooltip.setVisible(true);
  }

  private hideTooltip(): void { this.tooltip.setVisible(false); }

  private showToast(msg: string): void {
    this.toast.setText(msg).setVisible(true);
    this.time.delayedCall(1600, () => this.toast.setVisible(false));
  }
}
