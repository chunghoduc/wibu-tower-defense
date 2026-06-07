/**
 * ShopScene — buy rolled gear (and the occasional Summoning Scroll) and sell
 * unwanted items back for 75%. Items show as icon + price (name on hover); a
 * crystal-paid Refresh rerolls the stock. Purchases persist (the slot is removed
 * from stock), so bought items no longer "vanish".
 */
import Phaser from "phaser";
import { fadeIn, fadeToScene } from "./uiKit.ts";
import type { SaveManager } from "../core/saveManager.ts";
import type { ShopStockEntry, ItemInstanceSave } from "../core/save.ts";
import { ITEM_CATALOG_MAP, itemSellValue } from "../data/items.ts";
import { crispText, hoverGlowRect, hoverPop } from "./ui.ts";
import { renderItemTooltip } from "./itemTooltip.ts";
import type { Rarity } from "../data/schema.ts";

const RARITY_INT: Record<Rarity, number> = {
  Common: 0x9e9e9e, Magic: 0x2196f3, Rare: 0x9c27b0, Legendary: 0xff9800, Unique: 0xf44336,
};
const SCROLL_GOLD = 0xffcf4a;

export class ShopScene extends Phaser.Scene {
  private mgr!: SaveManager;
  private mode: "buy" | "sell" = "buy";
  private crystalText!: Phaser.GameObjects.Text;
  private feedback!: Phaser.GameObjects.Text;
  private hoverLabel!: Phaser.GameObjects.Text;
  private grid!: Phaser.GameObjects.Container;
  private tooltip!: Phaser.GameObjects.Container;
  private tabBuy!: Phaser.GameObjects.Text;
  private tabSell!: Phaser.GameObjects.Text;
  private refreshBtn!: Phaser.GameObjects.Text;

  constructor() { super("ShopScene"); }

  create(): void {
    fadeIn(this);
    this.mode = "buy";
    this.mgr = this.registry.get("saveManager");
    const W = this.scale.width;

    this.add.text(W / 2, 12, "🏪 Shop", { fontSize: "24px", color: "#ffd700", fontStyle: "bold" }).setOrigin(0.5, 0);
    this.add.text(20, 12, "← Back", { fontSize: "15px", color: "#90caf9" })
      .setInteractive({ useHandCursor: true }).on("pointerdown", () => fadeToScene(this, "MainMenuScene"));
    this.crystalText = this.add.text(W - 20, 14, "", { fontSize: "16px", color: "#bfe4ff" }).setOrigin(1, 0);

    this.tabBuy = this.tab(W / 2 - 86, "Buy", () => this.setMode("buy"));
    this.tabSell = this.tab(W / 2 + 6, "Sell", () => this.setMode("sell"));

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
    this.redraw();
  }

  private tab(x: number, label: string, cb: () => void): Phaser.GameObjects.Text {
    const t = crispText(this, x, 44, label, { fontSize: "14px", color: "#fff", backgroundColor: "#1a2a3a" })
      .setOrigin(0, 0).setPadding(12, 4, 12, 4).setInteractive({ useHandCursor: true });
    t.on("pointerup", cb);
    return t;
  }

  private setMode(m: "buy" | "sell"): void { this.mode = m; this.redraw(); }

  /** Refresh button caption — shows "free" while today's free rerolls remain, else the cost. */
  private refreshLabel(): string {
    const cost = this.mgr.shopRefreshCost();
    return cost > 0 ? `⟳ Refresh (${cost}💎)` : "⟳ Refresh (free)";
  }

  private redraw(): void {
    this.grid.removeAll(true);
    this.tooltip?.setVisible(false);
    const save = this.mgr.getSave();
    this.crystalText.setText(`💎 ${save.currency.crystals}`);
    this.tabBuy.setBackgroundColor(this.mode === "buy" ? "#2a4a6a" : "#1a2a3a").setAlpha(this.mode === "buy" ? 1 : 0.7);
    this.tabSell.setBackgroundColor(this.mode === "sell" ? "#2a4a6a" : "#1a2a3a").setAlpha(this.mode === "sell" ? 1 : 0.7);
    this.refreshBtn.setVisible(this.mode === "buy").setText(this.refreshLabel());

    if (this.mode === "buy") this.drawBuy();
    else this.drawSell(save.inventory.items, save.inventory.equipped);
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
    const afford = save.currency.crystals >= slot.cost;
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
    this.grid.add(crispText(this, x + w / 2, y + h - 32, `💎 ${slot.cost}`, { fontSize: "15px", color: afford ? "#ffe07a" : "#ff7a7a", fontStyle: "bold" }).setOrigin(0.5));

    const z = this.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
    hoverGlowRect(this, z, this.grid, x, y, w, h, { radius: 8, color: isScroll ? SCROLL_GOLD : col });
    if (icon) hoverPop(this, z, icon, 1.12);
    z.on("pointerover", () => {
      this.hoverLabel.setText(name).setColor(isScroll ? "#ffe07a" : "#e8eef6");
      // Item slots get a full stat tooltip (scrolls have no stats).
      if (slot.item && def) renderItemTooltip(this, this.tooltip, slot.item, def, x + w, y); else this.tooltip.setVisible(false);
    });
    z.on("pointerout", () => { this.hoverLabel.setText(""); this.tooltip.setVisible(false); });
    z.on("pointerup", () => {
      const r = this.mgr.buyShopSlot(slot.slotId);
      this.flash(r.message, r.success);
      this.redraw();
    });
    this.grid.add(z);
  }

  // ── Sell: inventory grid ──
  private drawSell(items: ItemInstanceSave[], equipped: Record<string, string | undefined>): void {
    const equippedIds = new Set(Object.values(equipped).filter(Boolean) as string[]);
    if (items.length === 0) {
      this.grid.add(crispText(this, this.scale.width / 2, 220, "No items to sell.", { fontSize: "14px", color: "#90a4bb" }).setOrigin(0.5));
      return;
    }
    const COLS = 7, CW = 124, CH = 96, X0 = 24, Y0 = 84, GX = 6, GY = 8, BOTTOM = 466;
    items.forEach((inst, i) => {
      const x = X0 + (i % COLS) * (CW + GX), y = Y0 + Math.floor(i / COLS) * (CH + GY);
      if (y + CH > BOTTOM) return;
      this.drawSellCard(inst, x, y, CW, CH, equippedIds.has(inst.id));
    });
  }

  private drawSellCard(inst: ItemInstanceSave, x: number, y: number, w: number, h: number, isEquipped: boolean): void {
    const def = ITEM_CATALOG_MAP.get(inst.defId);
    const col = def ? RARITY_INT[def.rarity] : 0x888888;
    const sell = def ? itemSellValue(def) : 0;
    const g = this.add.graphics();
    g.fillStyle(0x141c28, isEquipped ? 0.5 : 1).fillRoundedRect(x, y, w, h, 6);
    g.lineStyle(1.5, col, isEquipped ? 0.5 : 1).strokeRoundedRect(x, y, w, h, 6);
    this.grid.add(g);
    let icon: Phaser.GameObjects.Image | undefined;
    if (this.textures.exists(`item__${inst.defId}`)) {
      icon = this.add.image(x + w / 2, y + 32, `item__${inst.defId}`).setOrigin(0.5).setAlpha(isEquipped ? 0.5 : 1);
      icon.setScale(Math.min(44 / icon.width, 44 / icon.height));
      this.grid.add(icon);
    }
    if ((inst.enhanceLevel ?? 0) > 0) this.grid.add(crispText(this, x + w - 4, y + 3, `+${inst.enhanceLevel}`, { fontSize: "9px", color: "#ffe07a", fontStyle: "bold" }).setOrigin(1, 0));
    this.grid.add(crispText(this, x + w / 2, y + h - 16, isEquipped ? "equipped" : `💎 +${sell}`, { fontSize: "11px", color: isEquipped ? "#6b7689" : "#8be06a", fontStyle: "bold" }).setOrigin(0.5));

    const z = this.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
    hoverGlowRect(this, z, this.grid, x, y, w, h, { color: col });
    if (icon) hoverPop(this, z, icon, 1.12);
    z.on("pointerover", () => {
      this.hoverLabel.setText(`${def?.name ?? "Item"}${isEquipped ? " (equipped — unequip to sell)" : ""}`);
      if (def) renderItemTooltip(this, this.tooltip, inst, def, x + w, y);
    });
    z.on("pointerout", () => { this.hoverLabel.setText(""); this.tooltip.setVisible(false); });
    z.on("pointerup", () => {
      const r = this.mgr.sellItem(inst.id);
      this.flash(r.message, r.success);
      this.redraw();
    });
    this.grid.add(z);
  }

  private flash(msg: string, ok: boolean): void {
    this.feedback.setText(msg).setColor(ok ? "#a5d6a7" : "#ef9a9a");
    this.time.delayedCall(1600, () => { if (this.feedback.text === msg) this.feedback.setText(""); });
  }
}
