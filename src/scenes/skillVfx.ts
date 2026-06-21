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
import { vfxPower, type VfxPower } from "../data/skillVfxPower.ts";
import type { Rarity } from "../data/schema.ts";

type V = { x: number; y: number };

/** Per-wave radius growth + stagger for the rarity-scaled cascade. */
const WAVE_STAGGER_MS = 150;

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
    rarity?: Rarity,
  ): void {
    const draw = new VfxDraw(this.scene, this.fac, this.depth, this.pool);
    const motif = skillMotif(skillId);
    const spec = skillVfxSpec(skillId);
    // The caster's rarity sets the spectacle: bigger geometry, denser particles,
    // and a multi-wave cascade that rolls outward (the apex tiers add a crowning
    // flourish). A single source of truth for "how powerful does this look".
    const power = vfxPower(rarity);
    if (spec) {
      // Hero skill: deliver from the source — literal projectiles when the skill
      // fires something (tri-shot → 3 arrows), else the choreographed delivery
      // (melee sweep / sky-fall / ground-erupt / beam) — then the bespoke impact
      // set-piece on arrival. baseBurst carries the icon emblem.
      const onArrive = () => {
        // A crisp ground ring at EXACTLY the true AoE radius — the unambiguous
        // "this is the hit zone" marker, independent of the particle flourish.
        draw.ring(at, radius, spec.palette.core, 560, 2.5, 0.6);
        this.replayWaves(draw, power, radius, (wr, first, last) => {
          if (first) this.elements.baseBurst(at, spec.palette.core, wr, skillId, power);
          renderSignature(this.scene, this.fac, this.depth, at, spec, wr, this.pool, power);
          if (last && power.grand) draw.grand(at, spec.palette.core, spec.palette.hot, radius);
        });
      };
      if (motif.kind !== "none") {
        const shots = planVolley(from, at, motif);
        renderVolley(
          this.scene,
          this.fac,
          this.depth,
          this.pool,
          motif.kind,
          shots,
          spec.palette,
          onArrive,
        );
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
      // Crisp AoE boundary ring at the true hit radius (matches the damage zone).
      draw.ring(at, radius, color, 560, 2.5, 0.6);
      this.replayWaves(draw, power, radius, (wr, first, last) => {
        if (first) this.elements.baseBurst(at, color, wr, skillId, power);
        renderTowerShape(draw, shape, at, palette, wr, power); // structural motion (under particles)
        this.elements.render(style, at, color, wr, power); // elemental substance (on top)
        if (last && power.grand) draw.grand(at, color, accent.hot, radius);
      });
      // One weighted shake by SHAPE (heavy blasts/slams shake hardest); never double.
      const heavy = shape === "nova" || shape === "slam";
      const med = shape === "chain" || shape === "beam";
      if (source === "hero" || heavy || med || style === "lightning") {
        this.scene.cameras.main.shake(heavy ? 200 : 130, (heavy ? 0.007 : 0.004) * power.shake);
      }
    };
    if (motif.kind !== "none") {
      // Projectile shapes (barrage/bolt/chain/beam) fire literal shots from the source.
      const shots = planVolley(from, at, motif);
      renderVolley(
        this.scene,
        this.fac,
        this.depth,
        this.pool,
        motif.kind,
        shots,
        palette,
        onArrive,
      );
    } else {
      // Area shapes (nova/slam/cloud/aura) erupt at the target — no projectile.
      renderDelivery(draw, deliveryForShape(shape), from, at, palette, radius, onArrive);
    }
  }

  /** Replay the impact set-piece `power.waves` times, each wave staggered and
   *  growing outward — the "many frames" cascade that makes a Legendary cast read
   *  as far weightier than a Common one. `draw` provides the delayed-call timer.
   *
   *  Crucially, the cascade grows INTO the true AoE: the OUTERMOST wave lands
   *  exactly on `radius` (the real hit edge), with earlier waves nested inside it.
   *  Rarity (`power`) still adds more waves / denser particles / a grand flourish,
   *  but never paints a footprint wider than the zone that actually takes damage. */
  private replayWaves(
    draw: VfxDraw,
    power: VfxPower,
    radius: number,
    wave: (waveRadius: number, isFirst: boolean, isLast: boolean) => void,
  ): void {
    const n = power.waves;
    for (let i = 0; i < n; i++) {
      // i=0 → innermost (0.62·r), i=n-1 → exactly r. Single-wave casts fill to r.
      const t = n === 1 ? 1 : 0.62 + 0.38 * (i / (n - 1));
      const wr = radius * t;
      const fire = () => wave(wr, i === 0, i === n - 1);
      if (i === 0) fire();
      else draw.after(i * WAVE_STAGGER_MS, fire);
    }
  }
}
