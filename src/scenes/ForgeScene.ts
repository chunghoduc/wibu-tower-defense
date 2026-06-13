/**
 * ForgeScene — the end-game crafting & gacha-helper hub. Three sections:
 *  · F7 Awakening: push 5★ towers beyond their limit with Awakening Crystals.
 *  · F18 Alchemy: transmute surplus materials and dupe copies (lossy).
 *  · F10 Spotlight & Spark: see the week's featured Unique, pick a wishlist, and
 *    cash a 200-spark guarantee.
 */
import Phaser from "phaser";
import { fadeIn, fadeToScene, accentPanel, actionChip } from "./uiKit.ts";
import { crispText } from "./ui.ts";
import type { SaveManager } from "../core/saveManager.ts";
import { TOWERS } from "../data/towers.ts";
import { MATERIALS_MAP, AWAKENING_CRYSTAL } from "../data/materials.ts";
import { MAX_AWAKENING, awakeningCost } from "../core/awakening.ts";
import { ALCHEMY_RECIPES, COPIES_PER_CRYSTAL } from "../data/alchemy.ts";
import { featuredForWeek, SPARK_PITY } from "../core/banner.ts";
import { isoWeekKey } from "../core/meta.ts";
import { openWingCraftDialog, type WingCraftItem } from "./wingCraftDialog.ts";
import { JEWEL_OF_CHAOS, FEATHER } from "../data/materials.ts";
import { ITEM_CATALOG_MAP } from "../data/items.ts";
import { wingSuccessChance, wingOutcomeOdds, MIN_ITEMS } from "../core/wingCraft.ts";
import type { Rarity } from "../data/schema.ts";

const W = 960,
  PX = 24,
  PW = W - 48;
const NAME = new Map(TOWERS.map((t) => [t.id, t.name]));
const UNIQUES = TOWERS.filter((t) => t.rarity === "Unique");

export class ForgeScene extends Phaser.Scene {
  private mgr!: SaveManager;
  private layer!: Phaser.GameObjects.Container;
  private toast!: Phaser.GameObjects.Text;
  private scrollY = 0;
  private contentH = 0;

  constructor() {
    super("ForgeScene");
  }

  create(): void {
    fadeIn(this);
    this.scrollY = 0;
    this.contentH = 0; // reset on scene re-entry (Phaser reuses instances)
    this.mgr = this.registry.get("saveManager");
    this.mgr.ensureBanner(isoWeekKey(new Date()));

    crispText(this, W / 2, 10, "⚒ Forge", { fontSize: "24px", color: "#ffd700", fontStyle: "bold" })
      .setOrigin(0.5, 0)
      .setDepth(50);
    crispText(this, 20, 12, "← Back", { fontSize: "15px", color: "#90caf9" })
      .setDepth(50)
      .setInteractive({ useHandCursor: true })
      .on("pointerup", () => fadeToScene(this, "MainMenuScene"));

    this.layer = this.add.container(0, 0);
    this.toast = crispText(this, W / 2, 520, "", {
      fontSize: "13px",
      color: "#ffe1a8",
      backgroundColor: "#2a1f14",
    })
      .setOrigin(0.5)
      .setPadding(10, 5, 10, 5)
      .setDepth(60)
      .setVisible(false);
    this.input.on("wheel", (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      this.scrollY = Phaser.Math.Clamp(this.scrollY - dy * 0.5, -(this.contentH - 460), 0);
      this.layer.y = this.scrollY;
    });
    this.redraw();
  }

  private redraw(): void {
    this.layer.removeAll(true);
    this.layer.y = this.scrollY;
    let y = 44;
    y = this.drawCurrency(y);
    y = this.drawSpark(y);
    y = this.drawWings(y);
    y = this.drawAwakening(y);
    y = this.drawAlchemy(y);
    this.contentH = y + 20;
  }

  private panel(y: number, h: number, accent: number, hot = false): void {
    this.layer.add(accentPanel(this, PX, y, PW, h, accent, hot));
  }

  private button(
    x: number,
    y: number,
    label: string,
    color: string,
    enabled: boolean,
    cb: () => void,
  ): void {
    this.layer.add(
      actionChip(this, x, y, label, color, enabled, cb, {
        fontSize: "13px",
        padX: 12,
        padY: 5,
        disabledFontSize: "12px",
      }),
    );
  }

  private drawCurrency(y: number): number {
    const crystals = this.mgr.getMaterial(AWAKENING_CRYSTAL);
    this.panel(y, 32, 0x33405a);
    this.layer.add(
      crispText(
        this,
        PX + 14,
        y + 8,
        `Awakening Crystals: ${crystals}   ·   Sparks: ${this.mgr.sparks()}/${SPARK_PITY}`,
        { fontSize: "13px", color: "#ffe07a" },
      ),
    );
    return y + 32 + 12;
  }

  private drawSpark(y: number): number {
    const feat = featuredForWeek(isoWeekKey(new Date()));
    const wish = this.mgr.getSave().meta.banner.pickedFeaturedId;
    const canClaim = this.mgr.canClaimSpark();
    const h = 70;
    this.panel(y, h, 0x33405a, canClaim);
    this.layer.add(
      crispText(this, PX + 14, y + 8, `★ Spotlight — featured: ${NAME.get(feat.unique) ?? "—"}`, {
        fontSize: "15px",
        color: "#ffe9b0",
        fontStyle: "bold",
      }),
    );
    this.layer.add(
      crispText(
        this,
        PX + 14,
        y + 30,
        `Wishlist: ${NAME.get(wish) ?? "—"}   ·   ${this.mgr.sparks()}/${SPARK_PITY} sparks to a guaranteed pick`,
        { fontSize: "12px", color: "#9fc0e6" },
      ),
    );
    this.button(PX + PW - 14, y + 30, "Cycle Wishlist", "#3a6a9a", UNIQUES.length > 1, () => {
      const idx = UNIQUES.findIndex((t) => t.id === wish);
      const next = UNIQUES[(idx + 1) % UNIQUES.length];
      this.mgr.setWishlist(next.id);
      this.showToast(`Wishlist → ${next.name}`);
      this.redraw();
    });
    this.button(
      PX + PW - 14,
      y + 54,
      canClaim ? "Claim Spark Reward" : `Need ${SPARK_PITY} sparks`,
      "#1f8f43",
      canClaim,
      () => {
        const id = this.mgr.claimSpark();
        if (id) {
          this.showToast(`✦ Guaranteed: ${NAME.get(id) ?? id}!`);
          this.redraw();
        }
      },
    );
    return y + h + 12;
  }

  private drawWings(y: number): number {
    const jewels = this.mgr.getMaterial(JEWEL_OF_CHAOS);
    const feathers = this.mgr.getMaterial(FEATHER);
    const ready = jewels >= 1 && feathers >= 1;
    this.layer.add(
      crispText(this, PX + 4, y, "Craft Wings", {
        fontSize: "15px",
        color: "#e9b8ff",
        fontStyle: "bold",
      }),
    );
    y += 24;
    const h = 52;
    this.panel(y, h, 0x3a2a55, ready);
    this.layer.add(
      crispText(
        this,
        PX + 14,
        y + 8,
        "Burn 5+ items + Jewel of Chaos + Feather for a chance at random Wings.",
        { fontSize: "12px", color: "#cdb8e6" },
      ),
    );
    this.layer.add(
      crispText(this, PX + 14, y + 28, `Jewel of Chaos: ${jewels}   ·   Feather: ${feathers}`, {
        fontSize: "12px",
        color: "#9fb0c4",
      }),
    );
    this.button(PX + PW - 14, y + h / 2, "Craft Wings…", "#7a3aa8", ready, () =>
      this.openWingCraft(),
    );
    return y + h + 12;
  }

  private openWingCraft(): void {
    const save = this.mgr.getSave();
    const equipped = new Set(Object.values(save.inventory.equipped).filter(Boolean) as string[]);
    const items: WingCraftItem[] = save.inventory.items
      .filter((it) => !equipped.has(it.id))
      .map((it) => {
        const def = ITEM_CATALOG_MAP.get(it.defId);
        return {
          id: it.id,
          defId: it.defId,
          name: def?.name ?? it.defId,
          rarity: (def?.rarity ?? "Common") as Rarity,
        };
      });
    const raritiesOf = (ids: string[]): Rarity[] =>
      ids.map((id) => items.find((i) => i.id === id)?.rarity).filter((r): r is Rarity => !!r);
    const dialog = openWingCraftDialog(this, {
      items,
      jewelsOwned: this.mgr.getMaterial(JEWEL_OF_CHAOS),
      feathersOwned: this.mgr.getMaterial(FEATHER),
      preview: (selectedIds, j) => {
        const rs = raritiesOf(selectedIds);
        return {
          success: rs.length >= MIN_ITEMS ? wingSuccessChance(rs, j) : 0,
          odds: wingOutcomeOdds(rs.length ? rs : (["Common"] as Rarity[])),
        };
      },
      confirm: (selectedIds, j) => {
        const r = this.mgr.craftWings(selectedIds, j);
        if (!r.ok) {
          this.showToast("Craft failed — check materials.");
          return;
        }
        if (r.success && r.item) {
          this.showToast(`✦ Forged ${ITEM_CATALOG_MAP.get(r.item.defId)?.name ?? "Wings"}!`);
        } else {
          this.showToast("The wings dissolved into chaos…");
        }
        dialog.destroy();
        this.redraw();
      },
      onClose: () => dialog.destroy(),
    });
  }

  private drawAwakening(y: number): number {
    const save = this.mgr.getSave();
    this.layer.add(
      crispText(this, PX + 4, y, "Awakening (5★ towers)", {
        fontSize: "15px",
        color: "#ffd56a",
        fontStyle: "bold",
      }),
    );
    y += 24;
    const fives = Object.keys(save.collection).filter(
      (id) => (save.collection[id]?.stars ?? 0) >= 5,
    );
    if (fives.length === 0) {
      this.panel(y, 36, 0x2c3a4f);
      this.layer.add(
        crispText(this, PX + 14, y + 10, "Ascend a tower to 5★ to unlock Awakening.", {
          fontSize: "12px",
          color: "#9fb0c4",
        }),
      );
      return y + 36 + 12;
    }
    for (const id of fives) {
      const rank = this.mgr.awakeningRank(id);
      const check = this.mgr.canAwaken(id);
      const cost = awakeningCost(rank);
      const h = 46;
      this.panel(y, h, rank >= MAX_AWAKENING ? 0x3a6b4a : 0x2c3a4f, check.ok);
      this.layer.add(
        crispText(
          this,
          PX + 14,
          y + 6,
          `${NAME.get(id) ?? id}   ${"✦".repeat(rank)}${"·".repeat(MAX_AWAKENING - rank)}`,
          { fontSize: "13px", color: "#ffe9b0", fontStyle: "bold" },
        ),
      );
      this.layer.add(
        crispText(
          this,
          PX + 14,
          y + 26,
          rank >= MAX_AWAKENING
            ? "Fully Awakened (+30% atk/hp)"
            : `Next rank: ${cost} Awakening Crystals  (+10% atk/hp)`,
          { fontSize: "11px", color: "#aab8cc" },
        ),
      );
      this.button(
        PX + PW - 14,
        y + h / 2,
        rank >= MAX_AWAKENING ? "MAX" : "Awaken",
        "#8a5cc0",
        check.ok,
        () => {
          const r = this.mgr.awaken(id);
          if (r >= 0) {
            this.showToast(`${NAME.get(id) ?? id} → Awakening ${r}!`);
            this.redraw();
          }
        },
      );
      y += h + 8;
    }
    return y + 6;
  }

  private drawAlchemy(y: number): number {
    const save = this.mgr.getSave();
    this.layer.add(
      crispText(this, PX + 4, y, "Alchemy — Surplus Exchange", {
        fontSize: "15px",
        color: "#ffd56a",
        fontStyle: "bold",
      }),
    );
    y += 24;
    for (const r of ALCHEMY_RECIPES) {
      const inTxt = Object.entries(r.inputs)
        .map(([m, n]) => `${n}× ${MATERIALS_MAP.get(m)?.name ?? m}`)
        .join(" + ");
      const outTxt = Object.entries(r.outputs)
        .map(([m, n]) => `${n}× ${MATERIALS_MAP.get(m)?.name ?? m}`)
        .join(" + ");
      const can = Object.entries(r.inputs).every(([m, n]) => this.mgr.getMaterial(m) >= n);
      const h = 40;
      this.panel(y, h, 0x2c3a4f, false);
      this.layer.add(
        crispText(this, PX + 14, y + 12, `${inTxt}  →  ${outTxt}`, {
          fontSize: "12px",
          color: "#cdd6e6",
        }),
      );
      this.button(PX + PW - 14, y + h / 2, "Craft", "#3a6a9a", can, () => {
        if (this.mgr.craftAlchemy(r.id, 1) > 0) {
          this.showToast(`Crafted ${outTxt}`);
          this.redraw();
        }
      });
      y += h + 8;
    }
    // Dupe-copy → crystal exchange: offer the tower with the most banked copies.
    const best = Object.keys(save.collection)
      .map((id) => ({ id, c: save.collection[id]?.copies ?? 0 }))
      .sort((a, b) => b.c - a.c)[0];
    if (best && best.c >= COPIES_PER_CRYSTAL) {
      const h = 40;
      this.panel(y, h, 0x2c3a4f, true);
      this.layer.add(
        crispText(
          this,
          PX + 14,
          y + 12,
          `${COPIES_PER_CRYSTAL}× ${NAME.get(best.id) ?? best.id} copies  →  1× Awakening Crystal  (have ${best.c})`,
          { fontSize: "12px", color: "#cdd6e6" },
        ),
      );
      this.button(PX + PW - 14, y + h / 2, "Exchange", "#8a5cc0", true, () => {
        if (this.mgr.exchangeCopies(best.id, 1) > 0) {
          this.showToast("Minted an Awakening Crystal!");
          this.redraw();
        }
      });
      y += h + 8;
    }
    return y + 6;
  }

  private showToast(msg: string): void {
    this.toast.setText(msg).setVisible(true);
    this.time.delayedCall(1800, () => this.toast.setVisible(false));
  }
}
