// src/scenes/HeroSkeletonSprite.ts
//
// Procedural-skeleton battle hero. Drop-in replacement for HeroLayeredSprite: the
// hero is NOT a painted sheet but a bone skeleton (heroSkeleton) animated per state
// (heroSkeletonAnim); the procedural base body + every worn-gear piece are drawn
// from the resolved bones (heroWornRig) so equipped gear follows each limb through
// idle/walk/attack. Weapon rides the weapon hand; wings ride the back; the pet
// wanders outside the container (same as the painted rig).

import Phaser from "phaser";
import { resolveHeroLayers, type HeroLayerConfig, type GearLayer } from "./heroEquipVisuals.ts";
import type { InventorySave } from "../core/save.ts";
import { resolveSkeleton, type BoneId, type BoneXform } from "../data/heroSkeleton.ts";
import { poseSkeleton, type AnimState } from "../data/heroSkeletonAnim.ts";
import { placeWorn, partsForSlot, WORN_GEAR_SLOTS } from "../data/heroWornRig.ts";

type OneShotKind = "attack" | "cast" | "hurt";
const PRIO: Record<OneShotKind, number> = { attack: 1, cast: 2, hurt: 3 };
const ONESHOT_MS: Record<OneShotKind, number> = { attack: 280, cast: 420, hurt: 240 };
const GEAR_PARTS = ["single", "L", "R"] as const;

export class HeroSkeletonSprite extends Phaser.GameObjects.Container {
  private readonly bodyGfx: Phaser.GameObjects.Graphics;
  private readonly anchor: Phaser.GameObjects.Sprite; // invisible hit/flash target (getBodySprite)
  private readonly weaponSprite: Phaser.GameObjects.Sprite;
  private readonly wingsSprite: Phaser.GameObjects.Sprite;
  private readonly gearSprites = new Map<string, Phaser.GameObjects.Sprite>(); // `${slot}:${part}`
  readonly petSprite: Phaser.GameObjects.Sprite;

  private size = 54;
  private facingLeft = false;
  private hasWings = false;
  private perLimb = true; // per-limb art shipped (Phase 2): boots/gloves split L/R

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

  private _lastConfig: HeroLayerConfig = {
    weaponKey: null,
    weaponType: null,
    wingKey: null,
    petKey: null,
    gear: { Helmet: null, BodyArmor: null, Gloves: null, Boots: null },
  };
  private flapTween: Phaser.Tweens.Tween | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    this.heroX = x;
    this.heroY = y;
    this.wingsSprite = scene.add.sprite(0, 0, "__missing").setVisible(false).setOrigin(0.5, 0.7);
    this.bodyGfx = scene.add.graphics();
    this.anchor = scene.add.sprite(0, 0, "__missing").setVisible(false);
    this.weaponSprite = scene.add.sprite(0, 0, "__missing").setVisible(false).setOrigin(0.5, 0.85);
    this.add([this.wingsSprite, this.bodyGfx, this.anchor, this.weaponSprite]);
    this.petSprite = scene.add.sprite(x + 30, y + 8, "__missing").setVisible(false).setScale(0.32);
    scene.add.existing(this);
  }

  addToWorld(world: Phaser.GameObjects.Container | Phaser.GameObjects.Layer): void {
    world.add(this as unknown as Phaser.GameObjects.GameObject);
    world.add(this.petSprite);
  }

  // Kept for API parity (the painted rig played a sheet anim here); no-op on the rig.
  play(_animKey: string, _ignoreIfPlaying = false): this {
    return this;
  }

  scaleToHeight(targetPx: number): this {
    this.size = targetPx;
    this.weaponSprite.setScale((targetPx / 96) * 0.9); // weapon art ~96px tall
    this.wingsSprite.setScale((targetPx / 96) * 1.9);
    this.petSprite.setScale((targetPx / 128) * 0.42);
    return this;
  }

  tick(now: number, moving: boolean, facingLeft?: boolean): void {
    const dt = this.lastNow ? Math.min(0.05, Math.max(0, (now - this.lastNow) / 1000)) : 0;
    this.lastNow = now;
    if (facingLeft !== undefined) this.facingLeft = facingLeft;

    // Resolve one-shot vs locomotion.
    let state: AnimState = "idle";
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
      if (this.hasWings) {
        state = "idle";
        this.walkPhase = now * 0.005;
      } else if (moving) {
        state = "walk";
        this.walkPhase += dt * 9; // ~1.4 strides/s
      } else {
        state = "idle";
      }
      phase = state === "walk" ? this.walkPhase : now * 0.004;
    }

    const pose = poseSkeleton(state, phase!);
    let hover = pose.bob * this.size;
    if (this.hasWings) hover += -this.size * 0.18 + Math.sin(now * 0.005) * this.size * 0.05;

    const facing = this.facingLeft ? -1 : 1;
    const bones = resolveSkeleton({ size: this.size, hover, facing, deltas: pose.deltas });
    this.drawBody(bones);
    this.positionGear(bones, facing);
    this.positionWeapon(bones.handR);
    this.wingsSprite.setPosition(bones.torso.x, bones.torso.y);
    this.anchor.setPosition(bones.torso.x, bones.torso.y);
    this.updatePet(now, dt);
  }

  /** Redraw the procedural base body (capsule limbs + head) from the resolved bones. */
  private drawBody(b: Record<BoneId, BoneXform>): void {
    const g = this.bodyGfx;
    g.clear();
    const skin = 0xe8b88c,
      cloth = 0x44506a,
      line = 0x20242e;
    const limb = (a: BoneXform, c: BoneXform, w: number, col: number) => {
      g.lineStyle(w, line, 1);
      g.lineBetween(a.x, a.y, c.x, c.y);
      g.lineStyle(Math.max(1, w - 2), col, 1);
      g.lineBetween(a.x, a.y, c.x, c.y);
    };
    const lw = this.size * 0.12;
    limb(b.thighL, b.footL, lw, cloth);
    limb(b.thighR, b.footR, lw, cloth);
    limb(b.pelvis, b.thighL, lw, cloth);
    limb(b.pelvis, b.thighR, lw, cloth);
    limb(b.armUpperL, b.handL, lw * 0.8, skin);
    limb(b.armUpperR, b.handR, lw * 0.8, skin);
    limb(b.pelvis, b.torso, lw * 1.6, cloth); // torso column
    g.fillStyle(skin, 1);
    g.lineStyle(2, line, 1);
    g.fillCircle(b.head.x, b.head.y, this.size * 0.12);
    g.strokeCircle(b.head.x, b.head.y, this.size * 0.12);
  }

  private positionGear(bones: Record<BoneId, BoneXform>, facing: number): void {
    const places = placeWorn(bones, this.size, facing, this.perLimb);
    for (const p of places) {
      const spr = this.gearSprites.get(`${p.slot}:${p.part}`);
      if (!spr || !spr.visible) continue;
      spr.setPosition(p.x, p.y).setAngle(p.angle).setFlipX(p.flipX).setDepth(p.depth);
      if (spr.height) spr.setDisplaySize((p.displayH / spr.height) * spr.width, p.displayH);
    }
  }

  private positionWeapon(hand: BoneXform): void {
    if (!this.weaponSprite.visible) return;
    this.weaponSprite.setPosition(hand.x, hand.y).setAngle(hand.angle).setFlipX(this.facingLeft);
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
    return this.anchor;
  }
  get currentAnimKey(): string | null {
    return this.oneShot?.kind ?? null;
  }
  get wornGearVisible(): boolean {
    for (const s of this.gearSprites.values()) if (s.visible) return true;
    return false;
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

  syncEquipment(inventory: InventorySave): void {
    const config = resolveHeroLayers(inventory);
    const t = this.scene.textures;

    if (
      config.weaponKey !== this._lastConfig.weaponKey ||
      config.weaponType !== this._lastConfig.weaponType
    ) {
      if (config.weaponKey && t.exists(config.weaponKey))
        this.weaponSprite.setTexture(config.weaponKey).setVisible(true);
      else this.weaponSprite.setVisible(false);
    }
    if (config.wingKey !== this._lastConfig.wingKey) {
      const show = !!config.wingKey && t.exists(config.wingKey);
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
      if (config.petKey && t.exists(config.petKey))
        this.petSprite.setTexture(config.petKey).setVisible(true);
      else this.petSprite.setVisible(false);
    }

    for (const slot of WORN_GEAR_SLOTS) {
      const key = this.pickGearKey(config.gear[slot]);
      if (key === this.pickGearKey(this._lastConfig.gear[slot])) continue;
      // Only the parts this slot renders in the current mode are positioned by
      // placeWorn; any other part must stay hidden or it sits unplaced at the
      // container origin (the "big boot in the middle" bug).
      const used = new Set<string>(partsForSlot(slot, this.perLimb));
      for (const part of GEAR_PARTS) {
        const id = `${slot}:${part}`;
        let spr = this.gearSprites.get(id);
        if (key && used.has(part)) {
          if (!spr) {
            spr = this.scene.add.sprite(0, 0, key).setOrigin(0.5, 0.5);
            this.add(spr);
            this.gearSprites.set(id, spr);
          }
          spr.setTexture(key).setVisible(true);
        } else if (spr) spr.setVisible(false);
      }
    }
    this._lastConfig = config;
  }

  private pickGearKey(layer: GearLayer | null): string | null {
    if (!layer) return null;
    const t = this.scene.textures;
    if (t.exists(layer.wornKey)) return layer.wornKey;
    if (t.exists(layer.iconKey)) return layer.iconKey;
    return null;
  }

  private startFlap(): void {
    this.stopFlap();
    this.flapTween = this.scene.tweens.add({
      targets: this.wingsSprite,
      angle: { from: -6, to: 6 },
      duration: 380,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }
  private stopFlap(): void {
    if (this.flapTween) {
      this.flapTween.stop();
      this.flapTween = null;
    }
    this.wingsSprite.setAngle(0);
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
