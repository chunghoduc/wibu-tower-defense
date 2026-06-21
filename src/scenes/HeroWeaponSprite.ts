// src/scenes/HeroWeaponSprite.ts
//
// Per-weapon battle hero. Drop-in replacement for HeroSkeletonSprite, but instead
// of a procedural-bone paper-doll wearing mismatched gear icons, the hero is ONE
// pre-drawn sprite chosen by the equipped weapon's class (heroWeaponArt). Two poses
// exist per weapon — a combat stance and an attack money-shot — and all motion
// (walk bob, attack lunge, hurt flinch, cast rise) is procedural (heroWeaponMotion),
// the same way enemies/towers animate a single static sprite. Wings + pet stay as
// overlays; no other worn gear is drawn on the battle hero.

import Phaser from "phaser";
import { resolveHeroLayers, type HeroLayerConfig } from "./heroEquipVisuals.ts";
import type { InventorySave } from "../core/save.ts";
import { weaponArtKeys, weaponArtId } from "../data/heroWeaponArt.ts";
import { heroWeaponMotion, type WeaponMotionState } from "../data/heroWeaponMotion.ts";
import { heroWeaponFrame } from "../data/heroWeaponFrames.ts";
import { heroAnimTex } from "../data/assetKeys.ts";
import { battleWingKeys, type BattleWingKeys } from "../data/heroWingArt.ts";
import { heroWingFlap } from "../data/heroWingFlap.ts";

type OneShotKind = "attack" | "cast" | "hurt";
const PRIO: Record<OneShotKind, number> = { attack: 1, cast: 2, hurt: 3 };
const ONESHOT_MS: Record<OneShotKind, number> = { attack: 300, cast: 460, hurt: 260 };
const NORMAL_TINT = 0xffffff;

export class HeroWeaponSprite extends Phaser.GameObjects.Container {
  private readonly bodySprite: Phaser.GameObjects.Sprite;
  /** Swept-down / glide frame (also the legacy single-icon wing). */
  private readonly wingsSprite: Phaser.GameObjects.Sprite;
  /** Raised / up-stroke frame (battle wing art only; hidden for the legacy icon). */
  private readonly wingUpSprite: Phaser.GameObjects.Sprite;
  readonly petSprite: Phaser.GameObjects.Sprite;

  private size = 54;
  private facingLeft = false;
  private hasWings = false;
  /** Dedicated battle wing frame keys when the equipped wing has art; else null. */
  private battleWings: BattleWingKeys | null = null;
  private stanceKey: string | null = null;
  private attackKey: string | null = null;
  private showingAttackPose = false;
  /** Lower-cased weapon archetype id ("sword"…"any") for the animation frame keys. */
  private weaponId = "any";
  /** True when the equipped archetype has drawn per-state animation frames loaded. */
  private hasAnimFrames = false;
  /** Currently-shown animation frame texture key (avoids redundant setTexture). */
  private currentFrameKey: string | null = null;

  private walkPhase = 0;
  private oneShot: { kind: OneShotKind; start: number } | null = null;
  private lastNow = 0;

  private heroX = 0;
  private heroY = 0;
  private petX = 0;
  private petY = 0;
  private petTX = 0;
  private petTY = 0;
  private petRepickAt = 0;
  private petReady = false;

  private _lastConfig: HeroLayerConfig | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    this.heroX = x;
    this.heroY = y;
    this.wingsSprite = scene.add.sprite(0, 0, "__missing").setVisible(false).setOrigin(0.5, 0.5);
    this.wingUpSprite = scene.add.sprite(0, 0, "__missing").setVisible(false).setOrigin(0.5, 0.5);
    // Body anchored near the feet so the hero stands on the world position.
    this.bodySprite = scene.add.sprite(0, 0, "__missing").setVisible(false).setOrigin(0.5, 0.66);
    // Both wing frames sit behind the body; the up frame crossfades over the down.
    this.add([this.wingsSprite, this.wingUpSprite, this.bodySprite]);
    this.petSprite = scene.add
      .sprite(x + 30, y + 8, "__missing")
      .setVisible(false)
      .setScale(0.32);
    scene.add.existing(this);
  }

  addToWorld(world: Phaser.GameObjects.Container | Phaser.GameObjects.Layer): void {
    world.add(this as unknown as Phaser.GameObjects.GameObject);
    world.add(this.petSprite);
  }

  // Kept for API parity (the painted rig played a sheet anim here); no-op here.
  play(_animKey: string, _ignoreIfPlaying = false): this {
    return this;
  }

  scaleToHeight(targetPx: number): this {
    this.size = targetPx;
    this.sizeBody();
    this.wingsSprite.setScale((targetPx / 96) * 1.85);
    this.petSprite.setScale((targetPx / 128) * 0.42);
    return this;
  }

  /** Fit the body sprite to ~1.7× the nominal size (320px art reads small at 54). */
  private sizeBody(): void {
    const b = this.bodySprite;
    if (!b.height) return;
    const h = this.size * 1.7;
    b.setDisplaySize((h / b.height) * b.width, h);
  }

  tick(now: number, moving: boolean, facingLeft?: boolean): void {
    const dt = this.lastNow ? Math.min(0.05, Math.max(0, (now - this.lastNow) / 1000)) : 0;
    this.lastNow = now;
    if (facingLeft !== undefined) this.facingLeft = facingLeft;

    let state: WeaponMotionState = "idle";
    let phase: number;
    if (this.oneShot) {
      const p = (now - this.oneShot.start) / ONESHOT_MS[this.oneShot.kind];
      if (p >= 1) this.oneShot = null;
      else {
        state = this.oneShot.kind;
        phase = p;
      }
    }
    if (!this.oneShot) {
      if (moving && !this.hasWings) {
        state = "walk";
        this.walkPhase += dt * 1.4; // ~1.4 strides/s
        phase = this.walkPhase % 1;
      } else {
        state = "idle";
        phase = (now * 0.0009) % 1;
      }
    }

    const side = this.facingLeft ? -1 : 1;
    const m = heroWeaponMotion(state, phase!, this.size, side);

    // Drawn animation frames carry the limb motion; the legacy two-pose swap is
    // the fallback for any archetype whose frames aren't loaded.
    if (this.hasAnimFrames) this.setFrame(state, phase!);
    else this.setPose(m.useAttackPose);

    const b = this.bodySprite;
    let hover = 0;
    if (this.hasWings) hover = -this.size * 0.16 + Math.sin(now * 0.005) * this.size * 0.05;
    b.setPosition(m.dx, m.dy + hover);
    b.setAngle(m.angle);
    b.setFlipX(this.facingLeft);
    b.setAlpha(m.alpha);
    b.setTint(m.tint ?? NORMAL_TINT);
    // Re-apply squash on top of the fitted display size.
    if (b.height) {
      const baseH = this.size * 1.7;
      const baseW = (baseH / b.height) * b.width;
      b.setDisplaySize(baseW * m.scaleX, baseH * m.scaleY);
    }

    if (this.hasWings) this.animateWings(now, hover);
    this.updatePet(now, dt);
  }

  /**
   * Drive the worn wings. Dedicated battle art crossfades a swept-down and a
   * raised frame on a procedural flap cycle (heroWingFlap) — a real wing-beat
   * unique to each wing's art — plus a slight rise/squash. The legacy single-icon
   * wing keeps the old ±6° rock. Procedural (not a tween) so it never freezes if
   * the scene's tweens are cleared.
   */
  private animateWings(now: number, hover: number): void {
    const baseY = -this.size * 0.62 + hover * 0.6;
    if (this.battleWings) {
      const f = heroWingFlap(now);
      const baseH = this.size * 1.95;
      const y = baseY - f.rise * this.size * 0.07;
      for (const w of [this.wingsSprite, this.wingUpSprite]) {
        if (!w.height) continue;
        const aspect = w.width / w.height;
        w.setDisplaySize(baseH * aspect * f.scaleX, baseH * f.scaleY);
        w.setPosition(0, y);
        w.setAngle(f.swayDeg);
        w.setFlipX(this.facingLeft);
      }
      this.wingsSprite.setAlpha(f.downAlpha);
      this.wingUpSprite.setAlpha(f.upAlpha);
    } else {
      this.wingsSprite.setPosition(0, baseY);
      this.wingsSprite.setAngle(Math.sin(now * 0.0083) * 6);
    }
  }

  private setPose(attack: boolean): void {
    if (attack === this.showingAttackPose) return;
    const key = attack ? this.attackKey : this.stanceKey;
    if (key && this.scene.textures.exists(key)) {
      this.bodySprite.setTexture(key);
      this.sizeBody();
      this.showingAttackPose = attack;
    }
  }

  /**
   * Drive the body texture from the drawn animation frames. Every state — idle
   * included — pulls `heroanim__<wt>__<state>_<i>`, so idle is the same on-model
   * family as the action frames (the old off-style stance reuse caused a visual
   * mismatch). Falls back to the stance key only if a frame is missing, and only
   * swaps the texture when the key actually changes.
   */
  private setFrame(state: WeaponMotionState, phase: number): void {
    const idx = heroWeaponFrame(state, phase);
    const want = heroAnimTex(this.weaponId, state, idx);
    const key = want && this.scene.textures.exists(want) ? want : this.stanceKey;
    if (!key || key === this.currentFrameKey) return;
    this.bodySprite.setTexture(key);
    this.currentFrameKey = key;
    this.sizeBody();
  }

  playAttack(): void {
    this.beginOneShot("attack");
  }
  playCast(): void {
    this.beginOneShot("cast");
  }
  playHurt(): void {
    this.beginOneShot("hurt");
  }

  private beginOneShot(kind: OneShotKind): void {
    if (this.oneShot && PRIO[this.oneShot.kind] > PRIO[kind]) return; // outranked
    this.oneShot = { kind, start: this.lastNow };
  }

  getBodySprite(): Phaser.GameObjects.Sprite {
    return this.bodySprite;
  }
  get currentAnimKey(): string | null {
    return this.oneShot?.kind ?? null;
  }
  get wornGearVisible(): boolean {
    return false; // battle hero no longer wears gear (art bakes the weapon in)
  }

  override setDepth(value: number): this {
    super.setDepth(value);
    this.petSprite.setDepth(value - 0.5);
    return this;
  }
  override setPosition(x: number, y: number): this {
    super.setPosition(x, y);
    this.heroX = x;
    this.heroY = y;
    return this;
  }
  override setVisible(visible: boolean): this {
    super.setVisible(visible);
    this.petSprite.setVisible(visible && this._lastConfig?.petKey != null);
    return this;
  }

  syncEquipment(inventory: InventorySave): void {
    const config = resolveHeroLayers(inventory);
    const t = this.scene.textures;

    if (!this._lastConfig || config.weaponType !== this._lastConfig.weaponType) {
      const keys = weaponArtKeys(config.weaponType);
      this.stanceKey = keys.stanceKey;
      this.attackKey = t.exists(keys.attackKey) ? keys.attackKey : keys.stanceKey;
      this.weaponId = weaponArtId(config.weaponType);
      // Anim mode kicks in only when this archetype's drawn frames are loaded.
      this.hasAnimFrames = t.exists(heroAnimTex(this.weaponId, "walk", 0));
      this.currentFrameKey = null;
      const show = t.exists(keys.stanceKey);
      if (show) {
        this.bodySprite.setTexture(keys.stanceKey).setVisible(true);
        this.showingAttackPose = false;
        this.sizeBody();
      } else {
        this.bodySprite.setVisible(false);
      }
    }

    if (!this._lastConfig || config.wingId !== this._lastConfig.wingId) {
      const bw = battleWingKeys(config.wingId);
      if (bw && t.exists(bw.downKey) && t.exists(bw.upKey)) {
        // Dedicated battle wing art — two crossfading flap frames.
        this.battleWings = bw;
        this.wingsSprite.setTexture(bw.downKey).setVisible(true).setAlpha(1);
        this.wingUpSprite.setTexture(bw.upKey).setVisible(true).setAlpha(0);
        this.hasWings = true;
      } else if (config.wingKey && t.exists(config.wingKey)) {
        // Legacy single-icon wing (no dedicated battle art yet).
        this.battleWings = null;
        this.wingsSprite
          .setTexture(config.wingKey)
          .setVisible(true)
          .setAlpha(1)
          .setScale((this.size / 96) * 1.85);
        this.wingUpSprite.setVisible(false);
        this.hasWings = true;
      } else {
        this.battleWings = null;
        this.wingsSprite.setVisible(false).setAngle(0);
        this.wingUpSprite.setVisible(false);
        this.hasWings = false;
      }
    }

    if (!this._lastConfig || config.petKey !== this._lastConfig.petKey) {
      if (config.petKey && t.exists(config.petKey))
        this.petSprite.setTexture(config.petKey).setVisible(true);
      else this.petSprite.setVisible(false);
    }

    this._lastConfig = config;
  }

  private updatePet(now: number, dt: number): void {
    const pet = this.petSprite;
    if (!pet.visible) {
      this.petReady = false;
      return;
    }
    if (!this.petReady) {
      this.petX = this.heroX + 26;
      this.petY = this.heroY + 8;
      this.petRepickAt = 0;
      this.petReady = true;
    }
    const dx = this.petTX - this.petX,
      dy = this.petTY - this.petY,
      d = Math.hypot(dx, dy);
    if (now >= this.petRepickAt || d < 8) {
      const ang = (now % 6283) / 1000;
      const r = 26 + (now % 30);
      this.petTX = this.heroX + Math.cos(ang) * r;
      this.petTY = this.heroY + Math.sin(ang) * r * 0.6;
      this.petRepickAt = now + 700;
    }
    if (d > 1) {
      const step = Math.min(d, 78 * dt);
      this.petX += (dx / d) * step;
      this.petY += (dy / d) * step;
      pet.setFlipX(dx < 0);
    }
    const hop = d > 10 ? Math.abs(Math.sin(now * 0.018)) * 4 : 0;
    pet.setPosition(this.petX, this.petY - hop);
  }
}
