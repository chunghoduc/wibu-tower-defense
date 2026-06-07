// src/scenes/HeroLayeredSprite.ts

import Phaser from "phaser";
import { resolveHeroLayers, type HeroLayerConfig } from "./heroEquipVisuals.ts";
import type { InventorySave } from "../core/save.ts";

/**
 * Hero battle sprite with equipment visual layers.
 *
 * Layer order (back → front):
 *   1. wingsSprite  — wing item icon behind the body
 *   2. bodySprite   — hero__hero animated spritesheet
 *   3. weaponSprite — weapon item icon at the right hand
 *
 * Pet is a separate floating sprite (not inside the container) so it can
 * move independently of the hero container position.
 */
export class HeroLayeredSprite extends Phaser.GameObjects.Container {
  private readonly bodySprite: Phaser.GameObjects.Sprite;
  private readonly weaponSprite: Phaser.GameObjects.Sprite;
  private readonly wingsSprite: Phaser.GameObjects.Sprite;

  /** Pet floats outside the container — managed by this class but positioned separately. */
  readonly petSprite: Phaser.GameObjects.Sprite;

  private _lastConfig: HeroLayerConfig = { weaponKey: null, wingKey: null, petKey: null };

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);

    this.wingsSprite = scene.add.sprite(0, 0, "__missing").setVisible(false);
    this.bodySprite = scene.add.sprite(0, 0, "hero__hero").setOrigin(0.5, 0.78);
    this.weaponSprite = scene.add.sprite(14, -10, "__missing").setVisible(false).setScale(0.22);

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
   * Play the hero attack animation and swing the equipped weapon icon through a
   * wind-up → strike → return arc so it doesn't look static. Mirrors the
   * scene-level attack helper's return-to-idle, and is a no-op restart while a
   * swing is already in progress (so rapid attacks don't stutter the body anim).
   */
  playAttack(): void {
    const body = this.bodySprite;
    const ATK = "hero__hero_attack", IDLE = "hero__hero_idle";
    if (!this.scene.anims.exists(ATK)) return;
    if (body.anims.currentAnim?.key === ATK && body.anims.isPlaying) return; // already swinging
    body.play(ATK);
    body.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      if (body.active && this.scene.anims.exists(IDLE)) body.play(IDLE);
    });

    if (!this.weaponSprite.visible) return;
    const w = this.weaponSprite;
    this.scene.tweens.killTweensOf(w);
    w.setPosition(14, -10).setAngle(0);
    this.scene.tweens.add({
      targets: w, x: 8, y: -16, angle: -30, duration: 80, ease: "Sine.easeIn",
      onComplete: () => {
        this.scene.tweens.add({
          targets: w, x: 20, y: -4, angle: 25, duration: 60, ease: "Quint.easeOut",
          onComplete: () => {
            this.scene.tweens.add({ targets: w, x: 14, y: -10, angle: 0, duration: 120, ease: "Back.easeOut" });
          },
        });
      },
    });
  }

  /** Expose the underlying body sprite for effects (attack animation, flash) that need a Sprite. */
  getBodySprite(): Phaser.GameObjects.Sprite {
    return this.bodySprite;
  }

  get currentAnimKey(): string | null {
    return this.bodySprite.anims.currentAnim?.key ?? null;
  }

  scaleToHeight(targetPx: number): this {
    const scale = targetPx / this.bodySprite.height;
    this.bodySprite.setScale(scale);
    this.weaponSprite.setScale(scale * 0.22);
    this.wingsSprite.setScale(scale * 1.3);
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
    // Pet floats outside the container, so keep it tracking the hero each move.
    this.petSprite?.setPosition(x + 30, y + 8);
    return this;
  }

  override setVisible(visible: boolean): this {
    super.setVisible(visible);
    this.petSprite.setVisible(visible && this._lastConfig.petKey !== null);
    return this;
  }

  syncEquipment(inventory: InventorySave): void {
    const config = resolveHeroLayers(inventory);

    if (config.weaponKey !== this._lastConfig.weaponKey) {
      if (config.weaponKey && this.scene.textures.exists(config.weaponKey)) {
        this.weaponSprite.setTexture(config.weaponKey).setVisible(true);
      } else {
        this.weaponSprite.setVisible(false);
      }
    }

    if (config.wingKey !== this._lastConfig.wingKey) {
      if (config.wingKey && this.scene.textures.exists(config.wingKey)) {
        this.wingsSprite.setTexture(config.wingKey).setVisible(true);
      } else {
        this.wingsSprite.setVisible(false);
      }
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
