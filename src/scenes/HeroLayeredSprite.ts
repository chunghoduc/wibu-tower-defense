// src/scenes/HeroLayeredSprite.ts

import Phaser from "phaser";
import { resolveHeroLayers, type HeroLayerConfig } from "./heroEquipVisuals.ts";
import type { WeaponType } from "../data/schema.ts";
import type { InventorySave } from "../core/save.ts";

/**
 * Hero battle sprite with equipment-driven visual layers and locomotion.
 *
 * Layer order (back → front):
 *   1. wingsSprite  — wing item icon behind the body (flaps constantly when worn)
 *   2. bodySprite   — hero__hero animated spritesheet
 *   3. weaponSprite — weapon item icon held in the hand
 *
 * The pet is a separate sprite (not inside the container) that wanders randomly
 * around the hero. Equipping items changes the hero's look live: the held weapon
 * art + its hold pose & attack motion follow the weapon family, wings make the
 * hero hover and float instead of walk, and the pet companion appears.
 */

type Pose = { x: number; y: number; angle: number; flipX: boolean };

// Resting hold pose per weapon family (right-hand side; y negative is up).
const REST_POSE: Record<WeaponType, Pose> = {
  Sword: { x: 15, y: -8, angle: 22, flipX: false },
  Fist: { x: 13, y: -4, angle: 0, flipX: false },
  Bow: { x: 12, y: -7, angle: -68, flipX: false },
  Gun: { x: 16, y: -6, angle: -8, flipX: false },
  Staff: { x: 16, y: -20, angle: 10, flipX: false },
  Tome: { x: 12, y: -2, angle: 0, flipX: false },
  Any: { x: 15, y: -8, angle: 18, flipX: false },
};
const DEFAULT_POSE: Pose = REST_POSE.Any;

const ATK = "hero__hero_attack";
const IDLE = "hero__hero_idle";
const WALK = "hero__hero_walk";

export class HeroLayeredSprite extends Phaser.GameObjects.Container {
  private readonly bodySprite: Phaser.GameObjects.Sprite;
  private readonly weaponSprite: Phaser.GameObjects.Sprite;
  private readonly wingsSprite: Phaser.GameObjects.Sprite;

  /** Pet wanders outside the container — managed here but positioned separately. */
  readonly petSprite: Phaser.GameObjects.Sprite;

  private _lastConfig: HeroLayerConfig = { weaponKey: null, weaponType: null, wingKey: null, petKey: null };

  // Base (un-flapped) scale/anchor captured from scaleToHeight, so the flap and
  // hover tweens oscillate around the correct size/position.
  private wingScale = 1;
  private wingBaseY = 0;
  private weaponScale = 0.22;

  private hasWings = false;
  private weaponType: WeaponType | null = null;
  private attacking = false;
  private facingLeft = false;

  private flapTween: Phaser.Tweens.Tween | null = null;

  // Hero world anchor (set every frame by setPosition); the pet roams around it.
  private heroX = 0;
  private heroY = 0;

  // Pet wander state (world coordinates).
  private petX = 0;
  private petY = 0;
  private petTX = 0;
  private petTY = 0;
  private petRepickAt = 0;
  private petReady = false;

  private lastNow = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    this.heroX = x;
    this.heroY = y;

    // Origin at the wing root (icons spread upward from a bottom-centre body) so
    // the flap tween pivots there and the wings rise behind the shoulders.
    this.wingsSprite = scene.add.sprite(0, 0, "__missing").setVisible(false).setOrigin(0.5, 0.72);
    this.bodySprite = scene.add.sprite(0, 0, "hero__hero").setOrigin(0.5, 0.78);
    this.weaponSprite = scene.add.sprite(DEFAULT_POSE.x, DEFAULT_POSE.y, "__missing").setVisible(false).setScale(0.22);

    this.add([this.wingsSprite, this.bodySprite, this.weaponSprite]);

    this.petSprite = scene.add.sprite(x + 30, y + 8, "__missing").setVisible(false).setScale(0.18);

    scene.add.existing(this);
  }

  addToWorld(world: Phaser.GameObjects.Container | Phaser.GameObjects.Layer): void {
    world.add(this as unknown as Phaser.GameObjects.GameObject);
    world.add(this.petSprite);
  }

  play(animKey: string, ignoreIfPlaying = false): this {
    this.bodySprite.play(animKey, ignoreIfPlaying);
    return this;
  }

  /**
   * Per-frame visual update. `moving` toggles walk/float vs idle; `facingLeft`
   * (when defined) turns the hero to face its travel direction. Drives the wing
   * hover/float, the held-weapon hover, and the pet's random wander.
   */
  tick(now: number, moving: boolean, facingLeft?: boolean): void {
    const dt = this.lastNow ? Math.min(0.05, Math.max(0, (now - this.lastNow) / 1000)) : 0;
    this.lastNow = now;

    if (facingLeft !== undefined) this.facingLeft = facingLeft;
    this.attacking = this.bodySprite.anims.currentAnim?.key === ATK && this.bodySprite.anims.isPlaying;

    // Locomotion + hover. Floating heroes never use the walk cycle — they drift.
    let hover = 0;
    if (!this.attacking) {
      if (this.hasWings) {
        // Lifted off the ground with a constant bob; idle frames while airborne.
        hover = -11 + Math.sin(now * 0.005) * 4;
        this.bodySprite.play(IDLE, true);
      } else if (moving && this.scene.anims.exists(WALK)) {
        this.bodySprite.play(WALK, true);
      } else {
        this.bodySprite.play(IDLE, true);
      }
    }

    this.bodySprite.y = hover;
    this.wingsSprite.y = this.wingBaseY + hover;
    this.bodySprite.setFlipX(this.facingLeft);
    if (!this.attacking) this.applyWeaponPose(hover);

    this.updatePet(now, dt);
  }

  /** Place the held weapon at its resting pose for the current weapon + facing. */
  private applyWeaponPose(hover: number): void {
    if (!this.weaponSprite.visible) return;
    const p = this.weaponType ? (REST_POSE[this.weaponType] ?? DEFAULT_POSE) : DEFAULT_POSE;
    const side = this.facingLeft ? -1 : 1;
    this.weaponSprite.setPosition(p.x * side, p.y + hover);
    this.weaponSprite.setAngle(p.angle * side);
    this.weaponSprite.setFlipX(this.facingLeft);
  }

  /**
   * Play the hero attack and animate the held weapon with a motion that suits
   * its family: melee weapons lunge + swing, bows draw and loose, guns recoil,
   * staves/tomes raise and pulse to cast.
   */
  playAttack(): void {
    const body = this.bodySprite;
    if (!this.scene.anims.exists(ATK)) return;
    if (body.anims.currentAnim?.key === ATK && body.anims.isPlaying) return; // already swinging
    body.play(ATK);
    body.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      if (body.active && this.scene.anims.exists(IDLE)) body.play(IDLE);
    });

    if (!this.weaponSprite.visible) return;
    const w = this.weaponSprite;
    const p = this.weaponType ? (REST_POSE[this.weaponType] ?? DEFAULT_POSE) : DEFAULT_POSE;
    const side = this.facingLeft ? -1 : 1;
    const rx = p.x * side, ry = p.y, ra = p.angle * side;
    this.scene.tweens.killTweensOf(w);
    w.setPosition(rx, ry).setAngle(ra).setScale(this.weaponScale);
    const back = () => this.scene.tweens.add({ targets: w, x: rx, y: ry, angle: ra, scaleX: this.weaponScale, scaleY: this.weaponScale, duration: 130, ease: "Back.easeOut" });

    switch (this.weaponType) {
      case "Bow": // draw back, then loose forward
        this.scene.tweens.add({ targets: w, x: rx - 8 * side, duration: 100, ease: "Sine.easeIn",
          onComplete: () => this.scene.tweens.add({ targets: w, x: rx + 12 * side, duration: 70, ease: "Quint.easeOut", onComplete: back }) });
        break;
      case "Gun": // sharp recoil up-back, then settle
        this.scene.tweens.add({ targets: w, x: rx - 6 * side, y: ry - 4, angle: ra - 12 * side, duration: 55, ease: "Quad.easeOut", onComplete: back });
        break;
      case "Staff":
      case "Tome": // raise and charge-pulse to cast
        this.scene.tweens.add({ targets: w, y: ry - 10, scaleX: this.weaponScale * 1.18, scaleY: this.weaponScale * 1.18, duration: 120, ease: "Sine.easeOut", onComplete: back });
        break;
      default: // Sword / Fist / Any — wind-up then swing arc
        this.scene.tweens.add({ targets: w, x: rx - 6 * side, y: ry - 6, angle: ra - 50 * side, duration: 80, ease: "Sine.easeIn",
          onComplete: () => this.scene.tweens.add({ targets: w, x: rx + 8 * side, y: ry + 6, angle: ra + 45 * side, duration: 60, ease: "Quint.easeOut", onComplete: back }) });
    }
  }

  /** Pet wander: roam to random points around the hero, hopping as it runs. */
  private updatePet(now: number, dt: number): void {
    const pet = this.petSprite;
    if (!pet.visible) { this.petReady = false; return; }
    if (!this.petReady) { // drop in beside the hero on first appearance
      this.petX = this.heroX + 26; this.petY = this.heroY + 8;
      this.petRepickAt = 0; this.petReady = true;
    }

    const dx = this.petTX - this.petX, dy = this.petTY - this.petY;
    const d = Math.hypot(dx, dy);
    if (now >= this.petRepickAt || d < 8) {
      // New roam target on a ring around the hero's current position.
      const ang = Math.random() * Math.PI * 2;
      const r = 18 + Math.random() * 28;
      this.petTX = this.heroX + Math.cos(ang) * r;
      this.petTY = this.heroY + Math.sin(ang) * r * 0.6; // flatter vertical spread
      this.petRepickAt = now + 500 + Math.random() * 900;
    }

    const speed = 78; // px/s
    if (d > 1) {
      const step = Math.min(d, speed * dt);
      this.petX += (dx / d) * step;
      this.petY += (dy / d) * step;
      pet.setFlipX(dx < 0);
    }
    const running = d > 10;
    const hop = running ? Math.abs(Math.sin(now * 0.018)) * 4 : 0;
    pet.setPosition(this.petX, this.petY - hop);
  }

  getBodySprite(): Phaser.GameObjects.Sprite {
    return this.bodySprite;
  }

  get currentAnimKey(): string | null {
    return this.bodySprite.anims.currentAnim?.key ?? null;
  }

  scaleToHeight(targetPx: number): this {
    const scale = targetPx / this.bodySprite.height;
    this.weaponScale = scale * 0.22;
    this.wingScale = scale * 1.85;
    // Anchor the wing root at the hero's mid-back so the pair fans up-and-out
    // behind the shoulders instead of poking straight up like ears.
    this.wingBaseY = -targetPx * 0.34;
    this.bodySprite.setScale(scale);
    this.weaponSprite.setScale(this.weaponScale);
    this.wingsSprite.setScale(this.wingScale).setPosition(0, this.wingBaseY);
    this.petSprite.setScale(scale * 0.18);
    return this;
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
    this.petSprite.setVisible(visible && this._lastConfig.petKey !== null);
    return this;
  }

  /** Start/refresh the constant wing-flap tween (scale + sway). */
  private startFlap(): void {
    this.stopFlap();
    this.wingsSprite.setScale(this.wingScale);
    this.flapTween = this.scene.tweens.add({
      targets: this.wingsSprite,
      scaleX: { from: this.wingScale, to: this.wingScale * 0.74 },
      angle: { from: -6, to: 6 },
      duration: 380,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  private stopFlap(): void {
    if (this.flapTween) { this.flapTween.stop(); this.flapTween = null; }
    this.wingsSprite.setScale(this.wingScale).setAngle(0);
  }

  syncEquipment(inventory: InventorySave): void {
    const config = resolveHeroLayers(inventory);

    if (config.weaponKey !== this._lastConfig.weaponKey || config.weaponType !== this._lastConfig.weaponType) {
      this.weaponType = config.weaponType;
      if (config.weaponKey && this.scene.textures.exists(config.weaponKey)) {
        this.weaponSprite.setTexture(config.weaponKey).setVisible(true);
        this.applyWeaponPose(this.bodySprite.y);
      } else {
        this.weaponSprite.setVisible(false);
      }
    }

    if (config.wingKey !== this._lastConfig.wingKey) {
      const show = !!config.wingKey && this.scene.textures.exists(config.wingKey);
      if (show) {
        this.wingsSprite.setTexture(config.wingKey!).setVisible(true);
        this.startFlap();
      } else {
        this.wingsSprite.setVisible(false);
        this.stopFlap();
      }
      this.hasWings = show;
    }

    if (config.petKey !== this._lastConfig.petKey) {
      if (config.petKey && this.scene.textures.exists(config.petKey)) {
        this.petSprite.setTexture(config.petKey).setVisible(true);
      } else {
        this.petSprite.setVisible(false);
      }
    }

    this._lastConfig = config;
  }
}
