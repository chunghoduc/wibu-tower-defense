// src/scenes/skillVfx.ts
//
// Cinematic active-skill cast VFX dispatcher (heroes + towers). Hero actives
// each get a bespoke signature (skillSignatures.ts) delivered from the caster
// (skillDelivery.ts); tower actives compose element × shape — the elemental
// substance layer lives in skillElementFx.ts and the structural shape motion in
// towerSkillFx.ts. FxLayer delegates the "cast" event here; pure presentation.
import type Phaser from "phaser";
import { SKILL_STYLE_COLOR, skillStyleFor } from "../data/attackStyle.ts";
import { skillVfxSpec, deliveryForShape } from "../data/skillVfxMeta.ts";
import { skillMotif } from "../data/skillMotif.ts";
import { skillShapeFor } from "../data/towerSkillShapeIndex.ts";
import { renderSignature } from "./skillSignatures.ts";
import { renderTowerShape } from "./towerSkillFx.ts";
import { renderDelivery } from "./skillDelivery.ts";
import { planVolley } from "./projectileVolley.ts";
import { renderVolley } from "./projectileVolleyFx.ts";
import { VfxDraw } from "./vfxDraw.ts";
import type { FxPool } from "./fxPool.ts";
import { ACCENT, SkillElementFx } from "./skillElementFx.ts";

type V = { x: number; y: number };

export class SkillVfx {
  /** Shared base burst + elemental substance set-pieces (fire/ice/lightning/…). */
  private readonly elements: SkillElementFx;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly fac: Phaser.GameObjects.GameObjectFactory,
    private readonly depth: number,
    /** Shared one-shot shape pool (owned by FxLayer; outlives each cast). */
    private readonly pool?: FxPool,
  ) {
    this.elements = new SkillElementFx(scene, fac, depth);
  }

  /** Render a skill cast. Hero active skills each have a UNIQUE bespoke signature
   *  (skillSignatures.ts); everything else (tower actives) falls back to the
   *  keyword-derived elemental style. */
  cast(
    from: V,
    at: V,
    radius: number,
    skillId: string | undefined,
    source: "tower" | "hero",
  ): void {
    const draw = new VfxDraw(this.scene, this.fac, this.depth, this.pool);
    const motif = skillMotif(skillId);
    const spec = skillVfxSpec(skillId);
    if (spec) {
      // Hero skill: deliver from the source — literal projectiles when the skill
      // fires something (tri-shot → 3 arrows), else the choreographed delivery
      // (melee sweep / sky-fall / ground-erupt / beam) — then the bespoke impact
      // set-piece on arrival. baseBurst carries the icon emblem.
      const onArrive = () => {
        this.elements.baseBurst(at, spec.palette.core, radius, skillId);
        renderSignature(this.scene, this.fac, this.depth, at, spec, radius, this.pool);
      };
      if (motif.kind !== "none") {
        const shots = planVolley(from, at, motif);
        renderVolley(this.scene, this.fac, this.depth, this.pool, motif.kind, shots, spec.palette, onArrive);
      } else {
        renderDelivery(draw, spec.delivery, from, at, spec.palette, radius, onArrive);
      }
      return;
    }
    // Tower active (or any id without a bespoke hero signature): element × shape.
    // element → palette + substance particles; shape → delivery + motion flourish.
    const style = skillStyleFor(skillId);
    const color = SKILL_STYLE_COLOR[style];
    const accent = ACCENT[style];
    const palette = { core: color, hot: accent.hot, deep: accent.deep };
    const shape = skillShapeFor(skillId);
    const onArrive = () => {
      this.elements.baseBurst(at, color, radius, skillId);
      renderTowerShape(draw, shape, at, palette, radius); // structural motion (under particles)
      this.elements.render(style, at, color, radius); // elemental substance (on top)
      // One weighted shake by SHAPE (heavy blasts/slams shake hardest); never double.
      const heavy = shape === "nova" || shape === "slam";
      const med = shape === "chain" || shape === "beam";
      if (source === "hero" || heavy || med || style === "lightning") {
        this.scene.cameras.main.shake(heavy ? 200 : 130, heavy ? 0.007 : 0.004);
      }
    };
    if (motif.kind !== "none") {
      // Projectile shapes (barrage/bolt/chain/beam) fire literal shots from the source.
      const shots = planVolley(from, at, motif);
      renderVolley(this.scene, this.fac, this.depth, this.pool, motif.kind, shots, palette, onArrive);
    } else {
      // Area shapes (nova/slam/cloud/aura) erupt at the target — no projectile.
      renderDelivery(draw, deliveryForShape(shape), from, at, palette, radius, onArrive);
    }
  }
}
