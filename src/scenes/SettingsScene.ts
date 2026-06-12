import Phaser from "phaser";
import type { SaveManager } from "../core/saveManager.ts";
import { crispText } from "./ui.ts";
import { setAudioVolume, setAudioMuted, music } from "./audio.ts";
import { fadeIn, fadeToScene } from "./uiKit.ts";

/**
 * SettingsScene — audio config (music on/off, master volume, mute) plus a
 * destructive "reset progress" that wipes the save back to a fresh game. Reached
 * from the main menu; applies changes live and persists them via SaveManager.
 */
export class SettingsScene extends Phaser.Scene {
  private mgr!: SaveManager;
  private confirmingReset = false;

  constructor() {
    super("SettingsScene");
  }

  create(): void {
    this.confirmingReset = false;
    this.mgr = this.registry.get("saveManager");
    const W = this.scale.width;
    fadeIn(this);

    this.add
      .text(W / 2, 40, "⚙  Settings", { fontSize: "28px", color: "#ffd700", fontStyle: "bold" })
      .setOrigin(0.5);
    this.add
      .text(20, 8, "← Back", { fontSize: "15px", color: "#90caf9" })
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => fadeToScene(this, "MainMenuScene"));

    this.render();
  }

  private render(): void {
    // Clear any previously-drawn controls (re-rendered on every change).
    this.children.list.filter((o) => o.getData?.("ctl")).forEach((o) => o.destroy());

    const s = this.mgr.getSettings();
    const W = this.scale.width;
    const cx = W / 2;
    let y = 120;

    // ── Music toggle ──
    this.toggle(cx, y, "Music", s.musicEnabled, (on) => {
      this.mgr.setSettings({ musicEnabled: on });
      music.setEnabled(on && !this.mgr.getSettings().muted);
      this.render();
    });
    y += 64;

    // ── Mute toggle ──
    this.toggle(cx, y, "Mute all sound", s.muted, (on) => {
      this.mgr.setSettings({ muted: on });
      setAudioMuted(on);
      music.setEnabled(!on && this.mgr.getSettings().musicEnabled);
      this.render();
    });
    y += 64;

    // ── Volume stepper ──
    this.label(cx - 150, y, `Volume: ${Math.round(s.volume * 100)}%`);
    this.stepBtn(cx + 70, y, "–", () => this.changeVolume(-0.1));
    this.stepBtn(cx + 120, y, "+", () => this.changeVolume(0.1));
    y += 80;

    // ── Reset progress ──
    if (!this.confirmingReset) {
      this.button(cx, y, "↺  Reset Game Progress", "#7a2e2e", () => {
        this.confirmingReset = true;
        this.render();
      });
    } else {
      this.label(cx, y - 28, "This wipes ALL progress. Are you sure?", "#ff9a9a", 14);
      this.button(
        cx - 90,
        y,
        "Yes, reset",
        "#b23b3b",
        () => {
          this.mgr.resetProgress();
          fadeToScene(this, "MainMenuScene");
        },
        150,
      );
      this.button(
        cx + 90,
        y,
        "Cancel",
        "#3a4a6a",
        () => {
          this.confirmingReset = false;
          this.render();
        },
        130,
      );
    }
  }

  private changeVolume(delta: number): void {
    const v = Math.max(
      0,
      Math.min(1, Math.round((this.mgr.getSettings().volume + delta) * 100) / 100),
    );
    this.mgr.setSettings({ volume: v });
    setAudioVolume(v);
    this.render();
  }

  // ── small UI helpers (all tagged ctl so render() can clear them) ──
  private label(
    x: number,
    y: number,
    text: string,
    color = "#dfe7f2",
    size = 16,
  ): Phaser.GameObjects.Text {
    const t = crispText(this, x, y, text, { fontSize: `${size}px`, color }).setOrigin(0.5);
    t.setData("ctl", true);
    return t;
  }

  private toggle(
    x: number,
    y: number,
    label: string,
    on: boolean,
    cb: (on: boolean) => void,
  ): void {
    this.label(x - 150, y, label).setOrigin(0, 0.5);
    const w = 56,
      h = 28;
    const g = this.add.graphics().setData("ctl", true);
    g.fillStyle(on ? 0x3a8f5a : 0x5a3a3a, 1).fillRoundedRect(x + 90, y - h / 2, w, h, h / 2);
    g.fillStyle(0xffffff, 1).fillCircle(x + 90 + (on ? w - h / 2 : h / 2), y, h / 2 - 3);
    const z = this.add
      .zone(x + 90, y - h / 2, w, h)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true });
    z.setData("ctl", true);
    z.on("pointerdown", () => cb(!on));
  }

  private stepBtn(x: number, y: number, glyph: string, cb: () => void): void {
    const t = crispText(this, x, y, glyph, {
      fontSize: "20px",
      color: "#fff",
      backgroundColor: "#2a3a56",
    })
      .setOrigin(0.5)
      .setPadding(10, 4, 10, 4)
      .setInteractive({ useHandCursor: true });
    t.setData("ctl", true);
    t.on("pointerdown", cb);
  }

  private button(
    x: number,
    y: number,
    label: string,
    bg: string,
    cb: () => void,
    width = 280,
  ): void {
    const t = crispText(this, x, y, label, {
      fontSize: "16px",
      color: "#fff",
      backgroundColor: bg,
      fixedWidth: width,
      align: "center",
    })
      .setOrigin(0.5)
      .setPadding(0, 10, 0, 10)
      .setInteractive({ useHandCursor: true });
    t.setData("ctl", true);
    t.on("pointerdown", cb);
  }
}
