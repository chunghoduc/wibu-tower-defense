/**
 * HeroScene (T4) — game-style loadout: an equipment paper-doll (10 drop-zone
 * slots) and a draggable inventory grid. Drag an item onto its slot to equip;
 * drag an equipped item back to the bag to unequip. Hover shows a stat tooltip.
 */
import Phaser from "phaser";
import { fadeIn, fadeToScene } from "./uiKit.ts";
import type { SaveManager } from "../core/saveManager.ts";
import { ITEM_CATALOG_MAP } from "../data/items.ts";
import { renderItemTooltip } from "./itemTooltip.ts";
import { renderCompareDialog } from "./itemCompareDialog.ts";
import { ITEM_SLOTS, equipSlotsFor, type ItemSlot, type Rarity, type ItemDef } from "../data/schema.ts";
import { DOLL_SLOTS, DOLL_PANEL, DOLL_BASE_KEY } from "../data/heroDoll.ts";
import { renderHeroStats } from "./heroStatsPanel.ts";
import type { ItemInstanceSave } from "../core/save.ts";
import { MATERIALS, MATERIALS_MAP, BOX_RARITY_COLOR, boxRarityName, type MaterialKind } from "../data/materials.ts";
import { renderEnhanceDialog } from "./itemEnhanceDialog.ts";
import { crispText, panelText } from "./ui.ts";
import { drawScrollbar } from "./scrollbar.ts";
import { attachDragScroll, type DragScrollHandle } from "./scrollDrag.ts";
import { buildCategoryChips, slotInCategory, type ItemCategory, type CategoryChips } from "./itemFilter.ts";
import { BoxOpenOverlay } from "./boxOpenOverlay.ts";
import { boxOddsText } from "../core/boxes.ts";

type InvFilter = "items" | "materials" | "boxes";

const RARITY_HEX: Record<Rarity, string> = {
  Common: "#9e9e9e", Magic: "#2196f3", Rare: "#9c27b0", Legendary: "#ff9800", Unique: "#f44336",
};
const RARITY_INT: Record<Rarity, number> = {
  Common: 0x9e9e9e, Magic: 0x2196f3, Rare: 0x9c27b0, Legendary: 0xff9800, Unique: 0xf44336,
};
const SLOT_LABEL: Record<ItemSlot, string> = {
  Weapon: "Weapon", Helmet: "Helmet", BodyArmor: "Body", Gloves: "Gloves", Boots: "Boots",
  Amulet: "Amulet", Ring1: "Ring", Ring2: "Ring", Pet: "Pet", Wing: "Wing",
};

const TILE = 52;

export class HeroScene extends Phaser.Scene {
  private mgr!: SaveManager;
  private tiles!: Phaser.GameObjects.Container;   // draggable item tiles
  private slotZones = new Map<ItemSlot, Phaser.GameObjects.Zone>();
  private slotPos = new Map<ItemSlot, { x: number; y: number }>();
  private invRect = { x: 360, y: 96, w: 580, h: 380 };
  private statsBox!: Phaser.GameObjects.Container;
  private static readonly STATS_PANEL = { x: 26, y: 398, w: 300, h: 136 };
  private tooltip!: Phaser.GameObjects.Container;
  private toast!: Phaser.GameObjects.Text;
  private filter: InvFilter = "items";
  private filterTabs: Phaser.GameObjects.Text[] = [];
  private itemCategory: ItemCategory = "all";   // slot-family sub-filter (Items view only)
  private catChips!: CategoryChips;
  private dialog!: Phaser.GameObjects.Container;   // enhance modal
  private didDrag = false;
  private boxOverlay?: BoxOpenOverlay;
  private invOffset = 0;        // inventory scroll position, in rows
  private invDrag!: DragScrollHandle;  // touch/drag scrolling for the inventory grid
  private invMaxOffset = 0;
  private invCols = 1;
  private invVisibleRows = 1;

  constructor() { super("HeroScene"); }

  create(): void {
    fadeIn(this);
    this.mgr = this.registry.get("saveManager");
    this.slotZones.clear(); this.slotPos.clear();
    this.filterTabs = [];          // reset on scene re-entry
    this.didDrag = false;
    this.invOffset = 0;
    this.itemCategory = "all";
    this.boxOverlay = undefined;   // stale across scene re-entry (Phaser reuses instances)
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
      t.on("pointerdown", () => { this.filter = tab.id; this.invOffset = 0; this.refreshTabs(); this.refresh(); });
      this.filterTabs.push(t);
    });
    // Category sub-filter (Weapon / Armor / Accessory), shown only on the Items
    // view — sits on the right of the tab row and narrows a crowded bag.
    this.catChips = buildCategoryChips(this, this.invRect.x + 300, 72, (c) => {
      this.itemCategory = c; this.invOffset = 0; this.refresh();
    });

    // Equipment paper-doll: every slot mapped to its place on the hero's body.
    const dp = DOLL_PANEL;
    const pg = this.add.graphics();
    pg.fillStyle(0x0e1622, 0.92).fillRoundedRect(dp.x, dp.y, dp.w, dp.h, 10);
    pg.lineStyle(2, 0x2a3a56, 1).strokeRoundedRect(dp.x, dp.y, dp.w, dp.h, 10);
    pg.fillStyle(0x1a2740, 0.45).fillEllipse(dp.x + dp.w / 2, dp.y + dp.h * 0.46, dp.w * 0.74, dp.h * 0.66); // soft spotlight
    if (this.textures.exists(DOLL_BASE_KEY)) {
      const img = this.add.image(dp.x + dp.w / 2, dp.y + dp.h / 2, DOLL_BASE_KEY).setOrigin(0.5).setDepth(1);
      img.setScale(Math.min(dp.w / img.width, dp.h / img.height) * 0.98);
    }
    const DSIZE = 40;
    for (const ds of DOLL_SLOTS) {
      const sx = dp.x + ds.nx * dp.w, sy = dp.y + ds.ny * dp.h;
      this.slotPos.set(ds.slot, { x: sx, y: sy });
      const g = this.add.graphics().setDepth(ds.behind ? 0 : 4);
      g.fillStyle(0x0c121c, ds.behind ? 0.45 : 0.72).fillRoundedRect(sx - DSIZE / 2, sy - DSIZE / 2, DSIZE, DSIZE, 6);
      g.lineStyle(1.5, 0x3a4a64, 1).strokeRoundedRect(sx - DSIZE / 2, sy - DSIZE / 2, DSIZE, DSIZE, 6);
      this.add.text(sx, sy + DSIZE / 2 + 1, ds.label, { fontSize: "8px", color: "#8aa0bb" }).setOrigin(0.5, 0).setDepth(5);
      const zone = this.add.zone(sx - 24, sy - 24, 48, 48).setOrigin(0).setRectangleDropZone(48, 48);
      zone.setData("slot", ds.slot);
      this.slotZones.set(ds.slot, zone);
    }

    // Inventory background drop-zone (unequip target)
    const invG = this.add.graphics();
    invG.fillStyle(0x0e141e, 0.6).fillRoundedRect(this.invRect.x, this.invRect.y, this.invRect.w, this.invRect.h, 8);
    invG.lineStyle(1, 0x2a3650, 1).strokeRoundedRect(this.invRect.x, this.invRect.y, this.invRect.w, this.invRect.h, 8);
    const invZone = this.add.zone(this.invRect.x, this.invRect.y, this.invRect.w, this.invRect.h)
      .setOrigin(0).setRectangleDropZone(this.invRect.w, this.invRect.h);
    invZone.setData("inv", true);

    // Hero total-stats panel — sits directly under the paper-doll (left column).
    const sp = HeroScene.STATS_PANEL;
    const spG = this.add.graphics();
    spG.fillStyle(0x0e1622, 0.92).fillRoundedRect(sp.x, sp.y, sp.w, sp.h, 10);
    spG.lineStyle(2, 0x2a3a56, 1).strokeRoundedRect(sp.x, sp.y, sp.w, sp.h, 10);
    this.statsBox = this.add.container(0, 0).setDepth(6);

    this.tiles = this.add.container(0, 0).setDepth(10); // item tiles sit above the doll/base
    this.tooltip = this.add.container(0, 0).setDepth(200).setVisible(false);
    this.dialog = this.add.container(0, 0).setDepth(240).setVisible(false);
    this.toast = this.add.text(W / 2, 500, "", { fontSize: "13px", color: "#ffd6a0", backgroundColor: "#2a1a1a" })
      .setOrigin(0.5).setPadding(8, 4, 8, 4).setDepth(220).setVisible(false);

    this.setupDrag();

    // Mouse wheel scrolls the inventory grid (only when hovering over it).
    this.input.on("wheel", (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      if (this.invMaxOffset <= 0) return;
      const r = this.invRect;
      if (p.x < r.x || p.x > r.x + r.w || p.y < r.y || p.y > r.y + r.h) return;
      const next = Phaser.Math.Clamp(this.invOffset + (dy > 0 ? 1 : -1), 0, this.invMaxOffset);
      if (next !== this.invOffset) { this.invOffset = next; this.refresh(); }
    });

    // Touch/drag scrolling: drag empty grid space to scroll. Defers to tile
    // drags (equip) via the didDrag flag so dragging a tile still moves it.
    this.invDrag = attachDragScroll(this, {
      rect: () => this.invRect,
      rowH: TILE + 6,
      maxOffset: () => this.invMaxOffset,
      getOffset: () => this.invOffset,
      setOffset: (n) => { this.invOffset = n; },
      onChange: () => this.refresh(),
      blocked: () => this.didDrag,
    });

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
      if (def && equipSlotsFor(def.slot).includes(slot)) {
        if (!this.mgr.equipItem(instId, slot)) this.showToast(`Requires level ${inst?.requiredLevel ?? def.requiredLevel}`);
      } else if (def) {
        this.showToast(`${def.name} doesn't fit ${SLOT_LABEL[slot]}`);
      }
    }
    this.refresh();
  }

  private refresh(): void {
    this.tiles.removeAll(true);
    const save = this.mgr.getSave();
    this.statsBox.removeAll(true);
    renderHeroStats(this, this.statsBox, HeroScene.STATS_PANEL, save);
    this.catChips.setVisible(this.filter === "items");
    this.catChips.update(this.itemCategory);

    // Equipped tiles always sit on the paper-doll.
    for (const slot of ITEM_SLOTS) {
      const instId = save.inventory.equipped[slot];
      if (!instId) continue;
      const inst = save.inventory.items.find((it) => it.id === instId);
      if (!inst) continue;
      const p = this.slotPos.get(slot)!;
      this.tiles.add(this.makeTile(inst, p.x, p.y, slot, 40));
    }

    // Window the inventory list: clamp the scroll offset to what the current
    // filter holds, then only the rows inside the viewport get tiles.
    this.invCols = Math.max(1, Math.floor((this.invRect.w - 12) / (TILE + 6)));
    this.invVisibleRows = Math.max(1, Math.floor((this.invRect.h - 12) / (TILE + 6)));
    const totalRows = Math.ceil(this.listCount(save) / this.invCols);
    this.invMaxOffset = Math.max(0, totalRows - this.invVisibleRows);
    this.invOffset = Phaser.Math.Clamp(this.invOffset, 0, this.invMaxOffset);

    if (this.filter === "items") this.refreshItems(save);
    else this.refreshMaterials(save, this.filter === "boxes" ? ["box"] : ["jewel", "consumable"]);

    drawScrollbar(this, this.tiles, {
      x: this.invRect.x + this.invRect.w - 10, y: this.invRect.y + 8, h: this.invRect.h - 16,
      total: totalRows, visible: this.invVisibleRows, offset: this.invOffset,
    });
  }

  /** Unequipped bag items matching the active category sub-filter. */
  private bagItems(save: ReturnType<SaveManager["getSave"]>): ItemInstanceSave[] {
    const equipped = new Set(Object.values(save.inventory.equipped).filter(Boolean));
    return save.inventory.items.filter((it) => {
      if (equipped.has(it.id)) return false;
      const def = ITEM_CATALOG_MAP.get(it.defId);
      return def ? slotInCategory(def.slot, this.itemCategory) : true;
    });
  }

  /** Number of inventory cells the active filter would render (for scroll math). */
  private listCount(save: ReturnType<SaveManager["getSave"]>): number {
    if (this.filter === "items") return this.bagItems(save).length;
    const kinds: MaterialKind[] = this.filter === "boxes" ? ["box"] : ["jewel", "consumable"];
    return MATERIALS.filter((m) => kinds.includes(m.kind) && (save.materials[m.id] ?? 0) > 0).length;
  }

  /** Grid cell for the i-th list item, or null when it falls outside the scroll window. */
  private gridPos(i: number): { x: number; y: number } | null {
    const c = i % this.invCols, r = Math.floor(i / this.invCols) - this.invOffset;
    if (r < 0 || r >= this.invVisibleRows) return null;
    const x = this.invRect.x + 12 + c * (TILE + 6) + TILE / 2;
    const y = this.invRect.y + 12 + r * (TILE + 6) + TILE / 2;
    return { x, y };
  }

  private refreshItems(save: ReturnType<SaveManager["getSave"]>): void {
    this.bagItems(save).forEach((inst, i) => {
      const p = this.gridPos(i);
      if (p) this.tiles.add(this.makeTile(inst, p.x, p.y, null));
    });
  }

  private refreshMaterials(save: ReturnType<SaveManager["getSave"]>, kinds: MaterialKind[]): void {
    const isBox = kinds.includes("box");
    const mats = MATERIALS.filter((m) => kinds.includes(m.kind));
    let i = 0;
    for (const m of mats) {
      const count = save.materials[m.id] ?? 0;
      if (count <= 0) continue;
      const p = this.gridPos(i++);
      if (p) this.tiles.add(this.makeMaterialTile(m.id, count, p.x, p.y, isBox));
    }
    if (i === 0) {
      this.tiles.add(this.add.text(this.invRect.x + 16, this.invRect.y + 16,
        isBox ? "No chests yet — beat a stage boss to earn one." : "No materials yet — clear stages to find them.",
        { fontSize: "12px", color: "#7c8aa0" }));
    }
  }

  /** A draggable item tile centered at (x,y). `size` lets doll slots be smaller. */
  private makeTile(inst: ItemInstanceSave, x: number, y: number, fromSlot: ItemSlot | null, size = TILE): Phaser.GameObjects.Container {
    const def = ITEM_CATALOG_MAP.get(inst.defId);
    const rarity = def?.rarity ?? "Common";
    const c = this.add.container(x, y).setSize(size, size).setDepth(8);
    const g = this.add.graphics();
    g.fillStyle(0x1c2636, 1).fillRoundedRect(-size / 2, -size / 2, size, size, 5);
    g.lineStyle(2, RARITY_INT[rarity], 1).strokeRoundedRect(-size / 2, -size / 2, size, size, 5);
    c.add(g);
    const key = `item__${inst.defId}`;
    if (this.textures.exists(key)) {
      const img = this.add.image(0, -2, key).setOrigin(0.5);
      img.setScale((size - 12) / img.height);
      c.add(img);
    } else {
      c.add(this.add.text(0, -4, (def?.name ?? "?").slice(0, 6), { fontSize: "8px", color: RARITY_HEX[rarity], align: "center", wordWrap: { width: size - 6 } }).setOrigin(0.5));
    }
    if (size >= TILE) {
      c.add(this.add.text(0, size / 2 - 8, def?.slot === "Weapon" ? (def.weaponType ?? "") : (def?.slot.replace(/Ring[12]/, "Ring") ?? ""), { fontSize: "7px", color: "#8aa0bb" }).setOrigin(0.5));
    }

    // Enhancement level badge (+N) — top-right (T13).
    if ((inst.enhanceLevel ?? 0) > 0) {
      const bg = this.add.graphics();
      bg.fillStyle(0x1a1206, 0.9).fillCircle(size / 2 - 8, -size / 2 + 8, 9);
      bg.lineStyle(1.5, 0xffd34d, 1).strokeCircle(size / 2 - 8, -size / 2 + 8, 9);
      c.add(bg);
      c.add(crispText(this, size / 2 - 8, -size / 2 + 8, `+${inst.enhanceLevel}`, { fontSize: "10px", color: "#ffe07a", fontStyle: "bold" }).setOrigin(0.5));
    }

    c.setData("instanceId", inst.id).setData("fromSlot", fromSlot);
    c.setInteractive({ useHandCursor: true, draggable: true });
    // Hover feedback: a bright glow border over the tile + a gentle scale pop.
    const glow = this.add.graphics().setVisible(false);
    glow.fillStyle(0xfff0bf, 0.10).fillRoundedRect(-size / 2, -size / 2, size, size, 5);
    glow.lineStyle(2.5, 0xfff0bf, 0.95).strokeRoundedRect(-size / 2, -size / 2, size, size, 5);
    c.add(glow);
    c.on("pointerover", () => { this.showTooltip(inst, x, y); glow.setVisible(true); c.setDepth(30); this.tweens.add({ targets: c, scaleX: 1.12, scaleY: 1.12, duration: 90, ease: "Back.easeOut" }); });
    c.on("pointerout", () => { this.hideTooltip(); glow.setVisible(false); c.setDepth(8); this.tweens.add({ targets: c, scaleX: 1, scaleY: 1, duration: 120, ease: "Quad.easeOut" }); });
    c.on("pointerup", () => { if (!this.didDrag && !this.invDrag.didScroll()) this.openItemAction(inst, fromSlot); }); // tap = compare-to-replace or enhance
    return c;
  }

  /** A material/box tile showing its count; boxes are clickable to open (T15). */
  private makeMaterialTile(id: string, count: number, x: number, y: number, openable: boolean): Phaser.GameObjects.Container {
    const def = MATERIALS_MAP.get(id);
    const rarity = def?.rarity;   // boxes carry a 1..5 rarity tier
    const border = rarity ? (BOX_RARITY_COLOR[rarity] ?? 0xffb74d) : (openable ? 0xffb74d : 0x7ec8ff);
    const c = this.add.container(x, y).setSize(TILE, TILE);
    const g = this.add.graphics();
    g.fillStyle(0x1c2636, 1).fillRoundedRect(-TILE / 2, -TILE / 2, TILE, TILE, 5);
    g.lineStyle(rarity ? 2.5 : 2, border, 1).strokeRoundedRect(-TILE / 2, -TILE / 2, TILE, TILE, 5);
    c.add(g);
    // Painted art per material: boxes use their chest art (box__<id>), other
    // materials (enhance jewels, scroll) use material__<id>. Fall back to an emoji.
    const spriteKey = this.textures.exists(`material__${id}`) ? `material__${id}` : `box__${id}`;
    if (this.textures.exists(spriteKey)) {
      const img = this.add.image(0, -4, spriteKey).setOrigin(0.5);
      img.setScale((TILE - 16) / img.height);
      c.add(img);
    } else {
      c.add(this.add.text(0, -10, openable ? "🎁" : "💠", { fontSize: "20px" }).setOrigin(0.5));
    }
    if (rarity) c.add(crispText(this, 0, TILE / 2 - 13, boxRarityName(rarity), { fontSize: "8px", color: Phaser.Display.Color.IntegerToColor(border).rgba, fontStyle: "bold" }).setOrigin(0.5));
    c.add(crispText(this, TILE / 2 - 4, -TILE / 2 + 4, `×${count}`, { fontSize: "11px", color: "#fff", fontStyle: "bold" }).setOrigin(1, 0));
    c.setInteractive({ useHandCursor: true });
    // Boxes show their opening odds (drop rates) under the description so the
    // player can see what's inside before spending the chest.
    const desc = openable
      ? (def?.description ? `${def.description}\n\n${boxOddsText(id)}` : boxOddsText(id))
      : (def?.description ?? "");
    c.on("pointerover", () => this.showTextTooltip(def?.name ?? id, desc, x, y));
    c.on("pointerout", () => this.hideTooltip());
    if (openable) c.on("pointerup", () => this.openBoxAction(id));
    return c;
  }

  private openBoxAction(boxId: string): void {
    if (this.boxOverlay?.isOpen()) return;        // an open sequence is already playing
    const reward = this.mgr.openBox(boxId);
    if (!reward.opened) return;
    // Anime-style reveal: the chest bursts open and shows its loot. Inventory
    // counts refresh when the overlay is dismissed (onClose).
    this.boxOverlay ??= new BoxOpenOverlay(this, () => this.refresh());
    this.boxOverlay.play(boxId, reward);
  }

  /**
   * Tapping an item decides between two flows: a bag item whose equip slot is
   * already full opens the compare-and-replace dialog; otherwise (slot free, or
   * the tile is already equipped) we go straight to enhance.
   */
  private openItemAction(inst: ItemInstanceSave, fromSlot: ItemSlot | null): void {
    const save = this.mgr.getSave();
    const def = ITEM_CATALOG_MAP.get(inst.defId);
    if (!def) return;
    if (!fromSlot) {
      const candidates = equipSlotsFor(def.slot);
      const freeSlot = candidates.find((s) => !save.inventory.equipped[s]);
      if (freeSlot === undefined) {
        // Every fitting slot is full → compare against the item we'd displace.
        const targetSlot = candidates[0];   // equipItem replaces the first slot too
        const eqInst = save.inventory.items.find((it) => it.id === save.inventory.equipped[targetSlot]);
        const eqDef = eqInst ? ITEM_CATALOG_MAP.get(eqInst.defId) : undefined;
        if (eqInst && eqDef && eqInst.id !== inst.id) {
          this.openCompare(inst, def, eqInst, eqDef, targetSlot);
          return;
        }
      } else {
        // A slot is open → enhance dialog with an Equip button that fills it.
        this.openEnhance(inst.id, freeSlot);
        return;
      }
    }
    this.openEnhance(inst.id);
  }

  /** Side-by-side compare of a bag item against the equipped item it would replace. */
  private openCompare(bagInst: ItemInstanceSave, bagDef: ItemDef, eqInst: ItemInstanceSave, eqDef: ItemDef, slot: ItemSlot): void {
    this.hideTooltip();
    this.dialog.removeAll(true);
    renderCompareDialog(this, this.dialog, { inst: bagInst, def: bagDef }, { inst: eqInst, def: eqDef }, slot, this.mgr.getSave().hero.level, {
      onReplace: () => {
        if (this.mgr.equipItem(bagInst.id, slot)) {
          this.dialog.setVisible(false);
          this.showToast(`Equipped ${bagDef.name}`);
          this.refresh();
        } else {
          this.showToast(`Requires level ${bagInst.requiredLevel ?? bagDef.requiredLevel}`);
        }
      },
      onEnhance: () => { this.dialog.setVisible(false); this.openEnhance(bagInst.id); },
      onClose: () => this.dialog.setVisible(false),
    });
  }

  /**
   * The MU-style enhance dialog for an item (T13). When `equipSlot` is given (a
   * bag item with that slot free), the dialog also offers an Equip button.
   */
  private openEnhance(instanceId: string, equipSlot?: ItemSlot): void {
    this.hideTooltip();
    const def = equipSlot ? ITEM_CATALOG_MAP.get(this.mgr.getSave().inventory.items.find((it) => it.id === instanceId)?.defId ?? "") : undefined;
    renderEnhanceDialog(this, this.dialog, this.mgr, instanceId, {
      onChange: () => this.refresh(),
      onToast: (m) => this.showToast(m),
      onClose: () => this.dialog.setVisible(false),
      onEquip: equipSlot
        ? () => {
            const inst = this.mgr.getSave().inventory.items.find((it) => it.id === instanceId);
            if (this.mgr.equipItem(instanceId, equipSlot)) {
              this.dialog.setVisible(false);
              this.showToast(`Equipped ${def?.name ?? "item"}`);
              this.refresh();
            } else {
              this.showToast(`Requires level ${inst?.requiredLevel ?? def?.requiredLevel}`);
            }
          }
        : undefined,
    });
  }

  private showTextTooltip(title: string, desc: string, x: number, y: number): void {
    this.tooltip.removeAll(true);
    const w = 200, padX = 10;
    // Measure the wrapped body so the card grows to fit instead of clipping it.
    const titleT = panelText(this, 0, 0, title, { fontSize: "13px", color: "#cfe6ff", fontStyle: "bold", wordWrap: { width: w - padX * 2 } });
    const descT = desc ? panelText(this, 0, 0, desc, { fontSize: "11px", color: "#cdd9ea", wordWrap: { width: w - padX * 2 }, lineSpacing: 3 }) : null;
    const h = 12 + titleT.height + (descT ? descT.height + 4 : 0);
    const tx = Phaser.Math.Clamp(x + 30, 0, this.scale.width - w), ty = Phaser.Math.Clamp(y - 10, 0, 540 - h);
    const g = this.add.graphics();
    g.fillStyle(0x10141c, 0.98).fillRoundedRect(tx, ty, w, h, 6);
    g.lineStyle(1.5, 0x7ec8ff, 1).strokeRoundedRect(tx, ty, w, h, 6);
    this.tooltip.add(g);
    titleT.setPosition(tx + padX, ty + 7); this.tooltip.add(titleT);
    if (descT) { descT.setPosition(tx + padX, ty + 9 + titleT.height); this.tooltip.add(descT); }
    this.tooltip.setVisible(true);
  }

  private showTooltip(inst: ItemInstanceSave, x: number, y: number): void {
    const def = ITEM_CATALOG_MAP.get(inst.defId);
    if (!def) return;
    renderItemTooltip(this, this.tooltip, inst, def, x, y, this.mgr.getSave().hero.level);
  }

  private hideTooltip(): void { this.tooltip.setVisible(false); }

  private showToast(msg: string): void {
    this.toast.setText(msg).setVisible(true);
    this.time.delayedCall(1600, () => this.toast.setVisible(false));
  }
}
