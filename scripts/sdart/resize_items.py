#!/usr/bin/env python3
"""One-shot: downscale item icons to the canonical 96x96 the loader expects.

The SDXL run emitted 160x160; PreloadScene loads items as a fixed 96x96 native
asset and the in-battle scaler assumes that size. Resize any oversized item PNG
to 96x96 (high-quality Lanczos), preserving alpha. Idempotent.
"""
import os
from PIL import Image

ITEM_DIR = "public/assets/sprites/item"
SIZE = 96

changed = 0
for name in sorted(os.listdir(ITEM_DIR)):
    if not name.endswith(".png"):
        continue
    path = os.path.join(ITEM_DIR, name)
    im = Image.open(path).convert("RGBA")
    if im.size == (SIZE, SIZE):
        continue
    im.resize((SIZE, SIZE), Image.LANCZOS).save(path)
    changed += 1

print(f"resized {changed} item icons to {SIZE}x{SIZE}")
