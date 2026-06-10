---
name: create-item
description: >-
  Create a new equipment item (weapon, armor, accessory, pet, or wing) for the
  Wibu Tower Defense game and wire it into the data catalog. Use whenever the
  user wants to add an item, weapon, armor piece, accessory, loot drop, or an
  anime-gear homage, fill a slot/rarity gap, or says things like "add a new
  sword", "make a [anime] weapon homage", "we need a Legendary helmet", or
  "design an item based on X". Runs a fixed pipeline (source -> slot/type ->
  rarity -> stats -> homage name + appearance metadata -> wire + regen art) so
  every item is balanced, legally safe, visually consistent, and regenerates its
  icon (and worn overlay) from one source of truth. Prefer this over hand-editing
  items.ts / itemLore.ts directly.
---

# Create Item

This skill adds a new equipment item to **Wibu Tower Defense**. Items are
**original homages** to iconic anime gear — they *evoke* a famous weapon/armor/
artifact's vibe but never copy its real name or likeness (a legal requirement,
not a style choice — same rule as `create-character`). The real source lives
only in the designer-only `homage` field and is never shown to players.

The item's identity lives in **one place** — `src/data/itemLore.ts`. That single
`appearance` block drives BOTH the inventory icon AND the in-battle "worn"
overlay, so they can never drift. `appearance.look` is fed verbatim to the SDXL
art pipeline. Get the metadata right and the art follows automatically.

Follow the six stages in order. Before starting, skim
`references/item-data-model.md` (the data contract, silhouette families, the
id-stability rule) and `references/balancing.md` (stat budgets, shared with
characters).

---

## Stage 1 — Source selection

Pick the **anime gear** the item pays homage to (a weapon, armor piece, or
artifact). If the user named one, use it. Otherwise propose 2–3 famous options.
Note the source item's **power tier** in its story — this sets rarity in Stage 3
(a starter blade → Common; a world-ending relic → Unique).

**Output:** the source item + a power-tier read (weak / mid / strong / top-tier).

## Stage 2 — Slot & type

Map the source to a **slot** and, for weapons, a **weaponType**:

- Slot ∈ `Weapon, Helmet, BodyArmor, Gloves, Boots, Amulet, Ring, Pet, Wing`.
- `weaponType` (Weapon only) ∈ `Sword, Bow, Staff, Gun, Tome, Fist` — drives the
  hero's hold pose, attack motion, and range. Map the fighting style: blade →
  Sword; ranged draw → Bow; channelled magic → Staff/Tome; firearm → Gun;
  martial → Fist.
- Pick the **silhouette family** (see the data model's family list) — it decides
  the icon shape and the worn-art template. Reuse an existing family; only add a
  new one if no family reads.

**Check the catalog grid.** Open `src/data/items.ts`; prefer filling an empty
(slot × rarity) cell. Decide: is this a **one-off base/signature item**, or a new
**5-rarity line**? Lines (`ITEM_LINES`) auto-generate Worn→Mythic tiers sharing
one homage; base items stand alone.

**Output:** slot, weaponType (if weapon), family, and base-vs-line decision.

## Stage 3 — Rarity & required level

Set rarity from the Stage 1 power tier (Common → Magic → Rare → Legendary →
Unique) and the required level from `RARITY_TIERS` in `items.ts` (or the closest
hand-tuned value for a signature piece). A line spans all five rarities; a base
item picks one.

**Output:** rarity (per tier for a line) + requiredLevel.

## Stage 4 — Stats & affixes

Produce the catalog entry (`ItemDef` for a base item, or an `ItemLine`).

1. **baseStats / primary affix** — use the rarity × slot budgets in
   `references/balancing.md`. The primary affix is the item's identity stat; the
   `affixPool` is the random roll pool (rarity gates how many roll). Keep crit
   stats modest (they roll flat) — see the `AFFIX_RANGE` caps in `items.ts`.
2. **Slot extras** — Pet → `petUtility`; Wing → optional `wingPassive`.
3. **Add it**: a line goes in `ITEM_LINES`; a base/signature item goes in the
   `ITEM_CATALOG` literal via the `i({...})` helper, with `artRef: "placeholder"`.
   **Never reuse an existing id** — ids are save-keys and PNG filenames.

**Output:** a balanced catalog entry that the content tests accept.

## Stage 5 — Homage name + appearance metadata

Author the entry in `src/data/itemLore.ts`, keyed by item id (base) or line id:

1. **`name`** (base) or **`base`** (line) — an original homage name (NOT the real
   item's name). The line renders `"<Rarity prefix> <base>"` automatically.
2. **`homage: { source, original }`** — designer-only note naming the anime + the
   real item. Never shipped.
3. **`appearance.family`** — the Stage 2 family.
4. **`appearance.material: { tint, accent }`** — curated hex colors (body tint +
   accent). These are reused by BOTH icon and worn art — never sampled from a
   PNG. Match the source's signature colors.
5. **`appearance.look`** — one prose sentence describing *exactly* how it looks.
   This is the SDXL prompt seed; be concrete about shape, material, and details.
   Do NOT mention rarity color here — rarity is added as a rim-glow layer.
6. **`specialty`** — what makes it special, echoing the source item's gimmick
   (tie it to the primary affix where natural).
7. **`lore`** — a 1–2 sentence player-facing flavor line.

**Output:** a complete `ItemLoreEntry`.

## Stage 6 — Wire & regenerate art

1. **Verify the data** (this is how you know it's wired right):
   ```bash
   npm run typecheck && npm test
   ```
   The content tests enforce unique ids, slot coverage, weaponType on weapons,
   positive primary values, and required levels. Fix anything they flag.
2. **Refresh the SDXL prompt set** from the catalog:
   ```bash
   npm run gen:item-visual          # rewrites scripts/sdart/itemVisual.json
   ```
3. **Generate the icon(s)** (also refreshes the worn overlay — they share the art).
   The SD server must be running at `http://127.0.0.1:8765`. Generate only the
   new ids (omit `--force` so existing icons are skipped):
   ```bash
   node scripts/sdart/sdgen.mjs --only=item
   ```
   For a single new line you can regenerate everything safely with `--force`, but
   that re-renders all items — prefer the resumable default for one new item.
4. Confirm the PNG(s) landed under `public/assets/sprites/item/<id>.png`.

**Output:** committed-quality data + a generated icon that matches the metadata.

---

## Wrap up

Summarize the new item: the homage and source, slot/type/rarity, the identity
stat, the look, and where the icon was written. Confirm tests pass. Offer to
commit (Conventional Commit, e.g. `feat(content): add <name> (<slot> <rarity>)`).
