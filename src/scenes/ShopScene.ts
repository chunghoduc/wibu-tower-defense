/**
 * ShopScene — buy rolled gear (and the occasional Summoning Scroll), or recycle
 * unwanted gear. Recycling has two paths: Smelt (destroy → Jewels of Chaos, the
 * only source of that material) and Reforge (Rare+ only: re-roll all affixes for
 * gold + chaos). Items show as icon + value (name on hover); a crystal-paid
 * Refresh rerolls the buy stock. Smelt asks for confirmation (irreversible); the
 * recycle grid hides equipped items — unequip first.
 */
import Phaser from "phaser";
import { fadeIn, fadeToScene } from "./uiKit.ts";
import type { SaveManager } from "../core/saveManager.ts";
import type { ShopStockEntry, ItemInstanceSave } from "../core/save.ts";
import { ITEM_CATALOG_MAP } from "../data/items.ts";
import { smeltYield } from "../core/smelt.ts";
import { reforgeCost, canReforge } from "../core/reforge.ts";
import { CHAOS_JEWEL } from "../data/materials.ts";
import { crispText, hoverGlowRect, hoverPop } from "./ui.ts";
import { drawScrollbar } from "./scrollbar.ts";
import { attachDragScroll, type DragScrollHandle } from "./scrollDrag.ts";
import { buildCategoryChips, slotInCategory, type ItemCategory, type CategoryChips } from "./itemFilter.ts";
import { renderItemTooltip } from "./itemTooltip.ts";
import type { Rarity } from "../data/schema.ts";

const RARITY_INT: Record<Rarity, number> = {
  Common: 0x9e9e9e, Magic: 0x2196f3, Rare: 0x9c27b0, Legendary: 0xff9800, Unique: 0xf44336,
};
const SCROLL_GOLD = 0xffcf4a;
const CHAOS_COL = 0xe0457a;   // crimson-magenta — matches the Jewel of Chaos icon

export class ShopScene extends Phaser.Scene {
  private mgr!: SaveManager;
  private mode: "buy" | "recycle" = "buy";
  private crystalText!: Phaser.GameObjects.Text;
  private feedback!: Phaser.GameObjects.Text;
  private hoverLabel!: Phaser.GameObjects.Text;
  private grid!: Phaser.GameObjects.Container;
  private tooltip!: Phaser.GameObjects.Container;
  private tabBuy!: Phaser.GameObjects.Text;
  private tabSell!: Phaser.GameObjects.Text;
  private refreshBtn!: Phaser.GameObjects.Text;
  private confirmDialog: Phaser.GameObjects.Container | null = null;
  private sellOffset = 0;       // recycle grid scroll position, in rows
  private sellMaxOffset = 0;
  private sellCategory: ItemCategory = "all";   // slot-family sub-filter (Recycle view)
  private sellDrag!: DragScrollHandle;          // touch/drag scrolling for the recycle grid
  private catChips!: CategoryChips;

  constructor() { super("ShopScene"); }

  create(): void {
    fadeIn(this);
    this.mode = "buy";
    this.sellOffset = 0;
    this.sellMaxOffset = 0;
    this.sellCategory = "all";
    this.confirmDialog?.destroy(true);
    this.confirmDialog = null;
    this.mgr = this.registry.get("saveManager");
    const W = this.scale.width;

    this.add.text(W / 2, 12, "🏪 Shop", { fontSize: "24px", color: "#ffd700", fontStyle: "bold" }).setOrigin(0.5, 0);
    this.add.text(20, 12, "← Back", { fontSize: "15px", color: "#90caf9" })
      .setInteractive({ useHandCursor: true }).on("pointerdown", () => fadeToScene(this, "MainMenuScene"));
    this.crystalText = this.add.text(W - 20, 14, "", { fontSize: "16px", color: "#bfe4ff" }).setOrigin(1, 0);

    this.tabBuy = this.tab(W / 2 - 96, "Buy", () => this.setMode("buy"));
    this.tabSell = this.tab(W / 2 + 6, "Recycle", () => this.setMode("recycle"));

    this.refreshBtn = crispText(this, W - 20, 46, this.refreshLabel(), { fontSize: "12px", color: "#fff", backgroundColor: "#243a5a" })
      .setOrigin(1, 0).setPadding(8, 4, 8, 4).setInteractive({ useHandCursor: true });
    this.refreshBtn.on("pointerup", () => {
      const r = this.mgr.refreshShop();
      this.flash(r.message, r.success);
      this.redraw();
    });

    this.hoverLabel = this.add.text(W / 2, 478, "", { fontSize: "13px", color: "#e8eef6" }).setOrigin(0.5);
    this.feedback = this.add.text(W / 2, 500, "", { fontSize: "13px", color: "#a5d6a7" }).setOrigin(0.5);
    this.grid = this.add.container(0, 0);
    this.tooltip = this.add.container(0, 0).setDepth(200).setVisible(false);

    // Category sub-filter for the Sell grid (Weapon / Armor / Accessory).
    this.catChips = buildCategoryChips(this, 24, 62, (c) => {
      this.sellCategory = c; this.sellOffset = 0; this.redraw();
    });

    // Mouse wheel scrolls the sell grid one row per notch.
    this.input.on("wheel", (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      if (this.mode !== "recycle" || this.sellMaxOffset <= 0) return;
      const next = Phaser.Math.Clamp(this.sellOffset + (dy > 0 ? 1 : -1), 0, this.sellMaxOffset);
      if (next !== this.sellOffset) { this.sellOffset = next; this.redraw(); }
    });

    // Touch/drag scrolling for the sell grid (mobile has no wheel). Rect matches
    // the grid laid out in drawRecycle(); cards suppress their tap when a drag moved.
    this.sellDrag = attachDragScroll(this, {
      rect: () => ({ x: 24, y: 84, w: 7 * (124 + 6), h: 466 - 84 }),
      rowH: 96 + 8,
      maxOffset: () => this.sellMaxOffset,
      getOffset: () => this.sellOffset,
      setOffset: (n) => { this.sellOffset = n; },
      onChange: () => this.redraw(),
      enabled: () => this.mode === "recycle",
    });

    this.redraw();
  }

  private tab(x: number, label: string, cb: () => void): Phaser.GameObjects.Text {
    const t = crispText(this, x, 44, label, { fontSize: "14px", color: "#fff", backgroundColor: "#1a2a3a" })
      .setOrigin(0, 0).setPadding(12, 4, 12, 4).setInteractive({ useHandCursor: true });
    t.on("pointerup", cb);
    return t;
  }

  private setMode(m: "buy" | "recycle"): void { this.mode = m; this.redraw(); }

  /** Refresh button caption — shows "free" while today's free rerolls remain, else the cost. */
  private refreshLabel(): string {
    const cost = this.mgr.shopRefreshCost();
    return cost > 0 ? `⟳ Refresh (${cost}💎)` : "⟳ Refresh (free)";
  }

  private redraw(): void {
    this.grid.removeAll(true);
    this.tooltip?.setVisible(false);
    const save = this.mgr.getSave();
    const chaos = save.materials[CHAOS_JEWEL] ?? 0;
    this.crystalText.setText(`🪙 ${save.currency.gold}  💎 ${save.currency.diamonds}  ❖ ${chaos}`);
    this.tabBuy.setBackgroundColor(this.mode === "buy" ? "#2a4a6a" : "#1a2a3a").setAlpha(this.mode === "buy" ? 1 : 0.7);
    this.tabSell.setBackgroundColor(this.mode === "recycle" ? "#2a4a6a" : "#1a2a3a").setAlpha(this.mode === "recycle" ? 1 : 0.7);
    this.refreshBtn.setVisible(this.mode === "buy").setText(this.refreshLabel());
    this.catChips.setVisible(this.mode === "recycle");
    this.catChips.update(this.sellCategory);

    if (this.mode === "buy") this.drawBuy();
    else this.drawRecycle(save.inventory.items, save.inventory.equipped);
  }

  // ── Buy: 8 stock slots in a 4×2 grid ──
  private drawBuy(): void {
    const stock = this.mgr.getShopStock();
    const COLS = 4, CW = 220, CH = 168, X0 = 28, Y0 = 84, GX = 8, GY = 10;
    if (stock.length === 0) {
      this.grid.add(crispText(this, this.scale.width / 2, 220, "Sold out! Refresh for new stock.", { fontSize: "14px", color: "#90a4bb" }).setOrigin(0.5));
    }
    stock.forEach((slot, i) => {
      const x = X0 + (i % COLS) * (CW + GX), y = Y0 + Math.floor(i / COLS) * (CH + GY);
      this.drawBuyCard(slot, x, y, CW, CH);
    });
  }

  private drawBuyCard(slot: ShopStockEntry, x: number, y: number, w: number, h: number): void {
    const save = this.mgr.getSave();
    const isScroll = slot.kind === "scroll";
    const def = slot.item ? ITEM_CATALOG_MAP.get(slot.item.defId) : undefined;
    const col = isScroll ? SCROLL_GOLD : (def ? RARITY_INT[def.rarity] : 0x888888);
    const isDiamondSlot = isScroll || def?.rarity === "Legendary" || def?.rarity === "Unique";
    const afford = isDiamondSlot ? save.currency.diamonds >= slot.cost : save.currency.gold >= slot.cost;
    const priceEmoji = isDiamondSlot ? "💎" : "🪙";
    const name = isScroll ? "Summoning Scroll" : (def?.name ?? "Item");

    const g = this.add.graphics();
    g.fillStyle(0x141c28, 1).fillRoundedRect(x, y, w, h, 8);
    g.lineStyle(2, col, 1).strokeRoundedRect(x, y, w, h, 8);
    this.grid.add(g);

    let icon: Phaser.GameObjects.Image | undefined;
    if (isScroll) {
      this.grid.add(crispText(this, x + w / 2, y + 40, "📜", { fontSize: "44px" }).setOrigin(0.5));
    } else if (slot.item && this.textures.exists(`item__${slot.item.defId}`)) {
      icon = this.add.image(x + w / 2, y + 56, `item__${slot.item.defId}`).setOrigin(0.5);
      icon.setScale(Math.min(72 / icon.width, 72 / icon.height));
      this.grid.add(icon);
    }
    this.grid.add(crispText(this, x + w / 2, y + h - 50, isScroll ? "Rare Consumable" : `${def?.rarity} ${def?.slot}`, { fontSize: "10px", color: "#9fb0c4" }).setOrigin(0.5));
    this.grid.add(crispText(this, x + w / 2, y + h - 32, `${priceEmoji} ${slot.cost}`, { fontSize: "15px", color: afford ? "#ffe07a" : "#ff7a7a", fontStyle: "bold" }).setOrigin(0.5));

    const z = this.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
    hoverGlowRect(this, z, this.grid, x, y, w, h, { radius: 8, color: isScroll ? SCROLL_GOLD : col });
    if (icon) hoverPop(this, z, icon, 1.12);
    z.on("pointerover", () => {
      this.hoverLabel.setText(name).setColor(isScroll ? "#ffe07a" : "#e8eef6");
      // Item slots get a full stat tooltip (scrolls have no stats).
      if (slot.item && def) renderItemTooltip(this, this.tooltip, slot.item, def, x + w, y, this.mgr.getSave().hero.level); else this.tooltip.setVisible(false);
    });
    z.on("pointerout", () => { this.hoverLabel.setText(""); this.tooltip.setVisible(false); });
    z.on("pointerup", () => {
      const r = this.mgr.buyShopSlot(slot.slotId);
      this.flash(r.message, r.success);
      this.redraw();
    });
    this.grid.add(z);
  }

  // ── Recycle: inventory grid (equipped items are hidden — unequip them first) ──
  // Overflowing rows scroll via the mouse wheel; only on-screen cards are drawn.
  private drawRecycle(items: ItemInstanceSave[], equipped: Record<string, string | undefined>): void {
    const equippedIds = new Set(Object.values(equipped).filter(Boolean) as string[]);
    const sellable = items.filter((inst) => {
      if (equippedIds.has(inst.id)) return false;
      const def = ITEM_CATALOG_MAP.get(inst.defId);
      return def ? slotInCategory(def.slot, this.sellCategory) : true;
    });
    this.sellMaxOffset = 0;
    if (sellable.length === 0) {
      const msg = this.sellCategory === "all" ? "No spare items to recycle." : "No items in this category.";
      this.grid.add(crispText(this, this.scale.width / 2, 220, msg, { fontSize: "14px", color: "#90a4bb" }).setOrigin(0.5));
      return;
    }
    const COLS = 7, CW = 124, CH = 96, X0 = 24, Y0 = 84, GX = 6, GY = 8, BOTTOM = 466;
    const rowH = CH + GY;
    const visibleRows = Math.max(1, Math.floor((BOTTOM - Y0) / rowH));
    const totalRows = Math.ceil(sellable.length / COLS);
    this.sellMaxOffset = Math.max(0, totalRows - visibleRows);
    this.sellOffset = Phaser.Math.Clamp(this.sellOffset, 0, this.sellMaxOffset);

    for (let r = 0; r < visibleRows; r++) {
      for (let c = 0; c < COLS; c++) {
        const idx = (this.sellOffset + r) * COLS + c;
        if (idx >= sellable.length) break;
        this.drawRecycleCard(sellable[idx], X0 + c * (CW + GX), Y0 + r * rowH, CW, CH);
      }
    }
    drawScrollbar(this, this.grid, {
      x: X0 + COLS * (CW + GX) - GX + 2, y: Y0, h: visibleRows * rowH - GY,
      total: totalRows, visible: visibleRows, offset: this.sellOffset,
    });
  }

  private drawRecycleCard(inst: ItemInstanceSave, x: number, y: number, w: number, h: number): void {
    const def = ITEM_CATALOG_MAP.get(inst.defId);
    const col = def ? RARITY_INT[def.rarity] : 0x888888;
    const chaos = def ? smeltYield(def.rarity) : 1;
    const reforgeable = def ? canReforge(def.rarity) : false;
    const g = this.add.graphics();
    g.fillStyle(0x141c28, 1).fillRoundedRect(x, y, w, h, 6);
    g.lineStyle(1.5, col, 1).strokeRoundedRect(x, y, w, h, 6);
    this.grid.add(g);
    let icon: Phaser.GameObjects.Image | undefined;
    if (this.textures.exists(`item__${inst.defId}`)) {
      icon = this.add.image(x + w / 2, y + 32, `item__${inst.defId}`).setOrigin(0.5);
      icon.setScale(Math.min(44 / icon.width, 44 / icon.height));
      this.grid.add(icon);
    }
    if ((inst.enhanceLevel ?? 0) > 0) this.grid.add(crispText(this, x + w - 4, y + 3, `+${inst.enhanceLevel}`, { fontSize: "9px", color: "#ffe07a", fontStyle: "bold" }).setOrigin(1, 0));
    // Reforge badge marks Rare+ items (the only ones whose affixes can be re-rolled).
    if (reforgeable) this.grid.add(crispText(this, x + 4, y + 3, "⟳", { fontSize: "11px", color: "#ff9ec4", fontStyle: "bold" }).setOrigin(0, 0));
    this.grid.add(crispText(this, x + w / 2, y + h - 16, `❖ ${chaos}`, { fontSize: "11px", color: "#ff9ec4", fontStyle: "bold" }).setOrigin(0.5));

    const z = this.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
    hoverGlowRect(this, z, this.grid, x, y, w, h, { color: col });
    if (icon) hoverPop(this, z, icon, 1.12);
    z.on("pointerover", () => {
      this.hoverLabel.setText(def?.name ?? "Item");
      if (def) renderItemTooltip(this, this.tooltip, inst, def, x + w, y, this.mgr.getSave().hero.level);
    });
    z.on("pointerout", () => { this.hoverLabel.setText(""); this.tooltip.setVisible(false); });
    z.on("pointerup", () => { if (!this.sellDrag.didScroll()) this.openRecycle(inst, def?.name ?? "Item", def?.rarity); });
    this.grid.add(z);
  }

  /**
   * Recycle dialog: Smelt (destroy → chaos) and, for Rare+ items, Reforge (re-roll
   * all affixes for gold + chaos). Smelting is irreversible, so this dialog is the
   * confirmation step.
   */
  private openRecycle(inst: ItemInstanceSave, name: string, rarity: Rarity | undefined): void {
    this.confirmDialog?.destroy(true);
    this.tooltip.setVisible(false);
    const save = this.mgr.getSave();
    const chaos = rarity ? smeltYield(rarity) : 1;
    const cost = rarity ? reforgeCost(rarity) : null;
    const W = this.scale.width, H = this.scale.height;
    const c = this.add.container(0, 0).setDepth(300);

    const dim = this.add.graphics();
    dim.fillStyle(0x000000, 0.55).fillRect(0, 0, W, H);
    const dimZone = this.add.zone(W / 2, H / 2, W, H).setInteractive().on("pointerup", () => this.closeConfirm());
    c.add([dim, dimZone]);

    const bw = 340, bh = cost ? 188 : 150, bx = (W - bw) / 2, by = (H - bh) / 2;
    const panel = this.add.graphics();
    panel.fillStyle(0x141c28, 0.99).fillRoundedRect(bx, by, bw, bh, 10);
    panel.lineStyle(2, CHAOS_COL, 1).strokeRoundedRect(bx, by, bw, bh, 10);
    const panelZone = this.add.zone(bx + bw / 2, by + bh / 2, bw, bh).setInteractive(); // swallow clicks
    c.add([panel, panelZone]);

    c.add(crispText(this, W / 2, by + 16, "Recycle", { fontSize: "16px", color: "#ffffff", fontStyle: "bold" }).setOrigin(0.5, 0));
    c.add(crispText(this, W / 2, by + 40, name, { fontSize: "12px", color: "#ffd6a0", align: "center" }).setOrigin(0.5, 0));

    // Smelt — destroys the item for chaos.
    const smelt = crispText(this, W / 2, by + 66, `🔨 Smelt  →  ❖ ${chaos} Chaos`, { fontSize: "13px", color: "#fff", backgroundColor: "#7a3a5a", fixedWidth: bw - 48, align: "center" })
      .setOrigin(0.5, 0).setPadding(0, 9, 0, 9).setInteractive({ useHandCursor: true });
    smelt.on("pointerup", () => {
      this.closeConfirm();
      const r = this.mgr.smeltItem(inst.id);
      this.flash(r.ok ? `Smelted → ❖ ${r.chaos} Chaos` : "Couldn't smelt", r.ok);
      this.redraw();
    });
    c.add(smelt);

    // Reforge — Rare+ only, re-rolls all affixes for gold + chaos.
    if (cost) {
      const have = (save.materials[CHAOS_JEWEL] ?? 0) >= cost.chaos && save.currency.gold >= cost.gold;
      const reforge = crispText(this, W / 2, by + 108, `⟳ Reforge affixes\n🪙 ${cost.gold} + ❖ ${cost.chaos}`, { fontSize: "12px", color: have ? "#fff" : "#9aa6b8", backgroundColor: have ? "#3a4a7a" : "#2a3142", fixedWidth: bw - 48, align: "center" })
        .setOrigin(0.5, 0).setPadding(0, 7, 0, 7).setInteractive({ useHandCursor: true });
      reforge.on("pointerup", () => {
        if (!have) { this.flash("Not enough gold or chaos", false); return; }
        const r = this.mgr.reforgeItem(inst.id);
        this.flash(r.ok ? "Reforged — new affixes rolled" : "Couldn't reforge", r.ok);
        if (r.ok) { this.closeConfirm(); this.redraw(); }
      });
      c.add(reforge);
    }

    const closeY = by + bh - 30;
    const no = crispText(this, W / 2, closeY, "Cancel", { fontSize: "13px", color: "#cdd6e4" })
      .setOrigin(0.5, 0).setPadding(0, 4, 0, 4).setInteractive({ useHandCursor: true });
    no.on("pointerup", () => this.closeConfirm());
    c.add(no);

    this.confirmDialog = c;
  }

  private closeConfirm(): void {
    this.confirmDialog?.destroy(true);
    this.confirmDialog = null;
  }

  private flash(msg: string, ok: boolean): void {
    this.feedback.setText(msg).setColor(ok ? "#a5d6a7" : "#ef9a9a");
    this.time.delayedCall(1600, () => { if (this.feedback.text === msg) this.feedback.setText(""); });
  }
}
