// Pure helpers for the scrollable/zoomable passive-tree camera. No Phaser imports —
// the scene feeds in node coords + a toPixel fn and applies the results to its camera.
export const ZOOM_MIN = 0.4;
export const ZOOM_MAX = 1.6;

export function clampZoom(z: number): number {
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
}

interface XY {
  x: number;
  y: number;
}
type ToPixel = (gx: number, gy: number) => XY;
interface NodeLite {
  id: string;
  gridX: number;
  gridY: number;
}
export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function treeBounds(nodes: NodeLite[], toPixel: ToPixel, margin = 120): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    const p = toPixel(n.gridX, n.gridY);
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX: minX - margin, minY: minY - margin, maxX: maxX + margin, maxY: maxY + margin };
}

/** Clamp camera scroll (top-left world coord) so the viewport stays over the tree. */
export function clampScroll(
  scrollX: number,
  scrollY: number,
  b: Bounds,
  viewW: number,
  viewH: number,
  zoom: number,
): { scrollX: number; scrollY: number } {
  const vw = viewW / zoom;
  const vh = viewH / zoom;
  const maxX = Math.max(b.minX, b.maxX - vw);
  const maxY = Math.max(b.minY, b.maxY - vh);
  return {
    scrollX: Math.max(b.minX, Math.min(maxX, scrollX)),
    scrollY: Math.max(b.minY, Math.min(maxY, scrollY)),
  };
}

/** Centroid of allocated nodes in pixel space, or grid-start when none allocated. */
export function frontierCenter(nodes: NodeLite[], unlockedIds: string[], toPixel: ToPixel): XY {
  const set = new Set(unlockedIds);
  const picked = nodes.filter((n) => set.has(n.id));
  if (picked.length === 0) {
    const start = nodes.find((n) => n.id === "grid-start") ?? nodes[0];
    return toPixel(start.gridX, start.gridY);
  }
  let sx = 0;
  let sy = 0;
  for (const n of picked) {
    const p = toPixel(n.gridX, n.gridY);
    sx += p.x;
    sy += p.y;
  }
  return { x: sx / picked.length, y: sy / picked.length };
}
