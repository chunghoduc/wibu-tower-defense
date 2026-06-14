/**
 * ForgeScene — the crafting hub, redesigned as a station grid. A resource bar
 * (crystals / sparks / jewels / feathers) sits over a 2-column grid of station
 * cards (Awakening · Alchemy · Copy Exchange · Craft Wings · Spark Guarantee).
 * Each card shows a mini input→output preview; tapping opens a focused forge
 * dialog that lays the transformation out visually with the action inside it.
 * Craft Wings keeps its bespoke drag machine. All crafting logic is reused —
 * this scene only gathers primitives, builds pure StationVMs and wires taps.
 */
import Phaser from "phaser";
import { fadeIn, fadeToScene, staggerIn } from "./uiKit.ts";
import { crispText } from "./ui.ts";
import { makeFitIcon } from "./itemIcon.ts";
import { buildStationCard } from "./forgeStationCard.ts";
import { openForgeDialog, type ForgeDialogHandle } from "./forgeRecipeDialog.ts";
import { playForgeFx } from "./forgeFxPlayer.ts";
import { forgeFxSpec } from "../core/forgeFx.ts";
import type { SaveManager } from "../core/saveManager.ts";
import { TOWERS } from "../data/towers.ts";
import { AWAKENING_CRYSTAL, JEWEL_OF_CHAOS, FEATHER } from "../data/materials.ts";
import { materialTex } from "../data/assetKeys.ts";
import { ALCHEMY_RECIPES } from "../data/alchemy.ts";
import { featuredForWeek, SPARK_PITY } from "../core/banner.ts";
import { isoWeekKey } from "../core/meta.ts";
import { openWingCraftDialog, type WingCraftItem } from "./wingCraftDialog.ts";
import { ITEM_CATALOG_MAP } from "../data/items.ts";
import { wingSuccessChance, wingOutcomeOdds, MIN_ITEMS } from "../core/wingCraft.ts";
import {
  alchemyRecipeVMs,
  awakeningVMs,
  copyExchangeVMs,
  sparkVM,
  stationFromRecipes,
  wingsStationVM,
  forgeGridLayout,
  type StationVM,
  type StationId,
  type AwakenTowerInput,
  type CopyTowerInput,
} from "../core/forgeStations.ts";
import type { Rarity } from "../data/schema.ts";

const W = 960;
const NAME = new Map(TOWERS.map((t) => [t.id, t.name]));
const UNIQUES = TOWERS.filter((t) => t.rarity === "Unique");

export class ForgeScene extends Phaser.Scene {
  private mgr!: SaveManager;
  private grid!: Phaser.GameObjects.Container;
  private bar!: Phaser.GameObjects.Container;
  private toast!: Phaser.GameObjects.Text;
  private dialog: ForgeDialogHandle | null = null;

  constructor() {
    super("ForgeScene");
  }

  create(): void {
    fadeIn(this);
    this.dialog = null;
    this.mgr = this.registry.get("saveManager");
    this.mgr.ensureBanner(isoWeekKey(new Date()));

    crispText(this, W / 2, 8, "⚒ Forge", { fontSize: "20px", color: "#ffd700", fontStyle: "bold" })
      .setOrigin(0.5, 0)
      .setDepth(50);
    crispText(this, 20, 12, "← Back", { fontSize: "15px", color: "#90caf9" })
      .setDepth(50)
      .setInteractive({ useHandCursor: true })
      .on("pointerup", () => fadeToScene(this, "MainMenuScene"));

    this.bar = this.add.container(0, 0);
    this.grid = this.add.container(0, 0);
    this.toast = crispText(this, W / 2, 512, "", {
      fontSize: "13px",
      color: "#ffe1a8",
      backgroundColor: "#2a1f14",
    })
      .setOrigin(0.5)
      .setPadding(10, 5, 10, 5)
      .setDepth(60)
      .setVisible(false);

    this.rebuild();
  }

  // ---- data gathering --------------------------------------------------------
  private awakenRows(): AwakenTowerInput[] {
    const save = this.mgr.getSave();
    const crystals = this.mgr.getMaterial(AWAKENING_CRYSTAL);
    return Object.keys(save.collection)
      .filter((id) => (save.collection[id]?.stars ?? 0) >= 5)
      .map((id) => ({
        id,
        name: NAME.get(id) ?? id,
        rank: this.mgr.awakeningRank(id),
        crystalsHave: crystals,
      }));
  }

  private copyRows(): CopyTowerInput[] {
    const save = this.mgr.getSave();
    return Object.keys(save.collection).map((id) => ({
      id,
      name: NAME.get(id) ?? id,
      copies: save.collection[id]?.copies ?? 0,
    }));
  }

  private alchemyHaves(): Record<string, number> {
    const ids = new Set<string>();
    for (const r of ALCHEMY_RECIPES) {
      Object.keys(r.inputs).forEach((m) => ids.add(m));
      Object.keys(r.outputs).forEach((m) => ids.add(m));
    }
    const haves: Record<string, number> = {};
    ids.forEach((m) => (haves[m] = this.mgr.getMaterial(m)));
    return haves;
  }

  private unequippedGearCount(): number {
    const save = this.mgr.getSave();
    const equipped = new Set(Object.values(save.inventory.equipped).filter(Boolean) as string[]);
    return save.inventory.items.filter((it) => !equipped.has(it.id)).length;
  }

  private stations(): StationVM[] {
    const feat = featuredForWeek(isoWeekKey(new Date()));
    return [
      stationFromRecipes("awaken", "Awakening", "✦", 0x8a5cc0, awakeningVMs(this.awakenRows())),
      stationFromRecipes("alchemy", "Alchemy", "⚗", 0x3a6a9a, alchemyRecipeVMs(this.alchemyHaves())),
      stationFromRecipes("copies", "Copy Exchange", "♻", 0x4a8a6a, copyExchangeVMs(this.copyRows())),
      wingsStationVM(
        this.mgr.getMaterial(JEWEL_OF_CHAOS),
        this.mgr.getMaterial(FEATHER),
        this.unequippedGearCount(),
      ),
      stationFromRecipes("spark", "Spark Guarantee", "★", 0xffc94d, [
        sparkVM(this.mgr.sparks(), SPARK_PITY, feat.unique, NAME.get(feat.unique) ?? "—"),
      ]),
    ];
  }

  // ---- rendering -------------------------------------------------------------
  private rebuild(): void {
    this.drawBar();
    const stations = this.stations();
    const rects = forgeGridLayout(stations.length, W, 88);
    this.grid.removeAll(true);
    const cards = stations.map((vm, i) =>
      buildStationCard(this, rects[i], vm, (s) => this.openStation(s)),
    );
    this.grid.add(cards);
    staggerIn(
      this,
      cards as unknown as (Phaser.GameObjects.GameObject &
        Phaser.GameObjects.Components.Transform &
        Phaser.GameObjects.Components.Alpha)[],
    );
  }

  private drawBar(): void {
    this.bar.removeAll(true);
    const chips: [string, string, number | string][] = [
      ["✦", materialTex(AWAKENING_CRYSTAL), this.mgr.getMaterial(AWAKENING_CRYSTAL)],
      ["✧", "", `${this.mgr.sparks()}/${SPARK_PITY}`],
      ["💠", materialTex(JEWEL_OF_CHAOS), this.mgr.getMaterial(JEWEL_OF_CHAOS)],
      ["🪶", materialTex(FEATHER), this.mgr.getMaterial(FEATHER)],
    ];
    const gap = 224;
    chips.forEach(([emoji, key, val], i) => {
      const x = 56 + i * gap;
      this.bar.add(makeFitIcon(this, x, 46, key, 22, emoji));
      this.bar.add(
        crispText(this, x + 18, 46, `${val}`, {
          fontSize: "14px",
          color: "#ffe07a",
          fontStyle: "bold",
        }).setOrigin(0, 0.5),
      );
    });
  }

  // ---- station interaction ---------------------------------------------------
  private openStation(vm: StationVM): void {
    if (vm.id === "wings") {
      this.openWingCraft();
      return;
    }
    const secondary =
      vm.id === "spark" && UNIQUES.length > 1
        ? { label: "Cycle Wishlist", run: () => this.cycleWishlist() }
        : undefined;
    this.dialog = openForgeDialog(this, {
      station: vm,
      secondary,
      confirm: (recipeId) => this.craft(vm.id, recipeId),
      onClose: () => {
        this.dialog = null;
      },
    });
  }

  private craft(stationId: StationId, recipeId: string): void {
    let msg = "";
    if (stationId === "awaken") {
      const r = this.mgr.awaken(recipeId);
      if (r >= 0) msg = `${NAME.get(recipeId) ?? recipeId} → Awakening ${r}!`;
    } else if (stationId === "alchemy") {
      if (this.mgr.craftAlchemy(recipeId, 1) > 0) msg = "Transmuted!";
    } else if (stationId === "copies") {
      if (this.mgr.exchangeCopies(recipeId, 1) > 0) msg = "Minted an Awakening Crystal!";
    } else if (stationId === "spark") {
      const id = this.mgr.claimSpark();
      if (id) msg = `✦ Guaranteed: ${NAME.get(id) ?? id}!`;
    }
    if (!msg) {
      this.showToast("Cannot forge — check materials.");
      return;
    }
    const anchor = this.dialog?.outputAnchor() ?? { x: W / 2, y: 270 };
    playForgeFx(this, anchor.x, anchor.y, forgeFxSpec(stationId, true));
    this.showToast(msg);
    this.rebuild();
    // Re-derive the same station so the open dialog reflects the new state.
    const fresh = this.stations().find((s) => s.id === stationId);
    if (this.dialog && fresh && fresh.recipes.length > 0) this.dialog.refresh(fresh);
    else this.dialog?.close();
  }

  private cycleWishlist(): void {
    const wish = this.mgr.getSave().meta.banner.pickedFeaturedId;
    const idx = UNIQUES.findIndex((t) => t.id === wish);
    const next = UNIQUES[(idx + 1) % UNIQUES.length];
    this.mgr.setWishlist(next.id);
    this.showToast(`Wishlist → ${next.name}`);
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
        playForgeFx(this, W / 2, this.scale.height / 2, forgeFxSpec("wings", !!r.success));
        if (r.success && r.item) {
          this.showToast(`✦ Forged ${ITEM_CATALOG_MAP.get(r.item.defId)?.name ?? "Wings"}!`);
        } else {
          this.showToast("The wings dissolved into chaos…");
        }
        dialog.destroy();
        this.rebuild();
      },
      onClose: () => dialog.destroy(),
    });
  }

  private showToast(msg: string): void {
    this.toast.setText(msg).setVisible(true);
    this.time.delayedCall(1800, () => this.toast.setVisible(false));
  }
}
