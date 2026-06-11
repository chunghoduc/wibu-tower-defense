#!/usr/bin/env python3
"""Slice an SD animation sheet into a uniform Phaser spritesheet.

rembg -> alpha -> connected components -> keep full-body figures -> scale all by
one factor (preserve relative motion) -> feet-center anchor in uniform cells ->
pack horizontally -> save <out>.png + <out>.json {frameWidth,frameHeight,frames}.

Usage: sliceanim.py IN.png OUT.png [--cell N] [--max-frames N]
"""
import sys, json, numpy as np
from collections import deque
from PIL import Image

_SESS = {}
def _session(model="u2net"):
    if model not in _SESS:
        from rembg import new_session
        _SESS[model] = new_session(model)
    return _SESS[model]

def _cutout(im):
    """Background-remove with u2net; if it segments almost nothing (very dark or
    aura-heavy boss art defeats u2net), retry with the stronger isnet model and
    keep whichever cut covers more of the sheet."""
    from rembg import remove
    import numpy as _np
    cut = remove(im, session=_session("u2net"))
    cov = (_np.asarray(cut)[:, :, 3] > 30).mean()
    if cov < 0.02:
        alt = remove(im, session=_session("isnet-general-use"))
        if (_np.asarray(alt)[:, :, 3] > 30).mean() > cov:
            return alt
    return cut

def components(mask, step=2, min_px=2000):
    H, W = mask.shape
    lab = np.zeros((H, W), np.int32); cur = 0; boxes = []
    for sy in range(0, H, step):
        for sx in range(0, W, step):
            if mask[sy, sx] and lab[sy, sx] == 0:
                cur += 1; q = deque([(sy, sx)]); lab[sy, sx] = cur
                minx = maxx = sx; miny = maxy = sy; cnt = 0
                while q:
                    y, x = q.popleft(); cnt += 1
                    if x < minx: minx = x
                    if x > maxx: maxx = x
                    if y < miny: miny = y
                    if y > maxy: maxy = y
                    for dy, dx in ((1,0),(-1,0),(0,1),(0,-1)):
                        ny, nx = y+dy, x+dx
                        if 0 <= ny < H and 0 <= nx < W and mask[ny, nx] and lab[ny, nx] == 0:
                            lab[ny, nx] = cur; q.append((ny, nx))
                if cnt >= min_px:
                    boxes.append((minx, miny, maxx, maxy))
    return boxes

def _frame_names(n):
    """Rig-style pose names for n sliced frames (idle -> attack -> skill),
    matching the sheet prompt's pose order. Mirrors gen.mjs synthFrameNames so
    the manifest builder and the slicer agree."""
    if n <= 1: return ["idle"]
    if n == 2: return ["idle1", "atk1"]
    if n == 3: return ["idle1", "atk1", "skill1"]
    idle = max(1, round(n * 0.4))
    atk = -(-(n - idle) // 2)  # ceil
    skill = n - idle - atk
    return ([f"idle{i+1}" for i in range(idle)]
            + [f"atk{i+1}" for i in range(atk)]
            + [f"skill{i+1}" for i in range(skill)])

def main(inp, outp, cell=128, max_frames=12):
    im = Image.open(inp).convert("RGBA")
    cut = _cutout(im)
    alpha = np.asarray(cut)[:, :, 3]
    H, W = alpha.shape
    mask = alpha > 30
    raw = components(mask, step=2, min_px=int(0.006 * H * W))
    if not raw:
        print("NO FRAMES"); return 0

    # figure heights; keep near-median-tall figures (drop fragments / partials)
    heights = sorted(b[3] - b[1] for b in raw)
    med_h = heights[len(heights) // 2]
    boxes = [b for b in raw
             if (b[3] - b[1]) >= 0.55 * med_h            # tall enough (full body)
             and (b[2] - b[0]) >= 0.18 * med_h            # not a thin sliver
             and (b[3] - b[1]) >= 1.05 * (b[2] - b[0])]   # portrait: drops merged side-by-side pairs
    # Single-frame fallback: a dramatic boss with a full-bleed aura/glow can merge
    # its poses into one wide blob that the portrait filter rejects, yielding zero
    # frames. Rather than lose the (cinematic) art entirely, keep the largest raw
    # figure as ONE frame — the preload walk-bake synthesizes the stride from it.
    if not boxes:
        big = max(raw, key=lambda b: (b[2] - b[0]) * (b[3] - b[1]))
        boxes = [big]
        print("fallback: 1 merged frame")
    # reading order (row bands then x)
    band = max(1, H // 3)
    boxes.sort(key=lambda b: (b[1] // band, b[0]))
    boxes = boxes[:max_frames]
    n = len(boxes)
    if n == 0:
        print("NO FRAMES"); return 0

    # one global scale so motion/scale stays relative; fit tallest into cell*0.92
    tallest = max(b[3] - b[1] for b in boxes)
    scale = (cell * 0.92) / tallest

    strip = Image.new("RGBA", (cell * n, cell), (0, 0, 0, 0))
    for i, (x0, y0, x1, y1) in enumerate(boxes):
        fig = cut.crop((x0, y0, x1 + 1, y1 + 1))
        nw, nh = max(1, round(fig.width * scale)), max(1, round(fig.height * scale))
        fig = fig.resize((nw, nh), Image.LANCZOS)
        ox = i * cell + (cell - nw) // 2          # horizontal centre
        oy = cell - nh - 2                          # feet anchored to bottom
        strip.alpha_composite(fig, (ox, max(0, oy)))
    strip.save(outp)
    json.dump({"frameWidth": cell, "frameHeight": cell, "frames": n,
               "names": _frame_names(n)},
              open(outp.rsplit(".", 1)[0] + ".json", "w"))
    print(f"sliced {n} frames -> {outp}")
    return n

if __name__ == "__main__":
    args = sys.argv[1:]
    inp, outp = args[0], args[1]
    kw = {}
    i = 2
    while i < len(args):
        if args[i] == "--cell": kw["cell"] = int(args[i+1]); i += 2
        elif args[i] == "--max-frames": kw["max_frames"] = int(args[i+1]); i += 2
        else: i += 1
    main(inp, outp, **kw)
