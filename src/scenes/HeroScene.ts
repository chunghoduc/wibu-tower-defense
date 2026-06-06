import Phaser from "phaser";
import type { SaveManager } from "../core/saveManager.ts";
import { ITEM_CATALOG_MAP } from "../data/items.ts";
import { ACTIVE_SKILLS_MAP } from "../data/skills.ts";
import { ITEM_SLOTS, type ItemSlot, type Rarity } from "../data/schema.ts";
import type { ItemInstanceSave } from "../core/save.ts";

const RARITY_HEX: Record<Rarity, string> = {
  Common: "#9e9e9e",
  Magic: "#2196f3",
  Rare: "#9c27b0",
  Legendary: "#ff9800",
  Unique: "#f44336",
};

const SLOT_LABEL: Record<ItemSlot, string> = {
  Weapon: "Weapon",
  Helmet: "Helmet",
  BodyArmor: "Body",
  Gloves: "Gloves",
  Boots: "Boots",
  Amulet: "Amulet",
  Ring1: "Ring 1",
  Ring2: "Ring 2",
  Pet: "Pet",
  Wing: "Wing",
};

export class HeroScene extends Phaser.Scene {
  private mgr!: SaveManager;
  private dyn!: Phaser.GameObjects.Container;
  private header!: Phaser.GameObjects.Text;

  constructor() {
    super("HeroScene");
  }

  create(): void {
    this.mgr = this.registry.get("saveManager");
    const W = this.scale.width;

    this.add
      .text(W / 2, 14, "Hero — Loadout", {
        fontSize: "24px", color: "#ffd700", fontStyle: "bold",
      })
      .setOrigin(0.5, 0);

    this.add
      .text(20, 8, "← Back", { fontSize: "15px", color: "#90caf9" })
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.scene.start("MainMenuScene"));

    this.header = this.add.text(W / 2, 46, "", {
      fontSize: "13px", color: "#90caf9",
    }).setOrigin(0.5, 0);

    // Column titles
    this.add.text(40, 78, "Equipment", { fontSize: "15px", color: "#ffffff", fontStyle: "bold" });
    this.add.text(360, 78, "Active Skill", { fontSize: "15px", color: "#ffffff", fontStyle: "bold" });
    this.add.text(620, 78, "Inventory", { fontSize: "15px", color: "#ffffff", fontStyle: "bold" });

    this.dyn = this.add.container(0, 0);
    this.redraw();
  }

  private redraw(): void {
    this.dyn.removeAll(true);
    const save = this.mgr.getSave();

    this.header.setText(
      `Level ${save.hero.level}   ·   ${save.inventory.items.length} items   ·   ${save.hero.obtainedSkills.length} skills`,
    );

    this.drawEquipmentSlots();
    this.drawSkillSection();
    this.drawInventory();
  }

  // ── Equipment slots (left column) ────────────────────────────────────────────

  private drawEquipmentSlots(): void {
    const save = this.mgr.getSave();
    const X = 40;
    const START_Y = 100;
    const ROW_H = 38;

    ITEM_SLOTS.forEach((slot, i) => {
      const y = START_Y + i * ROW_H;
      const instId = save.inventory.equipped[slot];
      const inst = instId ? save.inventory.items.find((it) => it.id === instId) : undefined;
      const def = inst ? ITEM_CATALOG_MAP.get(inst.defId) : undefined;

      const g = this.add.graphics();
      g.fillStyle(0x1a2a3a, 1).fillRoundedRect(X, y, 290, 32, 5);
      g.lineStyle(1, def ? (parseInt((RARITY_HEX[def.rarity]).slice(1), 16)) : 0x334455, 0.9);
      g.strokeRoundedRect(X, y, 290, 32, 5);
      this.dyn.add(g);

      const label = this.add.text(X + 8, y + 8, SLOT_LABEL[slot], {
        fontSize: "11px", color: "#7a8a9a",
      });
      this.dyn.add(label);

      if (def && inst) {
        const nameTxt = this.add.text(X + 74, y + 8, def.name, {
          fontSize: "12px", color: RARITY_HEX[def.rarity], fontStyle: "bold",
        });
        this.dyn.add(nameTxt);

        const off = this.add
          .text(X + 282, y + 8, "✕", { fontSize: "13px", color: "#ef9a9a" })
          .setOrigin(1, 0)
          .setInteractive({ useHandCursor: true });
        off.on("pointerdown", () => {
          this.mgr.unequipSlot(slot);
          this.redraw();
        });
        this.dyn.add(off);
      } else {
        const empty = this.add.text(X + 74, y + 8, "— empty —", {
          fontSize: "12px", color: "#556677",
        });
        this.dyn.add(empty);
      }
    });
  }

  // ── Active skill (middle column) ─────────────────────────────────────────────

  private drawSkillSection(): void {
    const save = this.mgr.getSave();
    const X = 360;
    const START_Y = 100;

    // Equipped slot
    const equippedId = save.hero.equippedSkillId;
    const equippedDef = equippedId ? ACTIVE_SKILLS_MAP.get(equippedId) : undefined;

    const g = this.add.graphics();
    g.fillStyle(0x2a1a3a, 1).fillRoundedRect(X, START_Y, 230, 44, 6);
    g.lineStyle(2, equippedDef ? 0xba68c8 : 0x334455, 0.9);
    g.strokeRoundedRect(X, START_Y, 230, 44, 6);
    this.dyn.add(g);

    if (equippedDef) {
      this.dyn.add(this.add.text(X + 10, START_Y + 7, equippedDef.name, {
        fontSize: "13px", color: RARITY_HEX[equippedDef.rarity], fontStyle: "bold",
      }));
      this.dyn.add(this.add.text(X + 10, START_Y + 26, `${equippedDef.damageType} · power ${equippedDef.basePower}`, {
        fontSize: "10px", color: "#aaaaaa",
      }));
      const off = this.add
        .text(X + 222, START_Y + 7, "✕", { fontSize: "13px", color: "#ef9a9a" })
        .setOrigin(1, 0)
        .setInteractive({ useHandCursor: true });
      off.on("pointerdown", () => { this.mgr.unequipSkill(); this.redraw(); });
      this.dyn.add(off);
    } else {
      this.dyn.add(this.add.text(X + 10, START_Y + 15, "— no skill equipped —", {
        fontSize: "12px", color: "#556677",
      }));
    }

    // Owned skills list (tap to equip)
    this.dyn.add(this.add.text(X, START_Y + 58, "Owned skills:", {
      fontSize: "11px", color: "#7a8a9a",
    }));

    const listTop = START_Y + 78;
    const ROW_H = 30;
    if (save.hero.obtainedSkills.length === 0) {
      this.dyn.add(this.add.text(X + 4, listTop, "None yet — skills drop from battles.", {
        fontSize: "11px", color: "#556677", wordWrap: { width: 220 },
      }));
    }

    save.hero.obtainedSkills.forEach((entry, i) => {
      const def = ACTIVE_SKILLS_MAP.get(entry.skillId);
      if (!def) return;
      const y = listTop + i * ROW_H;
      const isEquipped = equippedId === entry.skillId;

      const rg = this.add.graphics();
      rg.fillStyle(isEquipped ? 0x223344 : 0x14202c, 1).fillRoundedRect(X, y, 230, 26, 4);
      this.dyn.add(rg);

      this.dyn.add(this.add.text(X + 8, y + 6, `${def.name}  Lv${entry.level}`, {
        fontSize: "11px", color: RARITY_HEX[def.rarity],
      }));

      if (!isEquipped) {
        const btn = this.add
          .text(X + 222, y + 6, "equip", {
            fontSize: "10px", color: "#ffffff", backgroundColor: "#1a4a7a",
          })
          .setOrigin(1, 0)
          .setPadding(6, 3, 6, 3)
          .setInteractive({ useHandCursor: true });
        btn.on("pointerdown", () => { this.mgr.equipSkill(entry.skillId); this.redraw(); });
        this.dyn.add(btn);
      } else {
        this.dyn.add(this.add.text(X + 222, y + 6, "✓", {
          fontSize: "12px", color: "#a5d6a7",
        }).setOrigin(1, 0));
      }
    });
  }

  // ── Inventory (right column) ─────────────────────────────────────────────────

  private drawInventory(): void {
    const save = this.mgr.getSave();
    const X = 620;
    const START_Y = 100;
    const ROW_H = 30;
    const MAX_ROWS = 13;

    // Unequipped items only
    const equippedIds = new Set(Object.values(save.inventory.equipped).filter(Boolean));
    const unequipped = save.inventory.items.filter((it) => !equippedIds.has(it.id));

    if (unequipped.length === 0) {
      this.dyn.add(this.add.text(X, START_Y, "No spare items.\nItems drop from won battles.", {
        fontSize: "11px", color: "#556677", wordWrap: { width: 300 },
      }));
      return;
    }

    const shown = unequipped.slice(0, MAX_ROWS);
    shown.forEach((inst, i) => {
      const def = ITEM_CATALOG_MAP.get(inst.defId);
      if (!def) return;
      const y = START_Y + i * ROW_H;
      const canEquip = save.hero.level >= def.requiredLevel;

      const g = this.add.graphics();
      g.fillStyle(0x14202c, 1).fillRoundedRect(X, y, 300, 26, 4);
      this.dyn.add(g);

      this.dyn.add(this.add.text(X + 8, y + 6, def.name, {
        fontSize: "11px", color: RARITY_HEX[def.rarity],
      }));

      this.dyn.add(this.add.text(X + 200, y + 7, SLOT_LABEL[def.slot], {
        fontSize: "9px", color: "#7a8a9a",
      }).setOrigin(1, 0));

      if (canEquip) {
        const btn = this.add
          .text(X + 292, y + 6, "equip", {
            fontSize: "10px", color: "#ffffff", backgroundColor: "#1a4a7a",
          })
          .setOrigin(1, 0)
          .setPadding(6, 3, 6, 3)
          .setInteractive({ useHandCursor: true });
        btn.on("pointerdown", () => { this.equipFromInventory(inst); });
        this.dyn.add(btn);
      } else {
        this.dyn.add(this.add.text(X + 292, y + 6, `Lv${def.requiredLevel}`, {
          fontSize: "10px", color: "#ef9a9a",
        }).setOrigin(1, 0));
      }
    });

    if (unequipped.length > MAX_ROWS) {
      this.dyn.add(this.add.text(X, START_Y + MAX_ROWS * ROW_H + 2, `+${unequipped.length - MAX_ROWS} more…`, {
        fontSize: "10px", color: "#556677",
      }));
    }
  }

  private equipFromInventory(inst: ItemInstanceSave): void {
    this.mgr.equipItem(inst.id);
    this.redraw();
  }
}
