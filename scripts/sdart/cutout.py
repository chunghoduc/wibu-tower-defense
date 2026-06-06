#!/usr/bin/env python3
"""Background cutout for isolated-character-on-flat-background SD renders.

Border flood-fill: flood from every edge pixel, marking pixels within a colour
tolerance of their flood-neighbours as background -> alpha 0. Interior character
pixels (even if a similar colour) are preserved because they are not connected to
the border. Then trim to the subject bbox and (optionally) downscale.

Usage: cutout.py IN.png OUT.png [--size N] [--tol T] [--pad P]
"""
import sys
from collections import deque
import numpy as np
from PIL import Image


_REMBG_SESSION = None


def _rembg_alpha(im):
    """Return an alpha mask (PIL 'L') via rembg salient-object segmentation, or None."""
    global _REMBG_SESSION
    try:
        from rembg import remove, new_session
        if _REMBG_SESSION is None:
            _REMBG_SESSION = new_session("u2net")
        out = remove(im.convert("RGBA"), session=_REMBG_SESSION,
                     alpha_matting=True, alpha_matting_foreground_threshold=240,
                     alpha_matting_background_threshold=10, alpha_matting_erode_size=3)
        return out.split()[3]
    except Exception as e:
        print("  rembg unavailable, flood-fill fallback:", str(e)[:60])
        return None


def cutout(inp, outp, size=None, tol=32, pad=8):
    im = Image.open(inp).convert("RGB")

    # Primary: rembg salient segmentation (handles any background).
    alpha_img = _rembg_alpha(im)
    if alpha_img is not None:
        out = im.convert("RGBA")
        out.putalpha(alpha_img)
        _finish(out, outp, size, pad)
        return

    a = np.asarray(im).astype(np.int16)
    h, w, _ = a.shape

    # sample background reference colour from the four corner patches
    k = 12
    corners = np.concatenate([
        a[:k, :k].reshape(-1, 3), a[:k, -k:].reshape(-1, 3),
        a[-k:, :k].reshape(-1, 3), a[-k:, -k:].reshape(-1, 3),
    ])
    ref = np.median(corners, axis=0)

    # pixels close to the background colour (vectorised)
    diff = a - ref
    near = (diff[:, :, 0] ** 2 + diff[:, :, 1] ** 2 + diff[:, :, 2] ** 2) <= tol * tol

    # flood from border, but ONLY across near-bg pixels -> can't enter the subject
    bg = np.zeros((h, w), dtype=bool)
    q = deque()
    for x in range(w):
        if near[0, x]: q.append((0, x))
        if near[h - 1, x]: q.append((h - 1, x))
    for y in range(h):
        if near[y, 0]: q.append((y, 0))
        if near[y, w - 1]: q.append((y, w - 1))
    while q:
        y, x = q.popleft()
        if bg[y, x] or not near[y, x]:
            continue
        bg[y, x] = True
        if y > 0: q.append((y - 1, x))
        if y < h - 1: q.append((y + 1, x))
        if x > 0: q.append((y, x - 1))
        if x < w - 1: q.append((y, x + 1))

    alpha = np.where(bg, 0, 255).astype(np.uint8)
    rgba = np.dstack([np.asarray(im).astype(np.uint8), alpha])
    out = Image.fromarray(rgba, "RGBA")
    _finish(out, outp, size, pad)


def _finish(out, outp, size, pad):
    """Trim to subject bbox, optionally fit within size x size, save."""
    w, h = out.size
    bbox = out.getbbox()
    if bbox:
        l, t, r, b = bbox
        l = max(0, l - pad); t = max(0, t - pad); r = min(w, r + pad); b = min(h, b + pad)
        out = out.crop((l, t, r, b))
    if size:
        ow, oh = out.size
        scale = size / max(ow, oh)
        nw, nh = max(1, round(ow * scale)), max(1, round(oh * scale))
        out = out.resize((nw, nh), Image.LANCZOS)
        canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        canvas.paste(out, ((size - nw) // 2, (size - nh) // 2), out)
        out = canvas
    out.save(outp)


if __name__ == "__main__":
    args = sys.argv[1:]
    inp, outp = args[0], args[1]
    size = tol = pad = None
    kw = {}
    i = 2
    while i < len(args):
        if args[i] == "--size": kw["size"] = int(args[i + 1]); i += 2
        elif args[i] == "--tol": kw["tol"] = int(args[i + 1]); i += 2
        elif args[i] == "--pad": kw["pad"] = int(args[i + 1]); i += 2
        else: i += 1
    cutout(inp, outp, **kw)
    print("cut", outp)
