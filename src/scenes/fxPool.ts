/**
 * FxPool — bounded reuse pool for the one-shot VFX shape primitives (circle /
 * rect / star) that peak combat churns at hundreds per second. Acquire fully
 * resets visual state; release returns to the pool (or destroys past the cap,
 * so memory is bounded and a missed release degrades to today's behavior).
 * Kind-tagging uses a WeakMap, not instanceof, so the logic is Phaser-free and
 * unit-testable. Pool instances live per battle (objects die with the scene).
 */
import type Phaser from "phaser";

type Shape = Phaser.GameObjects.Shape;
type Kind = "circle" | "rect" | "star";

export class FxPool {
  private readonly free: Record<Kind, Shape[]> = { circle: [], rect: [], star: [] };
  private readonly kindOf = new WeakMap<object, Kind>();

  constructor(
    private readonly fac: Phaser.GameObjects.GameObjectFactory,
    private readonly cap = 128,
  ) {}

  /** Common reset; callers then chain setters exactly as with a fresh factory object. */
  private reset(o: Shape, x: number, y: number): Shape {
    return o
      .setPosition(x, y)
      .setAlpha(1)
      .setScale(1)
      .setAngle(0)
      .setOrigin(0.5)
      .setStrokeStyle() // no args → stroke off
      .setBlendMode(0) // NORMAL — many fx set ADD; a reused shape must not ghost-glow
      .setVisible(true)
      .setActive(true);
  }

  circle(x: number, y: number, r: number, fill?: number, alpha = 1): Phaser.GameObjects.Arc {
    const o = this.free.circle.pop() as Phaser.GameObjects.Arc | undefined;
    if (!o) {
      const made = this.fac.circle(x, y, r, fill, alpha);
      this.kindOf.set(made, "circle");
      return made;
    }
    o.radius = r;
    this.fill(this.reset(o, x, y), fill, alpha);
    return o;
  }

  rect(
    x: number,
    y: number,
    w: number,
    h: number,
    fill?: number,
    alpha = 1,
  ): Phaser.GameObjects.Rectangle {
    const o = this.free.rect.pop() as Phaser.GameObjects.Rectangle | undefined;
    if (!o) {
      const made = this.fac.rectangle(x, y, w, h, fill, alpha);
      this.kindOf.set(made, "rect");
      return made;
    }
    o.setSize(w, h);
    this.fill(this.reset(o, x, y), fill, alpha);
    return o;
  }

  star(
    x: number,
    y: number,
    points: number,
    innerR: number,
    outerR: number,
    fill?: number,
    alpha = 1,
  ): Phaser.GameObjects.Star {
    const o = this.free.star.pop() as Phaser.GameObjects.Star | undefined;
    if (!o) {
      const made = this.fac.star(x, y, points, innerR, outerR, fill, alpha);
      this.kindOf.set(made, "star");
      return made;
    }
    o.points = points; // updating accessors — rebuild the star geometry
    o.innerRadius = innerR;
    o.outerRadius = outerR;
    this.fill(this.reset(o, x, y), fill, alpha);
    return o;
  }

  /** Re-apply fill exactly like the factory: undefined color = NOT filled (stroke-only shapes). */
  private fill(o: Shape, color: number | undefined, alpha: number): void {
    if (color === undefined)
      o.setFillStyle(); // no args → fill off
    else o.setFillStyle(color, alpha);
  }

  /** Return a pool-made shape for reuse; anything else (or past cap) is destroyed. */
  release(o: Shape): void {
    const kind = this.kindOf.get(o);
    if (!kind || this.free[kind].length >= this.cap) {
      o.destroy();
      return;
    }
    o.setVisible(false).setActive(false);
    this.free[kind].push(o);
  }
}
