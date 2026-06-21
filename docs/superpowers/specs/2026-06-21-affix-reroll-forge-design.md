# Affix Reroll station in the Forge — design

**Date:** 2026-06-21
**Status:** approved (self-approved under the delegated full-autonomy session rule)

## Problem

Players want to re-roll an item's affixes from the **Forge** (the crafting hub),
spending **Jewel of Entropy**, where the entropy cost scales with **item rarity**
and with **how many times that specific item has already been rerolled**. Today a
"Reforge" feature exists but:

1. It lives only in the **Shop** "recycle" dialog — not in the Forge menu the user
   expects.
2. Its cost is **rarity-only** (flat `Rare 3 / Legendary 6 / Unique 10` entropy +
   gold) — it does **not** escalate per reroll, so there is no rising sink and no
   "pity vs. greed" tension.
3. There is **no per-item reroll counter**, so escalation can't be expressed.

## Goal

Add a first-class **"Reroll Affixes"** station to the Forge with a dedicated,
information-rich, easy-to-use dialog. Unify the underlying logic so the Shop's
existing reforge and the new Forge station share one source of truth.

## Decisions

### What gets rerolled (unchanged from existing reforge)

Only the item's **secondary affixes** (`rolledAffixes`) are re-rolled, using the
exact same `rollAffixes(def, rng, apexMult)` as a fresh drop. **Primary affix,
base stats, enhancement level, required level and Apex flag are preserved** — they
are the item's identity. Reroll **commits immediately** (replaces the old affixes);
there is no keep-old/keep-new gamble (out of scope, would need to bank a previous
roll).

### Eligibility

`Rare`, `Legendary`, `Unique` only (Common has 0 affixes, Magic has 1 — not worth a
station). Equipped items are allowed (the item is never removed, same as enhance).

### Cost model (escalating)

A new per-item field `rerollCount` (times this item has been rerolled). Let
`n = min(rerollCount, RAMP_CAP)` with `RAMP_CAP = 10`.

- **Entropy (primary, headline cost):**
  `entropy(rarity, n) = BASE_E[rarity] + STEP_E[rarity] * n`
  - Rare: base 3, step +2 → 3, 5, 7, … capped at n=10 → 23
  - Legendary: base 6, step +3 → 6, 9, 12, … → 36
  - Unique: base 10, step +5 → 10, 15, 20, … → 60
- **Gold (secondary, preserves the existing gold-sink role of reforge):**
  `gold(rarity, n) = round(BASE_G[rarity] * (1 + GOLD_RAMP * n))`, `GOLD_RAMP = 0.35`
  - Rare base 400, Legendary base 900, Unique base 2000.

At `n = 0` this reproduces today's flat reforge cost exactly (zero balance
regression for first reroll), then ramps. The cap keeps a heavily-chased item
expensive-but-possible rather than runaway. `BASE_E` / `STEP_E` / `BASE_G` are the
only tuning knobs and live as named constants. (Entropy faucet for reference —
smelt yields: Common 1 / Magic 2 / Rare 4 / Legendary 8 / Unique 16.)

### Data / save

Add optional `rerollCount?: number` to `ItemInstance` (schema.ts) and
`ItemInstanceSave` (save.ts). **Read as `inst.rerollCount ?? 0`** everywhere, so
existing saved items (undefined) are treated as 0 — no destructive migration and
no save-version bump required (mirrors how `apex?` / `requiredLevel?` were added).
`reforgeItem` increments it on success (`inst.rerollCount = (inst.rerollCount ?? 0) + 1`).

## Architecture (small, isolated units)

- **`src/core/reforge.ts` (upgrade, pure):** new escalating cost API.
  - `reforgeCost(rarity, rerollCount = 0): { gold; entropy } | null`
  - `canReforge(rarity): boolean` (unchanged contract)
  - `reforgeItem(save, instanceId, rng): ReforgeResult` — now charges the escalated
    cost (gold + entropy), increments `rerollCount`, reason `"no-entropy"` replaces
    `"no-chaos"`. `ReforgeCost` field renamed `chaos → entropy` (display-facing;
    the material id is still `chaos-jewel` = "Jewel of Entropy").
- **`src/data/rerollView.ts` (new, pure, Phaser-free, tested):** view-model.
  - `rerollEligibleItems(save): RerollItemVM[]` — id, name, rarity, slot, defId,
    enhanceLevel, rerollCount, entropyCost, goldCost, affordable, equipped. Sorted
    rarity-desc then name.
  - `rerollAffixRows(inst, def): AffixRow[]` — the current affixes as colour-coded
    rows (reuses `itemStatRows` filtered to `source === "affix"`).
  - `rerollDiff(prev: RolledAffix[], next: RolledAffix[])` — a before/after pairing
    for the post-reroll comparison panel.
- **`src/scenes/affixRerollDialog.ts` (new, presenter):** the modal. If it nears
  500 lines, split the left list into `rerollItemList.ts`.
- **`src/core/forgeStations.ts`:** add `"reroll"` to `StationId` and a
  `rerollStationVM(entropyOwned, eligibleCount)` factory (preview = entropy jewel →
  refreshed affixes), mirroring `wingsStationVM`.
- **`src/scenes/ForgeScene.ts`:** add the station to `stations()`, route
  `vm.id === "reroll"` in `openStation()` to `openRerollDialog()` (like wings),
  rebuild on success.
- **`src/scenes/ShopScene.ts`:** keep its reforge button; update its cost read to
  `reforgeCost(rarity, inst.rerollCount ?? 0)` and the `{entropy}` field rename.

## UI / UX (the focus: ease-of-use + dense information)

One full-screen modal, two columns — pick on the left, act on the right.

- **Header:** `🎲 Reroll Affixes` (left). Right: live balances — `◆ Jewel of
  Entropy ×N` and `🪙 gold` — so the player always sees what they can spend.
- **Left column (scrollable item list, ~300px):** one row per eligible item: icon +
  name (rarity colour) + slot tag + `↻×n` reroll-count badge + that item's **next
  entropy cost**. Selected row highlighted; unaffordable rows dim their cost. Uses
  `attachDragScroll` **with teardown** (per the DragScroll-teardown rule). Empty
  state: "No Rare+ gear to reroll — find or keep rarer gear."
- **Right column (detail, ~520px):**
  - Item icon + name + rarity + slot + enhance + `Rerolled ×n`.
  - **Current Affixes** panel — colour-coded affix rows (purple source, quality
    tint), reusing the tooltip's row renderer.
  - **After a reroll:** a **Previous → New** comparison — the pre-click affixes in a
    faded left mini-column, the freshly-rolled affixes bright on the right, so the
    player can see exactly what changed.
  - Preservation note: "Only affixes change — primary affix, base stats, enhancement
    & level are kept."
  - **Cost line:** `◆ X Entropy + 🪙 Y gold`, green when affordable, red + "Need N
    more ◆" when short. A sub-line: "Each reroll on this item raises the price."
  - **REROLL button** (gold, prominent) showing the entropy cost; dimmed +
    non-interactive when unaffordable. On success: play forge FX, refresh balances,
    list and the before/after panel in place (dialog stays open for chain-rerolling).

Dual-coded throughout (colour + shape/label), no reliance on colour alone.

## Testing

- `tests/reforge.test.ts` (extend): escalation curve per rarity, `n=0` equals legacy
  baseline, cap at `RAMP_CAP`, ineligible rarities, `rerollCount` increments, charges
  gold+entropy, fails with reasons when short, affixes actually change, primary/base
  untouched.
- `tests/rerollView.test.ts` (new): eligible filter (Rare+ only, equipped included),
  sorting, per-item cost reflects that item's `rerollCount`, affordability flags,
  affix rows, diff pairing.

## Out of scope

- Keep-old vs. keep-new gamble / banking a previous roll.
- Rerolling primary affix or base stats; targeted/locked affixes.
- Any art regeneration (no new SDXL, no ASSET_VERSION bump — pure mechanics + vector
  UI chrome). Reuses the existing `chaos`/entropy material icon.
