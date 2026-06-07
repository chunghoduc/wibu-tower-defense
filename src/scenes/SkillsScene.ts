/**
 * SkillsScene — the hero's skill collection. A grid of every active skill in the
 * game showing, for each collected one, its level, XP progress to the next level
 * and effective power; uncollected skills are dimmed. Click a collected skill to
 * equip it (the hero has one active-skill slot). Skills drop from battles.
 */
import Phaser from "phaser";
import { fadeIn, fadeToScene } from "./uiKit.ts";
import type { SaveManager } from "../core/saveManager.ts";
import { ACTIVE_SKILLS, MAX_ACTIVE_SKILLS } from "../data/skills.ts";
import { skillXpToLevel, skillEffectivePower } from "../core/hero.ts";
import { skillWeaponMet } from "../core/loadout.ts";
import type { Rarity, ActiveSkillDef } from "../data/schema.ts";
import { crispText } from "./ui.ts";

const RARITY_HEX: Record<Rarity, string> = {
  Common: "#9e9e9e", Magic: "#2196f3", Rare: "#9c27b0", Legendary: "#ff9800", Unique: "#f44336",
};
const RARITY_INT: Record<Rarity, number> = {
  Common: 0x9e9e9e, Magic: 0x2196f3, Rare: 0x9c27b0, Legendary: 0xff9800, Unique: 0xf44336,
};
const DMG_HEX: Record<string, string> = { Physical: "#ff8a65", Magic: "#b39ddb", True: "#fff176" };

const COLS = 4, CW = 224, CH = 148, X0 = 16, Y0 = 62, GAP_X = 8, GAP_Y = 6;

export class SkillsScene extends Phaser.Scene {
  private mgr!: SaveManager;
  private layer!: Phaser.GameObjects.Container;
  private toast!: Phaser.GameObjects.Text;

  constructor() { super("SkillsScene"); }

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
    const W = this.scale.width;
    this.add.text(W / 2, 10, "✦ Hero Skills", { fontSize: "24px", color: "#ffd700", fontStyle: "bold" }).setOrigin(0.5, 0);
    this.add.text(20, 10, "← Back", { fontSize: "15px", color: "#90caf9" })
      .setInteractive({ useHandCursor: true }).on("pointerup", () => fadeToScene(this, this.backScene()));

    const save0 = this.mgr.getSave();
    const owned = save0.hero.obtainedSkills.length;
    this.add.text(W / 2, 38, `${owned}/${ACTIVE_SKILLS.length} collected  ·  ${save0.hero.equippedSkillIds.length}/${MAX_ACTIVE_SKILLS} equipped  ·  tap to equip / unequip`, { fontSize: "12px", color: "#90a4bb" }).setOrigin(0.5, 0);

    this.layer = this.add.container(0, 0);
    this.toast = this.add.text(W / 2, 516, "", { fontSize: "12px", color: "#ffd6a0", backgroundColor: "#2a1a1a" })
      .setOrigin(0.5).setPadding(8, 4, 8, 4).setDepth(60).setVisible(false);
    this.redraw();
  }

  private redraw(): void {
    this.layer.removeAll(true);
    const save = this.mgr.getSave();
    const byId = new Map(save.hero.obtainedSkills.map((e) => [e.skillId, e]));
    ACTIVE_SKILLS.forEach((def, i) => {
      const x = X0 + (i % COLS) * (CW + GAP_X);
      const y = Y0 + Math.floor(i / COLS) * (CH + GAP_Y);
      this.drawCard(def, x, y, byId.get(def.id), save.hero.equippedSkillIds.includes(def.id));
    });
  }

  private drawCard(def: ActiveSkillDef, x: number, y: number, entry: { level: number; useXp: number } | undefined, equipped: boolean): void {
    const owned = entry !== undefined;
    const g = this.add.graphics();
    g.fillStyle(equipped ? 0x2a1f40 : owned ? 0x18202c : 0x121821, owned ? 1 : 0.85)
      .fillRoundedRect(x, y, CW, CH, 8);
    g.lineStyle(equipped ? 3 : 2, equipped ? 0xb085f5 : owned ? RARITY_INT[def.rarity] : 0x2a3442, owned ? 1 : 0.7)
      .strokeRoundedRect(x, y, CW, CH, 8);
    this.layer.add(g);

    // Icon.
    const key = `skill__${def.id}`;
    if (this.textures.exists(key)) {
      const img = this.add.image(x + 32, y + 34, key).setOrigin(0.5);
      img.setScale(Math.min(48 / img.width, 48 / img.height)).setAlpha(owned ? 1 : 0.35);
      this.layer.add(img);
    }
    // Header.
    this.layer.add(crispText(this, x + 62, y + 10, def.name, { fontSize: "13px", color: owned ? RARITY_HEX[def.rarity] : "#5c6a70", fontStyle: "bold", wordWrap: { width: CW - 70 } }));
    this.layer.add(crispText(this, x + 62, y + 30, `${def.rarity} · ${def.damageType}`, { fontSize: "10px", color: owned ? DMG_HEX[def.damageType] ?? "#9fb0c4" : "#566275" }));
    const met = skillWeaponMet(this.mgr.getSave(), def.id);
    this.layer.add(crispText(this, x + 62, y + 44,
      def.requiresWeapon ? `Weapon: ${def.requiresWeapon}${met ? " ✓" : ""}` : "Any weapon",
      { fontSize: "9px", color: def.requiresWeapon ? (met ? "#8be06a" : "#ff9a9a") : "#7c8aa0" }));

    // Description.
    this.layer.add(crispText(this, x + 10, y + 64, def.description, { fontSize: "9px", color: owned ? "#aeb9c8" : "#5a6678", wordWrap: { width: CW - 20 } }));

    // Footer: level + XP bar + power, or "not collected".
    const fy = y + CH - 34;
    if (owned && entry) {
      const need = skillXpToLevel(entry.level);
      this.layer.add(crispText(this, x + 10, fy, `Lv ${entry.level}`, { fontSize: "12px", color: "#ffe07a", fontStyle: "bold" }));
      // XP bar
      const bx = x + 52, bw = CW - 110;
      const bg = this.add.graphics();
      bg.fillStyle(0x000000, 0.5).fillRoundedRect(bx, fy + 2, bw, 7, 3);
      bg.fillStyle(0x5a8cff, 1).fillRoundedRect(bx, fy + 2, bw * Phaser.Math.Clamp(entry.useXp / need, 0, 1), 7, 3);
      this.layer.add(bg);
      this.layer.add(crispText(this, x + 52 + bw + 4, fy, `${entry.useXp}/${need}`, { fontSize: "8px", color: "#9fb0c4" }));
      this.layer.add(crispText(this, x + 10, fy + 14, `Power ${Math.round(skillEffectivePower(def.basePower, entry.level))}`, { fontSize: "10px", color: "#cdd6e6" }));

      const badge = equipped
        ? crispText(this, x + CW - 10, fy + 6, "✓ Equipped", { fontSize: "11px", color: "#fff", backgroundColor: "#5a2a7a" }).setOrigin(1, 0).setPadding(6, 3, 6, 3)
        : crispText(this, x + CW - 10, fy + 6, "Equip", { fontSize: "11px", color: "#fff", backgroundColor: "#1f6f3a" }).setOrigin(1, 0).setPadding(8, 3, 8, 3).setInteractive({ useHandCursor: true });
      this.layer.add(badge);
    } else {
      this.layer.add(crispText(this, x + 10, fy + 6, "🔒 Not collected — drops from battles", { fontSize: "10px", color: "#6b7689" }));
    }

    // Whole owned card toggles: tap to equip into a free slot, tap again to remove.
    if (owned) {
      const z = this.add.zone(x, y, CW, CH).setOrigin(0).setInteractive({ useHandCursor: true });
      z.on("pointerup", () => (equipped ? this.unequip(def) : this.tryEquip(def)));
      this.layer.add(z);
    }
  }

  private tryEquip(def: ActiveSkillDef): void {
    if (this.mgr.equipSkill(def.id)) {
      this.showToast(`Equipped ${def.name}`);
      this.redraw();
    } else if (def.requiresWeapon && !skillWeaponMet(this.mgr.getSave(), def.id)) {
      this.showToast(`Requires a ${def.requiresWeapon} equipped (Inventory)`);
    } else {
      this.showToast(`Cannot equip ${def.name}`);
    }
  }

  private unequip(def: ActiveSkillDef): void {
    this.mgr.unequipSkill(def.id);
    this.showToast(`Unequipped ${def.name}`);
    this.redraw();
  }

  private showToast(msg: string): void {
    this.toast.setText(msg).setVisible(true);
    this.time.delayedCall(1400, () => this.toast.setVisible(false));
  }
}
