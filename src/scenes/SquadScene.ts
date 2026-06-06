/**
 * SquadScene (T8) — choose the battle squad (up to 7 owned towers) and the
 * hero's equipped active skill. Persists via SaveManager (setSquad / equipSkill).
 */
import Phaser from "phaser";
import type { SaveManager } from "../core/saveManager.ts";
import { getTowerStars } from "../core/collection.ts";
import { TOWERS } from "../data/towers.ts";
import { ACTIVE_SKILLS_MAP } from "../data/skills.ts";
import type { Rarity } from "../data/schema.ts";

const RARITY_HEX: Record<Rarity, string> = {
  Common: "#9e9e9e", Magic: "#2196f3", Rare: "#9c27b0", Legendary: "#ff9800", Unique: "#f44336",
};
const SQUAD_MAX = 7;

export class SquadScene extends Phaser.Scene {
  private mgr!: SaveManager;
  private selected = new Set<string>();
  private dyn!: Phaser.GameObjects.Container;
  private countText!: Phaser.GameObjects.Text;

  constructor() { super("SquadScene"); }

  create(): void {
    this.mgr = this.registry.get("saveManager");
    const save = this.mgr.getSave();
    this.selected = new Set(save.squad ?? []);
    const W = this.scale.width;

    this.add.text(W / 2, 14, "Squad & Hero", { fontSize: "24px", color: "#ffd700", fontStyle: "bold" }).setOrigin(0.5, 0);
    this.add.text(20, 8, "← Back", { fontSize: "15px", color: "#90caf9" })
      .setInteractive({ useHandCursor: true }).on("pointerdown", () => this.scene.start("MainMenuScene"));

    this.countText = this.add.text(20, 50, "", { fontSize: "14px", color: "#cfe0f5" });
    this.add.text(W - 20, 50, "Active Skill", { fontSize: "14px", color: "#ffd86a", fontStyle: "bold" }).setOrigin(1, 0);

    this.dyn = this.add.container(0, 0);
    this.redraw();
  }

  private redraw(): void {
    this.dyn.removeAll(true);
    const save = this.mgr.getSave();
    this.countText.setText(`Battle Squad — ${this.selected.size}/${SQUAD_MAX}   (tap owned characters to add/remove)`);

    // owned towers grid
    const owned = TOWERS.filter((t) => t.id in save.collection);
    const COLS = 8, CW = 110, CH = 78, X0 = 24, Y0 = 76;
    owned.forEach((t, idx) => {
      const cx = X0 + (idx % COLS) * CW, cy = Y0 + Math.floor(idx / COLS) * CH;
      const inSquad = this.selected.has(t.id);
      const col = parseInt(RARITY_HEX[t.rarity].slice(1), 16);
      const g = this.add.graphics();
      g.fillStyle(inSquad ? 0x23344a : 0x18202c, 1).fillRoundedRect(cx, cy, CW - 8, CH - 8, 6);
      g.lineStyle(inSquad ? 3 : 1.5, inSquad ? 0xffd24a : col, inSquad ? 1 : 0.8).strokeRoundedRect(cx, cy, CW - 8, CH - 8, 6);
      this.dyn.add(g);
      const key = `tower__${t.id}`;
      if (this.textures.exists(key)) {
        const img = this.add.image(cx + (CW - 8) / 2, cy + 26, key).setOrigin(0.5);
        img.setScale(44 / img.height);
        this.dyn.add(img);
      }
      this.dyn.add(this.add.text(cx + (CW - 8) / 2, cy + CH - 24, t.name, {
        fontSize: "8px", color: RARITY_HEX[t.rarity], align: "center", wordWrap: { width: CW - 14 },
      }).setOrigin(0.5, 0));
      const stars = getTowerStars(save, t.id);
      if (stars > 0) this.dyn.add(this.add.text(cx + 4, cy + 2, "★".repeat(stars), { fontSize: "9px", color: "#ffd24a" }));
      if (inSquad) this.dyn.add(this.add.text(cx + CW - 16, cy + 2, "✓", { fontSize: "12px", color: "#a5d6a7", fontStyle: "bold" }));

      const hit = this.add.rectangle(cx, cy, CW - 8, CH - 8, 0, 0).setOrigin(0).setInteractive({ useHandCursor: true });
      hit.on("pointerdown", () => this.toggle(t.id));
      this.dyn.add(hit);
    });

    if (owned.length === 0) {
      this.dyn.add(this.add.text(24, 90, "No characters owned yet — summon some in the Summon Hall!", { fontSize: "12px", color: "#90a4bb" }));
    }

    // active skill picker (right column)
    const skills = save.hero.obtainedSkills;
    const SX = this.scale.width - 250, SY = 74;
    if (skills.length === 0) {
      this.dyn.add(this.add.text(SX, SY, "No active skills yet.\nThey drop from battles.", { fontSize: "11px", color: "#90a4bb", align: "left", wordWrap: { width: 230 } }));
    }
    skills.forEach((entry, idx) => {
      const def = ACTIVE_SKILLS_MAP.get(entry.skillId);
      if (!def) return;
      const y = SY + idx * 32;
      const equipped = save.hero.equippedSkillId === entry.skillId;
      const g = this.add.graphics();
      g.fillStyle(equipped ? 0x2a2342 : 0x1a2230, 1).fillRoundedRect(SX, y, 230, 28, 5);
      if (equipped) g.lineStyle(2, 0xba68c8, 1).strokeRoundedRect(SX, y, 230, 28, 5);
      this.dyn.add(g);
      this.dyn.add(this.add.text(SX + 8, y + 7, `${def.name} Lv${entry.level}`, { fontSize: "11px", color: RARITY_HEX[def.rarity] }));
      if (equipped) {
        this.dyn.add(this.add.text(SX + 222, y + 7, "✓", { fontSize: "12px", color: "#a5d6a7" }).setOrigin(1, 0));
      } else {
        const btn = this.add.text(SX + 222, y + 6, "equip", { fontSize: "10px", color: "#fff", backgroundColor: "#1a4a7a" })
          .setOrigin(1, 0).setPadding(6, 3, 6, 3).setInteractive({ useHandCursor: true });
        btn.on("pointerdown", () => { this.mgr.equipSkill(entry.skillId); this.redraw(); });
        this.dyn.add(btn);
      }
    });
  }

  private toggle(id: string): void {
    if (this.selected.has(id)) this.selected.delete(id);
    else if (this.selected.size < SQUAD_MAX) this.selected.add(id);
    this.mgr.setSquad([...this.selected]);
    this.redraw();
  }
}
