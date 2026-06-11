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
import { enemyWalkTransform } from "./enemyWalkTransform.ts";
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
      this.playSpriteOneShot(e ?? null, ["hurt"], "idle");    // single SDXL frame: hurt anim absent → safe no-op, procedural squash carries it
    } else if (ev.type === "enemyAttack") {
      this.sfx.enemyHit();
      const victim = ev.target === "hero" ? (this.heroSprite?.getBodySprite() ?? null) : this.towerNear(ev.targetAt);
      if (victim) this.flash(victim, 0xff4444);
      if (ev.target === "hero") this.heroSprite?.playHurt();   // recoil + hurt frames
      this.playSpriteOneShot(this.enemySprites.get(ev.uid) ?? null, ["attack"], "idle"); // single SDXL frame: attack anim absent → safe no-op
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
    } else if (ev.type === "autoskip") {
      // Early clear: chime + float the banked time-saved bonus near the HUD gold.
      if (ev.bonus > 0) {
        this.sfx.coin();
        const pop = crispText(this, this.scale.width - 14, 56, `+${ev.bonus}g`, { fontSize: "16px", color: "#ffe27a", fontStyle: "bold" })
          .setOrigin(1, 0).setDepth(60);
        this.ui.add(pop);
        this.tweens.add({ targets: pop, y: 38, alpha: 0, duration: 800, ease: "Cubic.out", onComplete: () => pop.destroy() });
      }
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
   * Acquire/update a pooled ground-contact shadow ellipse for an enemy. Sized to
   * the sprite's footprint and parked just under the depth of the sprite (1 vs 2)
   * so it always renders on the ground beneath the creature. `animateEnemy` then
   * pins and modulates it each frame (it stays on the ground while the body bobs).
   */
  ensureShadow(this: BattleScene, uid: number, x: number, y: number, displayH: number): Phaser.GameObjects.Ellipse {
    let sh = this.enemyShadows.get(uid);
    if (!sh) {
      sh = this.add.ellipse(x, y, displayH * 0.6, displayH * 0.24, 0x000000, 0.34).setDepth(1);
      this.world.add(sh);
      this.enemyShadows.set(uid, sh);
    }
    return sh;
  },

  /**
   * Procedural enemy animation driving the single SDXL creature sprite so it
   * reads as real locomotion instead of sliding ("floating") along the lane.
   * Enemies are a SINGLE z-image (SDXL) sprite; ALL ground locomotion is the
   * transform (see enemyWalkTransform.ts) — there are no authored walk frames:
   *  - GROUND enemies get a 2-beat step cycle whose phase advances with the
   *    distance actually travelled — so footfalls stay glued to the ground and
   *    a slowed/stopped enemy steps slower/stops (the core fix for floating).
   *    Each step plants a foot (squash + settle), rocks the body toward the
   *    planted side (waddle), bobs up between falls, and leans into travel.
   *  - FLYING enemies get a brisk, constant-rhythm WING-BEAT: the body rises on
   *    each downstroke, wings spread (scaleX pulse) on the beat, and the body
   *    banks on a slower roll as it glides.
   *  - HURT squash/recoil overlays either (set by the hit FX, decays ~160ms).
   * Bosses use the same gait at reduced amplitude + longer stride (heavy).
   * Frozen / stunned enemies hold still with a faint shiver, no stepping.
   */
  animateEnemy(
    this: BattleScene,
    s: Phaser.GameObjects.Sprite,
    e: EnemyRuntime,
    key: string,
    shadow: Phaser.GameObjects.Ellipse | null,
  ): void {
    const now = this.time.now;
    const boss = e.def.archetype === "Boss";
    const frozen = e.slowPct >= 0.6 || e.stunTimer > 0;
    const base = (s.getData("baseScale") as number) ?? s.scaleX;

    // Keep the SDXL walk sheet cycling, but never rely on it alone. Don't stomp
    // an in-flight one-shot (attack/skill/hurt) — it returns to walk itself;
    // pause the loop while frozen so a held enemy doesn't moon-walk in place.
    if (this.anims.exists(`${key}_walk`)) {
      const cur = s.anims.currentAnim?.key;
      const inOneShot = s.anims.isPlaying &&
        (cur === `${key}_attack` || cur === `${key}_skill` || cur === `${key}_hurt`);
      if (!inOneShot) {
        if (frozen) { if (s.anims.isPlaying) s.anims.pause(); }
        else {
          if (cur !== `${key}_walk` || !s.anims.isPlaying) s.play(`${key}_walk`);
          // Couple step cadence to actual ground speed: ~1x at a brisk walk,
          // slower when slowed, up to ~1.8x for fast "runners".
          const spd = (s.getData("recentMoved") as number) ?? 0;
          s.anims.timeScale = Math.max(0.35, Math.min(1.8, spd / 3));
        }
      }
    }

    // Distance travelled since last frame → couples the gait to the ground.
    const px = e.pos.x, py = e.pos.y;
    const lx = s.getData("lastPosX") as number | undefined;
    const ly = s.getData("lastPosY") as number | undefined;
    const moved = lx === undefined ? 0 : Math.min(20, Math.hypot(px - lx, py - (ly as number)));
    s.setData("lastPosX", px); s.setData("lastPosY", py);
    const prevMoved = (s.getData("recentMoved") as number) ?? moved;
    s.setData("recentMoved", prevMoved * 0.8 + moved * 0.2); // smoothed travel → walk timeScale

    let scaleX = base, scaleY = base, angle = 0, yOff = 0, xOff = 0;

    if (e.flying) {
      const w = now * 0.017 + e.uid * 1.7;              // ~2.7 wing-beats/sec
      const beat = Math.sin(w);
      yOff = -15 + Math.cos(w) * 4.5;                   // body rises on the downstroke
      angle = Math.sin(w * 0.5) * 6;                    // slow banking roll
      scaleX = base * (1 + beat * 0.05);                // wings spread on the beat
      scaleY = base * (1 - beat * 0.03);
    } else if (frozen) {
      angle = Math.sin(now * 0.05) * 1.2;               // faint shiver, no stepping
    } else {
      const A = boss ? 0.6 : 1;                          // bosses bob/rock less (heavy)
      let c = (s.getData("gaitPhase") as number) ?? e.uid * 1.3;
      c += moved * 0.16 * (boss ? 0.7 : 1);              // ~one step per ~20px; longer boss stride
      s.setData("gaitPhase", c);
      const lean = moved > 0.2 && lx !== undefined ? Math.sign(px - lx) * 2 : 0; // lean into travel
      const t = enemyWalkTransform(c, { amp: A, lean });
      yOff = t.yOff; xOff = t.xOff; angle = t.angle;
      scaleX = base * t.scaleMulX; scaleY = base * t.scaleMulY;
      s.setData("liftNorm", t.liftNorm);
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
    s.x = e.pos.x + xOff;
    s.y = e.pos.y + yOff;

    // Ground-contact shadow: pinned at the ground point (never bobs), it shrinks
    // and fades as the body lifts on each step — the anchor that turns a sliding
    // sprite into a creature with weight on solid ground. Flyers keep a fixed,
    // faint, small shadow far below as a pure altitude cue.
    if (shadow) {
      shadow.x = e.pos.x;
      shadow.y = e.pos.y + 2;
      if (e.flying) {
        shadow.setScale(0.62);
        shadow.setAlpha(0.16 * s.alpha);
      } else {
        const lift = (s.getData("liftNorm") as number) ?? 0; // 0 planted → 1 airborne
        shadow.setScale(1 - 0.42 * lift);
        shadow.setAlpha((0.34 - 0.16 * lift) * s.alpha);
      }
    }
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
        const shadow = this.ensureShadow(e.uid, e.pos.x, e.pos.y, displayH);
        this.animateEnemy(s, e, key, shadow);  // walk / fly / hurt animation + ground shadow
      }
    }
    for (const [uid, s] of this.enemySprites) if (!seenE.has(uid)) { s.destroy(); this.enemySprites.delete(uid); }
    for (const [uid, sh] of this.enemyShadows) if (!seenE.has(uid)) { sh.destroy(); this.enemyShadows.delete(uid); }

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
