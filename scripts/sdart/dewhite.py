#!/usr/bin/env python3
"""Remove flat-white render background that leaked between body parts.

The animation cutout (cutout.py) flood-fills the background from the sheet
border, so the OUTER silhouette is clean. But pure-white background trapped in
enclosed pockets -- the V between a wide stance, the loop inside a swirling VFX
aura, the gap under a bent elbow -- is not border-connected, so it survives as
opaque ~white pixels. Those read as ugly white blobs between limbs in-game.

We can't just flood inward from the transparent plane: a swirling aura often
fully SEALS its inner pocket, so the flood never reaches it. Instead we detect
the trapped background by what it IS -- the flat render white -- and clear it.

A pixel is render-background iff it is:
  - bright   : min(R,G,B) >= THRESH      (SD shades real surfaces well below this)
  - neutral  : max-min channel <= SPREAD (flat grey-white, not a tinted highlight)
  - opaque   : alpha > 180
Connected components of such pixels with area >= MIN_AREA are cleared. The three
conditions together spare everything legitimate: shaded bodies/robes/bone fail
"bright"; coloured VFX (flame cores, magic orbs, energy auras) fail "neutral";
and the area floor keeps stray eye-glint / tooth specks. Validated by eye across
the boss + enemy sheets (flames, robes, ribcage, orbs all preserved).

Usage: dewhite.py FILE.png [FILE.png ...] [--thresh N] [--spread S] [--min-area A]
"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage

THRESH = 246      # min(R,G,B) at/above this == background-bright
SPREAD = 6        # max-min channel spread at/below this == neutral (untinted)
MIN_AREA = 24     # ignore specks smaller than this (eye glints, sparkles)
SOLID_ALPHA = 180 # only treat near-opaque pixels as candidate background


def dewhite(path, thresh=THRESH, spread=SPREAD, min_area=MIN_AREA):
    im = Image.open(path).convert("RGBA")
    a = np.asarray(im)
    rgb = a[:, :, :3].astype(np.int16)
    al = a[:, :, 3]

    mn = rgb.min(axis=2)
    mx = rgb.max(axis=2)
    mask = (mn >= thresh) & ((mx - mn) <= spread) & (al > SOLID_ALPHA)

    lab, n = ndimage.label(mask)  # 4-conn; pockets are solid blobs so this suffices
    if n == 0:
        print(f"  {path}: no trapped white")
        return 0
    areas = ndimage.sum(mask, lab, range(1, n + 1))
    drop = np.zeros(n + 1, dtype=bool)
    for i in range(1, n + 1):
        if areas[i - 1] >= min_area:
            drop[i] = True
    clear = drop[lab]
    if not clear.any():
        print(f"  {path}: no trapped white above area floor")
        return 0
    out = a.copy()
    out[clear, 3] = 0
    Image.fromarray(out, "RGBA").save(path)
    print(f"  {path}: cleared {int(clear.sum())} trapped-white px in "
          f"{int(drop.sum())} pocket(s)")
    return int(clear.sum())


if __name__ == "__main__":
    args = sys.argv[1:]
    thresh, spread, min_area = THRESH, SPREAD, MIN_AREA
    files = []
    i = 0
    while i < len(args):
        if args[i] == "--thresh": thresh = int(args[i + 1]); i += 2
        elif args[i] == "--spread": spread = int(args[i + 1]); i += 2
        elif args[i] == "--min-area": min_area = int(args[i + 1]); i += 2
        else: files.append(args[i]); i += 1
    total = 0
    for f in files:
        total += dewhite(f, thresh, spread, min_area)
    print(f"done: {total} px cleared across {len(files)} file(s)")
