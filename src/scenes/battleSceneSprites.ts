/**
 * BattleScene sprite + FX layer: pooled pixel-art sprite management, procedural
 * tower/enemy animation, and translation of sim FX events into sound + sprite
 * one-shots + floating text. Methods are merged onto the BattleScene prototype
 * in `BattleScene.ts`; `this` is the scene.
 */
import Phaser from "phaser";
import type { EnemyRuntime, TowerRuntime, FxEvent } from "../core/battle.ts";
import { hasSprite } from "./PreloadScene.ts";
import { ELITE_SIZE_MULT } from "../core/elite.ts";
import { crispText } from "./ui.ts";
import { enemyStatusTint } from "./battleSceneHelpers.ts";
import { HeroLayeredSprite } from "./HeroLayeredSprite.ts";
import type { BattleScene } from "./BattleScene.ts";

/** Duration (ms) of a tower's procedural strike-recoil punch. */
const TOWER_STRIKE_MS = 200;

export const spritesMethods = {
  /** Render one sim FX event, and trigger sprite animations (attack swing, hit flash). */
  playFx(this: BattleScene, ev: FxEvent): void {
    this.fx.play(ev);
    if (ev.type === "attack") {
      this.sfx.attack(ev.ranged);
      if (ev.source === "hero") {
        this.heroSprite?.playAttack();   // body anim + weapon swing arc
      } else {
        const ts = this.towerSprites.get(ev.uid) ?? null;
        ts?.setData("atkUntil", this.time.now + TOWER_STRIKE_MS); // procedural recoil punch
        this.playSpriteOneShot(ts, ["attack"], "idle");
      }
    } else if (ev.type === "hit") {
      this.sfx.hit();
      const e = this.enemySprites.get(ev.uid);
      if (e) { this.flash(e, 0xffffff); e.setData("hurtUntil", this.time.now + 160); } // hurt squash (procedural fallback)
      this.playSpriteOneShot(e ?? null, ["hurt"], "walk");    // enemy/boss recoil frames
    } else if (ev.type === "enemyAttack") {
      this.sfx.enemyHit();
      const victim = ev.target === "hero" ? (this.heroSprite?.getBodySprite() ?? null) : this.towerNear(ev.targetAt);
      if (victim) this.flash(victim, 0xff4444);
      if (ev.target === "hero") this.heroSprite?.playHurt();   // recoil + hurt frames
      this.playSpriteOneShot(this.enemySprites.get(ev.uid) ?? null, ["attack"], "walk"); // enemy/boss attack swing (atk1/atk2 frames)
    } else if (ev.type === "death") {
      this.sfx.death();
    } else if (ev.type === "cast") {
      this.sfx.cast();
      if (ev.source === "hero") this.heroSprite?.playCast();   // hero skill frames + flourish
      else {
        const ts = this.towerSprites.get(ev.uid) ?? null;
        ts?.setData("atkUntil", this.time.now + TOWER_STRIKE_MS); // procedural recoil punch
        this.playSpriteOneShot(ts, ["skill", "attack"], "idle"); // tower active skill
      }
    } else if (ev.type === "bossCast") {
      this.playSpriteOneShot(this.enemySprites.get(ev.uid) ?? null, ["skill", "attack"], "walk"); // boss ability
    } else if (ev.type === "loot") {
      this.sfx.coin();
    } else if (ev.type === "killReward") {
      this.killSaveDirty = true;   // XP/loot already in the save; flush debounced
      // F17 loot fanfare: a high-tier boss chest gets an escalated cue.
      if (ev.box) {
        const tier = Number(ev.box.match(/t(\d)$/)?.[1] ?? 1);
        if (tier >= 4) { this.sfx.coin(); this.cameras.main.flash(180, 255, 230, 150); }
        this.floatWorldText(ev.at.x, ev.at.y, tier >= 4 ? "✦ RARE CHEST!" : "Chest!", tier >= 4 ? "#ffd24d" : "#cfe0f5", tier >= 4 ? 16 : 12);
      }
    } else if (ev.type === "combo") {
      // F13: escalating kill-streak text, hotter as the streak climbs.
      const hot = ev.mult >= 2.4 ? "#ff5a3c" : ev.mult >= 1.7 ? "#ffae3c" : "#ffe07a";
      this.floatWorldText(ev.at.x, ev.at.y, `${ev.count}x  ·  ×${ev.mult.toFixed(1)}`, hot, 12 + Math.min(10, ev.count / 3));
    } else if (ev.type === "perfect") {
      // F14: brief center banner + sting for a flawless wave.
      this.flashBanner(`PERFECT WAVE!  +${ev.bonus}🪙`, "#9fe0b0");
      this.sfx.coin();
    }
  },

  /** Floating, rising, fading text at a WORLD position (combo/loot fanfare). */
  floatWorldText(this: BattleScene, wx: number, wy: number, msg: string, color: string, size: number): void {
    const t = crispText(this, wx, wy, msg, { fontSize: `${Math.round(size)}px`, color, fontStyle: "bold", stroke: "#1a1206", strokeThickness: 3 })
      .setOrigin(0.5).setDepth(14);
    this.world.add(t);
    this.tweens.add({ targets: t, y: wy - 28, alpha: 0, scale: 1.25, duration: 760, ease: "Sine.easeOut", onComplete: () => t.destroy() });
  },

  /** Briefly flash a message on the big center banner, then clear it. */
  flashBanner(this: BattleScene, msg: string, color: string): void {
    this.banner.setText(msg).setColor(color).setAlpha(1).setScale(0.7);
    this.tweens.add({ targets: this.banner, scale: 1, duration: 220, ease: "Back.easeOut" });
    this.time.delayedCall(1100, () => this.tweens.add({ targets: this.banner, alpha: 0, duration: 350, onComplete: () => this.banner.setText("") }));
  },

  /** Tower sprite nearest a position (towers are static, so this is exact). */
  towerNear(this: BattleScene, at: { x: number; y: number }): Phaser.GameObjects.Sprite | null {
    let best: Phaser.GameObjects.Sprite | null = null, bd = 12 * 12;
    for (const s of this.towerSprites.values()) {
      const dx = s.x - at.x, dy = s.y - at.y, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  },

  /**
   * Play the first existing of `names` once on a sprite, then return to its
   * looping `base` animation (towers → idle, enemies/bosses → walk). Missing
   * clips fall through the list (so skill→attack fallback works), and a no-op
   * keeps the base playing — partial/old sheets degrade gracefully.
   */
  playSpriteOneShot(this: BattleScene, s: Phaser.GameObjects.Sprite | null, names: string[], base: string): void {
    if (!s || !s.active) return;
    const key = s.texture.key;
    const anim = names.map((n) => `${key}_${n}`).find((a) => this.anims.exists(a));
    if (!anim) return;
    if (s.anims.currentAnim?.key === anim && s.anims.isPlaying) return; // already playing it
    s.play(anim);
    s.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      if (s.active && this.anims.exists(`${key}_${base}`)) s.play(`${key}_${base}`);
    });
  },

  /** Brief tint-flash on a sprite. Re-flashing resets the timer; guarded against culling. */
  flash(this: BattleScene, s: Phaser.GameObjects.Sprite, color: number): void {
    if (!s.active) return;
    const prev = s.getData("flashTimer") as Phaser.Time.TimerEvent | undefined;
    prev?.remove();
    s.setTintFill(color);
    s.setData("flashTimer", this.time.delayedCall(80, () => { if (s.active) s.clearTint(); }));
  },

  /** Acquire/update a pooled sprite for an entity; null if no art for this key. */
  ensureSprite(
    this: BattleScene,
    map: Map<number, Phaser.GameObjects.Sprite>,
    uid: number,
    key: string,
    x: number,
    y: number,
    displayH: number,
  ): Phaser.GameObjects.Sprite | null {
    if (!hasSprite(this, key)) return null;
    let s = map.get(uid);
    if (!s) {
      s = this.add.sprite(x, y, key).setOrigin(0.5, 0.78).setDepth(2);
      const baseScale = displayH / s.height;
      s.setScale(baseScale).setData("baseScale", baseScale);
      this.world.add(s);
      map.set(uid, s);
      if (this.anims.exists(`${key}_idle`)) s.play(`${key}_idle`);
    }
    s.setPosition(x, y);
    return s;
  },

  /**
   * Procedural enemy animation driving the single SDXL creature sprite so it
   * feels alive: GROUND enemies walk with a waddle + stride bob + breathing,
   * FLYING enemies hover above the lane with a smooth float + wing-sway tilt,
   * and any enemy squashes/recoils when HURT (set by the hit FX). Bosses with a
   * real rig walk sheet play that instead. Frozen enemies stand still + shiver.
   */
  animateEnemy(this: BattleScene, s: Phaser.GameObjects.Sprite, e: EnemyRuntime, key: string): void {
    const frozen = e.slowPct >= 0.6;
    if (this.anims.exists(`${key}_walk`)) {
      // Don't interrupt a one-shot (attack / skill / hurt) — it returns to walk itself.
      const cur = s.anims.currentAnim?.key;
      const inOneShot = s.anims.isPlaying &&
        (cur === `${key}_attack` || cur === `${key}_skill` || cur === `${key}_hurt`);
      if (!frozen && !inOneShot && cur !== `${key}_walk`) s.play(`${key}_walk`);
      return;
    }

    const base = (s.getData("baseScale") as number) ?? s.scaleX;
    const now = this.time.now;
    const t = now * 0.011 + e.uid * 1.7;
    let scaleX = base, scaleY = base, angle = 0, yOff = 0;

    if (e.def.flying) {
      yOff = -14 - Math.sin(t * 1.4) * 5;               // lift + hover bob
      angle = Math.sin(t * 1.4) * 4;                    // wing-sway tilt
      const breathe = 1 + Math.sin(t * 2) * 0.03;
      scaleX = base * breathe; scaleY = base * breathe;
    } else if (frozen) {
      angle = Math.sin(now * 0.05) * 1.2;               // faint shiver
    } else {
      angle = Math.sin(t) * 5;                          // walk waddle
      yOff = -Math.abs(Math.sin(t * 2)) * 2.2;          // stride bob
      scaleY = base * (1 + Math.sin(t * 2) * 0.02);     // breathing
    }

    // Hurt squash overlays the base motion (set on the hit FX, decays ~160ms).
    const hurtUntil = (s.getData("hurtUntil") as number) ?? 0;
    if (now < hurtUntil) {
      const k = (hurtUntil - now) / 160;                // 1 → 0
      scaleX = base * (1 + 0.18 * k);
      scaleY = base * (1 - 0.22 * k);
      angle *= 0.3;
    }

    s.setAngle(angle);
    s.setScale(scaleX, scaleY);
    s.y = e.pos.y + yOff;
  },

  /**
   * Procedural tower animation. The SDXL sheet frames are near-identical (a
   * single txt2img pass can't paint distinct poses), so frame-cycling reads as
   * static — we drive life on the transform instead, exactly like enemies do:
   * a gentle breathing pulse + idle sway while standing, and a recoil "punch"
   * (anticipation stretch + lift + angle kick, set by attack/skill FX) on each
   * strike. `base` already folds in the upgrade-level scale.
   */
  animateTower(this: BattleScene, s: Phaser.GameObjects.Sprite, t: TowerRuntime, base: number): void {
    const now = this.time.now;
    const ph = now * 0.004 + t.uid * 2.1;             // slow idle phase, desynced per tower
    let scaleX = base;
    let scaleY = base * (1 + Math.sin(ph * 2) * 0.025); // breathing
    let angle = Math.sin(ph) * 1.5;                    // faint idle sway
    let yOff = Math.sin(ph * 2) * 1.2;                 // subtle bob

    // Strike recoil overlays the idle motion (set on attack/cast FX, decays).
    const atkUntil = (s.getData("atkUntil") as number) ?? 0;
    if (now < atkUntil) {
      const k = (atkUntil - now) / TOWER_STRIKE_MS;   // 1 → 0
      scaleY = base * (1 + 0.16 * k);
      scaleX = base * (1 - 0.10 * k);
      yOff -= 6 * k;                                   // lift on the strike
      angle += (t.uid % 2 ? 1 : -1) * 6 * k;          // directional kick
    }

    s.setAngle(angle);
    s.setScale(scaleX, scaleY);
    s.y = t.pos.y + yOff;
  },

  /** Create/update/cull pixel-art sprites for towers, enemies and the hero. */
  manageSprites(this: BattleScene): void {
    const seenT = new Set<number>();
    for (const t of this.battle.towers) {
      if (!t.alive) continue;
      const s = this.ensureSprite(this.towerSprites, t.uid, `tower__${t.def.id}`, t.pos.x, t.pos.y, 50);
      if (s) {
        seenT.add(t.uid);
        s.setAlpha(t.disabledTimer > 0 ? 0.5 : 1);
        if (s.height) {
          const base = (50 / s.height) * (1 + 0.05 * t.battleLevel); // grow as upgraded (T10)
          this.animateTower(s, t, base);
        }
      }
    }
    for (const [uid, s] of this.towerSprites) if (!seenT.has(uid)) { s.destroy(); this.towerSprites.delete(uid); }

    const seenE = new Set<number>();
    for (const e of this.battle.enemies) {
      const boss = e.def.archetype === "Boss";
      const key = `${boss ? "boss" : "enemy"}__${e.def.id}`;
      // Elites render 150% bigger so the player can spot them at a glance (T17).
      const displayH = (boss ? 80 : 44) * (e.elite ? ELITE_SIZE_MULT : 1);
      const s = this.ensureSprite(this.enemySprites, e.uid, key, e.pos.x, e.pos.y, displayH);
      if (s) {
        seenE.add(e.uid);
        s.setAlpha(e.stealth ? (e.revealed ? 0.78 : 0.3) : 1);
        const tint = enemyStatusTint(e);   // burn/poison/freeze body tint (T8)
        if (tint === null) s.clearTint(); else s.setTint(tint);
        this.animateEnemy(s, e, key);      // walk / fly / hurt animation
      }
    }
    for (const [uid, s] of this.enemySprites) if (!seenE.has(uid)) { s.destroy(); this.enemySprites.delete(uid); }

    const h = this.battle.hero;
    if (h.alive && hasSprite(this, "hero__hero")) {
      if (!this.heroSprite) {
        const hs = new HeroLayeredSprite(this, h.pos.x, h.pos.y);
        hs.scaleToHeight(54).setDepth(3);
        hs.addToWorld(this.world);
        if (this.anims.exists("hero__hero_idle")) hs.play("hero__hero_idle");
        if (this.saveManager) hs.syncEquipment(this.saveManager.getSave().inventory);
        this.heroSprite = hs;
      }
      this.heroSprite.setPosition(h.pos.x, h.pos.y);
      this.heroSprite.setVisible(true);
      // Sync equipment visuals each frame (no-op when nothing changed)
      if (this.heroSprite && this.saveManager) {
        this.heroSprite.syncEquipment(this.saveManager.getSave().inventory);
      }
      // Drive locomotion (walk vs float), facing, wing hover and pet wander.
      const dx = h.moveTarget.x - h.pos.x, dy = h.moveTarget.y - h.pos.y;
      const moving = Math.hypot(dx, dy) > 1.5;
      const facingLeft = dx < -0.5 ? true : dx > 0.5 ? false : undefined;
      this.heroSprite.tick(this.time.now, moving, facingLeft);
    } else if (this.heroSprite && !h.alive) {
      this.heroSprite.setVisible(false);
    }
  },
};

export type SpritesMethods = typeof spritesMethods;
