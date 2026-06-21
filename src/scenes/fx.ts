/**
 * FxLayer — renders the battle sim's transient FX events (projectiles, melee
 * swings, hits, casts, deaths, loot) as Phaser visuals. Pure presentation; all
 * gameplay lives in BattleState. Effects are short-lived objects cleaned up by
 * their own tweens, so the layer is stateless between calls.
 */
import Phaser from "phaser";
import type { FxEvent } from "../core/battle.ts";
import type { DamageType, Vec2 } from "../data/schema.ts";
import { makeCrisp } from "./ui.ts";
import { SkillVfx } from "./skillVfx.ts";
import { MeleeFx } from "./meleeFx.ts";
import { ImpactFx } from "./impactFx.ts";
import { ProjectileFx } from "./projectileFx.ts";
import { FxPool } from "./fxPool.ts";
import { BOX_RARITY_COLOR, boxRarityName } from "../data/materials.ts";
import { tierOfBox } from "../core/boxes.ts";
import { LootFlyFx } from "./lootFlyFx.ts";
import { BossSkillFx } from "./bossSkillSignatures.ts";
import { TriggerFx } from "./triggerFx.ts";
import { itemTex, boxTex } from "../data/assetKeys.ts";
import { ITEM_CATALOG_MAP } from "../data/items.ts";
import { RARITY_INT, RARITY_HEX } from "../data/rarityColors.ts";
import { DEPTH } from "./battleDepths.ts";

const DMG_COLOR: Record<DamageType, number> = {
  Physical: 0xe9eef7,
  Magic: 0xc77dde,
  True: 0xfff3a0,
};
const DMG_NUM_COLOR: Record<DamageType, string> = {
  Physical: "#ffffff",
  Magic: "#e0a8ff",
  True: "#fff3a0",
};

export class FxLayer {
  /** Factory that creates objects and (if a parent layer is given) parents them
   *  to it, so the battle camera renders FX in world space. */
  private readonly fac: Phaser.GameObjects.GameObjectFactory;
  /** Cinematic active-skill cast VFX (themed per element). */
  private readonly skillVfx: SkillVfx;
  /** Melee swing VFX (slash / flurry / punch / smash). */
  private readonly melee: MeleeFx;
  /** Per-element projectile contact VFX (fire/ice/shock/arcane/poison/…). */
  private readonly impact: ImpactFx;
  /** Ranged-attack travel VFX (tracers / arrows / orbs / bolts / hit sparks). */
  private readonly proj: ProjectileFx;
  /** Loot-magnet VFX: dropped rewards fly from the kill into the hero. */
  private readonly lootFly: LootFlyFx;
  /** Bespoke per-skill boss cast set-pieces (quake/rally/barrier/summon-surge). */
  private readonly bossFx: BossSkillFx;
  /** Branded flourishes for triggered Unique-item procs (thorns/frost/cheat-death/…). */
  private readonly trigger: TriggerFx;
  /** Shared bounded reuse pool for one-shot shape primitives (circle/rect/star). */
  private readonly pool: FxPool;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly depth = DEPTH.FX,
    layer?: Phaser.GameObjects.Layer,
    /** Base depth for skill-cast VFX (SkillVfx + BossSkillFx) — kept BELOW the unit
     *  sprites so a cast never hides the enemy/boss it lands on. */
    private readonly skillDepth = DEPTH.SKILL_FX_UNDER,
  ) {
    this.fac = layer
      ? (new Proxy(scene.add, {
          get(target, prop, recv) {
            const f = Reflect.get(target, prop, recv);
            if (typeof f !== "function") return f;
            return (...args: unknown[]) => {
              const o = (f as (...a: unknown[]) => unknown).apply(target, args);
              if (o && (o as Phaser.GameObjects.GameObject).scene)
                layer.add(o as Phaser.GameObjects.GameObject);
              return o;
            };
          },
        }) as Phaser.GameObjects.GameObjectFactory)
      : scene.add;
    this.pool = new FxPool(this.fac);
    this.skillVfx = new SkillVfx(scene, this.fac, this.skillDepth, this.pool);
    this.melee = new MeleeFx(scene, this.fac, this.depth);
    this.impact = new ImpactFx(scene, this.fac, this.depth);
    this.proj = new ProjectileFx(scene, this.fac, this.depth, this.impact, this.pool);
    this.lootFly = new LootFlyFx(scene, this.fac, this.depth);
    this.bossFx = new BossSkillFx(scene, this.fac, this.skillDepth);
    this.trigger = new TriggerFx(scene, this.fac, this.depth);
  }

  play(e: FxEvent): void {
    switch (e.type) {
      case "attack":
        this.attackFx(e.style, e.from, e.to, e.ranged, e.crit, DMG_COLOR[e.damageType], e.role);
        break;
      case "hit":
        this.proj.spark(e.at, DMG_COLOR[e.damageType]);
        this.damageNumber(e.at, Math.round(e.amount), DMG_NUM_COLOR[e.damageType], e.aoe);
        break;
      case "cast":
        this.skillVfx.cast(e.from, e.at, e.radius, e.skillId, e.source, e.rarity);
        break;
      case "splash":
        this.ring(e.at, e.radius, DMG_COLOR[e.damageType], 320);
        break;
      case "chain":
        this.proj.bolt(e.from, e.to, 0x9fe6ff);
        break;
      case "trigger":
        this.trigger.play(e.kind, e.at, e.to, e.radius, e.element);
        break;
      case "death":
        this.deathBurst(e.at, e.boss, e.elite);
        break;
      case "loot":
        this.coinPop(e.at, e.to, e.gold);
        break;
      case "killReward":
        // Gear shows its own rarity-coloured name via the emphasised fly, so the
        // generic "★ Loot!" tag is suppressed (pass item=false) to avoid doubling.
        this.xpPop(e.at, e.xp, false, e.box);
        if (e.itemDefId) this.itemDrop(e.at, e.to, e.itemDefId);
        if (e.box)
          this.lootFly.fly(e.at, e.to, "icon", {
            iconKey: boxTex(e.box),
            fallbackColor: 0xd9a441,
            delay: 90,
          });
        break;
      case "enemyAttack":
        this.lunge(e.at, e.targetAt);
        break;
      case "bossCast":
        this.bossCast(e.at, e.skill, e.radius, e.name, e.element);
        break;
    }
  }

  /** A gear drop: a rarity-themed burst + the item's name + the icon flying to
   *  the hero. Far louder than a coin so a real drop never goes unnoticed. */
  private itemDrop(at: Vec2, to: Vec2, defId: string): void {
    const def = ITEM_CATALOG_MAP.get(defId);
    const rarity = def?.rarity ?? "Common";
    this.lootFly.fly(at, to, "icon", {
      iconKey: itemTex(defId),
      fallbackColor: RARITY_INT[rarity],
      iconFit: 34,
      emphasis: true,
      ringColor: RARITY_INT[rarity],
      label: def?.name ?? "Loot",
      labelColor: RARITY_HEX[rarity],
    });
  }

  /** Floating "+N XP" on a kill, plus a gold "Loot!" tag and an elite box tag. */
  private xpPop(at: Vec2, xp: number, item: boolean, box: string | null = null): void {
    const label = makeCrisp(
      this.fac
        .text(at.x, at.y, `+${xp} XP`, {
          fontFamily: '"Trebuchet MS", system-ui, sans-serif',
          fontSize: "11px",
          color: "#cdebff",
          fontStyle: "bold",
          stroke: "#0a1420",
          strokeThickness: 3,
        })
        .setOrigin(0.5)
        .setDepth(this.depth + 4),
    );
    this.scene.tweens.add({
      targets: label,
      y: at.y - 26,
      alpha: 0,
      duration: 800,
      ease: "Quad.easeOut",
      onComplete: () => label.destroy(),
    });
    if (item) {
      const tag = makeCrisp(
        this.fac
          .text(at.x, at.y - 13, "★ Loot!", {
            fontFamily: '"Trebuchet MS", system-ui, sans-serif',
            fontSize: "11px",
            color: "#ffe07a",
            fontStyle: "bold",
            stroke: "#2a1c05",
            strokeThickness: 3,
          })
          .setOrigin(0.5)
          .setDepth(this.depth + 5),
      );
      this.scene.tweens.add({
        targets: tag,
        y: at.y - 42,
        alpha: 0,
        duration: 1000,
        ease: "Quad.easeOut",
        onComplete: () => tag.destroy(),
      });
    }
    if (box) {
      // Elite box drop — show the chest's rarity name in its rarity colour.
      const tier = tierOfBox(box);
      const hex = "#" + (BOX_RARITY_COLOR[tier] ?? 0xffffff).toString(16).padStart(6, "0");
      const tag = makeCrisp(
        this.fac
          .text(at.x, at.y - (item ? 26 : 13), `📦 ${boxRarityName(tier)} Box!`, {
            fontFamily: '"Trebuchet MS", system-ui, sans-serif',
            fontSize: "12px",
            color: hex,
            fontStyle: "bold",
            stroke: "#1a1207",
            strokeThickness: 4,
          })
          .setOrigin(0.5)
          .setDepth(this.depth + 6),
      );
      this.scene.tweens.add({
        targets: tag,
        y: tag.y - 40,
        alpha: 0,
        duration: 1300,
        ease: "Quad.easeOut",
        onComplete: () => tag.destroy(),
      });
    }
  }

  /** A menacing boss-skill cast — dispatched to its bespoke signature. */
  private bossCast(
    at: Vec2,
    skill: string,
    radius: number,
    name: string,
    element: DamageType,
  ): void {
    this.bossFx.cast(at, skill, radius, name, element);
  }

  /** A quick enemy strike: a streak toward the target + an impact at the target. */
  private lunge(from: Vec2, to: Vec2): void {
    const ang = Math.atan2(to.y - from.y, to.x - from.x);
    const sx = from.x + Math.cos(ang) * 8,
      sy = from.y + Math.sin(ang) * 8;
    const streak = this.fac
      .rectangle(sx, sy, 12, 3, 0xff6a5a)
      .setRotation(ang)
      .setOrigin(0, 0.5)
      .setDepth(this.depth);
    this.scene.tweens.add({
      targets: streak,
      x: to.x - Math.cos(ang) * 8,
      y: to.y - Math.sin(ang) * 8,
      alpha: 0,
      duration: 160,
      ease: "Quad.easeIn",
      onComplete: () => streak.destroy(),
    });
    const impact = this.fac.circle(to.x, to.y, 6, 0xff8a5a, 0.8).setDepth(this.depth + 1);
    this.scene.tweens.add({
      targets: impact,
      scale: 1.8,
      alpha: 0,
      duration: 200,
      onComplete: () => impact.destroy(),
    });
  }

  /** Dispatch a per-character attack visual by style (T6). */
  private attackFx(
    style: string,
    from: Vec2,
    to: Vec2,
    ranged: boolean,
    crit: boolean,
    dmgColor: number,
    role: string,
  ): void {
    switch (style) {
      case "lightning":
        this.proj.bolt(from, to, 0x9fe6ff);
        this.impact.shock(to);
        return;
      case "slash":
        this.melee.slash(from, to, crit ? 0xffe07a : dmgColor, crit);
        return;
      case "flurry":
        this.melee.flurry(from, to, crit ? 0xffe07a : dmgColor, crit);
        return;
      case "smash":
        this.melee.smash(from, to, crit ? 0xffe07a : dmgColor, crit);
        return;
      case "hex":
        this.melee.slash(from, to, 0xb085f5, crit);
        return;
      case "punch":
        this.melee.punch(from, to, crit ? 0xffe07a : dmgColor, crit);
        return;
      case "gunshot":
        this.proj.gunshot(from, to, crit ? 0xfff2a8 : 0xffe39a);
        return;
      case "arrow":
        this.proj.arrow(from, to, 0xe8d9a0);
        return;
      case "fireball":
        this.proj.orb(from, to, 0xff6a2a, 5.5, 0xffd24d, "round", (at) => this.impact.fire(at));
        return;
      case "iceball":
        this.proj.orb(from, to, 0x6fc6ff, 5, 0xe1f5ff, "diamond", (at) => this.impact.ice(at));
        return;
      case "arcane":
        this.proj.orb(from, to, 0xc77dde, 5, 0xeec6ff, "round", (at) => this.impact.arcane(at));
        return;
      case "poison":
        this.proj.orb(from, to, 0x8bc34a, 5, 0xd3ec9e, "round", (at) => this.impact.poison(at));
        return;
      case "holy":
        this.proj.orb(from, to, 0xffe98a, 4.5, 0xffffff, "round", (at) => this.impact.holy(at));
        return;
      case "cannon": {
        const ang = Math.atan2(to.y - from.y, to.x - from.x);
        this.proj.orb(from, to, 0x4a4f5a, 7, 0x9aa0ac, "round", (at) =>
          this.impact.cannon(at, ang),
        );
        return;
      }
      default:
        if (ranged) this.proj.projectile(from, to, dmgColor, role);
        else this.melee.slash(from, to, crit ? 0xffe07a : dmgColor, crit);
    }
  }

  // ---- primitives ----------------------------------------------------------

  private damageNumber(at: Vec2, amount: number, color: string, big: boolean): void {
    if (amount <= 0) return;
    const t = this.fac
      .text(at.x + Phaser.Math.Between(-6, 6), at.y - 10, String(amount), {
        fontFamily: '"Trebuchet MS", system-ui, sans-serif',
        fontSize: big ? "14px" : "12px",
        color,
        fontStyle: "bold",
        stroke: "#10131c",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(this.depth + 2);
    makeCrisp(t);
    this.scene.tweens.add({
      targets: t,
      y: at.y - 34,
      alpha: 0,
      duration: 620,
      ease: "Quad.easeOut",
      onComplete: () => t.destroy(),
    });
  }

  private ring(at: Vec2, radius: number, color: number, duration: number): void {
    const c = this.fac.circle(at.x, at.y, 6).setStrokeStyle(3, color, 0.9).setDepth(this.depth);
    c.setFillStyle(color, 0.12);
    this.scene.tweens.add({
      targets: c,
      scale: radius / 6,
      alpha: 0,
      duration,
      ease: "Cubic.easeOut",
      onComplete: () => c.destroy(),
    });
  }

  /** Celebratory burst when a tower gains an in-battle star (T10). */
  starUp(at: Vec2, level: number): void {
    const gold = 0xffd34d;
    const ring = this.fac
      .circle(at.x, at.y, 8)
      .setStrokeStyle(3, gold, 0.95)
      .setDepth(this.depth + 2);
    this.scene.tweens.add({
      targets: ring,
      scale: 5,
      alpha: 0,
      duration: 480,
      ease: "Cubic.easeOut",
      onComplete: () => ring.destroy(),
    });
    const flash = this.fac.circle(at.x, at.y, 16, 0xffffff, 0.8).setDepth(this.depth + 2);
    this.scene.tweens.add({
      targets: flash,
      scale: 1.6,
      alpha: 0,
      duration: 240,
      onComplete: () => flash.destroy(),
    });
    const n = Math.min(5, Math.max(1, level));
    for (let i = 0; i < n; i++) {
      const sx = at.x + (i - (n - 1) / 2) * 9;
      const st = this.fac
        .star(sx, at.y, 5, 3.2, 7.5, gold)
        .setStrokeStyle(1.5, 0x9a6a1a)
        .setDepth(this.depth + 3)
        .setScale(0.2);
      this.scene.tweens.add({
        targets: st,
        y: at.y - 34,
        scale: 1,
        alpha: 0,
        duration: 640,
        delay: i * 55,
        ease: "Quad.easeOut",
        onComplete: () => st.destroy(),
      });
    }
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI * 2 * i) / 8;
      const p = this.fac.circle(at.x, at.y, 2, gold).setDepth(this.depth + 2);
      this.scene.tweens.add({
        targets: p,
        x: at.x + Math.cos(a) * 26,
        y: at.y + Math.sin(a) * 26,
        alpha: 0,
        scale: 0.2,
        duration: 440,
        ease: "Quad.easeOut",
        onComplete: () => p.destroy(),
      });
    }
  }

  private deathBurst(at: Vec2, boss: boolean, elite = false): void {
    // Elites burst like a mini-boss, tinted gold to match their aura.
    const big = boss || elite;
    const color = boss ? 0xff5a5a : elite ? 0xffd34d : 0xffd27a;
    const n = big ? 14 : 8;
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n;
      const d = big ? 30 : 18;
      const p = this.fac.circle(at.x, at.y, big ? 4 : 3, color).setDepth(this.depth + 1);
      this.scene.tweens.add({
        targets: p,
        x: at.x + Math.cos(a) * d,
        y: at.y + Math.sin(a) * d,
        alpha: 0,
        scale: 0.2,
        duration: big ? 480 : 320,
        ease: "Quad.easeOut",
        onComplete: () => p.destroy(),
      });
    }
    const flash = this.fac
      .circle(at.x, at.y, big ? 22 : 12, 0xffffff, 0.85)
      .setDepth(this.depth + 1);
    this.scene.tweens.add({
      targets: flash,
      scale: 1.8,
      alpha: 0,
      duration: 260,
      onComplete: () => flash.destroy(),
    });
  }

  private coinPop(at: Vec2, to: Vec2, gold: number): void {
    if (gold <= 0) return;
    // The coins now arc into the hero (the loot-magnet), not the HUD counter.
    const n = Math.min(4, 1 + Math.floor(gold / 12));
    for (let i = 0; i < n; i++) {
      this.lootFly.fly(at, to, "coin", { fallbackColor: 0xffd34d, delay: i * 45 });
    }
    const txt = this.fac
      .text(at.x, at.y - 6, `+${gold}`, {
        fontSize: "11px",
        color: "#ffd86a",
        fontStyle: "bold",
        stroke: "#10131c",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(this.depth + 2);
    this.scene.tweens.add({
      targets: txt,
      y: at.y - 26,
      alpha: 0,
      duration: 560,
      ease: "Quad.easeOut",
      onComplete: () => txt.destroy(),
    });
  }
}
