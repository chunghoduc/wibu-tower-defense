#!/usr/bin/env python3
"""Offline preview of heroDressLayout: composite real item icons onto the doll
mannequin at the computed body-region anchors, so we can eyeball placement
without the game/vite. Mirrors src/data/heroDressLayout.ts ANCHORS."""
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SPR = os.path.join(ROOT, "public/assets/sprites/item")
BASE = os.path.join(ROOT, "public/assets/ui/hero-doll/hero-base.png")
OUT = "/tmp/hero_dress_preview.png"

# (nx, ny, scale, behind) — KEEP IN SYNC with heroDressLayout.ts ANCHORS.
ANCHORS = {
    "Wing":      (0.50, 0.34, 0.66, True),
    "BodyArmor": (0.50, 0.40, 0.40, False),
    "Helmet":    (0.50, 0.10, 0.18, False),
    "Boots":     (0.50, 0.90, 0.20, False),
    "Gloves":    (0.70, 0.62, 0.13, False),
    "Weapon":    (0.25, 0.54, 0.50, False),
}
# Representative equipped items (from the catalog) per slot.
ITEMS = {
    "Wing": "fledgling-wings",
    "BodyArmor": "cloth-robe",
    "Helmet": "leather-cap",
    "Boots": "worn-boots",
    "Gloves": "worn-gloves",
    "Weapon": "arcane-staff",
}
# Draw order: behind first, then front by the same depth order as the layout.
ORDER = ["Wing", "BodyArmor", "Boots", "Helmet", "Gloves", "Weapon"]

base = Image.open(BASE).convert("RGBA")
W, H = base.size
canvas = base.copy()
for slot in ORDER:
    icon_id = ITEMS[slot]
    p = os.path.join(SPR, icon_id + ".png")
    if not os.path.exists(p):
        print("missing", p)
        continue
    nx, ny, scale, _behind = ANCHORS[slot]
    icon = Image.open(p).convert("RGBA")
    target_h = int(scale * H)
    s = target_h / icon.height
    icon = icon.resize((max(1, int(icon.width * s)), target_h), Image.LANCZOS)
    cx, cy = int(nx * W), int(ny * H)
    canvas.alpha_composite(icon, (cx - icon.width // 2, cy - icon.height // 2))
    print(f"{slot:9} {icon_id:16} at ({cx},{cy}) h={target_h}")

canvas.save(OUT)
print("saved", OUT, base.size)
